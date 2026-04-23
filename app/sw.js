/**
 * 東京 高低マップ プロジェクト - 共通 Service Worker
 * 
 * キャッシュ戦略：
 * - アプリシェル（HTML/CSS/JS）：Cache First
 * - CDNライブラリ：Cache First（バージョンはURLで管理）
 * - 地図タイル（GSI/ハザード）：Stale While Revalidate
 * - API（標高取得）：Network First（フォールバックでエラー返却）
 */

const CACHE_VERSION = 'v1.0.0-20260423';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const LIB_CACHE = `lib-${CACHE_VERSION}`;
const TILE_CACHE = `tile-${CACHE_VERSION}`;

// アプリシェルの事前キャッシュ対象（各ページから相対で登録）
// install 時は必須の自ページのみ、他はランタイムで取得
const SHELL_PRECACHE = [
  './',
  './index.html',
];

// CDN ライブラリのホスト
const LIB_HOSTS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
];

// 地図タイルのホスト
const TILE_HOSTS = [
  'cyberjapandata.gsi.go.jp',
  'disaportaldata.gsi.go.jp',
  'tiles.gsj.jp',
  'raw.githubusercontent.com', // GeoJSON用
];

// Network First で扱うホスト（オフライン時は諦める）
const API_HOSTS = [
  // 標高API：GET だが結果を毎回最新で欲しいため Network First
];

// =========================
// install
// =========================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_PRECACHE).catch(err => {
        console.warn('[SW] プリキャッシュ部分失敗（無視）:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// =========================
// activate - 古いキャッシュ削除
// =========================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => {
          // 現バージョン以外を削除
          return !key.endsWith(CACHE_VERSION);
        }).map(key => {
          console.log('[SW] 古いキャッシュ削除:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// =========================
// fetch - 戦略振り分け
// =========================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // GET以外はスルー
  if (req.method !== 'GET') return;
  
  const url = new URL(req.url);
  
  // chrome-extension:// 等は無視
  if (!url.protocol.startsWith('http')) return;

  // 地図タイルホスト → Stale While Revalidate
  if (TILE_HOSTS.includes(url.host)) {
    event.respondWith(staleWhileRevalidate(req, TILE_CACHE));
    return;
  }

  // CDNライブラリ → Cache First
  if (LIB_HOSTS.includes(url.host)) {
    event.respondWith(cacheFirst(req, LIB_CACHE));
    return;
  }

  // 同一オリジンのHTML/CSS/JS → Cache First（アプリシェル）
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  // その他はネットワーク優先
  event.respondWith(networkFirst(req, SHELL_CACHE));
});

// =========================
// キャッシュ戦略実装
// =========================

// Cache First: キャッシュがあればそれを返し、なければネットワーク→キャッシュ格納
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors' || res.type === 'default')) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    // オフライン時はエラー（呼び出し側でハンドル）
    return offlineFallback(req);
  }
}

// Stale While Revalidate: キャッシュがあれば即返し、裏でネットワーク更新
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  
  const networkPromise = fetch(req).then(res => {
    if (res && res.status === 200) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  
  if (cached) {
    // 裏で更新しておく（エラー無視）
    networkPromise.catch(() => {});
    return cached;
  }
  
  // キャッシュがなければネットワーク待ち
  const netRes = await networkPromise;
  if (netRes) return netRes;
  return offlineFallback(req);
}

// Network First: ネットワーク優先、失敗時キャッシュ
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return offlineFallback(req);
  }
}

// オフラインフォールバック
function offlineFallback(req) {
  // 画像系は空画像（1x1透明PNG）
  const accept = req.headers.get('accept') || '';
  if (accept.includes('image') || /\.(png|jpg|jpeg|gif|webp)$/i.test(req.url)) {
    return new Response(
      Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0)),
      { headers: { 'Content-Type': 'image/png' }, status: 200 }
    );
  }
  // その他は 503
  return new Response(
    JSON.stringify({ error: 'offline', message: 'オフライン中のため取得できませんでした' }),
    { headers: { 'Content-Type': 'application/json' }, status: 503 }
  );
}

// =========================
// メッセージ受信（手動更新用）
// =========================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});

console.log('[SW] 東京高低マップ Service Worker 起動 -', CACHE_VERSION);
