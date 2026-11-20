// Ponte segura entre a interface e o Electron: só estas funções são liberadas (nada de "require" ou acesso livre ao sistema).
// Criado por Ryan Victtor.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

// (0.7.9) foi para a bandeja: solta o cache de imagens e fontes da página, que volta sozinho quando precisa
ipcRenderer.on('liberar-memoria', () => { try { webFrame.clearCache(); } catch (e) { /* ok */ } });

const chamar = (canal, ...a) => ipcRenderer.invoke(canal, ...a);
const mandar = (nome, ...a) => ipcRenderer.send('entrada-cmd', nome, ...a); // comandos de entrada: sem esperar resposta (são muitos por segundo)

// som capturado de aplicativos: chega do processo principal em blocos PCM float32 e é repassado a quem estiver ouvindo
const ouvintes = new Set();
ipcRenderer.on('audio-pcm', (_e, dados) => {
  let f = dados;
  if (!(f instanceof Float32Array)) {
    const u8 = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
    f = new Float32Array(u8.byteLength >> 2); new Uint8Array(f.buffer).set(u8.subarray(0, f.length * 4));
  }
  for (const cb of ouvintes) { try { cb(f); } catch (e) { /* um ouvinte com defeito não derruba os outros */ } }
});

// (0.7.4) captura direta da placa (modo jogo no Linux): os quadros codificados chegam do processo principal
const ouvKms = new Set(), fimKms = new Set();
ipcRenderer.on('kms-quadro', (_e, q) => { for (const cb of ouvKms) { try { cb(q); } catch (e) { /* ok */ } } });
ipcRenderer.on('kms-fim', (_e, m) => { for (const cb of fimKms) { try { cb(String(m || '')); } catch (e) { /* ok */ } } });
if (typeof window !== 'undefined') window.addEventListener('unload', () => ipcRenderer.send('kms-cmd', 'parar')); // a interface recarregou: a captura não fica rodando sozinha

contextBridge.exposeInMainWorld('aero', {
  teclasDoJogo: (on) => ipcRenderer.send('teclas-do-jogo', !!on),
  toqueTrava: () => ipcRenderer.send('toque-trava'),
  aoEscDoJogo: (cb) => { ipcRenderer.on('esc-do-jogo', (_e, baixo) => cb(!!baixo)); },
  cofreLocal: { fechar: (t) => ipcRenderer.sendSync('cofre-local', 'f', String(t)), abrir: (t) => ipcRenderer.sendSync('cofre-local', 'a', String(t)) },
  info: () => chamar('info'),
  ocioso: () => chamar('ocioso'),
  copiar: (t) => chamar('copiar', String(t)),
  mostrar: () => chamar('mostrar'),
  telaCheia: (on) => chamar('tela-cheia', !!on),
  selo: (d) => chamar('selo', d),
  iconeApp: (d) => chamar('icone-app', d), // (1.0.0) o ícone do Aero Bubble (desenhado pela interface)
  copiarImagem: (bytes) => chamar('copiar-imagem', bytes),
  baixarImagem: (url) => chamar('baixar-imagem', url),
  musicaAchar: (o) => chamar('musica-achar', { q: o && typeof o.q === 'string' ? o.q : '', url: o && typeof o.url === 'string' ? o.url : '' }), // (1.0.0) Música junto: o app procura quando o servidor não acha
  copiarArquivo: (bytes, ext) => chamar('copiar-arquivo', bytes, ext),
  notificar: (o) => chamar('notificar', o),
  inicioSistema: (ligar) => chamar('inicio-sistema', ligar), // (0.7.0) abrir junto com o computador (undefined = só consultar)
  inicioModo: (v) => chamar('inicio-modo', v), // (0.7.2) abrir na bandeja ou com a janela em tela inteira
  aoNotificacaoClique: (cb) => { const f = (_e, cid) => { try { cb(String(cid || '')); } catch (e) { /* ok */ } }; ipcRenderer.on('notificacao-clique', f); return () => ipcRenderer.removeListener('notificacao-clique', f); }, // (0.6.9) imagem de outro site para copiar // (0.6.0) PNG para a área de transferência do sistema
  abrirArquivo: (a) => chamar('abrir-arquivo', a), // (0.6.0) anexo do chat aberto no programa padrão do sistema
  ultimaCaptura: () => chamar('ultima-captura'),
  reusarFonte: () => chamar('reusar-fonte'),
  fontes: () => chamar('fontes'),
  escolherFonte: (id) => chamar('escolher-fonte', id),
  diagnostico: () => chamar('diagnostico'),
  controlesSemDriver: () => chamar('controles-sem-driver'),
  hw: () => chamar('hw-id'),
  bandeja: {
    preferencia: () => chamar('bandeja-preferencia'), definir: (v) => chamar('bandeja-definir', v), escolher: (acao, lembrar) => chamar('bandeja-escolher', { acao, lembrar: !!lembrar }),
    aoPerguntar: (cb) => { const f = () => { try { cb(); } catch (e) { /* ok */ } }; ipcRenderer.on('perguntar-fechar', f); return () => ipcRenderer.removeListener('perguntar-fechar', f); },
  },
  definirGpuModo: (m) => chamar('definir-gpu-modo', m),
  reiniciar: () => chamar('reiniciar'),
  aoSair: (cb) => { const f = () => { try { cb(); } catch (e) { /* ok */ } }; ipcRenderer.on('app-saindo', f); return () => ipcRenderer.removeListener('app-saindo', f); },
  recarregar: () => chamar('recarregar'),
  protegerJanela: (ligar) => chamar('proteger-janela', !!ligar),
  cursoresGlobais: (lista) => chamar('cursores-globais', lista),
  reiniciarPC: () => chamar('reiniciar-pc'),
  conviteInicial: () => chamar('convite-inicial'), // o app foi aberto por um link aerostream://sala/...
  aoAbrirAer: (cb) => { ipcRenderer.on('abrir-aer', (_e, d) => { try { cb(d); } catch (e) { /* ok */ } }); chamar('aer-inicial').then((d) => { if (d) cb(d); }).catch(() => {}); }, // (1.0.0) skins .aer
  aoConvite: (cb) => { const f = (_e, sala) => { try { cb(String(sala)); } catch (e) { /* ok */ } }; ipcRenderer.on('convite', f); return () => ipcRenderer.removeListener('convite', f); },
  atualizacao: {
    verificar: (servidor) => chamar('atualizacao-verificar', String(servidor || '')), // baixa e confere (assinatura) a versão nova, se houver
    checar: (servidor) => chamar('atualizacao-checar', String(servidor || '')), // só diz se há versão nova (o app pergunta antes de baixar)
  },
  vce3: { // bug do kernel que trava placas AMD Polaris ao codificar (veja desktop/vce3.js)
    diagnosticar: () => chamar('vce3-diagnosticar'),
    preparar: () => chamar('vce3-preparar'),
    instalar: () => chamar('vce3-instalar'),
    desfazer: () => chamar('vce3-desfazer'),
    aoProgresso: (cb) => { const f = (_e, d) => { try { cb(d); } catch (e) { /* ok */ } }; ipcRenderer.on('vce3-progresso', f); return () => ipcRenderer.removeListener('vce3-progresso', f); },
  },
  gpu: {
    vaapi: () => chamar('gpu-vaapi'), // o Linux oferece codificação H.264 por hardware (VA-API)?
    codifica: () => chamar('gpu-codifica'),
    sondar: (o) => chamar('sondar-placa', o || {}),     // testa as combinações (perfis) para a placa codificar; devolve o melhor
    perfil: () => chamar('perfil-placa'),
    aoSonda: (cb) => { const f = (_e, d) => { try { cb(d); } catch (e) { /* ok */ } }; ipcRenderer.on('placa-sonda', f); return () => ipcRenderer.removeListener('placa-sonda', f); }, // perfis que o codificador por hardware do Chromium oferece
    transmitindo: (on) => chamar('transmitindo', !!on), // liga/desliga o bilhete de segurança enquanto a placa codifica
  },
  kms: {
    estado: (forcar) => chamar('kms-estado', !!forcar),
    instalar: () => chamar('kms-instalar'),
    desinstalar: () => chamar('kms-desinstalar'),
    iniciar: (o) => chamar('kms-iniciar', o || {}),
    parar: () => chamar('kms-parar'),
    idr: (c) => ipcRenderer.send('kms-cmd', 'idr', c),
    taxa: (k, c) => ipcRenderer.send('kms-cmd', 'taxa', Number(k) || 0, c),
    canal: (c, o) => ipcRenderer.send('kms-cmd', 'canal', c, o || {}), // (0.7.6) um codificador por pessoa
    fecharCanal: (c) => ipcRenderer.send('kms-cmd', 'fechar', c),
    aoQuadro: (cb) => { ouvKms.add(cb); return () => ouvKms.delete(cb); },
    aoFim: (cb) => { fimKms.add(cb); return () => fimKms.delete(cb); },
  },
  discord: {
    presenca: (dados) => chamar('discord-presenca', dados),
    estado: () => chamar('discord-estado'),
  },
  ouvindo: { // (1.0.0) a música que toca neste computador (Spotify; YouTube Music e Deezer no navegador)
    ligar: (v) => chamar('ouvindo-ligar', !!v),
    agora: () => chamar('ouvindo-agora'),
    tocar: (c) => chamar('ouvindo-tocar', c), // (1.0.0) ouvir junto: abre a música do amigo aqui e acerta o tempo
    token: (novo) => chamar('ouvindo-token', !!novo),
    instalarExtensao: () => chamar('ouvindo-instalar'),
    extensao: () => chamar('ouvindo-extensao'),
    aoMudar: (cb) => { ipcRenderer.on('ouvindo-mudou', () => { try { cb(); } catch (e) { /* ok */ } }); }, // pausou/voltou/trocou: olha na hora
    sites: (c) => chamar('assistindo-sites', c), // (1.0.0) Assistindo agora: a lista de sites que a extensão lê
    assistindo: () => chamar('assistindo-agora'), // (1.0.0) o vídeo ou a live que passa agora no navegador
  },
  jogo: { // (1.0.0) a atividade de jogo: detecção, SDK do Aero, ponte do Discord e atividades personalizadas
    ligar: (o) => chamar('jogo-ligar', o || {}),
    agora: () => chamar('jogo-agora'),
    estado: () => chamar('jogo-estado'),
    abertos: () => chamar('jogo-abertos'),
    procurar: (q) => chamar('jogo-procurar', String(q || '')),
    imagens: (q) => chamar('jogo-imagens', String(q || '')),
    pers: (lista) => chamar('jogo-pers', lista === undefined ? null : lista),
    aoMudar: (cb) => { ipcRenderer.on('jogo-mudou', () => { try { cb(); } catch (e) { /* ok */ } }); }, // o que os amigos veem mudou (sem esperar a próxima pergunta)
  },
  celMic: { // (1.0.2) celular como microfone: o servidor local de pareamento (desktop/celmic.js)
    ligar: () => chamar('celmic-ligar'),
    info: () => chamar('celmic-info'),
    novoCodigo: () => chamar('celmic-codigo'),
    decidir: (id, sim) => chamar('celmic-decidir', String(id || ''), !!sim),
    responder: (id, sdp) => chamar('celmic-responder', String(id || ''), typeof sdp === 'string' ? sdp : null),
    encerrar: () => chamar('celmic-encerrar'),
    desligar: () => chamar('celmic-desligar'),
    aoEvento: (cb) => { ipcRenderer.on('celmic-evento', (_e, ev) => { try { cb(ev); } catch (e) { /* ok */ } }); },
  },
  audio: {
    disponivel: () => chamar('audio-disponivel'),
    listar: () => chamar('audio-listar'),
    volume: (id, v) => chamar('audio-volume', id, v),
    mudo: (id, m) => chamar('audio-mudo', id, m),
    capturar: (opcoes) => chamar('audio-capturar', opcoes),
    parar: () => chamar('audio-parar'),
    aoPCM: (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
  },
  entrada: {
    disponivel: () => chamar('entrada-disponivel'),
    instalarVigem: () => chamar('vigem-instalar'),
    aoCursorHost: (cb) => { const f = (_e, p) => { try { cb(p); } catch (e) { /* ok */ } }; ipcRenderer.on('cursor-host', f); return () => ipcRenderer.removeListener('cursor-host', f); },
    aoMira: (cb) => { const f = (_e, on) => { try { cb(!!on); } catch (e) { /* ok */ } }; ipcRenderer.on('entrada-mira', f); return () => ipcRenderer.removeListener('entrada-mira', f); },
    aoHost: (cb) => { const f = () => { try { cb(); } catch (e) { /* ok */ } }; ipcRenderer.on('entrada-host', f); return () => ipcRenderer.removeListener('entrada-host', f); },
    mouseRel: (dx, dy) => mandar('mouseRel', dx, dy),
    mouseAbs: (x, y) => mandar('mouseAbs', x, y),
    botao: (b, d) => mandar('botao', b, d),
    roda: (dx, dy) => mandar('roda', dx, dy),
    tecla: (code, d) => mandar('tecla', code, d),
    pad: (slot, estado) => mandar('pad', slot, estado),
    padSair: (slot) => mandar('padSair', slot),
    soltarTudo: () => mandar('soltarTudo'),
    preparar: () => mandar('preparar'),
  },
});
