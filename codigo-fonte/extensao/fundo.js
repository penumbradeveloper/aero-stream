// Aero - Ouvindo e assistindo (extensão): junta o que as abas de música e de vídeo mandam e repassa ao app do Aero NESTE computador
// (http://127.0.0.1:41783, com o código de pareamento que ela pega sozinha do app). Nada vai para a internet.
// Criado por Ryan Victtor.
'use strict';
const api = globalThis.browser || globalThis.chrome;
const BASE = 'http://127.0.0.1:41783';
const abas = new Map(); // aba -> { ouv, em }
const abasAss = new Map(); // (1.1.0) aba -> { ass, em } (Twitch, Kick, YouTube e os sites da pessoa)

async function token() { try { const r = await api.storage.local.get('token'); return (r && r.token) || ''; } catch (e) { return ''; } }

// várias abas: a que está tocando vence (a que avisou por último)
function escolher() {
  let m = null;
  for (const v of abas.values()) if (v.ouv && (!m || (v.ouv.tocando && !m.ouv.tocando) || (v.ouv.tocando === m.ouv.tocando && v.em > m.em))) m = v;
  return m ? m.ouv : null;
}

// (1.1.0) o vídeo: o que está passando vence; entre dois passando, o da aba que avisou por último
function escolherAss() {
  let m = null;
  for (const v of abasAss.values()) if (v.ass && (!m || (v.ass.tocando && !m.ass.tocando) || (v.ass.tocando === m.ass.tocando && v.em > m.em))) m = v;
  return m ? m.ass : null;
}

async function mandar() {
  const tok = await token(); if (!tok) return;
  try {
    const r = await fetch(BASE + '/ouvindo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aero-Token': tok }, body: JSON.stringify({ ouv: escolher(), ass: escolherAss() }) });
    let j = null; if (r.ok) { try { j = await r.json(); } catch (e) { /* ok */ } }
    if (j && j.cmd) pedido(j.cmd);
    if (j) guardarSites(j.sites);
    if (r.status === 401) parearAuto(true);
    await api.storage.local.set({ estado: r.ok ? 'ok' : r.status === 401 ? 'codigo' : 'erro', estadoEm: Date.now() });
  } catch (e) { try { await api.storage.local.set({ estado: 'fechado', estadoEm: Date.now() }); } catch (_) { /* ok */ } }
}

// "Ouvir junto": o app pede para tocar a música de um amigo. Leva o pedido para a aba daquele serviço (ou abre uma) e, quando a aba
// já está na música certa, manda acertar o tempo. Cada pedido vale uma vez (seq) e some em 30 s.
let feito = 0, pend = null, abriuSeq = 0;
const PADRAO = { ytmusic: 'https://music.youtube.com/*', deezer: 'https://www.deezer.com/*' };
function pedido(c) {
  if (!c || typeof c.seq !== 'number' || c.seq <= feito || !PADRAO[c.f]) return;
  if (!pend || c.seq > pend.seq) pend = c;
  levar();
}
async function levar() {
  const c = pend; if (!c) return;
  if (Date.now() - c.em > 30000) { pend = null; return; }
  let tabs = []; try { tabs = await api.tabs.query({ url: PADRAO[c.f] }); } catch (e) { tabs = []; }
  const naMusica = tabs.find((t) => { const v = abas.get(t.id); return v && v.ouv && v.ouv.id === c.id; });
  const alvo = naMusica || tabs.find((t) => abas.has(t.id)) || tabs[0];
  if (!alvo) { if (c.tocando && abriuSeq !== c.seq) { abriuSeq = c.seq; try { api.tabs.create({ url: c.url }); } catch (e) { /* ok */ } } return; }
  try { api.tabs.sendMessage(alvo.id, { tipo: 'cmd', cmd: c }); } catch (e) { /* ok */ }
  if (naMusica || !c.tocando || !c.id) { feito = c.seq; pend = null; } // trocou de música: espera a aba avisar que chegou nela para acertar o tempo
}

api.runtime.onMessage.addListener((m, quem) => {
  if (!m || m.tipo !== 'ouv' || !quem || !quem.tab || quem.id !== api.runtime.id) return;
  const o = m.ouv;
  if (o && typeof o === 'object') abas.set(quem.tab.id, { ouv: o, em: Date.now() }); else abas.delete(quem.tab.id);
  mandar();
  if (pend && o && o.id === pend.id) levar();
});
api.tabs && api.tabs.onRemoved && api.tabs.onRemoved.addListener((id) => { const a = abas.delete(id), b = abasAss.delete(id); if (a || b) mandar(); });

// ---------- (1.1.0) Assistindo agora ----------
api.runtime.onMessage.addListener((m, quem) => {
  if (!m || !quem || !quem.tab || quem.id !== api.runtime.id) return;
  if (m.tipo === 'ass') {
    const o = m.ass;
    if (o && typeof o === 'object') abasAss.set(quem.tab.id, { ass: o, em: Date.now() }); else if (!abasAss.delete(quem.tab.id)) return;
    mandar();
  } else if (m.tipo === 'oi') buscarSites();
});
// a lista de sites vem do Aero (aba Integrações > Assistindo agora): guarda aqui (as abas leem daqui) e registra a leitura nos sites da
// pessoa que já foram permitidos nesta extensão
let pedindoSites = 0;
async function buscarSites() {
  if (Date.now() - pedindoSites < 5000) return; pedindoSites = Date.now();
  const tok = await token(); if (!tok) return;
  try { const r = await fetch(BASE + '/ping', { headers: { 'X-Aero-Token': tok } }); if (r.ok) guardarSites((await r.json()).sites); } catch (e) { /* o Aero está fechado */ }
}
const DOM = /^(?=.{3,80}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
async function guardarSites(s) {
  if (s === undefined) return; // app antigo: não sabe de sites
  const novo = s && typeof s === 'object' ? s : null;
  let antes = null; try { antes = (await api.storage.local.get('sites')).sites || null; } catch (e) { /* ok */ }
  if (JSON.stringify(antes) === JSON.stringify(novo)) return;
  await api.storage.local.set({ sites: novo });
  registrar();
}
const origensDe = (dom) => ['https://' + dom + '/*', 'https://*.' + dom + '/*'];
async function registrar() {
  if (!api.scripting || !api.scripting.registerContentScripts) return;
  let s = null; try { s = (await api.storage.local.get('sites')).sites || null; } catch (e) { /* ok */ }
  const doms = s && s.on === true ? (s.meus || []).filter((x) => x && x.on !== false && DOM.test(x.dom || '')).map((x) => x.dom) : [];
  const ok = [];
  for (const d of doms) { try { if (await api.permissions.contains({ origins: origensDe(d) })) ok.push(...origensDe(d)); } catch (e) { /* ok */ } }
  try { await api.scripting.unregisterContentScripts({ ids: ['aero-sites'] }); } catch (e) { /* não havia */ }
  if (!ok.length) return;
  try {
    await api.scripting.registerContentScripts([{ id: 'aero-sites', matches: ok, js: ['video.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
    // as abas que já estavam abertas nesses sites também passam a contar
    const tabs = await api.tabs.query({ url: ok });
    for (const t of tabs || []) { try { await api.scripting.executeScript({ target: { tabId: t.id }, files: ['video.js'] }); } catch (e) { /* aba especial */ } }
  } catch (e) { /* navegador sem suporte */ }
}
api.permissions && api.permissions.onAdded && api.permissions.onAdded.addListener(() => registrar());
api.permissions && api.permissions.onRemoved && api.permissions.onRemoved.addListener(() => registrar());
api.runtime.onStartup && api.runtime.onStartup.addListener(() => { buscarSites(); registrar(); });

// pareamento automático: a página de instalar do app manda o código (parear.js) e a extensão já avisa o app que chegou
api.runtime.onMessage.addListener((m, quem) => {
  if (!m || m.tipo !== 'parear' || !quem || quem.id !== api.runtime.id || !quem.url || !quem.url.startsWith(BASE + '/instalar')) return;
  if (!/^[a-f0-9]{16,64}$/i.test(String(m.token || ''))) return;
  api.storage.local.set({ token: m.token }).then(() => fetch(BASE + '/ping', { headers: { 'X-Aero-Token': m.token } })).catch(() => {});
});
// recém-instalada: recarrega a página de instalar que estiver aberta (o navegador não roda a extensão em abas já abertas)
api.runtime.onInstalled && api.runtime.onInstalled.addListener(() => {
  buscarSites(); registrar();
  try { Promise.resolve(api.tabs.query({ url: BASE + '/instalar*' })).then((l) => (l || []).forEach((t) => api.tabs.reload(t.id))).catch(() => {}); } catch (e) { /* ok */ }
});

// (1.2.0) pareamento automático, sem código: logo depois de a pessoa clicar em "Instalar ou conectar" no Aero, o app abre uma janelinha
// de 10 min em que entrega o código a esta extensão. Ela tenta quando não tem código (ou o código venceu) e, uma vez por minuto, avisa
// o Aero que está aqui (só para 127.0.0.1, este computador)
let tentouParear = 0;
async function parearAuto(forcar) {
  if (Date.now() - tentouParear < 4000) return false; tentouParear = Date.now();
  if (!forcar && (await token())) return false;
  try {
    const r = await fetch(BASE + '/parear', { cache: 'no-store' });
    if (!r.ok) return false;
    const j = await r.json(), t = String((j && j.token) || '');
    if (!/^[a-f0-9]{16,64}$/i.test(t)) return false;
    await api.storage.local.set({ token: t });
    buscarSites(); return true;
  } catch (e) { return false; }
}
async function verAero() {
  const tok = await token();
  if (!tok) return parearAuto();
  try { const r = await fetch(BASE + '/ping', { headers: { 'X-Aero-Token': tok }, cache: 'no-store' }); if (r.status === 401) return parearAuto(true); if (r.ok) guardarSites((await r.json()).sites); } catch (e) { /* o Aero está fechado */ }
}
api.runtime.onMessage.addListener((m, quem, responder) => {
  if (!m || m.tipo !== 'parear-auto' || !quem || quem.id !== api.runtime.id || quem.tab) return;
  tentouParear = 0; parearAuto(true).then((ok) => responder({ ok }), () => responder({ ok: false })); return true; // a janelinha pediu
});
if (api.alarms) {
  try { Promise.resolve(api.alarms.get('aero-ver')).then((a) => { if (!a) api.alarms.create('aero-ver', { periodInMinutes: 1 }); }).catch(() => {}); } catch (e) { /* ok */ }
  api.alarms.onAlarm.addListener((a) => { if (a && a.name === 'aero-ver') verAero(); });
}
verAero();
