// Aero Stream - entrada virtual no Windows: mouse e teclado por SendInput (auxiliar AeroInput.exe, compilado na hora com o csc.exe do
// próprio Windows). Controles virtuais só com o ViGEmBus instalado e o ViGEmClient.dll na pasta "nativo" do app (veja o LEIA-ME).
// Limite do Windows: programas abertos "como administrador" não recebem entrada de um programa comum. Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { compilar } = require('../nativo');
const { buscar } = require('./teclas');

function criarWindows({ pastaDados, pastaRecursos = '', log = () => {}, compilador = compilar, aoHost = () => {}, aoMira = () => {} } = {}) {
  let proc = null, estadoProbe = null, falhouEm = 0, pronto = false, caps = { mouse: false, teclado: false, gamepad: false, motivo: '' };
  const pastaNativo = path.join(pastaDados, 'nativo');
  const achaVigem = () => [path.join(pastaNativo, 'ViGEmClient.dll'), path.join(pastaRecursos || '', 'nativo', 'ViGEmClient.dll'), path.join(__dirname, 'nativo', 'ViGEmClient.dll')].find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || '-';

  function iniciar() {
    if (estadoProbe) return estadoProbe;
    if (falhouEm && Date.now() - falhouEm < 30000) return Promise.resolve({ ok: false, motivo: caps.motivo });
    estadoProbe = (async () => {
      const fonte = fs.readFileSync(path.join(__dirname, 'nativo', 'AeroInput.cs'), 'utf8');
      const c = await compilador({ nome: 'AeroInput', fonte, pasta: pastaNativo });
      if (!c.ok) { log('entrada: ' + c.erro); return falha(c.erro === 'sem-csc' ? 'sem-compilador' : 'compilacao'); }
      return new Promise((resolve) => {
        let terminou = false, buf = '';
        const fim = (r) => { if (terminou) return; terminou = true; clearTimeout(t); if (!r.ok) { falhouEm = Date.now(); estadoProbe = null; try { proc && proc.kill(); } catch (e) { /* ok */ } proc = null; } resolve(r); };
        const t = setTimeout(() => fim(falha('tempo-esgotado')), 6000);
        try { proc = spawn(c.exe, [achaVigem()], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }); } catch (e) { return fim(falha('iniciar')); }
        proc.on('error', (e) => fim(falha(String(e.message))));
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (d) => {
          buf += d;
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (linha === 'HOST') { aoHost(); continue; } // a pessoa deste computador mexeu no mouse/teclado de verdade
            if (linha.startsWith('MIRA ')) { aoMira(linha === 'MIRA 1'); continue; } // um jogo escondeu/prendeu o cursor (ou soltou)
            if (terminou) continue;
            const m = linha.match(/^AERO (\d) (\d) (\d) (\S+)/);
            if (!m) { fim(falha('resposta-invalida')); continue; }
            caps = { mouse: m[1] === '1', teclado: m[2] === '1', gamepad: m[3] === '1', motivo: m[4] === '-' ? '' : m[4] };
            pronto = true; fim({ ok: true });
          }
        });
        proc.stderr.on('data', (d) => log('entrada: ' + String(d).trim().slice(0, 200)));
        proc.stdin.on('error', () => { /* fechou */ });
        proc.on('exit', () => { proc = null; pronto = false; estadoProbe = null; if (!terminou) fim(falha('saiu')); });
      });
    })();
    return estadoProbe;
  }
  const falha = (m) => { caps = { mouse: false, teclado: false, gamepad: false, motivo: m }; falhouEm = Date.now(); estadoProbe = null; return { ok: false, motivo: m }; };

  const enviar = (linha) => {
    if (!pronto || !proc || !proc.stdin.writable) { iniciar(); return; }
    try { proc.stdin.write(linha + '\n'); } catch (e) { /* ok */ }
  };

  // O ViGEmBus está instalado no Windows? (serviço "ViGEmBus"). Antes o app pedia para instalar toda vez que o controle virtual falhava,
  // mesmo já instalado (ex.: instalado depois do app abrir, ou faltando só o ViGEmClient.dll).
  // (0.5.9-7) o "sc" responde no idioma do Windows ("STATE" em inglês, "ESTADO" em português...): procurar a palavra STATE fazia o Windows
  // em português SEMPRE parecer sem o ViGEmBus, e o app pedia para instalar toda vez. Agora vale o código de saída (1060 = o serviço não
  // existe) e o número do estado (4 = rodando), que não mudam com o idioma.
  // (0.8.0) o driver pode já estar no sistema mesmo quando o "sc" não confirma (demorou, ou o Windows ainda não ligou o serviço depois de
  // instalar): se o arquivo do driver ou a chave dele existem, conta como instalado (no máximo falta reiniciar) e o app não pede para instalar de novo.
  const driverNoDisco = () => {
    const win = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
    try { if (fs.statSync(path.join(win, 'System32', 'drivers', 'ViGEmBus.sys')).isFile()) return true; } catch (e) { /* segue */ }
    return false;
  };
  const chaveVigem = () => new Promise((res) => require('child_process').execFile('reg', ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\ViGEmBus'], { windowsHide: true, timeout: 4000 }, (e) => res(!e)));
  const servicoVigem = () => new Promise((res) => require('child_process').execFile('sc', ['query', 'ViGEmBus'], { windowsHide: true, timeout: 4000 }, async (e, out) => {
    const txt = String(out || '');
    const naoExiste = (e && (e.code === 1060 || /1060/.test(txt))) || !/:\s*\d+\s+[A-Z_]+/.test(txt);
    if (naoExiste) return res(driverNoDisco() || await chaveVigem() ? 'parado' : 'ausente');
    res(/:\s*4\s+RUNNING/i.test(txt) || /:\s*4\s/.test(txt) ? 'rodando' : 'parado');
  }));
  let reiniciouPorVigem = false;
  return {
    async disponivel() {
      let r = await iniciar();
      if (r.ok && !caps.gamepad) {
        const sv = await servicoVigem();
        // instalado depois de o auxiliar abrir: reabre o auxiliar uma vez para ele conectar
        if (sv === 'rodando' && caps.motivo === 'sem-vigembus' && !reiniciouPorVigem) { reiniciouPorVigem = true; this.parar(); r = await iniciar(); }
        if (r.ok && !caps.gamepad) {
          const motivo = caps.motivo === 'sem-vigem-dll' || caps.motivo === 'vigem-dll-invalida' ? 'sem-vigem-dll' : sv === 'ausente' ? 'gamepad-precisa-vigem' : 'vigem-sem-conexao';
          return { mouse: caps.mouse, teclado: caps.teclado, gamepad: false, tipo: 'windows-sendinput', motivo, vigem: sv };
        }
      }
      return r.ok ? { mouse: caps.mouse, teclado: caps.teclado, gamepad: caps.gamepad, tipo: 'windows-sendinput' } : { mouse: false, teclado: false, gamepad: false, tipo: 'windows-sendinput', motivo: r.motivo };
    },
    mouseRel: (dx, dy) => enviar(`mr ${Math.round(dx)} ${Math.round(dy)}`),
    mouseAbs: (x, y) => enviar(`ma ${Math.round(x * 65535)} ${Math.round(y * 65535)}`),
    botao: (b, d) => enviar(`mb ${b | 0} ${d ? 1 : 0}`),
    roda: (dx, dy) => enviar(`mw ${dx | 0} ${dy | 0}`),
    tecla: (code, d) => { const k = buscar(code); if (!k) return; if (code === 'Pause') enviar(`kv 19 ${d ? 1 : 0}`); else enviar(`k ${k[1]} ${k[2]} ${d ? 1 : 0}`); },
    pad: (slot, p) => enviar(`p ${slot | 0} ${p.b | 0} ${p.a[0] | 0} ${p.a[1] | 0} ${p.a[2] | 0} ${p.a[3] | 0} ${p.lt | 0} ${p.rt | 0}`),
    padSair: (slot) => enviar(`px ${slot | 0}`),
    soltarTudo: () => enviar('r'),
    parar() { try { proc && proc.stdin.end(); } catch (e) { /* ok */ } const p = proc; setTimeout(() => { try { p && p.kill(); } catch (e) { /* ok */ } }, 500).unref(); proc = null; pronto = false; estadoProbe = null; },
  };
}

module.exports = { criarWindows };
