/* no-op service worker to avoid 404 in local/dev when stale registration exists */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
