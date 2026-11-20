// Aero Stream - teste de UM perfil da placa de vídeo, numa cópia escondida do app (chamada com --aero-sonda=<perfil>). Criado por Ryan Victtor.
// Aplica as opções do perfil, abre uma janela invisível com sonda.html, mede e escreve UMA linha "AERO_SONDA {json}" na saída. Depois fecha.
// Roda com uma pasta de dados própria e sem a trava de "uma cópia só", para não mexer em nada do app aberto.
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');
const perfis = require('./perfis');

function rodar(app, BrowserWindow, session, id) {
  // o app principal pode ter fechado (ou já lido a resposta) antes desta cópia escrever: "EPIPE" aqui não é erro, a cópia só sai.
  // Sem isso o Electron mostrava a janela "A JavaScript error occurred in the main process" ao abrir o AppImage.
  for (const s of [process.stdout, process.stderr]) s.on('error', () => {});
  process.on('uncaughtException', (e) => { if (!(e && (e.code === 'EPIPE' || e.code === 'ERR_STREAM_DESTROYED'))) { try { fs.writeSync(2, 'sonda: ' + (e && e.stack || e) + '\n'); } catch (_) { /* ok */ } } app.exit(0); });
  const p = perfis.montar(id);
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-sonda-'));
  app.setPath('userData', dados);
  for (const [k, v] of p.chaves) app.commandLine.appendSwitch(k, v);
  app.commandLine.appendSwitch('enable-features', ['WebRTCPipeWireCapturer', ...p.ligar].join(','));
  app.commandLine.appendSwitch('disable-features', ['WebRtcScreenshareSwEncoding', ...p.desligar].join(','));
  app.commandLine.appendSwitch('use-fake-device-for-media-stream'); // câmera de mentira: libera o nome do codificador nas estatísticas
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  const semSandbox = require('./sandbox').precisaSemSandbox() || process.argv.includes('--no-sandbox'); // o mesmo que o app principal
  if (semSandbox) app.commandLine.appendSwitch('no-sandbox');

  let terminou = false;
  const fim = (r) => {
    if (terminou) return; terminou = true;
    try { if (process.stdout.writable) process.stdout.write('AERO_SONDA ' + JSON.stringify({ id: p.id, ...r }) + '\n'); } catch (e) { /* ok */ }
    try { fs.rmSync(dados, { recursive: true, force: true }); } catch (e) { /* ok */ }
    setTimeout(() => app.exit(0), 50);
  };
  app.on('child-process-gone', (_e, d) => { if (d.type === 'GPU' && d.reason !== 'clean-exit') fim({ ok: false, gpuCaiu: true, motivo: d.reason }); });
  setTimeout(() => fim({ ok: false, motivo: 'tempo' }), 25000);
  app.whenReady().then(async () => {
    try {
      session.defaultSession.setPermissionRequestHandler((_w, perm, ok) => ok(perm === 'media'));
      const w = new BrowserWindow({ show: false, width: 320, height: 240, webPreferences: { sandbox: !semSandbox, contextIsolation: true, backgroundThrottling: false } });
      await w.loadFile(path.join(__dirname, 'sonda.html'));
      const r = await w.webContents.executeJavaScript('window.__sonda()', true);
      let perfisGpu = [];
      try { const g = await app.getGPUInfo('complete'); const x = g && (g.videoEncodeAcceleratorSupportedProfile || g.videoEncodeAcceleratorSupportedProfiles); perfisGpu = (Array.isArray(x) ? x : x ? [x] : []).map((y) => (typeof y === 'string' ? y : y.profile || JSON.stringify(y))); } catch (e) { /* ok */ }
      // o que vale é o WebRTC (é ele que transmite); se o Chromium esconder o nome do codificador, vale o WebCodecs com "prefer-hardware"
      const placa = perfis.ehPlaca(r.webrtcImpl) || r.webrtcHw === true || (!r.webrtcImpl && r.webcodecs === true && r.wcQuadros > 0);
      fim({ ok: true, placa, ...r, perfisGpu, ozone: p.chaves.some(([k]) => k === 'ozone-platform') ? 'x11' : 'padrao' });
    } catch (e) { fim({ ok: false, motivo: String((e && e.message) || e).slice(0, 300) }); }
  });
}

module.exports = { rodar };
