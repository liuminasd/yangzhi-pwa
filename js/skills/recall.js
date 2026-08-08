// ============================================
// recall.js — 记忆召回技能
// 搜索并展示 AI 记住的关于用户的信息
// ============================================

import Registry from './registry.js';
import Facts from '../memory/facts.js';

const RecallSkill = {
  id: 'recall',
  name: '记忆召回',
  icon: '🧠',
  description: '搜索和回顾 AI 记住的关于你的信息',
  category: 'utility',
  triggers: ['还记得', '你记得', '告诉我关于', '你知道我', '回忆'],
  systemPrompt: null,

  async preprocess(input) {
    // 检查是否是记忆召回请求
    const patterns = [
      /你还记得(.+)吗/,
      /你记得(.+)吗/,
      /告诉我关于(.+)的/,
      /你知道我(.+)吗/,
      /回忆.*(.+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const query = match[1].trim();
        // 搜索本地事实
        const results = await Facts.search(query, 5);

        if (results.length === 0) {
          return `用户问："${input}"\n\n请回复：抱歉，我没有找到关于"${query}"的相关记忆。你可以告诉我更多，我会记住的。`;
        }

        const factsText = results
          .map(f => `- [${Facts.CATEGORIES[f.category]?.label || '其他'}] ${f.fact}`)
          .join('\n');

        return `用户问："${input}"\n\n以下是我记住的关于用户的相关信息：\n${factsText}\n\n请基于这些信息自然回答用户，像朋友回忆起往事一样，不要像念数据库记录。`;
      }
    }

    return input;
  },
};

Registry.register(RecallSkill);
export default RecallSkill;
