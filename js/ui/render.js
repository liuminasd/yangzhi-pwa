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

    // ★ 先提取代码块和行内代码到占位数组，防止后续正则破坏代码内容
    const codeBlocks = [];
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 提取围栏代码块 ```...```
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code>${code}</code></pre>`);
      return `\x00CODEBLOCK${idx}\x00`;
    });

    // 提取行内代码 `...`
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<code>${code}</code>`);
      return `\x00CODEBLOCK${idx}\x00`;
    });

    // 粗体
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 斜体
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // 链接（阻止 javascript: data: vbscript: 等危险协议）
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
      const safe = /^(https?:|mailto:|ftp:|\/|\.\/|#)/i.test(url.trim());
      return safe
        ? `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
        : linkText;
    });
    // 无序列表（占位符 \x00CODEBLOCK 不包含 - 字符，安全）
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    // 换行
    html = html.replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // ★ 还原代码占位符
    html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => {
      return codeBlocks[parseInt(idx)] || '';
    });

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
   * @param {boolean} force - 强制滚动（忽略用户手动上滑状态）
   */
  scrollToBottom(el, force = false) {
    if (typeof el === 'string') el = this.$(el);
    if (!el) return;
    // 检查用户是否手动上滑（距底部 > 80px 视为有意查看历史）
    if (!force && el._userScrolledUp) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
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
