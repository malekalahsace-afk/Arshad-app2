// خدمة العامل الخاصة بتطبيق "سجل الدرجات"
// تتيح عمل التطبيق بدون إنترنت بعد أول تشغيل، وتسمح بتثبيته على الشاشة الرئيسية
// (الجوال / التابلت / اللابتوب) كأنه تطبيق مستقل.

const CACHE_VERSION = "v4";
const CACHE_NAME = `sijil-darajat-${CACHE_VERSION}`;

// الملفات الأساسية لنفس الموقع (نفس النطاق) التي نحفظها فور التثبيت
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  // لا نفعّل النسخة الجديدة تلقائيًا؛ ننتظر تأكيد المستخدم من داخل التطبيق
  // (زر "تحديث الآن") عن طريق رسالة SKIP_WAITING أدناه.
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // صفحة HTML الرئيسية: نجرب الشبكة أولًا حتى تصل آخر تحديث، ونرجع للنسخة المحفوظة إذا ماكو إنترنت
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("./index.html").then((cached) => cached || caches.match("./")))
    );
    return;
  }

  // باقي الملفات (مكتبات CDN، خطوط، أيقونات...): من الكاش فورًا إذا موجودة، ونحدّثها بالخلفية
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
