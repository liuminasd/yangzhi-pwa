// ============================================
// tone.js — 语气调整技能
// ============================================

import Registry from './registry.js';

const ToneSkill = {
  id: 'tone',
  name: '语气调整',
  icon: '🎭',
  description: '调整消息语气：更友好、更专业、更幽默或更坚定',
  category: 'communication',
  triggers: ['语气', '友好', '专业', '幽默', '坚定', '委婉', '正式'],
  systemPrompt: null,

  async preprocess(input) {
    const toneMap = {
      '友好': '友好温暖，像朋友聊天一样亲切',
      '专业': '专业正式，适合商务和工作场合',
      '幽默': '轻松幽默，带点俏皮和风趣',
      '坚定': '坚定自信，明确有力但不失礼貌',
      '委婉': '委婉柔和，避免直接冲突，给人台阶',
      '正式': '正式严谨，用词考究，逻辑清晰',
    };

    for (const [tone, desc] of Object.entries(toneMap)) {
      const pattern = new RegExp(`${tone}[语气]*[：:]\\s*(.+)`);
      const match = input.match(pattern);
      if (match) {
        return `请用以下语气改写这段话，保持原意不变：

语气要求：${desc}

原文："${match[1]}"

请直接给出改写后的版本。`;
      }
    }

    return input;
  },
};

Registry.register(ToneSkill);
export default ToneSkill;
