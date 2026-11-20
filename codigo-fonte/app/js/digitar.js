// Aero Stream - sons de digitação (0.8.2). Criado por Ryan Victtor.
// Cada tema tem alguns sons para as teclas comuns (sorteados, nunca o mesmo duas vezes seguidas), um para o espaço, um para o
// apagar e um para o Enter. Tudo sintetizado na hora, como os outros sons do app (som.js). Segurar a tecla não repete o som:
// só toca de novo depois de soltar. Os sons não se cortam (cada tecla tem o seu), mas há um teto de sons ao mesmo tempo.
(() => {
  'use strict';
  const A = window.Aero;
  let ruido = null, grao = null, ctxBuf = null, ultimo = 0, ultimaVar = -1, fins = [], virtualAte = 0;
  const saidas = new WeakMap(), presos = new Set();
  const MAX_VOZES = 10;

  // ---------- peças de som ----------
  function buffers(c) {
    if (ctxBuf === c) return; ctxBuf = c;
    const n = c.sampleRate;
    ruido = c.createBuffer(1, n, c.sampleRate); grao = c.createBuffer(1, n, c.sampleRate);
    const d = ruido.getChannelData(0), g = grao.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = Math.random() * 2 - 1; g[i] = (Math.random() * 2 - 1) * (Math.random() < 0.07 ? 1 : 0.22); } // grão: o arranhado do lápis
  }
  const volume = () => A.limitar(Number((A.cfg.v.digitar || {}).volume ?? 70), 0, 100) / 100;
  function kit(b, g = 1) {
    let s = saidas.get(b);
    if (!s) { const out = b.c.createGain(), rev = b.c.createGain(); out.connect(b.mestre); rev.gain.value = 1; rev.connect(b.rev); s = { out, rev }; saidas.set(b, s); }
    s.out.gain.value = volume() * g; s.rev.gain.value = volume() * g; // g: deixa os temas com o mesmo volume
    buffers(b.c);
    return { c: b.c, out: s.out, rev: s.rev, fim: 0 };
  }
  // tom: oscilador com ataque curto e queda exponencial; "ate" escorrega a frequência
  function tom(k, f, t, dur, { tipo = 'sine', vol = 0.1, ate = 0, em = 0.8, ataque = 0.003, rev = 0 } = {}) {
    const c = k.c, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(Math.max(20, f), t);
    if (ate) o.frequency.exponentialRampToValueAtTime(Math.max(20, ate), t + dur * em);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(k.out);
    if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(k.rev); }
    o.start(t); o.stop(t + dur + 0.03); k.fim = Math.max(k.fim, t + dur);
  }
  // chiado: um pedaço de ruído passando por um filtro (cliques, arranhados, estalos)
  function chiado(k, t, dur, { f = 3000, ate = 0, q = 1, tipo = 'bandpass', vol = 0.1, ataque = 0.002, buf = 'ruido', rev = 0 } = {}) {
    const c = k.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf === 'grao' ? grao : ruido;
    fl.type = tipo; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
    if (ate) fl.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(k.out);
    if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(k.rev); }
    s.start(t, Math.random() * 0.6, dur + 0.03); k.fim = Math.max(k.fim, t + dur);
  }
  const crepitar = (k, t, dur, vol) => { for (let i = 0; i < 5; i++) chiado(k, t + Math.random() * dur, 0.004, { tipo: 'highpass', f: 4500 + Math.random() * 2500, vol: vol * (0.4 + Math.random() * 0.6) }); };
  const varias = (lista, fn) => lista.map((x) => (k, t, j) => fn(k, t, j, x));
  // (1.0.0) a caixinha de música: um dente do pente (tom puro + o parcial metálico agudo + o estalinho do pino) e a melodia que o cilindro toca
  const MELODIA = [1319, 1568, 2093, 1976, 1568, 1319, 1175, 1319, 1568, 1760, 1568, 1319, 1047, 1175, 1319, 1175];
  let passo = 0;
  const dente = (k, t, f, v = 1) => { tom(k, f, t, 0.9, { vol: 0.06 * v, rev: 0.45, ataque: 0.002 }); tom(k, f * 5.4, t, 0.05, { vol: 0.012 * v, ataque: 0.001 }); chiado(k, t, 0.004, { tipo: 'highpass', f: 6000, vol: 0.03 * v, ataque: 0.0004 }); };
  // (0.8.3) o "crec": várias rachaduras pequenas em sequência, cada uma mais fraca (como um osso ou um doce duro partindo),
  // com um estalo seco no começo e o corpo grave de algo que se parte
  function quebrar(k, t, j, { dur = 0.07, n = 7, corpo = 180, vol = 0.24, seco = 1 } = {}) {
    chiado(k, t, 0.01, { tipo: 'lowpass', f: 2600 * j, q: 0.8, vol: vol * 0.9 * seco, ataque: 0.0008 });
    tom(k, corpo * j, t, 0.05, { tipo: 'triangle', vol: vol * 0.5, ate: corpo * 0.55 * j, em: 1, ataque: 0.001 });
    let d = 0.002;
    for (let i = 0; i < n; i++) {
      d += Math.random() * (dur / n) * 1.6;
      const forca = Math.pow(0.82, i) * (0.6 + Math.random() * 0.4);
      chiado(k, t + d, 0.003 + Math.random() * 0.006, { f: (1400 + Math.random() * 4200) * j, q: 1.4 + Math.random() * 2, vol: vol * forca, ataque: 0.0006 });
    }
  }

  // ---------- os temas ----------
  const TEMAS = {
    bolha: { nome: ['Bolha', 'Bubble'], ic: '🫧',
      normal: varias([880, 1040, 1230, 1400], (k, t, j, f) => tom(k, f * 0.55 * j, t, 0.09, { ate: f * j, em: 0.3, vol: 0.13, rev: 0.25 })),
      espaco: (k, t, j) => { tom(k, 420 * j, t, 0.14, { ate: 640 * j, em: 0.35, vol: 0.15, rev: 0.3 }); tom(k, 900 * j, t + 0.05, 0.07, { ate: 1300 * j, em: 0.3, vol: 0.06, rev: 0.3 }); },
      apagar: (k, t, j) => { tom(k, 1300 * j, t, 0.07, { ate: 650 * j, em: 0.9, vol: 0.11, rev: 0.2 }); chiado(k, t, 0.012, { f: 5000, vol: 0.04 }); },
      enter: (k, t) => [700, 980, 1380].forEach((f, i) => tom(k, f * 0.6, t + i * 0.055, 0.1, { ate: f, em: 0.3, vol: 0.12, rev: 0.35 })),
    },
    terminal: { nome: ['Terminal', 'Terminal'], ic: '💻', g: 1.8,
      normal: varias([[2400, 190], [2800, 205], [3200, 180], [2600, 215]], (k, t, j, [fc, lo]) => { chiado(k, t, 0.018, { f: fc * j, q: 1.8, vol: 0.16 }); tom(k, lo * j, t, 0.03, { tipo: 'square', vol: 0.025 }); tom(k, 4200 * j, t + 0.002, 0.008, { tipo: 'square', vol: 0.012 }); }),
      espaco: (k, t, j) => { chiado(k, t, 0.03, { f: 1500, q: 1.2, vol: 0.16 }); tom(k, 120 * j, t, 0.05, { tipo: 'square', vol: 0.03 }); },
      apagar: (k, t, j) => { chiado(k, t, 0.018, { f: 3600, q: 2, vol: 0.14 }); tom(k, 1600 * j, t + 0.005, 0.025, { tipo: 'square', vol: 0.02, ate: 900 }); },
      enter: (k, t) => { chiado(k, t, 0.03, { f: 1800, q: 1.2, vol: 0.18 }); tom(k, 100, t, 0.06, { tipo: 'square', vol: 0.035 }); tom(k, 1200, t + 0.04, 0.07, { tipo: 'square', vol: 0.03, ataque: 0.001 }); },
    },
    carta: { nome: ['Carta', 'Letter'], ic: '✏️', g: 2.2,
      normal: varias([[3800, 5200, 0.055], [4400, 3600, 0.07], [3200, 4600, 0.05], [5000, 4000, 0.065]], (k, t, j, [f0, f1, d]) => { chiado(k, t, d, { buf: 'grao', f: f0 * j, ate: f1 * j, q: 0.9, vol: 0.22, ataque: 0.012 }); chiado(k, t, 0.006, { f: 2000, q: 1, vol: 0.05 }); }),
      espaco: (k, t, j) => chiado(k, t, 0.12, { buf: 'grao', f: 2400 * j, ate: 3200 * j, q: 0.7, vol: 0.12, ataque: 0.03 }),
      apagar: (k, t) => { chiado(k, t, 0.06, { buf: 'grao', f: 900, ate: 1300, q: 1.2, vol: 0.2, ataque: 0.015 }); chiado(k, t + 0.07, 0.06, { buf: 'grao', f: 1300, ate: 900, q: 1.2, vol: 0.16, ataque: 0.015 }); },
      enter: (k, t) => { chiado(k, t, 0.16, { buf: 'grao', f: 3000, ate: 5200, q: 0.8, vol: 0.2, ataque: 0.02 }); chiado(k, t + 0.2, 0.012, { f: 2200, q: 1.5, vol: 0.12 }); },
    },
    // (0.8.7) switch azul (clicky, tipo o teclado do Opera GX): o "tic" agudo e seco da lingueta ao descer, o "toc" plástico
    // quando a tecla bate no fundo e um "tic" mais fraco na volta
    mecanico: { nome: ['Mecânico', 'Mechanical'], ic: '⌨️', g: 1.15,
      normal: varias([[4300, 250], [4700, 265], [4000, 240], [4500, 275]], (k, t, j, [clique, corpo]) => {
        chiado(k, t, 0.006, { f: clique * j, q: 3.2, vol: 0.24, ataque: 0.0005 });           // tic da lingueta
        chiado(k, t, 0.003, { tipo: 'highpass', f: 7000, vol: 0.07, ataque: 0.0004 });         // brilho do estalo
        tom(k, clique * 0.72 * j, t, 0.012, { tipo: 'triangle', vol: 0.035, ate: clique * 0.6 * j, em: 1, ataque: 0.0005 });
        chiado(k, t + 0.013, 0.014, { tipo: 'lowpass', f: 2300 * j, q: 0.9, vol: 0.13, ataque: 0.0008 }); // toc no fundo
        tom(k, corpo * j, t + 0.013, 0.035, { vol: 0.075, ate: corpo * 0.75 * j, em: 1, ataque: 0.001 });
        chiado(k, t + 0.08, 0.005, { f: clique * 0.85 * j, q: 2.8, vol: 0.09, ataque: 0.0005 }); // tic da volta
      }),
      espaco: (k, t, j) => {
        chiado(k, t, 0.007, { f: 3300 * j, q: 2.6, vol: 0.22, ataque: 0.0005 });
        chiado(k, t + 0.014, 0.02, { tipo: 'lowpass', f: 1700 * j, q: 0.9, vol: 0.16, ataque: 0.001 });
        tom(k, 160 * j, t + 0.014, 0.06, { vol: 0.12, ate: 115, em: 1, ataque: 0.001 });
        chiado(k, t + 0.018, 0.03, { f: 950, q: 1.6, vol: 0.05 }); // o estabilizador da barra
        chiado(k, t + 0.1, 0.006, { f: 3000 * j, q: 2.6, vol: 0.09, ataque: 0.0005 });
      },
      apagar: (k, t, j) => {
        chiado(k, t, 0.006, { f: 3700 * j, q: 3, vol: 0.21, ataque: 0.0005 });
        chiado(k, t + 0.012, 0.012, { tipo: 'lowpass', f: 2100 * j, q: 0.9, vol: 0.12, ataque: 0.0008 });
        tom(k, 230 * j, t + 0.012, 0.03, { vol: 0.07, ate: 180, em: 1, ataque: 0.001 });
        chiado(k, t + 0.07, 0.005, { f: 3300 * j, q: 2.8, vol: 0.08, ataque: 0.0005 });
      },
      enter: (k, t, j) => {
        chiado(k, t, 0.007, { f: 3600 * j, q: 2.8, vol: 0.25, ataque: 0.0005 });
        chiado(k, t, 0.003, { tipo: 'highpass', f: 6500, vol: 0.08, ataque: 0.0004 });
        chiado(k, t + 0.015, 0.022, { tipo: 'lowpass', f: 1600 * j, q: 0.9, vol: 0.18, ataque: 0.001 });
        tom(k, 145 * j, t + 0.015, 0.07, { vol: 0.13, ate: 105, em: 1, ataque: 0.001 });
        chiado(k, t + 0.02, 0.03, { f: 850, q: 1.6, vol: 0.05 });
        chiado(k, t + 0.11, 0.006, { f: 3200 * j, q: 2.6, vol: 0.1, ataque: 0.0005 });
      },
    },
    raio: { nome: ['Raio', 'Lightning'], ic: '⚡', g: 1.4,
      normal: varias([2600, 3200, 2200, 2900], (k, t, j, f) => { tom(k, f * j, t, 0.045, { tipo: 'sawtooth', ate: 180, em: 1, vol: 0.035 }); crepitar(k, t, 0.05, 0.1); }),
      espaco: (k, t) => { tom(k, 90, t, 0.12, { tipo: 'sawtooth', vol: 0.04, ate: 60, em: 1 }); tom(k, 1800, t, 0.08, { tipo: 'sawtooth', ate: 120, em: 1, vol: 0.025 }); crepitar(k, t, 0.12, 0.12); },
      apagar: (k, t) => { tom(k, 180, t, 0.05, { tipo: 'sawtooth', ate: 2400, em: 1, vol: 0.03 }); crepitar(k, t, 0.04, 0.09); },
      enter: (k, t) => { chiado(k, t, 0.35, { tipo: 'lowpass', f: 1800, ate: 200, q: 0.7, vol: 0.25, ataque: 0.005 }); tom(k, 3500, t, 0.12, { tipo: 'sawtooth', ate: 80, em: 1, vol: 0.04 }); crepitar(k, t, 0.2, 0.15); },
    },
    pixel: { nome: ['Pixel', 'Pixel'], ic: '👾', g: 1.6,
      normal: varias([1047, 1175, 1319, 1568], (k, t, j, f) => tom(k, f, t, 0.035, { tipo: 'square', vol: 0.05, ataque: 0.001 })),
      espaco: (k, t) => tom(k, 523, t, 0.05, { tipo: 'square', vol: 0.05, ataque: 0.001 }),
      apagar: (k, t) => tom(k, 784, t, 0.06, { tipo: 'square', vol: 0.045, ate: 392, em: 1, ataque: 0.001 }),
      enter: (k, t) => { tom(k, 988, t, 0.06, { tipo: 'square', vol: 0.05, ataque: 0.001 }); tom(k, 1319, t + 0.06, 0.16, { tipo: 'square', vol: 0.05, ataque: 0.001 }); },
    },
    vidro: { nome: ['Vidro', 'Glass'], ic: '🎐', g: 1.2,
      normal: varias([1568, 1760, 2093, 2349], (k, t, j, f) => { tom(k, f, t, 0.18, { vol: 0.07, rev: 0.5 }); tom(k, f * 2.76, t, 0.06, { vol: 0.02 }); }),
      espaco: (k, t) => tom(k, 1175, t, 0.22, { vol: 0.07, rev: 0.5 }),
      apagar: (k, t) => tom(k, 2093, t, 0.12, { vol: 0.06, ate: 1568, em: 1, rev: 0.4 }),
      enter: (k, t) => { tom(k, 1568, t, 0.3, { vol: 0.07, rev: 0.6 }); tom(k, 2349, t + 0.07, 0.4, { vol: 0.07, rev: 0.6 }); },
    },
    maquina: { nome: ['Máquina de escrever', 'Typewriter'], ic: '📃',
      normal: varias([0, 1, 2, 3], (k, t, j, v) => { chiado(k, t, 0.012, { f: 2200 * j, q: 1.2, vol: 0.25 }); tom(k, (140 + 20 * v) * j, t, 0.04, { vol: 0.14, ate: 100, em: 1 }); tom(k, (3200 + 300 * v) * j, t + 0.001, 0.02, { tipo: 'triangle', vol: 0.03 }); chiado(k, t + 0.008, 0.02, { tipo: 'lowpass', f: 900, vol: 0.1 }); }),
      espaco: (k, t, j) => { tom(k, 110 * j, t, 0.06, { vol: 0.16, ate: 80, em: 1 }); chiado(k, t, 0.02, { f: 900, q: 1, vol: 0.15 }); tom(k, 2600, t + 0.01, 0.05, { tipo: 'triangle', vol: 0.012 }); },
      apagar: (k, t) => { chiado(k, t, 0.01, { f: 2800, q: 1.5, vol: 0.18 }); tom(k, 180, t, 0.03, { vol: 0.1 }); },
      enter: (k, t) => { // o "tim" da campainha e a volta do carro
        tom(k, 2350, t, 0.9, { vol: 0.08, rev: 0.35 }); tom(k, 2350 * 2.76, t, 0.3, { vol: 0.015 });
        for (let i = 0; i < 9; i++) chiado(k, t + 0.05 + i * 0.028, 0.006, { f: 3000, q: 2, vol: 0.09 });
        chiado(k, t + 0.05, 0.28, { f: 1200, ate: 2600, q: 1, vol: 0.08, ataque: 0.05 }); tom(k, 120, t + 0.34, 0.06, { vol: 0.15 });
      },
    },
    madeira: { nome: ['Madeira', 'Wood'], ic: '🪵',
      normal: varias([620, 700, 780, 860], (k, t, j, f) => { tom(k, f * j, t, 0.07, { vol: 0.16, ate: f * 0.92 * j, em: 1 }); tom(k, f * 2.4 * j, t, 0.02, { tipo: 'triangle', vol: 0.03 }); chiado(k, t, 0.008, { f: 1800, q: 2, vol: 0.08 }); }),
      espaco: (k, t, j) => { tom(k, 420 * j, t, 0.1, { vol: 0.17, ate: 390 * j, em: 1 }); chiado(k, t, 0.01, { f: 900, q: 2, vol: 0.08 }); },
      apagar: (k, t) => { tom(k, 900, t, 0.05, { vol: 0.13 }); tom(k, 760, t + 0.045, 0.05, { vol: 0.11 }); },
      enter: (k, t) => { tom(k, 520, t, 0.1, { vol: 0.16 }); chiado(k, t, 0.01, { f: 1500, q: 2, vol: 0.08 }); tom(k, 780, t + 0.07, 0.12, { vol: 0.15 }); },
    },
    // (0.8.3) quebrando algo: osso, doce duro, biscoito
    quebrar: { nome: ['Crocante', 'Crunch'], ic: '🦴', g: 1.5,
      normal: varias([[160, 6, 0.06], [190, 7, 0.075], [220, 5, 0.05], [175, 8, 0.085]], (k, t, j, [corpo, n, dur]) => quebrar(k, t, j, { corpo, n, dur })),
      espaco: (k, t, j) => { quebrar(k, t, j, { corpo: 120, n: 10, dur: 0.12, vol: 0.27 }); chiado(k, t + 0.01, 0.09, { tipo: 'lowpass', f: 700, q: 0.7, vol: 0.08, ataque: 0.004 }); },
      apagar: (k, t, j) => { quebrar(k, t, j * 1.25, { corpo: 260, n: 4, dur: 0.04, vol: 0.2 }); },
      enter: (k, t, j) => { // um estalo grande e os pedaços caindo
        quebrar(k, t, j, { corpo: 95, n: 14, dur: 0.16, vol: 0.3, seco: 1.3 });
        for (let i = 0; i < 4; i++) quebrar(k, t + 0.2 + i * (0.05 + Math.random() * 0.04), j * (1.2 + Math.random() * 0.4), { corpo: 300, n: 2, dur: 0.02, vol: 0.09 - i * 0.015 });
      },
    },
    nave: { nome: ['Nave', 'Spaceship'], ic: '🛸', g: 1.3,
      normal: varias([1200, 1500, 1800, 1350], (k, t, j, f) => { tom(k, f * j, t, 0.06, { ate: f * 1.6 * j, em: 1, vol: 0.07, rev: 0.3 }); tom(k, f * 3 * j, t, 0.03, { vol: 0.015 }); }),
      espaco: (k, t) => tom(k, 500, t, 0.12, { ate: 900, em: 1, vol: 0.07, rev: 0.35 }),
      apagar: (k, t) => tom(k, 1600, t, 0.08, { ate: 700, em: 1, vol: 0.06, rev: 0.3 }),
      enter: (k, t) => [800, 1200, 1800].forEach((f, i) => tom(k, f, t + i * 0.05, 0.08, { ate: f * 1.4, em: 1, vol: 0.07, rev: 0.35 })),
    },
    // (1.0.0) os pacotes do Aero Bubble Donator e Supporter (n = nível do plano; sem o plano, o tema fica mudo e só dá para ouvir a prévia)
    // (1.0.0) gotas de verdade: o "plic" de uma gota caindo na água (um chiado curtinho, o tom que sobe muito rápido e ecoa como numa caverna)
    gota: { nome: ['Gotas', 'Drops'], ic: '💧', n: 3, g: 1.3,
      normal: varias([1500, 1800, 2100, 1650, 1950], (k, t, j, f) => {
        chiado(k, t, 0.006, { tipo: 'highpass', f: 5000, vol: 0.05, ataque: 0.0005 });
        tom(k, f * 0.4 * j, t, 0.05, { ate: f * j, em: 0.25, vol: 0.12, ataque: 0.001, rev: 0.9 });
        tom(k, f * 1.02 * j, t + 0.012, 0.03, { vol: 0.03, rev: 0.9 });
      }),
      espaco: (k, t, j) => { tom(k, 160 * j, t, 0.12, { ate: 90, em: 1, vol: 0.12, ataque: 0.002 }); chiado(k, t, 0.06, { tipo: 'lowpass', f: 900, q: 0.8, vol: 0.06 }); tom(k, 700 * j, t + 0.02, 0.06, { ate: 1500 * j, em: 0.3, vol: 0.06, rev: 1 }); },
      apagar: (k, t, j) => { tom(k, 2200 * j, t, 0.04, { ate: 900 * j, em: 0.4, vol: 0.08, ataque: 0.001, rev: 0.7 }); },
      enter: (k, t) => [[1400, 0], [1900, 0.11], [1600, 0.19], [2300, 0.33]].forEach(([f, d]) => { chiado(k, t + d, 0.005, { tipo: 'highpass', f: 5000, vol: 0.04 }); tom(k, f * 0.4, t + d, 0.06, { ate: f, em: 0.25, vol: 0.11, ataque: 0.001, rev: 1 }); }),
    },
    // (1.0.0) caixinha de música de verdade: cada tecla toca a PRÓXIMA nota de uma melodia (o cilindro girando), com o "tlim" metálico do pente
    caixinha: { nome: ['Caixinha de música', 'Music box'], ic: '🎶', n: 3, g: 1.1,
      normal: [(k, t) => { const f = MELODIA[passo++ % MELODIA.length]; dente(k, t, f); }],
      espaco: (k, t) => { dente(k, t, 1047, 0.9); dente(k, t, 1568, 0.5); },
      apagar: (k, t) => { passo = Math.max(0, passo - 1); chiado(k, t, 0.012, { tipo: 'highpass', f: 3500, vol: 0.05 }); tom(k, 260, t, 0.03, { tipo: 'triangle', vol: 0.03 }); },
      enter: (k, t) => { [1047, 1319, 1568, 2093].forEach((f, i) => dente(k, t + i * 0.07, f, 0.9)); passo = 0; },
    },
    // (1.0.0) fliperama de verdade: o "clac" do botão do gabinete e o tirinho da nave (o Pixel é o videogame de 8 bits, só notas)
    arcade: { nome: ['Fliperama', 'Arcade'], ic: '🕹️', n: 3, g: 1.4,
      normal: varias([1, 1.12, 0.92, 1.06], (k, t, j, m) => {
        chiado(k, t, 0.01, { tipo: 'lowpass', f: 1900 * m, q: 1.2, vol: 0.2, ataque: 0.0006 }); // o botão côncavo
        tom(k, 220 * m * j, t, 0.03, { tipo: 'triangle', vol: 0.06, ate: 150, em: 1, ataque: 0.001 });
        tom(k, 2600 * m * j, t + 0.012, 0.07, { tipo: 'sawtooth', ate: 700 * m, em: 1, vol: 0.022, ataque: 0.001 }); // o tirinho
      }),
      espaco: (k, t) => { chiado(k, t, 0.014, { tipo: 'lowpass', f: 1300, q: 1, vol: 0.24, ataque: 0.0008 }); tom(k, 130, t, 0.06, { tipo: 'triangle', vol: 0.08, ate: 90, em: 1 }); tom(k, 180, t + 0.02, 0.14, { tipo: 'sawtooth', ate: 900, em: 1, vol: 0.02 }); },
      apagar: (k, t) => { chiado(k, t, 0.01, { tipo: 'lowpass', f: 1600, q: 1.2, vol: 0.18 }); tom(k, 900, t + 0.01, 0.12, { tipo: 'sawtooth', ate: 120, em: 1, vol: 0.022 }); },
      enter: (k, t) => { chiado(k, t, 0.016, { tipo: 'lowpass', f: 1500, q: 1, vol: 0.24 }); for (let i = 0; i < 6; i++) tom(k, 400 + i * 260, t + 0.02 + i * 0.035, 0.05, { tipo: 'sawtooth', vol: 0.02, ataque: 0.001 }); chiado(k, t + 0.24, 0.18, { tipo: 'lowpass', f: 700, ate: 200, q: 0.7, vol: 0.12, ataque: 0.004 }); },
    },
    harpa: { nome: ['Harpa', 'Harp'], ic: '🪕', n: 4, g: 1.1,
      normal: varias([523, 587, 659, 784, 880, 1047], (k, t, j, f) => { tom(k, f, t, 0.7, { tipo: 'triangle', vol: 0.06, rev: 0.6 }); tom(k, f * 2, t, 0.3, { vol: 0.02, rev: 0.5 }); }),
      espaco: (k, t) => tom(k, 392, t, 0.8, { tipo: 'triangle', vol: 0.06, rev: 0.6 }),
      apagar: (k, t) => tom(k, 440, t, 0.4, { tipo: 'triangle', vol: 0.05, ate: 392, em: 1, rev: 0.5 }),
      enter: (k, t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tom(k, f, t + i * 0.045, 0.9, { tipo: 'triangle', vol: 0.055, rev: 0.7 })),
    },
    // (1.0.0) cosmos repaginado: estrelas que cintilam (dois tons quase iguais "batendo" num eco enorme) e, no espaço, um planeta passando lá embaixo
    cosmo: { nome: ['Cosmos', 'Cosmos'], ic: '🌌', n: 4, g: 1.25,
      normal: varias([1760, 2093, 2637, 1976, 2349], (k, t, j, f) => {
        tom(k, f * j, t, 0.5, { vol: 0.035, rev: 1, ataque: 0.004 }); tom(k, f * 1.006 * j, t, 0.5, { vol: 0.035, rev: 1, ataque: 0.004 });
        tom(k, f * 2.01 * j, t + 0.01, 0.15, { vol: 0.01, rev: 1 });
        chiado(k, t, 0.05, { tipo: 'highpass', f: 9000, vol: 0.018, ataque: 0.004, rev: 1 }); // o cintilar
      }),
      espaco: (k, t, j) => { tom(k, 65 * j, t, 0.9, { ate: 55, em: 1, vol: 0.09, ataque: 0.08, rev: 0.8 }); tom(k, 98 * j, t, 0.8, { vol: 0.04, ataque: 0.1, rev: 0.9 }); tom(k, 1318 * j, t + 0.05, 0.6, { vol: 0.015, rev: 1, ataque: 0.05 }); },
      apagar: (k, t, j) => { tom(k, 2637 * j, t, 0.35, { ate: 1319 * j, em: 1, vol: 0.03, rev: 1 }); tom(k, 2650 * j, t, 0.35, { ate: 1325 * j, em: 1, vol: 0.03, rev: 1 }); },
      enter: (k, t) => { [523, 784, 1175, 1760, 2637].forEach((f, i) => { tom(k, f, t + i * 0.09, 1.1, { vol: 0.03, rev: 1, ataque: 0.03 }); tom(k, f * 1.005, t + i * 0.09, 1.1, { vol: 0.03, rev: 1, ataque: 0.03 }); }); chiado(k, t + 0.3, 0.5, { tipo: 'highpass', f: 8000, vol: 0.015, ataque: 0.1, rev: 1 }); tom(k, 65, t, 1.2, { vol: 0.07, ataque: 0.15, rev: 0.8 }); },
    },
  };

  function tocar(tema, tipo) {
    const P = TEMAS[tema]; if (!P) return false;
    const agora = performance.now(); if (agora - ultimo < 22) return false; // tecla em cima de tecla: um som só
    const b = A.som.mesa(); if (!b) return false;
    const k = kit(b, P.g || 1), t = k.c.currentTime + 0.005;
    if (fins.c !== k.c) { fins = []; fins.c = k.c; } // os fins são do relógio deste contexto
    fins = fins.filter((x) => x > t); fins.c = k.c; if (fins.length >= MAX_VOZES) return false; // teto de sons ao mesmo tempo
    let fn = P[tipo];
    if (tipo === 'normal') { const n = P.normal.length; let v = Math.floor(Math.random() * n); if (v === ultimaVar) v = (v + 1) % n; ultimaVar = v; fn = P.normal[v]; }
    if (!fn) return false;
    ultimo = agora;
    try { fn(k, t, 1 + (Math.random() - 0.5) * 0.05); } catch (e) { A.log.aviso('som de digitação', e); return false; }
    if (k.fim) fins.push(k.fim);
    return true;
  }

  // ---------- as teclas ----------
  const SEM_TEXTO = /^(checkbox|radio|range|color|file|button|submit|reset|image|hidden)$/i;
  const editavel = (el) => !!el && !el.disabled && !el.readOnly && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !SEM_TEXTO.test(el.type || '')));
  const liberado = (P) => !P.n || (A.extras && A.extras.tem(P.n)); // (1.0.0) os pacotes do Aero Bubble só tocam com o plano
  const temaAtual = () => { const d = A.cfg.v.digitar; return d && TEMAS[d.tema] && liberado(TEMAS[d.tema]) ? d.tema : ''; };
  const tipoDe = (key) => (key === ' ' ? 'espaco' : key === 'Backspace' || key === 'Delete' ? 'apagar' : key === 'Enter' ? 'enter' : key && key.length <= 2 && key !== 'Unidentified' ? 'normal' : null);
  document.addEventListener('keydown', (e) => {
    const tema = temaAtual(); if (!tema) return;
    const alvo = e.composedPath ? e.composedPath()[0] : e.target; if (!editavel(alvo)) return;
    if (e.key === 'Unidentified' || e.keyCode === 229) { virtualAte = performance.now() + 1000; return; } // teclado do celular: quem diz o que foi é o "input"
    if (e.isComposing || ((e.ctrlKey || e.metaKey || e.altKey) && !(e.getModifierState && e.getModifierState('AltGraph')))) return; // atalhos não tocam (o AltGr escreve, então toca)
    const id = e.code || e.key;
    if (e.repeat || presos.has(id)) return; // segurando a tecla: não repete
    const tipo = tipoDe(e.key); if (!tipo) return;
    presos.add(id); tocar(tema, tipo);
  }, true);
  document.addEventListener('keyup', (e) => { presos.delete(e.code || e.key); }, true);
  window.addEventListener('blur', () => presos.clear());
  document.addEventListener('input', (e) => {
    if (performance.now() > virtualAte || !e.inputType) return;
    const tema = temaAtual(); if (!tema || !editavel(e.target)) return;
    const it = e.inputType;
    const tipo = it.startsWith('delete') ? 'apagar' : it === 'insertLineBreak' || it === 'insertParagraph' ? 'enter' : it === 'insertText' ? (e.data === ' ' ? 'espaco' : 'normal') : null;
    if (tipo) tocar(tema, tipo);
  }, true);

  // uma amostra do tema (nas configurações); devolve a função que para
  function amostra(tema) {
    const seq = ['normal', 'normal', 'normal', 'normal', 'espaco', 'normal', 'normal', 'normal', 'apagar', 'normal', 'enter'];
    const ts = seq.map((tipo, i) => setTimeout(() => { ultimo = 0; tocar(tema, tipo); }, i * 115 + (tipo === 'enter' ? 120 : 0)));
    return () => ts.forEach(clearTimeout);
  }

  // (0.8.7) sons de uma integração da oficina: só notas descritas (onda, frequência, duração, volume), tocadas aqui pelo app
  const tocarNotas = (l) => (k, t, j) => { for (const n of l) { if (n.o === 'ruido') chiado(k, t + n.em, n.dur, { f: n.f * j, ate: n.ate ? n.ate * j : 0, q: n.q, vol: n.vol }); else tom(k, n.f * j, t + n.em, n.dur, { tipo: n.o, vol: n.vol, ate: n.ate ? n.ate * j : 0, em: 0.6, rev: 0.15 }); } };
  const registrar = (id, def) => {
    if (!/^ig-[a-z0-9-]{1,30}$/.test(id)) return;
    if (!def) { delete TEMAS[id]; return; }
    TEMAS[id] = { nome: [def.nome, def.nome], ic: '🧩', ig: true, normal: def.normal.map(tocarNotas), espaco: def.espaco.length ? tocarNotas(def.espaco) : null, apagar: def.apagar.length ? tocarNotas(def.apagar) : null, enter: def.enter.length ? tocarNotas(def.enter) : null };
  };
  A.digitar = {
    get TEMAS() { return Object.entries(TEMAS).map(([id, p]) => [id, p.nome[0], p.nome[1], p.ic, p.n || 0]); },
    registrar,
    tocar, amostra,
    volume(v) { A.cfg.v.digitar = { ...(A.cfg.v.digitar || {}), volume: A.limitar(v, 0, 100) }; A.cfg.salvar(); },
    // para testes: quantos sons cada tema tem para as teclas comuns
    variantes: (tema) => (TEMAS[tema] ? TEMAS[tema].normal.length : 0),
  };
})();
