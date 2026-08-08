// ============================================
// recall.js — 记忆召回 + 手动记忆技能
// ============================================

import Registry from './registry.js';
import Facts from '../memory/facts.js';

const RecallSkill = {
  id: 'recall',
  name: '记忆召回',
  icon: '🧠',
  description: '搜索回顾记忆 & 明确指示 AI 记住重要信息',
  category: 'utility',
  triggers: [
    '还记得', '你记得', '告诉我关于', '你知道我', '回忆',
    '记住', '别忘了', '记下', '帮我记住',
  ],
  systemPrompt: null,

  async preprocess(input) {
    // === 1. 处理"记住xxx"命令 ===
    const rememberPatterns = [
      /记住[：:\s]+(.+)/,
      /帮我记住[：:\s]+(.+)/,
      /记下[：:\s]+(.+)/,
      /别忘了[：:\s]+(.+)/,
    ];

    for (const pattern of rememberPatterns) {
      const match = input.match(pattern);
      if (match) {
        const factText = match[1].trim();
        if (factText.length < 3) break;

        // 强制存储记忆
        const result = await Facts.explicitAdd(factText);
        const status = result.updated ? '已更新已有记忆' : '已记住';

        return `用户让我记住："${factText}"\n\n我已经${status}了这条信息。请自然确认：${result.updated ? '已更新这条记忆，我会记得更牢了' : '好的，我已经记下了！'}并简单回应。`;
      }
    }

    // === 2. 处理记忆召回请求 ===
    const recallPatterns = [
      /你还记得(.+)吗/,
      /你记得(.+)吗/,
      /告诉我关于(.+)的/,
      /你知道我(.+)吗/,
      /回忆.*(.+)/,
    ];

    for (const pattern of recallPatterns) {
      const match = input.match(pattern);
      if (match) {
        const query = match[1].trim();
        const results = await Facts.search(query, 5);

        if (results.length === 0) {
          return `用户问："${input}"\n\n请回复：抱歉，我好像没有关于"${query}"的记忆。你可以告诉我，我会记住的！`;
        }

        const factsText = results
          .map(f => `- [${Facts.CATEGORIES[f.category]?.label || '其他'}] ${f.fact}`)
          .join('\n');

        return `用户问："${input}"\n\n以下是我记住的相关信息：\n${factsText}\n\n请基于这些信息自然回答用户，像朋友回忆往事一样，不要像念数据库记录。`;
      }
    }

    return input;
  },
};

Registry.register(RecallSkill);
export default RecallSkill;
