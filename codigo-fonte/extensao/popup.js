// Aero - Ouvindo e assistindo (extensão): a janelinha do botão. Testa se o app do Aero responde e, sem código, pede um sozinha (1.2.0).
'use strict';
const api = globalThis.browser || globalThis.chrome;
const BASE = 'http://127.0.0.1:41783';
const ORIGENS = ['http://127.0.0.1:41783/*', 'https://music.youtube.com/*', 'https://www.deezer.com/*', 'https://www.twitch.tv/*', 'https://kick.com/*', 'https://www.youtube.com/*', 'https://m.youtube.com/*'];
const en = !/^pt/i.test(navigator.language || '');
const T = (pt, eng) => (en ? eng : pt);
const $ = (id) => document.getElementById(id);

if (en) {
  document.documentElement.lang = 'en';
  $('txt-ajuda').textContent = 'Shows your Aero friends the music you play on YouTube Music and Deezer and what you watch on Twitch, Kick, YouTube and the sites you add in Aero. It connects by itself to Aero on this computer; if it does not, paste here the code Aero shows when you click "Install in the browser".';
  $('txt-rotulo').textContent = 'Pairing code'; $('salvar').textContent = 'Save'; $('codigo').placeholder = 'Paste the code from Aero';
  $('permitir').textContent = 'Allow access';
  $('txt-sites').textContent = 'Your sites (added in Aero > Integrations > Watching now)';
}

function estado(t, tipo) { const e = $('estado'); e.textContent = t; e.className = tipo || ''; }

async function permissoesOk() { try { return await api.permissions.contains({ origins: ORIGENS }); } catch (e) { return true; } }

const DICA = () => T('No Aero, clique em "Instalar ou conectar" (Integrações > Assistindo agora): ela se conecta sozinha, ou cole acima o código que aparece lá.', 'In Aero, click "Install or connect" (Integrations > Watching now): it connects by itself, or paste above the code shown there.');
// sem código (ou com um que venceu): pede um ao Aero sozinha (só funciona logo depois do clique em "Instalar ou conectar" no app)
const pedirCodigo = () => new Promise((ok) => { try { Promise.resolve(api.runtime.sendMessage({ tipo: 'parear-auto' })).then((r) => ok(!!(r && r.ok)), () => ok(false)); } catch (e) { ok(false); } });
async function testar(denovo) {
  if (!(await permissoesOk())) { $('permitir').hidden = false; return estado(T('Falta permitir o acesso (botão acima).', 'Access still needs to be allowed (button above).'), 'erro'); }
  $('permitir').hidden = true;
  const { token } = await api.storage.local.get('token');
  if (!token) { if (!denovo && (await pedirCodigo())) return testar(true); return estado(DICA()); }
  try {
    const r = await fetch(BASE + '/ping', { headers: { 'X-Aero-Token': token } });
    if (r.status === 401) { if (!denovo && (await pedirCodigo())) return testar(true); return estado(DICA(), 'erro'); }
    const j = await r.json();
    if (j.sites !== undefined) { try { await api.storage.local.set({ sites: j.sites || null }); } catch (e) { /* ok */ } }
    sites(j.sites);
    if (!j.ativo && !(j.sites && j.sites.on)) return estado(T('Conectado, mas a música e o "Assistindo agora" estão desligados no Aero.', 'Connected, but music and "Watching now" are off in Aero.'), 'erro');
    estado(T('✓ Conectado ao Aero.', '✓ Connected to Aero.'), 'ok');
  } catch (e) { estado(T('O Aero não está aberto neste computador.', 'Aero is not open on this computer.'), 'erro'); }
}

// o pedido de permissão precisa sair direto do clique (o Firefox recusa depois de um "await")
const pedir = () => { try { return Promise.resolve(api.permissions.request({ origins: ORIGENS })).catch(() => false); } catch (e) { return Promise.resolve(false); } };
$('salvar').addEventListener('click', () => {
  const v = $('codigo').value.trim();
  if (!/^[a-f0-9]{16,64}$/i.test(v)) return estado(T('Esse código não parece certo.', 'That code does not look right.'), 'erro');
  Promise.all([pedir(), api.storage.local.set({ token: v })]).then(() => testar(true), () => testar(true));
});
$('permitir').addEventListener('click', () => { pedir().then(() => testar()); });

// (1.1.0) os sites que a pessoa adicionou no Aero: cada um precisa ser permitido aqui uma vez (o navegador só deixa ler um site com
// permissão, e o pedido precisa sair de um clique nesta janelinha)
const DOM = /^(?=.{3,80}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const origensDe = (dom) => ['https://' + dom + '/*', 'https://*.' + dom + '/*'];
async function sites(s) {
  const caixa = $('sites'), lista = $('sites-lista');
  const meus = s && s.on === true ? (s.meus || []).filter((x) => x && x.on !== false && DOM.test(x.dom || '')) : [];
  caixa.hidden = !meus.length; lista.textContent = '';
  for (const x of meus) {
    let ok = false; try { ok = await api.permissions.contains({ origins: origensDe(x.dom) }); } catch (e) { /* ok */ }
    const li = document.createElement('li');
    const nome = document.createElement('span'); nome.textContent = (x.nome || x.dom) + ' (' + x.dom + ')';
    li.append(nome);
    if (ok) { const b = document.createElement('b'); b.className = 'ok'; b.textContent = T('✓ permitido', '✓ allowed'); li.append(b); }
    else {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = T('Permitir', 'Allow');
      b.addEventListener('click', () => { try { Promise.resolve(api.permissions.request({ origins: origensDe(x.dom) })).catch(() => false).then(() => sites(s)); } catch (e) { /* ok */ } });
      li.append(b);
    }
    lista.append(li);
  }
}
api.storage.local.get('token').then(({ token }) => { if (token) $('codigo').value = token; testar(); });
