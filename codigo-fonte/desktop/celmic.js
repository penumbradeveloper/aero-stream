// Aero - (1.0.2) Celular como microfone: um servidor pequeno, só na rede local, para o celular (no mesmo Wi-Fi) mandar o áudio do microfone
// para a chamada. Criado por Ryan Victtor.
//
// Por que HTTPS: o navegador do celular só libera o microfone numa página segura. O certificado é criado na hora (fica só na memória e
// morre quando o servidor desliga); o celular mostra um aviso uma vez e segue.
//
// As travas (todas testadas em testes/celmic.test.mjs):
//  - escuta só no endereço de rede local do PC (nunca em 0.0.0.0) e só atende IPs de rede privada (10/8, 172.16/12, 192.168/16 e link-local);
//    qualquer outro é derrubado já na conexão;
//  - o Host tem que ser exatamente o IP:porta do PC e a Origem (quando vem, e sempre nos POST) a própria página: um site de fora que tente
//    "DNS rebinding" ou mandar um formulário para cá é recusado. Nenhum cabeçalho de CORS, nunca;
//  - código de pareamento curto, de uso único, que vale 2 minutos e aceita só 5 tentativas erradas (depois só o PC gera outro);
//  - o PC precisa confirmar ("Permitir o celular X?") antes de qualquer coisa; uma conexão por vez;
//  - a sessão usa um token aleatório forte (32 bytes), preso ao IP que pareou;
//  - só áudio: a única coisa que passa é a oferta WebRTC com UMA trilha de áudio (sem vídeo, sem canal de dados). Não há comando, arquivo
//    nem tela: o servidor só conhece estas três rotas;
//  - desliga sozinho quando a integração é desligada ou a chamada termina (quem chama é a interface e o main.js);
//  - o log nunca leva o código, o token, o IP nem o SDP.
'use strict';
const crypto = require('crypto');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');

const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // sem 0/O, 1/I/L: fácil de digitar no celular
const TAM_CODIGO = 6;
const VALIDADE_MS = 2 * 60 * 1000;
const MAX_TENTATIVAS = 5;
const ESPERA_DECISAO_MS = 60 * 1000;
const ESPERA_RESPOSTA_MS = 15 * 1000;
const MAX_CORPO = 24 * 1024;
const MAX_SDP = 16000;
const MAX_CONEXOES = 8;

// ---------- endereços ----------
const ipv4Num = (ip) => {
  const p = String(ip).split('.'); if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) { if (!/^\d{1,3}$/.test(x) || +x > 255) return null; n = n * 256 + +x; }
  return n;
};
// tira colchetes, a zona (%eth0) e o prefixo ::ffff: de IPv4 dentro de IPv6
function normalizarIp(ip) {
  let s = String(ip == null ? '' : ip).trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const z = s.indexOf('%'); if (z >= 0) s = s.slice(0, z);
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s); if (m) return m[1];
  return s;
}
const dentro = (n, base, bits) => (n >>> (32 - bits)) === (ipv4Num(base) >>> (32 - bits));
// só rede privada: 10/8, 172.16/12, 192.168/16 e link-local (169.254/16 e fe80::/10). Loopback, IP público e o resto: não
function ipPrivado(ip) {
  const s = normalizarIp(ip);
  if (net.isIPv4(s)) { const n = ipv4Num(s); return n != null && (dentro(n, '10.0.0.0', 8) || dentro(n, '172.16.0.0', 12) || dentro(n, '192.168.0.0', 16) || dentro(n, '169.254.0.0', 16)); }
  if (net.isIPv6(s)) { const p = s.split(':')[0]; return !!p && (parseInt(p, 16) & 0xffc0) === 0xfe80; }
  return false;
}
// o endereço do PC na rede local (o que vai no QR code): IPv4, não interno, privado; prefere 192.168, depois 10, depois 172.16 (link-local por último)
// redes virtuais que o celular não alcança: no Linux (docker, libvirt, VPNs...) e no Windows (WSL/Hyper-V "vEthernet", VirtualBox, VMware,
// Bluetooth, VPNs). O VirtualBox do Windows usa 192.168.56.x: sem isso ele ganharia do Wi-Fi de verdade
const virtual = (nome) => /^(docker|br-|veth|virbr|vmnet|vboxnet|zt|tailscale|wg|tun|tap|utun|lxc|lxd|cni|flannel|podman)/i.test(nome)
  || /vEthernet|Hyper-V|VirtualBox|VMware|Virtual|Bluetooth|Loopback|Npcap|TAP-|Tailscale|ZeroTier|WireGuard|OpenVPN|Radmin|Hamachi|NordLynx|WSL/i.test(nome);
// a placa que leva para a internet (a "rota padrão"): é ela que está no Wi-Fi/cabo de casa. Um socket UDP "conectado" não manda nada
// pela rede, só pergunta ao sistema por qual IP sairia. Funciona igual no Linux e no Windows
function ipDaRota(destino = '1.1.1.1') {
  if (!net.isIPv4(destino)) return Promise.resolve(null); // só IP: nome faria uma consulta de DNS
  return new Promise((ok) => {
    let s; const fim = (v) => { try { s && s.close(); } catch (e) { /* ok */ } ok(v && v !== '0.0.0.0' ? v : null); };
    try {
      s = require('dgram').createSocket('udp4');
      s.once('error', () => fim(null));
      s.connect(53, destino, () => { let a = null; try { a = s.address().address; } catch (e) { /* ok */ } fim(a); });
      setTimeout(() => fim(null), 1500).unref();
    } catch (e) { fim(null); }
  });
}
// a rota padrão quando ela é de rede local e de uma placa de verdade; senão, a melhor da lista
function escolherIpPelaRota(rota, ifs = os.networkInterfaces()) {
  if (rota && ipPrivado(rota)) for (const [nome, lista] of Object.entries(ifs || {})) {
    if (virtual(nome)) continue;
    for (const x of lista || []) if (x && !x.internal && x.address === rota) return rota;
  }
  return escolherIp(ifs);
}
function escolherIp(ifs = os.networkInterfaces()) {
  const l = [];
  for (const [nome, lista] of Object.entries(ifs || {})) for (const x of lista || []) {
    if (!x || x.internal || !(x.family === 'IPv4' || x.family === 4) || !ipPrivado(x.address)) continue;
    if (virtual(nome)) continue; // redes virtuais: o celular não alcança
    const a = x.address, pri = a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : a.startsWith('169.254.') ? 3 : 2;
    l.push({ a, pri });
  }
  l.sort((x, y) => x.pri - y.pri);
  return l.length ? l[0].a : null;
}
const hostOk = (host, ip, porta) => typeof host === 'string' && host.toLowerCase() === `${ip}:${porta}`;
const origemDe = (ip, porta) => `https://${ip}:${porta}`;
const origemOk = (origem, ip, porta) => typeof origem === 'string' && origem === origemDe(ip, porta);

// ---------- código e token ----------
function gerarCodigo(aleatorio = crypto.randomBytes) {
  let s = '';
  const limite = 256 - (256 % ALFABETO.length); // sem viés: descarta o que passa do último múltiplo
  while (s.length < TAM_CODIGO) for (const b of aleatorio(16)) { if (b < limite && s.length < TAM_CODIGO) s += ALFABETO[b % ALFABETO.length]; }
  return s;
}
const limparCodigo = (c) => String(c == null ? '' : c).toUpperCase().replace(/[\s-]/g, '').slice(0, 16);
// comparação em tempo constante (pelo hash, para os tamanhos baterem)
const iguais = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const novoToken = () => crypto.randomBytes(32).toString('base64url');

// o pareamento: um código por vez, uso único, 2 minutos, 5 tentativas erradas. Sem o PC gerar outro, acabou.
function criarPareamento({ agora = Date.now, aleatorio = crypto.randomBytes } = {}) {
  let cod = null;
  return {
    novo() { cod = { valor: gerarCodigo(aleatorio), expira: agora() + VALIDADE_MS, erros: 0 }; return { codigo: cod.valor, expira: cod.expira }; },
    atual() { if (cod && agora() > cod.expira) cod = null; return cod ? { codigo: cod.valor, expira: cod.expira, restam: MAX_TENTATIVAS - cod.erros } : null; },
    descartar() { cod = null; },
    // 'ok' (e o código morre) | 'errado' | 'bloqueado' (errou demais: morreu) | 'expirado' | 'sem-codigo'
    conferir(tentativa) {
      if (!cod) return 'sem-codigo';
      if (agora() > cod.expira) { cod = null; return 'expirado'; }
      if (iguais(limparCodigo(tentativa), cod.valor)) { cod = null; return 'ok'; }
      cod.erros++;
      if (cod.erros >= MAX_TENTATIVAS) { cod = null; return 'bloqueado'; }
      return 'errado';
    },
  };
}

// ---------- o que passa: só uma oferta WebRTC de áudio ----------
// exatamente uma linha m= e ela é de áudio; nada de vídeo, canal de dados (SCTP) ou outra mídia
function sdpSoAudio(sdp) {
  if (typeof sdp !== 'string' || sdp.length < 20 || sdp.length > MAX_SDP || !sdp.startsWith('v=0')) return false;
  if (/[^\x09\x0a\x0d\x20-\x7e]/.test(sdp)) return false;
  const linhas = sdp.split(/\r?\n/);
  const ms = linhas.filter((l) => l.startsWith('m='));
  if (ms.length !== 1 || !/^m=audio \d+ (UDP\/TLS\/RTP\/SAVPF|RTP\/SAVPF) [\d ]+$/.test(ms[0])) return false;
  if (linhas.some((l) => /^a=(sctp-port|sctpmap|max-message-size)/.test(l))) return false;
  return true;
}
// o nome que aparece no "Permitir o celular X?": o que a pessoa digitou ou o modelo que o navegador conta
function nomeCelular(nome, ua) {
  const limpo = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
  const n = limpo(nome); if (n) return n;
  const u = String(ua || '').slice(0, 400);
  const and = /Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/.exec(u);
  if (and && and[1] && !/^(K|wv)$/i.test(and[1].trim())) return limpo(and[1]);
  if (/iPhone/.test(u)) return 'iPhone';
  if (/iPad/.test(u)) return 'iPad';
  if (/Android/.test(u)) return 'Android';
  return 'Celular';
}

// ---------- o certificado (criado na hora, autoassinado, EC P-256) ----------
const der = (tag, ...partes) => {
  const corpo = Buffer.concat(partes.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))));
  const n = corpo.length;
  const tam = n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 255]);
  return Buffer.concat([Buffer.from([tag]), tam, corpo]);
};
const seq = (...p) => der(0x30, ...p);
const oid = (s) => {
  const p = s.split('.').map(Number), b = [p[0] * 40 + p[1]];
  for (const x of p.slice(2)) { const t = []; let v = x; do { t.unshift(v & 127); v = Math.floor(v / 128); } while (v); for (let i = 0; i < t.length - 1; i++) t[i] |= 128; b.push(...t); }
  return der(0x06, Buffer.from(b));
};
const utc = (d) => der(0x17, Buffer.from(d.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z'));
function criarCertificado(ip) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const serie = crypto.randomBytes(16); serie[0] &= 0x7f; serie[0] |= 0x01;
  const nome = seq(der(0x31, seq(oid('2.5.4.3'), der(0x0c, Buffer.from('Aero - celular como microfone')))));
  const alg = seq(oid('1.2.840.10045.4.3.2')); // ecdsa-with-SHA256
  const agora = Date.now();
  const ipBytes = Buffer.from(String(ip).split('.').map(Number));
  const san = seq(oid('2.5.29.17'), der(0x04, seq(der(0x87, ipBytes)))); // subjectAltName: o IP do PC
  const tbs = seq(der(0xa0, der(0x02, Buffer.from([2]))), der(0x02, serie), alg, nome, seq(utc(new Date(agora - 3600e3)), utc(new Date(agora + 2 * 86400e3))), nome,
    publicKey.export({ type: 'spki', format: 'der' }), der(0xa3, seq(san)));
  const assinatura = crypto.sign('sha256', tbs, privateKey);
  const cert = seq(tbs, alg, der(0x03, Buffer.from([0]), assinatura));
  const pem = '-----BEGIN CERTIFICATE-----\n' + cert.toString('base64').match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n';
  return { cert: pem, key: privateKey.export({ type: 'pkcs8', format: 'pem' }), digital: crypto.createHash('sha256').update(cert).digest('hex').slice(0, 16).toUpperCase() };
}

// ---------- as respostas ----------
const CABECALHOS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin', // (com "no-referrer" o navegador mandaria Origem "null" nos POST)
  'Cache-Control': 'no-store',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), display-capture=()',
  'Strict-Transport-Security': 'max-age=0',
};
const PASTA = path.join(__dirname, 'celmic-pagina');
const ARQUIVOS = { '/': ['index.html', 'text/html; charset=utf-8'], '/celular.js': ['celular.js', 'text/javascript; charset=utf-8'], '/celular.css': ['celular.css', 'text/css; charset=utf-8'] };
const cacheArq = new Map();
const lerArq = (n) => { if (!cacheArq.has(n)) { try { cacheArq.set(n, fs.readFileSync(path.join(PASTA, n))); } catch (e) { cacheArq.set(n, Buffer.from('')); } } return cacheArq.get(n); };
const json = (status, obj) => ({ status, tipo: 'application/json; charset=utf-8', corpo: JSON.stringify(obj) });
const erro = (status, e) => json(status, { erro: e });

// ---------- o servidor ----------
// avisar(evento) manda para a interface: { tipo: 'pedido', id, nome } | { tipo: 'oferta', id, sdp } | { tipo: 'sessao', ativa } | { tipo: 'codigo' } | { tipo: 'desligou' }
function criarCelMic({ log = () => {}, avisar = () => {}, agora = Date.now, interfaces = () => os.networkInterfaces(), rota = ipDaRota, ipFixo = null, https = require('https') } = {}) {
  const par = criarPareamento({ agora });
  let srv = null, ip = null, porta = 0, digital = '', ligando = null;
  let pedido = null, sessao = null;
  const respostas = new Map(); // id da oferta -> { ok, t }
  const conexoes = new Set();

  const fimSessao = (motivo) => {
    if (!sessao) return;
    sessao = null;
    for (const [, r] of respostas) { clearTimeout(r.t); r.ok(null); }
    respostas.clear();
    log('celular-microfone: sessão encerrada (' + motivo + ')');
    avisar({ tipo: 'sessao', ativa: false, motivo });
  };
  const fimPedido = (sim) => { if (!pedido) return; const p = pedido; pedido = null; clearTimeout(p.t); p.ok(!!sim); };

  // o núcleo (sem rede, para os testes): recebe o que importa do pedido HTTP e devolve { status, tipo, corpo }
  async function processar({ metodo, caminho, host, origem, ip: deIp, tipoCorpo, sfs, ua, corpo } = {}) {
    if (!srv && !processar._teste) return erro(503, 'desligado');
    if (!ipPrivado(deIp)) return erro(403, 'rede');
    if (!hostOk(host, ip, porta)) return erro(421, 'host');
    if (origem !== undefined && origem !== null && !origemOk(origem, ip, porta)) return erro(403, 'origem');
    if (sfs && sfs !== 'same-origin' && sfs !== 'none') return erro(403, 'origem');
    const cam = String(caminho || '/').split('?')[0];
    if (metodo === 'GET' || metodo === 'HEAD') {
      const a = ARQUIVOS[cam]; if (!a) return erro(404, 'nada');
      return { status: 200, tipo: a[1], corpo: lerArq(a[0]) };
    }
    if (metodo !== 'POST') return erro(405, 'metodo'); // OPTIONS também: aqui não tem CORS
    if (!origemOk(origem, ip, porta)) return erro(403, 'origem'); // POST sem a origem da própria página: não
    if (!/^application\/json(\s*;.*)?$/i.test(String(tipoCorpo || ''))) return erro(415, 'tipo');
    let d; try { d = JSON.parse(String(corpo || '')); } catch (e) { return erro(400, 'json'); }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return erro(400, 'json');

    if (cam === '/api/parear') {
      if (sessao || pedido) return erro(409, 'ocupado'); // uma conexão por vez
      const r = par.conferir(d.codigo);
      if (r !== 'ok') { log('celular-microfone: código recusado (' + r + ')'); if (r === 'bloqueado' || r === 'expirado') avisar({ tipo: 'codigo' }); return erro(403, r); }
      avisar({ tipo: 'codigo' });
      const id = crypto.randomBytes(8).toString('hex'), nome = nomeCelular(d.nome, ua);
      const sim = await new Promise((ok) => { pedido = { id, ok, t: setTimeout(() => fimPedido(false), ESPERA_DECISAO_MS) }; avisar({ tipo: 'pedido', id, nome }); });
      if (!sim) { log('celular-microfone: pedido recusado'); return erro(403, 'recusado'); }
      if (!srv && !processar._teste) return erro(503, 'desligado');
      sessao = { token: novoToken(), ip: normalizarIp(deIp), nome, sinal: false, desde: agora() };
      log('celular-microfone: celular permitido');
      avisar({ tipo: 'sessao', ativa: true, nome });
      return json(200, { token: sessao.token });
    }
    // daqui para baixo: só a sessão que o PC permitiu, do mesmo IP
    if (!sessao || typeof d.token !== 'string' || d.token.length > 200 || !iguais(d.token, sessao.token) || normalizarIp(deIp) !== sessao.ip) return erro(401, 'sessao');
    if (cam === '/api/sinal') {
      if (sessao.sinal) return erro(409, 'ja');
      if (!sdpSoAudio(d.sdp)) return erro(400, 'sdp');
      sessao.sinal = true;
      const id = crypto.randomBytes(8).toString('hex');
      const resp = await new Promise((ok) => { respostas.set(id, { ok, t: setTimeout(() => { respostas.delete(id); ok(null); }, ESPERA_RESPOSTA_MS) }); avisar({ tipo: 'oferta', id, sdp: d.sdp }); });
      if (!resp || !sdpSoAudio(resp)) { fimSessao('sem resposta'); return erro(502, 'resposta'); }
      return json(200, { sdp: resp });
    }
    if (cam === '/api/fim') { fimSessao('celular'); return json(200, { ok: true }); }
    return erro(404, 'nada');
  }

  function tratar(req, res) {
    const sock = req.socket || {};
    let tam = 0; const pedacos = [];
    let cortado = false;
    req.on('data', (c) => { tam += c.length; if (tam > MAX_CORPO) { cortado = true; req.destroy(); return; } pedacos.push(c); });
    req.on('end', async () => {
      if (cortado) return;
      let r;
      try {
        r = await processar({ metodo: req.method, caminho: req.url, host: req.headers.host, origem: req.headers.origin, ip: sock.remoteAddress, tipoCorpo: req.headers['content-type'], sfs: req.headers['sec-fetch-site'], ua: req.headers['user-agent'], corpo: Buffer.concat(pedacos).toString('utf8') });
      } catch (e) { r = erro(500, 'erro'); }
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(r.status, { ...CABECALHOS, 'Content-Type': r.tipo, 'Content-Length': Buffer.byteLength(r.corpo) });
      res.end(req.method === 'HEAD' ? undefined : r.corpo);
    });
  }

  async function ligar() {
    if (srv) return info();
    if (ligando) return ligando;
    ligando = (async () => {
      const meuIp = ipFixo || escolherIpPelaRota(await rota(), interfaces());
      if (!meuIp) { const e = new Error('sem rede local'); e.codigo = 'sem-rede'; throw e; }
      const c = criarCertificado(meuIp);
      const s = https.createServer({ key: c.key, cert: c.cert, minVersion: 'TLSv1.2' }, tratar);
      s.headersTimeout = 10000; s.requestTimeout = ESPERA_DECISAO_MS + 15000; s.keepAliveTimeout = 5000;
      s.maxHeadersCount = 40;
      // a primeira barreira: quem não é da rede local nem chega a falar
      s.on('connection', (sock) => {
        if (!ipPrivado(sock.remoteAddress) || conexoes.size >= MAX_CONEXOES) { sock.destroy(); return; }
        conexoes.add(sock); sock.on('close', () => conexoes.delete(sock));
      });
      s.on('tlsClientError', () => { /* o celular recusou o certificado (é normal até a pessoa aceitar o aviso) */ });
      await new Promise((ok, falha) => { s.once('error', falha); s.listen({ port: 0, host: meuIp, exclusive: true }, ok); });
      s.removeAllListeners('error'); s.on('error', (e) => log('celular-microfone: erro no servidor', e && e.code));
      srv = s; ip = meuIp; porta = s.address().port; digital = c.digital;
      par.novo();
      log('celular-microfone: servidor local ligado');
      return info();
    })();
    try { return await ligando; } finally { ligando = null; }
  }
  function info() {
    if (!srv && !processar._teste) return { ligado: false };
    const c = par.atual();
    return { ligado: true, ip, porta, url: origemDe(ip, porta) + '/', codigo: c ? c.codigo : '', expira: c ? c.expira : 0, digital, so: process.platform, sessao: sessao ? { nome: sessao.nome } : null, pedido: !!pedido };
  }
  function desligar() {
    fimPedido(false); fimSessao('desligou'); par.descartar();
    if (!srv) return { ligado: false };
    const s = srv; srv = null; ip = null; porta = 0;
    try { s.close(); } catch (e) { /* ok */ }
    for (const c of conexoes) { try { c.destroy(); } catch (e) { /* ok */ } }
    conexoes.clear();
    log('celular-microfone: servidor local desligado');
    avisar({ tipo: 'desligou' });
    return { ligado: false };
  }

  return {
    ligar, desligar, info, processar,
    novoCodigo: () => { if (!srv && !processar._teste) return info(); if (!sessao && !pedido) par.novo(); return info(); },
    decidir: (id, sim) => { if (pedido && typeof id === 'string' && id === pedido.id) fimPedido(!!sim); return info(); },
    responder: (id, sdp) => { const r = respostas.get(id); if (!r) return false; respostas.delete(id); clearTimeout(r.t); r.ok(typeof sdp === 'string' ? sdp : null); return true; },
    encerrar: () => { fimSessao('pc'); return info(); },
    _teste: (meuIp, minhaPorta) => { processar._teste = true; ip = meuIp; porta = minhaPorta; par.novo(); return par; },
  };
}

module.exports = { criarCelMic, criarPareamento, ipPrivado, normalizarIp, escolherIp, escolherIpPelaRota, ipDaRota, hostOk, origemOk, sdpSoAudio, nomeCelular, gerarCodigo, criarCertificado, VALIDADE_MS, MAX_TENTATIVAS, ALFABETO, TAM_CODIGO };
