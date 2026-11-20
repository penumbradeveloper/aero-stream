// Aero Stream - cuidados automáticos com o sistema: atualização do app (todos os aparelhos) e o bug do kernel que trava placas AMD Polaris.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const naSala = () => !!(A.sala && A.sala.ativa);
  const desktop = () => !!(A.plat.desktop && window.aero);

  // ---------- atualização automática ----------
  // (0.5.9-6) A cada minuto o app pergunta ao servidor se há versão nova. Havendo, PERGUNTA à pessoa antes de atualizar ("Atualizar agora" /
  // "Depois"). Aceitou: o app do PC baixa a versão nova, confere a ASSINATURA e cada arquivo e reinicia; o site e o celular só recarregam.
  // Em Configurações > Atualizações dá para desligar a verificação automática e verificar na hora.
  // "0.5.7-1" = 0.5.7.1 (correção de uma versão)
  const novaMaior = (a, b) => { const p = (v) => String(v).replace('-', '.').split('.').map((n) => parseInt(n, 10) || 0); const x = p(a), y = p(b); for (let i = 0; i < 4; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  const U = () => A.ui;
  const ADIAR_MS = 3 * 3600000; // "Depois": pergunta de novo em 3 horas (ou quando abrir o app de novo)
  let perguntando = false, adiada = { versao: '', ate: 0 }, avisouInstalador = '', ultima = null, origem = null;
  // (1.0.2) versões de teste: quem tem permissão (testers, supporters e o desenvolvedor) pode receber as versões novas do app do PC antes
  // de todo mundo. É só um endereço com os pacotes assinados (sem contas): a conta, os amigos e as conversas continuam no servidor de
  // sempre. O app pergunta aos dois e fica com a versão mais nova que respondeu certo; se o de teste cair ou estiver atrás, vale o normal
  A.TESTE_ATUALIZACAO = 'https://canal-de-teste.exemplo.invalid';
  const podeTeste = () => { const eu = A.api && A.api.eu; if (!eu) return false; const sl = Array.isArray(eu.sl) ? eu.sl : []; return eu.cargo === 'dev' || sl.includes('dev') || sl.includes('tester') || sl.includes('supporter'); };
  // No site e no celular, a versão de teste fica em /teste/app/ do MESMO endereço do site (o site busca no canal de teste e, se ele não
  // responder, entrega a versão normal): a conta, o tema e o que fica guardado no aparelho continuam os mesmos
  const web = () => !desktop() && location.protocol === 'https:' && /^\/(teste\/)?app\//.test(location.pathname);
  const emTeste = () => web() && location.pathname.startsWith('/teste/');
  const ligouTeste = () => !!(A.cfg.v.atualizar && A.cfg.v.atualizar.teste);
  const testeLigado = () => (desktop() || web()) && podeTeste() && ligouTeste();
  const testeWeb = () => web() && ligouTeste() && (!(A.api && A.api.eu) || podeTeste()); // antes de entrar na conta vale o que ficou ligado
  const lerVersao = async (u) => { try { const v = await (await fetch(u, { cache: 'no-store' })).json(); return v && typeof v.versao === 'string' ? v.versao : ''; } catch (e) { return ''; } };
  const irPara = (dir) => location.replace(location.origin + dir + location.search + location.hash);
  let destinoWeb = null;

  function quandoSairDaSala(fn) { if (!naSala()) { fn(); return; } const off = A.evt.on('sala:fechada', () => { off(); setTimeout(fn, 800); }); }
  const reiniciar = () => { if (desktop() && window.aero.reiniciar) window.aero.reiniciar(); else location.reload(); };

  // pergunta; sim = baixa (PC), confere e reinicia
  async function perguntar(versao, { pronta } = {}) {
    if (perguntando) return; perguntando = true;
    const sim = await U().confirmar(h('div', { class: 'col', estilo: { gap: '8px' } },
      h('p', { estilo: { margin: 0, 'font-size': '17px' } }, T('A versão ' + versao + ' do Aero está disponível.', 'Version ' + versao + ' of Aero is available.')),
      h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('Você está na ', 'You are on ') + A.versao + '. ' + (naSala() ? T('Se aceitar, a atualização é instalada quando você sair da sala.', 'If you accept, the update installs when you leave the room.') : T('O app reinicia sozinho depois de atualizar (leva alguns segundos).', 'The app restarts by itself after updating (takes a few seconds).')))),
    { titulo: T('Atualização disponível', 'Update available'), sim: T('Atualizar agora', 'Update now'), nao: T('Depois', 'Later') });
    perguntando = false;
    if (!sim) { adiada = { versao, ate: Date.now() + ADIAR_MS }; return; }
    quandoSairDaSala(() => instalar(versao, pronta));
  }
  async function instalar(versao, pronta) {
    if (!desktop() || !window.aero.atualizacao) { if (destinoWeb) irPara(destinoWeb); else reiniciar(); return; }
    const t = pronta ? null : U().toast(T('Baixando a versão ' + versao + '...', 'Downloading version ' + versao + '...'), { ms: 0 });
    const o = origem || { base: A.api.servidor || location.origin, canal: 'normal' };
    const r = pronta ? { pronta: true } : await window.aero.atualizacao.verificar(o.base, o.canal).catch((e) => ({ erro: String(e.message || e) }));
    if (t) t.fechar();
    if (r && (r.pronta || r.nada)) { U().toast(T('Atualizado! Reiniciando o Aero...', 'Updated! Restarting Aero...'), { tipo: 'ok', ms: 2500 }); setTimeout(reiniciar, 1200); }
    else U().toast(T('Não consegui atualizar agora: ', 'Could not update now: ') + ((r && r.erro) || '?'), { tipo: 'erro', ms: 9000 });
  }

  // devolve { nova: versão | null, erro, instalador } (a tela de entrar e as Configurações mostram isso). manual: pergunta mesmo se adiada.
  async function verificarAtualizacao({ manual = false } = {}) {
    const base = A.api.servidor || location.origin;
    if (!/^https?:/.test(base)) return { nova: null };
    try {
      let r;
      if (desktop() && window.aero.atualizacao) {
        if (window.aero.atualizacao.checar && testeLigado()) {
          // os dois canais ao mesmo tempo: fica a versão mais nova que respondeu certo (assinatura conferida pelo app do PC)
          const [n, t] = await Promise.all([window.aero.atualizacao.checar(base).catch((e) => ({ erro: String(e.message || e) })), window.aero.atualizacao.checar(A.TESTE_ATUALIZACAO).catch((e) => ({ erro: String(e.message || e) }))]);
          if (t && t.erro) A.log.aviso('versões de teste: sem resposta, usando o canal normal', t.erro);
          const usarTeste = t && t.ok && t.versao && (!(n && n.ok && n.versao) || novaMaior(t.versao, n.versao));
          r = usarTeste ? t : n; origem = usarTeste ? { base: A.TESTE_ATUALIZACAO, canal: 'teste' } : { base, canal: 'normal' };
        } else if (window.aero.atualizacao.checar) { r = await window.aero.atualizacao.checar(base); origem = { base, canal: 'normal' }; }
        else { const x = await window.aero.atualizacao.verificar(base); r = x && x.pronta ? { ok: true, nova: true, pronta: true, versao: x.versao } : x && x.precisaInstalador ? { ok: true, nova: true, precisaInstalador: true, versao: x.versao } : { ok: !(x && x.erro), erro: x && x.erro }; }
        if (r && r.erro) { A.log.aviso('atualização', r.erro); return (ultima = { nova: null, erro: r.erro }); }
      } else if (web()) {
        // (1.0.2) site/celular no endereço do site: a versão normal (/app/) ou, para quem ligou as versões de teste, a de teste (/teste/app/)
        // se ela for mais nova. Canal de teste fora do ar ou atrás: fica a normal
        const pv = await lerVersao(location.origin + '/versao.json');
        if (!pv) throw new Error('versao.json');
        let alvo = { v: pv, dir: '/app/' };
        if (testeWeb()) { const tv = await lerVersao(location.origin + '/teste/versao.json'); if (tv && novaMaior(tv, pv)) alvo = { v: tv, dir: '/teste/app/' }; else if (!tv) A.log.aviso('versões de teste: sem resposta, usando a versão normal'); }
        destinoWeb = alvo.dir !== (emTeste() ? '/teste/app/' : '/app/') ? alvo.dir : null;
        r = { ok: true, nova: novaMaior(alvo.v, A.versao), versao: alvo.v };
      } else {
        // site/celular: pergunta ao PRÓPRIO endereço de onde o app veio (workers.dev ou pages.dev). Perguntar a outro poderia dizer
        // "versão nova" antes de este endereço recebê-la, e o app recarregaria sem parar.
        const v = await (await fetch(location.origin + '/versao.json', { cache: 'no-store' })).json();
        r = { ok: true, nova: !!(v && v.versao && novaMaior(v.versao, A.versao)), versao: v && v.versao };
      }
      if (!r || !r.nova) return (ultima = { nova: null });
      if (r.precisaInstalador) {
        if (manual || avisouInstalador !== r.versao) { avisouInstalador = r.versao; U().toast(T('A versão ' + r.versao + ' precisa de um instalador novo do Aero (o "motor" mudou). Baixe no site.', 'Version ' + r.versao + ' needs a new Aero installer (the engine changed). Download it from the website.'), { ms: 12000 }); }
        return (ultima = { nova: r.versao, instalador: true });
      }
      if (manual || !(adiada.versao === r.versao && Date.now() < adiada.ate)) perguntar(r.versao, { pronta: r.pronta });
      return (ultima = { nova: r.versao });
    } catch (e) { A.log.aviso('atualização: sem resposta do servidor', e); return (ultima = { nova: null, erro: String(e.message || e) }); }
  }
  const auto = () => !A.cfg.v.atualizar || A.cfg.v.atualizar.auto !== false;

  // ---------- bug do kernel (VCE 3) ----------
  const D = (A.driver = { estado: null, preparando: false, progresso: null });
  D.perigo = () => !!(D.estado && D.estado.temBug && !D.estado.corrigido);

  function explicar() {
    return h('div', { class: 'col', estilo: { gap: '10px' } },
      h('p', { estilo: { margin: 0 } }, T('O kernel do seu Linux tem um bug conhecido que TRAVA a placa de vídeo ao codificar a transmissão (o PC precisa ser reiniciado). Ele afeta placas AMD Polaris, como a sua.', 'Your Linux kernel has a known bug that FREEZES the graphics card while encoding the stream (the PC must be restarted). It affects AMD Polaris cards like yours.')),
      h('p', { class: 'suave peq', estilo: { margin: 0 } }, T('O Aero preparou o driver com a correção oficial da AMD (uma linha, "Fix VCE 3 ring align_mask") para o seu kernel. O original do sistema fica guardado; desfazer é um clique em Configurações > Placa de vídeo.', 'Aero prepared the driver with AMD\'s official fix (one line, "Fix VCE 3 ring align_mask") for your kernel. The system original is kept; undoing is one click in Settings > Graphics card.')));
  }

  async function oferecerInstalar() {
    const corpo = h('div', { class: 'col', estilo: { gap: '14px' } }, explicar(),
      h('p', { class: 'peq', estilo: { margin: 0 } }, T('Para instalar, o sistema vai pedir a sua senha UMA vez (a janela de senha é do próprio Linux, o Aero não vê a senha).', 'To install, the system will ask for your password ONCE (the password window belongs to Linux itself; Aero never sees the password).')));
    const ok = await U().confirmar(corpo, { titulo: T('Corrigir o driver da placa de vídeo', 'Fix the graphics card driver'), sim: T('Instalar agora', 'Install now'), nao: T('Depois', 'Later') });
    if (!ok) return;
    const carregando = U().toast(T('Instalando a correção (digite a senha na janela do sistema)...', 'Installing the fix (type your password in the system window)...'), { ms: 0 });
    const r = await window.aero.vce3.instalar().catch((e) => ({ ok: false, erro: String(e.message || e) }));
    carregando.fechar();
    if (r.ok) pedirReiniciarPC();
    else if (r.cancelado) U().toast(T('A senha não foi digitada. Quando quiser, vá em Configurações > Placa de vídeo > Corrigir driver.', 'The password was not entered. Whenever you want, go to Settings > Graphics card > Fix driver.'), { ms: 8000 });
    else U().toast(T('Não consegui instalar: ', 'Could not install: ') + r.erro, { tipo: 'erro', ms: 12000 });
    verificarDriver({ silencioso: true });
  }

  async function pedirReiniciarPC() {
    const ok = await U().confirmar(T('A correção foi instalada. Ela passa a valer quando o computador reiniciar.', 'The fix was installed. It takes effect after the computer restarts.'), { titulo: T('Reiniciar o computador', 'Restart the computer'), sim: T('Reiniciar agora', 'Restart now'), nao: T('Depois', 'Later') });
    if (ok) window.aero.reiniciarPC();
  }

  async function preparar({ depois = oferecerInstalar } = {}) {
    if (D.preparando) return;
    D.preparando = true; A.evt.emit('driver', D);
    const off = window.aero.vce3.aoProgresso((p) => { D.progresso = p; A.evt.emit('driver', D); });
    const r = await window.aero.vce3.preparar().catch((e) => ({ ok: false, erro: String(e.message || e) }));
    off(); D.preparando = false; D.progresso = null;
    D.ultimoErro = r.ok ? '' : r.erro;
    await verificarDriver({ silencioso: true });
    if (r.ok && !r.nada && depois) depois();
    else if (!r.ok) { A.log.aviso('driver vce3', r.erro); U().toast(T('Não consegui preparar a correção do driver da placa: ', 'Could not prepare the graphics driver fix: ') + r.erro, { tipo: 'erro', ms: 12000 }); }
  }

  // Ao abrir (em silêncio): só aparece algo se o PC tiver o bug e ainda não estiver corrigido
  async function verificarDriver({ silencioso = true } = {}) {
    if (!desktop() || !window.aero.vce3) return null;
    let d; try { d = await window.aero.vce3.diagnosticar(); } catch (e) { return null; }
    D.estado = d; A.evt.emit('driver', D);
    if (silencioso) return d;
    if (!d.temBug || d.corrigido) return d;
    if (d.reiniciarPendente) U().toast(T('A correção do driver da placa já está instalada: reinicie o computador para ela valer.', 'The graphics driver fix is installed: restart the computer for it to take effect.'), { ms: 0, acoes: [{ texto: T('Reiniciar computador', 'Restart computer'), onclick: () => window.aero.reiniciarPC() }, { texto: T('Depois', 'Later'), tipo: 'sec' }] });
    else if (d.pronto) oferecerInstalar();
    else if (d.podeCorrigir) {
      U().toast(T('Encontrei um bug no driver da sua placa de vídeo que pode travar o PC ao transmitir. Estou preparando a correção em segundo plano (alguns minutos).', 'Found a bug in your graphics driver that can freeze the PC while streaming. Preparing the fix in the background (a few minutes).'), { ms: 9000 });
      preparar();
    } else {
      const falta = (d.faltando || []).map((x) => (x === 'headers' ? T('os headers do kernel (ex.: linux-cachyos-lts-headers)', 'the kernel headers (e.g. linux-cachyos-lts-headers)') : x)).join(', ');
      U().toast(h('span', {}, T('O kernel do seu Linux tem um bug que pode travar a placa de vídeo ao transmitir. ', 'Your Linux kernel has a bug that can freeze the graphics card while streaming. '), d.erroFonte || (T('Para o Aero corrigir sozinho, instale: ', 'For Aero to fix it by itself, install: ') + falta)), { ms: 0, tipo: 'erro', acoes: [{ texto: T('Entendi', 'Got it'), tipo: 'sec' }] });
    }
    return d;
  }
  D.verificar = verificarDriver; D.preparar = () => preparar(); D.instalar = oferecerInstalar; D.reiniciarPC = pedirReiniciarPC;
  D.desfazer = async () => { const r = await window.aero.vce3.desfazer().catch((e) => ({ ok: false, erro: String(e.message || e) })); if (r.ok) pedirReiniciarPC(); else if (!r.cancelado) U().toast(r.erro, { tipo: 'erro' }); verificarDriver({ silencioso: true }); };

  A.sistema = {
    iniciar() {
      setTimeout(() => auto() && verificarAtualizacao(), 6000);
      setInterval(() => { if (auto() && !document.hidden) verificarAtualizacao(); }, 60000); // (0.5.9-6) a cada minuto
      addEventListener('online', () => setTimeout(() => auto() && verificarAtualizacao(), 3000));
      if (desktop() && window.aero.vce3) setTimeout(() => verificarDriver({ silencioso: false }), 9000);
      // (1.0.2) site/celular com as versões de teste ligadas: ao abrir em /app/ (o celular sempre abre lá), vai direto para a de teste se ela
      // for mais nova. Sem perguntar: quem ligou já escolheu, e o app acabou de abrir
      if (testeWeb() && !emTeste()) Promise.all([lerVersao(location.origin + '/versao.json'), lerVersao(location.origin + '/teste/versao.json')])
        .then(([p, t]) => { if (p && t && novaMaior(t, p) && novaMaior(t, A.versao) && !naSala()) irPara('/teste/app/'); });
    },
    verificarAtualizacao, ultimaVerificacao: () => ultima,
    podeTeste, testeLigado, temCanalTeste: () => desktop() || web(),
    // (1.0.2) desligou as versões de teste: se a que está rodando veio do canal de teste e é mais nova que a normal, oferece voltar já
    async sairDoTeste() {
      if (web()) {
        if (!emTeste()) return;
        const ok = await U().confirmar(T('Você está numa versão de teste (' + A.versao + '). Quer voltar para a versão normal agora? O Aero recarrega.', 'You are on a test version (' + A.versao + '). Go back to the regular version now? Aero will reload.'), { titulo: T('Versões de teste', 'Test versions'), sim: T('Voltar agora', 'Go back now'), nao: T('Depois', 'Later') });
        if (ok) quandoSairDaSala(() => irPara('/app/'));
        return;
      }
      if (!desktop() || !window.aero.atualizacao || !window.aero.atualizacao.normal) return;
      let canal = 'normal'; try { canal = window.aero.atualizacao.canal ? await window.aero.atualizacao.canal() : 'normal'; } catch (e) { /* ok */ }
      if (canal !== 'teste') return;
      const ok = await U().confirmar(T('Você está numa versão de teste (' + A.versao + '). Quer voltar para a versão normal agora? O Aero reinicia.', 'You are on a test version (' + A.versao + '). Go back to the regular version now? Aero will restart.'), { titulo: T('Versões de teste', 'Test versions'), sim: T('Voltar agora', 'Go back now'), nao: T('Depois', 'Later') });
      if (!ok) return;
      quandoSairDaSala(async () => { try { await window.aero.atualizacao.normal(); } catch (e) { /* ok */ } reiniciar(); });
    },
  };

  // ---------- selo de não lidas (0.6.0): bolhinha de vidro com o número no ícone da bandeja e da barra de tarefas ----------
  // 1 a 9 e "9+"; a bolha fica inteira dentro do ícone (no canto de baixo à direita), nunca atravessando a borda
  if (window.aero && window.aero.selo) {
    let base = null, ultimo = -1, t = 0;
    const bolha = (g, cx, cy, r, n) => {
      const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.35, 'rgba(150,220,255,.75)'); gr.addColorStop(1, 'rgba(30,130,210,.82)');
      g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fillStyle = gr; g.fill();
      g.lineWidth = Math.max(1, r * 0.12); g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
      g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.32, r * 0.18, -0.6, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
      const txt = n > 9 ? '9+' : String(n);
      g.font = `800 ${Math.round(r * (txt.length > 1 ? 1.2 : 1.3))}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = Math.max(2, r * (txt.length > 1 ? 0.14 : 0.22)); g.strokeStyle = 'rgba(5,40,80,.85)'; // "9+": contorno mais fino, para não embolar g.strokeText(txt, cx, cy + r * 0.06);
      g.fillStyle = '#fff'; g.fillText(txt, cx, cy + r * 0.06);
    };
    // o quadrado justo em volta do desenho (só o vazio sai), guardado por imagem
    const recortes = new WeakMap();
    const recorte = (img) => {
      if (recortes.has(img)) return recortes.get(img);
      const w = img.naturalWidth, h = img.naturalHeight; let q = { x: 0, y: 0, lado: Math.min(w, h) };
      try {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 >= 0) {
          const lado = Math.min(Math.max(w, h), Math.max(x1 - x0, y1 - y0) + 1 + Math.round(Math.max(w, h) * 0.01));
          const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
          if (lado < Math.max(w, h) * 0.97) q = { x: Math.round(Math.min(Math.max(0, cx - lado / 2), w - lado)), y: Math.round(Math.min(Math.max(0, cy - lado / 2), h - lado)), lado };
        }
      } catch (e) { /* imagem de fora: vai inteira */ }
      recortes.set(img, q); return q;
    };
    const desenhar = async (n) => {
      const src = (A.extras && A.extras.iconeAtual) || 'icon-512.png'; if (!base || base.dataset.src !== src) base = await new Promise((ok) => { const i = new Image(); i.dataset.src = src; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }); // (1.0.0) o ícone escolhido também leva o selo
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
      if (base) g.drawImage(base, 0, 0, 64, 64);
      bolha(g, 45, 45, 17, n); // 45 + 17 = 62: dentro dos 64
      const so = document.createElement('canvas'); so.width = so.height = 32; bolha(so.getContext('2d'), 16, 16, 15, n);
      // (1.0.0) Linux: o ícone da barra de tarefas também leva a bolha (como na bandeja), maior para ficar nítido
      // (1.0.0) sem a sobra transparente em volta (como o app do PC faz com o ícone sem bolha), para o Aero ficar do tamanho dos outros
      const jn = document.createElement('canvas'); jn.width = jn.height = 128; const gj = jn.getContext('2d');
      if (base) {
        const w = base.naturalWidth, padrao = /icon-512\.png$/.test(base.dataset.src || '');
        const q = padrao ? { x: w * 57 / 512, y: w * 52 / 512, lado: w * 400 / 512 } : recorte(base); // o de sempre: o mesmo corte justo do app do PC
        gj.drawImage(base, q.x, q.y, q.lado, q.lado, 0, 0, 128, 128);
      }
      bolha(gj, 97, 97, 29, n); // 97 + 29 = 126: dentro dos 128; legível sem cobrir o ícone
      return { bandeja: cv.toDataURL('image/png'), sobre: so.toDataURL('image/png'), janela: jn.toDataURL('image/png') };
    };
    const atualizar = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const n = (A.talk && A.talk.naoLidas) || 0, chave = n > 9 ? 10 : n;
        if (chave === ultimo) return; ultimo = chave;
        try { await window.aero.selo(n ? { n, ...(await desenhar(n)) } : { n: 0 }); } catch (e) { /* ok */ }
      }, 250);
    };
    A.evt.on('talk:naoLidas', atualizar); A.evt.on('talk:lista', atualizar);
  }
})();
