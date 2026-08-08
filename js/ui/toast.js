// ============================================
// toast.js — Toast 通知系统
// ============================================

const Toast = {
  container: null,

  _ensureContainer() {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
    }
  },

  /**
   * 显示 Toast
   */
  show(message, type = 'info', duration = 2500) {
    this._ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error', 4000); },
  info(msg)    { this.show(msg, 'info'); },
};

export default Toast;
