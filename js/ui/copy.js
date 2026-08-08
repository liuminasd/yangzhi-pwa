// ============================================
// copy.js — 复制引擎 + 多选状态机
// 支持：单条复制、多选批量、复制全部对话
// ============================================

import Toast from './toast.js';
import Security from '../utils/security.js';

const CopyManager = {
  mode: 'normal',           // 'normal' | 'select'
  selectedIds: new Set(),
  _onStateChange: null,     // 状态变化回调

  /**
   * 初始化
   * @param {Function} onStateChange - 状态变化时更新 UI
   */
  init(onStateChange) {
    this._onStateChange = onStateChange;
  },

  /**
   * 进入多选模式
   */
  enterSelectMode() {
    this.mode = 'select';
    this.selectedIds.clear();
    this._notify();
  },

  /**
   * 退出多选模式
   */
  exitSelectMode() {
    this.mode = 'normal';
    this.selectedIds.clear();
    this._notify();
  },

  /**
   * 切换单条消息选中
   */
  toggleMessage(msgId) {
    if (this.mode !== 'select') return;
    if (this.selectedIds.has(msgId)) {
      this.selectedIds.delete(msgId);
    } else {
      this.selectedIds.add(msgId);
    }
    this._notify();
  },

  /**
   * 全选
   */
  selectAll(msgIds) {
    this.selectedIds = new Set(msgIds);
    this._notify();
  },

  /**
   * 获取选中数量
   */
  getSelectedCount() {
    return this.selectedIds.size;
  },

  /**
   * 复制单条消息
   */
  async copyMessage(content) {
    await this._writeClipboard(content);
    Toast.success('已复制');
  },

  /**
   * 复制所有选中消息
   * @param {Array} messages - 所有可见消息对象
   */
  async copySelected(messages) {
    const selected = messages.filter(m => this.selectedIds.has(m.id));
    if (selected.length === 0) {
      Toast.error('请先选择消息');
      return;
    }

    const text = selected.map(m => this._formatForCopy(m)).join('\n\n');
    await this._writeClipboard(text);
    Toast.success(`已复制 ${selected.length} 条消息`);
    this.exitSelectMode();
  },

  /**
   * 复制全部对话
   * @param {Array} messages - 所有消息
   */
  async copyAllConversation(messages) {
    if (messages.length === 0) {
      Toast.error('对话为空');
      return;
    }
    const text = messages.map(m => this._formatForCopy(m)).join('\n\n');
    await this._writeClipboard(text);
    Toast.success(`已复制全部 ${messages.length} 条消息`);
  },

  /**
   * 格式化单条消息为文本（对标微信复制格式）
   */
  _formatForCopy(msg) {
    const time = Security.formatTime(msg.timestamp);
    const sender = msg.senderName || (msg.role === 'user' ? '我' : 'AI');
    return `${sender}（${time}）：\n${msg.content}`;
  },

  /**
   * 写入剪贴板
   */
  async _writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级方案（兼容旧浏览器和部分移动端）
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.contentEditable = 'true';
      ta.readOnly = true;
      // 放在可视区域内（iOS 要求元素可见才能 select）
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.focus();
      ta.setSelectionRange(0, text.length);
      try {
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch {
        // 彻底失败：弹出文本让用户手动复制
        ta.style.opacity = '1';
        ta.style.width = 'auto';
        ta.style.height = 'auto';
        ta.style.left = '50%';
        ta.style.top = '50%';
        ta.style.transform = 'translate(-50%, -50%)';
        ta.style.zIndex = '999';
        ta.select();
        Toast.info('请手动复制已选中的文本');
        setTimeout(() => ta.remove(), 3000);
        return false;
      }
    }
  },

  /**
   * 通知状态变化
   */
  _notify() {
    if (this._onStateChange) {
      this._onStateChange(this.mode, this.selectedIds.size);
    }
  },
};

export default CopyManager;
