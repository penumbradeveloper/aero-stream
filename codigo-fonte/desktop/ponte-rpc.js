// Aero Stream - (1.0.0) "Atividade de jogo": recebe a atividade que os jogos mandam pelo protocolo local do Discord (o mesmo "canal" de
// discord.js, ao contrário: aqui o Aero é quem ouve). Dois usos:
//  1) SDK do Aero: o canal "aero-ipc-0" (socket no Linux, pipe no Windows). Qualquer biblioteca de presença do Discord funciona trocando
//     só o nome do canal; o Aero aceita também "name" na atividade (o jogo não precisa ter um aplicativo no Discord).
//  2) Ponte do Discord: o Aero ocupa o canal "discord-ipc-0" que os jogos procuram e repassa tudo, byte a byte, ao Discord de verdade
//     (que fica num outro número). O jogo e o Discord nem percebem; no caminho o Aero lê o SET_ACTIVITY (o Red Dead mandando "Modo
//     história, Saint Denis", por exemplo). Sem o Discord aberto, o próprio Aero responde como se fosse ele.
//     No Linux, se o Discord já estiver no 0, o Aero muda o nome do socket dele (continua funcionando no nome novo), entra no lugar e
//     repassa; ao fechar devolve o nome. No Windows não dá para tomar o lugar: a ponte só funciona se o Aero abrir antes do Discord.
// Nada daqui sai do computador. Criado por Ryan Victtor.
'use strict';
const net = require('net');
const fs = require('fs');
const path = require('path');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const MAX_QUADRO = 1 << 18; // 256 KB: nenhuma atividade chega perto disso
const MAX_CONEXOES = 24;

function quadro(op, obj) {
  const corpo = Buffer.from(JSON.stringify(obj), 'utf8');
  const b = Buffer.alloc(8 + corpo.length);
  b.writeInt32LE(op, 0); b.writeInt32LE(corpo.length, 4); corpo.copy(b, 8);
  return b;
}

// lê quadros de um fluxo de bytes (devolve null se vier lixo: quem mandou é desconectado)
function leitor(aoQuadro) {
  let buf = Buffer.alloc(0);
  return (d) => {
    buf = buf.length ? Buffer.concat([buf, d]) : d;
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0), n = buf.readInt32LE(4);
      if (op < 0 || op > 4 || n < 0 || n > MAX_QUADRO) return false;
      if (buf.length < 8 + n) break;
      let msg = null; try { msg = JSON.parse(buf.subarray(8, 8 + n).toString('utf8')); } catch (e) { msg = null; }
      buf = buf.subarray(8 + n);
      aoQuadro(op, msg);
    }
    if (buf.length > MAX_QUADRO + 8) return false;
    return true;
  };
}

// a resposta READY que o Discord manda depois do handshake (um usuário de mentira: o jogo só confere se veio)
const READY = () => ({ cmd: 'DISPATCH', evt: 'READY', nonce: null, data: { v: 1, config: { cdn_host: 'cdn.discordapp.com', api_endpoint: '//discord.com/api', environment: 'production' },
  user: { id: '1', username: 'aero', discriminator: '0', global_name: 'Aero', avatar: null, avatar_decoration_data: null, bot: false, flags: 0, premium_type: 0 } } });

const idOk = (v) => (/^[A-Za-z0-9_.:-]{1,64}$/.test(String(v == null ? '' : v)) ? String(v) : '');

// diretório onde os jogos procuram o canal (a mesma ordem das bibliotecas do Discord: XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP, /tmp)
function pastaCanal(env = process.env) { return [env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, '/tmp'].find((p) => p && fs.existsSync(p)) || '/tmp'; }
function caminhoCanal(nome, i, { env = process.env, plataforma = process.platform } = {}) {
  return plataforma === 'win32' ? `\\\\.\\pipe\\${nome}-${i}` : path.join(pastaCanal(env), `${nome}-${i}`);
}

// alguém está ouvindo neste caminho?
function vivo(alvo, ms = 900) {
  return new Promise((ok) => {
    let feito = false; const fim = (v) => { if (feito) return; feito = true; clearTimeout(t); try { s.destroy(); } catch (e) { /* ok */ } ok(v); };
    const s = net.createConnection(alvo); const t = setTimeout(() => fim(false), ms);
    s.once('connect', () => fim(true)); s.once('error', () => fim(false));
  });
}
const inode = (p) => { try { const st = fs.lstatSync(p); return st.dev + ':' + st.ino; } catch (e) { return ''; } };

// Um servidor que fala o protocolo do Discord. "repassar" (opcional) devolve o caminho do Discord de verdade para a ponte.
function criarServidorRpc({ nome, origem, aoAtividade, log = () => {}, repassar = null }) {
  let srv = null, caminho = '', meuInode = '', n = 0;
  const conexoes = new Set();

  function atender(cli) {
    if (conexoes.size >= MAX_CONEXOES) { cli.destroy(); return; }
    const id = origem + ':' + (++n); conexoes.add(cli);
    let clientId = '', pid = 0, up = null, modo = 'esperando', pend = [], teveAtividade = false;
    const avisar = (atividade) => { teveAtividade = !!atividade; try { aoAtividade({ chave: id, origem, clientId, pid, atividade: atividade || null }); } catch (e) { /* ok */ } };
    const escrever = (op, obj) => { try { cli.write(quadro(op, obj)); } catch (e) { /* ok */ } };
    const fechar = () => { conexoes.delete(cli); if (teveAtividade) avisar(null); try { cli.destroy(); } catch (e) { /* ok */ } if (up) { try { up.destroy(); } catch (e) { /* ok */ } up = null; } };

    // o que o jogo mandou: lê (para nós) e, na ponte, deixa seguir para o Discord sem mexer em nada
    const ler = leitor((op, msg) => {
      if (op === OP.HANDSHAKE) {
        clientId = idOk(msg && msg.client_id);
        if (modo === 'local') escrever(OP.FRAME, READY());
        return;
      }
      if (op === OP.CLOSE) { fechar(); return; }
      if (op === OP.PING) { if (modo === 'local') escrever(OP.PONG, msg || {}); return; }
      if (op !== OP.FRAME || !msg || typeof msg !== 'object') return;
      if (msg.cmd === 'SET_ACTIVITY') {
        const a = msg.args || {};
        const p = Number(a.pid); if (Number.isInteger(p) && p > 0 && p < 2 ** 31) pid = p;
        const at = a.activity && typeof a.activity === 'object' ? a.activity : null;
        avisar(at);
        if (modo === 'local') escrever(OP.FRAME, { cmd: 'SET_ACTIVITY', evt: null, nonce: msg.nonce == null ? null : msg.nonce, data: at ? { ...at, application_id: clientId, name: (at.name && String(at.name).slice(0, 128)) || 'Aero', type: 0 } : null });
        return;
      }
      if (modo !== 'local') return;
      if (msg.cmd === 'SUBSCRIBE' || msg.cmd === 'UNSUBSCRIBE') escrever(OP.FRAME, { cmd: msg.cmd, evt: null, nonce: msg.nonce == null ? null : msg.nonce, data: { evt: msg.evt || null } });
      else escrever(OP.FRAME, { cmd: String(msg.cmd || '').slice(0, 64), evt: null, nonce: msg.nonce == null ? null : msg.nonce, data: {} }); // o resto: "deu certo" e pronto
    });
    const aoDados = (d) => {
      if (!ler(d)) { fechar(); return; }
      if (modo === 'ponte' && up) { try { up.write(d); } catch (e) { fechar(); } }
      else if (modo === 'esperando') pend.push(d);
    };
    cli.on('data', aoDados);
    cli.on('error', fechar); cli.on('close', fechar);

    const virarLocal = () => {
      if (modo !== 'esperando') return;
      modo = 'local'; const p = pend; pend = [];
      if (clientId) escrever(OP.FRAME, READY()); // o handshake já tinha chegado enquanto procurávamos o Discord
      void p;
    };
    if (!repassar) { modo = 'local'; return; }
    Promise.resolve().then(repassar).then((alvo) => {
      if (!alvo || cli.destroyed) { virarLocal(); return; }
      const s = net.createConnection(alvo);
      const t = setTimeout(() => { s.destroy(); if (modo === 'esperando') virarLocal(); }, 1500);
      s.once('connect', () => {
        clearTimeout(t);
        if (cli.destroyed || modo !== 'esperando') { s.destroy(); return; }
        up = s; modo = 'ponte';
        for (const d of pend.splice(0)) s.write(d);
        s.on('data', (d) => { try { cli.write(d); } catch (e) { fechar(); } });
        s.on('close', fechar); s.on('error', fechar);
      });
      s.once('error', () => { clearTimeout(t); if (modo === 'esperando') virarLocal(); });
    }).catch(() => virarLocal());
  }

  function ouvir(alvo) {
    return new Promise((ok) => {
      const s = net.createServer(atender);
      s.once('error', (e) => ok({ erro: e.code || 'erro' }));
      s.listen(alvo, () => {
        s.removeAllListeners('error'); s.on('error', (e) => log(nome + ': ' + (e.code || e.message)));
        srv = s; caminho = alvo; meuInode = process.platform === 'win32' ? '' : inode(alvo);
        if (process.platform !== 'win32') { try { fs.chmodSync(alvo, 0o600); } catch (e) { /* ok */ } } // só a própria pessoa conecta
        ok({ ok: true });
      });
    });
  }
  function parar() {
    for (const c of [...conexoes]) { try { c.destroy(); } catch (e) { /* ok */ } }
    conexoes.clear();
    const s = srv, era = caminho, ino = meuInode; srv = null; caminho = ''; meuInode = '';
    if (s) { try { s.close(); } catch (e) { /* ok */ } }
    if (era && process.platform !== 'win32' && ino && inode(era) === ino) { try { fs.unlinkSync(era); } catch (e) { /* ok */ } } // só apaga se ainda for o nosso
  }
  return { ouvir, parar, caminho: () => caminho, aberto: () => !!srv, aindaMeu: () => !!srv && (process.platform === 'win32' || (!!meuInode && inode(caminho) === meuInode)) };
}

// ---------- SDK do Aero: aero-ipc-0 ----------
async function abrirSdk({ aoAtividade, log, env, plataforma = process.platform }) {
  const s = criarServidorRpc({ nome: 'sdk', origem: 'sdk', aoAtividade, log });
  for (let i = 0; i < 10; i++) {
    const alvo = caminhoCanal('aero-ipc', i, { env, plataforma });
    if (plataforma !== 'win32' && fs.existsSync(alvo)) { if (await vivo(alvo)) continue; try { fs.unlinkSync(alvo); } catch (e) { continue; } } // sobrou de um Aero que fechou errado
    const r = await s.ouvir(alvo);
    if (r.ok) return s;
  }
  return s;
}

// ---------- Ponte do Discord ----------
// caminhosDiscord(): todos os caminhos onde o Discord pode estar (discord.js). "assumir": no Linux, tomar o 0 mesmo com o Discord nele.
function criarPonte({ aoAtividade, log = () => {}, caminhosDiscord, env = process.env, plataforma = process.platform, assumir = plataforma === 'linux', checarMs = 10000 }) {
  const real0 = () => path.join(pastaCanal(env), '.aero-discord-ipc-0'); // o nome novo do socket do Discord enquanto o Aero está no 0
  const vaga0 = () => caminhoCanal('discord-ipc', 0, { env, plataforma });
  let srv = null, timer = 0, ligada = false, trabalhando = false;

  // onde está o Discord de verdade (nunca a própria ponte)
  async function discordReal() {
    const meu = srv && srv.caminho(), lista = [];
    if (plataforma !== 'win32') lista.push(real0());
    for (const c of caminhosDiscord()) if (c !== meu && !(plataforma === 'win32' && meu && c.toLowerCase().replace('\\\\?\\', '\\\\.\\') === meu.toLowerCase())) lista.push(c);
    const meuIno = meu && plataforma !== 'win32' ? inode(meu) : '';
    for (const c of lista) {
      if (plataforma !== 'win32') { if (!fs.existsSync(c)) continue; if (meuIno) { try { const a = fs.statSync(c), b = fs.statSync(meu); if (a.dev === b.dev && a.ino === b.ino) continue; } catch (e) { continue; } } }
      if (await vivo(c, 600)) return c;
    }
    return '';
  }

  // devolve o nome do Discord, se ele ficou com o nome trocado e o 0 está livre (o Aero fechou ou caiu).
  // Nunca apaga o socket do Discord: se o 0 estiver ocupado por outro programa vivo, o Discord só continua no nome trocado.
  const existe = (c) => { try { fs.lstatSync(c); return true; } catch (e) { return false; } };
  function devolver() { // na hora de fechar (síncrono): o nosso socket já foi apagado por srv.parar()
    if (plataforma === 'win32') return;
    const r = real0(), v = vaga0();
    if (!existe(r) || existe(v)) return;
    try { fs.renameSync(r, v); log('ponte: o canal do Discord voltou ao nome original'); } catch (e) { /* ok */ }
  }
  async function devolverAoAbrir() { // ao ligar: o 0 pode ser o socket morto de um Aero que caiu (fechado à força)
    if (plataforma === 'win32') return;
    const r = real0(), v = vaga0();
    if (!existe(r)) return;
    if (existe(v)) { if (srv && srv.aindaMeu()) return; if (await vivo(v)) return; try { fs.unlinkSync(v); } catch (e) { return; } }
    devolver();
  }
  // o Discord ainda responde no nome trocado? (três tentativas: um Discord ocupado demora a atender e nunca pode perder o canal por isso)
  async function discordMorto(c) { for (let i = 0; i < 3; i++) { if (await vivo(c, 1500)) return false; } return true; }

  async function garantir() {
    if (!ligada || trabalhando) return;
    trabalhando = true;
    try {
      if (srv && srv.aindaMeu()) { // limpa o nome trocado se o Discord fechou
        if (plataforma !== 'win32' && fs.existsSync(real0()) && (await discordMorto(real0()))) { try { fs.unlinkSync(real0()); } catch (e) { /* ok */ } }
        return;
      }
      if (srv) { srv.parar(); srv = null; } // o Discord fechou e apagou o nosso socket (ele apaga o "dele" pelo nome): abre de novo
      const v = vaga0();
      if (plataforma === 'win32') {
        const s = criarServidorRpc({ nome: 'ponte', origem: 'discord', aoAtividade, log, repassar: discordReal });
        const r = await s.ouvir(v); if (r.ok) { srv = s; log('ponte: ouvindo os jogos no canal do Discord'); }
        return;
      }
      if (fs.existsSync(v) || (() => { try { fs.lstatSync(v); return true; } catch (e) { return false; } })()) {
        if (await vivo(v)) {
          if (!assumir) return;
          if (fs.existsSync(real0())) { if (!(await discordMorto(real0()))) return; try { fs.unlinkSync(real0()); } catch (e) { return; } }
          try { fs.renameSync(v, real0()); } catch (e) { return; }
          log('ponte: o canal do Discord mudou de nome para o Aero repassar os jogos');
        } else { try { fs.unlinkSync(v); } catch (e) { return; } } // sobrou de um programa que fechou
      }
      const s = criarServidorRpc({ nome: 'ponte', origem: 'discord', aoAtividade, log, repassar: discordReal });
      const r = await s.ouvir(v);
      if (r.ok) { srv = s; log('ponte: ouvindo os jogos no canal do Discord'); } else devolver();
    } finally { trabalhando = false; }
  }

  function ligar(v) {
    v = !!v; if (v === ligada) return;
    ligada = v;
    if (v) { devolverAoAbrir().finally(garantir); timer = setInterval(garantir, checarMs); if (timer.unref) timer.unref(); }
    else parar();
  }
  function parar() {
    ligada = false; clearInterval(timer); timer = 0;
    if (srv) { srv.parar(); srv = null; }
    devolver();
  }
  return { ligar, parar, garantir, discordReal, caminho: () => (srv ? srv.caminho() : ''), ativa: () => !!srv, _real0: real0 };
}

module.exports = { criarServidorRpc, criarPonte, abrirSdk, caminhoCanal, quadro, leitor, OP, READY };
