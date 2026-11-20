// SDK de atividade do Aero para Node.js (sem dependências). Mostra para os amigos no Aero o que o seu jogo ou app está fazendo:
// "Jogando Meu Jogo · Fase 3 · Modo difícil", com ícones e tempo. Mesmos campos da presença do Discord.
//
//   const { AeroAtividade } = require('./aero-atividade');
//   const aero = new AeroAtividade({ nome: 'Meu Jogo' });
//   aero.definir({ details: 'Fase 3', state: 'Modo difícil', timestamps: { start: Date.now() },
//                  assets: { large_image: 'https://i.imgur.com/capa.png', large_text: 'Meu Jogo' } });
//   ...
//   aero.limpar();   // tira a atividade
//   aero.fechar();   // desconecta (a atividade some sozinha)
//
// Conecta no canal local "aero-ipc-0" (socket em $XDG_RUNTIME_DIR no Linux, pipe \\.\pipe\aero-ipc-0 no Windows). Se o Aero não estiver
// aberto, tenta de novo a cada 15 s e manda a última atividade quando ele abrir. Licença MIT.
'use strict';
const net = require('net');
const path = require('path');
const fs = require('fs');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function caminhos(env = process.env, plataforma = process.platform) {
  if (env.AERO_IPC_PATH) return [env.AERO_IPC_PATH];
  const l = [];
  if (plataforma === 'win32') { for (let i = 0; i < 10; i++) l.push(`\\\\.\\pipe\\aero-ipc-${i}`); return l; }
  const bases = [...new Set([env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, '/tmp'].filter(Boolean))];
  for (let i = 0; i < 10; i++) for (const b of bases) l.push(path.join(b, `aero-ipc-${i}`));
  return l;
}
function quadro(op, obj) {
  const c = Buffer.from(JSON.stringify(obj), 'utf8'), b = Buffer.alloc(8 + c.length);
  b.writeInt32LE(op, 0); b.writeInt32LE(c.length, 4); c.copy(b, 8); return b;
}

class AeroAtividade {
  // nome: o nome do jogo/app que aparece em "Jogando ___". clientId (opcional): qualquer texto; se for o ID de um aplicativo do Discord,
  // o Aero também usa o nome e as imagens cadastradas nele. retentarMs: de quanto em quanto tempo procura o Aero.
  constructor({ nome = '', clientId = 'aero-sdk', retentarMs = 15000, aoConectar = null, aoDesconectar = null } = {}) {
    this.nome = String(nome || ''); this.clientId = String(clientId || 'aero-sdk'); this.retentarMs = retentarMs;
    this.aoConectar = aoConectar; this.aoDesconectar = aoDesconectar;
    this.sock = null; this.pronto = false; this.atividade = null; this.fechado = false; this.timer = null; this.buf = Buffer.alloc(0); this.n = 0;
    this._conectar();
  }
  get conectado() { return this.pronto; }

  // atividade: { details, state, timestamps: { start, end }, assets: { large_image, large_text, small_image, small_text },
  //              party: { id, size: [atual, máximo] }, name, type (0 jogando, 2 ouvindo, 3 assistindo, 5 competindo) }
  definir(atividade) {
    const a = atividade && typeof atividade === 'object' ? { ...atividade } : null;
    if (a && this.nome && !a.name) a.name = this.nome;
    this.atividade = a; this._enviar();
  }
  limpar() { this.definir(null); }
  fechar() {
    this.fechado = true; clearTimeout(this.timer);
    if (this.sock) { try { this.sock.write(quadro(OP.CLOSE, {})); this.sock.end(); } catch (e) { /* ok */ } }
    this.sock = null; this.pronto = false;
  }

  _enviar() {
    if (!this.pronto || !this.sock) return;
    try { this.sock.write(quadro(OP.FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: this.atividade || undefined }, nonce: String(++this.n) })); } catch (e) { /* reconecta sozinho */ }
  }
  _agendar() { clearTimeout(this.timer); if (this.fechado) return; this.timer = setTimeout(() => this._conectar(), this.retentarMs); if (this.timer.unref) this.timer.unref(); }
  _conectar() {
    if (this.fechado || this.sock) return;
    const lista = caminhos().filter((c) => process.platform === 'win32' || c.startsWith('\\\\') || fs.existsSync(c));
    let i = 0;
    const prox = () => {
      if (this.fechado) return;
      if (i >= lista.length) { this._agendar(); return; }
      const s = net.createConnection(lista[i++]); let aberto = false;
      s.once('connect', () => { aberto = true; this.sock = s; this.buf = Buffer.alloc(0); s.write(quadro(OP.HANDSHAKE, { v: 1, client_id: this.clientId })); });
      s.on('data', (d) => this._dados(s, d));
      s.on('error', () => { if (!aberto) prox(); });
      s.on('close', () => { if (this.sock !== s) return; const era = this.pronto; this.sock = null; this.pronto = false; if (era && this.aoDesconectar) this.aoDesconectar(); this._agendar(); });
    };
    prox();
  }
  _dados(s, d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 8) {
      const op = this.buf.readInt32LE(0), n = this.buf.readInt32LE(4);
      if (this.buf.length < 8 + n) return;
      let m = null; try { m = JSON.parse(this.buf.subarray(8, 8 + n).toString('utf8')); } catch (e) { /* ignora */ }
      this.buf = this.buf.subarray(8 + n);
      if (op === OP.PING) { try { s.write(quadro(OP.PONG, m || {})); } catch (e) { /* ok */ } continue; }
      if (op === OP.FRAME && m && m.evt === 'READY') { this.pronto = true; if (this.aoConectar) this.aoConectar(); this._enviar(); }
    }
  }
}

module.exports = { AeroAtividade, caminhos };
