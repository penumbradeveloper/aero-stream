// Aero Stream - sons. Tudo é sintetizado na hora (sinos de vidro, bolhas, brilhos): nenhum arquivo de áudio.
// Cada animação da interface tem o seu próprio som. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  let ctx = null, bus = null, ultimoHover = 0;

  // Notas (Hz): escala pentatônica brilhante, no registro agudo, para soar "vidro"
  const N = { sol5: 784, la5: 880, si5: 988, do6: 1047, re6: 1175, mi6: 1319, sol6: 1568, la6: 1760, do7: 2093, mi7: 2637, mi4: 330, si3: 247 };
  // (1.0.0) todas as notas de 2 a 7 (antes faltavam várias, e um som que pedia uma nota que não existia ficava mudo: era o toque Harpa)
  ['do', 'dos', 're', 'res', 'mi', 'fa', 'fas', 'sol', 'sols', 'la', 'las', 'si'].forEach((nm, i) => { for (let o = 2; o <= 7; o++) { const k = nm + o; if (!(k in N)) N[k] = Math.round(440 * 2 ** ((o - 4) + (i - 9) / 12)); } });

  function impulso(c, seg, queda) {
    const n = Math.floor(c.sampleRate * seg), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, queda); }
    return b;
  }

  // "Bus" = mesa de som: mestre -> compressor -> saída, com um reverb curto (brilho de vidro)
  function criarBus(c, volume = 1) {
    const mestre = c.createGain(); mestre.gain.value = volume;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    mestre.connect(comp); comp.connect(c.destination);
    const rev = c.createConvolver(); rev.buffer = impulso(c, 1.0, 2.6);
    const rg = c.createGain(); rg.gain.value = 0.28; rev.connect(rg); rg.connect(mestre);
    return { c, mestre, rev };
  }

  // Hora "no passado" (som agendado para acompanhar uma animação que já começou): o Web Audio recusa tempo negativo, e o erro
  // abortava o som inteiro (era isso que calava a formação da bolha na abertura). Notas curtas que já passaram são puladas
  // (tocá-las todas juntas embola o som); as longas começam agora. Devolve null para pular.
  function aTempo(c, t, dur) {
    const agora = c.currentTime;
    if (t >= agora) return t;
    if (agora - t > 0.06 && dur < 0.5) return null;
    return agora;
  }

  // Uma nota: oscilador com ataque suave e queda exponencial (som de sino/bolha)
  function nota(b, freq, t, dur, { tipo = 'sine', vol = 0.2, glide = 0, rev = 0.5, ataque = 0.006, harm = 0 } = {}) {
    const c = b.c;
    const t2 = aTempo(c, t, dur); if (t2 === null) return;
    if (t2 > t) { dur = Math.max(0.05, dur - (t2 - t)); t = t2; }
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(b.mestre);
    if (rev > 0) { const s = c.createGain(); s.gain.value = rev; g.connect(s); s.connect(b.rev); }
    o.start(t); o.stop(t + dur + 0.05);
    if (harm) nota(b, freq * 2.01, t, dur * 0.6, { vol: vol * harm, rev: 0.3 }); // parcial de sino: brilho
  }

  // Brilho: um sopro de ruído agudo (cintilar do vidro)
  function brilho(b, t, vol = 0.05, dur = 0.12) {
    t = aTempo(b.c, t, dur); if (t === null) return;
    const c = b.c, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(b.mestre); g.connect(b.rev);
    s.start(t);
  }

  // Sopro: ruído passando por um filtro que varre de f0 a f1 (o "swoosh" de mensagem enviada)
  function sopro(b, t, dur, f0, f1, vol = 0.12, q = 1.4) {
    t = aTempo(b.c, t, dur); if (t === null) return;
    const c = b.c, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(b.mestre); const r = c.createGain(); r.gain.value = 0.25; g.connect(r); r.connect(b.rev);
    s.start(t); s.stop(t + dur + 0.02);
  }
  // Colchão: uma nota que fica de pé (a nota comum só cai). Sobe devagar durante "ataque" e solta em "queda" (a tensão da abertura)
  function colchao(b, f, t, dur, vol, { tipo = 'triangle', ataque = 0.6, queda = 0.3, rev = 0.9 } = {}) {
    t = aTempo(b.c, t, dur); if (t === null) return;
    const c = b.c, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + ataque); g.gain.setValueAtTime(vol, t + Math.max(ataque, dur - queda)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(b.mestre); const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(b.rev);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // "Blup": nota redonda que começa um pouco abaixo e escorrega até o tom (a marimba de bolhas do toque de chamada)
  function blup(b, f, t, dur, vol = 0.12) {
    const c = b.c, t2 = aTempo(c, t, dur); if (t2 === null) return; t = t2;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.78, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.028);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(b.mestre); const r = c.createGain(); r.gain.value = 0.35; g.connect(r); r.connect(b.rev);
    o.start(t); o.stop(t + dur + 0.05);
    nota(b, f * 3, t, dur * 0.25, { vol: vol * 0.12, rev: 0.2, ataque: 0.002 }); // o "toc" de vidro em cima
  }


  // (1.0.0) quando a skin não troca um som, ele usa o arquivo do "parente" nestes tons (um toque por tom, 60 ms entre eles)
  const PARENTE = {
    'tk-passar': ['hover', [1.26]], mirar: ['hover', [1.5]],
    'tk-dm': ['click', [1, 1.26]], 'tk-grupo': ['click', [0.89, 1.12, 1.33]],
    'menu-abrir': ['pop-abrir', [1.12]], 'menu-fechar': ['pop-abrir', [0.84]], 'pop-fechar': ['pop-abrir', [0.84]],
    'mini-abrir': ['pop-abrir', [1.26]], 'mini-fechar': ['pop-abrir', [0.94]], fechar: ['abrir', [0.84]],
    'bolha-cresce': ['bolha', [1]], 'bolha-estoura': ['estourar', [1.12]], desgrudar: ['grudar', [1.26]],
  };
  // Catálogo: nome -> como tocar
  const SONS = {
    hover: (b, t) => nota(b, N.sol6, t, 0.07, { vol: 0.05, rev: 0.2 }),
    foco: (b, t) => nota(b, N.la6, t, 0.06, { vol: 0.06, rev: 0.2 }),
    click: (b, t) => { nota(b, N.mi6, t, 0.07, { vol: 0.13, tipo: 'triangle', rev: 0.25 }); nota(b, N.la6, t + 0.04, 0.12, { vol: 0.12, rev: 0.4 }); },
    abrir: (b, t) => { [N.sol5, N.do6, N.mi6].forEach((f, i) => nota(b, f, t + i * 0.06, 0.28, { vol: 0.14, tipo: 'triangle', harm: 0.25 })); brilho(b, t + 0.1, 0.03); },
    fechar: (b, t) => { [N.mi6, N.do6, N.sol5].forEach((f, i) => nota(b, f, t + i * 0.06, 0.24, { vol: 0.12, tipo: 'triangle', harm: 0.2 })); },
    bolha: (b, t) => { nota(b, 520, t, 0.16, { vol: 0.18, glide: 1500, rev: 0.4 }); nota(b, N.do7, t + 0.12, 0.1, { vol: 0.06, rev: 0.5 }); brilho(b, t + 0.12, 0.025, 0.05); },
    online: (b, t) => { nota(b, N.do6, t, 0.3, { vol: 0.15, harm: 0.3 }); nota(b, N.sol6, t + 0.1, 0.4, { vol: 0.15, harm: 0.3 }); },
    msg: (b, t) => { nota(b, N.mi6, t, 0.3, { vol: 0.17, harm: 0.3 }); nota(b, N.si5, t + 0.13, 0.4, { vol: 0.16, harm: 0.3 }); },
    compartilhar: (b, t) => { [N.do6, N.mi6, N.sol6, N.do7].forEach((f, i) => nota(b, f, t + i * 0.07, 0.34, { vol: 0.14, tipo: 'triangle', harm: 0.3 })); brilho(b, t + 0.28, 0.05, 0.2); },
    parar: (b, t) => { [N.do7, N.sol6, N.mi6, N.do6].forEach((f, i) => nota(b, f, t + i * 0.07, 0.3, { vol: 0.12, tipo: 'triangle', harm: 0.2 })); },
    entrar: (b, t) => { nota(b, N.mi6, t, 0.2, { vol: 0.14, harm: 0.3 }); nota(b, N.la6, t + 0.09, 0.32, { vol: 0.14, harm: 0.3 }); },
    sair: (b, t) => { nota(b, N.mi6, t, 0.2, { vol: 0.12 }); nota(b, N.si5, t + 0.09, 0.32, { vol: 0.12 }); },
    sucesso: (b, t) => { nota(b, N.do6, t, 0.3, { vol: 0.14, harm: 0.3 }); nota(b, N.sol6, t, 0.4, { vol: 0.12, harm: 0.3 }); brilho(b, t + 0.05, 0.03); },
    erro: (b, t) => { nota(b, N.mi4, t, 0.22, { vol: 0.17, tipo: 'triangle', glide: 247, rev: 0.2 }); nota(b, N.mi4 * 0.75, t + 0.1, 0.25, { vol: 0.14, tipo: 'triangle', rev: 0.2 }); },
    formar: (b, t) => { // a bolha do início se formando: sobe como uma gota de som
      nota(b, 240, t, 1.1, { vol: 0.16, glide: 980, rev: 0.7, ataque: 0.3 });
      for (let i = 0; i < 6; i++) nota(b, 900 + i * 260, t + 0.15 + i * 0.14, 0.12, { vol: 0.05, glide: 1400 + i * 200, rev: 0.6 });
    },
    // ---- microfone e som: um par subindo (ligou) e descendo (desligou) ----
    'mic-on': (b, t) => { nota(b, N.sol6, t, 0.12, { vol: 0.13, tipo: 'triangle', rev: 0.3 }); nota(b, N.do7, t + 0.07, 0.26, { vol: 0.14, harm: 0.3, rev: 0.45 }); brilho(b, t + 0.08, 0.02, 0.08); },
    'mic-off': (b, t) => { nota(b, N.do7, t, 0.1, { vol: 0.11, tipo: 'triangle', rev: 0.25 }); nota(b, N.sol5, t + 0.07, 0.24, { vol: 0.14, glide: 640, tipo: 'triangle', rev: 0.3 }); },
    'som-on': (b, t) => { nota(b, 330, t, 0.22, { vol: 0.15, glide: 990, rev: 0.4 }); nota(b, N.mi6, t + 0.1, 0.22, { vol: 0.11, harm: 0.3 }); },
    'som-off': (b, t) => { nota(b, 990, t, 0.24, { vol: 0.15, glide: 300, rev: 0.3 }); nota(b, N.si3 * 2, t + 0.1, 0.18, { vol: 0.09, tipo: 'triangle', rev: 0.2 }); },
    // ---- mensagens (0.5.9-6, inspirados no SMS do iPhone): enviar é um "swoosh" que sobe; receber é um sininho de três notas ----
    'chat-envio': (b, t) => { sopro(b, t, 0.3, 600, 5200, 0.16, 1.2); nota(b, 700, t + 0.04, 0.22, { vol: 0.05, glide: 1600, rev: 0.3, ataque: 0.04 }); },
    'chat-recebido': (b, t) => { [1480, 1109].forEach((f, i) => nota(b, f, t + i * 0.12, 0.42, { vol: 0.12, harm: 0.35, rev: 0.45, ataque: 0.003 })); },
    // ---- janelas, perfil, mini perfil, menu do botão direito e setinhas: cada um com o seu par abrir/fechar (nenhum repetido) ----
    'janela-abrir': (b, t) => { nota(b, 260, t, 0.36, { vol: 0.1, glide: 780, rev: 0.6, ataque: 0.05 }); [N.do6, N.sol6].forEach((f, i) => nota(b, f, t + 0.12 + i * 0.05, 0.4, { vol: 0.08, harm: 0.3, rev: 0.6 })); },
    'janela-fechar': (b, t) => { sopro(b, t, 0.05, 2600, 2000, 0.22, 2); nota(b, 1100, t, 0.1, { vol: 0.2, glide: 380, rev: 0.3, ataque: 0.002 }); nota(b, N.sol5, t + 0.05, 0.25, { vol: 0.05, rev: 0.6 }); },
    'perfil-abrir': (b, t) => { nota(b, 560, t, 0.22, { vol: 0.12, glide: 1400, rev: 0.4 }); [N.re6, N.la6, N.re6 * 2].forEach((f, i) => nota(b, f, t + 0.08 + i * 0.055, 0.5 - i * 0.08, { vol: 0.09, tipo: 'triangle', harm: 0.35, rev: 0.65 })); brilho(b, t + 0.2, 0.035, 0.25); },
    'perfil-fechar': (b, t) => { nota(b, 1300, t, 0.2, { vol: 0.1, glide: 480, rev: 0.35 }); nota(b, N.la5, t + 0.1, 0.32, { vol: 0.08, tipo: 'triangle', harm: 0.25, rev: 0.5 }); },
    'mini-abrir': (b, t) => { nota(b, N.mi6, t, 0.06, { vol: 0.1, tipo: 'triangle', rev: 0.2, ataque: 0.002 }); nota(b, N.si5 * 2, t + 0.045, 0.16, { vol: 0.1, harm: 0.3, rev: 0.4 }); },
    // (0.8.0) arranjo: desgrudar (a peça solta com um "plop" que sobe), mirar (um tilim curto: pode grudar aqui) e grudar (um encaixe
    // macio que desce e assenta, com brilho)
    desgrudar: (b, t) => { nota(b, 380, t, 0.1, { vol: 0.16, glide: 760, rev: 0.25, ataque: 0.003 }); nota(b, N.sol6, t + 0.07, 0.14, { vol: 0.07, rev: 0.5 }); brilho(b, t + 0.05, 0.02, 0.06); },
    mirar: (b, t) => { nota(b, N.mi6, t, 0.07, { vol: 0.07, tipo: 'triangle', rev: 0.35, ataque: 0.002 }); nota(b, N.la6, t + 0.035, 0.09, { vol: 0.05, rev: 0.4 }); },
    grudar: (b, t) => { nota(b, 900, t, 0.09, { vol: 0.15, glide: 420, rev: 0.2, ataque: 0.002 }); nota(b, N.do6, t + 0.06, 0.22, { vol: 0.12, rev: 0.45, harm: 0.25 }); nota(b, N.sol6, t + 0.1, 0.25, { vol: 0.07, rev: 0.55 }); brilho(b, t + 0.1, 0.03, 0.09); },
    'mini-fechar': (b, t) => { nota(b, N.si5 * 2, t, 0.05, { vol: 0.13, tipo: 'triangle', rev: 0.2, ataque: 0.002 }); nota(b, N.mi6, t + 0.04, 0.12, { vol: 0.12, rev: 0.3 }); },
    'menu-abrir': (b, t) => { nota(b, 300, t, 0.13, { vol: 0.28, glide: 950, rev: 0.3, ataque: 0.004 }); nota(b, 1800, t + 0.09, 0.05, { vol: 0.09, tipo: 'triangle', rev: 0.3, ataque: 0.002 }); },
    'menu-fechar': (b, t) => { nota(b, 900, t, 0.11, { vol: 0.22, glide: 330, rev: 0.25, ataque: 0.003 }); sopro(b, t + 0.06, 0.03, 3000, 2400, 0.08, 2.5); },
    // (0.5.9-7) lista de membros do grupo: cada bolha que nasce faz um "blup" que cresce (redondo, de console) e, ao fechar, cada uma estoura
    // num "pop" macio (bem mais gostoso que o estouro grande da tela inicial). E o menu do botão direito: um "tic" de vidro por opção.
    'bolha-cresce': (b, t) => { nota(b, 330, t, 0.2, { vol: 0.16, glide: 720, rev: 0.35, ataque: 0.03 }); nota(b, 990, t + 0.1, 0.12, { vol: 0.05, harm: 0.3, rev: 0.5, ataque: 0.004 }); },
    'bolha-estoura': (b, t) => { sopro(b, t, 0.035, 2400, 1700, 0.16, 2.2); nota(b, 820, t, 0.08, { vol: 0.14, glide: 360, rev: 0.25, ataque: 0.002 }); nota(b, 1240, t + 0.03, 0.14, { vol: 0.04, rev: 0.6 }); },
    // (0.7.6) Aero Talk: passar o mouse por uma conversa (uma gotinha de vidro, bem baixa) e abrir uma DM (duas bolhas subindo, como uma
    // mensagem chegando perto) ou um grupo (três bolhas em acorde, mais cheio)
    'tk-passar': (b, t) => { nota(b, 1245, t, 0.05, { vol: 0.045, glide: 1660, rev: 0.35, ataque: 0.002 }); nota(b, 2490, t + 0.01, 0.04, { vol: 0.012, rev: 0.5, ataque: 0.001 }); },
    'tk-dm': (b, t) => { blup(b, 740, t, 0.16, 0.11); blup(b, 1109, t + 0.065, 0.2, 0.09); brilho(b, t + 0.1, 0.025, 0.14); },
    // (0.8.7) a pastinha das conversas: a aba de papel abrindo (um "fwip" que sobe, um toque de madeira e duas notas que sobem) e fechando
    // (o "fwip" desce e a tampa bate de leve)
    'pasta-abrir': (b, t) => { sopro(b, t, 0.11, 700, 3400, 0.09, 1.6); nota(b, 430, t, 0.06, { vol: 0.12, tipo: 'triangle', rev: 0.15, ataque: 0.001 }); blup(b, 659, t + 0.06, 0.2, 0.08); blup(b, 988, t + 0.12, 0.26, 0.07); },
    'pasta-fechar': (b, t) => { sopro(b, t, 0.1, 3200, 800, 0.08, 1.6); nota(b, 300, t + 0.08, 0.09, { vol: 0.16, tipo: 'triangle', glide: 200, rev: 0.15, ataque: 0.001 }); blup(b, 523, t + 0.1, 0.18, 0.06); },
    // (0.8.7) dia e noite: o sol nascendo (um brilho que sobe e um acorde claro) e a noite caindo (notas que descem devagar e uma estrelinha)
    dia: (b, t) => { nota(b, 520, t, 0.35, { vol: 0.08, glide: 1560, rev: 0.6, ataque: 0.08 }); [N.do6, N.mi6, N.sol6, N.do7].forEach((f, i) => nota(b, f, t + 0.1 + i * 0.07, 0.5, { vol: 0.09, harm: 0.4, rev: 0.6 })); brilho(b, t + 0.32, 0.05, 0.28); },
    noite: (b, t) => { [N.mi6, N.do6, N.la5].forEach((f, i) => nota(b, f, t + i * 0.12, 0.7, { vol: 0.09, rev: 0.9, ataque: 0.02 })); nota(b, 440, t, 0.6, { vol: 0.05, tipo: 'triangle', glide: 220, rev: 0.8, ataque: 0.1 }); nota(b, N.mi7, t + 0.45, 0.3, { vol: 0.035, rev: 0.9 }); brilho(b, t + 0.46, 0.025, 0.12); },
    'tk-grupo': (b, t) => { blup(b, 587, t, 0.18, 0.1); blup(b, 740, t + 0.05, 0.18, 0.09); blup(b, 880, t + 0.1, 0.24, 0.085); brilho(b, t + 0.14, 0.03, 0.18); },
    'menu-item': (b, t) => { nota(b, 1480, t, 0.045, { vol: 0.07, tipo: 'triangle', rev: 0.25, ataque: 0.001 }); nota(b, 1975, t + 0.012, 0.06, { vol: 0.035, rev: 0.4, ataque: 0.001 }); },
    'pop-abrir': (b, t) => { nota(b, 1200, t, 0.035, { vol: 0.17, tipo: 'triangle', rev: 0.1, ataque: 0.001 }); nota(b, 1620, t + 0.03, 0.07, { vol: 0.16, tipo: 'triangle', rev: 0.2, ataque: 0.001 }); sopro(b, t, 0.08, 2500, 6000, 0.05, 1); },
    'pop-fechar': (b, t) => { nota(b, 1620, t, 0.035, { vol: 0.15, tipo: 'triangle', rev: 0.1, ataque: 0.001 }); nota(b, 1080, t + 0.03, 0.06, { vol: 0.15, tipo: 'triangle', rev: 0.15, ataque: 0.001 }); sopro(b, t, 0.07, 5000, 2000, 0.04, 1); },
    // ---- Aero Talk: telefone de console com bolhas ----
    // recebendo uma chamada (0.5.9-5): uma musiquinha saltitante como a do Skype, mas de bolhas e console (marimba de vidro, baixo
    // redondo e "plops" de bolha nos contratempos); repete a cada 3,4 s. A antiga continua como "chamada-entrada-classico".
    'chamada-entrada': (b, t) => { // (0.5.9-6) no espírito do Skype: "blups" redondos em grupos rápidos que sobem e descem; repete a cada 3,4 s
      const q = 0.1, frase = [[659, 0], [831, 1], [988, 2], [831, 3], [988, 4], [1319, 5.4], [740, 8], [932, 9], [1109, 10], [932, 11], [1109, 12], [1480, 13.4]];
      frase.forEach(([f, i]) => blup(b, f, t + i * q, i % 1 ? 0.42 : 0.24, i % 1 ? 0.15 : 0.12));
      [[165, 0], [185, 8]].forEach(([f, i]) => nota(b, f, t + i * q, 0.6, { vol: 0.07, rev: 0.2, ataque: 0.01 }));
      brilho(b, t + 13.4 * q, 0.03, 0.25);
    },
    // (0.5.9-7) "Brisa": calma e redonda, no registro do meio (nada muito agudo nem muito grave), uma frase curta de 2 s que fica na cabeça.
    // Malho macio de vidro (ataque suave) sobre um acorde bem baixinho, no espírito do Frutiger Aero / console. Repete a cada 4 s.
    'chamada-entrada-brisa': (b, t) => {
      const q = 0.19, frase = [[440, 0, 0.5], [587, 1, 0.5], [740, 2, 0.7], [659, 3.2, 0.9], [587, 5, 0.5], [494, 6, 0.5], [587, 7, 1.1]];
      frase.forEach(([f, i, d]) => { nota(b, f, t + i * q, d, { vol: 0.11, tipo: 'sine', rev: 0.6, ataque: 0.025 }); nota(b, f * 2, t + i * q, d * 0.45, { vol: 0.022, tipo: 'triangle', rev: 0.5, ataque: 0.02 }); });
      [[294, 0, 1.3], [330, 4.2, 1.5]].forEach(([f, i, d]) => { nota(b, f, t + i * q, d, { vol: 0.045, tipo: 'sine', rev: 0.7, ataque: 0.2 }); nota(b, f * 1.5, t + i * q, d, { vol: 0.03, tipo: 'sine', rev: 0.7, ataque: 0.2 }); });
    },
    // a de 0.5.9-5 (marimba de vidro): fica como opção
    'chamada-entrada-marimba': (b, t) => {
      const q = 0.155; // uma colcheia
      const frase = [[N.sol5, 0], [N.si5, 1], [N.re6, 2], [N.si5, 3], [N.mi6, 4], [N.re6, 5.5], [N.si5, 6], [N.la5, 7], [N.re6, 8], [N.si5, 9], [N.sol5, 10], [N.la5, 11], [N.si5, 12], [N.sol6, 13.5]];
      frase.forEach(([f, i]) => { nota(b, f, t + i * q, 0.28, { vol: 0.12, tipo: 'triangle', harm: 0.5, rev: 0.45, ataque: 0.003 }); nota(b, f * 2, t + i * q, 0.09, { vol: 0.03, rev: 0.3, ataque: 0.002 }); });
      [[196, 0], [247, 4], [220, 8], [196, 12]].forEach(([f, i]) => nota(b, f, t + i * q, 0.5, { vol: 0.09, tipo: 'sine', rev: 0.25, ataque: 0.01 }));
    },
    // a antiga: arpejo de vidro subindo, com bolhinhas que "borbulham" entre as notas (toca de novo a cada 3 s)
    'chamada-entrada-classico': (b, t) => {
      const notas = [N.do6, N.mi6, N.sol6, N.do7, N.sol6, N.do7];
      notas.forEach((f, i) => nota(b, f, t + i * 0.11, 0.42, { vol: 0.12, tipo: 'triangle', harm: 0.35, rev: 0.6 }));
      [0.06, 0.28, 0.5].forEach((d, i) => nota(b, 600 + i * 180, t + d, 0.1, { vol: 0.06, glide: 1500 + i * 200, rev: 0.5, ataque: 0.004 }));
      nota(b, N.mi7, t + 0.7, 0.6, { vol: 0.05, harm: 0.4, rev: 0.8 }); brilho(b, t + 0.66, 0.045, 0.35);
    },
    // ligando para alguém: dois toques suaves e redondos, como uma bolha sendo soprada (a cada 2,6 s)
    'chamada-saida': (b, t) => {
      nota(b, N.sol5, t, 0.5, { vol: 0.11, harm: 0.3, rev: 0.6, ataque: 0.02 }); nota(b, N.do6, t + 0.18, 0.7, { vol: 0.11, harm: 0.3, rev: 0.7, ataque: 0.02 });
      nota(b, 380, t + 0.05, 0.25, { vol: 0.07, glide: 900, rev: 0.4 });
    },
    // (0.7.0) entrar e sair da chamada (no espírito dos do Discord, com bolhas e vidro do Aero): subindo = entrou, descendo = saiu.
    // Você: três bolhas e um brilho (mais cheio); outra pessoa: duas bolhas, mais curtinho
    'cham-entrei': (b, t) => { [[587, 0], [784, 0.07], [1175, 0.14]].forEach(([f, d]) => blup(b, f, t + d, 0.3, 0.1)); nota(b, N.re6 * 2, t + 0.2, 0.45, { vol: 0.05, harm: 0.4, rev: 0.7 }); brilho(b, t + 0.2, 0.03); },
    'cham-sai': (b, t) => { [[1175, 0], [784, 0.08], [587, 0.16]].forEach(([f, d]) => blup(b, f, t + d, 0.3, 0.09)); nota(b, 440, t + 0.22, 0.35, { vol: 0.05, glide: -120, rev: 0.5 }); },
    'cham-entrou': (b, t) => { blup(b, 698, t, 0.24, 0.08); blup(b, 1047, t + 0.08, 0.3, 0.075); },
    'cham-saiu': (b, t) => { blup(b, 1047, t, 0.24, 0.07); blup(b, 698, t + 0.09, 0.3, 0.07); },
    // chamada encerrada / recusada: três notas descendo e uma bolha murchando
    'chamada-fim': (b, t) => {
      [N.sol6, N.mi6, N.do6].forEach((f, i) => nota(b, f, t + i * 0.09, 0.3, { vol: 0.12, tipo: 'triangle', harm: 0.2, rev: 0.4 }));
      nota(b, 900, t + 0.25, 0.3, { vol: 0.08, glide: 260, rev: 0.4 });
    },
    // mensagem nova no Aero Talk (0.5.9-6, no espírito do "Tri-tone" do iPhone): três sininhos de vidro
    // (0.6.0) alguém mencionou você: o sininho de mensagem com um "ping" brilhante por cima (dá para reconhecer sem olhar)
    'talk-mencao': (b, t) => { [1568, 2093].forEach((f, i) => nota(b, f, t + i * 0.08, 0.45, { vol: 0.13, tipo: 'triangle', harm: 0.5, rev: 0.55, ataque: 0.002 })); [1319, 1760].forEach((f, i) => nota(b, f, t + 0.2 + i * 0.1, 0.5, { vol: 0.1, harm: 0.4, rev: 0.6 })); brilho(b, t + 0.05, 0.05, 0.3); },
    // (0.6.0) Conexões: amigos online aparecendo. Um acorde de bolhas subindo, macio e redondo, tocado uma vez só
    conexoes: (b, t) => { [[523, 0], [659, 0.07], [784, 0.13], [1047, 0.2]].forEach(([f, d]) => blup(b, f, t + d, 0.42, 0.09)); nota(b, 2093, t + 0.26, 0.6, { vol: 0.045, harm: 0.5, rev: 0.8 }); sopro(b, t + 0.02, 0.32, 900, 3600, 0.035, 2.5); },
    // (0.6.0) a equipe apagou uma denúncia/feedback: estalo de bolha de console (curto, nítido, com um "tic" de plástico e brilho de vidro)
    'estourar-equipe': (b, t) => {
      const c = b.c, n = Math.floor(c.sampleRate * 0.03), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
      const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 2;
      const g = c.createGain(); g.gain.value = 0.32; s.connect(f); f.connect(g); g.connect(b.mestre); s.start(aTempo(c, t, 0.03) || c.currentTime);
      nota(b, 2400, t, 0.06, { vol: 0.16, glide: 600, rev: 0.15, ataque: 0.001 });
      nota(b, 3520, t + 0.012, 0.025, { vol: 0.09, tipo: 'square', rev: 0.05, ataque: 0.001 });
      [N.sol6, N.re6].forEach((f2, i) => nota(b, f2, t + 0.05 + i * 0.05, 0.32, { vol: 0.07, harm: 0.5, rev: 0.6 }));
      brilho(b, t + 0.02, 0.05, 0.22);
    },
    // (0.8.3) chegou um feedback (só o desenvolvedor ouve): um "blup-blup" de bolha subindo e um sino de vidro em quinta, com brilho
    'feedback-novo': (b, t) => { blup(b, 660, t, 0.26, 0.1); blup(b, 990, t + 0.09, 0.3, 0.1); [N.mi6 * 2, N.si5 * 2].forEach((f, i) => nota(b, f, t + 0.2 + i * 0.13, 0.55, { vol: 0.08, tipo: 'triangle', harm: 0.55, rev: 0.7, ataque: 0.002 })); brilho(b, t + 0.22, 0.04, 0.3); },
    'talk-msg': (b, t) => { [1319, 1109, 1480].forEach((f, i) => nota(b, f, t + i * 0.11, 0.5 - i * 0.05, { vol: 0.13, harm: 0.4, rev: 0.5, ataque: 0.003 })); },
    // ---- tela inicial: a bolha estoura (pop de membrana + estalinhos + brilho de vidro) ----
    estourar: (b, t) => {
      const c = b.c, n = Math.floor(c.sampleRate * 0.05), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.1;
      const g = c.createGain(); g.gain.value = 0.3; s.connect(f); f.connect(g); g.connect(b.mestre); g.connect(b.rev); s.start(t);
      nota(b, 1600, t, 0.09, { vol: 0.2, glide: 340, rev: 0.3, ataque: 0.002 });
      [0.05, 0.095, 0.14].forEach((d2, i) => nota(b, 1250 - i * 220, t + d2, 0.06, { vol: 0.09, glide: 420, rev: 0.4, ataque: 0.002 }));
      [N.mi7, N.do7, N.sol6].forEach((f2, i) => nota(b, f2, t + 0.06 + i * 0.045, 0.6, { vol: 0.08, harm: 0.4, rev: 0.75 }));
      brilho(b, t + 0.04, 0.06, 0.4);
    },
    // ---- abertura (0.7.9): a luz nasce num grave de ar, a tensão cresce enquanto o anel-cometa gira em volta da bola, e quando ele encaixa na logo
    // vem a pancada grave com um acorde aberto e enorme que demora a sumir (o gesto dos consoles da era Xbox One: ar, tensão, um acorde só).
    // Marcas: .3 s o cometa sai, 1,3 s ele encaixa ----
    abertura: (b, t) => {
      sopro(b, t, 0.9, 180, 800, 0.16, 0.8);
      nota(b, 41, t, 1.1, { vol: 0.24, glide: 62, rev: 0.2, ataque: 0.55 });
      [[110, 0.075], [165, 0.06], [220, 0.05], [330, 0.035], [495, 0.022]].forEach(([f, vol], i) => {
        colchao(b, f, t + 0.04 + i * 0.03, 1.26 - i * 0.03, vol, { ataque: 1.16 - i * 0.03, queda: 0.08 }); colchao(b, f * 1.004, t + 0.06 + i * 0.03, 1.24 - i * 0.03, vol * 0.7, { tipo: 'sine', ataque: 1.14 - i * 0.03, queda: 0.08 });
      });
      sopro(b, t + 0.3, 1, 460, 5200, 0.34, 1.4); nota(b, 220, t + 0.3, 1, { vol: 0.06, tipo: 'triangle', glide: 660, rev: 0.8, ataque: 0.3 });
      sopro(b, t + 0.85, 0.47, 700, 8500, 0.22, 0.9);
      // o encaixe
      nota(b, 86, t + 1.3, 2.8, { vol: 0.5, glide: 38, rev: 0.4, ataque: 0.008 }); brilho(b, t + 1.3, 0.09, 0.3); sopro(b, t + 1.3, 1.3, 2600, 260, 0.24, 0.7);
      [[55, 0.15], [110, 0.14], [164.8, 0.12], [220, 0.12], [246.9, 0.08], [329.6, 0.09], [440, 0.07], [493.9, 0.05], [659.3, 0.05], [987.8, 0.03]].forEach(([f, vol], i) => {
        const dur = 8.5 - i * 0.3;
        nota(b, f, t + 1.3 + i * 0.012, dur, { vol, tipo: i < 6 ? 'triangle' : 'sine', rev: 0.95, ataque: 0.02 }); nota(b, f * 1.003, t + 1.32 + i * 0.012, dur, { vol: vol * 0.6, rev: 0.95, ataque: 0.05 });
      });
      [1318.5, 1760, 1975.5, 2637].forEach((f, i) => nota(b, f, t + 1.42 + i * 0.1, 1.8, { vol: 0.035, harm: 0.4, rev: 0.95, ataque: 0.01 }));
      [659.3, 987.8].forEach((f, i) => nota(b, f, t + 1.7 + i * 0.16, 2.4, { vol: 0.06, harm: 0.3, rev: 0.9, ataque: 0.012 }));
    },
    // apertou para começar: sobe um sopro e o mesmo acorde responde, curto
    iniciar: (b, t) => {
      sopro(b, t, 0.5, 500, 6500, 0.09);
      nota(b, 110, t, 0.55, { vol: 0.2, glide: 220, rev: 0.4, ataque: 0.02 });
      [440, 659.3, 880, 1318.5].forEach((f, i) => nota(b, f, t + 0.06 + i * 0.05, 0.85, { vol: 0.09, harm: 0.35, rev: 0.85 }));
    },
  };
  A.somNomes = Object.keys(SONS);

  const volume = () => A.limitar(A.cfg.v.som.volume, 0, 100) / 100;
  // volta o volume geral ao normal (cancela um "silenciar" que ainda estivesse em andamento)
  const mestreLigar = (c) => { try { bus.mestre.gain.cancelScheduledValues(c.currentTime); } catch (e) { /* ok */ } bus.mestre.gain.value = volume(); };

  function iniciar() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); bus = criarBus(ctx, volume()); } catch (e) { A.log.aviso('audio', e); ctx = null; }
    try { const sid = A.cfg.v.audio && A.cfg.v.audio.saida; if (ctx && sid && ctx.setSinkId) ctx.setSinkId(sid).catch(() => {}); } catch (e) { /* ok */ } // os sons do app também saem na saída escolhida
    return ctx;
  }

  A.som = {
    get ctx() { return ctx; },
    // (1.0.0) os sons dos extras (extras.js) entram no mesmo catálogo, feitos com as mesmas peças
    registrar(nome, fn) { if (!SONS[nome]) SONS[nome] = fn; },
    // (1.0.0) os sons de uma skin (.aer) podem ser trocados e tirados (só os com o prefixo da skin)
    trocar(nome, fn) { if (!/^aer:[a-z-]{2,30}$/.test(nome)) return; if (fn) SONS[nome] = fn; else delete SONS[nome]; },
    limparSkin() { for (const k of Object.keys(SONS)) if (k.startsWith('aer:')) delete SONS[k]; },
    pecas: { nota, blup, brilho, sopro, colchao, N },
    tem: (nome) => !!SONS[nome],
    // Navegadores só liberam áudio depois de um toque/clique: chamamos isso no primeiro gesto.
    preparar() { const c = iniciar(); if (c && c.state === 'suspended') c.resume().catch(() => {}); return !!c; },
    pronto() { return !!ctx && ctx.state === 'running'; },
    // Toca um som alinhado com algo visual que começou em "inicioPerf" (performance.now()). Usa o relógio do áudio e
    // desconta a latência de saída. folga < 0 = o quadro já passou: o som começa ADIANTADO nessa medida.
    agendar(nome, inicioPerf, args) {
      const s = A.cfg.v.som;
      if (!s.ativo || !SONS[nome]) return false;
      const c = iniciar();
      if (!c) return false;
      if (c.state !== 'running') {
        // O contexto de áudio nasce "suspenso". No app do PC (sem exigência de clique) ele liga na hora: espera ligar e agenda.
        // No navegador, sem um toque ele não liga; se não ligar em 1,5 s desiste (o som não pode sair atrasado, fora da animação).
        const t0 = performance.now();
        Promise.race([c.resume(), new Promise((r) => setTimeout(r, 1500))]).then(() => {
          if (c.state === 'running' && performance.now() - t0 < 1500) A.som.agendar(nome, inicioPerf, args);
        }).catch(() => {});
        return false;
      }
      mestreLigar(c);
      const folga = Math.max(-1.5, (inicioPerf - performance.now()) / 1000 - (c.outputLatency || c.baseLatency || 0.02));
      A.som.ultimaFolga = folga;
      try { SONS[nome](bus, c.currentTime + folga, args); return true; } catch (e) { A.log.aviso('som ' + nome, e); return false; }
    },
    // (0.8.2) para os sons de digitação (digitar.js): a mesa de som já ligada, ou null com os sons desligados
    mesa() { if (!A.cfg.v.som.ativo) return null; const c = iniciar(); if (!c) return null; if (c.state === 'suspended') c.resume().catch(() => {}); mestreLigar(c); return bus; },
    destravar() { const c = iniciar(); if (c && c.state === 'suspended') c.resume().catch(() => {}); return c; },
    tocar(nome, args) {
      const s = A.cfg.v.som;
      if (!s.ativo || !SONS[nome]) return;
      if (nome === 'hover' || nome === 'foco' || nome === 'menu-item' || nome === 'tk-passar') { const agora = performance.now(); if (agora - ultimoHover < 70) return; ultimoHover = agora; }
      const c = iniciar();
      if (!c) return;
      if (c.state === 'suspended') c.resume().catch(() => {});
      mestreLigar(c);
      const pk = A.som.pacote ? A.som.pacote() : ''; // (1.0.0) o pacote de sons do Aero Bubble troca só os sons que ele tem
      let nm = SONS['aer:' + nome] ? 'aer:' + nome : pk && SONS[pk + ':' + nome] ? pk + ':' + nome : nome; // a skin (.aer) vem primeiro
      // (1.0.0) a skin não trouxe esse som, mas trouxe o "parente" dele (passar numa conversa -> passar o mouse, abrir um grupo -> clique...):
      // toca o arquivo dela em outro tom, para cada um continuar diferente e combinando com a skin
      if (nm === nome && PARENTE[nome] && SONS['aer:' + PARENTE[nome][0]]) { nm = 'aer:' + PARENTE[nome][0]; args = { taxas: PARENTE[nome][1] }; }
      try { SONS[nm](bus, c.currentTime + 0.01, args); } catch (e) { A.log.aviso('som ' + nome, e); }
    },
    // (1.0.2) corta também o que já estava AGENDADO para tocar (a abertura pulada com ESC): a mesa velha some e os próximos sons usam uma nova
    cortar() {
      if (!bus || !ctx) return; const velho = bus;
      try { const t = velho.c.currentTime; velho.mestre.gain.cancelScheduledValues(t); velho.mestre.gain.setValueAtTime(velho.mestre.gain.value, t); velho.mestre.gain.linearRampToValueAtTime(0, t + 0.06); } catch (e) { /* ok */ }
      setTimeout(() => { try { velho.mestre.disconnect(); } catch (e) { /* ok */ } }, 200);
      try { bus = criarBus(ctx, volume()); } catch (e) { A.log.aviso('audio', e); }
    },
    // Corta na hora o que ainda estiver tocando (inclusive o eco/brilho que sobra); o próximo som volta ao volume normal
    silenciar() { if (!bus) return; try { const t = bus.c.currentTime; bus.mestre.gain.cancelScheduledValues(t); bus.mestre.gain.setValueAtTime(bus.mestre.gain.value, t); bus.mestre.gain.linearRampToValueAtTime(0, t + 0.05); } catch (e) { /* ok */ } },
    volume(v) { A.cfg.v.som.volume = A.limitar(v, 0, 100); A.cfg.salvar(); if (bus) bus.mestre.gain.value = volume(); },
    // Para testes e diagnóstico: toca o som num buffer e devolve as amostras (sem sair no alto-falante).
    async renderizar(nome, seg = 2, args) {
      const off = new OfflineAudioContext(2, 44100 * seg, 44100);
      const b = criarBus(off, 1);
      SONS[nome](b, 0.01, args);
      const buf = await off.startRendering();
      return buf.getChannelData(0);
    },
  };
})();
