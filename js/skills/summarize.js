// ============================================
// summarize.js — 摘要总结技能
// ============================================

import Registry from './registry.js';

const SummarizeSkill = {
  id: 'summarize',
  name: '摘要总结',
  icon: '📝',
  description: '快速总结一段对话或文字的要点',
  category: 'utility',
  triggers: ['总结', '摘要', '概括', '归纳', '梳理'],
  systemPrompt: null,

  async preprocess(input) {
    const patterns = [
      /总结[一下]*[：:]\s*(.+)/,
      /帮我总结(.+)/,
      /概括[一下]*[：:]\s*(.+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return `请用简洁的要点形式（3-5条）总结以下内容：\n"${match[1]}"\n每条一行，用•开头。`;
      }
    }

    // 通用总结请求
    if (input.startsWith('总结') || input.startsWith('帮我总结')) {
      return '请用3-5个要点总结我们最近的对话内容，每条简洁明了。';
    }

    return input;
  },
};

Registry.register(SummarizeSkill);
export default SummarizeSkill;
