// ============================================
// speaker-detect.js — 聊天发言方识别
// 三层策略：模式匹配 + AI辅助 + 用户确认
// ============================================

const SpeakerDetect = {
  _dialogOpen: false,  // 防止并发弹窗

  /**
   * 5 种常见聊天记录格式（按优先级排序）
   */
  PATTERNS: [
    // 1. 时间戳+冒号：2024-01-15 14:30 小明: 消息内容 或 14:30 小明: 消息
    {
      name: 'timestamp-colon',
      regex: /(?:(\d{2,4}[-/]\d{2}[-/]\d{2}\s+)?(\d{2}:\d{2}(?::\d{2})?)\s+)?([^\s:：]{1,10})[：:]\s*(.+)/gm,
      confidence: 0.90,
      extractMatch(m) { return { speaker: (m[3] || '').trim(), content: (m[4] || '').trim() }; },
    },
    // 2. 方括号：[小明] 消息内容
    {
      name: 'bracket',
      regex: /^\[([^\]]{1,10})\]\s*(.+)/gm,
      confidence: 0.90,
      extractMatch(m) { return { speaker: m[1].trim(), content: m[2].trim() }; },
    },
    // 3. 冒号分隔（中英文）：小明：消息内容 或 Alice: message
    {
      name: 'colon',
      regex: /^([^\s:：]{1,15})[：:]\s*(.+)/gm,
      confidence: 0.80,
      extractMatch(m) { return { speaker: m[1].trim(), content: m[2].trim() }; },
    },
    // 4. 微信单行换行：名字独占一行，下一行是消息
    {
      name: 'wechat-newline',
      regex: /^([^\s:：]{1,10})\n(.+)/gm,
      confidence: 0.70,
      extractMatch(m) { return { speaker: m[1].trim(), content: m[2].trim() }; },
    },
    // 5. 微信时间戳格式：2024年1月15日 14:30 小明\n消息
    {
      name: 'wechat-date',
      regex: /\d{4}年\d{1,2}月\d{1,2}日\s+\d{2}:\d{2}\s+([^\n]{1,10})\n(.+?)(?=\d{4}年|$)/gs,
      confidence: 0.85,
      extractMatch(m) { return { speaker: m[1].trim(), content: m[2].trim().replace(/\n$/, '') }; },
    },
  ],

  /**
   * 快速判断文本是否像聊天记录
   */
  looksLikeChat(text) {
    if (!text || text.length < 10) return false;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return false;
    // 检查是否有典型聊天特征
    const hasColonPattern = /[：:]\s*.+/.test(text);
    const hasBracketPattern = /\[[^\]]{1,10}\]\s*.+/.test(text);
    const hasTimePattern = /\d{2}:\d{2}/.test(text);
    return (hasColonPattern || hasBracketPattern) || (hasTimePattern && lines.length >= 2);
  },

  /**
   * 主入口：解析文本为带发言人的消息列表
   * @param {string} text - 粘贴的原始文本
   * @returns {Array<{speaker, content, confidence}>}
   */
  detect(text) {
    const segments = this._heuristicParse(text);
    return segments;
  },

  /**
   * 第一层：启发式模式匹配
   */
  _heuristicParse(text) {
    let bestResult = { segments: [], confidence: 0, method: 'none' };

    for (const pattern of this.PATTERNS) {
      const matches = [...text.matchAll(pattern.regex)];
      if (matches.length >= 2) {
        const segments = matches.map(m => ({
          ...pattern.extractMatch(m),
          confidence: pattern.confidence,
        })).filter(s => s.speaker && s.content);

        if (segments.length > bestResult.segments.length) {
          bestResult = { segments, confidence: pattern.confidence, method: pattern.name };
        }
      }
    }

    // 如果所有模式都失败，尝试交替行解析
    if (bestResult.segments.length === 0) {
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        // 假设两人交替发言
        const speakers = new Set();
        const segments = [];
        lines.forEach((line, i) => {
          const speaker = `发言方${(i % 2) + 1}`;
          speakers.add(speaker);
          segments.push({ speaker, content: line.trim(), confidence: 0.40 });
        });
        if (speakers.size === 2) {
          bestResult = { segments, confidence: 0.40, method: 'alternating' };
        }
      }
    }

    return bestResult;
  },

  /**
   * 第二层：AI 辅助识别（中低置信度时调用）
   */
  async aiAssist(apiClient, text) {
    const prompt = `分析以下聊天记录，识别每句话的发言人。

要求：
1. 返回 JSON 数组：[{"speaker": "姓名", "content": "发言内容"}, ...]
2. 按原文顺序排列
3. 如果能从上下文推断发言人姓名，请使用推断的姓名（如小明、小红）
4. 如果无法确定，用"发言方1"、"发言方2"标记
5. 只返回JSON数组，不要其他内容

聊天记录：
${text}`;

    try {
      const response = await apiClient.sendMessage(
        [{ role: 'user', content: prompt }],
        { maxTokens: 2000, temperature: 0.1, stream: false }
      );
      const respText = response.content?.[0]?.text || '[]';
      const match = respText.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed.map(item => ({
        speaker: item.speaker || '未知',
        content: item.content || '',
        confidence: 0.75,
      })) : [];
    } catch {
      return [];
    }
  },

  /**
   * 第三层：用户确认弹窗
   * @param {Array} segments - 解析结果
   * @returns {Promise<Array>} 用户确认后的结果
   */
  async confirmWithUser(segments) {
    return new Promise((resolve) => {
      this._showConfirmDialog(segments, (confirmed) => {
        resolve(confirmed);
      });
    });
  },

  /**
   * 显示确认对话框
   */
  _showConfirmDialog(segments, onConfirm) {
    // 防止并发弹窗
    if (this._dialogOpen) {
      onConfirm(null);
      return;
    }

    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');
    if (!overlay || !box) {
      onConfirm(segments);
      return;
    }

    this._dialogOpen = true;
    const speakers = [...new Set(segments.map(s => s.speaker))];
    let currentSegments = [...segments];

    // 命名事件处理器以便清理
    const handleClick = (e) => {
      const cancelBtn = e.target.closest('#btn-speaker-cancel');
      const confirmBtn = e.target.closest('#btn-speaker-confirm');

      if (cancelBtn) {
        cleanup();
        onConfirm(null);
      } else if (confirmBtn) {
        cleanup();
        onConfirm(currentSegments);
      }
    };

    const handleInput = (e) => {
      const input = e.target.closest('.speaker-name-input');
      if (input) {
        const idx = parseInt(input.dataset.index);
        if (!isNaN(idx) && currentSegments[idx]) {
          currentSegments[idx].speaker = input.value.trim();
        }
      }
    };

    const cleanup = () => {
      this._dialogOpen = false;
      box.removeEventListener('click', handleClick);
      box.removeEventListener('input', handleInput);
      overlay.classList.add('hidden');
      box.innerHTML = '';
    };

    box.innerHTML = `
      <h3>👥 识别到以下发言人</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
        已识别 ${speakers.length} 位发言方，共 ${segments.length} 句话。<br>
        点击发言人名称可修改，不确定的请手动确认。
      </p>
      <div class="speaker-confirm-list">
        ${currentSegments.map((s, i) => `
          <div class="speaker-confirm-item">
            <span class="speaker-badge ${s.confidence >= 0.7 ? 'confident' : 'uncertain'}">
              ${s.confidence >= 0.7 ? '🔵' : '⚠️'}
            </span>
            <input class="speaker-name-input"
                   value="${this._escAttr(s.speaker)}"
                   data-index="${i}"
                   style="width:${Math.max(60, s.speaker.length * 14)}px;">
            <span class="segment-content" style="flex:1;font-size:13px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${this._escHtml(s.content.slice(0, 80))}
            </span>
          </div>
        `).join('')}
      </div>
      <div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn-primary" id="btn-speaker-cancel"
                style="background:var(--bg-hover);color:var(--text-primary);">
          取消
        </button>
        <button class="btn-primary" id="btn-speaker-confirm">
          ✅ 确认并发送
        </button>
      </div>
    `;

    box.addEventListener('click', handleClick);
    box.addEventListener('input', handleInput);
    overlay.classList.remove('hidden');
  },

  /**
   * 将确认后的段格式化为发送文本
   */
  formatForSend(segments) {
    return segments.map(s => `[${s.speaker}] ${s.content}`).join('\n');
  },

  _escHtml(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  },

  _escAttr(s) {
    return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};

export default SpeakerDetect;
