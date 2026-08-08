// ============================================
// memory-bridge.js — claude-mem ChromaDB 桥接（可选）
// 当 claude-mem worker 运行时，同步事实到向量数据库
// ============================================

import Facts from './facts.js';

const MemoryBridge = {
  chromaURL: 'http://127.0.0.1:8000',
  collectionName: 'chat-ai-memories',
  enabled: false,

  /**
   * 检查 ChromaDB 是否可用
   */
  async checkAvailability() {
    try {
      const resp = await fetch(`${this.chromaURL}/api/v1/heartbeat`, {
        signal: AbortSignal.timeout(2000),
      });
      this.enabled = resp.ok;
      return this.enabled;
    } catch {
      this.enabled = false;
      return false;
    }
  },

  /**
   * 将事实同步到 ChromaDB
   */
  async syncFact(fact) {
    if (!this.enabled) return false;
    try {
      // 确保 collection 存在
      await this._ensureCollection();

      // 存储到 ChromaDB
      const resp = await fetch(`${this.chromaURL}/api/v1/collections/${this.collectionName}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [fact.id],
          documents: [fact.fact],
          metadatas: [{
            category: fact.category,
            importance: fact.importance,
            createdAt: fact.createdAt,
          }],
        }),
      });
      if (!resp.ok) {
        console.warn('ChromaDB 同步失败', resp.status);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('ChromaDB 同步失败', e);
      return false;
    }
  },

  /**
   * 批量同步所有事实到 ChromaDB
   */
  async syncAll() {
    if (!this.enabled) {
      const available = await this.checkAvailability();
      if (!available) return { synced: 0, error: 'ChromaDB 不可用' };
    }

    try {
      await this._ensureCollection();
      const facts = await Facts.list();

      // 分批处理
      const batchSize = 50;
      let synced = 0;
      for (let i = 0; i < facts.length; i += batchSize) {
        const batch = facts.slice(i, i + batchSize);
        const resp = await fetch(`${this.chromaURL}/api/v1/collections/${this.collectionName}/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: batch.map(f => f.id),
            documents: batch.map(f => f.fact),
            metadatas: batch.map(f => ({
              category: f.category,
              importance: f.importance,
              createdAt: f.createdAt,
            })),
          }),
        });
        if (!resp.ok) {
          console.warn('ChromaDB 批量同步失败', resp.status);
          return { synced, error: `HTTP ${resp.status}` };
        }
        synced += batch.length;
      }
      return { synced };
    } catch (e) {
      console.warn('批量同步 ChromaDB 失败', e);
      return { synced: 0, error: e.message };
    }
  },

  /**
   * 从 ChromaDB 语义搜索记忆
   */
  async search(query, topK = 10) {
    if (!this.enabled) return [];
    try {
      const resp = await fetch(
        `${this.chromaURL}/api/v1/collections/${this.collectionName}/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryTexts: [query],
            nResults: topK,
          }),
        }
      );
      const data = await resp.json();
      // ChromaDB 返回格式可能有差异，做兼容处理
      const ids = data.ids?.[0] || [];
      const documents = data.documents?.[0] || [];
      const distances = data.distances?.[0] || [];

      return ids.map((id, i) => ({
        id,
        fact: documents[i] || '',
        distance: distances[i] || 0,
      }));
    } catch (e) {
      console.warn('ChromaDB 搜索失败', e);
      return [];
    }
  },

  /**
   * 确保 collection 存在
   */
  async _ensureCollection() {
    try {
      const resp = await fetch(`${this.chromaURL}/api/v1/collections`);
      const collections = await resp.json();
      const exists = collections.some(c => c.name === this.collectionName);

      if (!exists) {
        await fetch(`${this.chromaURL}/api/v1/collections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: this.collectionName,
            metadata: { description: '仰止记忆库' },
          }),
        });
      }
    } catch (e) {
      console.warn('ChromaDB collection 检查失败', e);
    }
  },
};

export default MemoryBridge;
