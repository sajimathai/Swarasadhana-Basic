/* Swarasadhana — app bootstrap: PWA service-worker registration + install hint.
   The app UI itself is rendered by the design-component runtime (assets/support.js)
   from the markup in index.html; this file only wires up offline + install. */
(function () {
  'use strict';

  // Register the service worker (relative path keeps scope = bundle folder).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js').catch(function (err) {
        console.warn('[swarasadhana] SW registration failed:', err);
      });
    });
  }

  // Capture the install prompt so it can be triggered later if desired.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__swarasadhanaInstall = e;
  });
})();
