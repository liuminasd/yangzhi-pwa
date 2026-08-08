// ============================================
// compress.js — 对话压缩工具
// 当对话过长时，将早期消息压缩为摘要
// ============================================

import TokenEstimator from './token.js';

const Compressor = {
  /**
   * 检查是否需要压缩
   */
  needsCompression(messages, threshold = 30) {
    return messages.length > threshold;
  },

  /**
   * 压缩对话：保留最近 N 轮，其余转为摘要
   * 返回压缩后的消息数组 + 摘要文本
   */
  compress(messages, keepRounds = 10) {
    if (messages.length <= keepRounds * 2) {
      // 轮数 = 消息数 / 2（一问一答为一轮）
      return { messages, summary: null };
    }

    const keepCount = keepRounds * 2; // 保留最近 N 轮（N问N答）
    const toSummarize = messages.slice(0, messages.length - keepCount);
    const recent = messages.slice(messages.length - keepCount);

    // 生成摘要（压缩后的简化版本，由客户端快速生成）
    const summary = this._quickSummarize(toSummarize);

    return { messages: recent, summary };
  },

  /**
   * 快速生成摘要（客户端本地处理，不调用 API）
   * 提取关键信息：话题转换、重要陈述、用户信息
   */
  _quickSummarize(messages) {
    const points = [];
    const userMessages = messages.filter(m => m.role === 'user');

    // 提取用户消息的关键词
    const keywords = new Set();
    const patterns = [
      /我是|我叫|我的|我喜欢|我住|我在|我.*是/g,
      /名字|生日|年龄|工作|职业|学校/g,
      /喜欢|讨厌|爱好|兴趣/g,
      /记得|记住|别忘了/g,
    ];

    for (const msg of userMessages) {
      for (const pattern of patterns) {
        const matches = msg.content.match(pattern);
        if (matches) matches.forEach(m => keywords.add(m));
      }
    }

    if (keywords.size > 0) {
      points.push(`用户提及了：${[...keywords].slice(0, 10).join('、')}`);
    }

    // 添加基本信息
    points.push(`共 ${messages.length} 条消息`);
    points.push(`时间范围：${new Date(messages[0]?.timestamp || Date.now()).toLocaleString('zh-CN')}`);

    return points.join('；');
  },

  /**
   * 调用 AI 生成高质量摘要（异步，在后台执行）
   */
  async aiSummarize(messages, apiClient) {
    const prompt = `请用2-3句话总结以下对话的关键内容。重点关注：
1. 用户分享的个人信息
2. 用户表达的需求和偏好
3. 对话的主要话题

对话：
${messages.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n')}

请用中文简要总结：`;

    try {
      const response = await apiClient.sendMessage([
        { role: 'user', content: prompt }
      ], { maxTokens: 200, temperature: 0.3, stream: false });
      return response.content?.[0]?.text || '';
    } catch (e) {
      console.warn('AI摘要生成失败，使用本地摘要', e);
      return this._quickSummarize(messages);
    }
  },
};

export default Compressor;
