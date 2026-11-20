// Aero Stream - gerador de QR code (0.6.0), sem nada de fora: modo byte, correção de erro nível M, versões 1 a 10 (até ~210 caracteres).
// Usado para ligar o 2FA no Google Authenticator (o "otpauth://..." vira o desenho que a câmera do celular lê). Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  // [total de palavras, correção por bloco, blocos do grupo 1, dados por bloco 1, blocos do grupo 2, dados por bloco 2] (nível M)
  const TAB = [null, [26, 10, 1, 16, 0, 0], [44, 16, 1, 28, 0, 0], [70, 26, 1, 44, 0, 0], [100, 18, 2, 32, 0, 0], [134, 24, 2, 43, 0, 0], [172, 16, 4, 27, 0, 0], [196, 18, 4, 31, 0, 0], [242, 22, 2, 38, 2, 39], [292, 22, 3, 36, 2, 37], [346, 26, 4, 43, 1, 44]];
  const ALIN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  // aritmética de Galois (GF(256), polinômio 0x11D) para a correção de erros Reed-Solomon
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rs(dados, n) {
    let g = [1];
    for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; }
    const r = new Array(n).fill(0);
    for (const d of dados) { const f = d ^ r[0]; r.shift(); r.push(0); for (let j = 0; j < n; j++) r[j] ^= mul(g[j + 1], f); }
    return r;
  }
  function codificar(texto) {
    const bytes = [...new TextEncoder().encode(texto)];
    let v = 1;
    for (; v <= 10; v++) { const t = TAB[v], cap = t[2] * t[3] + t[4] * t[5]; if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap * 8) break; }
    if (v > 10) throw new Error('texto grande demais para o QR');
    const t = TAB[v], cap = t[2] * t[3] + t[4] * t[5];
    const bits = []; const pon = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pon(4, 4); pon(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => pon(b, 8));
    pon(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const dados = []; for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0; dados.length < cap; p++) dados.push(p % 2 ? 0x11 : 0xec);
    // blocos e intercalação
    const blocos = []; let o = 0;
    for (let i = 0; i < t[2]; i++) { blocos.push(dados.slice(o, o + t[3])); o += t[3]; }
    for (let i = 0; i < t[4]; i++) { blocos.push(dados.slice(o, o + t[5])); o += t[5]; }
    const ecs = blocos.map((b) => rs(b, t[1]));
    const fim = [];
    for (let i = 0; i < Math.max(t[3], t[5]); i++) for (const b of blocos) if (i < b.length) fim.push(b[i]);
    for (let i = 0; i < t[1]; i++) for (const e of ecs) fim.push(e[i]);
    // a matriz
    const n = 17 + v * 4, M = Array.from({ length: n }, () => new Array(n).fill(null));
    const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const y = r + i, x = c + j; if (y < 0 || x < 0 || y >= n || x >= n) continue; M[y][x] = i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)); } };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let i = 8; i < n - 8; i++) { M[6][i] = i % 2 === 0; M[i][6] = i % 2 === 0; }
    const al = ALIN[v], ult = al.length - 1;
    al.forEach((r, ai) => al.forEach((c, bi) => { if ((ai === 0 && bi === 0) || (ai === 0 && bi === ult) || (ai === ult && bi === 0)) return; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) M[r + i][c + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1; }));
    M[n - 8][8] = true; // o módulo escuro fixo
    const reservar = () => { for (let i = 0; i < 9; i++) { if (M[8][i] === null) M[8][i] = false; if (M[i][8] === null) M[i][8] = false; } for (let i = 0; i < 8; i++) { if (M[8][n - 1 - i] === null) M[8][n - 1 - i] = false; if (M[n - 1 - i][8] === null) M[n - 1 - i][8] = false; } if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { M[i][n - 11 + j] = false; M[n - 11 + j][i] = false; } };
    reservar();
    const livre = M.map((l) => l.map((x) => x === null));
    const bitsF = []; fim.forEach((b) => { for (let i = 7; i >= 0; i--) bitsF.push((b >> i) & 1); });
    let k = 0;
    for (let c = n - 1; c > 0; c -= 2) { if (c === 6) c--; for (let i = 0; i < n; i++) { const r = ((c + 1) & 2) === 0 ? n - 1 - i : i; for (let j = 0; j < 2; j++) { const x = c - j; if (livre[r][x]) M[r][x] = !!bitsF[k++]; } } }
    const MASK = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
    const formatar = (G, m) => {
      const d = (0 << 3) | m; let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); // nível M = 00
      const f = ((d << 10) | rem) ^ 0x5412, b = (i) => !!((f >>> i) & 1);
      for (let i = 0; i <= 5; i++) G[i][8] = b(i);
      G[7][8] = b(6); G[8][8] = b(7); G[8][7] = b(8);
      for (let i = 9; i < 15; i++) G[8][14 - i] = b(i);
      for (let i = 0; i < 8; i++) G[8][n - 1 - i] = b(i);
      for (let i = 8; i < 15; i++) G[n - 15 + i][8] = b(i);
      G[n - 8][8] = true;
      if (v >= 7) { let r2 = v; for (let i = 0; i < 12; i++) r2 = (r2 << 1) ^ ((r2 >>> 11) * 0x1f25); const vi = (v << 12) | r2; for (let i = 0; i < 18; i++) { const bb = !!((vi >>> i) & 1); G[Math.floor(i / 3)][n - 11 + (i % 3)] = bb; G[n - 11 + (i % 3)][Math.floor(i / 3)] = bb; } }
    };
    const pena = (G) => {
      let p = 0;
      for (let r = 0; r < n; r++) for (const lin of [G[r], G.map((l) => l[r])]) { let c = 1; for (let i = 1; i < n; i++) { if (lin[i] === lin[i - 1]) { c++; if (c === 5) p += 3; else if (c > 5) p++; } else c = 1; } }
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const x = G[r][c]; if (x === G[r][c + 1] && x === G[r + 1][c] && x === G[r + 1][c + 1]) p += 3; }
      let esc = 0; G.forEach((l) => l.forEach((x) => { if (x) esc++; })); p += Math.floor(Math.abs((esc * 100) / (n * n) - 50) / 5) * 10;
      return p;
    };
    let melhor = null, mp = Infinity;
    for (let m = 0; m < 8; m++) {
      const G = M.map((l, r) => l.map((x, c) => (livre[r][c] && MASK[m](r, c) ? !x : x)));
      formatar(G, m);
      const pp = pena(G); if (pp < mp) { mp = pp; melhor = G; }
    }
    return melhor;
  }
  // desenha num canvas (com a margem branca que os leitores precisam)
  A.qr = (texto, tam = 220) => {
    const G = codificar(texto), n = G.length, m = 4, escala = Math.max(2, Math.floor(tam / (n + m * 2)));
    const cv = document.createElement('canvas'); cv.width = cv.height = (n + m * 2) * escala;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#0b2235';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (G[r][c]) g.fillRect((c + m) * escala, (r + m) * escala, escala, escala);
    cv.className = 'qr';
    return cv;
  };
  A.qr._matriz = codificar; // para os testes
})();
