// Aero Stream - (1.0.6) "apertar para falar" com o Aero em segundo plano (jogando, em outra janela). O Electron só avisa quando um atalho
// global é APERTADO, nunca quando é solto, então um auxiliar pequeno olha só a tecla escolhida:
//  - Windows: AeroPtt.exe (compilado na hora pelo csc.exe do próprio Windows, como os outros auxiliares), pelo GetAsyncKeyState;
//  - Linux: ptt.py lendo os teclados/mouses de verdade (X11 e Wayland). Precisa poder ler o /dev/input: uma regra do udev ("uaccess",
//    só para quem está sentado no computador), instalada uma vez pelo pedido de senha do sistema.
// Com a janela do Aero em foco o próprio app já ouve a tecla; este módulo cobre o resto. Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { compilar } = require('../nativo');
const { buscar } = require('../entrada/teclas');

// tecla virtual do Windows por KeyboardEvent.code
const VK = Object.create(null);
for (let i = 0; i < 26; i++) VK['Key' + String.fromCharCode(65 + i)] = 65 + i;
for (let i = 0; i < 10; i++) { VK['Digit' + i] = 48 + i; VK['Numpad' + i] = 0x60 + i; }
for (let i = 1; i <= 24; i++) VK['F' + i] = 0x6f + i;
Object.assign(VK, {
  Space: 0x20, Tab: 0x09, CapsLock: 0x14, Enter: 0x0d, Backspace: 0x08, Escape: 0x1b, ShiftLeft: 0xa0, ShiftRight: 0xa1, ControlLeft: 0xa2, ControlRight: 0xa3,
  AltLeft: 0xa4, AltRight: 0xa5, MetaLeft: 0x5b, MetaRight: 0x5c, ContextMenu: 0x5d, Backquote: 0xc0, Minus: 0xbd, Equal: 0xbb, BracketLeft: 0xdb, BracketRight: 0xdd,
  Backslash: 0xdc, Semicolon: 0xba, Quote: 0xde, Comma: 0xbc, Period: 0xbe, Slash: 0xbf, IntlBackslash: 0xe2, IntlRo: 0xc1, Insert: 0x2d, Delete: 0x2e, Home: 0x24, End: 0x23,
  PageUp: 0x21, PageDown: 0x22, ArrowUp: 0x26, ArrowDown: 0x28, ArrowLeft: 0x25, ArrowRight: 0x27, Pause: 0x13, ScrollLock: 0x91, NumLock: 0x90, PrintScreen: 0x2c,
  NumpadMultiply: 0x6a, NumpadAdd: 0x6b, NumpadSubtract: 0x6d, NumpadDecimal: 0x6e, NumpadDivide: 0x6f, NumpadEnter: 0x0d,
});
// botões do mouse (numeração da web): 1 meio, 3 voltar, 4 avançar. O esquerdo e o direito não valem como atalho
const MOUSE_VK = { 1: 0x04, 3: 0x05, 4: 0x06 }, MOUSE_EVDEV = { 1: 0x112, 3: 0x113, 4: 0x114 };
const evdevDe = (code) => { const m = /^F(1[3-9]|2[0-4])$/.exec(code || ''); if (m) return 183 + (+m[1] - 13); const k = buscar(code); return k ? k[0] : 0; };

// o que precisa para o Linux deixar ler só os teclados e mouses (o mesmo acesso de quem está no grupo "input", só para a pessoa sentada ao PC)
const REGRA = 'SUBSYSTEM=="input", KERNEL=="event*", ENV{ID_INPUT_KEYBOARD}=="1", TAG+="uaccess"\nSUBSYSTEM=="input", KERNEL=="event*", ENV{ID_INPUT_MOUSE}=="1", TAG+="uaccess"';
const SCRIPT = "set -e; printf '%s\\n' '" + REGRA.split('\n').join("' '") + "' > /etc/udev/rules.d/60-aero-apertar.rules; chmod 0644 /etc/udev/rules.d/60-aero-apertar.rules; "
  + 'udevadm control --reload-rules 2>/dev/null || true; udevadm trigger --subsystem-match=input --action=change 2>/dev/null || true';

function criarApertar({ pastaDados, log = () => {}, aoMudar = () => {}, compilador = compilar, plataforma = process.platform } = {}) {
  let proc = null, atual = '', apertado = false, gen = 0;
  const soltar = () => { if (apertado) { apertado = false; aoMudar(false); } };
  function parar() {
    gen++; atual = ''; soltar();
    const p = proc; proc = null;
    if (p) { try { p.stdin.end(); } catch (e) { /* ok */ } try { p.kill(); } catch (e) { /* ok */ } }
  }
  // atalho: { code: 'KeyV' } ou { botao: 3 }. -> { ok } | { ok: false, motivo: 'permissao' | 'sem-python' | 'sem-compilador' | 'tecla' | 'sistema' | ... }
  async function ligar(atalho) {
    atalho = atalho || {};
    const botao = Number.isInteger(atalho.botao) ? atalho.botao : null, code = typeof atalho.code === 'string' ? atalho.code.slice(0, 40) : '';
    const chave = botao != null ? 'b' + botao : 'k' + code;
    if (proc && atual === chave) return { ok: true };
    parar(); const eu = ++gen;
    let exe, args;
    if (plataforma === 'win32') {
      const vk = botao != null ? MOUSE_VK[botao] : VK[code]; if (!vk) return { ok: false, motivo: 'tecla' };
      const c = await compilador({ nome: 'AeroPtt', fonte: fs.readFileSync(path.join(__dirname, 'nativo', 'AeroPtt.cs'), 'utf8'), pasta: path.join(pastaDados, 'nativo') });
      if (!c.ok) { log('apertar: ' + c.erro); return { ok: false, motivo: c.erro === 'sem-csc' ? 'sem-compilador' : 'compilacao' }; }
      exe = c.exe; args = [String(vk)];
    } else if (plataforma === 'linux') {
      const ev = botao != null ? MOUSE_EVDEV[botao] : evdevDe(code); if (!ev) return { ok: false, motivo: 'tecla' };
      exe = 'python3'; args = ['-u', '-c', fs.readFileSync(path.join(__dirname, 'ptt.py'), 'utf8'), String(ev)];
    } else return { ok: false, motivo: 'sistema' };
    if (eu !== gen) return { ok: false, motivo: 'trocou' };
    return new Promise((resolve) => {
      let terminou = false, buf = '';
      const fim = (r) => { if (terminou) return; terminou = true; clearTimeout(t); if (!r.ok) { try { p.kill(); } catch (e) { /* ok */ } if (proc === p) proc = null; } resolve(r); };
      const t = setTimeout(() => fim({ ok: false, motivo: 'tempo-esgotado' }), 6000);
      let p;
      try { p = spawn(exe, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }); } catch (e) { return fim({ ok: false, motivo: 'iniciar' }); }
      proc = p; atual = chave;
      p.on('error', (e) => fim({ ok: false, motivo: e.code === 'ENOENT' ? 'sem-python' : 'iniciar' }));
      p.stdin.on('error', () => { /* o auxiliar fechou */ });
      p.stderr.on('data', (d) => log('apertar: ' + String(d).trim().slice(0, 200)));
      p.stdout.setEncoding('utf8');
      p.stdout.on('data', (d) => {
        buf += d; let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (proc !== p) return;
          if (linha === 'D' || linha === 'U') { const v = linha === 'D'; if (v !== apertado) { apertado = v; aoMudar(v); } continue; }
          if (terminou) continue;
          if (linha.startsWith('OK')) fim({ ok: true });
          else fim({ ok: false, motivo: linha === 'PERM' ? 'permissao' : linha.replace(/^ERR\s*/, '') || 'auxiliar' });
        }
      });
      p.on('exit', () => { if (proc === p) { proc = null; atual = ''; soltar(); } if (!terminou) fim({ ok: false, motivo: 'saiu' }); });
    });
  }
  // Linux: instala a regra (pede a senha do sistema). Depois é só ligar de novo
  function liberar() {
    if (plataforma !== 'linux') return Promise.resolve({ ok: false, motivo: 'sistema' });
    return new Promise((resolve) => execFile('pkexec', ['/bin/sh', '-c', SCRIPT], { timeout: 180000 }, (e, _o, err) => {
      if (!e) return setTimeout(() => resolve({ ok: true }), 900); // o udev aplica a permissão
      log('apertar: liberar ' + String(err || e.message).slice(0, 200));
      resolve({ ok: false, motivo: e.code === 126 || e.code === 127 || /dismissed|Not authorized/i.test(String(err || '')) ? 'cancelado' : 'falhou' });
    }));
  }
  return { ligar, parar, liberar, apertado: () => apertado, _vk: VK, _evdev: evdevDe };
}

module.exports = { criarApertar, VK, evdevDe };
