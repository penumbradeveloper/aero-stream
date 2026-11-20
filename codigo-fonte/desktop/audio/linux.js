// Aero Stream - áudio por aplicativo no Linux (PulseAudio e PipeWire, pelo "pactl" e "parec"):
//  - lista os aplicativos que estão tocando som (nome, ícone, volume, mudo) e muda o volume/mudo de cada um;
//  - captura o som SÓ dos aplicativos escolhidos (ou de uma janela, ou de tudo menos o Aero Stream): cria uma saída virtual
//    "aero_captura" e lê o som dela.
//    * PipeWire (CachyOS, Fedora, Ubuntu novo...): NÃO mexe na saída dos aplicativos. Liga uma CÓPIA da saída de cada aplicativo escolhido na
//      saída virtual (pw-link), como o plugin de captura de aplicativo do OBS. Você continua ouvindo exatamente como antes (sem loopback, sem
//      atraso e sem som em dobro) e só os escolhidos entram na transmissão.
//    * PulseAudio puro: move os aplicativos escolhidos para a saída virtual e liga um "loopback" para você continuar ouvindo.
// Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync, spawn } = require('child_process');

const SINK = 'aero_captura';
const env = () => ({ ...process.env, LC_ALL: 'C', LANG: 'C' });

const pwDump = () => new Promise((resolve, reject) => execFile('pw-dump', [], { env: env(), timeout: 5000, maxBuffer: 64 << 20 }, (err, out) => { if (err) return reject(err); try { resolve(JSON.parse(String(out))); } catch (e) { reject(e); } }));
const pwUnlink = (o, i) => new Promise((resolve, reject) => execFile('pw-link', ['-d', String(o), String(i)], { env: env(), timeout: 4000 }, (err) => (err ? reject(err) : resolve())));
// (0.7.2) o próprio Aero Stream pelo nome do programa (o som das chamadas às vezes vem sem o PID, ou de um processo novo do Electron)
const BIN_AERO = require('path').basename(process.execPath).toLowerCase();
const ehAero = (si) => /aero[\s_-]?stream/i.test(si.nome || '') || /aero[\s_-]?stream/i.test(si.binario || '') || (!!si.binario && si.binario.toLowerCase() === BIN_AERO && BIN_AERO !== 'electron');
const pwLink = (o, i) => new Promise((resolve, reject) => execFile('pw-link', [String(o), String(i)], { env: env(), timeout: 4000 }, (err, out, eo) => (err && !/File exists/i.test(String(eo)) ? reject(Object.assign(err, { saida: String(eo || '') })) : resolve())));
const pactl = (args, ms = 5000) => new Promise((resolve, reject) => {
  execFile('pactl', args, { env: env(), timeout: ms, maxBuffer: 8 << 20 }, (err, out, errout) => (err ? reject(Object.assign(err, { saida: String(errout || '') })) : resolve(String(out))));
});

// ---------- "pactl list sink-inputs" (texto em inglês) -> lista de objetos ----------
function parsearSinkInputs(texto) {
  const r = [];
  const blocos = String(texto).split(/\n(?=Sink Input #\d+)/);
  for (const b of blocos) {
    const cab = b.match(/^\s*Sink Input #(\d+)/);
    if (!cab) continue;
    const campo = (nome) => { const m = b.match(new RegExp('^\\t' + nome + ': (.*)$', 'm')); return m ? m[1].trim() : ''; };
    const props = {};
    const ip = b.indexOf('\n\tProperties:');
    if (ip >= 0) for (const l of b.slice(ip).split('\n')) { const m = l.match(/^\t\t([\w.\-:]+) = "(.*)"$/); if (m) props[m[1]] = m[2]; }
    const vols = (campo('Volume').match(/(\d+)%/g) || []).map((x) => parseInt(x, 10));
    r.push({
      indice: +cab[1], sink: campo('Sink'), donoModulo: /^\d+$/.test(campo('Owner Module')) ? campo('Owner Module') : '',
      pausado: campo('Corked') === 'yes', mudo: campo('Mute') === 'yes', volume: vols.length ? Math.max(...vols) : 100,
      nome: props['application.name'] || props['application.process.binary'] || props['media.name'] || '?', binario: props['application.process.binary'] || '',
      pid: parseInt(props['application.process.id'], 10) || 0, icone: props['application.icon_name'] || '', midia: props['media.name'] || '',
    });
  }
  return r;
}
const chaveDe = (si) => (si.binario || si.nome).toLowerCase();

// O título da janela compartilhada diz de qual aplicativo ela é? ("Vídeo — Mozilla Firefox" -> firefox). Usado no Wayland, onde não há PID da janela.
function tituloCasa(titulo, si) {
  const t = String(titulo || '').toLowerCase(); if (!t) return false;
  const nomes = [si.binario, si.nome].filter(Boolean).map((x) => String(x).toLowerCase().replace(/\.(exe|bin|sh|appimage)$/, '')).filter((x) => x.length >= 3 && !/^(pipewire|pulseaudio|wireplumber|alsa)/.test(x));
  return nomes.some((n) => t.includes(n) || n.split(/[\s\-_]+/).some((p) => p.length >= 4 && t.includes(p)));
}

// ---------- PipeWire: quais ligações (porta de saída do aplicativo -> entrada da saída virtual) faltam ----------
// objs = JSON do pw-dump. casa(no) diz se o aplicativo entra na captura. Devolve [[portaSaida, portaEntrada], ...] que ainda não existem.
const MAPA_CANAIS = { FL: ['FL'], FR: ['FR'], MONO: ['FL', 'FR'], FC: ['FL', 'FR'], RL: ['FL'], RR: ['FR'], SL: ['FL'], SR: ['FR'], AUX0: ['FL'], AUX1: ['FR'] };
function planejarLigacoes(objs, casa, nomeSink = SINK) {
  const nos = new Map(), portas = [], existentes = new Set(), links = [];
  for (const o of objs || []) {
    if (!o || !o.info) continue;
    if (o.type === 'PipeWire:Interface:Node') nos.set(o.id, o.info.props || {});
    else if (o.type === 'PipeWire:Interface:Port') portas.push({ id: o.id, dir: o.info.direction, props: o.info.props || {} });
    else if (o.type === 'PipeWire:Interface:Link') { existentes.add(o.info['output-port-id'] + '>' + o.info['input-port-id']); links.push([o.info['output-port-id'], o.info['input-port-id']]); }
  }
  let sinkId = null; for (const [id, p] of nos) if (p['node.name'] === nomeSink && /Audio\/Sink/.test(p['media.class'] || '')) sinkId = id;
  if (sinkId == null) return { ligar: [], desligar: [], sinkId: null };
  const entradas = {}; for (const pt of portas) if (pt.dir === 'input' && +pt.props['node.id'] === sinkId) entradas[(pt.props['audio.channel'] || '').toUpperCase()] = pt.id;
  const ligar = [];
  for (const pt of portas) {
    if (pt.dir !== 'output' || pt.props['port.monitor'] === true || pt.props['port.monitor'] === 'true') continue;
    const no = nos.get(+pt.props['node.id']); if (!no || no['media.class'] !== 'Stream/Output/Audio') continue;
    if (no['pulse.module.id'] != null || /loopback/i.test(no['node.name'] || '')) continue; // loopbacks e afins não são aplicativos
    const si = { nome: no['application.name'] || no['node.name'] || '', binario: no['application.process.binary'] || '', pid: parseInt(no['application.process.id'], 10) || 0 };
    if (!casa(si)) continue;
    const canal = (pt.props['audio.channel'] || '').toUpperCase();
    for (const c of MAPA_CANAIS[canal] || (canal === 'LFE' ? [] : ['FL', 'FR'])) {
      const alvo = entradas[c]; if (alvo == null) continue;
      if (!existentes.has(pt.id + '>' + alvo)) { ligar.push([pt.id, alvo]); existentes.add(pt.id + '>' + alvo); }
    }
  }
  // (0.7.2) o que JÁ está ligado na captura e não devia (o som do próprio Aero, que antes nunca era desligado): sai
  const desligar = [], porId = new Map(portas.map((pt) => [pt.id, pt]));
  const entradasSet = new Set(Object.values(entradas));
  for (const [o, i] of links) {
    if (!entradasSet.has(i)) continue;
    const pt = porId.get(o); const no = pt && nos.get(+pt.props['node.id']); if (!no || no['media.class'] !== 'Stream/Output/Audio') continue;
    const si = { nome: no['application.name'] || no['node.name'] || '', binario: no['application.process.binary'] || '', pid: parseInt(no['application.process.id'], 10) || 0 };
    if (!casa(si)) desligar.push([o, i]);
  }
  return { ligar, desligar, sinkId };
}

// agrupa as entradas do mesmo aplicativo (um navegador pode ter várias) e tira o próprio Aero Stream e o que é "de módulo" (loopbacks)
function agrupar(entradas, proprios = new Set()) {
  const g = new Map();
  for (const si of entradas) {
    if (si.donoModulo || (si.pid && proprios.has(si.pid))) continue;
    const k = chaveDe(si);
    let it = g.get(k);
    if (!it) { it = { id: 'p:' + k, nome: si.nome, icone: si.icone, volume: 0, mudo: true, pid: si.pid, tocando: false, indices: [], pids: new Set() }; g.set(k, it); }
    it.indices.push(si.indice); if (si.pid) it.pids.add(si.pid);
    it.volume = Math.max(it.volume, si.volume); it.mudo = it.mudo && si.mudo; it.tocando = it.tocando || !si.pausado;
  }
  return [...g.values()].sort((a, b) => Number(b.tocando) - Number(a.tocando) || a.nome.localeCompare(b.nome));
}

// ---------- ícone do aplicativo (PNG do tema do sistema), em cache ----------
const cacheIcone = new Map();
function iconeDe(nome) {
  if (!nome || /[\/\\]/.test(nome)) return '';
  if (cacheIcone.has(nome)) return cacheIcone.get(nome);
  let r = '';
  const home = os.homedir();
  const pastas = [];
  for (const base of [path.join(home, '.local/share/icons/hicolor'), '/usr/share/icons/hicolor', '/var/lib/flatpak/exports/share/icons/hicolor', path.join(home, '.local/share/flatpak/exports/share/icons/hicolor'), '/var/lib/snapd/desktop/icons/hicolor']) for (const t of ['48x48', '64x64', '32x32', '128x128', '256x256', '96x96']) pastas.push(path.join(base, t, 'apps'));
  pastas.push('/usr/share/pixmaps');
  for (const p of pastas) {
    const f = path.join(p, nome + '.png');
    try { const st = fs.statSync(f); if (st.isFile() && st.size < 90000) { r = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'); break; } } catch (e) { /* tenta a próxima pasta */ }
  }
  cacheIcone.set(nome, r);
  return r;
}

// ---------- janela -> processos (só X11/XWayland): xprop dá o PID; "ps" dá os filhos ----------
const pidsDaJanela = async (idJanela) => {
  const m = /^window:(\d+):/.exec(String(idJanela || '')); if (!m) return null;
  let pid = 0;
  try { const o = await new Promise((res, rej) => execFile('xprop', ['-id', '0x' + (+m[1]).toString(16), '_NET_WM_PID'], { timeout: 2500 }, (e, out) => (e ? rej(e) : res(String(out))))); const p = /=\s*(\d+)/.exec(o); pid = p ? +p[1] : 0; } catch (e) { return null; }
  if (!pid) return null;
  const pais = new Map();
  try { const o = await new Promise((res, rej) => execFile('ps', ['-eo', 'pid=,ppid='], { timeout: 2500 }, (e, out) => (e ? rej(e) : res(String(out))))); for (const l of o.split('\n')) { const p = l.trim().split(/\s+/).map(Number); if (p.length === 2 && p[0]) pais.set(p[0], p[1]); } } catch (e) { /* só o próprio PID */ }
  const set = new Set([pid]); let mudou = true;
  while (mudou) { mudou = false; for (const [f, p] of pais) if (!set.has(f) && set.has(p)) { set.add(f); mudou = true; } }
  return set;
};

// os processos do Discord (o som da call costuma vir de um processo filho, "WEBRTC VoiceEngine", com nome genérico de Electron/Chromium):
// lê o /proc e pega os que têm "discord" (ou Vesktop etc.) no nome ou no caminho, e os filhos deles
const ehDiscordNome = (nome) => /discord|vesktop|vencord|equibop|equicord|webcord|armcord|legcord|goofcord|dorion/i.test(String(nome || ''));
let cacheDiscord = { ate: 0, pids: new Set() };
function pidsDiscord() {
  if (Date.now() < cacheDiscord.ate) return cacheDiscord.pids;
  const pais = new Map(), raiz = new Set();
  try {
    for (const d of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(d)) continue;
      try {
        const st = fs.readFileSync('/proc/' + d + '/stat', 'utf8'), fim = st.lastIndexOf(')');
        const comm = st.slice(st.indexOf('(') + 1, fim), ppid = +st.slice(fim + 2).split(' ')[1];
        pais.set(+d, ppid);
        if (ehDiscordNome(comm)) { raiz.add(+d); continue; }
        const cmd = fs.readFileSync('/proc/' + d + '/cmdline', 'utf8').split('\0').slice(0, 3).join(' ');
        if (ehDiscordNome(cmd)) raiz.add(+d);
      } catch (e) { /* o processo acabou */ }
    }
  } catch (e) { /* sem /proc */ }
  const set = new Set(raiz); let mudou = true;
  while (mudou) { mudou = false; for (const [f, p] of pais) if (!set.has(f) && set.has(p)) { set.add(f); mudou = true; } }
  cacheDiscord = { ate: Date.now() + 4000, pids: set };
  return set;
}
const doDiscord = (si) => ehDiscordNome(si.nome) || ehDiscordNome(si.binario) || (si.pid && pidsDiscord().has(si.pid));

function criarLinux({ pidsProprios = () => [process.pid], emitirPCM = () => {}, log = () => {} } = {}) {
  let sessao = null, cap = null, capAte = 0, serie = Promise.resolve();

  const proprios = () => new Set(pidsProprios());
  const ler = async () => parsearSinkInputs(await pactl(['list', 'sink-inputs']));
  const temComando = (nome) => new Promise((res) => execFile(nome, ['--version'], { timeout: 2500 }, (e) => res(!e || e.code !== 'ENOENT' && !/ENOENT/.test(String(e.message)))));

  async function disponivel() {
    if (cap && Date.now() < capAte) return cap;
    let pa = false, parec = false, pw = false;
    try { const info = await pactl(['info'], 3000); pa = true; pw = /PipeWire/i.test(info); } catch (e) { pa = false; }
    if (pa) parec = await temComando('parec');
    if (pw) pw = (await temComando('pw-link')) && (await temComando('pw-dump'));
    cap = { captura: pa && parec, volume: pa, listar: pa, tipo: 'linux', metodo: pw ? 'pipewire' : 'pulse' }; capAte = Date.now() + 15000;
    return cap;
  }

  async function listar() {
    try { return agrupar(await ler(), proprios()).map((a) => ({ id: a.id, nome: a.nome, icone: iconeDe(a.icone), volume: a.volume, mudo: a.mudo, pid: a.pid, tocando: a.tocando })); } catch (e) { return []; }
  }
  async function aplicar(id, fn) {
    const a = agrupar(await ler(), proprios()).find((x) => x.id === id); if (!a) return;
    await Promise.all(a.indices.map((i) => fn(i).catch(() => {})));
  }
  const volume = (id, v) => aplicar(id, (i) => pactl(['set-sink-input-volume', String(i), Math.max(0, Math.min(150, Math.round(v))) + '%']));
  const mudo = (id, m) => aplicar(id, (i) => pactl(['set-sink-input-mute', String(i), m ? '1' : '0']));

  // ---------- captura ----------
  async function limparRestos() { // sobras de uma vez que o app fechou de repente
    try {
      for (const l of (await pactl(['list', 'short', 'modules'])).split('\n')) {
        const p = l.split('\t');
        if (p[0] && /module-(null-sink|loopback)/.test(p[1] || '') && new RegExp('sink_name=' + SINK + '|source=' + SINK + '\\.monitor').test(p[2] || '')) await pactl(['unload-module', p[0]]).catch(() => {});
      }
    } catch (e) { /* ok */ }
  }

  // (0.7.12) capturar e parar acontecem um de cada vez, na ordem pedida. Antes, um parar (ou outra captura) no meio de uma captura que ainda ligava
  // tirava a saída virtual, e o parec nascia depois sem dono: lia o fone inteiro para sempre e, na transmissão seguinte, misturava os blocos
  // dele com os do parec novo no som de quem assiste.
  const emSerie = (fn) => { const r = serie.then(fn, fn); serie = r.catch(() => {}); return r; };

  async function abrir({ ids = [], excluirAero = true, excluirDiscord = false, janela = null, nomeJanela = '' } = {}) {
    await fechar();
    const d = await disponivel();
    if (!d.captura) return { ok: false, erro: d.listar ? 'sem-parec' : 'sem-pactl' };
    await limparRestos();
    const s = { fechado: false, movidos: new Map(), mods: [], procs: [], timer: null, resto: Buffer.alloc(0), aviso: '', ligacoes: 0 };
    sessao = s;
    try {
      const pw = d.metodo === 'pipewire';
      s.metodo = pw ? 'pipewire' : 'pulse';
      s.mods.push((await pactl(['load-module', 'module-null-sink', 'sink_name=' + SINK, 'sink_properties=device.description=Aero_Stream_Captura' + (pw ? ' priority.session=0 priority.driver=0' : ''), 'rate=48000', 'channels=2'])).trim());
      let padrao = ''; try { padrao = (/Default Sink: (.+)/.exec(await pactl(['info'])) || [])[1] || ''; } catch (e) { /* ok */ }
      padrao = padrao.trim();
      if (!pw && padrao && padrao !== SINK) s.mods.push((await pactl(['load-module', 'module-loopback', 'source=' + SINK + '.monitor', 'sink=' + padrao, 'latency_msec=30'])).trim()); // você continua ouvindo
      // quem entra na captura
      // Quem entra: compartilhando UMA JANELA, o aplicativo dela (+ os que você marcar à mão); tela inteira: os marcados, ou todos se nenhum.
      // O próprio Aero Stream (vozes dos amigos, sons do app) NUNCA entra: isso daria eco.
      let pids = null, titulo = '';
      // janela sem PID (Wayland) e sem título: não há como saber o programa; vai o som do computador inteiro, menos o Aero (como na tela inteira)
      if (janela) { pids = await pidsDaJanela(janela); titulo = String(nomeJanela || ''); if (!pids && !titulo) { s.todos = true; s.aviso = 'janela-som-geral'; } }
      const quer = new Set((ids || []).map(String));
      const daJanela = (si) => (pids ? pids.has(si.pid) : tituloCasa(titulo, si));
      const casa = (si, meus) => {
        if (si.donoModulo) return false;
        if (excluirAero && ((si.pid && meus.has(si.pid)) || ehAero(si))) return false; // (0.7.2) pelo nome também (o PID nem sempre vem)
        if (excluirDiscord && !quer.has('p:' + chaveDe(si)) && doDiscord(si)) return false; // marcado à mão na lista: entra mesmo assim
        if (janela && !s.todos) return daJanela(si) || quer.has('p:' + chaveDe(si));
        if (quer.size) return quer.has('p:' + chaveDe(si));
        return true;
      };
      const sincronizar = pw ? async () => { // PipeWire: só acrescenta ligações (o aplicativo continua tocando onde estava)
        if (s.fechado) return;
        let objs; try { objs = await pwDump(); } catch (e) { return; }
        const meus = proprios();
        const plano = planejarLigacoes(objs, (si) => casa(si, meus));
        for (const [o, i] of plano.desligar || []) { if (s.fechado) return; try { await pwUnlink(o, i); log('captura: tirei o som do Aero que tinha entrado (' + o + ')'); } catch (e) { /* já saiu */ } }
        for (const [o, i] of plano.ligar) { if (s.fechado) return; try { await pwLink(o, i); s.ligacoes++; } catch (e) { log('pw-link ' + o + ' ' + i + ': ' + (e.saida || e.message)); } }
      } : async () => {
        if (s.fechado) return;
        let lista; try { lista = await ler(); } catch (e) { return; }
        const meus = proprios();
        for (const si of lista) {
          if (s.movidos.has(si.indice) || !casa(si, meus)) continue;
          if (String(si.sink) === s.sinkIdx) continue;
          s.movidos.set(si.indice, si.sink);
          try { await pactl(['move-sink-input', String(si.indice), SINK]); } catch (e) { s.movidos.delete(si.indice); }
        }
        for (const i of [...s.movidos.keys()]) if (!lista.some((x) => x.indice === i)) s.movidos.delete(i); // o aplicativo fechou
      };
      try { for (const l of (await pactl(['list', 'short', 'sinks'])).split('\n')) { const p = l.split('\t'); if (p[1] === SINK) s.sinkIdx = p[0]; } } catch (e) { /* ok */ }
      await sincronizar();
      s.timer = setInterval(sincronizar, 2000); if (s.timer.unref) s.timer.unref();
      // Janela sem programa reconhecido (no Wayland só há o título, e um jogo raramente tem o nome do executável no título): em vez de
      // transmitir em silêncio, o som passa a ser o do computador inteiro, menos o Aero Stream (como na tela inteira).
      if (janela && !quer.size) {
        s.timerTodos = setTimeout(() => {
          if (s.fechado || (pw ? s.ligacoes : s.movidos.size)) return;
          s.todos = true; s.aviso = 'janela-som-geral'; log('janela sem programa reconhecido: capturando o som do computador inteiro');
          sincronizar();
        }, 2500);
        if (s.timerTodos.unref) s.timerTodos.unref();
      }
      // avisa na hora quando um aplicativo novo começa a tocar
      const sub = spawn('pactl', ['subscribe'], { env: env(), stdio: ['ignore', 'pipe', 'ignore'] }); s.procs.push(sub);
      let deb = 0; sub.stdout.on('data', (d2) => { if (/'new' on sink-input/.test(String(d2))) { clearTimeout(deb); deb = setTimeout(sincronizar, 40); } });
      sub.on('error', () => {});
      // o som: lê a saída virtual
      const leitor = spawn('parec', ['--device=' + SINK + '.monitor', '--format=float32le', '--rate=48000', '--channels=2', '--latency-msec=20', '--property=node.dont-fallback=true'], { env: env(), stdio: ['ignore', 'pipe', 'pipe'] });
      s.procs.push(leitor);
      leitor.on('error', (e) => log('parec: ' + e.message));
      leitor.stderr.on('data', (x) => log('parec: ' + String(x).trim().slice(0, 160)));
      leitor.on('exit', () => { if (sessao === s && !s.fechado) { log('parec terminou'); emSerie(() => (sessao === s ? fechar() : undefined)); } });
      leitor.stdout.on('data', (buf) => {
        if (sessao !== s) return; // só a captura atual fala
        const juntos = s.resto.length ? Buffer.concat([s.resto, buf]) : buf;
        const uteis = juntos.length - (juntos.length % 8);
        s.resto = juntos.slice(uteis);
        if (!uteis) return;
        const f = new Float32Array(uteis / 4); new Uint8Array(f.buffer).set(juntos.subarray(0, uteis));
        emitirPCM(f);
      });
      return { ok: true, taxa: 48000, canais: 2, aviso: s.aviso || undefined, metodo: s.metodo };
    } catch (e) {
      log('captura: ' + (e.saida || e.message));
      await fechar();
      return { ok: false, erro: String(e.saida || e.message).trim().slice(0, 200) };
    }
  }

  async function fechar() {
    const s = sessao; if (!s) return; sessao = null; s.fechado = true;
    clearInterval(s.timer); clearTimeout(s.timerTodos);
    for (const p of s.procs) { try { p.kill(); } catch (e) { /* ok */ } }
    for (const [i, sinkOrig] of s.movidos) { // devolve cada aplicativo para onde estava
      await pactl(['move-sink-input', String(i), String(sinkOrig)]).catch(() => pactl(['move-sink-input', String(i), '@DEFAULT_SINK@']).catch(() => {}));
    }
    for (const m of [...s.mods].reverse()) await pactl(['unload-module', m]).catch(() => {});
  }

  // ao fechar o app: versão que não espera nada (o processo está acabando)
  function limparSincrono() {
    const s = sessao; if (!s) return; sessao = null; s.fechado = true;
    for (const p of s.procs) { try { p.kill(); } catch (e) { /* ok */ } }
    for (const [i] of s.movidos) { try { execFileSync('pactl', ['move-sink-input', String(i), '@DEFAULT_SINK@'], { timeout: 1500, env: env() }); } catch (e) { /* ok */ } }
    for (const m of [...s.mods].reverse()) { try { execFileSync('pactl', ['unload-module', m], { timeout: 1500, env: env() }); } catch (e) { /* ok */ } }
  }

  const capturar = (o) => emSerie(() => abrir(o));
  const parar = () => emSerie(fechar);
  return { disponivel, listar, volume, mudo, capturar, parar, limparSincrono };
}

module.exports = { pidsDiscord, doDiscord, criarLinux, parsearSinkInputs, agrupar, chaveDe, pidsDaJanela, planejarLigacoes, tituloCasa };
