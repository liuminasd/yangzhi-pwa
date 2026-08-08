// ============================================
// 技能模板 — 用于创建自定义技能
// 复制此文件，修改后放在 js/skills/ 目录下
// ============================================

import Registry from '../registry.js';

const MySkill = {
  // 唯一标识
  id: 'my-skill',

  // 显示名称
  name: '我的技能',

  // 图标（emoji）
  icon: '🔧',

  // 简短描述
  description: '这是一个自定义技能模板',

  // 类别：communication | companion | utility
  category: 'utility',

  // 触发词（可选，用户消息包含这些词时自动激活）
  triggers: [],

  // 常驻系统提示词（激活后自动注入到对话上下文）
  systemPrompt: null,
  // 例如：
  // systemPrompt: `【我的技能模式】\n你现在的角色是...`,

  /**
   * 预处理用户输入（可选）
   * 在消息发送给 AI 之前调用
   * @param {string} input - 用户原始输入
   * @returns {string} 处理后的输入
   */
  async preprocess(input) {
    // 修改或增强用户输入
    return input;
  },
};

// 注册到技能中心
Registry.register(MySkill);
export default MySkill;
