// Aero Stream - captura direta da placa no Linux (modo jogo): compila, instala e conversa com o aero-kms (veja aero-kms.c). Criado por Ryan Victtor.
//
//   estado():    SEM administrador. Linux? Tem ffmpeg com kmsgrab + VA-API, compilador? O programa já está instalado e é desta versão?
//   instalar():  compila o aero-kms na pasta do app (sem administrador) e, pelo pedido de senha do próprio sistema (pkexec), copia para
//                /usr/local/lib/aero-stream/aero-kms (dono root, ninguém mais troca) com a permissão de ler a tela (CAP_SYS_ADMIN, como o Sunshine).
//                Desfazer: desinstalar() apaga a pasta.
//   iniciar():   liga a captura e entrega cada quadro já codificado (H.264) para quem pediu. Se o programa sair, avisa (o app volta para a
//                captura normal sozinho).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const PASTA = '/usr/local/lib/aero-stream';
const BIN = PASTA + '/aero-kms';
const FONTE = path.join(__dirname, 'aero-kms.c');
const LIBS = ['libavfilter', 'libavcodec', 'libavutil', 'libdrm', 'egl', 'glesv2', 'gbm'];

const sh = (cmd, args, opts = {}) => new Promise((resolve) => {
  execFile(cmd, args, { timeout: opts.timeout || 20000, maxBuffer: 8 << 20, env: { ...process.env, LC_ALL: 'C', LANG: 'C' }, ...opts }, (err, out, eo) => resolve({ ok: !err, out: String(out || ''), erro: String(eo || (err && err.message) || '') }));
});
const existe = (p) => { try { fs.accessSync(p); return true; } catch (e) { return false; } };
const hashFonte = () => crypto.createHash('sha256').update(fs.readFileSync(FONTE)).digest('hex').slice(0, 16);

// a placa que está mostrando a imagem: o /dev/dri/cardN com uma saída conectada
function aparelho() {
  try {
    const cards = fs.readdirSync('/sys/class/drm').filter((n) => /^card\d+$/.test(n)).sort();
    for (const c of cards) {
      const saidas = fs.readdirSync('/sys/class/drm').filter((n) => n.startsWith(c + '-'));
      if (saidas.some((s) => { try { return fs.readFileSync('/sys/class/drm/' + s + '/status', 'utf8').trim() === 'connected'; } catch (e) { return false; } })) return '/dev/dri/' + c;
    }
    return cards.length ? '/dev/dri/' + cards[0] : null;
  } catch (e) { return null; }
}

// O analisador do que sai do aero-kms: "AK" | flags | tamanho u32 | captura µs u64 | dados
function criarLeitor(aoQuadro) {
  let buf = Buffer.alloc(0);
  return (pedaco) => {
    buf = buf.length ? Buffer.concat([buf, pedaco]) : pedaco;
    let i = 0;
    while (buf.length - i >= 15) {
      if (buf[i] !== 0x41 || buf[i + 1] !== 0x4b) { i = buf.indexOf('AK', i + 1); if (i < 0) { i = buf.length; } continue; } // fora de sincronia: procura o próximo
      const n = buf.readUInt32LE(i + 3);
      if (n > 32 << 20) { i += 2; continue; }
      if (buf.length - i < 15 + n) break;
      aoQuadro({ chave: (buf[i + 2] & 1) === 1, canal: buf[i + 2] >> 4, us: Number(buf.readBigUInt64LE(i + 7)), dados: buf.subarray(i + 15, i + 15 + n) });
      i += 15 + n;
    }
    buf = i >= buf.length ? Buffer.alloc(0) : buf.subarray(i);
  };
}

function criarKms({ pastaDados, log = () => {} } = {}) {
  let proc = null, cache = null;

  async function estado(forcar) {
    if (process.platform !== 'linux') return { suportado: false, motivo: 'so-linux' };
    if (cache && !forcar) return cache;
    const r = { suportado: false, instalado: false, atual: false, faltando: [], aparelho: aparelho() };
    if (!(await sh('sh', ['-c', 'command -v cc || command -v gcc'])).ok) r.faltando.push('gcc');
    if (!(await sh('pkg-config', ['--exists', ...LIBS])).ok) r.faltando.push('ffmpeg');
    if (!(await sh('sh', ['-c', 'command -v pkexec'])).ok) r.faltando.push('pkexec');
    if (!r.aparelho) r.faltando.push('placa');
    r.suportado = !r.faltando.includes('ffmpeg') && !r.faltando.includes('placa');
    r.instalado = existe(BIN);
    if (r.instalado) {
      let v = ''; try { v = fs.readFileSync(BIN + '.versao', 'utf8').trim(); } catch (e) { /* ok */ }
      const cap = await sh('getcap', [BIN]);
      r.permissao = /cap_sys_admin/.test(cap.out);
      r.atual = v === hashFonte() && r.permissao;
    }
    r.pronto = r.suportado && r.instalado && r.atual;
    r.motivo = r.pronto ? 'ok' : !r.suportado ? 'faltando' : r.instalado ? 'desatualizado' : 'nao-instalado';
    cache = r;
    return r;
  }

  async function compilar() {
    const pasta = path.join(pastaDados, 'nativo'); fs.mkdirSync(pasta, { recursive: true });
    const saida = path.join(pasta, 'aero-kms-' + hashFonte());
    const flags = await sh('pkg-config', ['--cflags', '--libs', ...LIBS]);
    if (!flags.ok) return { ok: false, erro: 'ffmpeg (pkg-config): ' + flags.erro.slice(0, 200) };
    // No app instalado a fonte fica dentro do asar, que o cc não enxerga: compila uma cópia
    const copia = saida + '.c'; fs.writeFileSync(copia, fs.readFileSync(FONTE));
    const r = await sh('cc', ['-O2', '-o', saida, copia, ...flags.out.trim().split(/\s+/)], { timeout: 120000 });
    try { fs.unlinkSync(copia); } catch {}
    if (!r.ok) return { ok: false, erro: 'compilar: ' + r.erro.slice(0, 400) };
    return { ok: true, arquivo: saida };
  }

  // O que roda como administrador vai inteiro no próprio comando do pkexec (não fica num arquivo que outro programa pudesse trocar).
  // (0.7.8) o programa compilado fica numa pasta do usuário: ele é copiado para a pasta do root e conferido pelo sha256 DEPOIS da cópia, e só então
  // ganha as permissões (trocar o arquivo enquanto a senha é pedida não adianta). cap_sys_nice: a prioridade da captura com um jogo pesado.
  const SCRIPT = 'set -e; mkdir -p "$1"; install -m 0755 -o root -g root "$2" "$1/aero-kms.novo"; '
    + 'if ! echo "$4  $1/aero-kms.novo" | sha256sum -c - >/dev/null; then rm -f "$1/aero-kms.novo"; exit 3; fi; '
    + 'setcap cap_sys_admin,cap_sys_nice+ep "$1/aero-kms.novo"; mv -f "$1/aero-kms.novo" "$1/aero-kms"; printf %s "$3" > "$1/aero-kms.versao"; chmod 0644 "$1/aero-kms.versao"';
  async function instalar() {
    const e = await estado(true);
    if (!e.suportado) return { ok: false, motivo: 'faltando', faltando: e.faltando };
    const c = await compilar();
    if (!c.ok) { log('kms: ' + c.erro); return { ok: false, motivo: 'compilar', erro: c.erro }; }
    const sha = crypto.createHash('sha256').update(fs.readFileSync(c.arquivo)).digest('hex');
    const r = await sh('pkexec', ['/bin/sh', '-c', SCRIPT, 'aero-kms', PASTA, c.arquivo, hashFonte(), sha], { timeout: 180000 });
    try { fs.unlinkSync(c.arquivo); } catch (er) { /* ok */ }
    if (!r.ok) { log('kms: instalar ' + r.erro.slice(0, 300)); return { ok: false, motivo: /dismissed|Not authorized|126|127/i.test(r.erro) ? 'cancelado' : 'instalar', erro: r.erro.slice(0, 300) }; }
    const depois = await estado(true);
    log('kms: instalado em ' + BIN + (depois.pronto ? '' : ' (mas não ficou pronto: ' + depois.motivo + ')'));
    return { ok: depois.pronto, motivo: depois.motivo };
  }
  async function desinstalar() {
    const r = await sh('pkexec', ['/bin/sh', '-c', 'rm -f "$1/aero-kms" "$1/aero-kms.versao" "$1/aero-kms.novo"; rmdir "$1" 2>/dev/null || true', 'aero-kms', PASTA], { timeout: 120000 });
    cache = null;
    return { ok: r.ok };
  }

  // liga a captura. aoQuadro({ chave, us, dados }); aoFim(motivo). Devolve quando o 1º quadro sai (ou falha em 4 s)
  function iniciar({ fps = 60, altura = 1080, kbps = 4000, teste = false, binario } = {}, aoQuadro, aoFim) {
    parar();
    return new Promise((resolve) => {
      const exe = binario || BIN, dev = aparelho() || '/dev/dri/card0';
      const args = teste ? ['--teste', '--fps', String(fps), '--altura', String(altura), '--kbps', String(kbps)] : ['--aparelho', dev, '--fps', String(fps), '--altura', String(altura), '--kbps', String(kbps)];
      let p; try { p = spawn(exe, args, { stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return resolve({ ok: false, erro: e.message }); }
      proc = p;
      let respondeu = false, info = null, ultimoErro = '';
      const t = setTimeout(() => { if (!respondeu) { respondeu = true; resolve({ ok: false, erro: ultimoErro || 'sem imagem em 4 s' }); parar(); } }, 4000);
      const ler = criarLeitor((q) => {
        if (!respondeu) { respondeu = true; clearTimeout(t); resolve({ ok: true, ...(info || {}) }); }
        aoQuadro(q);
      });
      p.stdout.on('data', ler);
      let linhas = '';
      p.stderr.setEncoding('utf8');
      p.stderr.on('data', (d) => {
        linhas += d; let i;
        while ((i = linhas.indexOf('\n')) >= 0) {
          const l = linhas.slice(0, i).trim(); linhas = linhas.slice(i + 1);
          if (l.startsWith('PRONTO ')) { const [, w, h, f] = l.split(' ').map(Number); info = { larg: w, alt: h, fps: f }; log('kms: captura direta ' + w + 'x' + h + ' ' + f + ' fps'); }
          else if (l.startsWith('ERRO ')) { ultimoErro = l.slice(5); log('kms: ' + ultimoErro); }
          else if (l.startsWith('CANAL ')) log('kms: canal ' + l.slice(6));
          else if (l && !l.startsWith('TAXA')) log('kms: ' + l.slice(0, 200));
        }
      });
      p.stdin.on('error', () => { /* o programa saiu */ });
      p.on('error', (e) => { ultimoErro = e.message; });
      p.on('exit', (code) => {
        const atual = proc === p; // parado de propósito (parar, ou trocar a resolução) já não é o atual: não é "a captura parou sozinha"
        if (atual) proc = null;
        clearTimeout(t);
        if (!respondeu) { respondeu = true; resolve({ ok: false, erro: ultimoErro || 'saiu (' + code + ')' }); return; }
        if (aoFim && atual) aoFim(ultimoErro || 'saiu (' + code + ')');
      });
    });
  }
  const canalOk = (c) => Number.isInteger(c) && c >= 0 && c < 8;
  const lim = (v, a, b, pad) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : pad; };
  const mandar = (l) => { try { if (proc && proc.stdin.writable) proc.stdin.write(l + '\n'); } catch (e) { /* ok */ } };
  function parar() {
    const p = proc; proc = null; if (!p) return;
    try { p.stdin.write('Q\n'); p.stdin.end(); } catch (e) { /* ok */ }
    setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) { /* ok */ } }, 1500).unref();
  }
  return {
    estado, instalar, desinstalar, iniciar, parar,
    // (0.7.6) um codificador por pessoa ("canal", 0-7): sem canal, vale para todos (quadro inteiro) ou para o canal 0 (taxa)
    idr: (c) => mandar(canalOk(c) ? 'K ' + c : 'K'),
    taxa: (k, c) => mandar(canalOk(c) ? 'B ' + c + ' ' + Math.round(k) : 'B ' + Math.round(k)),
    canal: (c, { alt, fps, kbps } = {}) => { if (canalOk(c)) mandar('C ' + c + ' ' + lim(alt, 144, 4320, 1080) + ' ' + lim(fps, 10, 240, 60) + ' ' + lim(kbps, 300, 150000, 4000)); },
    fecharCanal: (c) => { if (canalOk(c)) mandar('X ' + c); },
    ativo: () => !!proc,
    _compilar: compilar,
  };
}

module.exports = { criarKms, criarLeitor };
