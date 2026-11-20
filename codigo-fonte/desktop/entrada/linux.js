// Aero Stream - entrada virtual no Linux: um pequeno programa em Python (uinput.py) cria mouse, teclado e controles de mentira no
// sistema e este arquivo manda os comandos para ele. Funciona em X11 e Wayland (a entrada é injetada no kernel).
// Precisa de acesso ao /dev/uinput (veja a regra do udev no LEIA-ME). Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { buscar } = require('./teclas');

function criarLinux({ log = () => {}, aoHost = () => {} } = {}) {
  let proc = null, estadoProbe = null, falhouEm = 0, pronto = false, motivo = '';
  const codigo = () => fs.readFileSync(path.join(__dirname, 'uinput.py'), 'utf8');

  function iniciar(python = 'python3') {
    if (estadoProbe) return estadoProbe;
    if (falhouEm && Date.now() - falhouEm < 20000) return Promise.resolve({ ok: false, motivo });
    estadoProbe = new Promise((resolve) => {
      let terminou = false, buf = '';
      const fim = (ok, m) => { if (terminou) return; terminou = true; clearTimeout(t); pronto = ok; motivo = m || ''; if (!ok) { falhouEm = Date.now(); estadoProbe = null; try { proc && proc.kill(); } catch (e) { /* ok */ } proc = null; } resolve({ ok, motivo: m || '' }); };
      let t = setTimeout(() => fim(false, 'tempo-esgotado'), 4000);
      try { proc = spawn(python, ['-u', '-c', codigo()], { stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return fim(false, 'python'); }
      proc.on('error', (e) => { if (e.code === 'ENOENT' && python === 'python3') { terminou = true; clearTimeout(t); proc = null; estadoProbe = null; iniciar('python').then(resolve); } else fim(false, e.code === 'ENOENT' ? 'python' : String(e.message)); });
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (linha === 'HOST') { aoHost(); continue; } // a pessoa deste computador mexeu no mouse/teclado de verdade
          if (terminou) continue;
          if (linha === 'OK') fim(true); else fim(false, /Permission|permiss/i.test(linha) ? 'permissao-uinput' : /No such file|n.o existe/i.test(linha) ? 'sem-uinput' : linha.replace(/^ERR\s*/, '') || 'uinput');
        }
      });
      proc.stderr.on('data', (d) => log('uinput: ' + String(d).trim().slice(0, 200)));
      proc.stdin.on('error', () => { /* o auxiliar fechou */ });
      proc.on('exit', () => { proc = null; pronto = false; estadoProbe = null; if (!terminou) fim(false, 'saiu'); });
    });
    return estadoProbe;
  }

  const enviar = (linha) => {
    if (!pronto || !proc || !proc.stdin.writable) { iniciar(); return; } // ainda não está pronto: o próximo comando já pega
    try { proc.stdin.write(linha + '\n'); } catch (e) { /* ok */ }
  };

  return {
    async disponivel() {
      const r = await iniciar();
      return r.ok ? { mouse: true, teclado: true, gamepad: true, tipo: 'linux-uinput' } : { mouse: false, teclado: false, gamepad: false, tipo: 'linux-uinput', motivo: r.motivo || 'indisponivel' };
    },
    mouseRel: (dx, dy) => enviar(`MR ${Math.round(dx)} ${Math.round(dy)}`),
    mouseAbs: (x, y) => enviar(`MA ${Math.round(x * 32767)} ${Math.round(y * 32767)}`),
    botao: (b, d) => enviar(`MB ${b | 0} ${d ? 1 : 0}`),
    roda: (dx, dy) => enviar(`MW ${dx | 0} ${dy | 0}`),
    tecla: (code, d) => { const k = buscar(code); if (k) enviar(`${d ? 'KD' : 'KU'} ${k[0]}`); },
    pad: (slot, p) => enviar(`P ${slot | 0} ${p.b | 0} ${p.a[0] | 0} ${p.a[1] | 0} ${p.a[2] | 0} ${p.a[3] | 0} ${p.lt | 0} ${p.rt | 0}`),
    padSair: (slot) => enviar(`PX ${slot | 0}`),
    soltarTudo: () => enviar('R'),
    preparar: () => enviar('PREP'),
    parar() { try { proc && proc.stdin.end(); } catch (e) { /* ok */ } const p = proc; setTimeout(() => { try { p && p.kill(); } catch (e) { /* ok */ } }, 500).unref(); proc = null; pronto = false; estadoProbe = null; },
    _estado: () => ({ pronto, motivo }),
  };
}

module.exports = { criarLinux };
