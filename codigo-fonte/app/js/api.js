// Aero Stream - conversa com o servidor: conta, perfil, amigos, estatísticas e presença (quem está online).
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;

  // O servidor é fixo (ninguém precisa digitar endereço). Exceções: testes e desenvolvimento em localhost; e o próprio servidor, que serve o app.
  // Endereços oficiais (0.5.7): o site em web.aerostream.workers.dev (landing, downloads, doação e o Aero Web em /app/) e o servidor em
  // servidor.exemplo.invalid. (Os antigos servidor-antigo.exemplo.invalid não existem mais.)
  A.SERVIDOR = 'https://servidor.exemplo.invalid';
  A.SITE = 'https://web.aerostream.workers.dev';
  const local = (u) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(u || ''));
  const salvo = A.store.ler('aero-servidor');
  const API = (A.api = {
    servidor: A.plat.shell ? (local(salvo) ? salvo : A.SERVIDOR) : (local(location.origin) || location.origin === A.SERVIDOR ? location.origin : A.SERVIDOR),
    token: A.store.ler('aero-token'),
    eu: null,
  });

  API.definirServidor = (u) => {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (u && !/^https?:\/\//.test(u)) u = 'https://' + u;
    API.servidor = u;
    A.store.gravar('aero-servidor', u);
    return u;
  };
  // A sala ainda existe no servidor? (sala vazia por 1 minuto é apagada)
  API.salaExiste = async (cod) => { try { const r = await fetch(`${API.servidor}/api/sala/${encodeURIComponent(cod)}`, { cache: 'no-store' }); return r.ok ? !!(await r.json()).existe : false; } catch (e) { return false; } };
  API.definirToken = (t) => { API.token = t || ''; A.store.gravar('aero-token', API.token); };
  API.wsBase = () => API.servidor.replace(/^http/, 'ws');
  API.ticketWs = async () => (await API.req('ws-ticket', {})).ticket; // (0.7.8) vale uma conexão: o token da sessão não vai no endereço

  // identificador do aparelho (a moderação pode bloquear um aparelho): no app do PC vem do id da máquina; no site/celular, um aleatório guardado
  API.hw = () => (API._hw = API._hw || (async () => {
    try { if (window.aero && window.aero.hw) { const h = await window.aero.hw(); if (/^[0-9a-f]{16,64}$/.test(h)) return h; } } catch (e) { /* ok */ }
    let h = A.store.ler('aero-hw', ''); if (!/^[0-9a-f]{32}$/.test(h)) { h = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''); A.store.gravar('aero-hw', h); }
    return h;
  })());
  // Pedido genérico. Erros viram Error com .status (0 = sem rede)
  API.req = async (rota, corpo, metodo) => {
    if (!API.servidor) throw Object.assign(new Error(A.T('Falta o endereço do servidor.', 'Server address missing.')), { status: 0 });
    let r;
    // (0.5.9-6) sem resposta: tenta mais uma vez, sem o cabeçalho do aparelho (um servidor ou rede que recusa cabeçalhos extras barrava
    // todo pedido do navegador e do celular; recusado assim, o pedido nem chegou a sair, então repetir não duplica nada)
    const pedir = (comHw) => fetch(`${API.servidor}/api/${rota}`, {
      method: metodo || (corpo ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(comHw ? { 'X-Aero-HW': comHw } : {}), ...(API.token ? { Authorization: 'Bearer ' + API.token } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const hw = await API.hw();
    try { r = await pedir(hw); } catch (e) { await new Promise((ok) => setTimeout(ok, 500)); try { r = await pedir(''); } catch (e2) { /* sem rede */ } }
    if (!r) throw Object.assign(new Error(A.T('Não consegui falar com o servidor. Confira a internet e tente de novo.', 'Could not reach the server. Check your internet and try again.')), { status: 0 });
    let d = {};
    try { d = await r.json(); } catch (e) { /* resposta sem JSON */ }
    if (!r.ok) { if (d.banido) A.evt.emit('conta:banida', d); throw Object.assign(new Error(d.erro || A.T('Erro de conexão.', 'Connection error.')), { status: r.status, banido: d.banido }); }
    return d;
  };

  // ---------- conta: o CÓDIGO DE ACESSO nunca vai ao servidor (vai só um hash dele; veja cripto.js e servidor/src/acesso.js) ----------
  // O código fica guardado só neste aparelho (para abrir o cofre das conversas sem digitar de novo); "Sair" apaga.
  API.codigoAcesso = () => A.store.ler('aero-acesso', '');
  API.guardarCodigoAcesso = (c) => A.store.gravar('aero-acesso', API.formatarCodigo(c));
  API.formatarCodigo = (c) => { const n = A.cripto.normalizar(c); return n.replace(/(.{4})(?=.)/g, '$1-'); };
  API.registrar = async ({ nome, tag, email, termos }) => {
    const p = await A.cripto.prepararConta();
    const d = await API.req('registrar', { nome, tag, email, acesso: p.acesso, cofre: p.cofre, termos: termos || undefined });
    API.definirToken(d.token); API.guardarCodigoAcesso(p.codigo); await A.cripto.guardarConta(d.codigo);
    return { ...d, loginId: p.codigo };
  };
  // (0.6.0) o servidor pode pedir um passo a mais: o código do autenticador (2FA) ou o código que foi para o e-mail (aparelho/rede novos).
  // Aí a promessa falha com { precisa: '2fa' | 'email', email } e a tela chama de novo com { totp } ou { codigoEmail }.
  API.entrar = async (codigo, extra = {}) => {
    const { acesso } = await A.cripto.derivar(codigo);
    const so = (await A.maquina().catch(() => ({}))).so || '';
    let d;
    try { d = await API.req('entrar', { acesso, so, ...extra }); }
    catch (e) {
      if (e.status !== 404) throw e;
      try { d = await API.req('entrar', { acesso, so, loginId: API.formatarCodigo(codigo), ...extra }); } // conta de antes da 0.5.7 (troca o código aberto pelo hash)
      catch (e2) {
        // (1.0.2) código antigo (8 letras) que virou hash pelo caminho que repetia o "AERO" (0.9.6 a 1.0.1): também entra
        if (e2.status !== 404 || A.cripto.letras(codigo).length !== 8) throw e2;
        d = await API.req('entrar', { acesso: (await A.cripto.derivar('AERO' + A.cripto.normalizar(codigo), { bruto: true })).acesso, so, ...extra });
      }
    }
    if (d.precisa) throw Object.assign(new Error(d.precisa === '2fa' ? A.T('Digite o código do aplicativo autenticador.', 'Type the code from your authenticator app.') : A.T('Mandamos um código para ', 'We sent a code to ') + (d.email || A.T('o seu e-mail', 'your e-mail')) + A.T('. Digite-o para confirmar este aparelho.', '. Type it to confirm this device.')), { precisa: d.precisa, email: d.email });
    API.definirToken(d.token); API.guardarCodigoAcesso(codigo);
    return d;
  };
  // (0.9.6) entrar com a # e a senha (em vez do código de acesso). O resto (2FA, aparelho novo) é igual
  API.entrarSenha = async (tag, senha, extra = {}) => {
    const t = String(tag || '').trim().replace(/^#/, '');
    if (!t) throw new Error(A.T('Digite a sua #.', 'Type your #.'));
    if (!senha) throw new Error(A.T('Digite a sua senha.', 'Type your password.'));
    const { sal } = await API.req('acesso/sal', { tag: t });
    const acesso = await A.cripto.derivarSenha(senha, sal);
    const so = (await A.maquina().catch(() => ({}))).so || '';
    const d = await API.req('entrar', { acesso, senhaDe: t, so, ...extra });
    if (d.precisa) throw Object.assign(new Error(d.precisa === '2fa' ? A.T('Digite o código do aplicativo autenticador.', 'Type the code from your authenticator app.') : A.T('Mandamos um código para ', 'We sent a code to ') + (d.email || A.T('o seu e-mail', 'your e-mail')) + '.'), { precisa: d.precisa });
    API.definirToken(d.token); A.store.gravar('aero-acesso', '');
    return d;
  };
  API.definirSenha = async (senha) => {
    const sal = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    return API.req('acesso/senha', { sal, acesso: await A.cripto.derivarSenha(senha, sal) });
  };
  API.removerSenha = () => API.req('acesso/senha', { remover: true });
  // (0.9.6) entrar por QR code: este aparelho pede um QR (troca a cada 5 min) e espera um aparelho já logado aprovar
  API.qrNovo = async (antigo) => { const m = await A.maquina().catch(() => ({})); return API.req('qr/novo', { so: m.so || '', maquina: m.maquina || '', ...(antigo ? { antigo: antigo.id, antigoSeg: antigo.seg } : {}) }); };
  API.qrEstado = async (q) => {
    const d = await API.req('qr/estado', { id: q.id, seg: q.seg });
    if (d.estado === 'ok') { API.definirToken(d.token); A.store.gravar('aero-acesso', ''); }
    return d;
  };
  // (1.0.0) o contrário: o aparelho logado mostra o QR e o código que muda a cada 30 s; o novo lê/digita e espera o logado confirmar
  API.qrGerar = (antigo) => API.req('qr/gerar', antigo ? { antigo } : {});
  API.qrMeu = (id) => API.req('qr/meu', { id });
  API.qrDecidir = (id, sim) => API.req('qr/decidir', { id, sim: !!sim });
  API.qrPedir = async (codigo) => { const m = await A.maquina().catch(() => ({})); return API.req('qr/pedir', { codigo, so: m.so || '', maquina: m.maquina || '' }); };
  // ---------- várias contas neste aparelho (0.6.0): trocar sem digitar o código de novo ----------
  const CONTAS = 'aero-contas';
  API.contas = () => { try { const l = JSON.parse(A.store.ler(CONTAS, '[]')); return Array.isArray(l) ? l.filter((c) => c && c.token && c.codigo) : []; } catch (e) { return []; } };
  API.lembrarConta = () => {
    if (!API.eu || !API.token) return;
    const l = API.contas().filter((c) => c.codigo !== API.eu.codigo);
    l.unshift({ codigo: API.eu.codigo, nome: API.eu.nome, tag: API.eu.tag, av: API.eu.av || 0, token: API.token, acesso: API.codigoAcesso(), servidor: API.servidor });
    A.store.gravar(CONTAS, JSON.stringify(l.slice(0, 8)));
  };
  // (0.8.6) a sessão guardada dessa conta não vale mais: some do "Entrar rápido" até ela entrar de novo (que salva outra vez)
  API.esquecerToken = (codigo) => API.esquecerConta(codigo);
  API.esquecerConta = (codigo) => { A.store.gravar(CONTAS, JSON.stringify(API.contas().filter((c) => c.codigo !== codigo))); if (API.esquecerCopiaPrefs) API.esquecerCopiaPrefs(codigo); };
  // (0.6.0) no app do PC a página não pode navegar sozinha (nem recarregar): quem recarrega é o app
  const recarregar = API.recarregar = () => { const r = window.aero && window.aero.recarregar ? window.aero.recarregar() : null; if (r && r.catch) r.catch(() => location.reload()); else if (!r) location.reload(); };
  API.trocarConta = (codigo) => {
    const c = API.contas().find((x) => x.codigo === codigo); if (!c) return false;
    API.lembrarConta(); // a atual continua salva para voltar depois
    if (c.servidor) API.definirServidor(c.servidor);
    API.definirToken(c.token); A.store.gravar('aero-acesso', c.acesso || ''); A.store.gravar('aero-troca', c.codigo);
    if (!API.prefsDaCopia(c.codigo)) API.prefsPadrao(); // (1.0.2) o app recarrega já com as configurações da outra conta (ou o padrão, até chegarem)
    recarregar(); // recomeça limpo com a outra conta (tema, conversas, chaves e configurações dela)
    return true;
  };
  // "Adicionar conta": guarda esta e volta para a tela de entrar
  API.adicionarConta = () => { API.lembrarConta(); API.prefsPadrao(); API.definirToken(''); A.store.gravar('aero-acesso', ''); recarregar(); };
  // esqueci o código: e-mail com 6 números -> código novo. As conversas continuam (a chave da conta fica no servidor, veja cripto.js).
  API.esqueci = (email) => API.req('acesso/esqueci', { email });
  API.pedirTrocaEmail = async (codigo, email) => API.req('acesso/email-pedir', { acesso: (await A.cripto.derivar(codigo)).acesso, email });
  API.confirmarTrocaEmail = async (codigo) => { const d = await API.req('acesso/email-confirmar', { codigo }); if (API.eu) API.eu.email = d.email; return d; };
  API.verificarCodigo = (email, codigo) => API.req('acesso/verificar', { email, codigo });
  API.redefinir = async (v, totp) => {
    const manter = !!v.mantem; // o servidor tem a chave da conta: só troca o código de acesso
    const p = manter ? await A.cripto.novoAcesso() : await A.cripto.prepararConta();
    const d = await API.req('acesso/redefinir', { ticket: v.ticket, acesso: p.acesso, ...(totp ? { totp } : {}), ...(p.cofre ? { cofre: p.cofre } : {}) });
    API.definirToken(d.token); API.guardarCodigoAcesso(p.codigo); if (!manter) await A.cripto.guardarConta(d.codigo);
    return { ...d, loginId: p.codigo, manteve: manter };
  };
  API.carregarEu = async () => {
    API.eu = await API.req('eu');
    if (API.eu.loginId) { // conta de antes da 0.5.7 neste aparelho já logado: o servidor ainda tinha o código aberto; agora vira hash
      API.guardarCodigoAcesso(API.eu.loginId);
      try { await API.req('acesso/migrar', { acesso: (await A.cripto.derivar(API.eu.loginId)).acesso }); } catch (e) { A.log.aviso('migrar acesso', e); }
      delete API.eu.loginId;
    }
    if (A.store.ler('aero-lembrar-contas', '1') === '1') API.lembrarConta(); // (0.6.0) fica na lista de contas deste aparelho
    // (1.0.2) outra conta na tela (entrou agora): já põe a cópia dela e baixa as da conta na hora, sem esperar a conexão ao vivo
    if (API.sincronizando() && A.store.ler('aero-prefs-conta', '') !== API.eu.codigo) { API.prefsDaCopia(API.eu.codigo); API.puxarPrefs().catch(() => {}); }
    return API.eu;
  };
  API.perfil = (codigo) => API.req('perfil/' + encodeURIComponent(codigo));
  API.salvarPerfil = (dados) => API.req('perfil', dados);
  API.salvarAvatar = (dataUrl) => API.req('avatar', { dados: dataUrl });
  // GIF de foto ou banner (até 20 MB): vai em binário; o servidor comprime sem perda e guarda em pedaços
  API.subirImagem = async (tipo, blob) => {
    const r = await fetch(`${API.servidor}/api/imagem/${tipo}`, { method: 'POST', headers: { Authorization: 'Bearer ' + API.token, 'Content-Type': blob.type || 'image/gif' }, body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.erro || A.T('Não consegui enviar a imagem.', 'Could not upload the image.')), { status: r.status });
    return d;
  };
  API.tagLivre = async (tag) => (await API.req('tag-livre?tag=' + encodeURIComponent(tag))).livre;
  API.sair = async () => { const eu = API.eu; if (A.chamada && A.chamada.encerrarTudo) A.chamada.encerrarTudo(); try { if (A.push) await A.push.desligar(); } catch (e) { /* ok */ } try { await API.req('sair', {}); } catch (e) { /* já saiu */ } if (eu) API.esquecerConta(eu.codigo); API.prefsPadrao(); API.definirToken(''); A.store.gravar('aero-acesso', ''); API.eu = null; A.hub.fechar(); };
  API.amigos = {
    pedir: (codigo) => API.req('amigos/pedir', { codigo }),
    aceitar: (codigo) => API.req('amigos/aceitar', { codigo }),
    remover: (codigo) => API.req('amigos/remover', { codigo }),
    confianca: (codigo, confia) => API.req('amigos/confianca', { codigo, confia }),
    stats: (codigo) => API.req(`amigos/${encodeURIComponent(codigo)}/stats`),
  };

  // Servidores STUN/TURN (guarda por 6 h; a credencial vale 12 h. (1.0.0) antes eram 10 min, e cada chamada pedia de novo ao servidor). API.turn diz se o servidor tem TURN funcionando (e API.turnErro o porquê, se não).
  let iceCache = null, iceQuando = 0;
  API.turn = null; API.turnErro = '';
  API.ice = async (forcar = false) => {
    if (!forcar && iceCache && Date.now() - iceQuando < (API.turn ? 6 * 3600000 : 600000)) return iceCache; // (sem TURN, tenta de novo em 10 min)
    for (let i = 0; i < 3; i++) { // rede ruim (ou outro continente): tenta de novo antes de desistir do TURN
      try {
        const d = await (await fetch(API.servidor + '/ice', { cache: 'no-store', headers: API.token ? { Authorization: 'Bearer ' + API.token } : {} })).json();
        iceCache = d.iceServers; iceQuando = Date.now(); API.turn = !!d.turn; API.turnErro = d.turnErro || '';
        if (API.turnErro) A.log.aviso('TURN indisponível no servidor', API.turnErro);
        return iceCache;
      } catch (e) { A.log.aviso('ice', e); await A.esperar(600 * (i + 1)); }
    }
    iceCache = iceCache || [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
    return iceCache;
  };

  A.avatarUrl = (codigo, v) => (v ? `${API.servidor}/api/avatar/${encodeURIComponent(codigo)}?v=${v}` : null);

  // O que o app do PC diz sobre ele mesmo (uma vez só): sistema, versão, se a captura passa pelo portal do Linux (Wayland), identificação das flags
  let infoPC = null;
  A.infoPC = () => (A.plat.desktop && window.aero.info ? (infoPC = infoPC || window.aero.info().catch(() => ({}))) : Promise.resolve({}));
  A.portalPC = async () => !!(await A.infoPC()).portal;

  // Nome do aparelho que aparece na bolha dos amigos
  A.maquina = async () => {
    if (A.plat.desktop && window.aero.info) { try { return await window.aero.info(); } catch (e) { /* usa o padrão */ } }
    if (A.plat.apk) return { maquina: 'Android', so: 'Android' };
    if (A.plat.ios) return { maquina: /iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone', so: 'iOS' };
    if (A.plat.android) return { maquina: 'Android', so: 'Android' };
    return { maquina: A.T('Navegador', 'Browser'), so: 'Web' };
  };

  // ---------- presença: lista de amigos e quem está online, ao vivo ----------
  const H = (A.hub = { ws: null, presenca: new Map(), amigos: [], estado: 'online', sala: null, comp: false, pronto: false });
  let pingT = null, reconT = null, tentativas = 0;

  H.enviar = (obj) => { if (H.ws && H.ws.readyState === 1) H.ws.send(JSON.stringify(obj)); };
  H.fechar = () => {
    clearInterval(pingT); clearTimeout(reconT);
    const w = H.ws; H.ws = null; H.pronto = false;
    if (w) { w.onclose = null; try { w.close(); } catch (e) { /* já fechou */ } }
    H.presenca.clear(); H.amigos = [];
  };

  // um por janela do app (sobrevive a recarregar a página; outra janela ou outro aparelho tem o seu)
  let devFixo = '';
  const idAparelho = () => {
    if (devFixo) return devFixo;
    try { devFixo = sessionStorage.getItem('aero-dev') || ''; } catch (e) { /* sem armazenamento */ }
    if (!/^[a-z0-9]{12}$/.test(devFixo)) { const b = crypto.getRandomValues(new Uint8Array(12)); devFixo = [...b].map((x) => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); try { sessionStorage.setItem('aero-dev', devFixo); } catch (e) { /* ok */ } }
    return devFixo;
  };
  let conexaoN = 0, conectandoAte = 0; // (1.0.2) uma conexão a caminho: o "voltou para o app" (foco) não abre outra em cima dela
  H.conectar = async () => {
    H.fechar();
    if (!API.token || !API.servidor) return;
    const serie = ++conexaoN; conectandoAte = Date.now() + 10000;
    const m = await A.maquina();
    let ticket = '';
    try { ticket = await API.ticketWs(); } catch (e) { conectandoAte = 0; if (serie === conexaoN && API.token) { if (e.status === 401) A.evt.emit('hub:sessao-conferir'); else reconT = setTimeout(H.conectar, Math.min(15000, 2000 * ++tentativas)); } return; }
    if (serie !== conexaoN) return; // saiu ou reconectou enquanto o bilhete vinha
    // (0.7.4) o id deste aparelho é o MESMO em todas as reconexões. Antes o servidor sorteava um novo a cada conexão: a internet piscava, o app
    // voltava com outro id e o servidor achava que a chamada tinha passado para "outro aparelho" (o app saía dela e o amigo via você sumir)
    const ws = new WebSocket(`${API.wsBase()}/hub?ticket=${ticket}&maquina=${encodeURIComponent(m.maquina)}&so=${encodeURIComponent(m.so)}&sov=${encodeURIComponent(A.aparelhos ? await A.aparelhos.meu().catch(() => '') : '')}&hw=${await API.hw()}&dev=${idAparelho()}`);
    H.ws = ws; conectandoAte = 0;
    // (0.6.0) conexão "morta" (o celular suspendeu, o Wi-Fi trocou, o PC hibernou): o servidor achava que o aparelho estava ligado e as
    // novidades (resposta da equipe, mensagem lida, chamada) se perdiam até reiniciar. Sem resposta ao ping em 45 s, reconecta.
    let visto = Date.now();
    ws.addEventListener('message', () => { visto = Date.now(); });
    ws.onopen = () => {
      tentativas = 0; H.pronto = true; visto = Date.now();
      pingT = setInterval(() => { if (ws.readyState !== 1) return; if (Date.now() - visto > 45000) { try { ws.close(); } catch (e) { /* ok */ } return; } ws.send('ping'); }, 15000);
      if (H.estado !== 'online') H.enviar({ tipo: 'estado', estado: H.estado });
      if (H.sala) H.enviar({ tipo: 'transmitindo', sala: H.sala, comp: H.comp });
      A.evt.emit('hub:conectou'); // (0.8.7) voltou a conexão: quem precisa confere o estado de novo (ex.: a Música junto)
    };
    ws.onmessage = (ev) => {
      if (ev.data === 'pong') return;
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      tratar(msg);
    };
    ws.onclose = () => {
      if (H.ws !== ws) return;
      H.ws = null; H.pronto = false; clearInterval(pingT);
      if (API.token) reconT = setTimeout(H.conectar, Math.min(15000, 2000 * ++tentativas));
    };
  };

  // (0.8.7) a conexão foi recusada: confere a conta antes de qualquer coisa. Vale? só reconecta. Venceu? entra de novo sozinho com o código de
  // acesso guardado neste aparelho (como na abertura). Sem internet: tenta de novo depois. Só sem jeito nenhum volta para a tela de entrar
  let conferindo = false;
  A.evt.on('hub:sessao-conferir', async () => {
    if (conferindo || !API.token) return;
    conferindo = true; const serie = conexaoN;
    try {
      try { await API.carregarEu(); }
      catch (e) {
        if (e.status !== 401) throw e;
        const cod = API.codigoAcesso();
        if (!cod) { A.log.aviso('conexão recusada e sem código de acesso guardado: tela de entrar'); A.evt.emit('hub:sessao-invalida'); return; }
        try { await API.entrar(cod); } catch (e2) { if (e2.status !== 0 && e2.status !== 429 && !(e2.status >= 500)) { A.log.aviso('entrar de novo sozinho', e2.status); A.evt.emit('hub:sessao-invalida'); return; } throw e2; } // (pedir código por e-mail/2FA também precisa da pessoa)
        await API.carregarEu(); API.lembrarConta(); A.log.info('sessão renovada sozinha com o código guardado');
      }
      if (serie === conexaoN || !H.ws) { clearTimeout(reconT); reconT = setTimeout(H.conectar, Math.min(15000, 1000 * ++tentativas)); }
    } catch (e) { clearTimeout(reconT); reconT = setTimeout(H.conectar, Math.min(15000, 2000 * ++tentativas)); }
    finally { conferindo = false; }
  });

  function tratar(m) {
    if (m.tipo === 'amigos') {
      H.amigos = m.lista;
      const ok = new Set(m.lista.filter((a) => a.estado === 'aceita').map((a) => a.codigo)); if (A.api && A.api.eu && A.api.eu.codigo) ok.add(A.api.eu.codigo); // (1.0.0) os seus aparelhos ficam
      [...H.presenca].forEach(([dev, p]) => { if (!ok.has(p.codigo)) H.presenca.delete(dev); });
      A.evt.emit('hub:amigos', H.amigos);
    } else if (m.tipo === 'presenca') {
      if (m.ouv) m.ouv._rx = Date.now(); // (1.0.0) "Ouvindo agora": a barra anda pelo relógio deste aparelho a partir daqui
      if (m.jog) m.jog._rx = Date.now(); // (1.0.0) atividade de jogo: o tempo conta pelo relógio deste aparelho
      if (m.ass) m.ass._rx = Date.now(); // (1.0.0) Assistindo agora: o tempo do vídeo anda pelo relógio deste aparelho
      const novo = !H.presenca.has(m.dispositivo);
      H.presenca.set(m.dispositivo, m);
      A.evt.emit('hub:presenca', { p: m, novo });
    } else if (m.tipo === 'ouvindo') { // (1.0.0) a música de um amigo mudou (ou parou)
      const p = H.presenca.get(m.dispositivo);
      if (p) { if (m.ouv) p.ouv = { ...m.ouv, _rx: Date.now() }; else delete p.ouv; A.evt.emit('hub:ouvindo', { codigo: m.codigo }); }
    } else if (m.tipo === 'assistindo') { // (1.0.0) a live ou o vídeo de um amigo mudou (ou parou)
      const p = H.presenca.get(m.dispositivo);
      if (p) { if (m.ass) p.ass = { ...m.ass, _rx: Date.now() }; else delete p.ass; A.evt.emit('hub:assistindo', { codigo: m.codigo }); }
    } else if (m.tipo === 'jogando') { // (1.0.0) o jogo de um amigo mudou (ou fechou)
      const p = H.presenca.get(m.dispositivo);
      if (p) { if (m.jog) p.jog = { ...m.jog, _rx: Date.now() }; else delete p.jog; A.evt.emit('hub:jogando', { codigo: m.codigo }); }
    } else if (m.tipo === 'offline') {
      const p = H.presenca.get(m.dispositivo);
      H.presenca.delete(m.dispositivo);
      A.evt.emit('hub:offline', p || m);
    } else if (m.tipo === 'erro') {
      // (0.8.7) só sai da conta quando o aparelho foi desconectado de verdade (em "Aparelhos conectados"). Antes qualquer recusa saía e
      // apagava a conta salva: o celular voltava da tela apagada com o bilhete da conexão vencido e caía na tela de entrar
      A.evt.emit(m.codigo === 'removida' || /outro aparelho|another device/i.test(m.msg || '') ? 'hub:sessao-invalida' : 'hub:sessao-conferir');
    } else if (m.tipo === 'banido') {
      A.evt.emit('conta:banida', { banido: m.ban });
    } else if (m.tipo === 'bolha') {
      if (API.eu) { API.eu.bolha = m.bolha; if (Array.isArray(m.sl)) API.eu.sl = m.sl; } A.evt.emit('bolha', m.bolha); if (Array.isArray(m.sl)) A.evt.emit('perfil'); // (0.7.14) o Aero Bubble mudou (pagamento no Ko-fi, por exemplo)
    } else if (m.tipo === 'aviso-admin') {
      A.evt.emit('hub:aviso-admin', m.aviso);
    } else if (m.tipo === 'prefs-mudou') {
      A.evt.emit('hub:prefs-mudou', m); // configurações da conta mudaram em outro aparelho
    } else if (m.tipo === 'aviso-lido' || m.tipo === 'admin-mudou' || m.tipo === 'analytics-online' || m.tipo === 'fb-novos' || m.tipo === 'bolha-mudou') {
      A.evt.emit('hub:' + m.tipo, m); // admin.js: aviso fechado em outro aparelho / a página da equipe tem novidade; analytics.js: quantas pessoas estão online
    } else if (m.tipo === 'eu') {
      H.dev = m.dev; // o id deste aparelho no Hub (as chamadas usam para mandar a negociação ao aparelho certo)
      A.evt.emit('hub:eu', m);
    } else if (/^(conv-(msg|editada|apagada|mudou|removido|recibo|lido|marca|reacao)|chamada(-fim|-recusada|-estado|-trocou)?|cham-sinal|cofre-mudou|chave-conta-mudou|digitando|musica|musica-erro|convite-sala(-resposta|-fim)?|gifs-fav|figs-fav|priv-mudou)$/.test(m.tipo)) {
      A.evt.emit('hub:' + m.tipo, m); // Aero Talk (talk.js): mensagens, grupos e chamadas ao vivo; cripto.js: o cofre da conta mudou
    }
  }

  // A sala que EU abri: os amigos veem "em sala" e, se estiver transmitindo, o botão Assistir
  H.anunciarSala = (sala, comp) => { H.sala = sala || null; H.comp = !!comp && !!sala; H.enviar({ tipo: 'transmitindo', sala: H.sala, comp: H.comp }); };
  H.definirEstado = (e) => { if (H.estado !== e) { H.estado = e; H.enviar({ tipo: 'estado', estado: e }); A.evt.emit('hub:estado', e); } };

  // "ausente" depois de 5 min sem mexer (PC) ou com a aba escondida (celular)
  document.addEventListener('visibilitychange', () => { if (A.plat.celular) H.definirEstado(document.hidden ? 'ausente' : 'online'); });
  setInterval(async () => {
    if (!A.plat.desktop || !window.aero.ocioso) return;
    try { H.definirEstado((await window.aero.ocioso()) > 300 ? 'ausente' : 'online'); } catch (e) { /* ignora */ }
  }, 30000);

  // voltou para o app (foco, rede, tela do celular acesa): se a conexão caiu, reconecta na hora em vez de esperar o próximo ping
  const acordar = () => { if (!API.token || Date.now() < conectandoAte) return; if (!H.ws || H.ws.readyState > 1) { clearTimeout(reconT); H.conectar(); } };
  addEventListener('online', acordar); addEventListener('focus', acordar); document.addEventListener('visibilitychange', () => { if (!document.hidden) acordar(); });
  H.dispositivosDe = (codigo) => [...H.presenca.values()].filter((p) => p.codigo === codigo);
  H.online = (codigo) => H.dispositivosDe(codigo).length > 0;

  // ---------- configurações da conta em todos os aparelhos (0.5.9-7) ----------
  // Tema, sons, toque de chamada, tamanho do chat, idioma, atualizações e volume da música seguem a conta. O que é de cada aparelho
  // (microfone, saída de som, placa de vídeo, controle, transmissão) fica só nele. A mais nova vence (hora em que foi mudada).
  const SINC = ['tema', 'visual', 'som', 'toque', 'chat', 'idioma', 'atualizar', 'volMusica', 'volMidia', 'pularSplash', 'integ', 'toqueExtra', 'toquesAmigo', 'pacoteSons', 'somEntrarOutros', 'iconeApp', 'npExclusivos'];
  let aplicandoPrefs = false, tPrefs = 0;
  // (0.9.5) dá para escolher o que segue a conta, por parte. A parte desligada fica só neste aparelho, e o que a conta tem dela continua guardado
  const PARTES = { aparencia: ['tema', 'iconeApp'], desempenho: ['visual'], /* (1.0.2) a versão (otimizada/completa) pode ficar só no aparelho */ chats: ['chat'], sons: ['som', 'toque', 'volMusica', 'volMidia', 'toqueExtra', 'toquesAmigo', 'pacoteSons', 'somEntrarOutros'], geral: ['idioma', 'atualizar', 'pularSplash', 'npExclusivos'], integracoes: ['integ'] };
  const parteDe = (k) => Object.keys(PARTES).find((x) => PARTES[x].includes(k));
  const sincK = (k) => { const ps = A.cfg.v.sincPartes; if (!ps || typeof ps !== 'object') return true; const p = parteDe(k); if (p === 'desempenho' && ps.desempenho === undefined) return ps.aparencia !== false; return ps[p] !== false; };
  // (0.9.5) as integrações instaladas seguem a conta. As da Comunidade vão sem o pacote (cada aparelho baixa de novo do servidor, passando
  // pelas travas daqui); as feitas por você vão inteiras, e só ficam neste aparelho se não couberem
  const integLeve = (g) => {
    const out = {};
    for (const [k, x] of Object.entries(g || {})) { if (!x || typeof x !== 'object') continue; const { trava, ...y } = x; void trava; if (y.com && y.pac) delete y.pac; out[k] = y; }
    if (JSON.stringify(out).length > 30000) for (const y of Object.values(out)) if (y.pac) { delete y.pac; y.so = 1; }
    return out;
  };
  const integDaConta = (local, conta) => {
    const out = {};
    for (const [k, x] of Object.entries(conta || {})) {
      if (!x || typeof x !== 'object') continue; const aqui = local && local[k];
      out[k] = { ...x }; delete out[k].so;
      if (!out[k].pac && aqui && aqui.pac) out[k].pac = aqui.pac; // o pacote que este aparelho já tem
      if (aqui && aqui.trava && !x.on) out[k].trava = aqui.trava;
      if (x.so && !out[k].pac) delete out[k]; // feita em outro aparelho e grande demais para a conta
    }
    return out;
  };
  let prefsConta = null; // o que a conta tem guardado (da última vez que baixou)
  const pacotePrefs = () => { const v = {}; for (const k of SINC) { if (!sincK(k)) { if (prefsConta && prefsConta[k] !== undefined) v[k] = prefsConta[k]; continue; } if (A.cfg.v[k] !== undefined) v[k] = JSON.parse(JSON.stringify(A.cfg.v[k])); } if (v.tema) { delete v.tema.imagemAnim; delete v.tema.vidroAnim; } /* (0.9.5) o animado é só deste aparelho */ if (v.integ) v.integ = integLeve(v.integ); if (v.tema && JSON.stringify(v.tema).length > 50000) { v.tema = { ...v.tema, imagem: null, bolhasImagem: null }; } return v; };
  const salvarOriginal = A.cfg.salvar.bind(A.cfg);
  A.cfg.salvar = () => {
    const r = salvarOriginal();
    if (!aplicandoPrefs && API.token && API.eu && API.sincronizando()) {
      const novo = JSON.stringify(pacotePrefs());
      if (novo !== API._ultimoPrefs && A.store.ler('aero-prefs-conta', '') === API.eu.codigo && (prefsConta || SINC.every(sincK))) { API._ultimoPrefs = novo; A.store.gravar(chavePrefs(), String(Date.now())); guardarCopia(); clearTimeout(tPrefs); tPrefs = setTimeout(() => API.req('prefs', { v: JSON.parse(novo), t: +A.store.ler(chavePrefs(), '0') }).catch(() => {}), 1500); }
    }
    return r;
  };
  // (0.6.0) a hora da última mudança é guardada POR CONTA. Antes era uma só por aparelho: depois de usar a conta de outra pessoa, o tema
  // dela parecia "mais novo" que o seu, o app não baixava o seu e ainda subia o dela para a sua conta.
  const chavePrefs = () => 'aero-prefs-t:' + ((API.eu && API.eu.codigo) || '');
  // (0.9.1) dá para deixar cada aparelho com as configurações dele (ex.: doca no celular e bolha no computador). Isto fica só no aparelho
  API.sincronizando = () => A.cfg.v.sincronizar !== false;
  API.mudarSincronizar = async (sim, usarDaqui) => {
    A.cfg.v.sincronizar = !!sim; salvarOriginal();
    if (!sim || !API.token || !API.eu) return;
    if (usarDaqui) { API._ultimoPrefs = ''; A.store.gravar('aero-prefs-conta', API.eu.codigo); A.cfg.salvar(); } // as deste aparelho viram as da conta
    else { A.store.gravar(chavePrefs(), '0'); await API.puxarPrefs(); } // as da conta vêm para este aparelho
  };
  API.PARTES_SINC = Object.keys(PARTES);
  API.sincParte = (x) => sincK(PARTES[x][0]);
  API.mudarSincParte = async (x, sim) => {
    A.cfg.v.sincPartes = { ...(A.cfg.v.sincPartes && typeof A.cfg.v.sincPartes === 'object' ? A.cfg.v.sincPartes : {}), [x]: !!sim }; salvarOriginal();
    if (!API.token || !API.eu || !API.sincronizando()) return;
    if (sim) { A.store.gravar(chavePrefs(), '0'); await API.puxarPrefs(); } // ligou de novo: essa parte volta a ser a da conta
  };
  // (1.0.2) cada conta salva neste aparelho tem uma cópia das configurações dela: ao entrar (ou trocar de conta) o app já abre com elas, sem
  // esperar a internet, e ao sair volta para o padrão. O servidor continua sendo quem vale: se lá tiver algo mais novo, chega logo depois
  const COPIA = 'aero-prefs-c:';
  const guardarCopia = () => {
    if (!API.eu || A.store.ler('aero-prefs-conta', '') !== API.eu.codigo) return;
    const v = {}; for (const k of SINC) if (A.cfg.v[k] !== undefined) v[k] = A.cfg.v[k];
    try { A.store.gravar(COPIA + API.eu.codigo, JSON.stringify(v)); } catch (e) { A.log.aviso('cópia das configurações', e); }
  };
  const FICAM = ['idioma', 'visual']; // escolhidos na introdução deste aparelho: sair da conta não muda o idioma nem a versão (otimizada/completa)
  const aplicarValores = (v, idiomaAntes) => {
    salvarOriginal();
    if (A.tema && A.tema.aplicar) A.tema.aplicar();
    if (A.cfg.v.idioma !== idiomaAntes && A.setIdioma) A.setIdioma(A.cfg.v.idioma);
    if (A.integ) { try { A.integ.aplicar(); A.evt.emit('integ:mudou'); } catch (e) { A.log.erro('integrações da conta', e); } }
    A.evt.emit('prefs:aplicadas');
  };
  // saiu da conta: as configurações dela saem da tela (ficam na cópia e na conta) e o app volta ao padrão
  API.prefsPadrao = () => {
    if (!API.sincronizando()) return; // cada aparelho com as suas: nada muda
    const conta = A.store.ler('aero-prefs-conta', ''); if (!conta) return;
    const pad = A.cfg.padrao(), idiomaAntes = A.cfg.v.idioma;
    aplicandoPrefs = true;
    try {
      for (const k of SINC) { if (FICAM.includes(k) || !sincK(k)) continue; if (pad[k] === undefined) delete A.cfg.v[k]; else A.cfg.v[k] = pad[k]; }
      A.store.gravar('aero-prefs-conta', ''); prefsConta = null; API._ultimoPrefs = '';
      aplicarValores(A.cfg.v, idiomaAntes);
    } finally { aplicandoPrefs = false; }
  };
  // entrou (ou trocou) numa conta: põe na hora a cópia dela, se tiver. Devolve se as configurações na tela já são dela
  API.prefsDaCopia = (codigo) => {
    if (!codigo || !API.sincronizando()) return false;
    if (A.store.ler('aero-prefs-conta', '') === codigo) return true;
    let v = null; try { v = JSON.parse(A.store.ler(COPIA + codigo, '') || 'null'); } catch (e) { v = null; }
    if (!v || typeof v !== 'object') return false;
    const pad = A.cfg.padrao(), idiomaAntes = A.cfg.v.idioma;
    aplicandoPrefs = true;
    try {
      for (const k of SINC) { if (!sincK(k)) continue; const x = v[k] !== undefined ? v[k] : FICAM.includes(k) ? A.cfg.v[k] : pad[k]; if (x === undefined) delete A.cfg.v[k]; else A.cfg.v[k] = x; }
      A.store.gravar('aero-prefs-conta', codigo); prefsConta = null; API._ultimoPrefs = '';
      aplicarValores(A.cfg.v, idiomaAntes);
    } finally { aplicandoPrefs = false; }
    return true;
  };
  API.esquecerCopiaPrefs = (codigo) => { if (codigo) A.store.gravar(COPIA + codigo, ''); };
  let puxouEm = 0;
  API.puxarPrefs = async () => {
    if (!API.token || !API.eu || !API.sincronizando()) return;
    puxouEm = Date.now();
    let d; try { d = await API.req('prefs'); } catch (e) { return; }
    const outraConta = A.store.ler('aero-prefs-conta', '') !== API.eu.codigo; // estas configurações na tela são de outra conta
    const p = d && d.prefs, localT = outraConta ? 0 : +A.store.ler(chavePrefs(), '0') || 0;
    prefsConta = p && p.v && typeof p.v === 'object' ? p.v : {};
    A.store.gravar('aero-prefs-conta', API.eu.codigo);
    if (!p || !p.v) { API._ultimoPrefs = ''; if (!outraConta) A.cfg.salvar(); else { API._ultimoPrefs = JSON.stringify(pacotePrefs()); A.cfg.salvar(); } guardarCopia(); return; } // conta sem nada guardado: sobe as deste aparelho
    if (p.t <= localT) return;
    aplicandoPrefs = true;
    try {
      const idiomaAntes = A.cfg.v.idioma;
      for (const k of SINC) if (p.v[k] !== undefined && sincK(k)) A.cfg.v[k] = k === 'integ' ? integDaConta(A.cfg.v.integ, p.v.integ) : p.v[k] && typeof p.v[k] === 'object' && !Array.isArray(p.v[k]) && A.cfg.v[k] && typeof A.cfg.v[k] === 'object' ? { ...A.cfg.v[k], ...p.v[k] } : p.v[k];
      API._ultimoPrefs = JSON.stringify(pacotePrefs()); A.store.gravar(chavePrefs(), String(p.t));
      salvarOriginal(); guardarCopia();
      if (A.tema && A.tema.aplicar) A.tema.aplicar();
      if (A.cfg.v.idioma !== idiomaAntes && A.setIdioma) A.setIdioma(A.cfg.v.idioma);
      if (A.integ && sincK('integ') && p.v.integ !== undefined) { try { A.integ.aplicar(); A.evt.emit('integ:mudou'); if (A.integ.completar) A.integ.completar(); } catch (e) { A.log.erro('integrações da conta', e); } }
      A.evt.emit('prefs:aplicadas');
    } finally { aplicandoPrefs = false; }
  };
  A.evt.on('hub:prefs-mudou', (m) => { if (!m || m.t > (+A.store.ler(chavePrefs(), '0') || 0)) API.puxarPrefs(); });
  A.evt.on('hub:eu', (m) => {
    if (Date.now() - puxouEm <= 5000) return;
    // (1.0.2) a conexão já diz a hora das configurações da conta: se este aparelho já tem essa (ou uma mais nova), não precisa baixar
    if (m && m.pt > 0 && API.eu && A.store.ler('aero-prefs-conta', '') === API.eu.codigo && m.pt <= (+A.store.ler(chavePrefs(), '0') || 0)) return;
    API.puxarPrefs();
  }); // (1.0.2) acabou de baixar ao entrar: não baixa de novo
})();
