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
import AIProfile from '../profile.js';
import ContextMenu from './context-menu.js';
import CopyManager from './copy.js';
import OCR from './ocr.js';
import SpeakerDetect from './speaker-detect.js';

const ChatView = {
  currentConvId: null,
  isStreaming: false,
  _savingInProgress: false,  // 流完成后保存期间的独立守卫，防止 stopGeneration 重复保存和 sendMessage 重入
  streamBuffer: '',
  streamBubble: null,

  /**
   * 初始化聊天界面
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    this.bindEvents();
    // 监听外部导入事件，自动刷新对话列表
    window.addEventListener('refresh-conversations', () => this.loadConversations());
    await this.loadConversations();

    // 初始化 OCR（传递回调）
    OCR.init({
      onProgress: (msg) => {
        const el = document.getElementById('ocr-progress-text');
        if (el) el.textContent = msg;
      },
      onComplete: (text, file, isLongScreenshot) => {
        const input = Render.$('#user-input');
        if (text) {
          input.value = (input.value ? input.value + '\n' : '') + text;
          // 长截图：自动触发发言方识别
          if (isLongScreenshot && SpeakerDetect.looksLikeChat(text)) {
            setTimeout(() => this._detectSpeakers(), 500);
          }
        }
        input.focus();
      },
      onError: (msg) => Toast.error(msg),
    });
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
    // 自动调整输入框高度 + 检测手动编辑以清除待定发言人 + 字数统计
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      // 用户手动编辑（非发言方识别程序化设置）时，清除待定发言人标记
      if (!this._programmaticInput && this._pendingSenderName) {
        this._pendingSenderName = null;
        document.getElementById('speaker-hint-chip')?.classList.add('hidden');
      }
      // 更新字数统计 + 按钮状态
      const countEl = document.getElementById('char-count');
      const sendBtn = Render.$('#btn-send');
      if (countEl) {
        const len = input.value.length;
        const MAX = 10000;
        countEl.textContent = len > 0 ? `${len} / ${MAX}` : '';
        countEl.style.color = len > MAX * 0.9 ? 'var(--warning)' : len > MAX ? 'var(--danger)' : '';
        // 有内容时按钮发光
        if (sendBtn) {
          sendBtn.classList.toggle('has-content', len > 0);
        }
      }
    });
    // 返回按钮
    Render.$('#btn-back').addEventListener('click', () => this.showConvList());
    // 新建对话
    Render.$('#btn-new-chat').addEventListener('click', () => this.newChat());
    // 聊天菜单
    Render.$('#btn-chat-menu').addEventListener('click', (e) => this.toggleChatMenu(e));
    // 技能快捷入口
    Render.$('#btn-skill-quick').addEventListener('click', () => {
      document.querySelector('[data-tab="skills"]')?.click();
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

    // 长按/右键上下文菜单
    ContextMenu.init(Render.$('#message-list'), (msgEl) => {
      const msgId = msgEl.dataset.msgId;
      if (!msgId || msgId === 'streaming') return [];
      return [
        { label: '复制', icon: '📋', action: () => {
          const msg = this._findMsgById(msgId);
          if (msg) CopyManager.copyMessage(msg.content);
        }},
        { label: '多选', icon: '✅', action: () => CopyManager.enterSelectMode() },
      ];
    });

    // 多选工具栏
    CopyManager.init((mode, count) => {
      if (mode === 'select') {
        document.getElementById('select-toolbar')?.classList.remove('hidden');
        document.getElementById('chat-header')?.classList.add('hidden');
        const countEl = document.getElementById('select-count');
        if (countEl) countEl.textContent = `已选择 ${count} 条`;
        document.querySelectorAll('.msg-row').forEach(row => {
          row.classList.add('select-mode');
          const cb = row.querySelector('.select-checkbox input');
          if (cb) cb.checked = CopyManager.selectedIds.has(row.dataset.msgId);
        });
      } else {
        document.getElementById('select-toolbar')?.classList.add('hidden');
        document.getElementById('chat-header')?.classList.remove('hidden');
        document.querySelectorAll('.msg-row').forEach(row => {
          row.classList.remove('select-mode', 'selected');
        });
      }
    });

    Render.$('#btn-select-cancel').addEventListener('click', () => CopyManager.exitSelectMode());
    Render.$('#btn-select-all').addEventListener('click', () => {
      const ids = [...document.querySelectorAll('.msg-row')]
        .map(r => r.dataset.msgId)
        .filter(id => id && id !== 'streaming');
      CopyManager.selectAll(ids);
    });
    Render.$('#btn-select-copy').addEventListener('click', async () => {
      const allMsgs = await Conversations.getMessages(this.currentConvId, 500);
      await CopyManager.copySelected(allMsgs);
    });

    // 发言人识别按钮
    Render.$('#btn-detect-speaker').addEventListener('click', () => {
      this._detectSpeakers();
    });

    // 关闭发言人提示
    Render.$('#btn-close-speaker-hint').addEventListener('click', () => {
      document.getElementById('speaker-hint-chip')?.classList.add('hidden');
    });

    // 发言人提示条中的"识别发言人"按钮
    Render.$('#btn-parse-speakers').addEventListener('click', () => {
      this._detectSpeakers();
    });

    // 粘贴文本时检测聊天记录格式
    input.addEventListener('paste', (e) => {
      // 延迟检测（等待粘贴内容填入）
      setTimeout(() => {
        const text = input.value;
        if (text && SpeakerDetect.looksLikeChat(text)) {
          document.getElementById('speaker-hint-chip')?.classList.remove('hidden');
        }
      }, 100);
    });

    // 消息列表滚动检测：用户手动上滑时暂停自动滚动，滚回底部时恢复
    const msgList = Render.$('#message-list');
    msgList.addEventListener('scroll', () => {
      const distFromBottom = msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight;
      msgList._userScrolledUp = distFromBottom > 80;
    });

    // 移动端键盘处理：键盘弹起时滚动输入框到可见区域
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const viewport = window.visualViewport;
        const inputArea = document.getElementById('input-area');
        if (!inputArea || document.getElementById('chat-window').classList.contains('hidden')) return;
        // 键盘弹起时，确保输入区域在可视范围内
        const inputBottom = inputArea.getBoundingClientRect().bottom;
        if (inputBottom > viewport.height) {
          msgList.scrollTop += inputBottom - viewport.height + 8;
        }
      });
    }
  },

  /**
   * 绑定移动端滑动手势
   */
  _bindSwipeGestures() {
    // 对话列表左滑删除（独立坐标）
    let listStartX = 0, listStartY = 0;
    Render.$('#conversations').addEventListener('touchstart', (e) => {
      listStartX = e.touches[0].clientX;
      listStartY = e.touches[0].clientY;
    }, { passive: true });

    Render.$('#conversations').addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - listStartX;
      const dy = e.changedTouches[0].clientY - listStartY;

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const target = e.target.closest('.conv-item');
        if (target && target.dataset.id) {
          if (dx < 0) {
            this.deleteConversation(target.dataset.id);
          }
        }
      }
    });

    // 聊天窗口右滑返回（独立坐标，仅移动端）
    let chatStartX = 0, chatStartY = 0;
    const chatWindow = Render.$('#chat-window');
    chatWindow.addEventListener('touchstart', (e) => {
      chatStartX = e.touches[0].clientX;
      chatStartY = e.touches[0].clientY;
    }, { passive: true });

    chatWindow.addEventListener('touchend', (e) => {
      if (window.innerWidth >= 768) return;
      const dx = e.changedTouches[0].clientX - chatStartX;
      const dy = e.changedTouches[0].clientY - chatStartY;

      if (dx > 60 && chatStartX < 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
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
          <p><strong>欢迎使用仰止</strong></p>
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
      // 事件委托：通过容器监听欢迎按钮点击
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('#btn-welcome-start');
        if (btn) this.newChat();
      });
      return;
    }

    container.innerHTML = '';
    // 按日期分组
    const now = Date.now();
    const DAY = 86400000;
    const groups = [
      { label: '今天', min: now - DAY, max: now },
      { label: '昨天', min: now - 2 * DAY, max: now - DAY },
      { label: '本周', min: now - 7 * DAY, max: now - 2 * DAY },
      { label: '更早', min: 0, max: now - 7 * DAY },
    ];
    const grouped = {};
    for (const conv of convs) {
      const g = groups.find(g => conv.updatedAt >= g.min && conv.updatedAt < g.max) || groups[3];
      if (!grouped[g.label]) grouped[g.label] = [];
      grouped[g.label].push(conv);
    }

    for (const { label } of groups) {
      const groupConvs = grouped[label];
      if (!groupConvs || groupConvs.length === 0) continue;

      // 日期分组标题
      const header = Render.el('div', 'conv-date-header', { text: label });
      container.appendChild(header);

      for (const conv of groupConvs) {
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
    }
  },

  /**
   * 新建对话（防止快速双击创建多个空对话）
   */
  async newChat() {
    if (this._creatingConv) return;
    this._creatingConv = true;
    try {
      const conv = await Conversations.create();
      await this.loadConversations();
      this.openChat(conv.id);
    } finally {
      this._creatingConv = false;
    }
  },

  /**
   * 打开对话
   */
  async openChat(convId) {
    // 如果正在流式输出且用户切换到不同对话，先停止当前流
    if (this.isStreaming && this._streamingConvId && this._streamingConvId !== convId) {
      this.stopGeneration();
      // 等待保存完成（最多1.5秒）
      await new Promise(r => setTimeout(r, 100));
      let waited = 0;
      while (this._savingInProgress && waited < 1500) {
        await new Promise(r => setTimeout(r, 50));
        waited += 50;
      }
    }

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
    if (this.isStreaming || this._savingInProgress) return;

    // 网络预检
    if (!navigator.onLine) {
      Toast.error('网络已断开，请检查连接');
      return;
    }

    const input = Render.$('#user-input');
    const content = input.value.trim();
    const hasAttachment = !!OCR.getPendingFile();

    // 至少需要文字或图片之一
    if (!content && !hasAttachment) return;

    // 输入长度限制
    const MAX_INPUT = 10000;
    if (content.length > MAX_INPUT) {
      Toast.error(`消息过长（${content.length}字），请限制在${MAX_INPUT}字以内`);
      return;
    }

    if (!Config.isReady()) {
      Toast.error('请先在设置中配置 API Key');
      document.querySelector('[data-tab="settings"]')?.click();
      return;
    }

    // ★ 提前设置流式标志，防止快速双击发送两条消息
    this.isStreaming = true;

    // ★ 提前捕获当前对话ID，确保 try/catch 都能访问，停止时也能正确保存
    let activeConvId = this.currentConvId;
    this._streamingConvId = activeConvId;

    input.value = '';
    input.style.height = 'auto';
    // 重置字数统计 + 按钮状态
    const countEl = document.getElementById('char-count');
    if (countEl) countEl.textContent = '';
    const sendBtn = Render.$('#btn-send');
    if (sendBtn) sendBtn.classList.remove('has-content');
    this._setSendButtonMode('stop');

    try {
      // 确保有当前对话（放 try 内防止 DB 错误导致 isStreaming 卡死）
      if (!activeConvId) {
        const conv = await Conversations.create();
        await this.loadConversations();
        this.currentConvId = conv.id;
        activeConvId = conv.id;
        this._streamingConvId = conv.id;
        if (window.innerWidth < 768) {
          Render.$('#conv-list').classList.add('hidden');
          Render.$('#chat-window').classList.remove('hidden');
        }
        Render.$('#chat-title').textContent = conv.title;
      }
      // 所有技能已由 Registry.activateAll() 自动激活，无需触发词检测
      // 预处理：统一通过 Registry.preprocess() 链式处理用户输入
      const processedContent = await Registry.preprocess(content);

      // 纯图片消息：添加占位文本，让 AI 理解上下文
      const contextContent = processedContent || (hasAttachment ? '[用户发送了一张图片]' : '');

      // 构建附件数据
      let attachments = null;
      const pendingFile = OCR.getPendingFile();
      if (pendingFile) {
        const dataUrl = await this._fileToDataUrl(pendingFile);
        attachments = [{
          id: Security.uuid(),
          type: pendingFile.type,
          name: pendingFile.name || 'screenshot.png',
          dataUrl: dataUrl,
          ocrText: '',
        }];
      }

      // 保存用户消息（含附件和发言人）
      const userMsg = await Conversations.addMessage(activeConvId, 'user', content, {
        attachments,
        senderName: this._pendingSenderName || null,
      });
      this._pendingSenderName = null;
      this._appendMessageBubble(userMsg);

      // 清除 OCR 预览
      OCR.clearPreview();

      // 清除空状态
      const emptyState = Render.$('#message-list .empty-state');
      if (emptyState) emptyState.remove();

      // 显示输入中动画（发送消息后强制滚动到底部）
      Render.$('#typing-indicator').classList.remove('hidden');
      Render.scrollToBottom(Render.$('#message-list'), true);

      // 构建上下文（传入已捕获的对话ID）
      const context = await this._buildContext(contextContent, activeConvId);

      // 发送到 API
      this.streamBuffer = '';

      const stream = await API.sendMessage(context, {
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

      // ★ 标记保存进行中：防止 stopGeneration 重复保存，也防止 sendMessage 重入
      this._savingInProgress = true;

      // 保存 AI 回复
      if (this.streamBuffer) {
        const tokens = this.streamBuffer.length; // 简单估算
        const aiMsg = await Conversations.addMessage(
          activeConvId, 'assistant', this.streamBuffer, { tokens }
        );
        // 用保存的消息替换流式气泡的 ID
        if (this.streamBubble) {
          this.streamBubble.dataset.msgId = aiMsg.id;
        }

        // 自动提取记忆（使用捕获的对话ID，防止导航后提取错误对话）
        await this._autoMemorize(activeConvId);
      }

    } catch (error) {
      // 用户主动停止 — stopGeneration() 已处理清理和提示
      const isAbort = error && (error.name === 'AbortError');
      if (isAbort) return;

      const errMsg = (error && error.message) || '未知错误';
      console.error('发送消息失败', errMsg);
      Toast.error(`发送失败：${errMsg}`);

      // 保存流式中断前的部分内容（防止数据丢失）
      if (this.streamBuffer && activeConvId && this.streamBubble) {
        try {
          await Conversations.addMessage(activeConvId, 'assistant',
            this.streamBuffer + '\n\n*[网络中断]*', {});
        } catch (saveErr) {
          console.warn('保存中断内容失败', saveErr);
        }
      }

      // 移除空的流式气泡，显示重试按钮
      if (this.streamBubble && !this.streamBuffer) {
        this.streamBubble.remove();
      }
      // 在最后添加错误提示行（含重试按钮）
      this._appendErrorRow(errMsg, content);
    } finally {
      this.isStreaming = false;
      this._savingInProgress = false;
      this.streamBuffer = '';
      this.streamBubble = null;
      this._streamingConvId = null;
      Render.$('#typing-indicator').classList.add('hidden');
      this._setSendButtonMode('send');
      Render.$('#user-input').focus();

      // 刷新对话列表（失败不阻塞，避免未处理异常）
      try { await this.loadConversations(); } catch {}
    }
  },

  /**
   * 构建 API 调用上下文
   */
  async _buildContext(userMessage, convId) {
    const messages = [];

    // 1. 人物档案系统提示词
    const profilePrompt = AIProfile.buildSystemPrompt();
    let systemPrompt = `${profilePrompt}

你的核心能力：
- 记住用户告诉你的关于他们的事情（长期记忆）
- 像朋友一样自然亲切地聊天
- 回复简洁有温度，通常2-5句话
- 用中文回复，适当使用表情符号
- 当用户主动问起时，可以回顾之前记住的信息
- 用户说"记住xxx"时，你会记住这条信息

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

    // 4. 对话历史（使用传入的 convId 而非 this.currentConvId，防止异步期间导航导致空值）
    const history = await Conversations.getMessages(convId || this.currentConvId, 100);

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
    // 只检查最后一条：正常对话中刚保存的用户消息一定在末尾，
    // 避免导入场景下连续 user 消息时误删更早的消息
    const lastIdx = messages.length - 1;
    if (lastIdx >= 0 && messages[lastIdx].role === 'user') {
      messages.splice(lastIdx, 1);
    }

    // 5. 添加当前用户消息
    messages.push({ role: 'user', content: userMessage });

    return messages;
  },

  /**
   * 自动提取记忆
   */
  async _autoMemorize(convId) {
    if (!Config.memory.autoExtract) return;
    if (!convId) return;

    const messages = await Conversations.getMessages(convId, 100);
    const userMsgCount = messages.filter(m => m.role === 'user').length;

    // 每 N 轮对话提取一次
    if (userMsgCount > 0 && userMsgCount % Config.memory.extractThreshold === 0) {
      try {
        const newFacts = await Facts.autoExtract(API, messages, convId);
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

    // 多选复选框（初始由 CSS display:none 隐藏，select-mode 时 display:flex）
    const checkboxDiv = Render.el('div', 'select-checkbox', {}, [
      Render.el('input', '', {
        type: 'checkbox',
        onclick: (e) => {
          e.preventDefault();  // 阻止原生 toggle，统一由 CopyManager 管理
          e.stopPropagation();
          CopyManager.toggleMessage(msg.id);
          const isSelected = CopyManager.selectedIds.has(msg.id);
          row.classList.toggle('selected', isSelected);
          e.target.checked = isSelected;
        },
      }),
    ]);
    bubble.appendChild(checkboxDiv);

    // 消息行点击（多选模式下切换选中）
    row.addEventListener('click', (e) => {
      if (CopyManager.mode === 'select' && !e.target.closest('button')) {
        CopyManager.toggleMessage(msg.id);
        row.classList.toggle('selected', CopyManager.selectedIds.has(msg.id));
      }
    });

    // 发言人标签（外部聊天记录导入时显示）
    if (msg.senderName) {
      bubble.appendChild(Render.el('div', 'msg-sender-label', {
        text: `👤 ${msg.senderName}`,
      }));
    }

    // 附件图片
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (att.type && att.type.startsWith('image/')) {
          const img = Render.el('img', 'msg-attachment-img', {
            src: att.dataUrl,
            alt: att.ocrText || '截图',
            onclick: (e) => {
              e.stopPropagation();
              this._showImageViewer(att.dataUrl);
            },
          });
          img.style.cssText = 'max-width:100%;max-height:200px;border-radius:8px;cursor:pointer;margin-bottom:6px;display:block;';
          bubble.appendChild(img);
        }
      }
    }

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
    // 复制按钮 — 常显，带点击反馈
    const copyBtn = Render.el('button', 'msg-copy-btn', {
      text: '📋 复制',
      title: '复制消息内容',
      onclick: (e) => {
        e.stopPropagation();
        const text = msg.content;
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✅ 已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = '📋 复制';
            copyBtn.classList.remove('copied');
          }, 1500);
          // 复制内容预览（截取前30字）
          const preview = text.length > 30 ? text.slice(0, 30) + '...' : text;
          Toast.success(`已复制：${preview}`);
        }).catch(() => {
          // 降级方案
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try {
            document.execCommand('copy');
            copyBtn.textContent = '✅ 已复制';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.textContent = '📋 复制';
              copyBtn.classList.remove('copied');
            }, 1500);
            Toast.success('已复制');
          } catch {
            Toast.error('复制失败，请手动选择文本');
          }
          ta.remove();
        });
      },
    });
    // AI 回复添加一键复制整段快捷键（双击气泡复制）
    if (msg.role === 'assistant') {
      bubble.addEventListener('dblclick', async (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        await navigator.clipboard.writeText(msg.content).then(() => {
          Toast.success('已复制全部回复');
        }).catch(() => Toast.error('复制失败'));
      });
    }
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

    // 如果正在流式输出到该对话，先中止。清除 _streamingConvId 防止
    // stopGeneration 的 fire-and-forget 保存与 remove 产生竞态孤儿消息
    if (this.isStreaming && this._streamingConvId === convId) {
      this._streamingConvId = null;
      this.stopGeneration();
    }

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
   * 停止当前生成
   */
  stopGeneration() {
    // _savingInProgress 为 true 表示流已完成、正在正常保存，跳过避免重复写入
    if (this.isStreaming && !this._savingInProgress) {
      const convId = this._streamingConvId; // 使用流式开始时的对话ID，防止桌面端切换对话后保存到错误位置
      API.abort();
      this.isStreaming = false;
      // 保留已生成的内容
      if (this.streamBuffer && this.streamBubble && convId) {
        const content = this.streamBuffer + '\n\n*[已停止生成]*';
        const contentDiv = this.streamBubble.querySelector('.msg-content');
        if (contentDiv) {
          contentDiv.innerHTML = Render.simpleMarkdown(content);
        }
        // 保存部分回复（异步但非关键，失败不阻塞）
        Conversations.addMessage(convId, 'assistant', this.streamBuffer, {})
          .catch(e => console.warn('保存部分回复失败', e));
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

  /**
   * 切换聊天菜单
   */
  toggleChatMenu(e) {
    // 移除已有菜单
    const existing = document.querySelector('.chat-menu-dropdown');
    if (existing) {
      existing.remove();
      return;
    }

    const menu = Render.el('div', 'chat-menu-dropdown', {}, [
      Render.el('button', '', {
        text: '📋 复制全部对话',
        onclick: async () => {
          menu.remove();
          try {
            const messages = await Conversations.getMessages(this.currentConvId, 500);
            await CopyManager.copyAllConversation(messages);
          } catch (e) {
            Toast.error('复制失败：' + (e.message || '未知错误'));
          }
        },
      }),
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
          } else {
            Toast.error('无法删除：未选择对话');
          }
          menu.remove();
        },
      }),
    ]);

    document.body.appendChild(menu);
  },

  /**
   * 通过 msgId 查找消息对象（从 DOM 反向查找）
   */
  _findMsgById(msgId) {
    // 简单方案：从当前渲染的消息列表中匹配
    const row = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!row) return null;
    const contentEl = row.querySelector('.msg-content');
    return { id: msgId, content: contentEl?.textContent || '', role: row.classList.contains('user') ? 'user' : 'assistant' };
  },

  /**
   * 检测发言人（手动触发或长截图OCR后自动触发）
   */
  async _detectSpeakers() {
    const input = Render.$('#user-input');
    const text = input.value.trim();
    if (!text) return;

    // 隐藏提示条
    document.getElementById('speaker-hint-chip')?.classList.add('hidden');

    const result = SpeakerDetect.detect(text);

    if (result.segments.length === 0) {
      Toast.info('未检测到聊天记录格式');
      return;
    }

    // 标记程序化输入（防止 input 事件处理器误清除 _pendingSenderName）
    const setInput = (segments) => {
      this._programmaticInput = true;
      input.value = SpeakerDetect.formatForSend(segments);
      this._pendingSenderName = segments[0]?.speaker || null;
      this._programmaticInput = false;
    };

    if (result.confidence >= 0.85) {
      // 高置信度：直接确认
      setInput(result.segments);
      Toast.success(`已识别 ${result.segments.length} 条消息（置信度 ${Math.round(result.confidence * 100)}%）`);
    } else if (result.confidence >= 0.5) {
      // 中置信度：AI 辅助 + 用户确认
      Toast.info('正在 AI 辅助识别...');
      try {
        const aiResult = await SpeakerDetect.aiAssist(API, text);
        const merged = aiResult.length > 0 ? aiResult : result.segments;
        const confirmed = await SpeakerDetect.confirmWithUser(merged);
        if (confirmed) {
          setInput(confirmed);
          Toast.success('发言人已确认');
        }
      } catch {
        // AI 失败，直接用户确认
        const confirmed = await SpeakerDetect.confirmWithUser(result.segments);
        if (confirmed) {
          setInput(confirmed);
        }
      }
    } else {
      // 低置信度：用户逐条确认
      const confirmed = await SpeakerDetect.confirmWithUser(result.segments);
      if (confirmed) {
        setInput(confirmed);
      }
    }
  },

  /**
   * 全屏查看图片
   */
  _showImageViewer(dataUrl) {
    // 锁定背景滚动
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const viewer = document.createElement('div');
    viewer.id = 'image-viewer';
    viewer.innerHTML = `
      <img src="${dataUrl}">
      <button class="close-btn">✕</button>
    `;

    const close = () => {
      viewer.remove();
      document.body.style.overflow = origOverflow;
      document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('keydown', escHandler);
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer || e.target.tagName === 'BUTTON') close();
    });
    document.body.appendChild(viewer);
  },

  /**
   * File → base64 DataURL
   */
  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  },
};

export default ChatView;
