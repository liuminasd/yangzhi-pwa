// ============================================
// brainstorm.js — 头脑风暴技能
// ============================================

import Registry from './registry.js';

const BrainstormSkill = {
  id: 'brainstorm',
  name: '头脑风暴',
  icon: '💡',
  description: '创意发散思维，帮你产生新想法和解决方案',
  category: 'utility',
  triggers: ['头脑风暴', '帮我想想', '有什么想法', '点子', '创意', '建议方案', '怎么办'],

  systemPrompt: `【头脑风暴模式】
当用户需要创意或解决方案时：
1. 先理解问题的核心
2. 提供5-8个不同的思路，从多角度出发（实用、创新、颠覆性、低成本等）
3. 每个点子简洁说明，一两句话即可
4. 标注每个思路的特点（如：稳妥、创新、激进、省钱等）
5. 最后可以建议下一步可以从哪个方向深入`,

  async preprocess(input) {
    // 检测头脑风暴请求
    if (/帮我想想|有什么.*(办法|想法|思路|点子)|头脑风暴/.test(input)) {
      return input;
    }
    return input;
  },
};

Registry.register(BrainstormSkill);
export default BrainstormSkill;
