// ============================================
// empathy.js — 共情倾听技能
// 让 AI 以更具共情力的方式回应
// ============================================

import Registry from './registry.js';

const EmpathySkill = {
  id: 'empathy',
  name: '共情倾听',
  icon: '💛',
  description: 'AI 以共情理解的方式回应，更适合倾诉和情感交流',
  category: 'companion',
  triggers: ['倾听', '共情', '安慰', '难过', '不开心', '心烦', '郁闷', '焦虑', '压力'],

  systemPrompt: `【共情倾听模式】
当用户表达情绪或倾诉时，请遵循以下沟通原则：
1. 先接纳情绪，不要急于给出建议或解决方案
2. 用"听起来你..."、"我能感受到..."等方式反映对方的感受
3. 保持温暖支持的语气，适度使用"嗯"、"我明白"等回应
4. 在对方情绪被充分接纳后，再温和地询问是否需要建议
5. 保持真诚，不要过度使用套路化的安抚语言`,

  async preprocess(input) {
    // 共情模式通常是手动激活的常驻技能
    // 也可以通过触发词自动激活
    return input;
  },
};

Registry.register(EmpathySkill);
export default EmpathySkill;
