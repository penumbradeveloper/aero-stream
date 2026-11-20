// Aero Stream - app do PC (Windows e Linux). Abre a interface única (pasta app/) e libera captura de tela/janela.
// Criado por Ryan Victtor.
const { app, BrowserWindow, ipcMain, session, desktopCapturer, screen, powerMonitor, Menu, clipboard, shell, Tray, nativeImage, safeStorage, globalShortcut } = require('electron');
// (1.0.0) o nome que o sistema mostra (nas notificações, por exemplo) é só "Aero"; a pasta de dados continua a mesma de sempre
try { const ud = app.getPath('userData'), sd = app.getPath('sessionData'); app.setName('Aero'); app.setPath('userData', ud); app.setPath('sessionData', sd); } catch (e) { /* fica o nome antigo */ }
// Atualização automática (atualizador.js): se uma versão mais nova (assinada) já foi baixada, ela assume daqui e este arquivo para.
const atualizador = require('./atualizador').criarAtualizador({ app, log: (...a) => { try { console.log('[aero]', ...a); } catch (e) { /* ok */ } } });
// (1.0.2) rodando da pasta do código (npm start, sem instalar): roda sempre o código da pasta, nunca uma atualização baixada
if (app.isPackaged && atualizador.delegar()) return; // eslint-disable-line no-useless-return
const path = require('path');
const os = require('os');
const fs = require('fs');
const { criarDiscord } = require('./discord');
const { criarAudio } = require('./audio');
const { criarEntrada } = require('./entrada');
const vaapi = require('./vaapi');
const { criarVce3 } = require('./vce3');
const { criarKms } = require('./captura/kms');
const { criarCapturaWindows } = require('./captura/windows');
const perfis = require('./perfis');

// Cópia escondida do app só para testar uma combinação de opções da placa de vídeo (veja perfis.js e sonda.js)
// aberto pelo atalho do sistema (sem terminal), escrever no console pode dar "EPIPE": isso nunca derruba o app
if (!process.__aeroSemEpipe) { process.__aeroSemEpipe = true; for (const s of [process.stdout, process.stderr]) { try { s.on('error', () => {}); } catch (e) { /* ok */ } } }
const argSonda = process.argv.find((a) => String(a).startsWith('--aero-sonda='));
if (argSonda) { require('./sonda').rodar(app, BrowserWindow, session, argSonda.slice('--aero-sonda='.length)); return; } // eslint-disable-line no-useless-return

// Só uma cópia do app por vez (a segunda apenas traz a primeira para a frente)
const temTrava = app.requestSingleInstanceLock();
if (!temTrava) app.quit();

// ---------- configuração do app do PC (modo da placa de vídeo) ----------
const arquivoCfg = path.join(app.getPath('userData'), 'aero-desktop.json');
const lerCfg = () => { try { return JSON.parse(fs.readFileSync(arquivoCfg, 'utf8')); } catch (e) { return {}; } };
const gravarCfg = (c) => { try { fs.mkdirSync(path.dirname(arquivoCfg), { recursive: true }); fs.writeFileSync(arquivoCfg, JSON.stringify(c)); } catch (e) { console.error('cfg', e); } };

// ---------- sentinela: "o computador travou durante uma transmissão pela placa?" ----------
// Enquanto a placa codifica uma transmissão o app deixa um bilhete no disco e apaga ao parar/sair. Se ele ainda estiver lá na abertura
// seguinte, o computador travou no meio. 1ª vez: só avisa (pode ter sido outra coisa). 2ª vez seguida: passa para o modo de compatibilidade
// e avisa, para não entrar num ciclo de travamentos. A pessoa volta para o modo da placa com um clique em Configurações > Placa de vídeo.
const arquivoSent = path.join(app.getPath('userData'), 'aero-sentinela.json');
const lerSent = () => { try { return JSON.parse(fs.readFileSync(arquivoSent, 'utf8')); } catch (e) { return null; } };
const gravarSent = (s) => { try { if (s) { fs.mkdirSync(path.dirname(arquivoSent), { recursive: true }); fs.writeFileSync(arquivoSent, JSON.stringify({ ...s, t: Date.now() })); } else fs.rmSync(arquivoSent, { force: true }); } catch (e) { /* ok */ } };
if (temTrava) {
  const c = lerCfg();
  if (c.gpuModo === 'vaapi') c.gpuModo = 'auto'; // modo das versões antigas: o Automático agora já usa a placa (do jeito seguro)
  delete c.nativo;
  const antes = lerSent();
  if (antes && antes.transmitindo) {
    c.travamentos = (c.travamentos || 0) + 1;
    if (c.travamentos >= 2 && (c.gpuModo || 'auto') === 'auto' && process.platform === 'linux') {
      c.gpuModo = 'software'; c.travamentos = 0; c.gpuDesceuT = Date.now();
      c.avisoGpu = 'O computador travou durante a transmissão pela placa de vídeo duas vezes seguidas. Por segurança passei para o modo de compatibilidade. Para voltar à placa: Configurações > Placa de vídeo > Automático. Se travar, atualize o kernel e o linux-firmware (sudo pacman -Syu) e me mande o relatório de diagnóstico.';
    } else c.avisoGpu = 'A última transmissão terminou de forma inesperada (o app ou o computador pode ter travado). Se a tela congelar de novo, atualize o sistema (sudo pacman -Syu: kernel, mesa e linux-firmware) e me mande o relatório de diagnóstico.';
  }
  gravarCfg(c); gravarSent(null);
}
// (0.7.9) até a 0.7.8, fechar o terminal, sair da sessão ou desligar o PC matava o processo da GPU junto com o app e isso contava como "driver
// falhou": bastavam dois fechamentos para o app cair no processador sem nada de errado com a placa. Quem desceu assim volta ao automático (uma vez)
{ const c = lerCfg();
  if (c.gpuFalhaT && !c.gpuRevisto && !c.gpuManual && (c.gpuModo === 'software' || c.gpuModo === 'semgpu')) {
    console.log('[aero] placa de vídeo: voltando ao automático (estava em "' + c.gpuModo + '" por falhas que podem ter sido só o app fechando)');
    c.gpuModo = 'auto'; c.gpuFalhas = 0; c.gpuRevisto = true; delete c.gpuDesceuT; delete c.gpuSubiu; delete c.gpuFixo; delete c.avisoGpu; gravarCfg(c);
  } }
const cfg = lerCfg();
// (0.7.6) o modo mais seguro escolhido SOZINHO (depois de falhas do driver) não fica para sempre: passadas 2 h sem falha, na próxima abertura
// o app tenta um degrau acima (sem GPU -> sem aceleração de vídeo -> automático). Num PC fraco o "sem GPU nenhuma" desenha e decodifica tudo
// no processador: a tela de quem assiste ficava em câmera lenta. Se falhar de novo, a escada desce outra vez; depois de 2 tentativas que
// falharam, fica no modo seguro. O modo que a PESSOA escolheu fica (o "sem GPU" das versões antigas, sem registro, tenta o automático uma vez)
{ const SUBIR = { semgpu: 'software', software: 'auto' };
  const pode = !cfg.gpuManual && !cfg.gpuFixo && SUBIR[cfg.gpuModo];
  const alvo = !pode ? null : cfg.gpuDesceuT ? (Date.now() - cfg.gpuDesceuT > 7200000 ? SUBIR[cfg.gpuModo] : null) : cfg.gpuModo === 'semgpu' ? 'auto' : null;
  if (alvo) {
    console.log('[aero] placa de vídeo: tentando de novo "' + alvo + '" (estava em "' + cfg.gpuModo + '")');
    cfg.gpuModo = alvo; cfg.gpuDesceuT = Date.now(); cfg.gpuFalhas = 0; cfg.gpuSubiu = (cfg.gpuSubiu || 0) + 1; gravarCfg(cfg);
  } }
// auto = placa de vídeo codifica (padrão) | forcar = idem, ignorando a lista de bloqueio | software = sem aceleração de vídeo | semgpu = sem GPU nenhuma
const MODOS_GPU = ['auto', 'forcar', 'software', 'semgpu'];
const modoGpu = MODOS_GPU.includes(cfg.gpuModo) ? cfg.gpuModo : 'auto';
const linux = process.platform === 'linux';
const placaCodifica = modoGpu === 'auto' || modoGpu === 'forcar';

// ---------- flags do Chromium (decididas ANTES de abrir) ----------
const ligar = ['WebRTCPipeWireCapturer']; // captura de tela no Linux/Wayland (PipeWire, como o Sunshine e o OBS)
// Windows: captura pelo Windows.Graphics.Capture (a API moderna, a mesma do OBS/Xbox Game Bar), melhor com jogos DirectX e a 60 fps do que a
// captura antiga (DXGI) que o Chromium usa por padrão. A codificação pela placa (Media Foundation: NVENC na NVIDIA, AMF na AMD, Quick Sync na
// Intel) já vem ligada no Chromium ("MediaFoundationVideoEncodeAccelerator"); a interface só precisa escolher o H.264 (gpu.js).
// (0.6.6) só no Windows 11: no Windows 10 o Windows.Graphics.Capture desenha uma BORDA AMARELA em volta do que é capturado (o Windows 10
// não deixa tirar) e lá ele entrega os quadros de forma irregular (a tela de quem assiste "travadinha"). No Windows 10 a tela vai pela
// duplicação da área de trabalho (DXGI, sem borda e no ritmo da tela) e a janela pela captura recortada da tela, também sem borda.
const win10 = process.platform === 'win32' && (parseInt(String(require('os').release()).split('.')[2], 10) || 0) < 20348;
// (0.8.4) a TELA INTEIRA vai sempre pela duplicação da área de trabalho (DXGI), também no Windows 11: pelo Windows.Graphics.Capture, um jogo
// em tela cheia passa por fora do compositor do Windows e a imagem de quem assiste ficava parada no último quadro até o jogo ser minimizado.
// A duplicação recebe os quadros do jogo em tela cheia. A captura de UMA JANELA continua pelo Windows.Graphics.Capture no Windows 11
if (process.platform === 'win32') ligar.push('MediaFoundationVideoEncodeAccelerator');
// (1.0.2) eco: a voz dos outros toca pelo Web Audio, que o cancelamento de eco antigo não enxergava (ele só "ouvia" o som que saía pelo
// WebRTC). Com o cancelamento do app inteiro, tudo o que o Aero toca vira referência; e com os modos do getUserMedia o microfone pode
// pedir echoCancellation: 'all' (também tira o som do sistema que sai na caixa: jogo, vídeo). Só mexe no microfone, nunca na captura de áudio
ligar.push('ChromeWideEchoCancellation', 'GetUserMediaEchoCancellationModes');
const desligar = [
  ...(process.platform === 'win32' ? ['AllowWgcScreenCapturer'] : []),
  ...(win10 ? ['AllowWgcWindowCapturer'] : []),
  'WebRtcScreenshareSwEncoding',   // não forçar codificação por processador na captura de tela
  'WebRtcHideLocalIpsWithMdns',    // manda o IP real da rede local (sem isso o PC não resolve os nomes ".local" do Safari)
  // (0.8.3) a música do perfil (o player do YouTube) não aparece no controle de mídia do sistema (Windows e Linux/MPRIS) com o clipe
  'HardwareMediaKeyHandling', 'MediaSessionService',
  // (0.8.4) o Chromium põe os processos dele em "modo de eficiência" (EcoQoS) no Windows 11 quando a janela está atrás de outra (o jogo em tela
  // cheia): a captura, a codificação e a rede rodavam devagar e a tela de quem assiste vinha em rajadas, com o ms subindo
  ...(process.platform === 'win32' ? ['UseEcoQoSForBackgroundProcess'] : []),
];
app.commandLine.appendSwitch('disable-renderer-backgrounding');        // transmissão a 100% mesmo minimizada ou atrás do jogo
app.commandLine.appendSwitch('disable-background-timer-throttling');
// Cookies cifrados (fuse enableCookieEncryption). No Windows a chave fica no DPAPI; no Linux usa a chave interna para nunca abrir
// a janela do chaveiro do sistema (KWallet/GNOME) pedindo senha. O cofre do token continua só no Windows, como antes.
if (process.platform === 'linux') app.commandLine.appendSwitch('password-store', 'basic');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
// "ignorar a lista de bloqueio" é para o driver Mesa da AMD no Linux; no Windows ele fazia placas NVIDIA desenharem errado ("tela derretendo")
if (modoGpu === 'forcar' || (modoGpu === 'auto' && linux)) app.commandLine.appendSwitch('ignore-gpu-blocklist');
// NVIDIA (lembrado da última vez que o app abriu): o vídeo dos amigos é decodificado pelo processador. O decodificador da NVIDIA no Chromium
// borra a imagem quando chega um pacote atrasado ("derretendo"); o do processador se recupera na hora.
if (cfg.gpuNvidia) app.commandLine.appendSwitch('disable-webrtc-hw-decoding');
if (modoGpu === 'forcar') app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
// LINUX (0.5): a placa CODIFICA pelo VA-API, mas NÃO decodifica.
// O que travava o driver nas versões 0.4.0/0.4.1 era a parte de DECODIFICAÇÃO por hardware (com "cópia zero" no GL) somada a um teste que,
// ao abrir, codificava e decodificava vídeo na mesma hora. Os relatos de travamento de AMD no Linux (anel "vcn" travado, tela congelada)
// são de decodificação/pós-processamento, e é por isso que o Sunshine e o OBS só usam o bloco de codificação. Então aqui:
//   - liga só o CODIFICADOR VA-API (H.264 pela placa; "VaapiIgnoreDriverChecks" é o que deixa o Chromium aceitar o driver Mesa da AMD);
//   - desliga TODA decodificação por hardware (o app nunca decodifica vídeo pela placa; o processador decodifica o vídeo dos amigos, que é leve);
//   - sem teste de codificação ao abrir (a placa só trabalha quando você transmite).
// 0.5.2: a combinação exata vem do PERFIL que o próprio app testou neste computador (perfis.js); sem teste ainda, o "padrao".
const perfilPlaca = linux && placaCodifica ? perfis.montar(cfg.perfilPlaca || 'padrao') : null;
if (perfilPlaca) {
  ligar.push(...perfilPlaca.ligar); desligar.push(...perfilPlaca.desligar);
  for (const [k, v] of perfilPlaca.chaves) if (k !== 'ignore-gpu-blocklist') app.commandLine.appendSwitch(k, v);
}
if (modoGpu === 'software' || modoGpu === 'semgpu') { app.commandLine.appendSwitch('disable-accelerated-video-encode'); app.commandLine.appendSwitch('disable-accelerated-video-decode'); }
if (modoGpu === 'semgpu') app.commandLine.appendSwitch('disable-gpu');
// (0.6.0) WebRTC: o fps da transmissão não cai quando a cena se mexe. Em cena com muito movimento (jogo despausado) o codificador da placa
// passa da taxa-alvo, e o WebRTC descartava quadros para compensar ("frame dropper" e a janela de congestionamento com "DropFrame"): a tela
// de quem assiste caía de fps sempre que o jogo se mexia e voltava quando pausava. Agora a taxa é ajustada pelo controle de banda (a
// resolução cai antes do fps, pelo estabilizador do app) e o ajustador de taxa compensa o exagero do codificador da placa.
app.commandLine.appendSwitch('force-fieldtrials', 'WebRTC-FrameDropper/Disabled/WebRTC-CongestionWindow/QueueSize:350,MinBitrate:30000,DropFrame:false/WebRTC-VideoRateControl/bitrate_adjuster:true,adjuster_use_headroom:true/');
app.commandLine.appendSwitch('enable-features', ligar.join(','));
app.commandLine.appendSwitch('disable-features', desligar.join(','));
// AppImage não consegue configurar o sandbox do sistema; o app só abre conteúdo próprio (nada da internet aberta)
// AppImage: o "chrome-sandbox" não consegue ser setuid dentro do AppImage, mas o Chromium usa o sandbox por "user namespaces" quando o
// sistema deixa (CachyOS, Arch, Fedora...). Só quando o sistema bloqueia (Ubuntu 24+ com AppArmor) o app desliga o sandbox, e aí desliga
// também nas janelas: "--no-sandbox" com janela "sandbox: true" deixava a página sem conseguir memória compartilhada (/dev/shm) e ela
// caía logo ao abrir (janela azul vazia).
const semSandbox = require('./sandbox').precisaSemSandbox();
// (0.7.9) o console do desenvolvedor só abre no app rodando do código: é nele que golpes do tipo "cole isto aqui" roubam a conta
// (0.8.2) no app instalado o console não abre de jeito nenhum (a variável AERO_DEVTOOLS também abria e qualquer um podia usar)
const devTools = !app.isPackaged;
// (0.8.2) app instalado aberto com opções de depuração (porta de depuração remota, inspetor do Node, flags do V8): fecha na hora.
// Ninguém precisa disso para usar o app; é só o caminho para mexer nele por fora.
if (app.isPackaged) {
  const DEPURAR = ['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'remote-allow-origins', 'inspect', 'inspect-brk', 'inspect-port', 'debug', 'js-flags', 'auto-open-devtools-for-tabs'];
  if (DEPURAR.some((s) => app.commandLine.hasSwitch(s)) || process.argv.some((a) => /^--(inspect|debug|remote-debugging|js-flags)/i.test(String(a)))) { app.exit(0); return; } // eslint-disable-line no-useless-return
  app.on('web-contents-created', (_e, wc) => {
    wc.on('devtools-opened', () => { try { wc.closeDevTools(); } catch (e) { /* ok */ } });
    wc.on('will-attach-webview', (ev) => ev.preventDefault()); // nenhuma página consegue enfiar um <webview> com permissões próprias
  });
}
// (0.8.7) depois da checagem acima: o V8 jogava fora o código das funções que ficavam um tempo sem uso, e ao voltar para o app depois de um
// tempo parado a primeira troca de aba recompilava tudo (o "lag depois de ficar inativo"). Assim ele guarda o que já compilou.
app.commandLine.appendSwitch('js-flags', '--no-flush-bytecode');
if (semSandbox) app.commandLine.appendSwitch('no-sandbox');

// No Wayland (KDE Plasma, GNOME...) quem escolhe a tela é o portal do sistema (XDG Desktop Portal): o Chromium só consegue capturar depois
// que a pessoa escolhe lá. Então o app NÃO mostra um seletor próprio: o seletor do sistema é o único.
const usaPortal = process.platform === 'linux' && (String(process.env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland' || (!!process.env.WAYLAND_DISPLAY && !process.env.DISPLAY));
// Identifica o conjunto de flags: quando muda, o resultado guardado do teste da placa deixa de valer
const idFlags = require('crypto').createHash('sha1').update(JSON.stringify([process.platform, modoGpu, ligar, desligar, perfilPlaca && perfilPlaca.id])).digest('hex').slice(0, 10);

// Se o processo de GPU do Chromium cair 2 vezes, o app passa para um modo mais seguro e reinicia sozinho
const ESCADA = { auto: 'software', forcar: 'software', software: 'semgpu' };
let saindo = false;
// (0.6.9) antes de reiniciar (atualização, troca do modo da placa), o app avisa a interface para sair da sala e da chamada direito: sem isso a
// tela de quem estava compartilhando continuava aparecendo para os outros (a sala guarda o lugar por 30 s achando que a internet caiu)
const reiniciarLimpo = () => {
  saindo = true; gravarSent(null);
  try { if (janela && !janela.isDestroyed()) janela.webContents.send('app-saindo'); } catch (e) { /* ok */ }
  setTimeout(() => {
    const r = require('./sandbox').relancarAppImage();
    let foi = false;
    if (r) try { require('child_process').spawn(r.cmd, r.args, r.opcoes).unref(); foi = true; } catch (e) { /* cai no relaunch */ }
    if (!foi) app.relaunch();
    app.exit(0);
  }, 700);
};
// (0.7.9) 'killed' é o sistema encerrando o processo (terminal fechado, logout, desligar), não o driver falhando. E a contagem só vale depois de
// um tempo com o app ainda de pé: quando o app inteiro está caindo, a GPU some primeiro e nada disso é culpa da placa.
app.on('child-process-gone', (_e, d) => {
  if (d.type !== 'GPU' || d.reason === 'clean-exit' || d.reason === 'killed' || saindo || !ESCADA[modoGpu]) return;
  console.log('[aero] processo da GPU caiu:', d.reason, d.exitCode);
  setTimeout(() => {
    if (saindo) return;
    const c = lerCfg();
    if (Date.now() - (c.gpuFalhaT || 0) > 600000) c.gpuFalhas = 0; // (0.7.6) só conta falhas seguidas (2 em 10 min): antes 2 falhas em semanas diferentes já desciam o modo
    c.gpuFalhas = (c.gpuFalhas || 0) + 1; c.gpuFalhaT = Date.now();
    if (c.gpuFalhas >= 2) {
      c.gpuModo = ESCADA[modoGpu]; c.gpuFalhas = 0; c.gpuDesceuT = Date.now(); c.gpuRevisto = true; if ((c.gpuSubiu || 0) >= 2) c.gpuFixo = true;
      c.avisoGpu = `O driver de vídeo falhou. Mudei para o modo "${c.gpuModo}" automaticamente.`;
      gravarCfg(c); reiniciarLimpo();
    } else gravarCfg(c);
  }, 2500);
});

// ---------- convites: links aerostream://sala/ABC234 (o site pergunta "abrir no aplicativo?") ----------
const salaDoLink = (args) => { for (const a of args || []) { const m = /^aerostream:\/\/(?:sala\/)?([A-Za-z0-9]{4,12})\b/i.exec(String(a)); if (m) return m[1].toUpperCase(); } return null; };
let conviteInicial = salaDoLink(process.argv);
try {
  if (typeof app.setAsDefaultProtocolClient === 'function') {
    if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient('aerostream', process.execPath, [path.resolve(process.argv[1])]); // rodando com "npm start"
    else app.setAsDefaultProtocolClient('aerostream');
  }
} catch (e) { /* sem registro: o convite ainda funciona pelo navegador */ }
app.on('open-url', (e, url) => { e.preventDefault(); const s = salaDoLink([url]); if (!s) return; if (janela && !janela.isDestroyed()) janela.webContents.send('convite', s); else conviteInicial = s; });

// ---------- a interface (pasta app/) ----------
const pastaApp = [path.join(__dirname, 'app'), path.join(__dirname, '..', 'app')].find((p) => fs.existsSync(path.join(p, 'index.html')));
let janela = null, fonteEscolhida = null, displayEscolhido = null, ultimaCaptura = null, fonteUsada = null, reusarFonte = 0;
const log = (...a) => { try { console.log('[aero]', ...a); } catch (e) { /* ok */ } };
if (process.platform === 'win32') app.setAppUserModelId('com.ryanvicttor.aerostream');

// Só a nossa própria interface pode falar com o processo principal
// (0.8.7) mais uma camada: além da janela certa, o pedido tem que vir do quadro PRINCIPAL dela (nunca de um iframe, como o do YouTube)
// e de uma página local do próprio app (file://), nunca de um endereço de fora que tenha conseguido abrir ali
const quadroOk = (e) => { try { const f = e.senderFrame; if (!f) return true; if (f !== janela.webContents.mainFrame) return false; return /^file:\/\//i.test(f.url || ''); } catch (_) { return false; } };
const confiavel = (e) => !!janela && !janela.isDestroyed() && e.sender === janela.webContents && quadroOk(e);
const handle = (canal, fn) => ipcMain.handle(canal, (e, ...a) => { if (!confiavel(e)) throw new Error('não permitido'); return fn(...a); });
// o token e o código de acesso ficam cifrados pelo próprio Windows (DPAPI, preso a este usuário do PC); outro programa ou quem copiar a pasta não lê.
// Só no Windows: no Linux/Mac o chaveiro do sistema pode abrir uma janela pedindo permissão. '' = guarda como antes.
ipcMain.on('cofre-local', (e, op, v) => {
  e.returnValue = '';
  if (!confiavel(e) || process.platform !== 'win32' || typeof v !== 'string' || v.length > 65536) return;
  try {
    if (!safeStorage.isEncryptionAvailable()) return;
    e.returnValue = op === 'f' ? safeStorage.encryptString(v).toString('base64') : op === 'a' ? safeStorage.decryptString(Buffer.from(v, 'base64')) : '';
  } catch (err) { e.returnValue = ''; }
});

const nomeSO = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[process.platform] || process.platform;
handle('info', () => ({ maquina: os.hostname(), so: nomeSO, versao: atualizador.versaoRodando(), portal: usaPortal, flagsId: idFlags, gpuModo: modoGpu, electron: process.versions.electron }));
handle('ocioso', () => powerMonitor.getSystemIdleTime());
handle('convite-inicial', () => { const s = conviteInicial; conviteInicial = null; return s; });
// (1.0.0) skins: um arquivo .aer aberto pelo sistema (duplo clique, "Abrir com"). Só o caminho de um .aer de verdade, até 30 MB; quem confere
// o conteúdo é a interface (aer.js), com as mesmas travas de sempre
const aerDoArgv = (args) => { for (const a of args || []) { const c = String(a || ''); if (/\.aer$/i.test(c) && !/^-/.test(c)) return c; } return null; };
const lerAer = (c) => { try { const st = fs.statSync(c); if (!st.isFile() || st.size > 30 * 1024 * 1024 || st.size < 22) return null; return { nome: path.basename(c).slice(0, 80), bytes: new Uint8Array(fs.readFileSync(c)) }; } catch (e) { return null; } };
let aerInicial = aerDoArgv(process.argv.slice(1));
const mandarAer = (c) => { const d = lerAer(c); if (!d) return; if (janela && !janela.isDestroyed()) janela.webContents.send('abrir-aer', d); else aerInicial = c; };
handle('aer-inicial', () => { const c = aerInicial; aerInicial = null; return c ? lerAer(c) : null; });
app.on('open-file', (e, c) => { if (!/\.aer$/i.test(String(c))) return; e.preventDefault(); mandarAer(c); });
handle('copiar', (t) => { clipboard.writeText(String(t || '').slice(0, 2000000)); return true; });
handle('mostrar', () => { mostrarJanela(); return true; });
let teclasDoJogo = false;
ipcMain.on('teclas-do-jogo', (e, on) => { if (confiavel(e)) { teclasDoJogo = !!on; escDoJogo(); } });
// (0.8.5) com o mouse preso no jogo do amigo, o Chromium pega o Esc ANTES da página (e do before-input-event) e solta o mouse: o controle
// parecia pausado. Enquanto o jogo é dono do teclado e a janela está em foco, o Esc é pego no sistema (Windows e X11) e vai direto
// para o jogo; ao perder o foco ele é devolvido na hora. Onde o sistema não deixa (Wayland), a página recupera o mouse sozinha.
let escPreso = false;
function escDoJogo() {
  const quer = teclasDoJogo && !!janela && !janela.isDestroyed() && janela.isFocused();
  if (quer === escPreso) return;
  if (!quer) { try { globalShortcut.unregister('Escape'); } catch (e) { /* ok */ } escPreso = false; return; }
  try {
    escPreso = globalShortcut.register('Escape', () => {
      if (!janela || janela.isDestroyed() || !teclasDoJogo) return;
      janela.webContents.send('esc-do-jogo', true);
      setTimeout(() => { if (janela && !janela.isDestroyed()) janela.webContents.send('esc-do-jogo', false); }, 45);
    });
  } catch (e) { escPreso = false; }
}
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch (e) { /* ok */ } });
// (0.8.5) a página pede um "toque" (tecla F24 sintética) para poder prender o mouse de novo sem esperar um clique depois de um Esc que escapou
ipcMain.on('toque-trava', (e) => { if (!confiavel(e) || !teclasDoJogo || !janela || janela.isDestroyed() || !janela.isFocused()) return; try { janela.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F24' }); janela.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F24' }); } catch (x) { /* ok */ } });
handle('tela-cheia', (on) => { if (janela && !janela.isDestroyed()) { cheiaDaChamada = !!on; janela.setFullScreen(!!on); } return true; }); // (0.6.0) tela cheia da chamada pelo app (a do navegador falhava no Windows) // (0.6.0) clicou na notificação do sistema: a janela volta para a frente
// ---------- (1.0.2) Celular como microfone (desktop/celmic.js): servidor só na rede local, ligado enquanto a interface pedir ----------
const celMic = require('./celmic').criarCelMic({ log, avisar: (ev) => { if (janela && !janela.isDestroyed()) janela.webContents.send('celmic-evento', ev); } });
handle('celmic-ligar', async () => { try { return await celMic.ligar(); } catch (e) { return { ligado: false, erro: (e && e.codigo) || 'falhou' }; } });
handle('celmic-info', () => celMic.info());
handle('celmic-codigo', () => celMic.novoCodigo());
handle('celmic-decidir', (id, sim) => celMic.decidir(String(id || ''), !!sim));
handle('celmic-responder', (id, sdp) => celMic.responder(String(id || ''), typeof sdp === 'string' ? sdp : null));
handle('celmic-encerrar', () => celMic.encerrar());
handle('celmic-desligar', () => celMic.desligar());
app.on('will-quit', () => { try { celMic.desligar(); } catch (e) { /* ok */ } });
// (0.6.9) a imagem de outro site (GIF do Klipy, anexo do Discord) que a página não pode ler (CORS): o app baixa e devolve os bytes. Só https,
// só imagem e no máximo 25 MB
handle('baixar-imagem', async (url) => {
  try {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url) || url.length > 2000) return null;
    const { net } = require('electron');
    const r = await net.fetch(url); if (!r.ok || !/^image\//i.test(r.headers.get('content-type') || '')) return null;
    const b = new Uint8Array(await r.arrayBuffer()); return b.length <= 25 * 1024 * 1024 ? b : null;
  } catch (e) { return null; }
});
// (1.0.0) Música junto: quando o servidor não acha a música no YouTube (dos servidores da Cloudflare o YouTube às vezes bloqueia a busca por
// um tempo), o app procura daqui, com a internet de quem pôs a música. Só aceita um nome ou um link de música do Spotify/Deezer e só fala
// com esses sites; devolve o código do vídeo que pode tocar fora do YouTube
handle('musica-achar', async (o) => {
  try {
    const { net } = require('electron');
    const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.8', Cookie: 'CONSENT=YES+cb; SOCS=CAI' };
    const buscar = async (u, ms = 8000) => { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms); try { return await net.fetch(u, { headers: UA, signal: ctl.signal, redirect: 'error' }); } finally { clearTimeout(t); } };
    let q = o && typeof o.q === 'string' ? o.q.replace(/\s+/g, ' ').trim().slice(0, 140) : '';
    const url = o && typeof o.url === 'string' ? o.url.trim().slice(0, 300) : '';
    let m;
    if (url && (m = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/.exec(url))) {
      const t = await (await buscar('https://open.spotify.com/embed/track/' + m[1])).text();
      const tit = (/"title":"([^"]{1,140})"/.exec(t) || [])[1] || '', art = /"artists":\[(.*?)\]/.exec(t);
      const nomes = art ? [...art[1].matchAll(/"name":"([^"]{1,80})"/g)].map((x) => x[1]).slice(0, 2).join(' ') : '';
      const js = (x) => { try { return JSON.parse('"' + x + '"'); } catch (_) { return x; } };
      q = (js(nomes) + ' ' + js(tit)).trim();
    } else if (url && (m = /^https:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?track\/(\d{1,15})/.exec(url))) {
      const d = await (await buscar('https://api.deezer.com/track/' + m[1])).json();
      q = ((d && d.artist && d.artist.name) || '') + ' ' + ((d && d.title) || '');
      q = q.trim();
    }
    if (q.length < 2) return null;
    for (const termo of [q + ' audio', q]) {
      const t = await (await buscar('https://www.youtube.com/results?hl=en&gl=US&sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(termo))).text();
      const ids = [...new Set([...t.matchAll(/"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/g)].map((x) => x[1]))].slice(0, 4);
      for (const v of ids) {
        const r = await buscar('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v), 4000);
        if (r.status === 401 || r.status === 403 || r.status === 404) continue; // esse não deixa tocar fora do YouTube
        return { v };
      }
    }
    return null;
  } catch (e) { log('musica: busca pelo app falhou', e && e.message); return null; }
});
// (0.7.0) notificação do sistema pelo app (e não pela página): no Linux dá para marcar como "urgente", que passa pelo "não perturbe" que o KDE
// liga sozinho enquanto a tela é compartilhada (sem isso nenhuma mensagem aparecia enquanto você transmitia). Clicar abre a conversa
// (0.8.6) a notificação mostra a foto e o nome de quem mandou (como no Discord), some sozinha depois de alguns segundos e cada mensagem é
// uma notificação nova. As notificações ficam guardadas aqui enquanto aparecem: sem isso o sistema podia descartar as seguintes
const notifVivas = new Set(), fotosNotif = new Map();
async function fotoNotif(url) {
  // (1.0.0) a página já manda a foto pronta em PNG (o sistema não abre WebP/GIF)
  if (typeof url === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url) && url.length < 400000) { try { const img = nativeImage.createFromDataURL(url); return img.isEmpty() ? null : img; } catch (e) { return null; } }
  if (typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url)) return null;
  if (fotosNotif.has(url)) return fotosNotif.get(url);
  let img = null;
  try {
    const { net, nativeImage } = require('electron');
    const r = await Promise.race([net.fetch(url), new Promise((_, n) => setTimeout(() => n(new Error('tempo')), 3500))]);
    if (r.ok && /^image\//i.test(r.headers.get('content-type') || '')) {
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length <= 8 * 1024 * 1024) { img = nativeImage.createFromBuffer(b); if (img.isEmpty()) img = null; else img = img.resize({ width: 128, height: 128, quality: 'best' }); }
    }
  } catch (e) { img = null; }
  if (fotosNotif.size > 60) fotosNotif.clear();
  fotosNotif.set(url, img);
  return img;
}
handle('notificar', async (o) => {
  try {
    const { Notification } = require('electron');
    if (!Notification.isSupported() || !o) return false;
    const icone = (await fotoNotif(o.icone)) || path.join(__dirname, 'build', 'icon.png');
    const n = new Notification({ title: String(o.titulo || 'Aero').slice(0, 80), body: String(o.texto || '').slice(0, 200), silent: true, icon: icone, urgency: o.urgente && process.platform === 'linux' ? 'critical' : 'normal', timeoutType: 'default' });
    notifVivas.add(n); const solta = () => notifVivas.delete(n); setTimeout(solta, 60000);
    n.on('close', solta);
    n.on('click', () => { solta(); mostrarJanela(); try { if (janela && !janela.isDestroyed()) janela.webContents.send('notificacao-clique', String(o.cid || '')); } catch (e) { /* ok */ } });
    n.show(); return true;
  } catch (e) { return false; }
});
// (0.7.0) abrir junto com o computador. Windows: o próprio sistema (entrada de inicialização); Linux: o atalho em ~/.config/autostart
// (que é o padrão do KDE, GNOME e companhia), apontando para o AppImage quando o app roda por ele
const atalhoLinux = () => path.join(require('os').homedir(), '.config', 'autostart', 'aero-stream.desktop');
const exeDoApp = () => process.env.APPIMAGE || process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
handle('inicio-sistema', (ligar) => {
  try {
    if (process.platform === 'win32') {
      if (typeof ligar === 'boolean') app.setLoginItemSettings({ openAtLogin: ligar, path: exeDoApp(), args: ['--bandeja'] });
      return app.getLoginItemSettings({ path: exeDoApp(), args: ['--bandeja'] }).openAtLogin;
    }
    if (process.platform === 'linux') {
      const arq = atalhoLinux();
      if (ligar === true) { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, `[Desktop Entry]\nType=Application\nName=Aero\nExec="${exeDoApp().replace(/"/g, '')}" --bandeja\nIcon=aero-stream\nX-GNOME-Autostart-enabled=true\nTerminal=false\n`); }
      else if (ligar === false) { try { fs.rmSync(arq, { force: true }); } catch (e) { /* ok */ } }
      return fs.existsSync(atalhoLinux());
    }
    return null;
  } catch (e) { return null; }
});
// (0.7.2) abrindo junto com o sistema: só na bandeja (padrão) ou já com a janela em tela inteira
handle('inicio-modo', (v) => { const c = lerCfg(); if (v === 'bandeja' || v === 'janela') { c.inicioModo = v; gravarCfg(c); } return c.inicioModo === 'janela' ? 'janela' : 'bandeja'; });
// (0.7.1) confere se a imagem ficou mesmo na área de transferência (no Linux ela podia falhar calada); se não, a página tenta pelo navegador
handle('copiar-imagem', (bytes) => { try { const img = nativeImage.createFromBuffer(Buffer.from(bytes)); if (img.isEmpty()) return false; clipboard.writeImage(img); return !clipboard.readImage().isEmpty(); } catch (e) { return false; } });
// (0.8.3) copiar um GIF (ou outra imagem animada) como ARQUIVO: assim, colando, vai o GIF animado (como imagem iria só o 1º quadro).
// Fica num arquivo temporário do app (os antigos saem) e entra na área de transferência como arquivo copiado. Sem jeito, a página copia como imagem.
handle('copiar-arquivo', async (bytes, ext) => {
  try {
    const e = ['gif', 'webp', 'png', 'mp4'].includes(ext) ? ext : 'gif';
    const dir = path.join(app.getPath('temp'), 'aero-copiados'); fs.mkdirSync(dir, { recursive: true });
    for (const n of fs.readdirSync(dir)) { try { const f0 = path.join(dir, n); if (Date.now() - fs.statSync(f0).mtimeMs > 86400000) fs.unlinkSync(f0); } catch (_) { /* ok */ } }
    const f = path.join(dir, 'aero-' + Date.now().toString(36) + '.' + e);
    fs.writeFileSync(f, Buffer.from(bytes));
    const rodar = (cmd, args, entrada) => new Promise((ok) => {
      try {
        // spawn com a saída ignorada: o wl-copy/xclip ficam rodando em segundo plano servindo a cópia, e esperar a saída deles travaria
        const p = require('child_process').spawn(cmd, args, { windowsHide: true, stdio: [entrada != null ? 'pipe' : 'ignore', 'ignore', 'ignore'] });
        const t = setTimeout(() => { try { p.kill(); } catch (_) { /* ok */ } ok(false); }, 8000);
        p.on('error', () => { clearTimeout(t); ok(false); }); p.on('exit', (c) => { clearTimeout(t); ok(c === 0); });
        if (entrada != null) { p.stdin.on('error', () => {}); p.stdin.end(entrada); }
      } catch (_) { ok(false); }
    });
    const uri = require('url').pathToFileURL(f).href;
    if (process.platform === 'win32') return await rodar('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', "Set-Clipboard -LiteralPath '" + f.replace(/'/g, "''") + "'"]);
    if (process.platform === 'darwin') return await rodar('osascript', ['-e', 'set the clipboard to (POSIX file "' + f.replace(/["\\]/g, '') + '")']);
    // Linux: Wayland (wl-copy) ou X11 (xclip), como o gerenciador de arquivos faz
    if (process.env.WAYLAND_DISPLAY && await rodar('wl-copy', ['--type', 'text/uri-list'], uri + '\r\n')) return true;
    return await rodar('xclip', ['-selection', 'clipboard', '-t', 'text/uri-list'], uri + '\r\n');
  } catch (e) { return false; }
});
// (0.6.0) "Abrir no navegador" de um anexo do chat: ele só existe aberto dentro do app (veio cifrado), então vai para um arquivo temporário
// e abre no programa padrão do sistema. Só tipos de mídia comuns; o nome é limpo (nada de caminho nem extensão executável).
handle('abrir-arquivo', async (a) => {
  try {
    const dados = a && a.dados; if (!dados || dados.length > 60 * 1048576) return false;
    let nome = String((a && a.nome) || 'arquivo').replace(/[^A-Za-z0-9 ._()-]/g, '_').slice(0, 80);
    const ext = (/\.([A-Za-z0-9]{2,5})$/.exec(nome) || [])[1] || '';
    if (!/^(png|jpe?g|gif|webp|bmp|mp4|webm|mov|mkv|mp3|ogg|oga|opus|wav|m4a|aac|pdf|txt)$/i.test(ext)) nome += '.bin';
    const pasta = path.join(app.getPath('temp'), 'aero-stream-abertos'); fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, Date.now() + '-' + nome); fs.writeFileSync(arq, Buffer.from(dados));
    return !(await shell.openPath(arq));
  } catch (e) { return false; }
});
handle('ultima-captura', () => ultimaCaptura); // o que aconteceu no último pedido de captura de tela (para explicar falhas)
handle('reusar-fonte', () => { reusarFonte = Date.now(); return !!fonteUsada; });

// Telas e janelas, com miniatura, para o seletor "o que mostrar"
handle('fontes', async () => {
  if (usaPortal) return []; // o portal do sistema escolhe (chamar getSources aqui abriria o portal uma vez a mais)
  const fontes = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
  const principal = String(screen.getPrimaryDisplay().id), telas = screen.getAllDisplays();
  let n = 0;
  return fontes.filter((f) => f.name && !f.thumbnail.isEmpty()).map((f) => {
    const ehTela = f.id.startsWith('screen');
    let nome = f.name;
    if (ehTela) { n++; const d = telas.find((x) => String(x.id) === f.display_id); nome = `Tela ${n}${d ? ` (${d.size.width}x${d.size.height})` : ''}${f.display_id === principal ? ' *' : ''}`; }
    return { id: f.id, nome, tipo: ehTela ? 'tela' : 'janela', thumb: f.thumbnail.toDataURL(), principal: f.display_id === principal };
  }).sort((a, b) => Number(b.principal) - Number(a.principal) || a.tipo.localeCompare(b.tipo));
});
// Guarda a fonte escolhida e, se for uma tela, qual monitor é (para o mouse "absoluto" cair no lugar certo)
handle('escolher-fonte', async (id) => {
  fonteEscolhida = id ? String(id) : null; displayEscolhido = null;
  if (!usaPortal && fonteEscolhida && fonteEscolhida.startsWith('screen')) {
    try {
      const fontes = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      const f = fontes.find((x) => x.id === fonteEscolhida);
      displayEscolhido = (f && screen.getAllDisplays().find((d) => String(d.id) === f.display_id)) || null;
    } catch (e) { /* usa a tela principal */ }
  }
});

// Tudo que ajuda a entender um problema (vai no "relatório de diagnóstico")
let vaapiCache = null;
const sondarVaapi = () => (vaapiCache && Date.now() - vaapiCache.t < 60000 ? vaapiCache.p : (vaapiCache = { t: Date.now(), p: vaapi.sondar() }).p);
// O que o PRÓPRIO Chromium diz que a placa codifica (lista de perfis do codificador por hardware). Vazia = o Chromium não está usando a placa.
handle('gpu-codifica', async () => {
  try {
    const g = await app.getGPUInfo('complete');
    const perfis = (g && (g.videoEncodeAcceleratorSupportedProfile || g.videoEncodeAcceleratorSupportedProfiles || (g.auxAttributes && g.auxAttributes.videoEncodeAcceleratorSupportedProfile))) || [];
    const lista = (Array.isArray(perfis) ? perfis : [perfis]).map((p) => (typeof p === 'string' ? p : p.profile || JSON.stringify(p)));
    return { ok: true, perfis: lista, h264: lista.some((p) => /h264|avc/i.test(String(p))) };
  } catch (e) { return { ok: false, erro: String(e.message) }; }
});
handle('gpu-vaapi', async () => (process.platform === 'linux' ? { ...vaapi.resumir(await sondarVaapi()), bruto: await sondarVaapi() } : { codigo: 'nao-linux' }));
// Linux: controles que o kernel só reconhece como "aparelho HID" (sem /dev/input/event): nenhum programa enxerga como controle de jogo.
// Ex.: 8BitDo Ultimate 2 em alguns modos. A interface usa isto para explicar o que fazer quando "nenhum controle" aparece.
const FABRICANTES_PAD = { '2DC8': '8BitDo', '045E': 'Xbox', '054C': 'PlayStation', '057E': 'Nintendo', '0F0D': 'Hori', '0E6F': 'PDP', '24C6': 'PowerA', '0079': 'Genérico', '2563': 'Genérico' };
function controlesSemDriver() {
  if (process.platform !== 'linux') return [];
  const out = [];
  let lista = []; try { lista = fs.readdirSync('/sys/class/hidraw'); } catch (e) { return out; }
  for (const h of lista) {
    try {
      const base = path.join('/sys/class/hidraw', h, 'device');
      const ue = fs.readFileSync(path.join(base, 'uevent'), 'utf8');
      const id = /HID_ID=\w+:0000(\w{4}):0000(\w{4})/.exec(ue), nome = (/HID_NAME=(.*)/.exec(ue) || [])[1] || '';
      if (!id || !FABRICANTES_PAD[id[1].toUpperCase()] || /keyboard|mouse|receiver|headset|audio/i.test(nome)) continue;
      if (fs.existsSync(path.join(base, 'input'))) continue; // tem /dev/input: o navegador enxerga
      out.push({ nome: nome || FABRICANTES_PAD[id[1].toUpperCase()], vendor: id[1].toLowerCase(), product: id[2].toLowerCase() });
    } catch (e) { /* ok */ }
  }
  return out;
}
handle('controles-sem-driver', () => controlesSemDriver());
// identificador do computador (para a moderação bloquear um aparelho): o hash do id da máquina, nunca o id em si
let hwCache = null;
handle('hw-id', () => {
  if (hwCache) return hwCache;
  let bruto = '';
  try {
    if (process.platform === 'linux') bruto = fs.readFileSync('/etc/machine-id', 'utf8').trim();
    else if (process.platform === 'win32') bruto = (/MachineGuid\s+REG_SZ\s+(\S+)/.exec(require('child_process').execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { windowsHide: true, timeout: 3000 }).toString()) || [])[1] || '';
  } catch (e) { /* sem id */ }
  if (!bruto) bruto = os.hostname() + '|' + os.cpus().map((c) => c.model).join(',') + '|' + os.totalmem();
  hwCache = require('crypto').createHash('sha256').update('aero-hw:' + bruto).digest('hex').slice(0, 40);
  return hwCache;
});
handle('diagnostico', async () => {
  let gpu = null, recursos = null;
  try { gpu = await app.getGPUInfo('basic'); } catch (e) { gpu = { erro: String(e.message) }; }
  try { recursos = app.getGPUFeatureStatus(); } catch (e) { /* ok */ }
  const aviso = lerCfg().avisoGpu; if (aviso) { const c = lerCfg(); delete c.avisoGpu; gravarCfg(c); }
  const nativo = { audio: await audio.disponivel(), entrada: await entrada.disponivel(), discord: discord.estado() };
  let va = null; if (process.platform === 'linux') { try { va = { ...vaapi.resumir(await sondarVaapi()) }; } catch (e) { va = { codigo: 'erro' }; } }
  let vce = null; if (linux) { try { vce = await vce3.diagnosticar(); delete vce.placas; } catch (e) { vce = { erro: String(e.message) }; } }
  let capturaDireta = null; if (linux || process.platform === 'win32') { try { capturaDireta = await kms.estado(true); } catch (e) { capturaDireta = { erro: String(e.message) }; } }
  return { app: atualizador.versaoRodando(), capturaDireta, appInstalado: app.getVersion(), atualizacao: atualizador.infoAtual(), driverVce3: vce, electron: process.versions.electron, chrome: process.versions.chrome, so: `${os.type()} ${os.release()} ${os.arch()}`, sessao: process.platform === 'linux' ? (process.env.XDG_SESSION_TYPE || '?') : undefined, capturaPortal: usaPortal, gpuModo: modoGpu, flags: { ligar, desligar, id: idFlags }, avisoGpu: aviso || null, recursos, gpu: gpu && (gpu.gpuDevice || gpu), vaapi: va, nativo, placaCodifica: linux ? placaCodifica : undefined, perfilPlaca: perfilPlaca && perfilPlaca.id, sondaPlaca: lerCfg().sonda || null, ultimaCaptura };
});
handle('definir-gpu-modo', (m) => { if (MODOS_GPU.includes(m)) { const c = lerCfg(); c.gpuModo = m; c.gpuFalhas = 0; delete c.gpuSubiu; delete c.gpuFixo; if (m === 'auto') delete c.gpuManual; else c.gpuManual = true; gravarCfg(c); } });
handle('reiniciar', () => reiniciarLimpo());
// (0.6.0) recarregar a página do app (trocar/adicionar conta): o location.reload() da página era barrado pelo bloqueio de navegação
handle('recarregar', () => { if (janela && !janela.isDestroyed()) janela.webContents.reload(); return true; });

// A janela do Aero some da transmissão (sem "espelho": o Aero mostrando a própria transmissão, que é capturada de novo e "derrete").
// Windows/macOS: o Electron esconde a janela da captura. Linux com KDE Plasma 6: o mesmo "Esconder da transmissão" do menu da janela
// (Mais ações), ligado por um script do KWin (propriedade excludeFromCapture), só nas janelas deste processo. Outros ambientes: não dá.
const { execFile } = require('child_process');
function kwinEsconder(on, soTitulo = '') { // soTitulo: só a janela com esse título (a dos cursores); vazio: todas deste processo
  return new Promise((resolve) => {
    if (process.platform !== 'linux' || !/kde/i.test(process.env.XDG_CURRENT_DESKTOP || '')) return resolve(false);
    const arq = path.join(app.getPath('temp'), 'aero-esconder-' + process.pid + '.js'), nome = 'aero-esconder-' + process.pid + (soTitulo ? '-c' : '');
    try { fs.writeFileSync(arq, `for (const w of workspace.windowList()) if (w.pid === ${process.pid}${soTitulo ? ' && w.caption === ' + JSON.stringify(soTitulo) : ''} && 'excludeFromCapture' in w) w.excludeFromCapture = ${on ? 'true' : 'false'};`); } catch (e) { return resolve(false); }
    const dbus = (args, cb) => execFile('gdbus', ['call', '--session', '--dest', 'org.kde.KWin', ...args], { timeout: 4000 }, cb);
    dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.unloadScript', nome], () => {
      dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.loadScript', arq, nome], (e, saida) => {
        const n = !e && (/(\d+)/.exec(String(saida)) || [])[1];
        if (!n) return resolve(false);
        dbus(['--object-path', '/Scripting/Script' + n, '--method', 'org.kde.kwin.Script.run'], (e2) => {
          setTimeout(() => dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.unloadScript', nome], () => {}), 800);
          resolve(!e2);
        });
      });
    });
  });
}
// ---------- o cursor de quem transmite, no KDE (Wayland) ----------
// A captura do KDE nem sempre leva o cursor e nenhum programa comum lê onde ele está no Wayland. Enquanto transmite, um script do KWin
// manda cada movimento para um ajudante pequeno (entrada/cursor_kwin.py, serviço no DBus da sessão) e o app repassa a posição para quem
// assiste, que desenha o cursor por cima do vídeo. No Windows a captura já traz o cursor: nada disso roda.
let cursorProc = null;
const NOME_SCRIPT_CURSOR = 'aero-cursor-' + process.pid;
function kwinScript(nome, codigo) {
  return new Promise((resolve) => {
    const arq = path.join(app.getPath('temp'), nome + '.js');
    try { fs.writeFileSync(arq, codigo); } catch (e) { return resolve(false); }
    const dbus = (args, cb) => execFile('gdbus', ['call', '--session', '--dest', 'org.kde.KWin', ...args], { timeout: 4000 }, cb);
    dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.unloadScript', nome], () => {
      dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.loadScript', arq, nome], (e, saida) => {
        const n = !e && (/(\d+)/.exec(String(saida)) || [])[1];
        if (!n) return resolve(false);
        dbus(['--object-path', '/Scripting/Script' + n, '--method', 'org.kde.kwin.Script.run'], (e2) => resolve(!e2));
      });
    });
  });
}
const kwinDescarregar = (nome) => execFile('gdbus', ['call', '--session', '--dest', 'org.kde.KWin', '--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.unloadScript', nome], { timeout: 4000 }, () => {});
function cursorHost(on) {
  if (!on) { if (cursorProc) { kwinDescarregar(NOME_SCRIPT_CURSOR); try { cursorProc.kill(); } catch (e) { /* ok */ } cursorProc = null; } return; }
  if (cursorProc || process.platform !== 'linux' || !/kde/i.test(process.env.XDG_CURRENT_DESKTOP || '') || !usaPortal) return;
  const nome = 'org.aerostream.Cursor' + process.pid;
  let codigo; try { codigo = fs.readFileSync(path.join(__dirname, 'entrada', 'cursor_kwin.py'), 'utf8'); } catch (e) { return; }
  try { cursorProc = require('child_process').spawn('python3', ['-u', '-c', codigo, nome], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { cursorProc = null; return; }
  const p = cursorProc; let buf = '', ult = 0, pend = null, timer = 0;
  const enviar = () => {
    timer = 0; if (!pend || !janela || janela.isDestroyed()) return;
    const d = displayEscolhido || screen.getPrimaryDisplay(), b = d.bounds;
    const x = (pend.x - b.x) / b.width, y = (pend.y - b.y) / b.height; pend = null; ult = Date.now();
    janela.webContents.send('cursor-host', { x, y, dentro: x >= 0 && x <= 1 && y >= 0 && y <= 1 });
  };
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (l === 'OK') kwinScript(NOME_SCRIPT_CURSOR, `let ult = 0; function enviar() { const t = Date.now(); if (t - ult < 16) return; ult = t; const p = workspace.cursorPos; callDBus(${JSON.stringify(nome)}, '/Cursor', 'org.aerostream.Cursor', 'Pos', Math.round(p.x), Math.round(p.y)); } workspace.cursorPosChanged.connect(enviar); enviar();`).then((ok) => { if (!ok) log('cursor: o KWin não carregou o script'); });
      const m = /^C (-?\d+) (-?\d+)$/.exec(l);
      if (m) { pend = { x: +m[1], y: +m[2] }; if (!timer) timer = setTimeout(enviar, Math.max(0, 33 - (Date.now() - ult))); } // no máximo 30 por segundo
    }
  });
  p.on('exit', () => { if (cursorProc === p) cursorProc = null; });
}

handle('proteger-janela', async (on) => {
  try { if (janela && !janela.isDestroyed()) janela.setContentProtection(!!on); } catch (e) { return { eficaz: false }; } // Windows/macOS (no Linux não faz nada)
  if (process.platform === 'win32' || process.platform === 'darwin') return { eficaz: true };
  return { eficaz: await kwinEsconder(!!on) };
});

// ---------- cursores de quem controla, POR CIMA de tudo (fora do app) ----------
// Janela transparente do tamanho da tela compartilhada, sempre no topo, que deixa todo clique passar e fica escondida da transmissão
// (quem assiste já vê os cursores desenhados no próprio Aero). Só existe enquanto há cursor para mostrar.
let janelaCursores = null, cursoresVisiveis = false;
function abrirCursores() {
  if (janelaCursores && !janelaCursores.isDestroyed()) return janelaCursores;
  const d = displayEscolhido || screen.getPrimaryDisplay();
  janelaCursores = new BrowserWindow({ ...d.bounds, transparent: true, frame: false, resizable: false, movable: false, focusable: false, skipTaskbar: true, hasShadow: false, show: false, alwaysOnTop: true, fullscreenable: false, title: 'Aero Stream Cursores', backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'cursores-preload.js'), contextIsolation: true, sandbox: !semSandbox, backgroundThrottling: false } });
  janelaCursores.setIgnoreMouseEvents(true);
  try { janelaCursores.setAlwaysOnTop(true, 'screen-saver'); janelaCursores.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) { /* ok */ }
  try { janelaCursores.setContentProtection(true); } catch (e) { /* ok */ }
  janelaCursores.loadFile(path.join(__dirname, 'cursores.html')).catch(() => {});
  janelaCursores.on('closed', () => { janelaCursores = null; cursoresVisiveis = false; clearTimeout(fecharCursoresT); });
  return janelaCursores;
}
// (0.8.3) escondida, a camada ainda ocupava um processo inteiro (100-250 MB) até o app fechar. Depois de 1 minuto sem cursor, ela fecha;
// se alguém voltar a mexer, abre de novo
let fecharCursoresT = null;
function esconderCursores() {
  if (!janelaCursores || janelaCursores.isDestroyed()) return;
  if (cursoresVisiveis) { janelaCursores.hide(); cursoresVisiveis = false; }
  clearTimeout(fecharCursoresT);
  fecharCursoresT = setTimeout(() => { if (janelaCursores && !janelaCursores.isDestroyed() && !cursoresVisiveis) { try { janelaCursores.destroy(); } catch (e) { /* ok */ } } }, 60000);
}
// (0.5.9-6) KDE Plasma no Wayland: quem desenha é o próprio KWin (cursores_kwin.js), numa camada acima de tudo, até de jogo em tela cheia.
// A janela transparente abaixo fica para Windows, X11 e outros ambientes (ou se o KWin/PyGObject não der).
const cursoresKwin = process.platform === 'linux' && /kde/i.test(process.env.XDG_CURRENT_DESKTOP || '') && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY)
  ? require('./cursores_kwin').criarCursoresKwin({ pastaTemp: app.getPath('temp'), log, ajudante: path.join(__dirname, 'entrada', 'camada_kwin.py') }) : null;
app.on('will-quit', () => { if (cursoresKwin) cursoresKwin.fechar(); });
handle('cursores-globais', (lista) => {
  const l = Array.isArray(lista) ? lista.slice(0, 8).map((c) => ({ id: String(c.id).slice(0, 16), x: Math.max(0, Math.min(1, +c.x || 0)), y: Math.max(0, Math.min(1, +c.y || 0)), cor: /^#[0-9a-f]{6}$/i.test(c.cor) ? c.cor : '#2d9ee0', nome: String(c.nome || '').slice(0, 24), ping: c.ping | 0 })) : [];
  if (cursoresKwin && cursoresKwin.disponivel() && cursoresKwin.mostrar((displayEscolhido || screen.getPrimaryDisplay()).bounds, l)) {
    esconderCursores();
    return;
  }
  if (!l.length) { esconderCursores(); return; }
  clearTimeout(fecharCursoresT);
  const w = abrirCursores();
  const mostrar = () => { if (!cursoresVisiveis && !w.isDestroyed()) { const d = displayEscolhido || screen.getPrimaryDisplay(); w.setBounds(d.bounds); w.showInactive(); cursoresVisiveis = true; if (!w.escondidaKwin) { w.escondidaKwin = true; setTimeout(() => kwinEsconder(true, 'Aero Stream Cursores').catch(() => {}), 300); } } if (!w.isDestroyed()) w.webContents.send('cursores', l); };
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', mostrar); else mostrar();
});

// ---------- Discord Rich Presence ----------
const discord = criarDiscord({ log, listarCaminhos: () => caminhosDoDiscord() });
handle('discord-presenca', (d) => { const c = lerCfg(); return discord.presenca({ ...d, appId: (d && d.appId) || c.discordAppId || '' }); });
handle('discord-estado', () => discord.estado());

// ---------- Ouvindo agora (a música que toca neste computador, para os amigos verem; desktop/ouvindo.js) ----------
const ouvindoTok = (novo) => { const c = lerCfg(); if (novo || typeof c.ouvirToken !== 'string' || c.ouvirToken.length < 16) { c.ouvirToken = require('crypto').randomBytes(12).toString('hex'); gravarCfg(c); } return c.ouvirToken; };
// a pasta da extensão do navegador (vai junto com o app) para quem instala sem a loja
const pastaExtensao = () => (app.isPackaged ? path.join(process.resourcesPath, 'extensao') : path.join(__dirname, '..', 'extensao'));
const ouvindo = require('./ouvindo').criarOuvindo({ log, lerToken: () => lerCfg().ouvirToken || '', abrirExterno: (u) => { if (/^(spotify:(track|episode):[A-Za-z0-9]{22}|https:\/\/music\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}|https:\/\/www\.deezer\.com\/(track|episode)\/[0-9]{1,14})$/.test(u)) shell.openExternal(u); }, aoMudar: () => { if (janela && !janela.isDestroyed()) janela.webContents.send('ouvindo-mudou'); }, abrirPasta: () => { const p = pastaExtensao(); if (fs.existsSync(p)) shell.openPath(p); } });
handle('ouvindo-ligar', (v) => { if (v) ouvindoTok(false); return ouvindo.ligar(!!v); });
handle('ouvindo-agora', () => ouvindo.agora());
handle('ouvindo-tocar', (c) => ouvindo.tocar(c && typeof c === 'object' ? { f: c.f, id: c.id, k: c.k, p: c.p, tocando: c.tocando, t: c.t } : null)); // (1.0.0) ouvir junto
handle('ouvindo-token', (novo) => ({ token: ouvindoTok(!!novo), porta: ouvindo.porta() }));
// (1.0.0) instalar a extensão: abre a página de instalar no navegador padrão; a extensão pega o código sozinha
handle('ouvindo-instalar', async () => { ouvindoTok(false); await shell.openExternal(ouvindo.convite()); return true; });
handle('ouvindo-extensao', () => ouvindo.extensao());
// (1.0.0) Assistindo agora (Twitch, Kick, YouTube e os sites da pessoa, pela extensão do navegador): a lista de sites e o vídeo de agora
handle('assistindo-sites', (c) => ouvindo.assistir(c && typeof c === 'object' ? c : null));
handle('assistindo-agora', () => ouvindo.assistindo());
app.on('will-quit', () => { try { ouvindo.parar(); } catch (e) { /* ok */ } });

// ---------- (1.0.0) Atividade de jogo: o que a pessoa joga, para os amigos verem (desktop/jogos.js e desktop/ponte-rpc.js) ----------
// Detecta os jogos abertos (lista do Discord + emuladores), recebe a atividade que os jogos mandam (SDK do Aero no canal aero-ipc-0 e a
// ponte no canal do Discord, que repassa tudo ao Discord de verdade) e junta com as atividades personalizadas da pessoa.
const ponteRpc = require('./ponte-rpc');
const jogos = require('./jogos').criarJogos({ log, pastaDados: app.getPath('userData'), lerPers: () => { const l = lerCfg().jogoPers; return Array.isArray(l) ? l : []; }, lerIgnorados: () => { const l = lerCfg().jogoIgn; return Array.isArray(l) ? l : []; }, pidsProprios: () => pidsProprios(),
  aoMudar: () => { if (janela && !janela.isDestroyed()) janela.webContents.send('jogo-mudou'); } }); // mudou o jogo: o app manda na hora
const ponteJogos = ponteRpc.criarPonte({ aoAtividade: (x) => jogos.aoRpc(x), log, caminhosDiscord: () => require('./discord').caminhos() });
function caminhosDoDiscord() { // o Discord de verdade, para o discord.js (nunca a própria ponte)
  const meu = ponteJogos.caminho(), l = require('./discord').caminhos().filter((c) => c !== meu);
  if (meu && process.platform !== 'win32') l.unshift(ponteJogos._real0());
  return l;
}
let sdkJogos = null, abrindoSdk = null;
const estadoJogo = () => ({ ...jogos.estado(), ponte: ponteJogos.ativa(), sdk: !!(sdkJogos && sdkJogos.aberto()) });
handle('jogo-ligar', async (o) => {
  o = o && typeof o === 'object' ? o : {};
  const ativo = !!o.ativo, ponte = ativo && o.ponte !== false, sdk = ativo && o.sdk !== false;
  jogos.ligar(ativo); ponteJogos.ligar(ponte);
  if (sdk && !sdkJogos) { if (!abrindoSdk) abrindoSdk = ponteRpc.abrirSdk({ aoAtividade: (x) => jogos.aoRpc(x), log }).then((s) => { sdkJogos = s; abrindoSdk = null; }); await abrindoSdk; }
  else if (!sdk && sdkJogos) { sdkJogos.parar(); sdkJogos = null; }
  if (ponte) await ponteJogos.garantir();
  return estadoJogo();
});
handle('jogo-agora', () => jogos.agora());
handle('jogo-estado', () => estadoJogo());
handle('jogo-abertos', async () => { await jogos.varrer(); return jogos.abertos(); });
handle('jogo-procurar', (q) => jogos.procurar(String(q == null ? '' : q).slice(0, 60)));
handle('jogo-imagens', (q) => jogos.imagens(String(q == null ? '' : q).slice(0, 100))); // (1.0.0) capas, logos e telas do jogo de console
handle('jogo-pers', (lista) => {
  const c = lerCfg();
  if (lista === undefined || lista === null) return Array.isArray(c.jogoPers) ? c.jogoPers : [];
  c.jogoPers = require('./jogos').limparPers(lista); gravarCfg(c); return c.jogoPers;
});
handle('jogo-detectados', async () => { await jogos.varrer(); return jogos.detectados(); }); // (1.0.2) os jogos que o Aero está vendo agora
// (1.0.2) os jogos que a pessoa escolheu não mostrar: { ks: chaves do jogo, n: nome, ic: ícone } (o nome e o ícone só para a lista)
handle('jogo-ignorados', (lista) => {
  const c = lerCfg();
  if (lista === undefined || lista === null) return Array.isArray(c.jogoIgn) ? c.jogoIgn : [];
  const ok = (k) => typeof k === 'string' && /^[aen]:[a-z0-9]{1,80}$/.test(k);
  c.jogoIgn = (Array.isArray(lista) ? lista : []).slice(0, 200).map((x) => ({
    ks: (x && Array.isArray(x.ks) ? x.ks : []).filter(ok).slice(0, 8),
    n: String((x && x.n) || '').slice(0, 128),
    ic: typeof (x && x.ic) === 'string' && /^https:\/\//.test(x.ic) ? x.ic.slice(0, 400) : '',
    tipo: ['jogo', 'emu', 'sdk', 'discord'].includes(x && x.tipo) ? x.tipo : 'jogo',
  })).filter((x) => x.ks.length);
  gravarCfg(c); return c.jogoIgn;
});
const pararJogos = () => { try { jogos.parar(); } catch (e) { /* ok */ } try { ponteJogos.parar(); } catch (e) { /* ok */ } try { if (sdkJogos) sdkJogos.parar(); } catch (e) { /* ok */ } };
app.on('will-quit', pararJogos);
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, pararJogos); // devolve o nome do canal do Discord antes de sair

// ---------- áudio por aplicativo ----------
const pidsProprios = () => { try { return [process.pid, ...app.getAppMetrics().map((m) => m.pid)]; } catch (e) { return [process.pid]; } };
const audio = criarAudio({ pastaDados: app.getPath('userData'), pidsProprios, log, emitirPCM: (f) => { if (janela && !janela.isDestroyed()) janela.webContents.send('audio-pcm', f); } });
handle('audio-disponivel', () => audio.disponivel());
handle('audio-listar', () => audio.listar());
handle('audio-volume', (id, v) => audio.volume(id, v));
handle('audio-mudo', (id, m) => audio.mudo(id, m));
// A janela compartilhada SEMPRE entra (mesmo com aplicativos marcados à mão, que se somam a ela). No Wayland o PID da janela não existe:
// vai o título dela, que o Linux compara com o nome dos aplicativos ("... — Mozilla Firefox" -> Firefox).
handle('audio-capturar', (o) => {
  const ehJanela = (id) => !!id && String(id).startsWith('window');
  const atual = fonteUsada ? fonteUsada.id : fonteEscolhida; // a fonte que está sendo transmitida agora
  const jan = o && o.janela ? o.janela : (ehJanela(atual) ? atual : null);
  const nome = fonteUsada && jan && fonteUsada.id === jan ? String(fonteUsada.name || '') : '';
  return audio.capturar({ ...o, janela: o && o.soApps ? null : jan, nomeJanela: nome });
});
handle('audio-parar', () => audio.parar());

// ---------- atualização automática do app (veja atualizador.js) ----------
handle('atualizacao-verificar', (servidor, canal) => atualizador.verificarEBaixar(servidor, canal === 'teste' ? 'teste' : 'normal'));
// (1.0.2) desligou as versões de teste: a versão de teste baixada sai e, ao reiniciar, o app volta para a instalada (e depois para a normal)
handle('atualizacao-normal', () => atualizador.descartar());
handle('atualizacao-canal', () => atualizador.canal());
handle('atualizacao-checar', (servidor) => atualizador.checar(servidor));

// ---------- bug do kernel que trava a placa AMD ao codificar (veja vce3.js) ----------
const vce3 = criarVce3({ pastaDados: app.getPath('userData'), log });
handle('vce3-diagnosticar', () => vce3.diagnosticar());
handle('vce3-preparar', () => vce3.preparar((etapa, detalhe) => { if (janela && !janela.isDestroyed()) janela.webContents.send('vce3-progresso', { etapa, detalhe }); }));
handle('vce3-instalar', () => vce3.instalar());
handle('vce3-desfazer', () => vce3.desfazer());

// ---------- (0.7.4) captura direta da placa no Linux, modo jogo (veja captura/kms.js e captura/aero-kms.c); (0.7.8) e no Windows (captura/windows.js) ----------
// Os quadros chegam já codificados (H.264 da placa, poucos KB cada) e vão para a interface, que só os empacota na conexão de sempre
// (a tela escolhida, em pixels; a captura do Windows conta as telas na ordem do próprio sistema)
const telaCaptura = () => { const r = regiaoDaTela(), ts = screen.getAllDisplays(), d = displayEscolhido || screen.getPrimaryDisplay(); return { larg: r.w, alt: r.h, saida: Math.max(0, ts.findIndex((x) => x.id === d.id)) }; };
const kms = process.platform === 'win32' ? criarCapturaWindows({ pastaDados: app.getPath('userData'), log, tela: telaCaptura, aoProcesso: () => prioridadeGpu(true) }) : criarKms({ pastaDados: app.getPath('userData'), log });
const paraJanela = (canal, d) => { if (janela && !janela.isDestroyed()) janela.webContents.send(canal, d); };
handle('kms-estado', (forcar) => kms.estado(!!forcar));
handle('kms-instalar', () => kms.instalar());
handle('kms-desinstalar', () => kms.desinstalar());
handle('kms-iniciar', (o) => {
  const n = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : d; };
  const teste = !!process.env.AERO_KMS_TESTE && !!(o && o.teste); // a imagem de teste só existe para os testes automáticos
  return kms.iniciar({ fps: n(o && o.fps, 10, 240, 60), altura: n(o && o.altura, 360, 4320, 1080), kbps: n(o && o.kbps, 300, 150000, 4000), teste },
    (q) => paraJanela('kms-quadro', { c: q.chave, u: q.us, d: q.dados, k: q.canal }), (motivo) => paraJanela('kms-fim', String(motivo || '')));
});
handle('kms-parar', () => kms.parar());
ipcMain.on('kms-cmd', (e, c, v, w) => {
  if (!confiavel(e)) return;
  if (c === 'idr') kms.idr(v); else if (c === 'taxa') kms.taxa(Number(v) || 0, w); else if (c === 'parar') kms.parar();
  else if (c === 'canal' && w && typeof w === 'object') kms.canal(v, { alt: w.alt, fps: w.fps, kbps: w.kbps }); else if (c === 'fechar') kms.fecharCanal(v); // (0.7.6) um codificador por pessoa
});
// reiniciar o COMPUTADOR (depois de instalar a correção do driver): só pelo botão que a pessoa aperta
handle('reiniciar-pc', () => new Promise((resolve) => require('child_process').execFile('systemctl', ['reboot'], (e) => resolve(!e))));

// ---------- teste automático dos perfis da placa (Linux) ----------
// Roda cada perfil numa cópia escondida do app (processo separado: se o driver recusar, só a cópia cai) e guarda o primeiro em que a PLACA codificou.
let sondando = null;
function sondarUm(id) {
  return new Promise((resolve) => {
    const args = [...(app.isPackaged ? [] : [app.getAppPath()]), '--aero-sonda=' + id];
    if (app.commandLine.hasSwitch('no-sandbox') || process.argv.includes('--no-sandbox')) args.push('--no-sandbox'); // a cópia precisa das mesmas condições do app
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    let saida = '', feito = false;
    const fim = (r) => { if (feito) return; feito = true; clearTimeout(t); try { p.kill(); } catch (e) { /* ok */ } resolve(r); };
    let p;
    try { p = require('child_process').spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { resolve({ id, ok: false, motivo: String(e.message) }); return; }
    const t = setTimeout(() => fim({ id, ok: false, motivo: 'tempo' }), 35000);
    p.stdout.on('data', (d) => { saida += d; const m = /AERO_SONDA (\{.*\})/.exec(saida); if (m) { try { fim(JSON.parse(m[1])); } catch (e) { fim({ id, ok: false, motivo: 'resposta' }); } } });
    p.stderr.on('data', () => {});
    p.on('error', (e) => fim({ id, ok: false, motivo: String(e.message) }));
    p.on('exit', (c) => setTimeout(() => fim({ id, ok: false, motivo: 'saiu ' + c }), 200));
  });
}
async function sondarPlaca({ todos = false } = {}) {
  if (!linux) return { ok: false, motivo: 'so-linux' };
  if (sondando) return sondando;
  sondando = (async () => {
    const resultados = [];
    for (const p of perfis.PERFIS) {
      const r = await sondarUm(p.id); resultados.push(r);
      log('placa: perfil', p.id, JSON.stringify({ placa: r.placa, impl: r.webrtcImpl, wc: r.webcodecs, motivo: r.motivo }));
      if (janela && !janela.isDestroyed()) janela.webContents.send('placa-sonda', { andamento: resultados.length, total: perfis.PERFIS.length, id: p.id, placa: !!r.placa });
      if (r.placa && !todos) break;
    }
    const melhor = perfis.escolher(resultados);
    const c = lerCfg();
    c.sonda = { electron: process.versions.electron, app: app.getVersion(), quando: Date.now(), melhor, resultados: resultados.map((r) => ({ id: r.id, ok: r.ok, placa: !!r.placa, impl: r.webrtcImpl || '', webcodecs: r.webcodecs, perfisGpu: (r.perfisGpu || []).slice(0, 8), perfisH264: r.perfisH264, motivo: r.motivo || '', erros: (r.erros || []).slice(0, 3) })) };
    const antes = cfg.perfilPlaca || 'padrao';
    if (melhor) c.perfilPlaca = melhor;
    gravarCfg(c);
    const resp = { ok: true, melhor, atual: antes, reiniciar: !!melhor && melhor !== antes, resultados: c.sonda.resultados };
    if (janela && !janela.isDestroyed()) janela.webContents.send('placa-sonda', { fim: true, ...resp });
    return resp;
  })().finally(() => { sondando = null; });
  return sondando;
}
handle('sondar-placa', (o) => sondarPlaca(o || {}));
handle('perfil-placa', () => ({ perfil: perfilPlaca && perfilPlaca.id, sonda: lerCfg().sonda || null, perfis: perfis.PERFIS.map((p) => ({ id: p.id, nome: p.nome })) }));

// ---------- transmissão ativa (bilhete de segurança, veja "sentinela" no começo) ----------
// Windows: com um jogo usando 100% da placa (Cyberpunk), a captura e a codificação do Aero ficavam sem vez e a transmissão caía para 1-5 fps.
// Transmitindo, o processo da placa (GPU) e o da janela ganham prioridade acima do normal (como o OBS faz); ao parar, voltam ao normal.
// (0.6.0) prioridade de GPU (o que o OBS faz): com o jogo usando ~100% da placa, a captura e a codificação esperavam na fila do Windows e o fps
// caía sempre que o jogo se mexia. Vale para os processos do Aero que capturam e codificam (veja desktop/prioridade/nativo/AeroPrioridade.cs).
let exePrioridade = null, ultPrioridade = '';
async function prioridadeGpu(on) {
  if (process.platform !== 'win32') return;
  try {
    if (!exePrioridade) {
      const fonte = fs.readFileSync(path.join(__dirname, 'prioridade', 'nativo', 'AeroPrioridade.cs'), 'utf8');
      const r = await require('./nativo').compilar({ nome: 'AeroPrioridade', fonte, pasta: path.join(app.getPath('userData'), 'nativo') });
      if (!r.ok) { log('prioridade gpu', r.erro); return; }
      exePrioridade = r.exe;
    }
    // (0.8.4) TODOS os processos do Aero (a rede e o áudio também): o mesmo programa tira deles o "modo de eficiência" do Windows 11
    const pids = [...new Set([process.pid, ...app.getAppMetrics().map((m) => m.pid), ...(on && kms.pids ? kms.pids() : [])])];
    execFile(exePrioridade, [on ? '4' : '2', ...pids.map(String)], { windowsHide: true, timeout: 5000 }, (e, out) => { const t = (on ? 'alta ' : 'normal ') + String(out || (e && e.message) || '').trim().replace(/\s+/g, ' '); if (t !== ultPrioridade) { ultPrioridade = t; log('prioridade gpu', t); } }); // (repete a cada 20 s: só registra quando muda)
  } catch (e) { log('prioridade gpu', e.message); }
}
// (0.8.4) o ms subindo MUITO quando o jogo carrega (Cyberpunk: a tela de carregamento usa 100% de todos os núcleos): os pacotes da chamada e
// da sala saem e chegam pelo processo de REDE do Chromium ("Network Service"), que ficava na prioridade normal, disputando o processador com
// as dezenas de linhas do jogo. Os pacotes esperavam a vez (o ms subia, o controle de banda achava que a internet tinha piorado e a imagem
// caía para 360p). Ele agora sobe junto (alta: trabalha pouco, mas tem de trabalhar na hora). E a cada 20 s confere de novo: o Chromium cria
// processos novos no meio da transmissão (o codificador, a rede reiniciada) e eles nasciam na prioridade normal
let prioridadeT = 0;
function prioridadeTransmissao(on) {
  clearInterval(prioridadeT); prioridadeT = 0;
  if (on && process.platform === 'win32') prioridadeT = setInterval(() => aplicarPrioridade(true), 20000);
  aplicarPrioridade(on);
}
function aplicarPrioridade(on) {
  prioridadeGpu(on);
  if (process.platform !== 'win32') return;
  const P = os.constants.priority, nivel = on ? P.PRIORITY_HIGH : P.PRIORITY_NORMAL;
  try {
    for (const m of app.getAppMetrics()) {
      if (m.type === 'GPU' || (m.type === 'Utility' && /video|capture|audio|network/i.test(m.serviceName || m.name || ''))) { try { os.setPriority(m.pid, nivel); } catch (e) { /* ok */ } }
    }
    if (janela && !janela.isDestroyed()) { try { os.setPriority(janela.webContents.getOSProcessId(), on ? P.PRIORITY_ABOVE_NORMAL : P.PRIORITY_NORMAL); } catch (e) { /* ok */ } }
    try { os.setPriority(process.pid, on ? P.PRIORITY_ABOVE_NORMAL : P.PRIORITY_NORMAL); } catch (e) { /* ok */ } // (0.7.8) o som da tela passa por este processo
  } catch (e) { log('prioridade', e.message); }
}
// (0.5.9-6) Linux com GameMode (Feral) ativo no jogo: o Aero entra no GameMode enquanto transmite (os mesmos ajustes do jogo: governador
// de desempenho, prioridade, núcleos). Sem isso o jogo ficava com tudo e a transmissão caía para 40-50 fps. Sem GameMode instalado, nada.
let noGameMode = [];
function gameMode(on) {
  if (process.platform !== 'linux') return;
  const chamar = (metodo, pid) => execFile('gdbus', ['call', '--session', '--dest', 'com.feralinteractive.GameMode', '--object-path', '/com/feralinteractive/GameMode', '--method', 'com.feralinteractive.GameMode.' + metodo, String(pid)], { timeout: 3000 }, () => {});
  if (!on) { noGameMode.forEach((pid) => chamar('UnregisterGame', pid)); noGameMode = []; return; }
  if (noGameMode.length) return;
  try { noGameMode = [process.pid, ...app.getAppMetrics().filter((m) => m.type === 'GPU' || m.type === 'Tab' || (m.type === 'Utility' && /video|capture|audio/i.test(m.serviceName || m.name || ''))).map((m) => m.pid)]; } catch (e) { noGameMode = [process.pid]; }
  noGameMode.forEach((pid) => chamar('RegisterGame', pid));
}
app.on('will-quit', () => gameMode(false));
handle('transmitindo', (on) => {
  prioridadeTransmissao(!!on);
  gameMode(!!on);
  cursorHost(!!on);
  if (on) { if (linux && placaCodifica) gravarSent({ transmitindo: true, modo: modoGpu }); }
  else { gravarSent(null); fonteUsada = null; reusarFonte = 0; const c = lerCfg(); if (c.travamentos) { c.travamentos = 0; gravarCfg(c); } } // parou: a próxima captura pede uma sessão NOVA ao portal (nada da antiga é reaproveitado)
  return true;
});

// ---------- mouse, teclado e controles de quem está com o controle remoto ----------
const emPixels = (r) => { // do tamanho "lógico" do Electron para pixels reais (no Windows com zoom de tela eles são diferentes)
  // (0.6.0) só no Windows: no Linux (KWin/Wayland) o ponteiro absoluto do uinput já anda em coordenadas lógicas; converter para pixels com
  // telas de zoom diferente deslocava o cursor de quem controla
  if (process.platform !== 'win32') return r;
  try { if (typeof screen.dipToScreenRect === 'function') { const x = screen.dipToScreenRect(null, r); if (x && x.width) return x; } } catch (e) { /* usa como está */ }
  return r;
};
const regiaoDaTela = () => { const d = displayEscolhido || screen.getPrimaryDisplay(); const r = emPixels(d.bounds); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
const areaDeTodas = () => {
  const rs = screen.getAllDisplays().map((d) => emPixels(d.bounds));
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y)), x1 = Math.max(...rs.map((r) => r.x + r.width)), y1 = Math.max(...rs.map((r) => r.y + r.height));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
// o host mexeu no próprio mouse/teclado: avisa a interface (que dá prioridade a ele sobre quem controla de longe)
const aoHost = () => { if (janela && !janela.isDestroyed()) janela.webContents.send('entrada-host'); };
const aoMira = (on) => { if (janela && !janela.isDestroyed()) janela.webContents.send('entrada-mira', !!on); }; // Windows: um jogo prendeu/soltou o cursor
const entrada = criarEntrada({ pastaDados: app.getPath('userData'), pastaRecursos: process.resourcesPath, regiao: regiaoDaTela, area: areaDeTodas, log, aoHost, aoMira });
handle('entrada-disponivel', () => entrada.disponivel());
// Windows: instala o ViGEmBus que vem junto com o app (o Windows pede permissão de administrador uma vez). Depois a entrada é refeita.
// (0.7.8) instalações antigas atualizadas pelo app podem não ter o instalador: baixa a versão oficial e confere pelo SHA-256 (o mesmo de scripts/baixar-vigem.mjs)
const VIGEM_URL = 'https://github.com/nefarius/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe';
const VIGEM_SHA = '89220a7865076b342892f98865f3499fb7c4cfd673159e89d352c360fd014c6a';
async function instaladorVigem() {
  const junto = path.join(process.resourcesPath || '', 'vigem', 'ViGEmBus_setup.exe');
  if (fs.existsSync(junto)) return junto;
  const r = await fetch(VIGEM_URL); if (!r.ok) throw new Error('download ' + r.status);
  const dados = Buffer.from(await r.arrayBuffer());
  if (require('crypto').createHash('sha256').update(dados).digest('hex') !== VIGEM_SHA) throw new Error('arquivo diferente do esperado');
  const pasta = path.join(app.getPath('userData'), 'nativo'), f = path.join(pasta, 'ViGEmBus_setup.exe');
  fs.mkdirSync(pasta, { recursive: true }); fs.writeFileSync(f, dados);
  return f;
}
handle('vigem-instalar', async () => {
  if (process.platform !== 'win32') return { ok: false, motivo: 'sem-instalador' };
  let exe; try { exe = await instaladorVigem(); } catch (e) { log('vigem', e.message); return { ok: false, motivo: 'sem-instalador' }; }
  const rodar = (arq, args) => new Promise((resolve) => require('child_process').execFile(arq, args, { windowsHide: false }, (e) => resolve(e)));
  let e = await rodar(exe, ['/passive', '/norestart']);
  // nem abriu (o Windows exige administrador e não chega a ser um código de saída): pede pela janela de permissão dele
  if (e && typeof e.code !== 'number') e = await rodar('powershell.exe', ['-NoProfile', '-Command', `$p = Start-Process -FilePath '${exe.replace(/'/g, "''")}' -ArgumentList '/passive','/norestart' -Verb RunAs -Wait -PassThru; exit $p.ExitCode`]);
  try { entrada.parar(); } catch (_) { /* ok */ }
  // 3010/1641 = instalado, pede reiniciar; 1638 = já havia uma versão instalada no sistema (também conta: não pede de novo)
  return { ok: !e || [3010, 1641, 1638].includes(e.code), codigo: e ? e.code : 0 };
});
const COMANDOS_ENTRADA = new Set(['mouseRel', 'mouseAbs', 'botao', 'roda', 'tecla', 'pad', 'padSair', 'soltarTudo', 'preparar']);
ipcMain.on('entrada-cmd', (e, nome, ...args) => { if (!confiavel(e) || !COMANDOS_ENTRADA.has(nome)) return; try { entrada[nome](...args); } catch (err) { log('entrada', err.message); } });

// ao fechar: devolve o som dos aplicativos, solta teclas e tira a atividade do Discord
let limpou = false;
const limparTudo = () => { if (limpou) return; limpou = true; try { cursorHost(false); } catch (e) { /* ok */ } gravarSent(null); try { audio.limparAoSair(); } catch (e) { /* ok */ } try { entrada.soltarTudo(); entrada.parar(); } catch (e) { /* ok */ } try { discord.parar(); } catch (e) { /* ok */ } try { kms.parar(); } catch (e) { /* ok */ } };
app.on('before-quit', limparTudo);
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => { saindo = true; limparTudo(); app.exit(0); });
app.on('will-quit', limparTudo);

let primeiraJanela = true, cheiaDaChamada = false;
// (1.0.0) a janela lembra como estava (maximizada, em tela cheia ou do tamanho que a pessoa deixou) e abre do mesmo jeito.
// Minimizar não conta (abrir minimizado não ajuda ninguém) e a tela cheia da chamada também não (ela é só da chamada).
const cabeNaTela = (b) => b && b.width >= 480 && b.height >= 400 && screen.getAllDisplays().some((d) => { const w = d.workArea; return b.x < w.x + w.width - 80 && b.x + b.width > w.x + 80 && b.y >= w.y - 20 && b.y < w.y + w.height - 80; });
let tGuardarJanela = 0;
function guardarJanela(ja) {
  clearTimeout(tGuardarJanela);
  const fazer = () => {
    if (!janela || janela.isDestroyed() || janela.isMinimized() || !janela.isVisible()) return;
    const c = lerCfg(), antes = c.janela || {};
    const cheia = janela.isFullScreen() && !cheiaDaChamada;
    const estado = cheia ? 'cheia' : janela.isFullScreen() ? (antes.estado === 'cheia' ? 'max' : antes.estado || 'normal') : janela.isMaximized() ? 'max' : 'normal';
    let b = antes.b; try { const nb = janela.getNormalBounds(); if (estado === 'normal' || !b) b = nb; } catch (e) { /* ok */ }
    c.janela = { estado, b }; gravarCfg(c);
  };
  if (ja) fazer(); else tGuardarJanela = setTimeout(fazer, 600);
}
function criarJanela() {
  // (0.7.0) aberto junto com o computador ("--bandeja"): começa só na bandeja, sem a janela na frente
  const peloSistema = primeiraJanela && process.argv.includes('--bandeja'), abrirInteira = peloSistema && lerCfg().inicioModo === 'janela';
  const naBandeja = peloSistema && !abrirInteira; primeiraJanela = false;
  const salvaJanela = lerCfg().janela || null;
  janela = new BrowserWindow({
    show: !naBandeja,
    width: 1200, height: 780, ...(salvaJanela && cabeNaTela(salvaJanela.b) ? { x: salvaJanela.b.x, y: salvaJanela.b.y, width: salvaJanela.b.width, height: salvaJanela.b.height } : {}), minWidth: 480, minHeight: 560, title: 'Aero', backgroundColor: '#02060e', autoHideMenuBar: true,
    icon: [path.join(__dirname, 'build', 'icon.png'), path.join(__dirname, 'build', 'icon.ico')].find((p) => fs.existsSync(p)),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: !semSandbox, devTools, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', v8CacheOptions: 'bypassHeatCheck', spellcheck: false },
  });
  if (process.platform === 'linux') { try { janela.setIcon(iconeJanela()); } catch (e) { /* fica o do arquivo */ } } // (1.0.0) sem a sobra transparente
  janela.setMenuBarVisibility(false);
  if (naBandeja) { if (criarBandeja()) escondidoNaBandeja = true; else janela.show(); } // sem bandeja (alguns Linux): mostra a janela mesmo
  else if (process.platform !== 'darwin') criarBandeja(); // (0.8.3) o ícone fica na bandeja sempre, não só depois de fechar para ela
  // (0.7.9) monitor pequeno (1366x768): os 1200x780 da janela não cabem e sobrava uma faixa em volta da imagem. Nele, a janela já abre ocupando a tela
  const area = screen.getPrimaryDisplay().workAreaSize || {}, monitorPequeno = area.height < 820 || area.width < 1280;
  const aplicarEstado = () => {
    if (!janela || janela.isDestroyed()) return;
    if (salvaJanela && salvaJanela.estado === 'cheia') janela.setFullScreen(true);
    else if (salvaJanela && salvaJanela.estado === 'max') janela.maximize();
    else if (!salvaJanela && (abrirInteira || monitorPequeno)) janela.maximize(); // (0.7.2) escolheu abrir com a janela: já ocupa a tela
  };
  if (naBandeja) janela.once('show', () => setTimeout(aplicarEstado, 0)); else aplicarEstado();
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) janela.on(ev, () => guardarJanela());
  janela.on('leave-full-screen', () => { cheiaDaChamada = false; });
  // A janela principal fechou de vez: fecha também a camada dos cursores e termina o app. Antes a camada (escondida) mantinha o
  // programa vivo SEM janela nenhuma, e abrir o Aero de novo não fazia nada (a outra cópia "já aberta" não tinha o que mostrar).
  janela.on('closed', () => {
    janela = null; audio.parar().catch(() => {});
    if (janelaCursores && !janelaCursores.isDestroyed()) { try { janelaCursores.destroy(); } catch (e) { /* ok */ } }
    if (cursoresKwin && !escondidoNaBandeja) cursoresKwin.fechar();
    if (!bandeja || !escondidoNaBandeja || saindoDeVez) app.quit();
  });
  // fechar a janela: bandeja (continua recebendo chamadas e mensagens) ou fechar de vez, como a pessoa escolheu (ou pergunta)
  janela.on('focus', escDoJogo); janela.on('blur', escDoJogo); janela.on('hide', escDoJogo); // o Esc só fica preso com o Aero em foco
  janela.on('close', (e) => {
    guardarJanela(true);
    if (saindoDeVez || saindo) return;
    const pref = lerCfg().fechar || 'perguntar';
    if (pref === 'sair') { saindoDeVez = true; return; }
    e.preventDefault();
    if (pref === 'bandeja') esconderNaBandeja(); else janela.webContents.send('perguntar-fechar');
  });
  // links (Ko-fi, X, GitHub, Spotify...) abrem no navegador padrão do sistema; só https, e nunca dentro do app
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\/[^\s]+$/i.test(url)) shell.openExternal(url).catch(() => {}); return { action: 'deny' }; });
  janela.webContents.on('will-navigate', (e) => e.preventDefault());
  // F11 tela cheia, F12 ferramentas de desenvolvedor (para ajudar a achar problemas)
  janela.webContents.on('before-input-event', (ev, i) => {
    // (0.7.9) no jogo do amigo, as teclas são dele: o Esc não solta o mouse nem sai da tela cheia, e F11/F12 não mexem na janela daqui
    if (teclasDoJogo) {
      if (i.key === 'Escape' && !i.isAutoRepeat) { ev.preventDefault(); janela.webContents.send('esc-do-jogo', i.type === 'keyDown'); }
      else if (i.key === 'Escape') ev.preventDefault();
      return;
    }
    if (i.type !== 'keyDown' || (i.control && i.alt)) return;
    if (i.key === 'F11') janela.setFullScreen(!janela.isFullScreen());
    if (i.key === 'F12' && devTools) janela.webContents.toggleDevTools();
  });
  if (!pastaApp) { janela.loadURL('data:text/html,<h2>Pasta app/ n%C3%A3o encontrada.</h2>'); return; }
  // a versão (atualizada ou não) abriu e ficou de pé: zera a contagem de "não conseguiu abrir"
  Promise.resolve(janela.loadFile(path.join(pastaApp, 'index.html'))).then(() => setTimeout(() => atualizador.confirmarAbriu(), 15000)).catch(() => {});
}

// (0.6.0) segurança: nenhuma página do app pode abrir <webview>, nem janelas novas que não sejam links https para o navegador do sistema,
// e permissões só para o próprio app (microfone, câmera, tela, tela cheia, área de transferência)
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (ev) => ev.preventDefault());
  wc.setWindowOpenHandler(({ url }) => { if (/^https:\/\/[^\s]+$/i.test(url)) shell.openExternal(url).catch(() => {}); return { action: 'deny' }; });
});
app.whenReady().then(() => {
  // lembra se a placa principal é NVIDIA (vale a partir da próxima abertura; veja "disable-webrtc-hw-decoding" acima)
  app.getGPUInfo('basic').then((g) => {
    const devs = (g && g.gpuDevice) || [], ativa = devs.find((d) => d.active) || devs[0];
    const nv = !!(ativa && ativa.vendorId === 0x10de);
    const c = lerCfg(); if (!!c.gpuNvidia !== nv) { c.gpuNvidia = nv; gravarCfg(c); log('placa NVIDIA:', nv, nv ? '(decodificação do vídeo dos amigos pelo processador a partir da próxima abertura)' : ''); }
  }).catch(() => {});
  Menu.setApplicationMenu(null);
  const ses = session.defaultSession;
  // (0.7.1) pointerLock/keyboardLock: o modo jogo prende o mouse na tela do amigo. Sem elas na lista, o Electron recusava o pedido, o cursor
  // sumia e nenhum movimento ia para o outro computador
  // (0.7.1) vídeo do YouTube no chat: a interface do app vem de um arquivo (file://), que não manda "de onde veio" (Referer). Desde 2025 o
  // player do YouTube recusa isso ("Erro 153"). Os pedidos ao player passam a dizer que vêm do site do Aero
  if (ses.webRequest) ses.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube-nocookie.com/*', 'https://www.youtube.com/*'] }, (d, cb) => {
    const cab = d.requestHeaders || {};
    if (!cab.Referer && !cab.referer) cab.Referer = 'https://web.aerostream.workers.dev/';
    cb({ requestHeaders: cab });
  });
  const PERMITIDAS = ['media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen', 'notifications', 'pointerLock', 'keyboardLock', 'local-fonts'];
  // (0.7.9) só a página do app: um vídeo ou música embutido no chat (outro site, dentro de um quadro) não pede microfone nem câmera; no máximo tela cheia
  const doQuadro = (permissao, d) => !(d && d.isMainFrame === false) || permissao === 'fullscreen';
  ses.setPermissionRequestHandler((wc, permissao, ok, d) => ok(!!janela && wc === janela.webContents && PERMITIDAS.includes(permissao) && doQuadro(permissao, d)));
  if (ses.setPermissionCheckHandler) ses.setPermissionCheckHandler((_wc, permissao, _origem, d) => PERMITIDAS.includes(permissao) && doQuadro(permissao, d));
  // Quando a interface pede "compartilhar tela", entrega a fonte escolhida (+ som do sistema no Windows).
  // Linux/Wayland: getSources abre o seletor do sistema (portal) e devolve SÓ o que a pessoa escolheu lá; é essa a fonte. Se ela cancelar,
  // a captura é recusada com callback(null): o Chromium responde "AbortError: Invalid capture constraints", que a interface trata como cancelamento.
  // Se o seletor do sistema falhar SEM a pessoa ter tido tempo de escolher (erro em menos de 1,5 s), não é cancelamento: o app tenta de novo de
  // outros jeitos (com miniaturas, só telas) e guarda o motivo exato para a interface e para o relatório de diagnóstico.
  const TENTATIVAS = [
    { types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } },
    { types: ['screen', 'window'], thumbnailSize: { width: 160, height: 90 } },
    { types: ['screen'], thumbnailSize: { width: 160, height: 90 } },
  ];
  ses.setDisplayMediaRequestHandler(async (req, callback) => {
    if (reusarFonte && fonteUsada && Date.now() - reusarFonte < 15000) { // nova tentativa da interface com a MESMA tela já escolhida (sem abrir o seletor de novo)
      reusarFonte = 0; ultimaCaptura = { ...ultimaCaptura, reuso: (ultimaCaptura && ultimaCaptura.reuso || 0) + 1 };
      callback({ video: fonteUsada, audio: process.platform === 'win32' && !(req && req.audioRequested === false) ? 'loopback' : undefined }); return; // o som também (antes a nova tentativa vinha muda)
    }
    const reg = { quando: Date.now(), portal: usaPortal, tentativas: [], resultado: '' };
    ultimaCaptura = reg;
    try {
      let fontes = null;
      for (const opc of TENTATIVAS) {
        const t0 = Date.now();
        try { fontes = await desktopCapturer.getSources(opc); } catch (e) { fontes = null; reg.tentativas.push({ tipos: opc.types.join('+'), mini: opc.thumbnailSize.width, ms: Date.now() - t0, erro: String((e && e.message) || e) }); }
        if (fontes && fontes.length) break;
        if (fontes) reg.tentativas.push({ tipos: opc.types.join('+'), mini: opc.thumbnailSize.width, ms: Date.now() - t0, erro: 'lista vazia' });
        if (usaPortal && Date.now() - t0 > 1500) break; // Wayland: a pessoa teve tempo de ver o seletor do sistema: é cancelamento de verdade, não abre outro (no X11 não há seletor: sempre tenta de novo)
      }
      log('captura', JSON.stringify(reg.tentativas));
      if (!fontes || !fontes.length) { reg.resultado = usaPortal && reg.tentativas.some((t) => t.ms > 1500) ? 'cancelado' : 'falhou'; callback(null); return; }
      const principal = String(screen.getPrimaryDisplay().id);
      const fonte = usaPortal ? fontes[0] : (fontes.find((f) => f.id === fonteEscolhida) || fontes.find((f) => f.display_id === principal) || fontes.find((f) => f.id.startsWith('screen')) || fontes[0]);
      if (usaPortal) { // descobre qual monitor foi (quando o portal informa) para o mouse "absoluto" cair no lugar certo
        fonteEscolhida = fonte.id;
        displayEscolhido = (fonte.display_id && screen.getAllDisplays().find((d) => String(d.id) === String(fonte.display_id))) || null;
      }
      reg.resultado = 'ok'; reg.fonte = fonte.id; fonteUsada = fonte;
      callback({ video: fonte, audio: process.platform === 'win32' && !(req && req.audioRequested === false) ? 'loopback' : undefined });
    } catch (e) { reg.resultado = 'falhou'; reg.erro = String(e && e.message); log('captura', e && e.message); callback(null); }
  });
  criarJanela();
  // Linux: na 1ª abertura desta versão, testa sozinho (em segundo plano) qual combinação faz a placa codificar
  if (linux && placaCodifica) {
    const sd = lerCfg().sonda;
    if (!sd || sd.electron !== process.versions.electron || sd.app !== app.getVersion()) setTimeout(() => { sondarPlaca().catch((e) => log('sonda', e && e.message)); }, 9000);
  }
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && criarJanela());
});
app.on('second-instance', (_e, argv) => {
  mostrarJanela(); // estava na bandeja, minimizado ou (por algum motivo) sem janela: aparece de novo
  const s = salaDoLink(argv); if (s && janela && !janela.isDestroyed()) janela.webContents.send('convite', s); // link do site com o app já aberto
  const aer = aerDoArgv(argv.slice(1)); if (aer) mandarAer(aer); // (1.0.0) um .aer aberto com o app já aberto
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { saindoDeVez = true; }); // o sistema pediu para fechar (desligar, sair da sessão): fecha de vez

// ---------- bandeja do sistema (Windows e Linux) ----------
let bandeja = null, saindoDeVez = false, escondidoNaBandeja = false; // (0.8.3) o ícone existe sempre; "escondido" = a pessoa mandou para a bandeja
function mostrarJanela() { if (!janela || janela.isDestroyed()) { criarJanela(); return; } janela.show(); if (janela.isMinimized()) janela.restore(); janela.focus(); }
// (0.6.0) selo de não lidas (uma bolhinha de vidro com o número, no lugar da bola vermelha): no ícone da bandeja, na barra de tarefas
// do Windows (ícone sobreposto) e no contador do Linux/macOS. As imagens são desenhadas pela interface (o mesmo visual do app).
const TAM_BANDEJA = process.platform === 'win32' ? 16 : 22;
let seloAtual = { n: 0, bandeja: null, janela: null };
// (1.0.0) Linux: o ícone da janela (o da barra de tarefas) com a bolha de não lidas, igual ao da bandeja
// (1.0.0) a barra de tarefas mostra o ícone inteiro do quadrado: sem a sobra transparente em volta, o Aero fica do tamanho dos outros
// (só corta o vazio, nunca o desenho). Guardado por imagem, para não refazer a conta a cada troca
const aparados = new WeakMap();
function aparar(img) {
  if (!img || img.isEmpty()) return img;
  if (aparados.has(img)) return aparados.get(img);
  let out = img;
  try {
    const { width: w, height: h } = img.getSize(), px = img.toBitmap();
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 >= 0) {
      const lado = Math.min(Math.max(w, h), Math.max(x1 - x0, y1 - y0) + 1 + Math.round(Math.max(w, h) * 0.01));
      const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
      const x = Math.round(Math.min(Math.max(0, cx - lado / 2), w - lado)), y = Math.round(Math.min(Math.max(0, cy - lado / 2), h - lado));
      if (lado < Math.max(w, h) * 0.97 && x >= 0 && y >= 0) out = img.crop({ x, y, width: lado, height: lado });
    }
  } catch (e) { out = img; }
  aparados.set(img, out); return out;
}
let iconePadrao = null;
const iconeJanela = () => {
  if (process.platform !== 'linux') return iconeBase();
  if (seloAtual.n && seloAtual.janela) return seloAtual.janela;
  if (iconeExtra) return aparar(iconeExtra);
  // o ícone de sempre: o planeta ocupa pouco do quadrado (o anel vai de ponta a ponta); um corte mais justo em volta dele deixa o Aero do
  // tamanho dos outros (só as pontinhas do anel encostam na borda; as bolinhas ficam inteiras)
  if (!iconePadrao) { const b = iconeBase(), { width: w } = b.getSize(); iconePadrao = w >= 128 ? b.crop({ x: Math.round(w * 57 / 512), y: Math.round(w * 52 / 512), width: Math.round(w * 400 / 512), height: Math.round(w * 400 / 512) }) : b; }
  return iconePadrao;
};
let iconeExtra = null; // (1.0.0) o ícone que a pessoa escolheu (Aero Bubble); sem ele, o de sempre
const iconeBase = () => iconeExtra || nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
const iconeBandeja = () => (seloAtual.n && seloAtual.bandeja ? seloAtual.bandeja : iconeBase()).resize({ width: TAM_BANDEJA, height: TAM_BANDEJA, quality: 'best' });
handle('icone-app', (d) => {
  try {
    const u = d && d.png;
    const img = typeof u === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 600000 ? nativeImage.createFromDataURL(u) : null;
    iconeExtra = img && !img.isEmpty() ? img : null;
    if (janela && !janela.isDestroyed()) janela.setIcon(iconeJanela());
    if (bandeja && !seloAtual.n) bandeja.setImage(iconeBandeja());
  } catch (e) { log('icone', e.message); }
  return true;
});
handle('selo', (d) => {
  try {
    const n = Math.max(0, Math.min(999, parseInt(d && d.n, 10) || 0));
    const img = (u) => (typeof u === 'string' && /^data:image\/png;base64,/.test(u) && u.length < 400000 ? nativeImage.createFromDataURL(u) : null);
    const jn = n && process.platform === 'linux' ? img(d.janela) : null;
    seloAtual = { n, bandeja: n ? img(d.bandeja) : null, janela: jn && !jn.isEmpty() ? jn : null };
    if (process.platform === 'linux' && janela && !janela.isDestroyed()) janela.setIcon(iconeJanela());
    if (bandeja) { bandeja.setImage(iconeBandeja()); bandeja.setToolTip(n ? `Aero (${n > 9 ? '9+' : n})` : 'Aero'); }
    if (process.platform === 'win32' && janela && !janela.isDestroyed()) janela.setOverlayIcon(n ? img(d.sobre) : null, n ? (n > 9 ? '9+' : String(n)) + ' não lidas' : '');
    if (process.platform !== 'win32') app.setBadgeCount(n);
  } catch (e) { log('selo', e.message); }
  return true;
});
function criarBandeja() {
  if (bandeja) return bandeja;
  try {
    const ic = iconeBandeja();
    bandeja = new Tray(ic);
    bandeja.setToolTip('Aero');
    bandeja.setContextMenu(Menu.buildFromTemplate([{ label: 'Abrir o Aero', click: mostrarJanela }, { type: 'separator' }, { label: 'Fechar o Aero', click: () => { saindoDeVez = true; app.quit(); } }]));
    bandeja.on('click', mostrarJanela);
  } catch (e) { log('bandeja', e.message); bandeja = null; }
  return bandeja;
}
function esconderNaBandeja() { if (!criarBandeja()) { saindoDeVez = true; app.quit(); return; } escondidoNaBandeja = true; if (janela && !janela.isDestroyed()) { janela.hide(); janela.webContents.send('liberar-memoria'); } }
handle('bandeja-preferencia', () => lerCfg().fechar || 'perguntar');
handle('bandeja-definir', (v) => { if (['perguntar', 'bandeja', 'sair'].includes(v)) { const c = lerCfg(); c.fechar = v; gravarCfg(c); } return true; });
handle('bandeja-escolher', (o) => {
  const acao = o && o.acao === 'bandeja' ? 'bandeja' : 'sair';
  if (o && o.lembrar) { const c = lerCfg(); c.fechar = acao; gravarCfg(c); }
  if (acao === 'bandeja') esconderNaBandeja(); else { saindoDeVez = true; app.quit(); }
  return true;
});
