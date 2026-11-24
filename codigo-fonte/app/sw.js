// (0.9.1) Notificações push do Aero Web: o aviso chega sem conteúdo nenhum e este worker pergunta ao servidor (com o token de push do
// aparelho) quem mandou e em qual conversa. O texto das mensagens nunca passa por aqui.
'use strict';
const EN = !/^pt/i.test((self.navigator && self.navigator.language) || 'pt');
const T = (pt, en) => (EN ? en : pt);
async function config() {
  try { const r = await (await caches.open('aero-push')).match('/__aero-push'); return r ? await r.json() : null; } catch (e) { return null; }
}
async function novas(cfg) {
  try {
    const r = await fetch(cfg.api + '/api/push/novas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: cfg.t }) });
    const d = await r.json();
    if (d.fim) { try { await (await caches.open('aero-push')).delete('/__aero-push'); } catch (e) { /* ok */ } }
    // (1.0.2) lidas em outro aparelho: a notificação delas sai daqui
    const lidas = Array.isArray(d.lidas) ? d.lidas : [];
    if (lidas.length) { try { for (const n of await self.registration.getNotifications()) if (n.data && lidas.includes(n.data.cid)) n.close(); } catch (e) { /* ok */ } }
    const l = Array.isArray(d.novas) ? d.novas : []; l.lidas = lidas;
    return l;
  } catch (e) { return []; }
}
async function mostrar() {
  const cfg = await config();
  const lista = cfg ? await novas(cfg) : [];
  const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (abertas.some((c) => c.visibilityState === 'visible') && lista.length) return; // o app está na tela: o aviso já aparece lá dentro
  if (!lista.length && lista.lidas && lista.lidas.length) return; // a mensagem já foi lida em outro aparelho antes de chegar aqui
  if (!lista.length) return self.registration.showNotification('Aero', { body: T('Você tem mensagens novas.', 'You have new messages.'), tag: 'aero', icon: 'icon-512.png' });
  const por = new Map();
  for (const x of lista) { const g = por.get(x.cid) || { n: 0, x }; g.n++; g.x = x; por.set(x.cid, g); }
  for (const [cid, { n, x }] of por) {
    const titulo = String(x.g || x.de || 'Aero').slice(0, 80);
    const qtd = n > 1 ? T(n + ' mensagens novas', n + ' new messages') : T('Nova mensagem', 'New message');
    await self.registration.showNotification(titulo, {
      body: x.g ? String(x.de || '').slice(0, 60) + ': ' + qtd : qtd, tag: 'c-' + cid, renotify: true, data: { cid },
      icon: x.av && x.cod ? cfg.api + '/api/avatar/' + encodeURIComponent(x.cod) + '?v=' + encodeURIComponent(x.av) : 'icon-512.png',
    });
  }
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => e.waitUntil(mostrar()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cid = (e.notification.data && e.notification.data.cid) || '';
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (abertas.length) { const c = abertas[0]; try { await c.focus(); } catch (er) { /* ok */ } c.postMessage({ aeroAbrir: cid }); return; }
    await self.clients.openWindow('./' + (cid ? '?conv=' + encodeURIComponent(cid) : ''));
  })());
});
