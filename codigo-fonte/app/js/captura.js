// Aero Stream - ponte com o áudio nativo do app do PC: lista os aplicativos que estão tocando som, controla o volume de cada um
// e captura o som SÓ dos aplicativos escolhidos (sem o som do próprio Aero Stream, que causaria eco).
// O app do PC entrega o som em blocos PCM; aqui eles viram uma trilha de áudio normal para a transmissão.
// No navegador isso não existe (o navegador não deixa um site ouvir um aplicativo): tudo aqui volta "indisponível".
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  const C = (A.captura = { ativo: false, tipo: null, ultimoErro: '', _c: null, _vez: 0, _ligando: false });
  const nat = () => (window.aero && window.aero.audio) || null;
  const NENHUM = { captura: false, volume: false, listar: false, tipo: 'navegador' };

  // O que este computador sabe fazer: { captura, volume, listar, tipo: 'windows'|'linux'|'navegador'|... }
  C.disponivel = async () => {
    const n = nat();
    if (!n || !n.disponivel) return NENHUM;
    try { return { ...NENHUM, ...(await n.disponivel()) }; } catch (e) { return { ...NENHUM, tipo: 'erro' }; }
  };

  // [{ id, nome, icone (data:image ou ''), volume 0..100, mudo, pid, tocando }]
  C.listar = async () => {
    const n = nat();
    if (!n || !n.listar) return [];
    try {
      const l = await n.listar();
      return (Array.isArray(l) ? l : []).filter((x) => x && x.id != null).slice(0, 64).map((x) => ({
        id: String(x.id), nome: String(x.nome || '?').slice(0, 60), icone: /^data:image\/(png|jpeg|webp);base64,/.test(x.icone || '') ? x.icone : '',
        volume: A.limitar(x.volume, 0, 100), mudo: !!x.mudo, pid: x.pid | 0, tocando: !!x.tocando,
      }));
    } catch (e) { return []; }
  };
  C.definirVolume = async (id, v) => { const n = nat(); if (n && n.volume) try { await n.volume(String(id), A.limitar(v, 0, 100)); } catch (e) { /* o app pode ter fechado */ } };
  C.definirMudo = async (id, m) => { const n = nat(); if (n && n.mudo) try { await n.mudo(String(id), !!m); } catch (e) { /* idem */ } };

  // ---------- fila de som (PCM -> trilha) ----------
  // Buffer circular com 1 s por canal. O consumidor (ScriptProcessor) puxa 2048 quadros por vez.
  // Se acumular mais de ~180 ms, descarta até ficar com ~50 ms (a latência não cresce nunca).
  function criarFila(taxa) {
    const N = Math.max(8192, Math.round(taxa)); // 1 s
    const L = new Float32Array(N), R = new Float32Array(N);
    const f = { L, R, N, w: 0, r: 0, taxa, pronto: false };
    f.cheio = () => (f.w - f.r + N) % N;
    f.escrever = (pcm, canais) => { // pcm: Float32Array entrelaçado
      const n = Math.floor(pcm.length / canais);
      for (let i = 0; i < n; i++) {
        L[f.w] = pcm[i * canais]; R[f.w] = canais > 1 ? pcm[i * canais + 1] : pcm[i * canais];
        f.w = (f.w + 1) % N;
        if (f.w === f.r) f.r = (f.r + 1) % N; // estourou: descarta o mais antigo
      }
      const teto = Math.round(taxa * 0.18);
      if (f.cheio() > teto) f.r = (f.w - Math.round(taxa * 0.05) + N) % N;
    };
    f.ler = (saidaL, saidaR) => {
      const n = saidaL.length;
      if (!f.pronto && f.cheio() >= Math.round(taxa * 0.03)) f.pronto = true; // espera 30 ms antes de começar (evita picotar)
      if (!f.pronto || f.cheio() < n) { if (f.cheio() < n && f.pronto) f.pronto = false; saidaL.fill(0); saidaR.fill(0); return false; }
      for (let i = 0; i < n; i++) { saidaL[i] = L[f.r]; saidaR[i] = R[f.r]; f.r = (f.r + 1) % N; }
      return true;
    };
    return f;
  }
  C._criarFila = criarFila; // exposto para os testes

  // Liga a captura nativa e devolve { track, tipo }, ou null se este computador não consegue.
  // ids: aplicativos escolhidos ([] = todos, menos o Aero Stream). janela: id da janela compartilhada (só o som dela).
  // excluirDiscord (0.5.9-6): junto com "sem eco", o som do Discord também fica de fora (quem assiste não ouve a própria voz de volta)
  C.iniciarAudio = async ({ ids = [], excluirAero = true, excluirDiscord = true, janela = null } = {}) => {
    const n = nat();
    if (!n || !n.capturar) return null;
    const cap = await C.disponivel();
    if (!cap.captura) return null;
    C.pararAudio();
    // (0.7.12) se parar ou outra captura chegar enquanto esta ainda liga, ela perde a vez: o app do PC faz tudo em ordem e o que ficou para trás não fica tocando
    const vez = ++C._vez; C._ligando = true;
    const perdeu = () => vez !== C._vez;
    let r;
    try { r = await n.capturar({ ids: ids.map(String).slice(0, 32), excluirAero: excluirAero !== false, excluirDiscord: !!excluirDiscord, janela: janela || null }); }
    catch (e) { if (!perdeu()) C._ligando = false; A.log.aviso('captura de áudio', e); return null; }
    if (perdeu()) return { cancelado: true };
    if (!r || !r.ok) { C._ligando = false; C.ultimoErro = (r && r.erro) || 'falhou'; if (r && r.erro) A.log.aviso('captura de áudio', r.erro); return null; }
    C.ultimoErro = '';
    const taxa = A.limitar(r.taxa || 48000, 8000, 96000), canais = A.limitar(r.canais || 2, 1, 2);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { C._ligando = false; try { n.parar(); } catch (e) { /* ok */ } return null; }
    let ctx;
    try { ctx = new Ctx({ sampleRate: taxa, latencyHint: 'interactive' }); } catch (e) { ctx = new Ctx(); }
    const destino = ctx.createMediaStreamDestination();
    const comoF32 = (buf) => (buf instanceof Float32Array ? buf : new Float32Array(buf.buffer || buf, buf.byteOffset || 0, Math.floor((buf.byteLength || 0) / 4)));
    // (0.6.6) a fila toca na thread de áudio (AudioWorklet): a interface travando não picota mais o som. Sem worklet: o jeito antigo
    let proc = null, fila = null, entregar;
    try {
      await ctx.audioWorklet.addModule('js/fila-som.worklet.js');
      proc = new AudioWorkletNode(ctx, 'fila-aero', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      entregar = (buf) => { const f = comoF32(buf), c = new Float32Array(f.length); c.set(f); proc.port.postMessage({ pcm: c, canais }, [c.buffer]); };
    } catch (e) {
      A.log.aviso('fila de som: sem AudioWorklet, usando o ScriptProcessor', e && e.message);
      fila = criarFila(ctx.sampleRate === taxa ? taxa : ctx.sampleRate);
      proc = ctx.createScriptProcessor(2048, 0, 2);
      proc.onaudioprocess = (ev) => { fila.ler(ev.outputBuffer.getChannelData(0), ev.outputBuffer.getChannelData(1)); };
      entregar = (buf) => fila.escrever(comoF32(buf), canais);
    }
    if (perdeu()) { try { ctx.close(); } catch (e) { /* ok */ } return { cancelado: true }; }
    C._ligando = false;
    proc.connect(destino);
    let recebidos = 0; // quadros que chegaram do app do PC (diagnóstico e testes)
    const cancelar = n.aoPCM ? n.aoPCM((buf) => { try { recebidos += Math.floor((buf.byteLength || buf.length * 4 || 0) / 4 / canais); entregar(buf); } catch (e) { /* bloco inválido */ } }) : null;
    const track = destino.stream.getAudioTracks()[0];
    C._c = { ctx, proc, destino, fila, cancelar, track, recebidos: () => recebidos };
    C.ativo = true; C.tipo = cap.tipo;
    ctx.resume && ctx.resume().catch(() => {});
    return { track, tipo: cap.tipo || 'nativo', aviso: r.aviso || '' };
  };

  C.pararAudio = () => {
    const c = C._c, ligando = C._ligando; C._vez++; C._ligando = false;
    if (!c) { if (ligando) { try { const n = nat(); n && n.parar && n.parar(); } catch (e) { /* ok */ } } return; }
    C._c = null; C.ativo = false; C.tipo = null;
    try { c.cancelar && c.cancelar(); } catch (e) { /* ok */ }
    try { const n = nat(); n && n.parar && n.parar(); } catch (e) { /* ok */ }
    try { c.proc.onaudioprocess = null; if (c.proc.port) c.proc.port.close(); c.proc.disconnect(); } catch (e) { /* ok */ }
    try { c.track && c.track.stop(); } catch (e) { /* ok */ }
    try { c.ctx.close(); } catch (e) { /* ok */ }
  };
})();
