// ============================================
// rewrite.js — 改写润色技能
// ============================================

import Registry from './registry.js';

const RewriteSkill = {
  id: 'rewrite',
  name: '改写润色',
  icon: '✨',
  description: '优化表达方式，让文字更流畅自然、更优雅',
  category: 'communication',
  triggers: ['改写', '润色', '优化', '修饰', '换个说法', '表达'],
  systemPrompt: null, // 不作为常驻技能，而是在用户请求时触发

  /**
   * 预处理：检测改写请求
   */
  async preprocess(input) {
    // 检测改写指令
    const patterns = [
      /改写[：:]\s*(.+)/,
      /润色[：:]\s*(.+)/,
      /优化表达[：:]\s*(.+)/,
      /帮我改[一下]*[：:]*\s*(.+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return `请帮我改写以下文字，使其更加流畅自然、优雅得体。保持原意不变，只需要优化表达：

"${match[1]}"

请直接给出改写后的版本，不需要解释。`;
      }
    }
    return input;
  },
};

Registry.register(RewriteSkill);
export default RewriteSkill;
