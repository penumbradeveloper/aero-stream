// Aero Stream - captura direta da placa no Windows (modo jogo): a mesma ideia do aero-kms do Linux, com o FFmpeg oficial. Criado por Ryan Victtor.
//
// A tela vem da Desktop Duplication (ddagrab, sem passar pela captura do Chromium) e é codificada na própria placa (NVENC, AMF ou Quick Sync),
// com a textura indo direto da captura para o codificador. Só os bytes já codificados chegam ao app.
//
//   estado():    instalado? passou no autoteste, e com qual codificador?
//   instalar():  baixa o FFmpeg (conferido pelo SHA-256), abre o ffmpeg.exe na pasta do app, sem administrador, e testa os codificadores da placa.
//                Nenhum funcionou: fica como "não instalado". Desfazer: desinstalar() apaga a pasta.
//   iniciar():   liga a captura e entrega cada quadro H.264. Se ela parar, avisa (o app volta para a captura normal sozinho).
//
// Diferenças do aero-kms: cada canal é um ffmpeg, a taxa muda abrindo outro por cima (o velho só sai quando o novo já tem imagem) e o quadro
// inteiro não sai por pedido (o FFmpeg não tem esse comando): sai um por segundo.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip';
const FFMPEG_SHA = '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba';
const DENTRO = 'ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe';
const CODIFICADORES = ['nvenc', 'amf', 'qsv'];

const par2 = (n) => Math.max(2, Math.round(n / 2) * 2); // o H.264 só aceita tamanhos pares

// A linha de comando de um canal. Sem mudar de tamanho a textura vai direto para o codificador; com tamanho menor, quem reduz é a placa
function argsCanal({ codificador, saida = 0, fps, larg, alt, kbps, reduzir }) {
  const filtro = ['ddagrab=output_idx=' + saida + ':framerate=' + fps + ':draw_mouse=1'];
  if (reduzir) filtro.push('scale_d3d11=width=' + larg + ':height=' + alt + ':format=nv12');
  if (codificador === 'qsv') filtro.push('hwmap=derive_device=qsv', 'format=qsv');
  const cod = {
    nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p1', '-tune', 'ull', '-zerolatency', '1', '-rc', 'cbr', '-rc-lookahead', '0'],
    amf: ['-c:v', 'h264_amf', '-usage', 'ultralowlatency', '-quality', 'speed', '-rc', 'cbr'],
    qsv: ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-low_power', '1', '-async_depth', '1', '-look_ahead', '0'],
  }[codificador];
  return ['-hide_banner', '-loglevel', 'error', '-nostdin', '-filter_complex', filtro.join(','), ...cod, '-profile:v', 'high', '-bf', '0', '-g', String(fps),
    '-b:v', kbps + 'k', '-maxrate', kbps + 'k', '-bufsize', Math.max(1, Math.round((kbps / fps) * 4)) + 'k', '-fps_mode', 'passthrough',
    '-an', '-f', 'flv', '-flvflags', 'no_duration_filesize', '-flush_packets', '1', 'pipe:1'];
}

// O FLV é só um envelope: cada quadro vem numa etiqueta com o tamanho na frente, então um quadro inteiro é entregue na hora em que chega
// (no H.264 cru só dá para saber que ele acabou quando começa o próximo). Sai no formato que a conexão usa, com SPS e PPS nos quadros inteiros
function criarLeitorFlv(aoQuadro) {
  let buf = Buffer.alloc(0), comecou = false, tamNal = 4, config = Buffer.alloc(0);
  const inicio = Buffer.from([0, 0, 0, 1]);
  const lerConfig = (d) => {
    tamNal = (d[4] & 3) + 1;
    const partes = []; let i = 5;
    for (let tipo = 0; tipo < 2; tipo++) {
      let n = d[i++]; if (tipo === 0) n &= 31;
      for (let k = 0; k < n && i + 2 <= d.length; k++) { const t = d.readUInt16BE(i); i += 2; partes.push(inicio, d.subarray(i, i + t)); i += t; }
    }
    config = Buffer.concat(partes);
  };
  const emAnexoB = (d, chave) => {
    const partes = chave ? [config] : []; let i = 0;
    while (i + tamNal <= d.length) { const t = d.readUIntBE(i, tamNal); i += tamNal; partes.push(inicio, d.subarray(i, i + t)); i += t; }
    return Buffer.concat(partes);
  };
  return (pedaco) => {
    buf = buf.length ? Buffer.concat([buf, pedaco]) : pedaco;
    let i = 0;
    if (!comecou) { if (buf.length < 13) return; if (buf.toString('latin1', 0, 3) !== 'FLV') throw new Error('não é FLV'); i = 13; comecou = true; }
    while (buf.length - i >= 15) {
      const n = buf.readUIntBE(i + 1, 3);
      if (buf.length - i < 15 + n) break;
      if (buf[i] === 9 && n >= 5) {
        const d = buf.subarray(i + 11, i + 11 + n), chave = d[0] >> 4 === 1;
        if (d[1] === 0) lerConfig(d.subarray(5)); else if (d[1] === 1) aoQuadro({ chave, dados: emAnexoB(d.subarray(5), chave) });
      }
      i += 15 + n;
    }
    buf = i >= buf.length ? Buffer.alloc(0) : buf.subarray(i);
  };
}

function criarCapturaWindows({ pastaDados, log = () => {}, tela = () => ({ larg: 1920, alt: 1080, saida: 0 }), aoProcesso = () => {}, baixar = (u) => globalThis.fetch(u) } = {}) {
  const pasta = path.join(pastaDados, 'captura');
  const exe = path.join(pasta, 'ffmpeg.exe'), marca = path.join(pasta, 'versao.json');
  const canais = new Map(); // número -> { proc, novo, o, kbpsQuer }
  let aoQuadroF = null, aoFimF = null, base = null, cache = null, tTaxa = 0;
  const lerMarca = () => { try { return JSON.parse(fs.readFileSync(marca, 'utf8')); } catch (e) { return null; } };

  async function estado(forcar) {
    if (process.platform !== 'win32') return { suportado: false, motivo: 'so-windows' };
    if (cache && !forcar) return cache;
    const m = lerMarca(), instalado = fs.existsSync(exe);
    const atual = !!(m && m.sha === FFMPEG_SHA && CODIFICADORES.includes(m.codificador));
    cache = { suportado: true, windows: true, faltando: [], instalado, atual, codificador: atual ? m.codificador : '', pronto: instalado && atual, motivo: instalado && atual ? 'ok' : instalado ? 'desatualizado' : 'nao-instalado' };
    return cache;
  }

  async function abrirZip(zip) {
    const r = await new Promise((ok) => execFile('tar', ['-xf', zip, '-C', pasta, '--strip-components', '2', DENTRO], { windowsHide: true, timeout: 120000 }, (e) => ok(!e)));
    if (r && fs.existsSync(exe)) return true;
    const ps = "$z = [IO.Compression.ZipFile]::OpenRead($env:AERO_ZIP); $e = $z.GetEntry($env:AERO_DENTRO); [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $env:AERO_EXE, $true); $z.Dispose()";
    await new Promise((ok) => execFile('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' + ps], { windowsHide: true, timeout: 120000, env: { ...process.env, AERO_ZIP: zip, AERO_DENTRO: DENTRO, AERO_EXE: exe } }, () => ok()));
    return fs.existsSync(exe);
  }

  // abre um canal de verdade por 2 s: só vale o codificador que entregou quadros aqui (driver, placa e sessão do Windows dizem a última palavra)
  const testar = (codificador) => new Promise((resolve) => {
    const t = tela(), n = { q: 0 }, ler = criarLeitorFlv(() => { n.q++; });
    let erro = '', p;
    try { p = spawn(exe, argsCanal({ codificador, saida: t.saida, fps: 30, larg: t.larg, alt: t.alt, kbps: 4000 }), { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); } catch (e) { return resolve({ ok: false, erro: e.message }); }
    const fim = () => { clearTimeout(limite); try { p.kill(); } catch (e) { /* ok */ } resolve({ ok: n.q >= 5, erro: erro.trim().slice(-200) }); };
    const limite = setTimeout(fim, 5000);
    p.stdout.on('data', (d) => { try { ler(d); } catch (e) { /* conta só o que deu para ler */ } if (n.q >= 5) fim(); });
    p.stderr.setEncoding('utf8'); p.stderr.on('data', (d) => { erro += d; });
    p.on('error', (e) => { erro = e.message; }); p.on('exit', () => { if (n.q < 5) fim(); });
  });

  async function instalar() {
    if (process.platform !== 'win32') return { ok: false, motivo: 'so-windows' };
    fs.mkdirSync(pasta, { recursive: true });
    if (!fs.existsSync(exe) || (lerMarca() || {}).sha !== FFMPEG_SHA) {
      let dados;
      try {
        const r = await baixar(FFMPEG_URL); if (!r.ok) throw new Error('download ' + r.status);
        dados = Buffer.from(await r.arrayBuffer());
      } catch (e) { log('captura: ' + e.message); return { ok: false, motivo: 'baixar', erro: e.message }; }
      if (crypto.createHash('sha256').update(dados).digest('hex') !== FFMPEG_SHA) return { ok: false, motivo: 'baixar', erro: 'arquivo diferente do esperado' };
      const zip = path.join(pasta, 'ffmpeg.zip');
      fs.writeFileSync(zip, dados); dados = null;
      const abriu = await abrirZip(zip);
      try { fs.unlinkSync(zip); } catch (e) { /* ok */ }
      if (!abriu) return { ok: false, motivo: 'abrir', erro: 'não consegui abrir o arquivo baixado' };
    }
    const erros = [];
    for (const codificador of CODIFICADORES) {
      const r = await testar(codificador);
      log('captura: autoteste ' + codificador + ' ' + (r.ok ? 'ok' : r.erro));
      if (r.ok) { fs.writeFileSync(marca, JSON.stringify({ sha: FFMPEG_SHA, codificador })); cache = null; return { ok: true, codificador }; }
      erros.push(codificador + ': ' + r.erro);
    }
    try { fs.unlinkSync(marca); } catch (e) { /* ok */ }
    cache = null;
    return { ok: false, motivo: 'placa', erro: 'nenhum codificador da placa funcionou aqui (' + erros.join(' | ').slice(0, 300) + ')' };
  }

  async function desinstalar() {
    parar(); cache = null;
    try { fs.rmSync(pasta, { recursive: true, force: true }); return { ok: true }; } catch (e) { return { ok: false, erro: e.message }; }
  }

  function abrirProcesso(c, o) {
    const t = tela(), alt = par2(Math.min(o.alt, t.alt)), larg = par2((t.larg * alt) / t.alt), codificador = (lerMarca() || {}).codificador;
    return new Promise((resolve) => {
      let p, viu = false, erro = '';
      try { p = spawn(exe, argsCanal({ codificador, saida: t.saida, fps: o.fps, larg, alt, kbps: o.kbps, reduzir: alt < t.alt }), { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); } catch (e) { return resolve({ ok: false, erro: e.message }); }
      try { os.setPriority(p.pid, os.constants.priority.PRIORITY_HIGH); } catch (e) { /* segue na prioridade normal */ }
      aoProcesso();
      const k = canais.get(c) || {}; canais.set(c, k); k.novo = p;
      const fim = setTimeout(() => { if (!viu) { try { p.kill(); } catch (e) { /* ok */ } } }, 6000);
      const ler = criarLeitorFlv((q) => {
        if (!viu) {
          viu = true; clearTimeout(fim);
          if (k.novo !== p) { try { p.kill(); } catch (e) { /* ok */ } return; } // outro já foi pedido por cima deste
          const velho = k.proc; k.proc = p; k.novo = null; k.o = { ...o, alt, larg };
          if (velho) { try { velho.kill(); } catch (e) { /* ok */ } }
          resolve({ ok: true, larg, alt, fps: o.fps });
        }
        if (k.proc === p && aoQuadroF) aoQuadroF({ chave: q.chave, canal: c, us: Math.round(performance.now() * 1000), dados: q.dados });
      });
      p.stdout.on('data', (d) => { try { ler(d); } catch (e) { log('captura: ' + e.message); try { p.kill(); } catch (_) { /* ok */ } } });
      p.stderr.setEncoding('utf8'); p.stderr.on('data', (d) => { erro = (erro + d).slice(-400); });
      p.on('error', (e) => { erro = e.message; });
      p.on('exit', (code) => {
        clearTimeout(fim);
        if (!viu) { if (k.novo === p) k.novo = null; resolve({ ok: false, erro: erro.trim() || 'saiu (' + code + ')' }); return; }
        if (k.proc !== p) return; // trocado ou parado de propósito
        k.proc = null; log('captura: o canal ' + c + ' parou: ' + (erro.trim() || code));
        if (c === 0) { const f = aoFimF; parar(); if (f) f(erro.trim() || 'saiu (' + code + ')'); } else canais.delete(c);
      });
    });
  }

  // liga a captura. aoQuadro({ chave, canal, us, dados }); aoFim(motivo). Devolve quando o 1º quadro sai (ou falha)
  async function iniciar({ fps = 60, altura = 1080, kbps = 4000 } = {}, aoQuadro, aoFim) {
    parar();
    if (!(await estado(true)).pronto) return { ok: false, erro: 'não instalada' };
    aoQuadroF = aoQuadro; aoFimF = aoFim; base = { fps, alt: altura, kbps };
    const r = await abrirProcesso(0, base);
    if (!r.ok) { parar(); return r; }
    log('captura: captura direta ' + r.larg + 'x' + r.alt + ' ' + r.fps + ' fps (' + (lerMarca() || {}).codificador + ')');
    tTaxa = setInterval(acertarTaxas, 3000);
    return r;
  }
  function parar() {
    clearInterval(tTaxa); aoQuadroF = null; aoFimF = null;
    for (const k of canais.values()) for (const p of [k.proc, k.novo]) if (p) { try { p.kill(); } catch (e) { /* ok */ } }
    canais.clear();
  }
  // a taxa de um ffmpeg aberto não muda: só reabre quando vale a pena (caiu 30% ou subiu 50%, e para subir no mínimo a cada 12 s)
  function acertarTaxas() {
    const agora = Date.now();
    for (const [c, k] of canais) {
      if (!k.kbpsQuer || !k.o || k.novo) continue;
      const caiu = k.kbpsQuer < k.o.kbps * 0.7, subiu = k.kbpsQuer > k.o.kbps * 1.5 && agora - (k.trocou || 0) > 12000;
      if (caiu || subiu) { k.trocou = agora; abrirProcesso(c, { ...k.o, kbps: k.kbpsQuer }); }
    }
  }
  const canalOk = (c) => Number.isInteger(c) && c >= 0 && c < 8;
  const lim = (v, a, b, pad) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : pad; };

  return {
    estado, instalar, desinstalar, iniciar, parar,
    idr: () => {}, // (sai um quadro inteiro por segundo)
    taxa: (k, c) => { const x = canais.get(canalOk(c) ? c : 0); if (x) x.kbpsQuer = lim(k, 300, 150000, 4000); },
    canal: (c, { alt, fps, kbps } = {}) => {
      if (!canalOk(c) || !base) return;
      const o = { alt: lim(alt, 144, 4320, 1080), fps: lim(fps, 10, 240, 60), kbps: lim(kbps, 300, 150000, 4000) }, k = canais.get(c);
      if (k && k.o && k.o.alt === par2(Math.min(o.alt, tela().alt)) && k.o.fps === o.fps) { k.kbpsQuer = o.kbps; return; }
      abrirProcesso(c, o);
    },
    fecharCanal: (c) => { const k = canais.get(c); if (!canalOk(c) || !k || c === 0) return; canais.delete(c); for (const p of [k.proc, k.novo]) if (p) { try { p.kill(); } catch (e) { /* ok */ } } },
    ativo: () => [...canais.values()].some((k) => k.proc),
    pids: () => [...canais.values()].flatMap((k) => [k.proc, k.novo]).filter(Boolean).map((p) => p.pid),
  };
}

module.exports = { criarCapturaWindows, criarLeitorFlv, argsCanal };
