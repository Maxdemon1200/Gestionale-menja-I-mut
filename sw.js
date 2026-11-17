importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js","https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const firebaseConfig = { apiKey: "AIzaSyCGnhppVUBNrsFimsNgxTHw2cqltMm0fF4", authDomain: "menja-i-mut-gestionale.firebaseapp.com", projectId: "menja-i-mut-gestionale", storageBucket: "menja-i-mut-gestionale.firebasestorage.app", messagingSenderId: "825562456235", appId: "1:825562456235:web:096d370ed9f6cbd5ca17ee" };
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || "Menja i Mut";
  const options = { body: payload.notification?.body || "Hai un aggiornamento sul tuo ordine", icon: "./icon.svg", data: { url: payload.fcmOptions?.link || "./" } };
  return self.registration.showNotification(title, options);
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "./";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    for (const client of windows) { if (client.url.startsWith(self.location.origin) && "focus" in client) return client.focus(); }
    return clients.openWindow(target);
  }));
});

const CACHE_NAME = "menjaimut-pwa-v110";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./config.js?v=2",
  "./app-online.js?v=96",
  "./menjaimut.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("menjaimut-pwa-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
