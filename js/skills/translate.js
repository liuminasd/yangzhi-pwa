// ============================================
// translate.js — 翻译技能
// ============================================

import Registry from './registry.js';

const TranslateSkill = {
  id: 'translate',
  name: '翻译',
  icon: '🌐',
  description: '中英互译，保持语境和语气的一致性',
  category: 'communication',
  triggers: ['翻译', 'translate', '英文', '中文', '用英语说', '用中文说'],
  systemPrompt: null,

  async preprocess(input) {
    // 每个模式分别指定 target 和 text 在捕获组中的位置
    // Pattern 2（中译英）的 target 在 group 2，text 在 group 3，与另外两个不同
    const patterns = [
      { regex: /翻译[成]*(中|英)文[：:]\s*(.+)/,   targetGroup: 1, textGroup: 2 },
      { regex: /(中|英)译(中|英)[：:]\s*(.+)/,       targetGroup: 2, textGroup: 3 },
      { regex: /用(中|英)文说[：:]\s*(.+)/,           targetGroup: 1, textGroup: 2 },
    ];

    for (const { regex, targetGroup, textGroup } of patterns) {
      const match = input.match(regex);
      if (match) {
        const target = match[targetGroup] === '英' ? '英文' : '中文';
        const text = match[textGroup];
        return `请将以下文本翻译成${target}，保持原意和语气：

"${text}"

请直接给出翻译结果，不需要解释。`;
      }
    }

    // 更宽松的匹配：整句翻译
    if (input.startsWith('翻译')) {
      const text = input.replace(/^翻译[：:\s]*/, '');
      if (text.length > 3) {
        const hasChinese = /[一-鿿]/.test(text);
        const target = hasChinese ? '英文' : '中文';
        return `请将以下文本翻译成${target}：\n"${text}"\n请直接给出翻译结果。`;
      }
    }

    return input;
  },
};

Registry.register(TranslateSkill);
export default TranslateSkill;
