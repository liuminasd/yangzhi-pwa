// ============================================
// chat-view.js — 聊天界面核心
// 对话列表、消息渲染、流式显示、输入处理
// ============================================

import Render from './render.js';
import Toast from './toast.js';
import Security from '../utils/security.js';
import Conversations from '../memory/conversations.js';
import Facts from '../memory/facts.js';
import Compressor from '../utils/compress.js';
import Registry from '../skills/registry.js';
import API from '../api.js';
import Config from '../config.js';

const ChatView = {
  currentConvId: null,
  isStreaming: false,
  streamBuffer: '',
  streamBubble: null,

  /**
   * 初始化聊天界面
   */
  async init() {
    this.bindEvents();
    await this.loadConversations();
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    // 发送按钮（流式输出时变为停止按钮）
    Render.$('#btn-send').addEventListener('click', () => {
      if (this.isStreaming) {
        this.stopGeneration();
      } else {
        this.sendMessage();
      }
    });
    // 输入框回车发送
    const input = Render.$('#user-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    // 自动调整输入框高度
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    // 返回按钮
    Render.$('#btn-back').addEventListener('click', () => this.showConvList());
    // 新建对话
    Render.$('#btn-new-chat').addEventListener('click', () => this.newChat());
    // 聊天菜单
    Render.$('#btn-chat-menu').addEventListener('click', (e) => this.toggleChatMenu(e));
    // 技能快捷入口
    Render.$('#btn-skill-quick').addEventListener('click', () => {
      document.querySelector('[data-tab="skills"]').click();
    });
    // 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
      const menu = document.querySelector('.chat-menu-dropdown');
      if (menu && !e.target.closest('#btn-chat-menu')) {
        menu.remove();
      }
    });

    // 移动端滑动手势
    this._bindSwipeGestures();
  },

  /**
   * 绑定移动端滑动手势
   */
  _bindSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;

    // 对话列表左滑删除
    Render.$('#conversations').addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    Render.$('#conversations').addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // 水平滑动超过 60px 且大于垂直滑动
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const target = e.target.closest('.conv-item');
        if (target && target.dataset.id) {
          if (dx < 0) {
            // 左滑删除
            this.deleteConversation(target.dataset.id);
          }
        }
      }
    });

    // 聊天窗口右滑返回（仅移动端）
    const chatWindow = Render.$('#chat-window');
    chatWindow.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    chatWindow.addEventListener('touchend', (e) => {
      if (window.innerWidth >= 768) return; // 桌面端不需要
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // 右滑返回（从左边边缘 30px 内开始）
      if (dx > 60 && touchStartX < 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        this.showConvList();
      }
    });
  },

  /**
   * 加载对话列表
   */
  async loadConversations() {
    const container = Render.$('#conversations');
    const convs = await Conversations.list();

    if (convs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👋</div>
          <p><strong>欢迎使用 AI 聊天伴侣</strong></p>
          <p style="margin-top:8px;">
            我是你的 AI 伙伴，我会：<br>
            🧠 记住你告诉我的事<br>
            💬 陪你聊天解闷<br>
            ✨ 帮你优化表达
          </p>
          <button class="btn-primary" style="margin-top:16px;" id="btn-welcome-start">
            开始聊天 →
          </button>
        </div>`;
      // 绑定欢迎按钮
      setTimeout(() => {
        const btn = document.getElementById('btn-welcome-start');
        if (btn) btn.addEventListener('click', () => this.newChat());
      }, 100);
      return;
    }

    container.innerHTML = '';
    for (const conv of convs) {
      const preview = await Conversations.getPreview(conv.id);
      const item = Render.el('div', 'conv-item', {
        'data-id': conv.id,
        onclick: () => this.openChat(conv.id),
      }, [
        Render.el('div', 'conv-avatar', {}, ['💬']),
        Render.el('div', 'conv-info', {}, [
          Render.el('div', 'conv-title truncate', { text: conv.title }),
          Render.el('div', 'conv-preview truncate', { text: preview }),
        ]),
        Render.el('div', 'conv-time', { text: Security.formatTime(conv.updatedAt) }),
        Render.el('button', 'conv-delete', {
          text: '✕',
          onclick: (e) => {
            e.stopPropagation();
            this.deleteConversation(conv.id);
          },
        }),
      ]);
      container.appendChild(item);
    }
  },

  /**
   * 新建对话
   */
  async newChat() {
    const conv = await Conversations.create();
    await this.loadConversations();
    this.openChat(conv.id);
  },

  /**
   * 打开对话
   */
  async openChat(convId) {
    this.currentConvId = convId;

    // 移动端：隐藏对话列表，显示聊天窗口
    if (window.innerWidth < 768) {
      Render.$('#conv-list').classList.add('hidden');
      Render.$('#chat-window').classList.remove('hidden');
    }

    // 高亮当前对话
    document.querySelectorAll('.conv-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === convId);
    });

    // 加载消息
    await this.loadMessages(convId);

    // 更新标题
    const conv = await Conversations.get(convId);
    if (conv) {
      Render.$('#chat-title').textContent = conv.title;
    }

    // 聚焦输入框
    Render.$('#user-input').focus();
  },

  /**
   * 加载消息列表
   */
  async loadMessages(convId) {
    const list = Render.$('#message-list');
    const messages = await Conversations.getMessages(convId, 200);

    Render.empty(list);

    if (messages.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👋</div>
          <p>开始聊天吧！<br>我会记住我们的对话 💭</p>
        </div>`;
      return;
    }

    for (const msg of messages) {
      this._appendMessageBubble(msg);
    }

    Render.scrollToBottom(list);
  },

  /**
   * 发送消息
   */
  async sendMessage() {
    if (this.isStreaming) return;

    const input = Render.$('#user-input');
    const content = input.value.trim();
    if (!content) return;

    if (!Config.isReady()) {
      Toast.error('请先在设置中配置 API Key');
      document.querySelector('[data-tab="settings"]').click();
      return;
    }

    // 确保有当前对话
    if (!this.currentConvId) {
      const conv = await Conversations.create();
      await this.loadConversations();
      this.currentConvId = conv.id;
      if (window.innerWidth < 768) {
        Render.$('#conv-list').classList.add('hidden');
        Render.$('#chat-window').classList.remove('hidden');
      }
      Render.$('#chat-title').textContent = conv.title;
    }

    input.value = '';
    input.style.height = 'auto';
    this._setSendButtonMode('stop');

    try {
      // 检测技能触发
      const triggeredSkills = Registry.detectTriggers(content);
      for (const skillId of triggeredSkills) {
        if (!Registry.isActive(skillId)) {
          Registry.activate(skillId);
          this._updateActiveSkillChips();
        }
      }

      // 预处理
      let processedContent = content;
      for (const skill of Registry.getActive()) {
        if (skill.preprocess) {
          processedContent = await skill.preprocess(processedContent);
        }
      }

      // 保存用户消息
      const userMsg = await Conversations.addMessage(this.currentConvId, 'user', content);
      this._appendMessageBubble(userMsg);

      // 清除空状态
      const emptyState = Render.$('#message-list .empty-state');
      if (emptyState) emptyState.remove();

      // 显示输入中动画
      Render.$('#typing-indicator').classList.remove('hidden');
      Render.scrollToBottom(Render.$('#message-list'));

      // 构建上下文
      const context = await this._buildContext(processedContent);

      // 发送到 API
      this.isStreaming = true;
      this.streamBuffer = '';

      const stream = API.sendMessage(context, {
        stream: true,
      });

      // 创建流式气泡
      this.streamBubble = this._createStreamingBubble();

      for await (const event of stream) {
        if (event.type === 'delta') {
          this.streamBuffer += event.text;
          this._updateStreamingBubble(this.streamBuffer);
          Render.scrollToBottom(Render.$('#message-list'));
        } else if (event.type === 'stop') {
          // 流结束
          break;
        } else if (event.type === 'error') {
          Toast.error(event.error);
          break;
        }
      }

      // 保存 AI 回复
      if (this.streamBuffer) {
        const tokens = this.streamBuffer.length; // 简单估算
        const aiMsg = await Conversations.addMessage(
          this.currentConvId, 'assistant', this.streamBuffer, { tokens }
        );
        // 用保存的消息替换流式气泡的 ID
        if (this.streamBubble) {
          this.streamBubble.dataset.msgId = aiMsg.id;
        }

        // 自动提取记忆
        await this._autoMemorize();
      }

    } catch (error) {
      console.error('发送消息失败', error);
      Toast.error(`发送失败：${error.message}`);
      // 移除空的流式气泡，显示重试按钮
      if (this.streamBubble && !this.streamBuffer) {
        this.streamBubble.remove();
      }
      // 在最后添加错误提示行（含重试按钮）
      this._appendErrorRow(error.message, content);
    } finally {
      this.isStreaming = false;
      this.streamBuffer = '';
      this.streamBubble = null;
      Render.$('#typing-indicator').classList.add('hidden');
      this._setSendButtonMode('send');
      Render.$('#user-input').focus();

      // 刷新对话列表
      await this.loadConversations();
    }
  },

  /**
   * 构建 API 调用上下文
   */
  async _buildContext(userMessage) {
    const messages = [];

    // 1. 基础系统提示词
    let systemPrompt = `你是一个温暖、有记忆的AI聊天伴侣。你叫"小忆"。
你的特点：
- 像朋友一样自然亲切地聊天
- 记住用户告诉你的关于他们的事情
- 回复简洁有温度，通常2-5句话
- 用中文回复，适当使用表情符号
- 当用户主动问起时，可以回顾之前记住的信息

当前时间：${new Date().toLocaleString('zh-CN')}`;

    // 2. 技能系统提示词
    const skillPrompt = Registry.buildSystemPrompt();
    if (skillPrompt) {
      systemPrompt += '\n\n' + skillPrompt;
    }

    messages.push({ role: 'system', content: systemPrompt });

    // 3. 记忆注入
    const memoryContext = await Facts.buildMemoryContext(Config.memory.maxInjectFacts);
    if (memoryContext) {
      messages.push({ role: 'system', content: memoryContext });
    }

    // 4. 对话历史
    const history = await Conversations.getMessages(this.currentConvId, 100);

    // 压缩处理
    if (Compressor.needsCompression(history, Config.chat.compressThreshold)) {
      const { messages: trimmed, summary } = Compressor.compress(
        history, Config.chat.maxHistoryRounds
      );
      if (summary) {
        messages.push({ role: 'system', content: `[历史对话摘要] ${summary}` });
      }
      for (const msg of trimmed) {
        messages.push({ role: msg.role, content: msg.content });
      }
    } else {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // 移除历史中最后一条用户消息（因为刚刚已保存到DB，避免重复）
    // 然后用预处理后的版本替换
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages.splice(i, 1);
        break;
      }
    }

    // 5. 添加当前用户消息
    messages.push({ role: 'user', content: userMessage });

    return messages;
  },

  /**
   * 自动提取记忆
   */
  async _autoMemorize() {
    if (!Config.memory.autoExtract) return;

    const messages = await Conversations.getMessages(this.currentConvId);
    const userMsgCount = messages.filter(m => m.role === 'user').length;

    // 每 N 轮对话提取一次
    if (userMsgCount > 0 && userMsgCount % Config.memory.extractThreshold === 0) {
      try {
        const newFacts = await Facts.autoExtract(API, messages, this.currentConvId);
        if (newFacts.length > 0) {
          console.log(`自动提取了 ${newFacts.length} 条新记忆`, newFacts);
        }
      } catch (e) {
        console.warn('自动记忆提取失败', e);
      }
    }
  },

  /**
   * 添加消息气泡到界面
   */
  _appendMessageBubble(msg) {
    const list = Render.$('#message-list');
    const row = Render.el('div', `msg-row ${msg.role}`, { 'data-msg-id': msg.id });

    const bubble = Render.el('div', 'msg-bubble');

    // 技能标记
    if (msg.skillOrigin) {
      const skill = Registry.get(msg.skillOrigin);
      if (skill) {
        bubble.appendChild(Render.el('span', 'msg-skill-badge', {
          text: `${skill.icon} ${skill.name}`,
        }));
      }
    }

    // 消息内容
    const contentDiv = Render.el('div', 'msg-content', {
      html: Render.simpleMarkdown(msg.content),
    });
    bubble.appendChild(contentDiv);

    // 底部操作栏
    const footer = Render.el('div', 'msg-footer');
    footer.appendChild(Render.el('span', 'msg-time', {
      text: Security.formatTime(msg.timestamp),
    }));
    footer.appendChild(Render.el('button', 'msg-copy-btn', {
      text: '📋',
      title: '复制',
      onclick: () => {
        navigator.clipboard.writeText(msg.content).then(() => {
          Toast.success('已复制');
        }).catch(() => {
          // 降级方案
          const ta = document.createElement('textarea');
          ta.value = msg.content;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          Toast.success('已复制');
        });
      },
    }));
    bubble.appendChild(footer);

    row.appendChild(bubble);
    list.appendChild(row);

    return row;
  },

  /**
   * 创建流式输出气泡
   */
  _createStreamingBubble() {
    const list = Render.$('#message-list');
    const row = Render.el('div', 'msg-row assistant', { 'data-msg-id': 'streaming' });
    const bubble = Render.el('div', 'msg-bubble');
    const contentDiv = Render.el('div', 'msg-content');
    bubble.appendChild(contentDiv);
    row.appendChild(bubble);
    list.appendChild(row);
    return row;
  },

  /**
   * 更新流式气泡内容
   */
  _updateStreamingBubble(text) {
    if (!this.streamBubble) return;
    const contentDiv = this.streamBubble.querySelector('.msg-content');
    if (contentDiv) {
      contentDiv.innerHTML = Render.simpleMarkdown(text);
    }
  },

  /**
   * 更新激活技能标签
   */
  _updateActiveSkillChips() {
    const container = Render.$('#active-skills');
    Render.empty(container);

    for (const skill of Registry.getActive()) {
      const chip = Render.el('span', 'skill-chip', {}, [
        `${skill.icon} ${skill.name}`,
        Render.el('span', 'chip-close', {
          text: '×',
          onclick: () => {
            Registry.deactivate(skill.id);
            this._updateActiveSkillChips();
          },
        }),
      ]);
      container.appendChild(chip);
    }
  },

  /**
   * 删除对话
   */
  async deleteConversation(convId) {
    if (!confirm('确定删除这个对话吗？')) return;
    await Conversations.remove(convId);
    if (this.currentConvId === convId) {
      this.currentConvId = null;
      this.showConvList();
    }
    await this.loadConversations();
    Toast.success('对话已删除');
  },

  /**
   * 显示对话列表（移动端）
   */
  showConvList() {
    Render.$('#conv-list').classList.remove('hidden');
    Render.$('#chat-window').classList.add('hidden');
    this.currentConvId = null;
  },

  /**
   * 切换聊天菜单
   */
  /**
   * 停止当前生成
   */
  stopGeneration() {
    if (this.isStreaming) {
      API.abort();
      this.isStreaming = false;
      // 保留已生成的内容
      if (this.streamBuffer && this.streamBubble) {
        const content = this.streamBuffer + '\n\n*[已停止生成]*';
        const contentDiv = this.streamBubble.querySelector('.msg-content');
        if (contentDiv) {
          contentDiv.innerHTML = Render.simpleMarkdown(content);
        }
        // 保存部分回复
        Conversations.addMessage(this.currentConvId, 'assistant', this.streamBuffer, {});
      }
      this.streamBuffer = '';
      this.streamBubble = null;
      Render.$('#typing-indicator').classList.add('hidden');
      this._setSendButtonMode('send');
      Render.$('#user-input').focus();
      Toast.info('已停止生成');
    }
  },

  /**
   * 切换发送按钮模式
   */
  _setSendButtonMode(mode) {
    const btn = Render.$('#btn-send');
    if (mode === 'stop') {
      btn.textContent = '■';
      btn.style.background = 'var(--danger)';
      btn.title = '停止生成';
    } else {
      btn.textContent = '➤';
      btn.style.background = 'var(--accent)';
      btn.title = '发送';
    }
  },

  /**
   * 显示错误行含重试按钮
   */
  _appendErrorRow(errorMsg, originalInput) {
    const list = Render.$('#message-list');
    const row = Render.el('div', 'msg-row assistant', {}, [
      Render.el('div', 'msg-bubble', { style: 'border-left: 3px solid var(--danger);' }, [
        Render.el('div', '', { text: `❌ ${errorMsg}` }),
        Render.el('button', 'btn-primary', {
          text: '🔄 重试',
          style: 'margin-top:8px; font-size:12px; padding:6px 14px;',
          onclick: () => {
            row.remove();
            Render.$('#user-input').value = originalInput;
            this.sendMessage();
          },
        }),
      ]),
    ]);
    list.appendChild(row);
    Render.scrollToBottom(list);
  },

  toggleChatMenu(e) {
    // 移除已有菜单
    const existing = document.querySelector('.chat-menu-dropdown');
    if (existing) {
      existing.remove();
      return;
    }

    const menu = Render.el('div', 'chat-menu-dropdown', {}, [
      Render.el('button', '', {
        text: '📝 重命名对话',
        onclick: async () => {
          const title = prompt('请输入新名称：');
          if (title && this.currentConvId) {
            await Conversations.update(this.currentConvId, { title });
            Render.$('#chat-title').textContent = title;
            await this.loadConversations();
          }
          menu.remove();
        },
      }),
      Render.el('button', '', {
        text: '📊 分析对话',
        onclick: () => {
          Registry.activate('analyze');
          this._updateActiveSkillChips();
          Toast.info('对话分析技能已激活，发送消息获取分析');
          menu.remove();
        },
      }),
      Render.el('button', '', {
        text: '🧹 清空对话',
        onclick: async () => {
          if (confirm('确定清空当前对话的所有消息吗？')) {
            const messages = await Conversations.getMessages(this.currentConvId);
            const { default: DB } = await import('../memory/store.js');
            for (const msg of messages) {
              await DB.delete('messages', msg.id);
            }
            await Conversations.update(this.currentConvId, { messageCount: 0 });
            await this.loadMessages(this.currentConvId);
            Toast.success('对话已清空');
          }
          menu.remove();
        },
      }),
      Render.el('button', 'danger', {
        text: '🗑 删除对话',
        onclick: () => {
          if (this.currentConvId) {
            this.deleteConversation(this.currentConvId);
          }
          menu.remove();
        },
      }),
    ]);

    document.body.appendChild(menu);
  },
};

export default ChatView;
