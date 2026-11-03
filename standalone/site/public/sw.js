// Performance360 Academy service worker: makes the app installable. It does not cache anything,
// so every open loads the latest published version.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
