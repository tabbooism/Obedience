const CACHE = "obediance-shell-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : { title: "Obediance", body: "New platform activity" };
  event.waitUntil(self.registration.showNotification(data.title || "Obediance", {
    body: data.body || data.content || "New platform activity",
    tag: data.tag || "obediance-activity",
    data: { url: data.url || "/" },
    icon: data.icon || "/favicon.ico"
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
