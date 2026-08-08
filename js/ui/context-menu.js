// ============================================
// context-menu.js — 长按/右键浮动上下文菜单
// 对标微信，支持移动端长按和桌面端右键
// ============================================

const ContextMenu = {
  _menu: null,
  _longPressTimer: null,
  _startX: 0,
  _startY: 0,
  _justOpened: false,  // 防止合成 click 立即关闭菜单

  /**
   * 初始化：在消息列表上绑定长按和右键事件
   * @param {HTMLElement} container - 消息列表容器
   * @param {Function} getItems - (msgEl) => [{label, icon, action}]
   */
  init(container, getItems) {
    // 移动端长按
    container.addEventListener('touchstart', (e) => {
      const msgRow = e.target.closest('.msg-row');
      if (!msgRow) return;
      const startX = e.touches[0].clientX;
      const startY = e.touches[0].clientY;
      this._startX = startX;
      this._startY = startY;
      this._longPressTimer = setTimeout(() => {
        // 使用捕获的坐标（e.touches 在 500ms 后可能已过期）
        if (Math.abs(startX - this._startX) < 10 && Math.abs(startY - this._startY) < 10) {
          msgRow.classList.add('long-pressing');
          setTimeout(() => msgRow.classList.remove('long-pressing'), 150);
          this._justOpened = true;
          this.show(startX, startY, getItems(msgRow));
        }
      }, 500);
    }, { passive: true });

    container.addEventListener('touchmove', () => {
      clearTimeout(this._longPressTimer);
    });

    container.addEventListener('touchend', () => {
      clearTimeout(this._longPressTimer);
    });

    // 桌面端右键
    container.addEventListener('contextmenu', (e) => {
      const msgRow = e.target.closest('.msg-row');
      if (!msgRow) return;
      e.preventDefault();
      this._justOpened = true;
      this.show(e.clientX, e.clientY, getItems(msgRow));
    });

    // 点击其他区域关闭（跳过菜单刚打开后的合成 click）
    document.addEventListener('click', () => {
      if (this._justOpened) {
        this._justOpened = false;
        return;
      }
      this.hide();
    });
  },

  /**
   * 显示浮动菜单
   */
  show(x, y, items) {
    this.hide();

    const menu = document.createElement('div');
    menu.className = 'context-menu';

    items.forEach((item, i) => {
      if (item === '-') {
        menu.appendChild(document.createElement('div')).className = 'divider';
        return;
      }
      const btn = document.createElement('button');
      btn.textContent = `${item.icon || ''} ${item.label}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        this.hide();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // 智能定位：保持在视口内
    const rect = menu.getBoundingClientRect();
    let left = x;
    let top = y - rect.height;

    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (top < 8) top = y + 16;
    if (top + rect.height > window.innerHeight - 8) {
      top = window.innerHeight - rect.height - 8;
    }

    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
    menu.style.animation = 'fadeIn 0.12s ease';

    this._menu = menu;
  },

  /**
   * 关闭菜单
   */
  hide() {
    if (this._menu) {
      this._menu.remove();
      this._menu = null;
    }
  },
};

export default ContextMenu;
