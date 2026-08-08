// ============================================
// token.js — Token 估算工具
// 用于前端估算文本的 token 数量
// ============================================

const TokenEstimator = {
  /**
   * 估算文本的 token 数
   * 中文约 1.5 字符/token，英文约 4 字符/token
   */
  count(text) {
    if (!text) return 0;
    const chineseChars = (text.match(/[一-鿿㐀-䶿豈-﫿]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  },

  /**
   * 估算消息数组的总 token 数
   */
  countMessages(messages) {
    return messages.reduce((sum, m) => sum + this.count(m.content), 0);
  },

  /**
   * 格式化显示
   */
  format(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  },
};

export default TokenEstimator;
