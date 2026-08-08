// ============================================
// facts.js — 长期记忆：事实提取、存储、搜索、注入
// ============================================

import DB from './store.js';
import Security from '../utils/security.js';

const Facts = {
  // 事实类别
  CATEGORIES: {
    personal:    { label: '个人信息', icon: '👤', importance: 0.8 },
    preference:  { label: '偏好习惯', icon: '💝', importance: 0.7 },
    relationship:{ label: '人际关系', icon: '👥', importance: 0.75 },
    event:       { label: '重要事件', icon: '📅', importance: 0.7 },
    plan:        { label: '计划目标', icon: '🎯', importance: 0.6 },
    knowledge:   { label: '知识见解', icon: '💡', importance: 0.5 },
    explicit:    { label: '明确记忆', icon: '📌', importance: 1.0 },
    other:       { label: '其他', icon: '📋', importance: 0.3 },
  },

  /**
   * 添加一条事实
   */
  async add(fact, category = 'other', importance = 0.5, sourceConvId = null) {
    const record = {
      id: Security.uuid(),
      fact,
      category,
      importance,
      sourceConvId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    };
    await DB.add('facts', record);
    return record;
  },

  /**
   * 获取所有事实
   */
  async list(categoryFilter = null) {
    let facts = await DB.getAll('facts', 'createdAt', 'prev');
    if (categoryFilter) {
      facts = facts.filter(f => f.category === categoryFilter);
    }
    return facts;
  },

  /**
   * 搜索事实：中文 N-gram + 关键词匹配
   */
  async search(query, topK = 20) {
    const facts = await DB.getAll('facts', 'createdAt', 'prev');
    if (!query || !query.trim()) {
      return facts.slice(0, topK);
    }

    const q = query.toLowerCase().trim();
    const scored = facts.map(f => {
      let score = 0;
      const content = f.fact.toLowerCase();

      // 精确匹配加分
      if (content.includes(q)) score += 10;

      // 分词匹配（简单按字切分）
      const qChars = q.replace(/\s/g, '').split('');
      const factChars = content.replace(/\s/g, '').split('');

      // Bigram 匹配
      for (let i = 0; i < factChars.length - 1; i++) {
        const bigram = factChars.slice(i, i + 2).join('');
        if (q.includes(bigram)) score += 2;
        // 也检查查询词的 bigram 是否出现在事实中
      }
      for (let i = 0; i < qChars.length - 1; i++) {
        const bigram = qChars.slice(i, i + 2).join('');
        if (content.includes(bigram)) score += 1;
      }

      // 按重要性加权
      score *= (0.5 + f.importance * 0.5);

      // 按最近访问时间加权
      const daysSinceAccess = (Date.now() - f.lastAccessedAt) / 86400000;
      score *= Math.max(0.3, 1 - daysSinceAccess * 0.01);

      return { fact: f, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.fact);
  },

  /**
   * 更新访问记录
   */
  async touch(id) {
    const fact = await DB.get('facts', id);
    if (fact) {
      fact.lastAccessedAt = Date.now();
      fact.accessCount = (fact.accessCount || 0) + 1;
      await DB.put('facts', fact);
    }
  },

  /**
   * 删除事实
   */
  async remove(id) {
    await DB.delete('facts', id);
  },

  /**
   * 批量更新事实
   */
  async update(id, changes) {
    const fact = await DB.get('facts', id);
    if (fact) {
      Object.assign(fact, changes);
      await DB.put('facts', fact);
    }
    return fact;
  },

  /**
   * 获取统计信息
   */
  async stats() {
    const facts = await DB.getAll('facts');
    const byCategory = {};
    for (const f of facts) {
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    }
    return {
      total: facts.length,
      byCategory,
      lastExtract: facts.length > 0
        ? Math.max(...facts.map(f => f.createdAt))
        : null,
    };
  },

  /**
   * 自动提取事实：用 AI 从对话中提取用户信息
   * 这是长期记忆的核心功能
   */
  async autoExtract(apiClient, messages, convId) {
    if (messages.length < 4) return []; // 对话太短，不提取

    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length < 2) return [];

    const prompt = `从以下对话中提取关于用户的**新的事实信息**。只提取之前不知道的新信息。

规则：
1. 每条事实简短明确，一句话说完
2. 分类：personal(个人信息)、preference(偏好)、relationship(关系)、event(事件)、plan(计划)、knowledge(知识)
3. 如果对话中没有值得记录的新事实，返回空数组 []
4. 不要重复提取已经明显知道的信息

对话内容：
${messages.slice(-20).map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n')}

请用 JSON 数组格式返回，每个元素包含 fact 和 category 字段：
[{"fact": "...", "category": "personal"}, ...]

如果没有新事实，返回：[]`;

    try {
      const response = await apiClient.sendMessage(
        [{ role: 'user', content: prompt }],
        { maxTokens: 800, temperature: 0.2, stream: false }
      );

      const text = response.content?.[0]?.text || '[]';
      // 提取 JSON 数组
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const extracted = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(extracted)) return [];

      // 存储提取的事实
      const saved = [];
      for (const item of extracted) {
        if (!item.fact || item.fact.length < 3) continue;

        // 去重：检查是否已有相似事实
        const existing = await this.search(item.fact, 3);
        const isDuplicate = existing.some(e =>
          e.fact === item.fact ||
          this._similarity(e.fact, item.fact) > 0.7
        );
        if (isDuplicate) continue;

        const category = this.CATEGORIES[item.category] ? item.category : 'other';
        const importance = this.CATEGORIES[category]?.importance || 0.3;
        const fact = await this.add(item.fact, category, importance, convId);
        saved.push(fact);
      }

      return saved;
    } catch (e) {
      console.warn('自动提取事实失败', e);
      return [];
    }
  },

  /**
   * 简单文本相似度（Jaccard）
   */
  _similarity(a, b) {
    const setA = new Set(a.replace(/\s/g, '').split(''));
    const setB = new Set(b.replace(/\s/g, '').split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  },

  /**
   * 生成记忆注入文本（拼入 system prompt）
   */
  async buildMemoryContext(maxFacts = 15) {
    const facts = await DB.getAll('facts', 'createdAt', 'prev');

    if (facts.length === 0) return '';

    // 按重要性 * 最近访问 排序
    const scored = facts.map(f => {
      const daysSinceCreation = (Date.now() - f.createdAt) / 86400000;
      const daysSinceAccess = (Date.now() - f.lastAccessedAt) / 86400000;
      const recency = Math.max(0.3, 1 - daysSinceAccess * 0.02);
      const freshness = Math.max(0.5, 1 - daysSinceCreation * 0.005);
      const score = f.importance * 0.5 + recency * 0.3 + freshness * 0.2;
      return { fact: f, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topFacts = scored.slice(0, maxFacts);

    if (topFacts.length === 0) return '';

    // 更新访问时间
    for (const { fact } of topFacts) {
      await this.touch(fact.id);
    }

    // 组装文本
    const lines = ['\n## 关于用户的重要信息（长期记忆）'];
    const byCategory = {};
    for (const { fact } of topFacts) {
      if (!byCategory[fact.category]) byCategory[fact.category] = [];
      byCategory[fact.category].push(fact.fact);
    }

    for (const [cat, facts] of Object.entries(byCategory)) {
      const catInfo = this.CATEGORIES[cat] || this.CATEGORIES.other;
      lines.push(`- ${catInfo.icon} ${catInfo.label}：${facts.join('；')}`);
    }

    return lines.join('\n');
  },

  /**
   * 手动添加记忆（用户明确说"记住xxx"时调用）
   */
  async explicitAdd(factText, convId = null) {
    // 自动检测类别
    const category = this._detectCategory(factText);
    const importance = 1.0; // 用户明确要求的记忆，设为最高重要性

    // 去重检查
    const existing = await this.search(factText, 3);
    const isDuplicate = existing.some(e =>
      e.fact === factText ||
      this._similarity(e.fact, factText) > 0.8
    );
    if (isDuplicate) {
      // 更新已有记忆的重要性
      const fact = existing[0];
      await this.update(fact.id, { importance: Math.min(1, fact.importance + 0.2) });
      return { fact, updated: true };
    }

    return { fact: await this.add(factText, category, importance, convId), updated: false };
  },

  /**
   * 自动检测事实类别
   */
  _detectCategory(text) {
    if (/我是|我叫|我的名字|我住在|我在|我的.*是|年龄|生日/.test(text)) return 'personal';
    if (/喜欢|讨厌|偏好|习惯|经常|最爱|不喜欢/.test(text)) return 'preference';
    if (/女朋友|男朋友|老婆|老公|对象|朋友|同事|家人|妈妈|爸爸/.test(text)) return 'relationship';
    if (/计划|打算|目标|想[要做]|明天|下周|明年/.test(text)) return 'plan';
    if (/发生|经历|去过|参加过|那天|当时/.test(text)) return 'event';
    if (/知道|了解|学会|发现|认识|明白/.test(text)) return 'knowledge';
    return 'other';
  },

  /**
   * 获取记忆的源对话（跳转用）
   */
  async getSourceConversation(factId) {
    const fact = await DB.get('facts', factId);
    if (!fact || !fact.sourceConvId) return null;
    const { default: Conversations } = await import('./conversations.js');
    return await Conversations.get(fact.sourceConvId);
  },

  /**
   * 记忆衰减（清理长期未访问的低重要性事实）
   */
  async decayMaintenance(decayDays = 30) {
    const facts = await DB.getAll('facts');
    const now = Date.now();
    let removed = 0;

    for (const fact of facts) {
      const daysSinceAccess = (now - fact.lastAccessedAt) / 86400000;
      // 低重要性 + 长期未访问 → 删除
      if (fact.importance < 0.3 && daysSinceAccess > decayDays) {
        await DB.delete('facts', fact.id);
        removed++;
      }
      // 中等重要性 + 极长期未访问 → 降权
      else if (fact.importance < 0.5 && daysSinceAccess > decayDays * 2) {
        fact.importance = Math.max(0.1, fact.importance - 0.1);
        await DB.put('facts', fact);
      }
    }

    return removed;
  },
};

export default Facts;
