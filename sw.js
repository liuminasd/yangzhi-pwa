// ============================================
// sw.js — Service Worker（PWA 离线支持）
// ============================================

const CACHE_NAME = 'chat-ai-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192x192.png',
  './assets/icon-512x512.png',
  './css/base.css',
  './css/layout.css',
  './css/chat.css',
  './css/skills.css',
  './css/components.css',
  './css/auth.css',
  './js/config.js',
  './js/profile.js',
  './js/profile-sync.js',
  './js/app.js',
  './js/auth.js',
  './js/api.js',
  './js/utils/token.js',
  './js/utils/security.js',
  './js/utils/compress.js',
  './js/memory/store.js',
  './js/memory/conversations.js',
  './js/memory/facts.js',
  './js/memory/memory-bridge.js',
  './js/skills/registry.js',
  './js/skills/rewrite.js',
  './js/skills/translate.js',
  './js/skills/tone.js',
  './js/skills/empathy.js',
  './js/skills/analyze.js',
  './js/skills/recall.js',
  './js/skills/love-advisor.js',
  './js/skills/summarize.js',
  './js/skills/brainstorm.js',
  './js/ui/render.js',
  './js/ui/toast.js',
  './js/ui/chat-view.js',
  './js/ui/skill-panel.js',
  './js/ui/memory-view.js',
  './js/ui/settings.js',
  './js/ui/ocr.js',
  './js/ui/copy.js',
  './js/ui/context-menu.js',
  './js/ui/speaker-detect.js',
];

// 安装：预缓存所有静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('SW: 预缓存部分失败', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：缓存优先策略
self.addEventListener('fetch', (event) => {
  // 跳过 API 请求和非 GET 请求
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/v1/messages')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 缓存命中直接返回
      if (cached) return cached;

      // 否则请求网络
      return fetch(event.request).then((response) => {
        // 缓存成功的响应
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // 离线且未缓存：返回 index.html（SPA 兜底）
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('离线模式，请连接网络后重试', { status: 503 });
      });
    })
  );
});
