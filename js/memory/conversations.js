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
    const messages = await DB.getByIndex('messages', 'conversationId', convId);
    messages.sort((a, b) => a.timestamp - b.timestamp);
    return limit ? messages.slice(-limit) : messages;
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
    };
    await DB.add('messages', msg);

    // 更新对话元数据
    const conv = await DB.get('conversations', convId);
    if (conv) {
      conv.updatedAt = Date.now();
      conv.messageCount = (conv.messageCount || 0) + 1;
      // 自动更新标题（取用户第一条消息的前30字）
      if (conv.title === '新对话' && role === 'user') {
        conv.title = content.replace(/\n/g, ' ').slice(0, 30);
      }
      await DB.put('conversations', conv);
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
    for (const msg of messages) {
      await DB.delete('messages', msg.id);
    }
    await DB.delete('conversations', id);
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
