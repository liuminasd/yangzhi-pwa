// ============================================
// analyze.js — 对话分析技能
// ============================================

import Registry from './registry.js';

const AnalyzeSkill = {
  id: 'analyze',
  name: '对话分析',
  icon: '📊',
  description: '分析你的对话模式，提供沟通改善建议',
  category: 'utility',
  triggers: ['分析', '沟通建议', '对话分析'],
  systemPrompt: null,

  async preprocess(input) {
    if (input.includes('对话分析') || input.includes('分析对话')) {
      return '请根据我们最近的对话，分析我的沟通风格和模式，并给出2-3条改善建议。尽量具体和实用。';
    }
    if (input.includes('沟通建议')) {
      return '请根据我的表达方式，给出具体的沟通技巧建议，帮助我更好地与人交流。';
    }
    return input;
  },
};

Registry.register(AnalyzeSkill);
export default AnalyzeSkill;
