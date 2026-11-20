// Aero Stream - entrada virtual do app do PC: escolhe o jeito certo para o sistema (Linux: uinput; Windows: SendInput + ViGEm)
// e converte a posição absoluta do mouse (0 a 1 sobre a tela compartilhada) para a tela inteira. Criado por Ryan Victtor.
'use strict';

// regiao(): { x, y, w, h } da tela compartilhada em pixels reais; area(): { x, y, w, h } de todas as telas juntas. Se faltar algum, mouseAbs é ignorado.
function criarEntrada({ pastaDados, pastaRecursos, regiao = () => null, area = () => null, log = () => {}, aoHost = () => {}, aoMira = () => {}, plataforma = process.platform, impl = null, extra = {} } = {}) {
  let base = impl;
  const obter = () => {
    if (base) return base;
    if (plataforma === 'win32') base = require('./windows').criarWindows({ pastaDados, pastaRecursos, log, aoHost, aoMira, ...extra });
    else if (plataforma === 'linux') base = require('./linux').criarLinux({ log, aoHost });
    return base;
  };
  const SEM = { mouse: false, teclado: false, gamepad: false, motivo: 'sistema-sem-suporte' };
  const num = (v, a, b) => { v = +v; return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : 0; };
  return {
    disponivel: async () => { const b = obter(); return b ? b.disponivel() : SEM; },
    mouseRel: (dx, dy) => { const b = obter(); b && b.mouseRel(num(dx, -2000, 2000), num(dy, -2000, 2000)); },
    mouseAbs: (x, y) => {
      const b = obter(), r = regiao(), a = area(); if (!b || !r || !a || !a.w || !a.h) return;
      const px = r.x + num(x, 0, 1) * r.w, py = r.y + num(y, 0, 1) * r.h;
      b.mouseAbs(num((px - a.x) / a.w, 0, 1), num((py - a.y) / a.h, 0, 1));
    },
    botao: (bt, d) => { const b = obter(); b && b.botao(num(bt, 0, 4) | 0, d ? 1 : 0); },
    roda: (dx, dy) => { const b = obter(); b && b.roda(num(dx, -10, 10) | 0, num(dy, -10, 10) | 0); },
    tecla: (code, d) => { const b = obter(); if (b && typeof code === 'string' && code.length <= 24) b.tecla(code, d ? 1 : 0); },
    pad: (slot, p) => { const b = obter(); if (b && p && Array.isArray(p.a)) b.pad(num(slot, 0, 3) | 0, { b: num(p.b, 0, 0x1ffff) | 0, a: [0, 1, 2, 3].map((i) => num(p.a[i], -127, 127) | 0), lt: num(p.lt, 0, 255) | 0, rt: num(p.rt, 0, 255) | 0 }); },
    padSair: (slot) => { const b = obter(); b && b.padSair && b.padSair(num(slot, 0, 3) | 0); },
    soltarTudo: () => { const b = obter(); b && b.soltarTudo && b.soltarTudo(); },
    // alguém ganhou o mouse e o teclado: cria o teclado e o mouse virtuais já (o sistema leva um instante para reconhecer um aparelho
    // novo; criando só na 1ª tecla, as primeiras teclas se perdiam)
    preparar: () => { const b = obter(); b && b.preparar && b.preparar(); },
    parar: () => { if (base && base.parar) base.parar(); },
  };
}
module.exports = { criarEntrada };
