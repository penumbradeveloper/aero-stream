// Aero Stream - (1.0.0) "Atividade de jogo": o que a pessoa está jogando agora, para os amigos verem ("Jogando Red Dead Redemption 2",
// o ícone, os detalhes e o tempo). Junta quatro fontes, nesta ordem:
//  1) a atividade personalizada que a pessoa marcou "acima do jogo";
//  2) o que o próprio jogo manda (pelo SDK do Aero ou pelo canal do Discord, ponte-rpc.js): detalhes, estado, ícones, grupo, tempo;
//  3) a atividade personalizada ligada a um app ou processo que está aberto;
//  4) a detecção automática: os processos abertos comparados com a lista pública de jogos do Discord (/api/applications/detectable,
//     a mesma que ele usa) e com uma lista de emuladores (com o nome do jogo tirado do arquivo da ROM).
// Só o resultado (o jogo escolhido) sai daqui; a lista de processos nunca vai para a internet. Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const URL_LISTA = 'https://discord.com/api/v9/applications/detectable';
const SEMANA = 7 * 24 * 3600000;
const VARRER_MS = process.platform === 'win32' ? 2000 : 1000; // quase na hora: abrir ou fechar um jogo aparece para os amigos em 1 ou 2 s

// ---------- a lista do Discord ----------
// [[id, nome, ícone, executáveis ("nome" ou "nome\targumentos"), apelidos]]
function compactar(bruta) {
  const out = [];
  for (const a of Array.isArray(bruta) ? bruta : []) {
    if (!a || !/^\d{15,25}$/.test(String(a.id || '')) || typeof a.name !== 'string') continue;
    const ex = (a.executables || []).filter((e) => e && !e.is_launcher && (e.os === 'win32' || e.os === 'linux') && typeof e.name === 'string' && e.name.length <= 160)
      .map((e) => e.name.toLowerCase() + (e.arguments ? '\t' + String(e.arguments).slice(0, 80) : ''));
    if (!ex.length) continue;
    out.push([String(a.id), a.name.slice(0, 128), /^[a-f0-9]{32}$/.test(a.icon_hash || '') ? a.icon_hash : '', [...new Set(ex)], (a.aliases || []).filter((x) => typeof x === 'string').slice(0, 4).map((x) => x.slice(0, 64))]);
  }
  return out;
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const sigla = (s) => String(s || '').replace(/[:\-–—]/g, ' ').split(/\s+/).filter(Boolean).map((p) => (/^\d+$/.test(p) || /^[IVX]+$/.test(p) ? (/^\d+$/.test(p) ? p : String(['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].indexOf(p))) : p[0])).join('').toLowerCase();

const siglaLetras = (s) => String(s || '').replace(/[:\-–—]/g, ' ').split(/\s+/).filter(Boolean).map((p) => (/^\d+$/.test(p) || /^[IVX]+$/.test(p) ? p : p[0])).join('').toLowerCase(); // "GTA V" também
function criarBase(apps) {
  const porExe = new Map(), porId = new Map(), porNome = new Map(), porBase = new Map(), todos = [];
  for (const [id, n, ic, exes, al] of apps || []) {
    const app = { id, n, ic, exes: exes.map((e) => { const [nome, args] = e.split('\t'); return { nome, args: args || '' }; }), al: al || [] };
    todos.push(app); porId.set(id, app);
    for (const e of app.exes) {
      const k = e.nome.startsWith('>') ? e.nome.slice(1) : e.nome; if (!porExe.has(k)) porExe.set(k, []); porExe.get(k).push(app);
      const b = k.split('/').pop(); const l = porBase.get(b); if (!l) porBase.set(b, e.args ? null : app); else if (l !== app) porBase.set(b, null); // null: o nome é de mais de um jogo
    }
    for (const nm of [n, ...app.al]) { const k = norm(nm); if (k.length >= 3 && !porNome.has(k)) porNome.set(k, app); }
  }
  return { porExe, porId, porNome, porBase, todos };
}

// as formas de comparar um caminho (igual ao Discord: o fim do caminho, com e sem "64"/"x64")
function formas(caminho) {
  const partes = String(caminho || '').toLowerCase().replace(/\\/g, '/').split('/');
  if (/^[a-z]:$/.test(partes[0]) || partes[0] === '') partes.shift();
  const l = [];
  for (let i = 1; i <= partes.length; i++) l.push(partes.slice(-i).join('/'));
  const base = l.slice();
  for (const p of base) for (const [a, b] of [['64', ''], ['.x64', ''], ['x64', ''], ['_64', '']]) { const q = p.replace(a, b); if (q !== p) l.push(q); }
  return l;
}
// clientes nativos do Linux que rodam um jogo da lista com outro nome de programa (o Sober é o Roblox no Linux, pelo Flatpak)
const CLIENTES_LINUX = { sober: '363445589247131668' };
function casar(base, caminho, args = []) {
  if (!base || !caminho) return null;
  const cli = CLIENTES_LINUX[path.posix.basename(String(caminho)).toLowerCase()];
  if (cli && base.porId && base.porId.get(cli)) return base.porId.get(cli);
  const fs0 = formas(caminho), junto = args.join(' ');
  for (const f of fs0) {
    const apps = base.porExe.get(f); if (!apps) continue;
    for (const app of apps) {
      const e = app.exes.find((x) => (x.nome.startsWith('>') ? x.nome.slice(1) === fs0[0] : x.nome === f));
      if (!e) continue;
      if (e.args && !junto.includes(e.args)) continue;
      return app;
    }
  }
  // Sem o caminho completo (o Windows esconde o caminho dos jogos com anti-cheat) ou numa pasta diferente: pelo nome do executável, se
  // ele for de um jogo só e não for genérico ("game.exe", "launcher.exe"...). No Linux o jogo nativo não tem ".exe": tenta com ele.
  const c = String(caminho).replace(/\\/g, '/');
  const b = path.posix.basename(c).toLowerCase();
  for (const k of /\.exe$/.test(b) ? [b] : [b, b + '.exe']) {
    const app = base.porBase.get(k);
    if (app && k.length >= 7 && !GENERICOS.test(k)) return app;
  }
  // Linux: jogo nativo da Steam, pelo nome da pasta do jogo
  const m = /\/steamapps\/common\/([^/]+)\//i.exec(c);
  if (m) { const app = base.porNome.get(norm(m[1])); if (app) return app; }
  return null;
}

const GENERICOS = /^(game|games|launcher|client|main|start|play|app|setup|install|uninstall|update|updater|run|engine|java|javaw|python|unity|player|server|editor|config|crashhandler|unitycrashhandler64|unitycrashhandler32|crashpad_handler|electron|nw|node|steam|bootstrap|start_protected_game)(64|32|_x64)?\.exe$/;
// ---------- emuladores (nome do processo -> nome; o jogo vem do arquivo da ROM na linha de comando) ----------
const EMULADORES = [
  [/^retroarch$/, 'RetroArch'], [/^dolphin(-emu)?(-qt2?)?$/, 'Dolphin'], [/^pcsx2(-qt|-qtx64(-avx2)?)?$/, 'PCSX2'], [/^rpcs3$/, 'RPCS3'],
  [/^yuzu(-cmd)?$/, 'yuzu'], [/^suyu$/, 'suyu'], [/^eden(-cli)?$/, 'Eden'], [/^citron$/, 'Citron'], [/^sudachi$/, 'Sudachi'], [/^torzu$/, 'torzu'], [/^ryujinx$/, 'Ryujinx'],
  [/^cemu$/, 'Cemu'], [/^citra(-qt)?$/, 'Citra'], [/^lime3ds(-gui|-qt)?$/, 'Lime3DS'], [/^azahar$/, 'Azahar'], [/^duckstation(-qt|-nogui)?(-x64-releaseltcg)?$/, 'DuckStation'],
  [/^ppsspp(sdl|qt|windows(64)?)?$/, 'PPSSPP'], [/^melonds$/, 'melonDS'], [/^mgba(-qt)?$/, 'mGBA'], [/^xemu$/, 'xemu'], [/^xenia(_canary)?$/, 'Xenia'], [/^shadps4$/, 'shadPS4'],
  [/^vita3k$/, 'Vita3K'], [/^flycast$/, 'Flycast'], [/^project64$/, 'Project64'], [/^snes9x(-gtk|-x64)?$/, 'Snes9x'], [/^bsnes$/, 'bsnes'], [/^mesen2?$/, 'Mesen'],
  [/^desmume(-cli)?$/, 'DeSmuME'], [/^redream$/, 'redream'], [/^mame(64)?$/, 'MAME'], [/^fceux(64)?$/, 'FCEUX'], [/^ares$/, 'ares'], [/^gopher64$/, 'gopher64'],
  [/^simple64(-gui)?$/, 'simple64'], [/^mupen64plus$/, 'Mupen64Plus'], [/^pcsx-redux$/, 'PCSX-Redux'], [/^dosbox(-x|-staging)?$/, 'DOSBox'], [/^scummvm$/, 'ScummVM'],
  [/^mednafen$/, 'Mednafen'], [/^epsxe$/, 'ePSXe'], [/^nestopia$/, 'Nestopia'], [/^(visualboyadvance-m|vbam)$/, 'VisualBoyAdvance-M'], [/^skyemu$/, 'SkyEmu'], [/^xenia_canary$/, 'Xenia'],
];
const EXT_ROM = /\.(iso|cso|chd|rvz|gcm|gcz|wbfs|wia|wad|nsp|xci|nca|nro|3ds|cia|cci|cxi|nds|gba|gbc|gb|sfc|smc|nes|fds|n64|z64|v64|md|gen|smd|32x|sms|gg|pce|bin|cue|pbp|elf|xex|zip|7z|pkg|vpk|cdi|gdi|m3u|rpx|wux|wud|a26|lnx|ws|wsc|ngp|psv|xiso)$/i;
const emuladorDe = (exe) => { const b = path.posix.basename(String(exe || '').replace(/\\/g, '/')).toLowerCase().replace(/\.(exe|appimage|x86_64)$/i, ''); for (const [re, n] of EMULADORES) if (re.test(b)) return n; return ''; };
function romDe(args) {
  for (let i = args.length - 1; i >= 1; i--) {
    const a = String(args[i] || ''); if (!EXT_ROM.test(a) || a.length > 400) continue;
    let n = path.posix.basename(a.replace(/\\/g, '/')).replace(EXT_ROM, '');
    if (/^eboot$/i.test(n)) { const ps = a.replace(/\\/g, '/').split('/'); n = ps[ps.length - 3] || n; if (/^ps3_game$/i.test(n)) n = ps[ps.length - 4] || n; } // RPCS3: .../JOGO/USRDIR/EBOOT.BIN
    n = n.replace(/\[[^\]]*\]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (n.length >= 2) return n.slice(0, 100);
  }
  return '';
}

// ---------- processos abertos ----------
const EMBRULHOS = /^(wine(64)?(-preloader)?|wineserver|wine64-preloader|python[\d.]*|bash|sh|dash|zsh|fish|env|gamemoderun|mangohud|pressure-vessel.*|steam-runtime.*|srt-bwrap|bwrap|reaper|proton|umu-run|flatpak-spawn|ld-linux.*)$/i;
// cache (opcional): pid -> { cmd, item }. Com ele, cada varredura só lê a linha de comando de cada processo; o resto (exe, quando abriu)
// é lido de novo só para os processos novos ou que trocaram de programa. Assim dá para olhar a cada segundo sem pesar.
function lerProcessosLinux({ proc = '/proc', pidsProprios = [], cache = null } = {}) {
  const out = []; let btime = 0;
  try { btime = Number((/btime (\d+)/.exec(fs.readFileSync(path.join(proc, 'stat'), 'utf8')) || [])[1]) * 1000; } catch (e) { /* ok */ }
  const meus = new Set(pidsProprios);
  let pids = []; try { pids = fs.readdirSync(proc).filter((x) => /^\d+$/.test(x)); } catch (e) { return out; }
  for (const p of pids) {
    const pid = Number(p); if (meus.has(pid)) continue;
    let cmd; try { cmd = fs.readFileSync(path.join(proc, p, 'cmdline'), 'utf8'); } catch (e) { continue; }
    if (!cmd) continue;
    const c0 = cache && cache.get(pid);
    if (c0 && c0.cmd === cmd) { c0.viu = true; if (c0.item) out.push(c0.item); continue; }
    const args = cmd.split('\0').filter((x, i, l) => x || i < l.length - 1).slice(0, 64);
    let exe = ''; try { exe = fs.readlinkSync(path.join(proc, p, 'exe')); } catch (e) { /* processo de outro usuário: só a linha de comando */ }
    let ini = 0; try { const st = fs.readFileSync(path.join(proc, p, 'stat'), 'utf8'); const campos = st.slice(st.lastIndexOf(')') + 2).split(' '); ini = btime ? btime + Math.round(Number(campos[19]) * 10) : 0; } catch (e) { /* ok */ }
    const caminhos = [];
    const exeBase = path.posix.basename(exe);
    if (exe && !EMBRULHOS.test(exeBase)) caminhos.push(exe);
    if (args[0] && args[0] !== exe) caminhos.push(args[0]);
    let nExe = 0; for (const a of args.slice(1)) if (/\.exe$/i.test(a) && nExe++ < 3) caminhos.push(a);
    const item = caminhos.length ? { pid, ini, caminhos, args } : null;
    if (cache) cache.set(pid, { cmd, item, viu: true });
    if (item) out.push(item);
  }
  if (cache) for (const [k, v] of cache) { if (v.viu) v.viu = false; else cache.delete(k); } // processos que fecharam
  return out;
}

// Windows: um PowerShell escondido fica aberto e responde a lista quando o app pergunta (abrir um a cada vez pesaria mais)
// (cache: o caminho e a hora de abrir de cada processo só são perguntados uma vez; depois é só a lista, que é rápida)
const PS_LISTA = "$ErrorActionPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8;$m=@{};" +
  "while(($l=[Console]::In.ReadLine()) -ne $null){$n=@{};foreach($p in [Diagnostics.Process]::GetProcesses()){$k=[string]$p.Id+'|'+$p.ProcessName;$v=$m[$k];" +
  "if($v -eq $null){$c='';$t=0;try{$c=$p.MainModule.FileName}catch{};if(-not $c){$c=$p.ProcessName+'.exe'};try{$t=([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds()}catch{};" +
  "$v=[string]$p.Id+\"`t\"+$t+\"`t\"+$c};$n[$k]=$v;[Console]::Out.WriteLine($v)};$m=$n;[Console]::Out.WriteLine('<<FIM>>');[Console]::Out.Flush()}";
function criarLeitorWindows({ log = () => {}, pidsProprios = () => [] } = {}) {
  let ps = null, buf = '', espera = null;
  const abrir = () => {
    ps = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_LISTA], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    ps.stdout.setEncoding('utf8');
    ps.stdout.on('data', (d) => {
      buf += d; if (buf.length > 4e6) buf = '';
      const i = buf.indexOf('<<FIM>>'); if (i < 0) return;
      const txt = buf.slice(0, i); buf = buf.slice(i + 7);
      const e = espera; espera = null; if (e) e(txt);
    });
    ps.on('exit', () => { ps = null; const e = espera; espera = null; if (e) e(''); });
    ps.on('error', (e) => { log('jogos: powershell ' + e.message); });
  };
  return {
    listar: () => new Promise((ok) => {
      if (espera) { ok([]); return; }
      if (!ps) abrir();
      const t = setTimeout(() => { if (espera) { espera = null; ok([]); } }, 8000);
      espera = (txt) => {
        clearTimeout(t); const meus = new Set(pidsProprios()); const out = [];
        for (const l of txt.split(/\r?\n/)) { const [a, b, ...c] = l.split('\t'); const pid = Number(a); if (!pid || meus.has(pid)) continue; const cam = c.join('\t').trim(); if (cam) out.push({ pid, ini: Number(b) || 0, caminhos: [cam], args: [cam] }); }
        ok(out);
      };
      try { ps.stdin.write('x\n'); } catch (e) { espera = null; clearTimeout(t); ok([]); }
    }),
    parar: () => { if (ps) { try { ps.kill(); } catch (e) { /* ok */ } ps = null; } },
  };
}

// ---------- limpeza de uma atividade que veio do jogo ----------
const txt = (v, max = 128) => { const s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim(); return s.length >= 1 ? s.slice(0, max) : ''; };
const tempo = (v) => { v = Number(v); if (!Number.isFinite(v) || v <= 0) return 0; return Math.round(v < 1e11 ? v * 1000 : v); }; // o Discord aceita segundos ou milissegundos
// os sites de imagem que o servidor do Aero mostra aos amigos (o mesmo que HOSTS_CAPA em servidor/src/midia.js): uma imagem de outro
// site não apareceria, então fica o ícone do jogo no lugar
const HOSTS_IMG = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net|images\.igdb\.com|i\.imgur\.com|(cdn|shared)\.(akamai|cloudflare|fastly)\.steamstatic\.com|steamcdn-a\.akamaihd\.net|(upload|thumb)\.wikimedia\.org|thumbnails\.libretro\.com|(tr|t\d)\.rbxcdn\.com)\//;
// imagem: link https, "mp:" (imagem de fora que o Discord guarda) ou o nome de uma imagem do aplicativo no Discord
function imagemDe(v, appId, assets) {
  const s = String(v == null ? '' : v).trim(); if (!s || s.length > 400) return '';
  if (/^https:\/\/[^\s"'<>\\]+$/.test(s)) return HOSTS_IMG.test(s) ? s : '';
  if (/^mp:external\/[^\s"'<>\\]+\/https?\/[^\s"'<>\\]+$/.test(s)) { // imagem de outro site que o Discord guarda: usa o próprio link, se for de um site permitido
    const m = /^mp:external\/[^/]+\/(https?)\/(.+)$/.exec(s); const orig = m ? 'https://' + m[2] : ''; if (orig && HOSTS_IMG.test(orig)) return orig;
  }
  if (/^mp:[^\s"'<>\\]+$/.test(s)) return 'https://media.discordapp.net/' + s.slice(3);
  const a = assets && assets.get(s.toLowerCase());
  return a && /^\d{15,25}$/.test(appId) ? `https://cdn.discordapp.com/app-assets/${appId}/${a}.png` : '';
}
function deRpc(at, { appId = '', assets = null } = {}) {
  if (!at || typeof at !== 'object') return null;
  const o = { d: txt(at.details), s: txt(at.state), n: txt(at.name, 128) };
  const tp = Number(at.type); o.tp = [0, 2, 3, 5].includes(tp) ? tp : 0;
  const ts = at.timestamps || {}; o.ini = tempo(ts.start); o.fim = tempo(ts.end);
  const as = at.assets || {};
  o.li = imagemDe(as.large_image, appId, assets); o.lt = txt(as.large_text, 128);
  o.si = imagemDe(as.small_image, appId, assets); o.st = txt(as.small_text, 128);
  const pt = at.party && Array.isArray(at.party.size) ? at.party.size.map(Number) : null;
  if (pt && pt.length === 2 && pt.every((x) => Number.isInteger(x) && x >= 0 && x < 1e6) && pt[1] > 0) o.p = [Math.min(pt[0], pt[1]), pt[1]];
  // (1.0.2) os botões do jogo (até 2, só https) e se a partida aceita gente entrando ("Pedir para entrar", como no Discord)
  const bts = (Array.isArray(at.buttons) ? at.buttons : []).map((b) => b && typeof b === 'object' ? { l: txt(b.label, 32), u: typeof b.url === 'string' && /^https:\/\/[^\s"'<>\\]{3,290}$/.test(b.url) ? b.url : '' } : null).filter((b) => b && b.l && b.u).slice(0, 2);
  if (bts.length) o.b = bts;
  if (at.secrets && typeof at.secrets === 'object' && at.secrets.join) o.pj = 1;
  return o;
}
// 256: nítido no quadrado de 72 px em tela de alta densidade
const iconeApp = (app) => (app && app.ic ? `https://cdn.discordapp.com/app-icons/${app.id}/${app.ic}.png?size=256` : '');

// ---------- escolher o que aparece ----------
// rpcs: [{ origem, clientId, pid, at (deRpc), em, app (nome/ícone do aplicativo) }]
// det: [{ pid, ini, app: {id, n, ic}|null, emu, rom, base }]   pers: [config]   agora: relógio
// porNome(nome...): o ícone do jogo mais parecido na lista do Discord, para quando nada trouxe um (veja iconeParecido)
function escolher({ rpcs = [], det = [], pers = [], abertos = new Map(), visto = new Map(), agora = Date.now(), porNome = () => '' }) {
  // modo "proc": aparece com o app aberto e o tempo conta desde que ele abriu (zera quando fecha). Modo "manual" (uma live, por exemplo):
  // fica ligada até a pessoa desligar, e o tempo conta desde quando ela ligou ou zerou o contador
  const ativa = (p) => p && p.ativo !== false && (p.modo === 'manual' || !p.proc || abertos.has(p.proc));
  const montarPers = (p) => {
    const ini = p.modo === 'manual' ? (p.ini && p.ini <= agora ? p.ini : visto.get('pers:' + p.id) || agora)
      : p.proc ? (abertos.get(p.proc) || visto.get('pers:' + p.id) || agora) : (visto.get('pers:' + p.id) || agora);
    const o = { n: txt(p.nome) || 'Jogo', d: txt(p.det), s: txt(p.est), li: p.li || '', lt: txt(p.lt), si: p.si || '', st: txt(p.st), ini, fim: 0, tp: 0, o: 'pers' };
    if (p.vb) o.vb = txt(p.vb, 20); // o que vem antes do nome ("Jogando", "Ao vivo na", ...)
    if (p.link) o.lk = p.link;      // o nome vira um link (a live, o canal)
    if (!o.li) o.li = porNome(o.n, p.proc ? p.proc.replace(/\.exe$/, '') : '');
    return o;
  };
  const acima = pers.find((p) => ativa(p) && p.sobrepor); if (acima) return montarPers(acima);
  const r = rpcs.filter((x) => x.at).sort((a, b) => b.em - a.em)[0];
  if (r) {
    const d = det.find((x) => x.pid && x.pid === r.pid) || (r.app && det.find((x) => x.app && x.app.id === r.app.id)) || (/^\d{15,25}$/.test(r.clientId || '') && det.find((x) => x.app && x.app.id === r.clientId)) || null; // Flatpak: o pid é de dentro dele
    const app = r.app || (d && d.app) || null;
    const o = { ...r.at, o: r.origem === 'sdk' ? 'sdk' : 'discord' };
    o.n = r.at.n && r.origem === 'sdk' ? r.at.n : (app && app.n) || r.at.n || (d && d.emu) || 'Jogo';
    // sem a imagem grande: o ícone do aplicativo, depois o do jogo de nome mais parecido, e por último a imagem pequena no lugar
    if (!o.li) { o.li = iconeApp(app) || porNome(o.n, app && app.n, (d && d.rom) || '', o.lt); if (o.si && !o.li) { o.li = o.si; o.si = ''; } }
    if (!o.ini && d && d.ini) o.ini = d.ini;
    if (app && app.id) o.app = app.id;
    return o;
  }
  const p = pers.find(ativa); if (p) return montarPers(p);
  const d = det.slice().sort((a, b) => (b.visto || 0) - (a.visto || 0))[0];
  if (d) {
    if (d.emu && !d.app) return { n: d.emu, d: d.rom || '', s: '', li: porNome(d.rom || '', d.emu), lt: d.rom || '', si: '', st: '', ini: d.ini || 0, fim: 0, tp: 0, o: 'jogo', emu: 1 };
    const o = { n: d.app.n, d: d.rom || '', s: '', li: iconeApp(d.app) || porNome(d.app.n, d.rom || ''), lt: d.app.n, si: '', st: '', ini: d.ini || 0, fim: 0, tp: 0, o: 'jogo', app: d.app.id };
    if (d.emu) o.emu = 1;
    return o;
  }
  return null;
}

// ---------- o serviço ----------
// (1.0.2) o ID do Aero no Discord: o Rich Presence dele mesmo não vira jogo
function idsDoAero() { try { const j = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'discord-id.json'), 'utf8')); return [String(j.appId || ''), String(process.env.AERO_DISCORD_APP_ID || '')].filter((x) => /^\d{15,25}$/.test(x)); } catch (e) { return []; } }
function criarJogos({ log = () => {}, pastaDados, lerPers = () => [], lerIgnorados = () => [], plataforma = process.platform, pidsProprios = () => [process.pid], idsProprios = idsDoAero, listarProcessos = null, buscar = (u, o) => fetch(u, o), varrerMs = VARRER_MS, listaEmbutida = path.join(__dirname, 'jogos-lista.json'), aoMudar = null } = {}) {
  let base = null, listaEm = 0, ligado = false, timer = 0, varrendo = false, baixando = false;
  let det = [], abertos = new Map(), nomesAbertos = [];
  const visto = new Map(); // quando cada jogo/atividade apareceu (o tempo conta daí se o processo não disser quando abriu)
  const rpcs = new Map(); // chave da conexão -> { ... }
  const infoApps = new Map(); // id do aplicativo do Discord -> { n, ic, assets: Map, em }
  const leitorWin = plataforma === 'win32' && !listarProcessos ? criarLeitorWindows({ log, pidsProprios }) : null;
  const cacheLinux = new Map(); // pid -> linha de comando lida (lerProcessosLinux)
  const casou = new WeakMap(); // processo (o mesmo objeto enquanto não muda) -> o jogo/emulador que ele é
  // avisa o app na hora em que o que os amigos veem muda (sem esperar a próxima pergunta dele)
  let ultimaChave = null;
  const chaveDe = (x) => (x ? JSON.stringify([x.n, x.d, x.s, x.li, x.lt, x.si, x.st, x.tp, x.vb, x.lk, x.o, x.p, Math.round((x.ini || 0) / 5000), Math.round((x.fim || 0) / 5000)]) : '');
  function talvezAvisar() {
    if (!aoMudar) return;
    let k = ''; try { k = chaveDe(agora()); } catch (e) { return; }
    if (k === ultimaChave) return;
    ultimaChave = k; try { aoMudar(); } catch (e) { /* ok */ }
  }
  const arquivoLista = pastaDados ? path.join(pastaDados, 'jogos-lista.json') : '';

  function carregarLista() {
    for (const arq of [arquivoLista, listaEmbutida]) {
      if (!arq) continue;
      try { const j = JSON.parse(fs.readFileSync(arq, 'utf8')); if (Array.isArray(j.apps) && j.apps.length > 100 && (!base || j.em > listaEm)) { base = criarBase(j.apps); listaEm = Number(j.em) || 0; } } catch (e) { /* tenta o próximo */ }
    }
  }
  async function atualizarLista(forcar) {
    if (baixando || !arquivoLista || (!forcar && Date.now() - listaEm < SEMANA)) return;
    baixando = true;
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
      const r = await buscar(URL_LISTA, { headers: { 'User-Agent': 'AeroStream (jogos)' }, signal: ctl.signal }); clearTimeout(t);
      if (!r.ok) throw new Error('http ' + r.status);
      const apps = compactar(await r.json());
      if (apps.length < 1000) throw new Error('lista curta');
      const em = Date.now();
      fs.writeFileSync(arquivoLista + '.tmp', JSON.stringify({ em, apps })); fs.renameSync(arquivoLista + '.tmp', arquivoLista);
      base = criarBase(apps); listaEm = em; log('jogos: lista do Discord atualizada (' + apps.length + ' jogos)');
    } catch (e) { log('jogos: não deu para atualizar a lista (' + (e.message || e) + ')'); } finally { baixando = false; }
  }

  // nome, ícone e imagens de um aplicativo do Discord (o jogo manda só o número dele): pela lista e, se não estiver nela, pela API pública
  async function infoApp(id) {
    if (!/^\d{15,25}$/.test(id)) return null;
    const ja = infoApps.get(id); if (ja && (ja.pronto || Date.now() - ja.em < 60000)) return ja;
    const da = base && base.porId.get(id);
    const inf = { n: da ? da.n : '', ic: da ? da.ic : '', id, assets: new Map(), em: Date.now(), pronto: false }; infoApps.set(id, inf);
    const pegar = async (u) => { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000); try { const r = await buscar(u, { headers: { 'User-Agent': 'AeroStream (jogos)' }, signal: ctl.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); } };
    const [rpc, as] = await Promise.all([inf.n && inf.ic ? null : pegar(`https://discord.com/api/v9/applications/${id}/rpc`), pegar(`https://discord.com/api/v9/oauth2/applications/${id}/assets`)]);
    if (rpc && typeof rpc.name === 'string') { inf.n = inf.n || rpc.name.slice(0, 128); if (/^[a-f0-9]{32}$/.test(rpc.icon || '')) inf.ic = rpc.icon; }
    if (Array.isArray(as)) for (const a of as.slice(0, 500)) if (a && typeof a.name === 'string' && /^\d{15,25}$/.test(String(a.id))) inf.assets.set(a.name.toLowerCase(), String(a.id));
    inf.pronto = !!(rpc || as || inf.n);
    if (infoApps.size > 200) infoApps.delete(infoApps.keys().next().value);
    return inf;
  }

  // chegou atividade de um jogo (SDK ou ponte do Discord)
  const logados = new Map(); // conexão -> o que já foi para o log (cada combinação de imagens aparece uma vez)
  function aoRpc(x) {
    try { // só no log local: de onde vieram o nome e as imagens (para entender um jogo que aparece diferente do Discord)
      const a = x.atividade, as = (a && a.assets) || {};
      const k = a ? [x.clientId, as.large_image, as.small_image].join(' | ') : '';
      if (k && logados.get(x.chave) !== k) { logados.set(x.chave, k); if (logados.size > 50) logados.delete(logados.keys().next().value); log('jogos: atividade (' + x.origem + ') app=' + x.clientId + ' grande=' + String(as.large_image || '-').slice(0, 200) + ' pequena=' + String(as.small_image || '-').slice(0, 200)); }
    } catch (e) { /* ok */ }
    aoRpc0(x); talvezAvisar();
  }
  function aoRpc0({ chave, origem, clientId, pid, atividade }) {
    if (!atividade) { rpcs.delete(chave); return; }
    if (clientId && idsProprios().includes(String(clientId))) { rpcs.delete(chave); return; } // (1.0.2) o próprio Aero nunca vira jogo
    if (!ligado) return;
    const em = Date.now(), ent = { origem, clientId, pid, bruta: atividade, at: deRpc(atividade, { appId: clientId }), em, app: null };
    const ant = rpcs.get(chave); if (ant) { ent.app = ant.app; ent.em = ant.em; } // a mesma conexão atualizando não "passa na frente" das outras
    rpcs.set(chave, ent);
    if (rpcs.size > 30) rpcs.delete(rpcs.keys().next().value);
    if (/^\d{15,25}$/.test(clientId)) infoApp(clientId).then((inf) => {
      const e = rpcs.get(chave); if (!inf || e !== ent) return;
      ent.app = inf.n ? { id: inf.id, n: inf.n, ic: inf.ic } : null;
      ent.at = deRpc(ent.bruta, { appId: clientId, assets: inf.assets });
      talvezAvisar();
    }).catch(() => {});
  }

  async function varrer() {
    if (varrendo || !ligado) return;
    varrendo = true;
    try {
      const lista = listarProcessos ? await listarProcessos() : plataforma === 'win32' ? await leitorWin.listar() : plataforma === 'linux' ? lerProcessosLinux({ pidsProprios: pidsProprios(), cache: cacheLinux }) : [];
      const novos = [], ab = new Map(), nomes = new Set(), agora = Date.now();
      for (const pr of lista) {
        let m = casou.get(pr);
        if (!m || m.base !== base) {
          let app = null, cam0 = pr.caminhos[0];
          for (const c of pr.caminhos) { app = casar(base, c, pr.args || []); if (app) { cam0 = c; break; } }
          let emu = '';
          if (!app) for (const c of pr.caminhos) { emu = emuladorDe(c); if (emu) { cam0 = c; break; } }
          else emu = emuladorDe(cam0);
          // os nomes abertos (para a atividade personalizada): o .exe do Wine quando tiver, senão o executável
          const camNome = pr.caminhos.find((c) => /\.exe$/i.test(c)) || pr.caminhos[0];
          m = { base, app, emu, nome: path.posix.basename(String(camNome).replace(/\\/g, '/')).toLowerCase() };
          casou.set(pr, m);
        }
        const { app, emu, nome } = m;
        if (nome && nome.length <= 80) { nomes.add(nome); const semExe = nome.replace(/\.exe$/, ''); for (const k of [nome, semExe]) if (!ab.has(k) || (pr.ini && pr.ini < ab.get(k))) ab.set(k, pr.ini || agora); }
        if (!app && !emu) continue;
        const k = 'p:' + pr.pid + ':' + (app ? app.id : emu); if (!visto.has(k)) visto.set(k, agora);
        novos.push({ pid: pr.pid, ini: pr.ini || visto.get(k), app: app ? { id: app.id, n: app.n, ic: app.ic } : null, emu, rom: emu ? romDe(pr.args || []) : '', visto: visto.get(k) });
      }
      // um jogo com vários processos (o lançador do jogo e o jogo) vira um só
      const porJogo = new Map(); for (const d of novos) { const k = d.app ? d.app.id : 'emu:' + d.emu; const j = porJogo.get(k); if (!j || (d.rom && !j.rom) || (d.ini && d.ini < j.ini && !(j.rom && !d.rom))) porJogo.set(k, d); }
      det = [...porJogo.values()]; abertos = ab; nomesAbertos = [...nomes].sort();
      const vivos = new Set(lista.map((p) => p.pid));
      for (const k of [...visto.keys()]) if (k.startsWith('p:') && !vivos.has(Number(k.split(':')[1]))) visto.delete(k);
      // (a atividade que chega por uma conexão só sai quando a conexão fecha: o pid que o jogo manda pode ser de dentro de um Flatpak,
      // como o Sober, e não existir aqui fora; fechar o jogo fecha a conexão)
    } catch (e) { log('jogos: ' + (e.message || e)); } finally { varrendo = false; }
    talvezAvisar();
  }

  function ligar(v) {
    v = !!v; if (v === ligado) return ligado;
    ligado = v; clearInterval(timer); timer = 0;
    if (v) { if (!base) carregarLista(); varrer(); timer = setInterval(varrer, varrerMs); if (timer.unref) timer.unref(); setTimeout(() => atualizarLista(false), 20000).unref?.(); }
    else { det = []; rpcs.clear(); cacheLinux.clear(); ultimaChave = null; if (leitorWin) leitorWin.parar(); }
    return ligado;
  }

  // (1.0.2) o que a pessoa escolheu NÃO mostrar (ex.: o Dolphin aberto o dia todo): cada jogo tem as suas chaves (o aplicativo do
  // Discord, o emulador e, na atividade que o jogo manda, o jogo detectado pelo mesmo processo). Uma chave na lista basta para esconder
  const chavesDet = (d) => (d.app ? ['a:' + d.app.id] : []).concat(d.emu ? ['e:' + norm(d.emu)] : []);
  const detDoRpc = (r) => det.find((x) => x.pid && x.pid === r.pid) || (r.app && det.find((x) => x.app && x.app.id === r.app.id)) || (/^\d{15,25}$/.test(r.clientId || '') && det.find((x) => x.app && x.app.id === r.clientId)) || null;
  const chavesRpc = (r) => {
    const ks = new Set();
    if (/^\d{15,25}$/.test(r.clientId || '')) ks.add('a:' + r.clientId);
    if (r.app && r.app.id) ks.add('a:' + r.app.id);
    if (!ks.size && r.at && r.at.n) ks.add('n:' + norm(r.at.n));
    const d = detDoRpc(r); if (d) for (const k of chavesDet(d)) ks.add(k);
    return [...ks];
  };
  function ignorados() {
    const s = new Set();
    for (const x of lerIgnorados() || []) for (const k of (x && Array.isArray(x.ks) ? x.ks : [])) if (typeof k === 'string') s.add(k);
    return s;
  }
  function agora() {
    if (!ligado) return null;
    const pers = (lerPers() || []).filter((p) => p && typeof p === 'object');
    for (const p of pers) if (p.ativo !== false && (!p.proc || abertos.has(p.proc)) && !visto.has('pers:' + p.id)) visto.set('pers:' + p.id, Date.now());
    for (const p of pers) if (p.proc && !abertos.has(p.proc)) visto.delete('pers:' + p.id);
    const ign = ignorados(), fora = (ks) => ks.some((k) => ign.has(k));
    const rs = [...rpcs.values()].filter((r) => !fora(chavesRpc(r)));
    return escolher({ rpcs: rs, det: det.filter((d) => !fora(chavesDet(d))), pers, abertos, visto, porNome: iconeParecido });
  }
  // (1.0.2) os jogos, emuladores e atividades que o Aero está vendo agora (para a pessoa escolher o que aparece). Os que mandam a
  // própria atividade e foram detectados pelo processo viram um item só
  function detectados() {
    if (!ligado) return [];
    const out = [];
    for (const d of det) out.push({ ks: chavesDet(d), n: d.app ? d.app.n : d.emu, ic: iconeApp(d.app) || '', tipo: d.app ? 'jogo' : 'emu', _d: d });
    for (const r of rpcs.values()) {
      if (!r.at) continue;
      const ks = chavesRpc(r), d = detDoRpc(r), ja = d && out.find((x) => x._d === d);
      if (ja) { for (const k of ks) if (!ja.ks.includes(k)) ja.ks.push(k); continue; }
      if (out.some((x) => x.ks.some((k) => ks.includes(k)))) continue;
      out.push({ ks, n: (r.app && r.app.n) || r.at.n || 'Jogo', ic: iconeApp(r.app) || (/^https:/.test(r.at.li || '') ? r.at.li : ''), tipo: r.origem === 'sdk' ? 'sdk' : 'discord' });
    }
    return out.map(({ _d, ...x }) => x).slice(0, 40);
  }

  // o ícone do jogo da lista do Discord com o nome mais parecido (o mesmo nome, um começando pelo outro ou a sigla). Tenta cada nome na
  // ordem e guarda a resposta (procurar varre a lista inteira)
  const iconesNome = new Map();
  function iconeParecido(...nomes) {
    if (!base) return '';
    for (const n0 of nomes) {
      const k = norm(n0); if (k.length < 3) continue;
      let achou = iconesNome.get(k);
      if (achou === undefined) {
        achou = '';
        for (const r of procurar(n0).slice(0, 8)) {
          if (!r.ic) continue;
          const kn = norm(r.n), curto = Math.min(kn.length, k.length), longo = Math.max(kn.length, k.length);
          if (kn === k || sigla(r.n) === k || (curto >= 4 && (k.startsWith(kn) || kn.startsWith(k)) && curto / longo >= 0.5)) { achou = r.ic; break; }
        }
        iconesNome.set(k, achou); if (iconesNome.size > 300) iconesNome.delete(iconesNome.keys().next().value);
      }
      if (achou) return achou;
    }
    for (const n0 of nomes) { // não está na lista do Discord: a capa do jogo de console com exatamente esse nome (o jogo do emulador)
      if (norm(n0).length < 4) continue;
      const c = imagensConsole(n0, { exato: true, max: 1 })[0]; if (c) return c.u;
    }
    return '';
  }

  // procurar um jogo da lista pelo nome, por um apelido ou pela sigla ("rdr2", "gta v")
  function procurar(q) {
    if (!base) carregarLista();
    const k = norm(q); if (!base || k.length < 2) return [];
    const sai = [], ja = new Set();
    const por = (app) => { if (ja.has(app.id) || sai.length >= 20) return; ja.add(app.id); sai.push({ id: app.id, n: app.n, ic: iconeApp(app), exe: (app.exes.find((e) => /\.exe$/.test(e.nome)) || app.exes[0] || { nome: '' }).nome.replace(/^>/, '').split('/').pop() }); };
    const exato = base.porNome.get(k); if (exato) por(exato);
    const exe = (app) => app.exes.some((e) => e.nome.replace(/^>/, '').split('/').pop().replace(/\.exe$/, '') === k);
    const passos = [
      (app) => exe(app),                                                                  // o executável: "rdr2", "cs2"
      (app) => sigla(app.n) === k || siglaLetras(app.n) === k,                           // a sigla: "gtav", "gta5"
      (app) => norm(app.n).startsWith(k) || app.al.some((a) => norm(a).startsWith(k)),   // o começo do nome ou de um apelido
      (app) => k.length >= 3 && (sigla(app.n).startsWith(k) || siglaLetras(app.n).startsWith(k)),
      (app) => k.length >= 3 && norm(app.n).includes(k),
    ];
    for (const f of passos) for (const app of base.todos) { if (sai.length >= 20) break; if (f(app)) por(app); }
    return sai;
  }

  return {
    ligar, agora, aoRpc, procurar, varrer, detectados,
    imagens: (q) => imagensConsole(String(q || '').slice(0, 100)),
    abertos: () => nomesAbertos.slice(0, 600),
    estado: () => ({ ligado, jogos: base ? base.todos.length : 0, listaEm }),
    atualizarLista,
    parar: () => { ligar(false); if (leitorWin) leitorWin.parar(); },
  };
}

// ---------- imagens dos jogos de console (o índice do libretro-thumbnails: capas, logos e telas de título de cada console) ----------
// desktop/capas-lista.json (scripts/capas-lista.mjs): { s: [[pasta, nome do console]], j: [[console, arquivo, logo, tela, tem capa]] }
// logo/tela: 1 = mesmo nome de arquivo da capa, 0 = não tem, texto = outro nome. Só é lido na primeira vez que precisa.
const LIBRETRO = 'https://thumbnails.libretro.com/';
const capasIdx = new Map(); // arquivo -> índice
const nomeLibretro = (b) => { // "Legend of Zelda, The - Ocarina of Time" -> "The Legend of Zelda: Ocarina of Time"
  let t = String(b || '').replace(/\s*[([][^)\]]*[)\]]/g, '').trim();
  const m = /^(.*?), (The|A|An)( - .*|$)/.exec(t); if (m) t = m[2] + ' ' + m[1] + m[3];
  return t.replace(/ - /, ': ').replace(/_/g, ' ');
};
function carregarCapas(arquivo = path.join(__dirname, 'capas-lista.json')) {
  if (capasIdx.has(arquivo)) return capasIdx.get(arquivo);
  let idx;
  try {
    const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    idx = { s: d.s || [], j: (d.j || []).map((x) => { const n = nomeLibretro(x[1]); return { s: x[0], f: x[1], l: x[2], t: x[3], b: x[4], n, k: norm(n) }; }) };
  } catch (e) { idx = { s: [], j: [] }; }
  capasIdx.set(arquivo, idx); return idx;
}
function imagensConsole(q, { arquivo, max = 24, exato = false } = {}) {
  const idx = carregarCapas(arquivo), k = norm(q); if (k.length < 2 || !idx.j.length) return [];
  const nota = (x) => (x.k === k ? 100 : exato ? 0 : x.k.startsWith(k) ? 80 - Math.min(20, x.k.length - k.length) : k.length >= 4 && x.k.includes(k) ? 50 : k.startsWith(x.k) && x.k.length >= 6 ? 40 : 0);
  const achados = [];
  for (const x of idx.j) { const n = nota(x); if (n) achados.push([n, x]); }
  achados.sort((a, b) => b[0] - a[0] || a[1].n.length - b[1].n.length);
  const url = (x, pasta, arq) => LIBRETRO + encodeURIComponent(idx.s[x.s][0]) + '/' + pasta + '/' + encodeURIComponent(arq + '.png').replace(/'/g, '%27');
  const out = [];
  for (const [, x] of achados.slice(0, 12)) {
    const con = (idx.s[x.s] || [])[1] || '';
    if (x.b) out.push({ u: url(x, 'Named_Boxarts', x.f), k: 'capa', o: con, n: x.n });
    if (x.l) out.push({ u: url(x, 'Named_Logos', x.l === 1 ? x.f : x.l), k: 'logo', o: con, n: x.n });
    if (x.t) out.push({ u: url(x, 'Named_Titles', x.t === 1 ? x.f : x.t), k: 'tela', o: con, n: x.n });
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

// ---------- atividades personalizadas (o que a interface manda gravar; nada confiável passa direto) ----------
const urlImg = (v) => { const s = String(v == null ? '' : v).trim(); return /^https:\/\/[^\s"'<>\\]{4,390}$/.test(s) || /^aero:jg\/[A-Z0-9]{6}\/[0-9a-f]{10}$/.test(s) ? s : ''; }; // link ou a foto que a pessoa enviou ao Aero
const VERBO_ANTIGO = { 2: 'Ouvindo', 3: 'Assistindo', 5: 'Competindo em' }; // as que foram salvas com o tipo antigo
const linkOk = (v) => { const s = String(v == null ? '' : v).trim(); if (!/^https:\/\/[^\s"'<>\\]{3,290}$/.test(s)) return ''; try { const u = new URL(s); return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u.href : ''; } catch (e) { return ''; } };
function limparPers(lista) {
  const out = [], ids = new Set();
  for (const x of Array.isArray(lista) ? lista.slice(0, 50) : []) {
    if (!x || typeof x !== 'object') continue;
    let id = /^[a-z0-9]{4,16}$/.test(String(x.id || '')) ? String(x.id) : Math.random().toString(36).slice(2, 10);
    while (ids.has(id)) id = Math.random().toString(36).slice(2, 10);
    ids.add(id);
    const modo = x.modo === 'manual' ? 'manual' : 'proc';
    const proc = modo === 'manual' ? '' : String(x.proc == null ? '' : x.proc).split(/[\\/]/).pop().toLowerCase().replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
    const nome = txt(x.nome); if (!nome) continue;
    out.push({ id, ativo: x.ativo !== false, proc, nome, det: txt(x.det), est: txt(x.est), li: urlImg(x.li), lt: txt(x.lt), si: urlImg(x.si), st: txt(x.st),
      modo, vb: txt(x.vb, 20) || VERBO_ANTIGO[Number(x.tp)] || '', link: linkOk(x.link),
      ini: modo === 'manual' && Number.isFinite(Number(x.ini)) && Number(x.ini) > 0 && Number(x.ini) <= Date.now() + 60000 ? Math.round(Number(x.ini)) : 0,
      sobrepor: !!x.sobrepor, app: /^\d{15,25}$/.test(String(x.app || '')) ? String(x.app) : '' });
  }
  return out;
}

module.exports = { criarJogos, imagensConsole, nomeLibretro, limparPers, compactar, criarBase, formas, casar, emuladorDe, romDe, deRpc, imagemDe, escolher, lerProcessosLinux, norm, sigla };
