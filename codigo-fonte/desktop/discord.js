// Aero Stream - Discord Rich Presence (Windows e Linux). Fala direto com o Discord que está aberto neste computador pelo canal
// local (pipe no Windows, socket no Linux), sem nenhuma biblioteca de fora. A interface manda só os textos e as imagens;
// aqui eles viram a "atividade" que aparece no perfil. Criado por Ryan Victtor.
//
// O "ID de aplicativo" do Aero Stream (1562611504962994217) já vem embutido em desktop/discord-id.json: ninguém precisa configurar nada.
// Ordem: 1) um ID digitado à mão (avançado, opcional), 2) o arquivo desktop/discord-id.json, 3) a variável AERO_DISCORD_APP_ID.
// Funciona com o Discord oficial (Stable, PTB, Canary; deb, Flatpak, Snap) e com clientes que falam o mesmo protocolo local:
// Vesktop (Vencord), Equibop (Equicord), ArmCord/Legcord e o arRPC (que dá Rich Presence ao Discord do navegador).
'use strict';
const net = require('net');
const fs = require('fs');
const path = require('path');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const MIN_ENTRE_ENVIOS = 2500; // o Discord limita as atualizações; juntamos várias mudanças em uma
const RETENTAR_MS = 15000;
const TEMPO_LIMITE = 4000;      // cada tentativa de canal (e a resposta READY) tem até 4 s     // se o Discord não estiver aberto, procura de novo a cada 15 s

// Caminhos onde o Discord pode estar ouvindo (de 0 a 9; também Flatpak e Snap no Linux)
function caminhos(env = process.env, plataforma = process.platform) {
  if (env.AERO_DISCORD_IPC) return env.AERO_DISCORD_IPC.split(path.delimiter).filter(Boolean);
  const lista = [];
  if (plataforma === 'win32') { for (let i = 0; i < 10; i++) lista.push(`\\\\?\\pipe\\discord-ipc-${i}`, `\\\\.\\pipe\\discord-ipc-${i}`); return lista; } // as duas formas do nome do pipe (alguns Windows só aceitam uma)
  const bases = [...new Set([env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, '/tmp'].filter(Boolean))];
  const subs = ['', 'app/com.discordapp.Discord', 'app/com.discordapp.DiscordCanary', 'app/com.discordapp.DiscordPTB', 'snap.discord', 'snap.discord-canary',
    'app/dev.vencord.Vesktop', '.flatpak/dev.vencord.Vesktop/xdg-run', 'app/io.github.equicord.equibop', '.flatpak/io.github.equicord.equibop/xdg-run', 'app/xyz.armcord.ArmCord', 'app/app.legcord.Legcord'];
  for (let i = 0; i < 10; i++) for (const b of bases) for (const s of subs) lista.push(path.join(b, s, `discord-ipc-${i}`));
  return lista;
}

function quadro(op, obj) {
  const corpo = Buffer.from(JSON.stringify(obj), 'utf8');
  const b = Buffer.alloc(8 + corpo.length);
  b.writeInt32LE(op, 0); b.writeInt32LE(corpo.length, 4); corpo.copy(b, 8);
  return b;
}

// ---------- limpeza dos textos que vêm da interface (nada confiável passa direto) ----------
const texto = (s, max = 128) => { s = String(s == null ? '' : s).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim(); return s.length >= 2 ? s.slice(0, max) : undefined; };
const imagem = (s) => { s = String(s == null ? '' : s).trim(); return /^https:\/\/[^\s"'<>]{4,240}$/.test(s) ? s : undefined; };

// dados da interface -> atividade do Discord (função pura: testável)
function montarAtividade(d) {
  const a = {};
  const detalhes = texto(d.linha1), estado = texto(d.linha2);
  if (detalhes) a.details = detalhes;
  if (estado) a.state = estado;
  const inicio = Number(d.inicio);
  if (inicio > 1e12) a.timestamps = { start: Math.floor(inicio / 1000) };
  const grande = imagem(d.grande), pequeno = imagem(d.pequeno);
  if (grande || pequeno) {
    a.assets = {};
    if (grande) { a.assets.large_image = grande; const t = texto(d.grandeTexto, 64); if (t) a.assets.large_text = t; }
    if (pequeno && grande) { a.assets.small_image = pequeno; const t = texto(d.pequenoTexto, 64); if (t) a.assets.small_text = t; } // o pequeno só aparece junto com o grande
  }
  a.instance = false;
  return a;
}

function lerIdDoArquivo() {
  try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'discord-id.json'), 'utf8')); return /^\d{15,25}$/.test(String(j.appId || '')) ? String(j.appId) : ''; } catch (e) { return ''; }
}

// listarCaminhos: (1.0.0) com a ponte da atividade de jogo no canal do Discord, o Aero fala direto com o Discord de verdade (não com a ponte)
function criarDiscord({ log = () => {}, pid = process.pid, retentarMs = RETENTAR_MS, minEntre = MIN_ENTRE_ENVIOS, lerIdPadrao = lerIdDoArquivo, listarCaminhos = caminhos } = {}) {
  let sock = null, pronto = false, conectando = false, buf = Buffer.alloc(0);
  let appId = '', ativo = false, atividade = null, ultimoErro = '';
  let timerEnvio = 0, timerRetentar = 0, ultEnvio = 0, enviadoChave = null, geracao = 0;

  const idPadrao = () => { const e = String(process.env.AERO_DISCORD_APP_ID || '').replace(/\D/g, ''); return lerIdPadrao() || (/^\d{15,25}$/.test(e) ? e : ''); };
  const estado = () => ({ conectado: pronto, semId: !(appId || idPadrao()), ativo, erro: ultimoErro || undefined });

  function fechar() {
    geracao++;
    clearTimeout(timerEnvio); timerEnvio = 0; clearTimeout(timerRetentar); timerRetentar = 0;
    const s = sock; sock = null; pronto = false; conectando = false; buf = Buffer.alloc(0); enviadoChave = null;
    if (s) { try { s.removeAllListeners(); s.on('error', () => {}); s.destroy(); } catch (e) { /* ok */ } }
  }
  function agendarRetentar() {
    clearTimeout(timerRetentar); timerRetentar = 0;
    if (!ativo || !appId) return;
    timerRetentar = setTimeout(() => { timerRetentar = 0; conectar(); }, retentarMs);
    if (timerRetentar.unref) timerRetentar.unref();
  }
  function perdeu(motivo) {
    const tinha = pronto || !!sock;
    sock = null; pronto = false; conectando = false; buf = Buffer.alloc(0); enviadoChave = null;
    if (tinha && motivo) log('discord: conexão encerrada (' + motivo + ')');
    agendarRetentar();
  }

  // tenta cada caminho possível até um responder
  function conectar() {
    if (sock || conectando || !ativo || !appId) return;
    conectando = true; const minha = ++geracao;
    const lista = listarCaminhos().filter((c) => process.platform === 'win32' || c.startsWith('\\\\') || fs.existsSync(c));
    let i = 0;
    const proximo = () => {
      if (minha !== geracao) return;
      if (i >= lista.length) { conectando = false; ultimoErro = 'discord-fechado'; agendarRetentar(); return; }
      const alvo = lista[i++]; let aberto = false;
      const s = net.createConnection(alvo);
      // No Windows um pipe ocupado (outro programa conectado, Discord travado) pode não responder nem dar erro: sem este limite o
      // app ficava "conectando" para sempre e o Rich Presence nunca aparecia. Também desiste se o Discord não disser READY.
      const limite = setTimeout(() => {
        if (minha !== geracao) return;
        if (!aberto) { s.removeAllListeners(); s.on('error', () => {}); s.destroy(); proximo(); }
        else if (sock === s && !pronto) { ultimoErro = 'sem-resposta'; log('discord: conectou mas não respondeu'); s.removeAllListeners(); s.on('error', () => {}); s.destroy(); perdeu(); }
      }, TEMPO_LIMITE);
      if (limite.unref) limite.unref();
      s.once('connect', () => {
        if (minha !== geracao) { s.destroy(); return; }
        aberto = true; sock = s; conectando = false; buf = Buffer.alloc(0);
        s.write(quadro(OP.HANDSHAKE, { v: 1, client_id: appId }));
      });
      s.on('data', (d) => { aoDados(s, d); if (pronto) clearTimeout(limite); });
      s.on('error', () => { clearTimeout(limite); if (!aberto) { if (minha === geracao) proximo(); } else if (sock === s) perdeu('erro'); });
      s.on('close', () => { if (aberto && sock === s) perdeu('fechou'); });
    };
    proximo();
  }

  function aoDados(s, d) {
    if (s !== sock) return;
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0), n = buf.readInt32LE(4);
      if (n < 0 || n > 1 << 20) { fechar(); agendarRetentar(); return; }
      if (buf.length < 8 + n) return;
      const corpo = buf.slice(8, 8 + n); buf = buf.slice(8 + n);
      let msg = null; try { msg = JSON.parse(corpo.toString('utf8')); } catch (e) { /* ignora */ }
      if (op === OP.PING) { try { s.write(quadro(OP.PONG, msg || {})); } catch (e) { /* ok */ } continue; }
      if (op === OP.CLOSE) { ultimoErro = (msg && msg.message) || 'fechado-pelo-discord'; log('discord: ' + ultimoErro); fechar(); agendarRetentar(); return; }
      if (op !== OP.FRAME || !msg) continue;
      if (msg.evt === 'READY') { pronto = true; ultimoErro = ''; log('discord: conectado'); enviadoChave = null; agendarEnvio(0); }
      else if (msg.evt === 'ERROR') { ultimoErro = (msg.data && msg.data.message) || 'erro'; log('discord: ' + ultimoErro); }
    }
  }

  function enviarAgora() {
    timerEnvio = 0;
    if (!pronto || !sock) return;
    const chave = JSON.stringify(atividade);
    if (chave === enviadoChave) return;
    enviadoChave = chave; ultEnvio = Date.now();
    const args = { pid }; if (atividade) args.activity = atividade;
    try { sock.write(quadro(OP.FRAME, { cmd: 'SET_ACTIVITY', args, nonce: String(ultEnvio) + Math.random().toString(36).slice(2, 8) })); } catch (e) { perdeu('escrita'); }
  }
  function agendarEnvio(minimo) {
    if (timerEnvio) return;
    const espera = Math.max(minimo == null ? 0 : minimo, minEntre - (Date.now() - ultEnvio), 0);
    timerEnvio = setTimeout(enviarAgora, espera);
    if (timerEnvio.unref) timerEnvio.unref();
  }

  // Chamado pela interface a cada mudança (menu, sala, número de pessoas, perfil...)
  function presenca(dados) {
    const d = dados || {};
    ativo = d.ativo !== false;
    const id = (/^\d{15,25}$/.test(String(d.appId || '')) ? String(d.appId) : '') || idPadrao();
    if (id !== appId) { fechar(); appId = id; }
    atividade = ativo && appId ? montarAtividade(d) : null;
    if (!ativo || !appId) {
      if (pronto) { atividade = null; enviadoChave = null; agendarEnvio(0); } // limpa o que estava no perfil
      if (!appId) fechar();
      return estado();
    }
    if (!sock && !conectando && !timerRetentar) conectar();
    if (pronto) agendarEnvio();
    return estado();
  }

  function parar() { atividade = null; ativo = false; fechar(); } // fechar o canal já tira a atividade do perfil

  return { presenca, estado, parar, _montar: montarAtividade };
}

module.exports = { criarDiscord, montarAtividade, caminhos, quadro, OP };
