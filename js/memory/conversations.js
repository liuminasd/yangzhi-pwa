// ============================================
// conversations.js — 对话管理
// ============================================

import DB from './store.js';
import Security from '../utils/security.js';

const Conversations = {
  /**
   * 创建新对话
   */
  async create(title = '新对话') {
    const conv = {
      id: Security.uuid(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      pinned: false,
      summary: null,
    };
    await DB.add('conversations', conv);
    return conv;
  },

  /**
   * 获取所有对话（按更新时间倒序）
   */
  async list() {
    return await DB.getAll('conversations', 'updatedAt', 'prev');
  },

  /**
   * 获取单个对话
   */
  async get(id) {
    const conv = await DB.get('conversations', id);
    if (!conv) return null;
    const messages = await DB.getByIndex('messages', 'conversationId', id);
    messages.sort((a, b) => a.timestamp - b.timestamp);
    return { ...conv, messages };
  },

  /**
   * 获取对话的消息列表
   */
  async getMessages(convId, limit = 100) {
    // 使用 cursor 方向读取最近 N 条消息（避免全量加载后切片）
    if (!DB.db) {
      // 降级：数据库未初始化时使用全量加载
      const messages = await DB.getByIndex('messages', 'conversationId', convId);
      messages.sort((a, b) => a.timestamp - b.timestamp);
      return limit ? messages.slice(-limit) : messages;
    }
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction('messages', 'readonly');
      const idx = tx.objectStore('messages').index('conversationId');
      const results = [];
      const request = idx.openCursor(IDBKeyRange.only(convId), 'prev');
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results.reverse());
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 添加消息到对话
   */
  async addMessage(convId, role, content, metadata = {}) {
    const msg = {
      id: Security.uuid(),
      conversationId: convId,
      role,        // 'user' | 'assistant' | 'system'
      content,
      timestamp: Date.now(),
      skillOrigin: metadata.skillId || null,
      tokens: metadata.tokens || 0,
      // v2: 扩展字段
      attachments: metadata.attachments || null,
      senderName: metadata.senderName || null,
    };

    try {
      await DB.execInTransaction(['messages', 'conversations'], (stores) => {
        stores.messages.add(msg);
        const convStore = stores.conversations;
        const getReq = convStore.get(convId);
        getReq.onsuccess = () => {
          const conv = getReq.result;
          if (conv) {
            conv.updatedAt = Date.now();
            conv.messageCount = (conv.messageCount || 0) + 1;
            if (conv.title === '新对话' && role === 'user') {
              conv.title = content.replace(/\n/g, ' ').slice(0, 30);
            }
            convStore.put(conv);
          }
        };
      });
    } catch (e) {
      // 事务失败，回退到单独写入消息
      console.warn('事务写入失败，回退到单独写入', e);
      await DB.add('messages', msg);
      const conv = await DB.get('conversations', convId);
      if (conv) {
        conv.updatedAt = Date.now();
        conv.messageCount = (conv.messageCount || 0) + 1;
        if (conv.title === '新对话' && role === 'user') {
          conv.title = content.replace(/\n/g, ' ').slice(0, 30);
        }
        await DB.put('conversations', conv);
      }
    }

    return msg;
  },

  /**
   * 更新对话
   */
  async update(id, changes) {
    const conv = await DB.get('conversations', id);
    if (!conv) return;
    Object.assign(conv, changes);
    conv.updatedAt = Date.now();
    await DB.put('conversations', conv);
    return conv;
  },

  /**
   * 删除对话（级联删除消息）
   */
  async remove(id) {
    const messages = await DB.getByIndex('messages', 'conversationId', id);

    try {
      await DB.execInTransaction(['messages', 'conversations'], (stores) => {
        for (const msg of messages) {
          stores.messages.delete(msg.id);
        }
        stores.conversations.delete(id);
      });
    } catch (e) {
      // 事务失败，回退到逐条删除（尽力而为）
      console.warn('事务删除失败，回退到逐条删除', e);
      for (const msg of messages) {
        await DB.delete('messages', msg.id);
      }
      await DB.delete('conversations', id);
    }
  },

  /**
   * 获取对话预览文本（最后一条消息）
   */
  async getPreview(convId) {
    const messages = await DB.getByIndex('messages', 'conversationId', convId);
    if (messages.length === 0) return '暂无消息';
    const last = messages[messages.length - 1];
    return last.content.replace(/\n/g, ' ').slice(0, 50);
  },
};

export default Conversations;
