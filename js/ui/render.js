// ============================================
// render.js — DOM 渲染辅助工具
// ============================================

const Render = {
  /**
   * 快捷创建元素
   */
  el(tag, className = '', attrs = {}, children = []) {
    const elem = document.createElement(tag);
    if (className) {
      if (Array.isArray(className)) {
        elem.classList.add(...className);
      } else {
        elem.className = className;
      }
    }
    for (const [key, val] of Object.entries(attrs)) {
      if (key.startsWith('on')) {
        elem.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key === 'html') {
        elem.innerHTML = val;
      } else if (key === 'text') {
        elem.textContent = val;
      } else {
        elem.setAttribute(key, val);
      }
    }
    if (Array.isArray(children)) {
      for (const child of children) {
        if (typeof child === 'string') {
          elem.appendChild(document.createTextNode(child));
        } else if (child) {
          elem.appendChild(child);
        }
      }
    }
    return elem;
  },

  /**
   * 获取元素
   */
  $(selector) {
    return document.querySelector(selector);
  },

  /**
   * 获取所有匹配元素
   */
  $$(selector) {
    return document.querySelectorAll(selector);
  },

  /**
   * 清空元素
   */
  empty(el) {
    if (typeof el === 'string') el = this.$(el);
    if (el) el.innerHTML = '';
  },

  /**
   * 简单 Markdown 转 HTML（粗体、斜体、代码、链接）
   */
  simpleMarkdown(text) {
    if (!text) return '';
    // 输入长度限制（防 ReDoS）
    if (text.length > 50000) text = text.slice(0, 50000) + '...';
    let html = text
      // 转义 HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // 代码块
      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 粗体
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // 链接（阻止 javascript: data: vbscript: 等危险协议）
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
        const safe = /^(https?:|mailto:|ftp:|\/|\.\/|#)/i.test(url.trim());
        return safe
          ? `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer">${text}</a>`
          : text;
      })
      // 无序列表
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // 换行
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // 包裹段落
    html = '<p>' + html + '</p>';
    // 清理空的 <p></p>
    html = html.replace(/<p><\/p>/g, '');
    // 将连续的 <li> 包裹在 <ul> 中
    html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

    return html;
  },

  /**
   * 滚动到底部
   */
  scrollToBottom(el) {
    if (typeof el === 'string') el = this.$(el);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  },

  /**
   * 防抖
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },
};

export default Render;
