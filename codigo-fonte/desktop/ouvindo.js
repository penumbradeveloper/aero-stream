// Aero Stream - "Ouvindo agora" (como o do Discord): descobre a música que está tocando neste computador para os amigos verem.
// - Linux: pelo MPRIS (o mesmo canal que os controles de mídia do sistema usam), com o gdbus. Pega o app do Spotify e as abas do
//   YouTube Music, do Deezer e do Spotify Web no Firefox/Zen/LibreWolf (o Firefox informa o endereço da aba).
// - Windows: pelos controles de mídia do Windows (GSMTC), com um PowerShell escondido que responde quando o app pergunta. Só o Spotify.
// - Navegadores (Chrome, Edge, Opera, Brave, Vivaldi e também os Firefox no Windows): pela extensão "Aero - Ouvindo agora", que manda
//   os dados para http://127.0.0.1:41783 com um código de pareamento (sem o código certo, nada é aceito; sites não conseguem mandar).
// Nada daqui vai para a internet, a não ser a busca da capa no iTunes quando o Windows não informa a capa. Criado por Ryan Victtor.
'use strict';
const { execFile, spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');

const PORTA = 41783;
// (1.0.0) links da extensão nas lojas: é só preencher quando ela for publicada (vazio = a página ensina a instalar pela pasta)
const LOJAS = { chrome: '', edge: '', opera: '', firefox: 'https://addons.mozilla.org/firefox/addon/aero-ouvindo-agora/' };
const FONTES = ['spotify', 'ytmusic', 'deezer'];

// ---------- leitor do texto do GVariant (a saída do gdbus) ----------
// Entende o que o MPRIS usa: dicionários, variantes <...>, listas, tuplas, textos, números, booleanos e prefixos de tipo (uint64, @as...).
function lerGVariant(s) {
  let i = 0;
  const esp = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const valor = () => {
    esp();
    const c = s[i];
    if (c === '(' || c === '[') {
      const fim = c === '(' ? ')' : ']'; i++; const l = [];
      for (;;) { esp(); if (s[i] === fim) { i++; return l; } if (s[i] === ',') { i++; continue; } if (i >= s.length) throw new Error('fim'); l.push(valor()); }
    }
    if (c === '{') {
      i++; const o = {};
      for (;;) {
        esp(); if (s[i] === '}') { i++; return o; } if (s[i] === ',') { i++; continue; } if (i >= s.length) throw new Error('fim');
        const k = valor(); esp(); if (s[i] !== ':') throw new Error('esperava :'); i++; o[String(k)] = valor();
      }
    }
    if (c === '<') { i++; const v = valor(); esp(); if (s[i] !== '>') throw new Error('esperava >'); i++; return v; }
    if (c === "'" || c === '"') {
      i++; let r = '';
      while (i < s.length && s[i] !== c) {
        if (s[i] === '\\') {
          const n = s[++i];
          if (n === 'u' || n === 'U') { const len = n === 'u' ? 4 : 8; r += String.fromCodePoint(parseInt(s.slice(i + 1, i + 1 + len), 16) || 0xfffd); i += len + 1; continue; }
          r += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', a: '\x07' }[n] || n; i++; continue;
        }
        r += s[i++];
      }
      i++; return r;
    }
    if (c === '@') { i++; while (i < s.length && !/\s/.test(s[i])) i++; return valor(); } // tipo de lista vazia: @as []
    const m = /^(?:(?:u?int(?:16|32|64)|byte|double|handle|objectpath|signature|boolean)\s+)?([^,\)\]\}>:\s]+)/.exec(s.slice(i));
    if (!m) throw new Error('valor inválido');
    i += m[0].length;
    const t = m[1];
    if (t === 'true') return true; if (t === 'false') return false; if (t === 'nothing') return null;
    if (/^[-+]?(\d+\.?\d*(e[-+]?\d+)?|\.\d+|inf|nan)$/i.test(t)) return Number(t);
    return t;
  };
  return valor();
}

// ---------- limpeza ----------
const texto = (v, max) => { if (Array.isArray(v)) v = v.filter(Boolean).join(', '); v = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim(); return v.slice(0, max); };
const HOSTS_CAPA = /^https:\/\/([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com|googleusercontent\.com|ytimg\.com|ggpht\.com|dzcdn\.net|mzstatic\.com)\/[^\s"'<>\\]{1,220}$/i;
const capaOk = (u) => (typeof u === 'string' && HOSTS_CAPA.test(u) ? u : '');
const ms = (v) => { v = Number(v); return Number.isFinite(v) && v > 0 ? Math.round(Math.min(v, 6 * 3600000)) : 0; }; // tudo em milissegundos (até 6 h)
const us = (v) => ms(Number(v) / 1000); // o MPRIS conta em microssegundos
// (1.0.0) o id da música em cada serviço (para "Ouvir junto" abrir a mesma música)
const ID_OK = { spotify: /^[A-Za-z0-9]{22}$/, ytmusic: /^[A-Za-z0-9_-]{11}$/, deezer: /^[0-9]{1,14}$/ };
const idOk = (f, id) => !!(ID_OK[f] && typeof id === 'string' && ID_OK[f].test(id));
// o endereço da página -> { id, k } (k 'ep' = episódio de podcast)
const infoUrl = (f, url) => {
  let u; try { u = new URL(String(url || '')); } catch (e) { return { id: '', k: '' }; }
  let id = '', k = '';
  if (f === 'ytmusic') id = u.searchParams.get('v') || '';
  else { const m = (f === 'deezer' ? /\/(track|episode)\/(\d+)/ : /^\/(?:intl-[a-z-]+\/)?(track|episode)\/([A-Za-z0-9]{22})/).exec(u.pathname); if (m) { id = m[2]; k = m[1] === 'episode' ? 'ep' : ''; } }
  return idOk(f, id) ? { id, k } : { id: '', k: '' };
};
const idDaUrl = (f, url) => infoUrl(f, url).id;
const linkDe = (f, id, k) => (f === 'spotify' ? (k === 'ep' ? 'spotify:episode:' : 'spotify:track:') + id : f === 'ytmusic' ? 'https://music.youtube.com/watch?v=' + id : 'https://www.deezer.com/' + (k === 'ep' ? 'episode/' : 'track/') + id);

// qual serviço é, pelo endereço da aba (o Firefox informa) ou pelo nome do tocador
function fonteDe(nome, url) {
  if (/\.spotify$/i.test(nome) || /^spotify/i.test(nome)) return 'spotify';
  let host = ''; try { host = new URL(url).hostname; } catch (e) { return null; }
  if (host === 'music.youtube.com') return 'ytmusic';
  if (host === 'deezer.com' || host.endsWith('.deezer.com')) return 'deezer';
  if (host === 'open.spotify.com') return 'spotify';
  return null;
}

// as propriedades de um tocador do MPRIS -> o formato do Aero (null = não é música que mostramos)
function deMpris(nome, props, agora = Date.now()) {
  if (!props || typeof props !== 'object') return null;
  const md = props.Metadata || {};
  const f = fonteDe(String(nome).replace(/^org\.mpris\.MediaPlayer2\./, ''), md['xesam:url']);
  if (!f) return null;
  const t = texto(md['xesam:title'], 100);
  if (!t) return null;
  let a = texto(md['xesam:artist'], 100);
  if (f === 'ytmusic') a = a.replace(/\s*-\s*Topic$/i, '');
  const tid = /^\/com\/spotify\/(track|episode)\/([A-Za-z0-9]{22})$/.exec(String(md['mpris:trackid'] || ''));
  const iu = tid ? { id: tid[2], k: tid[1] === 'episode' ? 'ep' : '' } : infoUrl(f, md['xesam:url']);
  if (!iu.k && /\/episode\//.test(String(md['xesam:url'] || ''))) iu.k = 'ep';
  if (iu.k === 'ep' && !a) a = texto(md['xesam:album'], 100); // podcast: o "artista" é o programa
  return {
    f, t, a, al: texto(md['xesam:album'], 100), img: capaOk(md['mpris:artUrl']), id: iu.id, k: iu.k,
    d: us(md['mpris:length']), p: us(props.Position), em: agora,
    tocando: props.PlaybackStatus === 'Playing',
  };
}

// o que vem do Windows (GSMTC) -> o formato do Aero. st: 4 = tocando, 5 = pausado
function deWindows(x, agora = Date.now()) {
  if (!x || !/spotify/i.test(String(x.app || ''))) return null;
  const t = texto(x.t, 100); if (!t) return null;
  const tocando = Number(x.st) === 4;
  let p = ms(x.p); const upd = Number(x.upd);
  if (tocando && upd > 1e12 && agora > upd) p += Math.min(agora - upd, 6 * 3600000); // o Windows só atualiza a posição de vez em quando
  const d = ms(x.d);
  return { f: 'spotify', t, a: texto(x.a, 100), al: texto(x.al, 100), img: '', id: '', d, p: d ? Math.min(p, d) : p, em: agora, tocando };
}

// o que a extensão manda -> o formato do Aero (nada confiável passa direto)
function daExtensao(x, agora = Date.now()) {
  if (!x || typeof x !== 'object' || !FONTES.includes(x.f)) return null;
  const t = texto(x.t, 100); if (!t) return null;
  const d = ms(Number(x.d) * 1000), p = Math.min(ms(Number(x.p) * 1000), d || Infinity);
  let a = texto(x.a, 100); if (x.f === 'ytmusic') a = a.replace(/\s*-\s*Topic$/i, '');
  return { f: x.f, t, a, al: texto(x.al, 100), img: capaOk(x.img), id: idOk(x.f, x.id) ? x.id : '', k: x.k === 'ep' ? 'ep' : '', d, p, em: agora, tocando: x.tocando === true };
}

// ---------- (1.0.0) Assistindo agora: Twitch, Kick, YouTube e os sites que a pessoa adicionou ----------
const FONTES_ASS = ['twitch', 'kick', 'youtube'];
const DOM_OK = /^(?=.{3,80}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const corOk = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '');
// a lista de sites que vem do app (aba Integrações > Assistindo agora): nada passa sem conferir
function limparSites(c) {
  if (!c || typeof c !== 'object') return { on: false, conhecidos: {}, meus: [] };
  const k = c.conhecidos && typeof c.conhecidos === 'object' ? c.conhecidos : {};
  const conhecidos = {}; for (const f of FONTES_ASS) conhecidos[f] = k[f] !== false;
  const meus = [], vistos = new Set();
  for (const x of Array.isArray(c.meus) ? c.meus.slice(0, 30) : []) {
    if (!x || typeof x !== 'object') continue;
    const dom = String(x.dom || '').toLowerCase().replace(/^www\./, '');
    const id = String(x.id || ''); if (!/^[a-z0-9]{4,16}$/.test(id) || !DOM_OK.test(dom) || vistos.has(id)) continue;
    vistos.add(id);
    meus.push({ id, dom, nome: texto(x.nome, 40) || dom, on: x.on !== false, quando: x.quando === 'aberta' ? 'aberta' : 'video',
      tit: ['og', 'aba', 'sel', 'nada'].includes(x.tit) ? x.tit : 'og', selT: texto(x.selT, 200), aut: ['og', 'sel', 'nada'].includes(x.aut) ? x.aut : 'nada', selA: texto(x.selA, 200),
      tirar: texto(x.tirar, 120), ic: texto(x.ic, 8), cor: corOk(x.cor), vb: texto(x.vb, 20) });
  }
  return { on: c.on === true, conhecidos, meus };
}
// o que vai para a extensão (o que ler em cada site); o ícone, a cor e o texto ficam no app
const sitesParaExt = (c) => ({ on: c.on, conhecidos: c.conhecidos, meus: c.meus.map(({ ic, cor, vb, ...r }) => r) });
const CANAL = { twitch: /^[a-z0-9_]{2,25}$/, kick: /^[a-z0-9_-]{2,30}$/ };
// o que a extensão manda -> o formato do Aero. Só sites ligados; os links e as imagens são montados aqui (nada vem pronto da página)
function daExtensaoAss(x, cfg, agora = Date.now()) {
  if (!x || typeof x !== 'object' || !cfg || cfg.on !== true) return null;
  const o = { f: '', t: texto(x.t, 100), a: texto(x.a, 80), c: '', s: '', ic: '', cor: '', vb: '', lk: '', img: '', id: '', live: x.live === true, d: 0, p: 0, em: agora, tocando: x.tocando !== false };
  if (FONTES_ASS.includes(x.f)) {
    if (cfg.conhecidos[x.f] === false) return null;
    o.f = x.f; o.c = texto(x.c, 60);
    if (x.f === 'youtube') {
      if (!ID_OK.ytmusic.test(String(x.id || ''))) return null;
      o.id = x.id; o.lk = 'https://www.youtube.com/watch?v=' + x.id; o.img = 'https://i.ytimg.com/vi/' + x.id + '/mqdefault.jpg';
    } else {
      const c = String(x.canal || '').toLowerCase(); if (!CANAL[x.f].test(c)) return null;
      o.lk = (x.f === 'twitch' ? 'https://www.twitch.tv/' : 'https://kick.com/') + c;
      if (x.f === 'twitch' && o.live) o.img = 'https://static-cdn.jtvnw.net/previews-ttv/live_user_' + c + '-320x180.jpg';
    }
  } else if (x.f === 'site') {
    const s = cfg.meus.find((y) => y.id === x.sid && y.on); if (!s) return null;
    Object.assign(o, { f: 'site', s: s.nome, ic: s.ic, cor: s.cor, vb: s.vb, lk: 'https://' + s.dom + '/', live: false });
  } else return null;
  if (!o.t && o.f === 'site') o.t = o.s; // "Título: nenhum": mostra só o nome do site
  if (!o.t && !o.a) return null;
  if (!o.t) { o.t = o.a; o.a = ''; }
  if (!o.live) { o.d = ms(Number(x.d) * 1000); o.p = Math.min(ms(Number(x.p) * 1000), o.d || 0); }
  return o;
}

// vários tocadores ao mesmo tempo: o que está tocando vence; entre os que tocam, o app do Spotify primeiro
function escolher(lista) {
  const ok = lista.filter(Boolean);
  const peso = (x) => (x.tocando ? 10 : 0) + (x.f === 'spotify' ? 1 : 0);
  return ok.sort((a, b) => peso(b) - peso(a))[0] || null;
}

// ---------- o módulo ----------
function criarOuvindo({ log = () => {}, lerToken = () => '', plataforma = process.platform, gdbus = 'gdbus', fetchCapa = globalThis.fetch, porta = PORTA, lojas = LOJAS, abrirPasta = null, aoMudar = null, aoVerExtensao = null, dbusMonitor = 'dbus-monitor', abrirExterno = null } = {}) {
  let extVisto = 0, parearAte = 0; const convites = new Map(); // código de uma vez (na página de instalar) -> quando foi criado
  let ativo = false, servidor = null, ps = null, psFila = [], psBuf = '', psFalhas = 0;
  let daExt = null; // { dados, visto }
  let sitesCfg = limparSites(null), daAss = null; // (1.0.0) Assistindo agora: a lista de sites do app e o que a extensão mandou
  const capas = new Map();

  const rodar = (args) => new Promise((ok) => execFile(gdbus, args, { timeout: 2500, maxBuffer: 1 << 20, windowsHide: true }, (e, out) => ok(e ? '' : String(out))));
  async function lerLinux() {
    const nomes = await rodar(['call', '--session', '--dest', 'org.freedesktop.DBus', '--object-path', '/org/freedesktop/DBus', '--method', 'org.freedesktop.DBus.ListNames']);
    const lista = (nomes.match(/'org\.mpris\.MediaPlayer2\.[^']+'/g) || []).map((x) => x.slice(1, -1)).slice(0, 12);
    const r = await Promise.all(lista.map(async (n) => {
      const out = await rodar(['call', '--session', '--dest', n, '--object-path', '/org/mpris/MediaPlayer2', '--method', 'org.freedesktop.DBus.Properties.GetAll', 'org.mpris.MediaPlayer2.Player']);
      if (!out) return null;
      try { const v = lerGVariant(out.trim()); return deMpris(n, Array.isArray(v) ? v[0] : v); } catch (e) { return null; }
    }));
    return r;
  }

  // Linux: o aviso na hora (o player avisa pelo D-Bus quando pausa, volta ou troca de música; sem esperar a próxima olhada)
  let mon = null, monFalhas = 0, monT = 0;
  const avisar = () => { if (!aoMudar || monT) return; monT = setTimeout(() => { monT = 0; try { aoMudar(); } catch (e) { /* ok */ } }, 120); };
  function vigiarLinux() {
    if (mon || plataforma !== 'linux' || !aoMudar || monFalhas > 3) return;
    try {
      mon = spawn(dbusMonitor, ['--session', '--monitor', "type='signal',interface='org.freedesktop.DBus.Properties',member='PropertiesChanged',path='/org/mpris/MediaPlayer2'"], { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { mon = null; monFalhas++; return; }
    const este = mon;
    este.stdout.setEncoding('utf8');
    este.stdout.on('data', (d) => { if (/PlaybackStatus|Metadata/.test(d)) avisar(); });
    este.on('error', () => { monFalhas = 9; }); // sem o dbus-monitor: fica só nas olhadas de sempre
    este.on('exit', () => { if (mon !== este) return; mon = null; monFalhas++; if (ativo) setTimeout(vigiarLinux, 5000); });
  }
  const pararVigia = () => { if (mon) { const m = mon; mon = null; try { m.kill(); } catch (e) { /* ok */ } } };

  // Windows: um PowerShell escondido que fica aberto e responde uma linha de JSON a cada pedido (morre junto com o app)
  const SCRIPT_WIN = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'})[0]
function Esperar($op,$tipo){$t=$asTask.MakeGenericMethod($tipo).Invoke($null,@($op));$t.Wait(3000)|Out-Null;$t.Result}
$tm=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$tp=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
$mgr=Esperar ($tm::RequestAsync()) $tm
while($true){
  $l=[Console]::In.ReadLine(); if($l -eq $null){break}
  if($l.StartsWith('{')){ try{ $c=$l|ConvertFrom-Json; foreach($s in $mgr.GetSessions()){ if($s.SourceAppUserModelId -notmatch 'spotify'){continue}
    if($c.op -eq 'seek'){$null=$s.TryChangePlaybackPositionAsync([int64]$c.ms*10000)}elseif($c.op -eq 'play'){$null=$s.TryPlayAsync()}elseif($c.op -eq 'pause'){$null=$s.TryPauseAsync()} } }catch{} }
  $out=@()
  try{ foreach($s in $mgr.GetSessions()){
    $app=$s.SourceAppUserModelId; if($app -notmatch 'spotify'){continue}
    $p=Esperar ($s.TryGetMediaPropertiesAsync()) $tp; $tl=$s.GetTimelineProperties(); $pb=$s.GetPlaybackInfo()
    $out+=[pscustomobject]@{app=$app;t=$p.Title;a=$p.Artist;al=$p.AlbumTitle;d=[int64]$tl.EndTime.TotalMilliseconds;p=[int64]$tl.Position.TotalMilliseconds;upd=$tl.LastUpdatedTime.ToUnixTimeMilliseconds();st=[int]$pb.PlaybackStatus}
  } }catch{}
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject @($out)))
  [Console]::Out.Flush()
}`;
  function abrirPs() {
    if (ps || psFalhas > 3) return ps;
    try {
      const cod = Buffer.from(SCRIPT_WIN, 'utf16le').toString('base64');
      ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', cod], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
      psBuf = '';
      ps.stdout.setEncoding('utf8');
      ps.stdout.on('data', (d) => {
        psBuf += d; let n;
        while ((n = psBuf.indexOf('\n')) >= 0) { const linha = psBuf.slice(0, n).trim(); psBuf = psBuf.slice(n + 1); const cb = psFila.shift(); if (cb) { try { cb(JSON.parse(linha)); } catch (e) { cb(null); } } }
      });
      const morreu = () => { if (!ps) return; ps = null; psFalhas++; psFila.splice(0).forEach((cb) => cb(null)); };
      ps.on('exit', morreu); ps.on('error', (e) => { log('ouvindo: powershell', e.message); morreu(); });
      ps.stdin.on('error', () => {});
    } catch (e) { log('ouvindo: powershell', e.message); ps = null; psFalhas++; }
    return ps;
  }
  function lerWindows(cmd) {
    return new Promise((ok) => {
      const p = abrirPs(); if (!p) return ok([]);
      let feito = false; const fim = (v) => { if (!feito) { feito = true; ok(Array.isArray(v) ? v.map((x) => deWindows(x)) : v && typeof v === 'object' ? [deWindows(v)] : []); } };
      psFila.push(fim); setTimeout(() => { const i = psFila.indexOf(fim); if (i >= 0) psFila.splice(i, 1); fim(null); }, 6000);
      try { p.stdin.write((cmd ? JSON.stringify(cmd) : '') + '\n'); } catch (e) { fim(null); }
    });
  }

  // capa que o Windows não informa: busca no iTunes pelo artista e título (só o nome da música sai do computador)
  async function capaDe(x) {
    if (!x || x.img || !fetchCapa) return x;
    const k = (x.a + '|' + x.t).toLowerCase();
    if (capas.has(k)) { const v = capas.get(k); if (typeof v === 'string') x.img = v; return x; }
    capas.set(k, null); if (capas.size > 200) capas.delete(capas.keys().next().value);
    try {
      const r = await fetchCapa('https://itunes.apple.com/search?media=music&entity=song&limit=1&term=' + encodeURIComponent((x.a + ' ' + x.t).slice(0, 150)), { signal: AbortSignal.timeout(5000) });
      const j = await r.json(); const u = j && j.results && j.results[0] && j.results[0].artworkUrl100;
      const img = capaOk(typeof u === 'string' ? u.replace(/\/\d+x\d+bb\./, '/300x300bb.') : '');
      capas.set(k, img); x.img = img;
    } catch (e) { capas.delete(k); }
    return x;
  }

  // ---------- (1.0.0) "Ouvir junto": tocar a música de um amigo aqui (no Spotify do PC ou no navegador) ----------
  let cmdExt = null, seqExt = 0; // o pedido que a extensão do navegador busca (na resposta de cada aviso dela)
  const SP = 'org.mpris.MediaPlayer2.spotify';
  const spChamar = (m, ...a) => rodar(['call', '--session', '--dest', SP, '--object-path', '/org/mpris/MediaPlayer2', '--method', 'org.mpris.MediaPlayer2.Player.' + m, ...a]);
  const spEstado = async () => { const out = await rodar(['call', '--session', '--dest', SP, '--object-path', '/org/mpris/MediaPlayer2', '--method', 'org.freedesktop.DBus.Properties.GetAll', 'org.mpris.MediaPlayer2.Player']); if (!out) return null; try { const v = lerGVariant(out.trim()); return deMpris(SP, Array.isArray(v) ? v[0] : v); } catch (e) { return null; } };
  const espera = (t) => new Promise((r) => setTimeout(r, t));
  const abrir = (u) => { if (!abrirExterno) return false; try { abrirExterno(u); return true; } catch (e) { return false; } };
  async function spotifyLinux(c, p, tocar) {
    let e = await spEstado();
    if (!e) return { ok: tocar ? abrir(linkDe('spotify', c.id, c.k)) : true, abriu: tocar }; // o Spotify está fechado: abre na música (a próxima olhada acerta o tempo)
    if (e.id !== c.id) {
      if (!tocar) return { ok: true };
      await spChamar('OpenUri', `'${linkDe('spotify', c.id, c.k)}'`);
      for (let i = 0; i < 15 && (!e || e.id !== c.id); i++) { await espera(200); e = await spEstado(); }
      if (!e || e.id !== c.id) return { ok: false, erro: 'nao-abriu' };
      if (p > 2500) await spChamar('SetPosition', `objectpath '/com/spotify/${c.k === 'ep' ? 'episode' : 'track'}/${c.id}'`, `int64 ${p * 1000}`);
      return { ok: true, trocou: true };
    }
    if (!tocar) { if (e.tocando) await spChamar('Pause'); return { ok: true }; }
    if (Math.abs(e.p - p) > 2500) await spChamar('SetPosition', `objectpath '/com/spotify/${c.k === 'ep' ? 'episode' : 'track'}/${c.id}'`, `int64 ${p * 1000}`);
    if (!e.tocando) await spChamar('Play');
    return { ok: true };
  }
  // Windows: o GSMTC não diz o id da música, então compara pelo nome; trocar de música é pelo link spotify:track:
  async function spotifyWindows(c, p, tocar) {
    const e = (await lerWindows()).filter(Boolean)[0];
    const mesma = e && c.t && e.t.toLowerCase() === String(c.t).toLowerCase();
    if (!mesma) { if (!tocar) return { ok: true }; return { ok: abrir(linkDe('spotify', c.id, c.k)), abriu: true }; }
    if (!tocar) { if (e.tocando) await lerWindows({ op: 'pause' }); return { ok: true }; }
    if (Math.abs(e.p - p) > 2500) await lerWindows({ op: 'seek', ms: p });
    if (!e.tocando) await lerWindows({ op: 'play' });
    return { ok: true };
  }
  // navegador: pela extensão (ela troca a música e acerta o tempo na aba); sem aba aberta, abre o link no navegador padrão
  function navegador(c, p, tocar) {
    const agora = Date.now(), fresca = daExt && agora - daExt.visto < 9000;
    cmdExt = { seq: ++seqExt, f: c.f, id: c.id, k: c.k === 'ep' ? 'ep' : '', url: linkDe(c.f, c.id, c.k), p, tocando: tocar, em: agora };
    if (tocar && !(fresca && daExt.dados.f === c.f)) return { ok: abrir(cmdExt.url), abriu: true };
    return { ok: true, extensao: true };
  }

  // a ponte fica aberta enquanto a música ou o Assistindo agora estiverem ligados (o convite também abre)
  function abrirOuFechar() { if (ativo || sitesCfg.on) abrirServidor(); }
  // ---------- a ponte da extensão do navegador (só neste computador) ----------
  const conviteOk = (c) => { if (!/^[a-f0-9]{32}$/.test(c) || !convites.has(c)) return false; if (Date.now() - convites.get(c) > 30 * 60000) { convites.delete(c); return false; } return true; };
  function abrirServidor() {
    if (servidor) return;
    const s = http.createServer((req, res) => {
      const origem = String(req.headers.origin || '');
      const mesmo = !origem || origem === 'http://127.0.0.1:' + porta; // a própria página de instalar
      const deExtensao = /^(chrome-extension|moz-extension|safari-web-extension|extension):\/\/[A-Za-z0-9._-]+$/.test(origem);
      const cab = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
      if (deExtensao) Object.assign(cab, { 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Headers': 'content-type, x-aero-token', 'Access-Control-Allow-Methods': 'GET, POST', Vary: 'Origin' });
      const fim = (cod, obj) => { res.writeHead(cod, cab); res.end(cod === 204 ? '' : JSON.stringify(obj || {})); };
      // só pelo endereço 127.0.0.1 (um site que aponta o próprio nome para cá não passa)
      if (String(req.headers.host || '') !== '127.0.0.1:' + porta) return fim(403, { erro: 'host' });
      const u = new URL(req.url, 'http://127.0.0.1');
      // a página de instalar (aberta pelo próprio Aero no navegador padrão, com um código de uma vez só)
      const conv = u.searchParams.get('c') || '', convOk = conviteOk(conv);
      if (req.method === 'GET' && mesmo && u.pathname === '/instalar') {
        if (!convOk) { res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(paginaVencida(req.headers['accept-language'])); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'" });
        return res.end(paginaInstalar({ token: String(lerToken() || ''), conv, lojas, pasta: !!abrirPasta, idioma: req.headers['accept-language'] }));
      }
      if (req.method === 'GET' && mesmo && u.pathname === '/par-estado') return fim(convOk ? 200 : 410, { pareado: convOk && extVisto >= convites.get(conv) });
      if (req.method === 'POST' && mesmo && u.pathname === '/abrir-pasta') { if (!convOk || !abrirPasta) return fim(403, { erro: 'codigo' }); try { abrirPasta(); } catch (e) { /* ok */ } return fim(200, { ok: true }); }
      // sites não passam (só extensões); e sem o código de pareamento certo, nada
      if (origem && !deExtensao) return fim(403, { erro: 'origem' });
      if (req.method === 'OPTIONS') return fim(204);
      // (1.0.6) pareamento automático: logo depois de a pessoa clicar em "Instalar ou conectar" no Aero, a extensão já instalada pega o
      // código sozinha (sem copiar nada). Fora dessa janela de 10 min, ou depois que ela se conecta, nada sai daqui
      if (req.method === 'GET' && deExtensao && u.pathname === '/parear') return Date.now() < parearAte && String(lerToken() || '').length >= 16 ? fim(200, { token: String(lerToken()) }) : fim(403, { erro: 'fechado' });
      const tok = String(req.headers['x-aero-token'] || ''), certo = String(lerToken() || '');
      const igual = tok.length === certo.length && certo.length >= 16 && crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(certo));
      if (!igual) return fim(401, { erro: 'codigo' });
      if (!extVisto && aoVerExtensao) { try { aoVerExtensao(); } catch (e) { /* ok */ } }
      extVisto = Date.now(); parearAte = 0; // a extensão está instalada e pareada
      if (req.method === 'GET' && req.url === '/ping') return fim(200, { ok: true, app: 'aero', ativo, sites: sitesParaExt(sitesCfg), cmd: cmdExt && Date.now() - cmdExt.em < 30000 ? cmdExt : undefined });
      if (req.method !== 'POST' || req.url !== '/ouvindo') return fim(404, { erro: 'rota' });
      let corpo = '';
      req.setEncoding('utf8');
      req.on('data', (d) => { corpo += d; if (corpo.length > 8192) req.destroy(); });
      req.on('end', () => {
        let j; try { j = JSON.parse(corpo); } catch (e) { return fim(400, { erro: 'json' }); }
        const x = ativo && j && j.ouv ? daExtensao(j.ouv) : null;
        const antes = daExt && daExt.dados;
        daExt = x ? { dados: x, visto: Date.now() } : null;
        let mudou = !antes !== !x || (antes && x && (antes.tocando !== x.tocando || antes.t !== x.t)); // pausou, voltou ou trocou: o app olha na hora
        if (j && typeof j === 'object' && 'ass' in j) { // (1.0.0) o vídeo (extensão 1.1.0+)
          const y = daExtensaoAss(j.ass, sitesCfg), a0 = daAss && daAss.dados;
          daAss = y ? { dados: y, visto: Date.now() } : null;
          if (!a0 !== !y || (a0 && y && (a0.tocando !== y.tocando || a0.t !== y.t || a0.a !== y.a))) mudou = true;
        }
        if (mudou) avisar();
        fim(200, { ok: true, ativo, sites: sitesParaExt(sitesCfg), cmd: cmdExt && Date.now() - cmdExt.em < 30000 ? cmdExt : undefined });
      });
    });
    s.on('error', (e) => { log('ouvindo: porta ' + porta + ' ocupada ou recusada (' + e.code + '); a extensão do navegador não vai funcionar'); servidor = null; });
    s.listen(porta, '127.0.0.1', () => log('ouvindo: esperando a extensão do navegador em 127.0.0.1:' + porta));
    servidor = s;
  }

  return {
    ligar(v) {
      ativo = !!v;
      if (ativo) { abrirServidor(); vigiarLinux(); }
      else { daExt = null; pararVigia(); if (ps) { try { ps.stdin.end(); ps.kill(); } catch (e) { /* ok */ } ps = null; } }
      return ativo;
    },
    async agora() {
      if (!ativo) return null;
      const agora = Date.now();
      let lista = [];
      try { lista = plataforma === 'linux' ? await lerLinux() : plataforma === 'win32' ? await lerWindows() : []; } catch (e) { lista = []; }
      if (daExt && agora - daExt.visto < 9000) { const x = { ...daExt.dados }; if (x.tocando) { x.p = Math.min(x.p + (agora - x.em), x.d || Infinity); } x.em = agora; lista.push(x); }
      const x = escolher(lista);
      if (x && x.tocando && !x.img) await capaDe(x);
      return x;
    },
    porta: () => porta,
    // (1.0.0) Assistindo agora: a lista de sites (do app) e o vídeo que está passando no navegador (some 9 s depois do último aviso)
    assistir(c) { sitesCfg = limparSites(c); if (!sitesCfg.on) daAss = null; abrirOuFechar(); return sitesParaExt(sitesCfg); },
    assistindo() {
      if (!sitesCfg.on || !daAss || Date.now() - daAss.visto > 9000) return null;
      const agora = Date.now(), x = { ...daAss.dados };
      if (x.tocando && x.d) x.p = Math.min(x.p + (agora - x.em), x.d);
      x.em = agora; return x;
    },
    // (1.0.0) "Ouvir junto": c = { f, id, p (ms), tocando, t } (a música do amigo e onde ela está agora)
    async tocar(c) {
      if (!c || !FONTES.includes(c.f) || !idOk(c.f, c.id)) return { ok: false, erro: 'dados' };
      const p = ms(c.p), tocar = c.tocando !== false;
      try {
        if (c.f !== 'spotify') return navegador(c, p, tocar);
        if (plataforma === 'linux') return await spotifyLinux(c, p, tocar);
        if (plataforma === 'win32') return await spotifyWindows(c, p, tocar);
        return { ok: tocar ? abrir(linkDe('spotify', c.id, c.k)) : true };
      } catch (e) { log('ouvindo: tocar', e && e.message); return { ok: false, erro: 'falhou' }; }
    },
    // (1.0.0) o endereço da página de instalar a extensão (o app abre no navegador padrão); vale 30 min
    convite() { abrirServidor(); parearAte = Date.now() + 10 * 60000; const c = crypto.randomBytes(16).toString('hex'); convites.set(c, Date.now()); for (const [k, t] of convites) if (Date.now() - t > 30 * 60000) convites.delete(k); return 'http://127.0.0.1:' + porta + '/instalar?c=' + c; },
    extensao: () => ({ visto: extVisto, conectada: Date.now() - extVisto < 150000, pareando: Date.now() < parearAte }),
    parar() { ativo = false; pararVigia(); if (servidor) { try { servidor.close(); } catch (e) { /* ok */ } servidor = null; } if (ps) { try { ps.stdin.end(); ps.kill(); } catch (e) { /* ok */ } ps = null; } },
  };
}

// ---------- a página de instalar (no navegador padrão da pessoa) ----------
const ehEn = (al) => !/^\s*pt/i.test(String(al || 'pt'));
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ESTILO = `:root{color-scheme:light dark;--bg:#eaf4fb;--card:#fff;--txt:#15232d;--suave:#5b6b77;--ac:#2d9ee0;--ok:#1f9d55;--borda:#d3e1ea}
@media (prefers-color-scheme:dark){:root{--bg:#0f1820;--card:#17232e;--txt:#e8f1f7;--suave:#9fb1bf;--borda:#2a3a48}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--txt);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:100%;max-width:480px;background:var(--card);border:1px solid var(--borda);border-radius:20px;padding:28px 24px;box-shadow:0 10px 40px rgba(0,0,0,.12);text-align:center}
h1{font-size:21px;margin:8px 0 6px}p{margin:0 0 14px;color:var(--suave)}.nota{font-size:28px}
.bt{display:inline-block;margin:6px 0 4px;padding:12px 22px;border:0;border-radius:999px;background:var(--ac);color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.bt.sec{background:transparent;color:var(--ac);border:1px solid var(--ac)}ol{text-align:left;margin:0 0 14px;padding-left:22px;color:var(--suave)}li{margin:4px 0}code{background:rgba(127,127,127,.15);padding:1px 6px;border-radius:6px}
#ok{display:none}#ok h1{color:var(--ok)}html[data-pareado] #ok{display:block}html[data-pareado] #passos{display:none}[hidden]{display:none}`;
function paginaVencida(al) {
  const en = ehEn(al);
  return `<!doctype html><html lang="${en ? 'en' : 'pt-BR'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aero</title><style>${ESTILO}</style></head><body><main><div class="nota">♫</div><h1>${en ? 'This link has expired' : 'Este link venceu'}</h1><p>${en ? 'In Aero, go to Settings > Privacy and click "Install in the browser" again.' : 'No Aero, vá em Configurações > Privacidade e clique em "Instalar no navegador" de novo.'}</p></main></body></html>`;
}
function paginaInstalar({ token, conv, lojas = {}, pasta = false, idioma }) {
  const en = ehEn(idioma), T = (pt, e) => (en ? e : pt);
  const dados = JSON.stringify({ lojas, conv, pasta }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${en ? 'en' : 'pt-BR'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="aero-par" content="${esc(token)}"><title>${T('Aero - Ouvindo agora', 'Aero - Now playing')}</title><style>${ESTILO}</style></head><body><main>
<div class="nota">♫</div>
<div id="passos"><h1>${T('Mostre aos amigos o que você ouve', 'Show friends what you listen to')}</h1>
<p>${T('Instale a extensão do Aero neste navegador para os seus amigos verem a música do YouTube Music e do Deezer. Ela se conecta sozinha.', 'Install the Aero extension in this browser so your friends see your YouTube Music and Deezer songs. It connects by itself.')}</p>
<a id="loja" class="bt" target="_blank" rel="noopener" hidden></a><p id="dica-loja" hidden style="margin-top:10px;font-size:13px"></p>
<div id="manual" hidden><p id="manual-tit" hidden style="margin-top:16px;font-weight:600;color:var(--txt)"></p><ol id="manual-passos"></ol>${pasta ? `<button id="pasta" class="bt sec" type="button">${T('Abrir a pasta da extensão', 'Open the extension folder')}</button>` : ''}</div>
<p style="margin-top:14px;font-size:13px">${T('Depois de instalar, volte para esta aba: ela confirma sozinha.', 'After installing, come back to this tab: it confirms by itself.')}</p>
<p style="font-size:13px">${T('Já tem a extensão? Ela se conecta sozinha em até 1 minuto (ou clique no botão do Aero na barra do navegador).', 'Already have the extension? It connects by itself within 1 minute (or click the Aero button in the browser toolbar).')}</p></div>
<div id="ok"><h1>✓ ${T('Pronto!', 'All set!')}</h1><p>${T('A extensão está conectada ao Aero. Pode fechar esta aba.', 'The extension is connected to Aero. You can close this tab.')}</p></div>
<script>(() => {
const D = ${dados}, en = ${en}, T = (a, b) => en ? b : a, ua = navigator.userAgent;
const nav = ua.includes('Firefox/') ? 'firefox' : ua.includes('Edg/') ? 'edge' : ua.includes('OPR/') ? 'opera' : 'chrome';
const nome = { firefox: 'Firefox', edge: 'Edge', opera: 'Opera', chrome: navigator.brave ? 'Brave' : 'Chrome' }[nav];
const link = D.lojas[nav] || (nav !== 'firefox' ? D.lojas.chrome : '');
if (link && link.startsWith('https://')) { const a = document.getElementById('loja'); a.href = link; a.textContent = T('Instalar no ', 'Install in ') + nome; a.hidden = false;
  const d = document.getElementById('dica-loja'); d.textContent = T('Na página que abrir, clique em "Adicionar ao ' + nome + '" e confirme. Se pedir, permita o acesso aos sites.', 'On the page that opens, click "Add to ' + nome + '" and confirm. If asked, allow access to the sites.'); d.hidden = false; }
// (1.0.2) sem loja, ou no Firefox (a extensão pode ainda não ter sido liberada lá): o jeito tradicional, pela pasta da extensão
if (!(link && link.startsWith('https://')) || nav === 'firefox') {
  if (link && link.startsWith('https://')) { const t = document.getElementById('manual-tit'); t.textContent = T('A loja não abriu ou não achou a extensão? Instale do jeito tradicional:', 'Store did not open or could not find the extension? Install it the traditional way:'); t.hidden = false; }
  const l = nav === 'firefox'
    ? [T('Clique em "Abrir a pasta da extensão" abaixo.', 'Click "Open the extension folder" below.'), T('Digite <code>about:debugging#/runtime/this-firefox</code> na barra de endereço.', 'Type <code>about:debugging#/runtime/this-firefox</code> in the address bar.'), T('Clique em "Carregar extensão temporária" e escolha o arquivo <code>manifest.json</code> da pasta.', 'Click "Load Temporary Add-on" and pick the <code>manifest.json</code> file from the folder.'), T('Volte para esta aba. (Carregada assim, o Firefox tira a extensão quando ele fecha: é só repetir estes passos depois.)', 'Come back to this tab. (Loaded this way, Firefox removes the extension when it closes: just repeat these steps later.)')]
    : [T('Clique em "Abrir a pasta da extensão" abaixo.', 'Click "Open the extension folder" below.'), T('Digite <code>' + (nav === 'edge' ? 'edge' : nav === 'opera' ? 'opera' : 'chrome') + '://extensions</code> na barra de endereço e ligue o "Modo do desenvolvedor".', 'Type <code>' + (nav === 'edge' ? 'edge' : nav === 'opera' ? 'opera' : 'chrome') + '://extensions</code> in the address bar and turn on "Developer mode".'), T('Arraste a pasta da extensão para dentro dessa página (ou use "Carregar sem compactação").', 'Drag the extension folder into that page (or use "Load unpacked").'), T('Volte para esta aba.', 'Come back to this tab.')];
  document.getElementById('manual-passos').innerHTML = l.map((x) => '<li>' + x + '</li>').join('');
  document.getElementById('manual').hidden = false;
  const b = document.getElementById('pasta'); if (b) b.onclick = () => fetch('/abrir-pasta?c=' + D.conv, { method: 'POST' }).catch(() => {});
}
const ver = () => { if (document.documentElement.dataset.pareado !== undefined) return; fetch('/par-estado?c=' + D.conv, { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.pareado) document.documentElement.dataset.pareado = ''; }).catch(() => {}); };
setInterval(ver, 1500); ver();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.documentElement.dataset.pareado === undefined && !document.documentElement.dataset.extensao) location.reload(); });
})();</script></main></body></html>`;
}

module.exports = { limparSites, sitesParaExt, daExtensaoAss, paginaInstalar, LOJAS, idOk, idDaUrl, infoUrl, linkDe, criarOuvindo, lerGVariant, deMpris, deWindows, daExtensao, escolher, fonteDe, capaOk, PORTA };
