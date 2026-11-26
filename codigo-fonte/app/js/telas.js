// Aero Stream - telas: roteador com transições, splash estilo console, introdução, login e home.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, U = A.ui, T = A.T;
  const TELAS = (A.telas = {});
  let atual = null, serie = 0;

  // ---------- roteador: cada troca de tela tem a sua transição (e o seu som) ----------
  // telas que só existem para quem tem conta: um convidado (entrou só com o código da sala) nunca chega nelas, venha de onde vier
  // (botão de menu, controle, janelinha, atalho). Ele fica na sala; sem sala, volta para a entrada.
  const SO_CONTA = new Set(['home', 'controles']);
  U.ir = async (nome, dados = {}, opts = {}) => {
    if (SO_CONTA.has(nome) && !(A.api && A.api.eu && A.api.token)) {
      if (A.sala && A.sala.ativa) { if (U.pip && U.pip.visivel) U.pip.esconder(); nome = 'sala'; dados = {}; }
      else { nome = 'login'; dados = A.loginDados ? A.loginDados() : {}; }
    }
    const fab = TELAS[nome];
    if (!fab) throw new Error('tela desconhecida: ' + nome);
    const id = ++serie;
    const el = h('div', { class: 'tela ' + nome, dados: { tela: nome } });
    const r = (await fab(el, dados)) || {};
    if (id !== serie) { r.limpar && r.limpar(); return null; } // outra troca começou enquanto esta carregava
    const palco = document.getElementById('palco');
    palco.append(el); delete document.documentElement.dataset.abrindo;
    void el.offsetWidth; // força o navegador a registrar o estado inicial antes de animar
    const anterior = atual;
    atual = { nome, el, dados, limpar: r.limpar, voltar: r.voltar };
    if (anterior) {
      anterior.el.classList.remove('ativa'); anterior.el.classList.add('sai');
      setTimeout(() => { try { anterior.limpar && anterior.limpar(); } catch (e) { A.log.erro('limpar tela', e); } anterior.el.remove(); }, 280);
    }
    el.classList.add('ativa');
    if (opts.zoom) el.classList.add('zoom-in');
    A.evt.emit('tela', nome);
    return atual;
  };
  U.telaAtual = () => atual;
  U.voltar = () => { if (atual && atual.voltar) { atual.voltar(); return true; } return false; };
  U.reconstruir = () => { if (atual) { const { nome, dados } = atual; U.ir(nome, dados); } };
  A.evt.on('idioma', () => U.reconstruir());

  // ---------- controles: tela própria (testar, remapear, calibrar). Enquanto remapeia, o resto do app ignora o controle ----------
  TELAS.controles = (el, dados) => A.controles.tela(el, dados);

  // ---------- abertura (0.7.9): como a de um console. Fundo escuro nas cores da pessoa, a logo se monta, o cometa dá a volta e pousa, o nome
  // aparece e o fundo dela surge desfocado, esperando começar. Só "transform" e "opacity" animam, cada peça na sua camada: depois de desenhadas
  // uma vez, quem move é a placa de vídeo, sem redesenhar nada. As letras do nome são traços desenhados aqui (nenhuma fonte para baixar).
  const camadaLogo = (id, defs, corpo) => `<svg viewBox="0 0 1024 1024" aria-hidden="true"><defs>${defs}</defs>${corpo}</svg>`;
  const LOGO = {
    tras: camadaLogo('t', '<linearGradient id="sp-at" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bff4ff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#bff4ff" stop-opacity=".55"/></linearGradient><clipPath id="sp-ct"><rect width="1024" height="520"/></clipPath>',
      '<g transform="rotate(-16 512 520)"><ellipse cx="512" cy="520" rx="462" ry="112" fill="none" stroke="url(#sp-at)" stroke-width="26" clip-path="url(#sp-ct)"/></g>'),
    bola: camadaLogo('b', '<radialGradient id="sp-e" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#e9fdff"/><stop offset=".28" stop-color="#8ff0ee"/><stop offset=".62" stop-color="#1fb8d8"/><stop offset="1" stop-color="#0a6fb0"/></radialGradient><radialGradient id="sp-l" cx="50%" cy="104%" r="62%"><stop offset="0" stop-color="#b8ffd8" stop-opacity=".85"/><stop offset="1" stop-color="#b8ffd8" stop-opacity="0"/></radialGradient><linearGradient id="sp-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient><clipPath id="sp-cb"><circle cx="512" cy="520" r="300"/></clipPath>',
      '<circle cx="512" cy="520" r="300" fill="url(#sp-e)"/><g clip-path="url(#sp-cb)"><circle cx="512" cy="520" r="300" fill="url(#sp-l)"/><ellipse cx="424" cy="350" rx="220" ry="140" fill="url(#sp-r)" transform="rotate(-24 424 350)" opacity=".8"/></g><circle cx="512" cy="520" r="298" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="7"/>'),
    play: camadaLogo('p', '<linearGradient id="sp-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9f6ff"/></linearGradient>',
      '<path d="M400 730L512 378L624 730" fill="none" stroke="url(#sp-p)" stroke-width="70" stroke-linecap="round" stroke-linejoin="round"/>'),
    frente: camadaLogo('f', '<linearGradient id="sp-af" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d6fff3"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#c9f1ff"/></linearGradient><clipPath id="sp-cf"><rect y="520" width="1024" height="504"/></clipPath>',
      '<g transform="rotate(-16 512 520)"><ellipse cx="512" cy="520" rx="462" ry="112" fill="none" stroke="url(#sp-af)" stroke-width="26" stroke-linecap="round" clip-path="url(#sp-cf)"/></g>'),
  };
  // as letras do nome, em traços (caixa de 60 x 80)
  const LETRAS = {
    A: 'M7 74 30 8l23 66M17 52h26', E: 'M52 8H12v64h40M12 40h32', R: 'M12 74V8h24a17 17 0 0 1 0 34H12M35 42l18 32',
    O: 'M30 8c15 0 24 12 24 32S45 72 30 72 6 60 6 40 15 8 30 8Z', S: 'M52 18C48 11 40 8 30 8 17 8 9 14 9 23c0 21 44 11 44 34 0 9-10 15-23 15-11 0-20-4-25-12',
    T: 'M5 8h50M30 8v66', M: 'M8 74V8l22 42L52 8v66',
  };
  const NOME = 'AERO'; const MEIO = (NOME.replace(/ /g, '').length - 1) / 2;
  const letraSvg = (l, i) => `<svg class="sp-letra" style="--i:${Math.abs(i - MEIO)};--c:${i - MEIO}" viewBox="0 0 60 80" aria-hidden="true"><path d="${LETRAS[l]}"/></svg>`;
  // as três bolhinhas da logo (em relação ao centro da bola, na escala de 1024) e o tamanho de cada uma
  const BOLHINHAS = [{ x: 300, y: -306, r: 58 }, { x: 394, y: -182, r: 32 }, { x: 214, y: -396, r: 22 }];

  // ---------- splash ----------
  TELAS.splash = (el, dados) => {
    el.classList.add('splash');
    const raiz = document.documentElement, modoAnim = raiz.dataset.anim;
    raiz.dataset.splash = '1';
    const palco = h('div', { class: 'esfera' });
    const camada = (nome) => { const c = h('div', { class: 'sp-camada sp-' + nome }); c.innerHTML = LOGO[nome]; return c; }; // conteúdo fixo do código, nunca de usuários
    const com = BOLHINHAS.map((c, i) => h('i', { class: 'sp-com', estilo: { '--r': c.r, '--x': c.x, '--y': c.y, '--o': i } }));
    // O cometa é o anel da logo: uma volta de luz com rabo que gira em volta da bola, de frente, e tomba até o lugar dele. São só três transforms sobre um
    // desenho pronto (o rabo é um gradiente que gira, nada é redesenhado), então roda na placa de vídeo mesmo com a página ainda carregando. Metade
    // do anel passa atrás da bola e metade na frente, como na logo.
    const orbita = (lado) => h('div', { class: 'sp-orbita sp-o-' + lado }, h('div', { class: 'sp-metade' }, h('div', { class: 'sp-plano' }, h('div', { class: 'sp-giro' }, h('i', { class: 'sp-rabo' }), h('i', { class: 'sp-rabo sp-rabo-f' }), h('i', { class: 'sp-cab' })))));
    const orbitas = [orbita('tras'), orbita('frente')];
    palco.append(camada('tras'), orbitas[0], camada('bola'), h('div', { class: 'sp-corte' }, h('i', { class: 'sp-brilho' })), camada('play'), camada('frente'), orbitas[1], h('i', { class: 'sp-onda' }), h('i', { class: 'sp-flash' }), ...com);
    const nome = h('h1', { class: 'splash-titulo', 'aria-label': 'Aero' });
    let indice = 0;
    const palavras = NOME.split(' ').map((p) => `<span class="sp-palavra">${[...p].map((l) => letraSvg(l, indice++)).join('')}</span>`).join(''); // idem: texto fixo
    nome.innerHTML = `<span class="sp-nome">${palavras}</span><span class="sp-nome sp-tinta">${palavras}</span>`; // o nome nasce branco no escuro e passa para a cor do tema trocando uma cópia pela outra: animar a cor redesenhava as letras a cada quadro
    const dica = h('p', { class: 'splash-dica' });
    const montarDica = () => {
      dica.textContent = '';
      if (A.plat.toque && !A.pad.conectado()) dica.append(T('Toque na tela para começar', 'Tap the screen to start'));
      else if (A.pad.conectado()) dica.append(T('Aperte ', 'Press '), h('kbd', {}, 'A'), T(' para começar', ' to start'));
      else dica.append(T('Aperte ', 'Press '), h('kbd', {}, T('ESPAÇO', 'SPACE')), T(' para começar', ' to start'));
    };
    montarDica();
    const luz = h('i', { class: 'sp-luz' });
    el.append(h('i', { class: 'sp-escuro' }), luz, h('i', { class: 'sp-pulso' }), palco, nome, dica, h('div', { class: 'splash-cred' }, T('Criado por ', 'Created by '), h('b', {}, A.autor), ' · v' + A.versao));

    orbitas[0].addEventListener('animationend', (e) => { if (e.target === orbitas[0]) orbitas.forEach((o) => o.remove()); }); // acabou: devolve a memória da placa (o fim do giro, lá dentro, sobe até aqui e não conta)

    // Só dá para começar depois que a abertura termina. Antes disso, cliques, ESPAÇO e o botão A do controle são ignorados: sem isso um toque
    // sem querer pulava a animação inteira.
    let feito = false, pronto = false;
    const liberar = () => { if (pronto) return; pronto = true; el.classList.add('pronto'); };
    let reserva = 0;
    // (0.9.0) no navegador o som só pode tocar depois de um clique ou tecla: a abertura espera parada ("Clique para começar") e roda
    // com o som dela no primeiro toque. Antes ela rodava muda e só o som de entrar tocava
    const esperarToque = !A.plat.desktop && !A.plat.apk && modoAnim !== 'nenhuma' && !(navigator.userActivation && navigator.userActivation.hasBeenActive);
    const comecarAnim = () => {
      if (modoAnim === 'nenhuma') reserva = setTimeout(liberar, 250);
      else {
        dica.addEventListener('animationend', (e) => { if (e.animationName === 'surgir' || e.animationName === 'esmaecer') liberar(); });
        reserva = setTimeout(liberar, modoAnim === 'reduzida' ? 1000 : 3600); // garantia: se o navegador não avisar o fim da animação (aba em segundo plano, por exemplo)
      }
    };
    let portao = null;
    if (esperarToque) {
      el.classList.add('espera');
      portao = h('button', { type: 'button', class: 'sp-portao' }, A.icone('play', 22), h('span', {}, A.plat.toque ? T('Toque para começar', 'Tap to start') : T('Clique para começar', 'Click to start')));
      el.append(portao);
      const abrirPortao = (e) => {
        if (e && e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        if (e && e.type === 'keydown' && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); A.som.destravar(); pular(); return; } // (1.0.2) ESC: entra direto, sem a abertura
        removeEventListener('pointerdown', abrirPortao, true); removeEventListener('keydown', abrirPortao, true);
        if (e) { e.preventDefault(); e.stopPropagation(); }
        A.som.destravar(); portao.classList.add('some'); setTimeout(() => portao.remove(), 400);
        // as animações recomeçam do zero agora (pausadas no primeiro quadro até aqui), junto com o som
        for (const an of el.getAnimations({ subtree: true })) { try { an.currentTime = 0; } catch (_) { /* ok */ } }
        el.classList.remove('espera'); comecarAnim();
        requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelado && (modoAnim === 'total' || !modoAnim)) sincronizar(); }));
      };
      addEventListener('pointerdown', abrirPortao, true); addEventListener('keydown', abrirPortao, true);
      el._portao = abrirPortao;
    } else comecarAnim();
    const conectar = () => {
      if (feito || !pronto) return; feito = true;
      A.som.destravar(); A.som.tocar('iniciar');
      el.classList.add('entrando'); raiz.dataset.splash = 'saindo';
      setTimeout(() => dados.continuar && dados.continuar(), 620);
    };
    // (1.0.2) ESC pula a abertura: a animação vai direto para o fim, o som dela para e o app já entra
    const pular = () => {
      if (feito) return;
      if (portao) { removeEventListener('pointerdown', el._portao, true); removeEventListener('keydown', el._portao, true); portao.remove(); el.classList.remove('espera'); }
      for (const an of el.getAnimations({ subtree: true })) { try { an.finish(); } catch (_) { /* animação sem fim (repete): fica como está */ } }
      cancelado = true; clearTimeout(reserva); try { A.som.cortar(); } catch (_) { /* ok */ }
      liberar(); conectar();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); if (!e.repeat) pular(); return; }
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) conectar(); }
    };
    document.addEventListener('keydown', tecla);
    el.addEventListener('click', conectar);
    const off = [A.evt.on('pad:a', conectar), A.evt.on('pad:conectou', montarDica)];
    // A abertura tem som, agendado no relógio do áudio no instante em que a animação realmente começa
    let cancelado = false;
    const sincronizar = (tentativa = 0) => {
      if (cancelado) return;
      const anim = luz.getAnimations()[0];
      if (!anim || anim.startTime == null) { if (tentativa < 12) requestAnimationFrame(() => sincronizar(tentativa + 1)); return; }
      A.som.agendar('abertura', anim.startTime);
    };
    if (!esperarToque) requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelado) return;
      if (modoAnim === 'total' || !modoAnim) sincronizar();
    }));
    return { limpar() { cancelado = true; clearTimeout(reserva); if (el._portao) { removeEventListener('pointerdown', el._portao, true); removeEventListener('keydown', el._portao, true); } delete raiz.dataset.splash; document.removeEventListener('keydown', tecla); off.forEach((f) => f()); }, voltar: conectar };
  };

  // ---------- introdução (primeira vez): idioma -> modo -> versão visual ----------
  TELAS.intro = (el, dados) => {
    const caixa = h('div', { class: 'col', estilo: { width: 'min(760px, 94vw)', margin: 'auto', padding: '24px 0', gap: '18px', 'align-items': 'center' } });
    el.append(caixa);
    const tile = (icone, titulo, desc, onclick) => U.paralax(h('button', { class: 'tile vidro', type: 'button', onclick, estilo: { 'text-align': 'left', border: '0', color: 'inherit', width: '100%' } },
      h('div', { class: 'linha', estilo: { gap: '16px' } }, h('div', { class: 'btn redondo', estilo: { width: '56px', height: '56px', 'pointer-events': 'none' } }, A.icone(icone, 28)),
        h('div', { class: 'cresce' }, h('h3', { estilo: { 'font-size': '20px' } }, titulo), desc ? h('div', { class: 'suave peq', estilo: { 'margin-top': '4px' } }, desc) : null))));
    const passo = (titulo, sub, tiles) => {
      caixa.textContent = '';
      caixa.append(h('h1', { estilo: { 'font-size': '34px', 'text-align': 'center' } }, titulo), sub ? h('p', { class: 'suave', estilo: { margin: '0', 'text-align': 'center' } }, sub) : null,
        h('div', { class: 'col', estilo: { width: '100%', animation: 'deslizarD .5s var(--suave-e) both' } }, tiles));
    };
    const fim = () => { A.cfg.v.introFeita = true; A.cfg.salvar(); dados.continuar(); };
    const pVisual = () => {
      passo(T('Qual versão você prefere?', 'Which version do you prefer?'), T('Você pode trocar depois em Configurações.', 'You can change this later in Settings.'), [
        tile('painel', T('Otimizada', 'Optimized'), T('Mais leve e rápida. Ideal para iPhone antigo, Safari e computador fraco.', 'Lighter and faster. Best for older iPhones, Safari and weak computers.'), () => { A.cfg.v.visual = 'lite'; A.tema.aplicar(); fim(); }),
        tile('bolhas', T('Completa', 'Fancy'), T('Vidro com desfoque, bolhas flutuantes e todas as animações.', 'Blurred glass, floating bubbles and every animation.'), () => { A.cfg.v.visual = 'fancy'; A.tema.aplicar(); fim(); }),
      ]);
    };
    // (0.7.9) no aplicativo do celular, aparelho fraco já começa na otimizada
    const proximoPasso = () => ((A.plat.celular || A.plat.fraco) && !A.plat.desktop && !A.plat.apk ? pVisual() : (A.cfg.v.visual = A.cfg.v.visual || (A.plat.apk && A.plat.fraco ? 'lite' : 'fancy'), A.tema.aplicar(), fim()));
    passo(T('Bem-vindo ao Aero', 'Welcome to Aero'), 'Escolha o idioma · Choose your language', [
      tile('chat', 'Português (Brasil)', null, () => { A.cfg.v.idioma = 'pt-BR'; A.cfg.salvar(); proximoPasso(); }),
      tile('chat', 'English', null, () => { A.cfg.v.idioma = 'en'; A.cfg.salvar(); proximoPasso(); }),
    ]);
    return {};
  };

  // ---------- login ----------
  TELAS.login = (el, dados) => {
    const API = A.api;
    let modo = 'entrar', timerTag = null;
    const msg = h('p', { class: 'msg', role: 'status' });
    const dizer = (t, tipo) => { msg.textContent = t || ''; msg.className = 'msg ' + (tipo || ''); };
    const campo = (rot, props = {}) => { const i = h('input', { class: 'campo', autocomplete: 'off', spellcheck: 'false', ...props }); return [h('label', { class: 'rot' }, rot), i, i]; };

    const [rs, , servidor] = campo(T('Endereço do servidor (o que o comando "deploy" mostrou)', 'Server address (shown by the "deploy" command)'), { placeholder: 'https://aero-stream.seunome.workers.dev' });
    servidor.value = API.servidor;
    // (1.0.0) o código de acesso: "AERO" fixo e 12 quadradinhos, um por letra (sem traço). Por baixo é um campo só, invisível em cima dos
    // quadradinhos: colar, o teclado do celular, o preenchimento automático e o teclado do controle continuam funcionando igual
    const r1 = h('label', { class: 'rot', for: 'login-codigo' }, T('Seu código de acesso', 'Your access code'));
    const loginId = h('input', { id: 'login-codigo', class: 'cod-real', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', inputmode: 'text', maxlength: 40, 'aria-label': T('As 12 letras e números do código, depois do AERO', 'The 12 letters and numbers of the code, after AERO') });
    const caixas = Array.from({ length: 12 }, () => h('span', { class: 'cod-caixa', 'aria-hidden': 'true' }));
    const codBox = h('div', { class: 'cod-acesso' }, h('span', { class: 'cod-prefixo', 'aria-hidden': 'true' }, 'AERO'),
      h('div', { class: 'cod-caixas' }, h('div', { class: 'cod-grupo' }, ...caixas.slice(0, 4)), h('div', { class: 'cod-grupo' }, ...caixas.slice(4, 8)), h('div', { class: 'cod-grupo' }, ...caixas.slice(8)), loginId));
    const limparCodigo = (v) => A.cripto.letras(v).slice(0, 12); // (1.0.2) o "AERO" colado ou digitado sai sempre (nunca conta como letra do código)
    const pintarCaixas = () => {
      const v = loginId.value, ativo = document.activeElement === loginId, pos = Math.min(loginId.selectionStart == null ? v.length : loginId.selectionStart, 11);
      caixas.forEach((c, i) => { c.textContent = v[i] || ''; c.classList.toggle('cheia', !!v[i]); c.classList.toggle('atual', ativo && i === pos); });
      codBox.classList.toggle('completo', v.length === 12);
    };
    loginId.addEventListener('input', () => { const n = limparCodigo(loginId.value); if (n !== loginId.value) { loginId.value = n; try { loginId.setSelectionRange(n.length, n.length); } catch (_) {} } pintarCaixas(); });
    ['focus', 'blur', 'keyup', 'select', 'click'].forEach((t) => loginId.addEventListener(t, () => setTimeout(pintarCaixas, 0)));
    // clicar em qualquer quadradinho continua de onde parou (o próximo vazio)
    loginId.addEventListener('mouseup', () => { if (loginId.selectionStart === loginId.selectionEnd) { const n = loginId.value.length; try { loginId.setSelectionRange(n, n); } catch (_) {} pintarCaixas(); } });
    pintarCaixas();
    const [r2, , nome] = campo(T('Seu nome', 'Your name'), { maxlength: 24 });
    const [r3, , tag] = campo(T('Sua # (única, até 20 caracteres)', 'Your # (unique, up to 20 characters)'), { maxlength: 20, placeholder: 'Lanterns' });
    const tagInfo = h('div', { class: 'peq', estilo: { 'min-height': '18px', 'margin-top': '4px' } });
    const [r4, , email] = campo(T('E-mail', 'E-mail'), { inputmode: 'email', autocapitalize: 'none' });
    const [r6, , codigoMail] = campo(T('Código de 6 números que chegou no e-mail', '6-digit code from the e-mail'), { inputmode: 'numeric', maxlength: 6, placeholder: '123456' });
    let verificado = null; // resposta do servidor depois do código do e-mail (ticket + cofre de reserva)
    const termosCx = A.legal ? A.legal.caixaCriar() : null; // (1.0.2) aceitar os termos de serviço ao criar a conta

    // (0.6.0) passo a mais do login: código do autenticador (2FA) ou o que foi para o e-mail (aparelho/rede novos)
    const [r7, , codigoExtra] = campo('', { inputmode: 'numeric', maxlength: 6, placeholder: '123456', autocomplete: 'one-time-code' });
    let precisa = null;
    r7.hidden = codigoExtra.hidden = true;
    // (0.6.0) lembrar este código neste aparelho (para entrar rápido depois) e as contas já salvas aqui
    const lembrar = h('input', { type: 'checkbox' }); lembrar.checked = A.store.ler('aero-lembrar-contas', '1') === '1';
    lembrar.addEventListener('change', () => A.store.gravar('aero-lembrar-contas', lembrar.checked ? '1' : '0'));
    const lembrarRot = h('label', { class: 'linha peq', estilo: { gap: '8px', 'margin-top': '10px' } }, lembrar, T('Lembrar meu código neste aparelho (entrar rápido depois)', 'Remember my code on this device (quick sign-in later)'));
    const salvas = h('div', { class: 'contas-salvas' });
    const pintarSalvas = () => {
      salvas.textContent = '';
      const l = API.contas(); if (!l.length) return;
      salvas.append(h('div', { class: 'rot' }, T('Entrar rápido', 'Quick sign-in')), ...l.map((c) => h('div', { class: 'conta-salva' },
        h('button', { type: 'button', class: 'conta-salva-ir', onclick: () => API.trocarConta(c.codigo) }, U.avatar(c, 36), h('div', { class: 'cresce' }, h('b', {}, c.nome), h('div', { class: 'peq suave' }, '#' + (c.tag || '')))),
        U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Tirar deste aparelho', 'Remove from this device'), onclick: () => { API.esquecerConta(c.codigo); pintarSalvas(); } }))));
    };
    pintarSalvas();
    // (0.9.6) três jeitos de entrar: código de acesso (o padrão), # e senha, ou QR code aprovado por um aparelho onde você já entrou
    let como = 'codigo', qrVivo = null;
    const [rTagL, , tagLogin] = campo(T('Sua #', 'Your #'), { maxlength: 21, placeholder: 'Lanterns', autocapitalize: 'none' });
    const [rSenha, , senhaCampo] = campo(T('Sua senha', 'Your password'), { type: 'password', autocomplete: 'current-password' });
    // (1.0.0) entrar por QR code: o aparelho onde você já entrou mostra um QR e um código que muda a cada 30 s. Aqui você lê o QR com a
    // câmera (só liga se você pedir) ou digita o código; o outro aparelho confirma e este entra, sem digitar o código de acesso
    const qrVideo = h('video', { class: 'qr-cam', muted: true, playsinline: true, autoplay: true }); qrVideo.hidden = true;
    const qrCampo = h('input', { class: 'campo qr-cod-campo', maxlength: 9, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', placeholder: 'XXXX-XXXX', 'aria-label': T('Código embaixo do QR', 'Code below the QR') });
    const qrEstadoTxt = h('div', { class: 'peq suave qr-cam-estado' });
    const qrCamBtn = U.btn(T('Ler com a câmera', 'Scan with camera'), { icone: 'camera', tipo: 'sec', peq: true, onclick: () => ligarCamera() });
    const qrEntrarBtn = U.btn(T('Entrar', 'Sign in'), { peq: true, onclick: () => usarCodigo(qrCampo.value) });
    const qrForm = h('div', { class: 'col', estilo: { gap: '8px' } }, qrVideo, h('div', { class: 'linha qr-cod-linha' }, qrCampo, qrEntrarBtn), h('div', { class: 'linha', estilo: { 'justify-content': 'center' } }, qrCamBtn));
    const qrBox = h('div', { class: 'qr-login col', estilo: { gap: '8px' } },
      h('p', { class: 'peq suave', estilo: { margin: '10px 0 0' } }, T('No aparelho onde você já entrou, abra Configurações > Conta > Entrar em outro aparelho > Mostrar QR code. Leia o QR com a câmera ou digite o código embaixo dele.', 'On a device where you are already signed in, open Settings > Account > Sign in on another device > Show QR code. Scan the QR with the camera or type the code below it.')),
      qrForm, qrEstadoTxt);
    qrCampo.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); usarCodigo(qrCampo.value); } });
    qrCampo.addEventListener('input', () => { const v = qrCampo.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); const f = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v; if (f !== qrCampo.value) qrCampo.value = f; });
    let qrCam = null;
    const pararCamera = () => { if (qrCam) qrCam.parar(); qrCam = null; qrVideo.hidden = true; qrCamBtn.hidden = false; };
    const pararQr = () => { pararCamera(); if (qrVivo) { clearInterval(qrVivo.t); qrVivo.parou = true; qrVivo = null; } qrForm.hidden = false; qrEstadoTxt.textContent = ''; };
    async function ligarCamera() {
      if (qrCam) return; qrCamBtn.hidden = true; qrVideo.hidden = false; qrEstadoTxt.textContent = T('Aponte a câmera para o QR no outro aparelho.', 'Point the camera at the QR on the other device.');
      try {
        const c = await A.ui.cameraQr(qrVideo, (txt) => { const cod = A.ui.codigoQrEntrada(txt); if (!cod) return false; usarCodigo(cod); return true; });
        if (!el.isConnected || modo !== 'entrar' || como !== 'qr') { c.parar(); return; }
        qrCam = c;
      } catch (e) { qrVideo.hidden = true; qrCamBtn.hidden = false; qrEstadoTxt.textContent = e.message; }
    }
    async function usarCodigo(v) {
      const cod = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cod.length !== 8) { dizer(T('O código tem 8 letras e números.', 'The code has 8 letters and numbers.'), 'erro'); return; }
      if (qrVivo) return; dizer('');
      const vivo = { parou: false, q: null, t: 0 }; qrVivo = vivo;
      pararCamera(); qrForm.hidden = true; qrEstadoTxt.textContent = T('Conferindo...', 'Checking...');
      try { vivo.q = await API.qrPedir(cod); }
      catch (e) { if (vivo.parou) return; qrVivo = null; qrForm.hidden = false; qrEstadoTxt.textContent = ''; dizer(e.message, 'erro'); return; }
      if (vivo.parou) return;
      qrEstadoTxt.textContent = T('Agora confirme no outro aparelho (aparece "Entrar na sua conta em..." lá).', 'Now confirm on the other device (it shows "Sign in to your account on...").');
      let ocupado = false;
      vivo.t = setInterval(async () => {
        if (!el.isConnected || modo !== 'entrar' || como !== 'qr') { pararQr(); return; }
        if (ocupado) return; ocupado = true;
        try {
          const d = await API.qrEstado(vivo.q); if (vivo.parou) return;
          if (d.estado === 'ok') { pararQr(); A.som.tocar('sucesso'); if (!lembrar.checked) A.store.gravar('aero-lembrar-contas', '0'); dados.continuar(); }
          else if (d.estado === 'recusado' || d.estado === 'venceu') { pararQr(); qrCampo.value = ''; dizer(d.estado === 'recusado' ? T('O outro aparelho recusou.', 'The other device declined.') : T('O pedido venceu. Tente de novo com o código que está aparecendo agora.', 'The request expired. Try again with the code showing now.'), 'erro'); }
        } catch (e) { /* sem internet agora: tenta de novo no próximo */ } finally { ocupado = false; }
      }, 2000);
    }
    const pintarComo = () => {
      const ehCod = como === 'codigo', ehSen = como === 'senha', ehQr = como === 'qr';
      r1.hidden = codBox.hidden = !ehCod; rTagL.hidden = tagLogin.hidden = rSenha.hidden = senhaCampo.hidden = !ehSen; qrBox.hidden = !ehQr;
      if (ehQr) { r7.hidden = codigoExtra.hidden = true; precisa = null; }
      enviar.hidden = ehQr; dizer('');
      if (!(ehQr && modo === 'entrar')) pararQr(); else setTimeout(() => { if (qrBox.isConnected && !qrForm.hidden) qrCampo.focus(); }, 60);
    };
    const comoSeg = U.seg([['codigo', T('Código de acesso', 'Access code')], ['senha', T('Senha', 'Password')], ['qr', T('QR code', 'QR code')]], 'codigo', (v) => { como = v; precisa = null; r7.hidden = codigoExtra.hidden = true; pintarComo(); });
    comoSeg.style.margin = '4px 0 6px';
    const blocos = { entrar: [salvas, comoSeg, r1, codBox, rTagL, tagLogin, rSenha, senhaCampo, qrBox, r7, codigoExtra, lembrarRot], criar: [r2, nome, r3, tag, tagInfo, r4, email, termosCx ? termosCx.el : null].filter(Boolean), esqueci: [r4, email], esqueci2: [r6, codigoMail, r7, codigoExtra] };
    const area = h('div', {}), idCartao = h('div', { hidden: true });
    const rotulos = { entrar: T('Entrar', 'Sign in'), criar: T('Criar conta', 'Create account'), esqueci: T('Mandar código para o e-mail', 'Send code to my e-mail'), esqueci2: T('Criar um código de acesso novo', 'Create a new access code') };
    const enviar = U.btn(rotulos.entrar, { grande: true, onclick: () => acao() });
    enviar.style.width = '100%'; enviar.style.marginTop = '18px';
    const trocar = (m) => { modo = m; area.textContent = ''; area.append(...blocos[m]); enviar.querySelector('span').textContent = rotulos[m]; dizer(''); enviar.hidden = false; if (m === 'entrar') pintarComo(); else pararQr(); };

    // checagem da # enquanto digita: mostra na hora se está livre
    tag.addEventListener('input', () => {
      clearTimeout(timerTag);
      const v = tag.value.trim().replace(/^#/, '');
      if (!v) { tagInfo.textContent = ''; return; }
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(v)) { tagInfo.textContent = T('3 a 20 caracteres: letras, números, _ . -', '3 to 20 characters: letters, numbers, _ . -'); tagInfo.style.color = 'var(--aviso)'; return; }
      tagInfo.textContent = T('Verificando...', 'Checking...'); tagInfo.style.color = 'var(--suave)';
      timerTag = setTimeout(async () => {
        try { API.definirServidor(servidor.value); const livre = await API.tagLivre(v); tagInfo.textContent = livre ? T('#' + v + ' está livre!', '#' + v + ' is available!') : T('#' + v + ' já está em uso.', '#' + v + ' is taken.'); tagInfo.style.color = livre ? 'var(--ok)' : 'var(--erro)'; }
        catch (e) { tagInfo.textContent = ''; }
      }, 450);
    });


    async function acao() {
      if (!API.definirServidor(servidor.value)) return dizer(T('Cole o endereço do servidor primeiro.', 'Paste the server address first.'), 'erro');
      if (modo === 'entrar' && como === 'codigo' && loginId.value.length !== 12 && loginId.value.length !== 8) { loginId.focus(); return dizer(T('O código tem 12 letras e números depois do AERO (contas bem antigas: 8).', 'The code has 12 letters and numbers after AERO (very old accounts: 8).'), 'erro'); }
      enviar.disabled = true;
      try {
        if (modo === 'entrar') {
          dizer(T('Entrando...', 'Signing in...'));
          const extra = precisa === '2fa' ? { totp: codigoExtra.value } : precisa === 'email' ? { codigoEmail: codigoExtra.value } : {};
          try { if (como === 'senha') await API.entrarSenha(tagLogin.value, senhaCampo.value, extra); else await API.entrar(loginId.value, extra); }
          catch (e) {
            if (!e.precisa) throw e;
            precisa = e.precisa; r7.hidden = codigoExtra.hidden = false; codigoExtra.value = '';
            r7.textContent = precisa === '2fa' ? T('Código do aplicativo autenticador (6 números)', 'Authenticator app code (6 digits)') : T('Código que chegou no e-mail (6 números)', 'Code from the e-mail (6 digits)');
            setTimeout(() => codigoExtra.focus(), 50); dizer(e.message, 'ok'); enviar.disabled = false; return;
          }
          if (!lembrar.checked) A.store.gravar('aero-lembrar-contas', '0');
          dados.continuar();
        }
        else if (modo === 'criar') {
          if (termosCx && !termosCx.marcado()) { termosCx.focar(); dizer(T('Para criar a conta, aceite os Termos de Serviço.', 'To create an account, accept the Terms of Service.'), 'erro'); enviar.disabled = false; return; }
          dizer(T('Criando a conta e as chaves...', 'Creating the account and keys...'));
          const d = await API.registrar({ nome: nome.value, tag: tag.value, email: email.value, termos: termosCx ? A.legal.V : 0 });
          mostrarId(d.loginId);
        } else if (modo === 'esqueci') {
          await API.esqueci(email.value);
          trocar('esqueci2'); dizer(T('Se esse e-mail tiver conta, o código chegou nele (olhe também o spam). Ele vale por 15 minutos.', 'If this e-mail has an account, the code is there (check spam too). It is valid for 15 minutes.'), 'ok');
        } else {
          if (!verificado) verificado = await API.verificarCodigo(email.value, codigoMail.value);
          if (verificado.totp && !codigoExtra.value.trim()) { // (0.7.9) conta com 2FA: o e-mail sozinho não troca o código
            r6.hidden = codigoMail.hidden = true; r7.hidden = codigoExtra.hidden = false;
            r7.textContent = T('Código do aplicativo autenticador (6 números)', 'Authenticator app code (6 digits)');
            setTimeout(() => codigoExtra.focus(), 50); dizer(T('Falta o código do seu autenticador.', 'Your authenticator code is still needed.'), 'ok'); enviar.disabled = false; return;
          }
          dizer(T('Criando o código novo...', 'Creating the new code...'));
          const d = await API.redefinir(verificado, codigoExtra.value);
          verificado = null; mostrarId(d.loginId, d.manteve ? T('Pronto! As suas conversas continuam aqui.', 'Done! Your chats are still here.') : T('Pronto! A conta voltou. As conversas antigas voltam quando os outros membros de cada conversa abrirem o app.', 'Done! Your account is back. Old chats come back when the other members of each chat open the app.'));
        }
      } catch (e) { dizer(e.message, 'erro'); A.som.tocar('erro'); }
      enviar.disabled = false;
    }
    function mostrarId(id, extra) {
      A.som.tocar('sucesso');
      idCartao.hidden = false; seg.hidden = true; area.hidden = true; enviar.hidden = true; servidorBloco.hidden = true;
      idCartao.textContent = '';
      idCartao.append(h('p', { class: 'suave' }, extra || T('Conta criada!', 'Account created!'), ' ', T('Guarde este código de acesso: ele é a chave da sua conta e das suas conversas. Ninguém (nem o servidor) consegue ver ou recuperar ele.', 'Keep this access code: it is the key to your account and your chats. Nobody (not even the server) can see or recover it.')),
        h('div', { class: 'selecionavel', estilo: { padding: '16px', 'text-align': 'center', 'font-size': '28px', 'font-weight': '700', 'letter-spacing': '2px', border: '2px dashed var(--cor)', 'border-radius': 'var(--raio-p)', 'overflow-wrap': 'anywhere' } }, id),
        h('div', { class: 'linha', estilo: { 'margin-top': '14px' } }, U.btn(T('Copiar', 'Copy'), { icone: 'copiar', tipo: 'sec', onclick: (e) => U.copiar(id, e.currentTarget) }), U.btn(T('Continuar', 'Continue'), { grande: true, onclick: () => dados.continuar() })));
    }

    const seg = U.seg([['entrar', rotulos.entrar], ['criar', rotulos.criar], ['esqueci', T('Esqueci meu código', 'Forgot my code')]], 'entrar', (m) => { verificado = null; trocar(m); });
    seg.style.marginTop = '16px';
    const servidorBloco = h('div', { hidden: true }, rs, servidor); // o servidor agora é fixo (api.js); o campo fica só para testes
    trocar('entrar');
    // (1.0.2) abriu o site pelo QR (a câmera normal do celular leu o QR, que agora é um link): já vai para o QR code e confere o código
    { const q = A.ui.qrPendente && A.ui.qrPendente(); if (q) setTimeout(() => { if (!el.isConnected || modo !== 'entrar') return; const b = comoSeg.querySelectorAll('button')[2]; if (b) b.click(); usarCodigo(q); }, 80); }
    [loginId, tagLogin, senhaCampo, nome, tag, email, codigoMail].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') acao(); }));
    // atualização já na tela de entrar: quem não consegue entrar (versão velha) também atualiza, sem precisar logar
    const versaoTxt = h('span', {}, 'v' + A.versao);
    const procurar = async (manual) => {
      if (!A.sistema) return;
      versaoTxt.textContent = T('Procurando atualização...', 'Checking for updates...');
      const r = await A.sistema.verificarAtualizacao({ manual }).catch(() => null);
      versaoTxt.textContent = r && r.nova ? (r.instalador ? T('Versão ' + r.nova + ': baixe o instalador novo no site.', 'Version ' + r.nova + ': download the new installer from the site.') : T('Versão ' + r.nova + ' disponível.', 'Version ' + r.nova + ' available.'))
        : r && r.erro && manual ? T('Não consegui procurar agora (sem internet?). v', 'Could not check now (offline?). v') + A.versao : T('Você está na versão mais nova (v', 'You are on the latest version (v') + A.versao + ')';
    };
    const atualizacao = h('div', { class: 'peq suave', estilo: { 'margin-top': '14px', display: 'flex', gap: '8px', 'align-items': 'center', 'justify-content': 'center', 'flex-wrap': 'wrap' } }, versaoTxt, U.btn(T('Procurar atualização', 'Check for updates'), { tipo: 'link', peq: true, onclick: () => procurar(true) }));
    setTimeout(() => procurar(false), 600);
    el.append(h('div', { class: 'vidro pad', estilo: { width: 'min(520px, 94vw)', margin: 'auto', padding: '26px' } },
      h('div', { class: 'linha' }, h('img', { src: 'icon.svg', alt: '', width: 46, height: 46, draggable: 'false' }), h('h1', { estilo: { 'font-size': '26px' } }, 'Aero')),
      h('p', { class: 'suave', estilo: { margin: '6px 0 0' } }, T('Entre ou crie sua conta para ver seus amigos online.', 'Sign in or create an account to see your friends online.')),
      servidorBloco, seg, area, idCartao, enviar, msg, atualizacao));
    return {};
  };

  // ---------- home: topo + abas ----------
  TELAS.home = async (el, dados) => {
    const API = A.api, H = A.hub;
    const eu = API.eu;
    // "Aero Talk": conversas, grupos, chamadas e amigos (talk.js); a antiga aba Amigos vive dentro dela
    const abas = [['conexoes', T('Conexões', 'Connections'), 'oConexoes'], ['talk', 'Aero Talk', 'oTalk']];
    // (0.8.7) sem a aba Transmitir: o Aero Talk é o centro do app (chamadas, tela e modo jogo ficam lá)
    abas.push(['config', T('Configurações', 'Settings'), 'oConfig']); // (0.8.7) as Configurações ficam logo depois do Aero Talk (no carrossel e na doca)
    abas.push(['integ', T('Integrações', 'Integrations'), 'oInteg']); // (0.8.7) a oficina de integrações (integracoes.js)
    // a equipe: só a conta do desenvolvedor tem "Desenvolvedor"; moderadores têm "Moderação" (o servidor confere tudo de novo)
    if (eu.cargo === 'dev') abas.push(['dev', T('Desenvolvedor', 'Developer'), 'oEscudo']);
    else if (eu.cargo === 'mod') abas.push(['mod', T('Moderação', 'Moderation'), 'oEscudo']);

    // Controle: a barra de abas e o conteúdo são zonas (nav.js). Nas abas, ←/→ escolhem e A ou ↓ entram; dentro, o foco fica na aba;
    // B (ou ↑ no topo) volta às abas.
    const conteudo = h('div', { class: 'conteudo', dados: { zona: 'painel', zonaCima: 'abas', zonaVoltar: 'abas' } });
    // (0.5.9-7) status, nome, # e foto se atualizam sozinhos (U.atualizarVivos), sem refazer a tela
    const est = U.estadoDe(eu.codigo);
    const estado = h('span', { class: 'pilula ' + est, dados: { estadoCod: eu.codigo } }); U.pintarPilula(estado, eu.codigo, est);
    const eubloco = h('div', { class: 'eu', role: 'button', tabindex: '0', title: T('Seu perfil', 'Your profile'), onclick: (e) => U.menuConta(e, { sair: () => dados.sair && dados.sair() }) }, U.avatar({ nome: eu.nome, codigo: eu.codigo, av: eu.av }, 46),
      h('div', { class: 'eu-txt' }, h('div', { estilo: { 'font-weight': '700', 'font-size': '17px' } }, h('span', { dados: { nomeCod: eu.codigo } }, eu.nome), ' ', h('span', { class: 'tag', dados: { tagCod: eu.codigo } }, '#' + eu.tag), ' ', U.insignias && !(eu.pf && eu.pf.si === false) ? U.insignias(eu.ins, eu.sl, eu.pf && eu.pf.so) : null), estado, h('div', { class: 'eu-recado peq suave' }, eu.bio || ''),
        h('div', { class: 'eu-ativ' }, A.jogando ? A.jogando.linha(eu.codigo) : null, A.ouvindo ? A.ouvindo.linha(eu.codigo) : null, A.assistindo ? A.assistindo.linha(eu.codigo) : null))); // (1.0.0) a sua própria atividade, como os amigos veem
    { const c0 = estado.style.getPropertyValue('--stc'); if (c0) eubloco.style.setProperty('--stc', c0); } // (0.8.7) a moldura da foto na cor do status personalizado
    const botoes = {}, selos = {};
    const barra = h('nav', { class: 'abas', role: 'tablist' }, abas.map(([id, rot, ic]) => {
      const selo = h('span', { class: 'selo', hidden: true }); selos[id] = selo;
      return (botoes[id] = h('button', { class: 'aba', type: 'button', role: 'tab', title: rot, onclick: () => {
        // (0.8.7) clicar de novo na aba que já está aberta (no carrossel ou na doca): um menuzinho com todas as abas lado a lado
        if (aba === id && conteudo.firstChild && !montagem && (raiz.dataset.barra === 'doca' || (raiz.dataset.barra === 'bolha' && largo.matches))) { menuRapido(botoes[id]); return; }
        trocar(id, undefined, true); // (0.9.1) a doca continua aberta ao trocar de aba (no toque, fecha tocando fora dela)
      } }, A.orbe(ic, 36), h('span', {}, rot), selo));
    }));
    // (0.9.0) setinhas nas pontas do carrossel: mostram que há mais abas para os lados (e giram uma por vez). Ficam fora do caminho das bolhas
    // que aparecem (a do lado vai até 83px do meio; as setas ficam além de 108px), por cima das que entram e saem já sem cor
    const setaCar = (d) => h('button', { type: 'button', class: 'car-seta car-seta-' + (d < 0 ? 'e' : 'd'), tabindex: '-1', 'aria-hidden': 'true', title: d < 0 ? T('Aba anterior', 'Previous tab') : T('Próxima aba', 'Next tab'),
      onclick: () => { const n = abas.length, i = Math.max(0, abas.findIndex((x) => x[0] === aba)); trocar(abas[(i + d + n) % n][0], undefined, true); } }, A.icone('chevron', 14));
    barra.append(setaCar(-1), setaCar(1));
    function menuRapido(ancora) {
      const corpo = h('div', { class: 'abas-rapido', role: 'menu' }, ...abas.map(([id2, rot2, ic2]) => h('button', { type: 'button', role: 'menuitem', class: 'abas-rapido-it' + (id2 === aba ? ' sel' : ''), title: rot2,
        onclick: () => { pop.fechar(); if (id2 !== aba) trocar(id2, undefined, true); if (ehDoca()) abrirDoca(false); } }, A.orbe(ic2, 34), h('span', {}, rot2))));
      const pop = U.popover(ancora, corpo, { largura: Math.min(560, 96 * abas.length + 24) });
      A.som.tocar('pop-abrir');
      const b0 = corpo.querySelector('.sel') || corpo.firstChild; if (b0 && raiz.dataset.entrada === 'pad') b0.focus();
    }
    const topo = h('div', { class: 'topo vidro', dados: { zona: 'abas', zonaBaixo: 'painel', zonaConfirmar: 'painel', zonaInicial: '', menu: 'topo' } }, eubloco, barra);
    // (0.8.0) a setinha que recolhe a barra (clique ou arraste); com ela recolhida, a mesma setinha traz de volta
    const bordaTopo = A.arranjo ? A.arranjo.borda({ peca: 'topo', el: topo, onde: () => A.arranjo.v().topo, medir: () => casa.getBoundingClientRect() }) : null;
    const casa = h('div', { class: 'home col', estilo: { height: '100%', 'min-height': 0 } }, topo, bordaTopo, conteudo);
    // controle: com a barra recolhida, a "zona das abas" passa a ser a setinha (↑ chega nela e o A traz a barra de volta)
    const zonaTopo = () => {
      if (!bordaTopo) return;
      const rec = A.arranjo.recolhida('topo'), de = rec ? topo : bordaTopo, para = rec ? bordaTopo : topo;
      if (para.dataset.zona) return;
      for (const k of ['zona', 'zonaBaixo']) { para.dataset[k] = de.dataset[k] || ''; delete de.dataset[k]; }
      if (rec && document.activeElement && topo.contains(document.activeElement)) { const st = bordaTopo.querySelector('.ar-seta'); if (st) st.focus({ preventScroll: true }); }
    };
    if (bordaTopo) { zonaTopo(); const offZ = A.evt.on('arranjo', () => { if (!casa.isConnected) { offZ(); return; } zonaTopo(); }); }
    const offR = A.evt.on('perfil', () => { const r = eubloco.querySelector('.eu-recado'); if (r && API.eu) r.textContent = API.eu.bio || ''; });
    // botão direito num espaço vazio da barra (ou X no controle): recolher e mudar de lugar sem arrastar
    topo.addEventListener('contextmenu', (e) => { if (!A.arranjo || true || e.defaultPrevented || e.target.closest('[data-menu]') !== topo) return; A.arranjo.menuPeca(e, 'topo'); });
    el.append(casa);
    // (0.7.14) segurar e arrastar a barra para baixo ou para um dos lados (ela muda de comprimento, a espessura é sempre a mesma)
    if (A.arranjo) A.arranjo.arrastavel(topo, { peca: 'topo', pode: () => false, nome: T('Barra de abas', 'Tab bar'), icone: 'menu', lugares: () => A.arranjo.faixas(casa.getBoundingClientRect(), 110, ['cima', 'baixo', 'esquerda', 'direita'], A.arranjo.rotulos()) });

    // (0.8.7) os dois jeitos da barra (Aparência > Barra das abas):
    // "Bolha do perfil" (padrão): no Aero Talk, o cartão com você e as abas fica em cima da lista; nas outras abas é uma coluna à esquerda,
    // e embaixo dele a aba pode pôr o que quiser (ctx.lateral: as sub-abas das Configurações, os amigos online em Conexões). As abas giram
    // como um carrossel: a escolhida vem para a frente. No celular, a barra de baixo de sempre.
    // "Doca": escondida numa alça na borda; abre ao passar o mouse (no celular, puxando a alça), fecha quando o mouse sai, gruda numa das
    // bordas (segurar e arrastar) e, enquanto está aberta, o resto da tela não recebe clique nem controle.
    const raiz = document.documentElement;
    const largo = matchMedia('(min-width: 761px)');
    const lateral = h('div', { class: 'bolha-extra', dados: { zona: 'lateral', zonaCima: 'abas', zonaDir: 'painel', zonaVoltar: 'abas' } });
    casa.insertBefore(lateral, conteudo);
    // (0.8.7) o carrossel: só 3 bolhas à vista (a anterior, a escolhida no meio e a próxima), que deslizam para a direita ou para a
    // esquerda ao trocar, como o seletor do relógio do Ben 10 clássico. As outras esperam escondidas fora das pontas e entram deslizando.
    // Só transform/opacity com animação do navegador (fora da thread principal: montar a aba nova não trava o giro)
    const PASSO = 66;
    const pose = (k) => { const a = Math.abs(k); return { transform: `translateX(${Math.max(-2, Math.min(2, k)) * PASSO}px) scale(${a === 0 ? 1 : a === 1 ? 0.86 : 0.7})`, opacity: a === 0 ? 1 : a === 1 ? 0.85 : 0 }; };
    const posAntes = {};
    function girar() {
      const n = abas.length, i0 = Math.max(0, abas.findIndex((a) => a[0] === aba));
      const carrossel = raiz.dataset.barra === 'bolha' && largo.matches, anima = carrossel && raiz.dataset.anim !== 'nenhuma' && raiz.dataset.visual !== 'lite';
      abas.forEach(([id], i) => {
        const b = botoes[id];
        let k = (((i - i0) % n) + n) % n; if (k > n / 2) k -= n; // a distância mais curta até a escolhida (dá a volta pelas pontas)
        // (0.8.7) a que sai de vista fica escondida do lado por onde saiu (antes ia sempre para a direita e pulava de uma ponta à outra)
        const ant = posAntes[id];
        if (Math.abs(k) >= 2 && ant != null && ant !== 0) k = ant < 0 ? -2 : 2;
        if (!carrossel) { if (b._giro) { b._giro.cancel(); b._giro = null; } b.style.transform = ''; b.style.opacity = ''; b.style.zIndex = ''; b.classList.remove('fora'); delete posAntes[id]; return; }
        // parte de onde a bolha está agora (no meio de um giro, sem pular)
        // (0.8.7) a que entra vem de fora pelo lado onde vai ficar (deslizando junto com as outras)
        const cs = b._giro ? getComputedStyle(b) : null, de = cs ? { transform: cs.transform, opacity: cs.opacity } : ant != null ? pose(Math.abs(ant) >= 2 && Math.abs(k) <= 1 ? (k < 0 ? -2 : 2) : ant) : null;
        if (b._giro) { b._giro.cancel(); b._giro = null; }
        const p = pose(k); b.style.transform = p.transform; b.style.opacity = String(p.opacity); b.style.zIndex = String(10 - Math.min(2, Math.abs(k)));
        b.classList.toggle('fora', Math.abs(k) > 1);
        // uma que pula de uma ponta escondida para a outra não atravessa a tela: só aparece no lugar
        const salto = ant != null && Math.abs(ant) >= 2 && Math.abs(k) >= 2;
        if (anima && de && !salto && ant !== k) { b._giro = b.animate([de, p], { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' }); b._giro.onfinish = () => { b._giro = null; }; }
        posAntes[id] = k;
      });
    }
    // (0.8.7) mudar um elemento de lugar no HTML reinicia as animações de entrada dele (a bolha "rodava de novo" ao voltar ao Aero Talk):
    // as que têm fim terminam na hora; as que repetem para sempre (brilhos) seguem normais
    const acalmar = (no) => { try { for (const an of no.getAnimations({ subtree: true })) { const t = an.effect && an.effect.getComputedTiming(); if (t && t.iterations !== Infinity && an.playState !== 'finished' && (an instanceof CSSAnimation)) an.finish(); } } catch (e) { /* ok */ } };
    const posicionarTopo = () => {
      const ativo = conteudo.querySelector(':scope > .painel:not(.guardado):not(.saindo)');
      const lado = raiz.dataset.barra === 'bolha' && largo.matches && ativo ? ativo.querySelector('.tk-lado') : null;
      let mudou = false;
      if (lado) { if (lado.firstChild !== topo) { const vaga = lado.querySelector(':scope > .topo-vaga'); if (vaga) vaga.replaceWith(topo); else lado.prepend(topo); mudou = true; } } else if (topo.parentNode !== casa) { casa.insertBefore(topo, casa.firstChild); mudou = true; }
      if (mudou) acalmar(topo);
      casa.classList.toggle('topo-no-talk', !!lado);
    };
    const remontar = () => { if (!aba) return; const a = aba; aba = null; soltarGuardadas(); trocar(a); };
    largo.addEventListener('change', remontar);
    // --- a doca ---
    const ehDoca = () => raiz.dataset.barra === 'doca';
    const alca = h('button', { type: 'button', class: 'doca-alca', tabindex: '-1', 'aria-label': T('Abrir a doca', 'Open the dock') });
    const veu = h('div', { class: 'doca-veu', hidden: true });
    casa.append(veu, alca);
    let docaAberta = false, tFechar = 0, ultimoToque = false, arrastando = false;
    const toqueDoca = () => ehDoca() && ultimoToque;
    function abrirDoca(on) {
      clearTimeout(tFechar);
      if (!ehDoca()) on = false;
      if (docaAberta === on) return;
      docaAberta = on;
      topo.classList.toggle('doca-aberta', on); veu.hidden = !on; conteudo.inert = on; lateral.inert = on;
      // (0.9.1) a doca aberta abre espaço na borda dela: o conteúdo (o chat, a lista) encolhe junto, nada fica por baixo da doca
      espacoDoca(on);
      if (!on && topo.contains(document.activeElement) && raiz.dataset.entrada !== 'pad') document.activeElement.blur();
    }
    function espacoDoca(on) {
      if (on && !arrastando) {
        const lado = raiz.dataset.doca || 'baixo', deitada = lado === 'baixo' || lado === 'cima';
        const tam = deitada ? topo.offsetHeight : topo.offsetWidth; // offset: o tamanho sem a animação de abrir (escala)
        casa.style.setProperty('--doca-esp', Math.round(Math.min(deitada ? innerHeight * 0.3 : innerWidth * 0.3, tam + 24)) + 'px');
      }
      casa.classList.toggle('doca-esp', !!on && !arrastando);
    }
    const fecharLogo = () => { clearTimeout(tFechar); tFechar = setTimeout(() => { if (arrastando || (raiz.dataset.entrada === 'pad' && topo.contains(document.activeElement))) return; abrirDoca(false); }, 380); };
    alca.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') abrirDoca(true); });
    alca.addEventListener('click', () => abrirDoca(true));
    alca.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      ultimoToque = true;
      const x0 = e.clientX, y0 = e.clientY;
      const mv = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 16) { abrirDoca(true); fim(); } };
      const fim = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', fim); removeEventListener('pointercancel', fim); };
      addEventListener('pointermove', mv); addEventListener('pointerup', fim); addEventListener('pointercancel', fim);
    });
    topo.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && docaAberta) clearTimeout(tFechar); });
    topo.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && docaAberta) fecharLogo(); });
    topo.addEventListener('focusin', () => { if (ehDoca()) abrirDoca(true); });
    topo.addEventListener('focusout', (e) => { if (ehDoca() && !topo.contains(e.relatedTarget)) fecharLogo(); });
    topo.addEventListener('keydown', (e) => { if (e.key === 'Escape' && docaAberta) { e.stopPropagation(); abrirDoca(false); } });
    // o véu: com a doca aberta, um clique fora não chega no que está atrás (no toque, ele fecha a doca)
    veu.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (e.pointerType !== 'mouse') abrirDoca(false); });
    veu.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    // (0.8.7) arrastar a doca: é só puxar (ou segurar e puxar) que ela sai junto; a borda mais perto acende e, ao soltar, ela desliza até lá e gruda
    const bordaMaisPerto = (x, y) => { const d = { cima: y, baixo: innerHeight - y, esquerda: x, direita: innerWidth - x }; return Object.keys(d).sort((a, b) => d[a] - d[b])[0]; };
    // (0.8.7) perto de uma borda, a doca já toma a forma que vai ter ali (deitada em cima/embaixo, em pé nos lados): uma prévia. Longe
    // das bordas ela volta à forma de antes e, solta longe, volta para onde estava
    const PERTO = 170;
    const bordaPerto = (x, y) => { const l = bordaMaisPerto(x, y), d = { cima: y, baixo: innerHeight - y, esquerda: x, direita: innerWidth - x }[l]; return d <= PERTO ? l : null; };
    topo.addEventListener('pointerdown', (e) => {
      if (!ehDoca() || e.button !== 0) return;
      ultimoToque = e.pointerType !== 'mouse';
      const x0 = e.clientX, y0 = e.clientY, original = raiz.dataset.doca || 'baixo'; let pegou = false, forma = original;
      const r0 = topo.getBoundingClientRect(), pega = { x: x0 - (r0.left + r0.width / 2), y: y0 - (r0.top + r0.height / 2) };
      const centros = {};
      const centroBase = (l) => {
        if (centros[l]) return centros[l];
        topo.style.setProperty('--dx', '0px'); topo.style.setProperty('--dy', '0px');
        const r = topo.getBoundingClientRect(); return (centros[l] = { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      };
      const pegar = () => { if (pegou) return; pegou = arrastando = true; casa.classList.remove('doca-esp'); topo.classList.add('doca-pega'); centroBase(original); A.som.tocar('click'); };
      const segura = setTimeout(pegar, 320);
      const seguir = (x, y) => {
        const c = centroBase(forma), off = forma === original ? pega : { x: 0, y: 0 };
        topo.style.setProperty('--dx', (x - off.x - c.x) + 'px'); topo.style.setProperty('--dy', (y - off.y - c.y) + 'px');
      };
      const mv = (ev) => {
        if (!pegou) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { clearTimeout(segura); pegar(); } else return; }
        ev.preventDefault();
        const alvo = bordaPerto(ev.clientX, ev.clientY), nova = alvo || original;
        if (nova !== forma) {
          forma = nova; raiz.dataset.doca = nova;
          if (raiz.dataset.anim !== 'nenhuma') topo.animate([{ scale: '.9', opacity: .7 }, { scale: '1.06', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.3, 1.4, .5, 1)' });
          A.som.tocar(alvo ? 'mirar' : 'mini-fechar');
        }
        seguir(ev.clientX, ev.clientY);
        if (alvo) veu.dataset.alvo = alvo; else delete veu.dataset.alvo;
      };
      const fim = (ev) => {
        clearTimeout(segura); removeEventListener('pointermove', mv); removeEventListener('pointerup', fim); removeEventListener('pointercancel', fim);
        delete veu.dataset.alvo;
        if (!pegou) return;
        const x = ev && ev.clientX != null ? ev.clientX : x0, y = ev && ev.clientY != null ? ev.clientY : y0;
        const lugar = bordaPerto(x, y) || original;
        // desliza de onde foi solta até a borda (mede antes e depois e anima só a diferença)
        const antes = topo.getBoundingClientRect();
        topo.classList.remove('doca-pega'); topo.style.setProperty('--dx', '0px'); topo.style.setProperty('--dy', '0px');
        A.cfg.v.tema.doca = lugar; A.cfg.salvar(); raiz.dataset.doca = lugar;
        topo.style.transition = 'none';
        const depois = topo.getBoundingClientRect();
        topo.style.setProperty('--dx', (antes.left + antes.width / 2 - (depois.left + depois.width / 2)) + 'px'); topo.style.setProperty('--dy', (antes.top + antes.height / 2 - (depois.top + depois.height / 2)) + 'px');
        void topo.offsetWidth; topo.style.transition = '';
        requestAnimationFrame(() => { topo.style.removeProperty('--dx'); topo.style.removeProperty('--dy'); });
        A.som.tocar(lugar === original ? 'mini-fechar' : 'sucesso');
        const engole = (c) => { c.stopPropagation(); c.preventDefault(); };
        topo.addEventListener('click', engole, { capture: true }); setTimeout(() => { topo.removeEventListener('click', engole, { capture: true }); arrastando = false; setTimeout(() => espacoDoca(docaAberta), 380); /* a doca já deslizou até a borda nova */ if (!topo.matches(':hover') && !ultimoToque) fecharLogo(); }, 60);
      };
      addEventListener('pointermove', mv, { passive: false }); addEventListener('pointerup', fim); addEventListener('pointercancel', fim);
    });
    const offB = A.evt.on('arranjo', (x) => { if (!casa.isConnected) { offB(); return; } if (x && x.peca === 'barra') { abrirDoca(false); remontar(); } else posicionarTopo(); });
    let aba = null, limparAba = null, montagem = 0, abaViva = null;
    // (0.8.7) abas que ficam guardadas (escondidas) em vez de desmontar: voltar para elas não recarrega a interface
    const GUARDAR = new Set(['talk', 'config']), guardadas = new Map();
    const soltarGuardadas = () => { for (const [, g] of guardadas) { try { if (g.r.limpar) g.r.limpar(); } catch (e) { A.log.erro('limpar aba', e); } g.painel.remove(); } guardadas.clear(); };
    const ctx = { abrirSala: (d) => dados.abrirSala(d), recarregar: () => dados.recarregar(), sair: () => dados.sair && dados.sair(), selos };
    ctx.lateral = (no) => { lateral.replaceChildren(...(no ? [no] : [])); casa.classList.toggle('com-lateral', !!no); if (no) conteudo.dataset.zonaEsq = 'lateral'; else delete conteudo.dataset.zonaEsq; };
    ctx.lateralNaBolha = () => raiz.dataset.barra === 'bolha' && largo.matches;
    ctx.reposicionar = () => posicionarTopo();
    const cancelarMontagem = () => { cancelAnimationFrame(montagem); clearTimeout(montagem); montagem = 0; };
    // (0.7.9) depois: o clique só marca a aba e toca o som; a aba nova é montada logo depois de o navegador pintar isso. Antes tudo acontecia no
    // clique, e a barra só reagia depois de montar a aba inteira (era o "leve lag"). Clicar em várias abas seguidas só monta a última.
    function trocar(id, sub, depois) {
      if (!A.abas[id] || !abas.some((a) => a[0] === id)) id = 'conexoes'; // (0.8.7) uma aba que não existe mais (ex.: Transmitir) cai em Conexões
      const iAntes = abas.findIndex((a) => a[0] === aba), iDepois = abas.findIndex((a) => a[0] === id);
      if (aba && aba !== id) A.som.tocar('abrir');
      if (aba === id && conteudo.firstChild && depois) return;
      aba = id;
      girar();
      Object.entries(botoes).forEach(([k, b]) => { b.classList.toggle('sel', k === id); b.setAttribute('aria-selected', k === id); });
      dados.aba = id;
      A.onde = { ...(A.onde || {}), aba: id }; A.evt.emit('onde'); // (1.0.2) o Discord mostra onde você está
      if (A.cfg && A.cfg.v.ultAba !== id) { A.cfg.v.ultAba = id; A.cfg.salvar(); } // (0.8.7) o app abre na última aba em que você estava
      cancelarMontagem();
      const montar = () => {
        montagem = 0;
        // (0.8.7) as abas ficam lado a lado, como uma faixa: trocar desliza a faixa para o lado em que você foi (a de saída sai inteira pelo
        // lado, a nova entra pelo outro), sem apagar nada da tela. Primeiro só LÊ as medidas (a tela ainda está do jeito de antes, sem
        // custo), depois mexe: uma conta de layout só
        for (const pv of [...conteudo.querySelectorAll(':scope > .painel.saindo')]) if (pv._fim) pv._fim(); // um clique no meio de outra troca: a anterior termina na hora
        const desliza = iAntes >= 0 && iAntes !== iDepois && raiz.dataset.anim !== 'nenhuma' && raiz.dataset.visual !== 'lite' && !document.hidden;
        // (0.8.7) o mesmo lado para onde o carrossel girou: o caminho mais curto dando a volta (de Desenvolvedor para Conexões continua para a frente)
        const passo = (((iDepois - iAntes) % abas.length) + abas.length) % abas.length, dir = passo > abas.length / 2 ? -1 : 1;
        // (1.0.2) voltar para a mesma aba guardada antes de a troca ser montada (clique rápido de ida e volta, ou PC ocupado): ela não "sai"
        // (antes deslizava para fora e, no fim da animação, era guardada já aberta: a aba ficava vazia)
        const sai0 = abaViva && guardadas.get(abaViva.id) === abaViva ? abaViva : null, sai = sai0 && sai0.id !== id ? sai0 : null;
        const velho = sai0 && !sai ? null : sai ? sai.painel : conteudo.querySelector(':scope > .painel:not(.guardado)');
        // (0.9.4) sem deslizar (versão otimizada, sem animação): nada para medir. Ler as medidas obrigava o navegador a refazer o layout
        // da tela inteira antes da troca, e de novo depois dela
        const rol = desliza ? conteudo.scrollTop : 0, alturaVista = desliza ? conteudo.clientHeight : 0;
        const medida = velho ? (desliza ? { w: velho.offsetWidth, x: velho.offsetLeft, y: velho.offsetTop, h: velho.offsetHeight } : {}) : null;
        const topoFora = topo.parentNode !== casa, topoH = topoFora && desliza ? topo.offsetHeight : 0;
        const largura = (medida && medida.w) || (desliza ? conteudo.clientWidth : 0);
        // a bolha volta para a casa; no lugar dela, dentro da aba que sai, fica uma vaga do mesmo tamanho (a aba não se mexe por dentro
        // enquanto desliza nem enquanto está guardada, e a bolha volta exatamente para ali)
        if (topoFora) { const vaga = h('div', { class: 'topo-vaga', 'aria-hidden': 'true', estilo: desliza ? { height: topoH + 'px', 'flex-shrink': '0' } : { 'flex-shrink': '0' } }); topo.parentNode.insertBefore(vaga, topo); casa.insertBefore(topo, casa.firstChild); acalmar(topo); }
        // a aba que sai: presa no lugar em que estava (fora do fluxo), guardada (escondida e parada) ou desmontada depois de sair da tela
        if (velho && medida) {
          const ini = desliza ? Math.max(0, rol - medida.y) : 0;
          if (desliza) Object.assign(velho.style, { left: medida.x + 'px', top: Math.max(0, medida.y - rol) + 'px', width: medida.w + 'px', height: Math.max(0, Math.min(medida.h - ini, alturaVista)) + 'px' });
          velho.inert = true; velho.style.animation = 'none';
          if (sai && sai.r.pausar) { try { sai.r.pausar(); } catch (e) { A.log.erro('pausar aba', e); } }
          const limparVelho = sai ? null : limparAba;
          let feito = false;
          const fim = () => {
            if (feito) return; feito = true; // (1.0.2) uma vez só: pelo fim da animação ou pela garantia logo abaixo
            velho._fim = null; if (velho._anim) { velho._anim.cancel(); velho._anim = null; }
            velho.classList.remove('saindo');
            if (sai) velho.classList.add('guardado');
            else { if (limparVelho) { try { limparVelho(); } catch (e) { A.log.erro('limpar aba', e); } } velho.remove(); }
          };
          if (desliza) {
            velho.classList.add('saindo'); velho._fim = fim;
            if (ini) velho.scrollTop = ini;
            velho._anim = velho.animate([{ transform: 'none' }, { transform: `translateX(${-dir * (largura + 28)}px)` }], { duration: 380, easing: 'cubic-bezier(.4, 0, .2, 1)' });
            velho._anim.onfinish = fim;
            setTimeout(fim, 700); // (1.0.2) janela atrás de outra ou PC ocupado: a animação pode não terminar, e a aba velha ficava parada no meio da tela
          } else fim();
        }
        ctx.lateral(null); // (0.8.7) depois de pausar: a aba que sai guarda antes a rolagem do que ela tinha na coluna da esquerda
        limparAba = null; abaViva = null;
        for (const n of [...conteudo.childNodes]) if (n !== velho && !n.classList?.contains('saindo') && ![...guardadas.values()].some((g) => g.painel === n)) n.remove();
        const g = guardadas.get(id);
        let painel;
        if (g) {
          painel = g.painel; painel.classList.remove('guardado', 'morf', 'volta'); painel.inert = false;
          for (const k of ['left', 'top']) painel.style[k] = '';
        } else painel = h('div', { class: 'painel' });
        // a que entra: vem do lado oposto ao que a outra saiu (sem sumir e reaparecer). A primeira aba, ao abrir o app, tem a entrada de sempre
        if (desliza || g) painel.style.animation = 'none';
        if (desliza && velho) { const an = painel.animate([{ transform: `translateX(${dir * (largura + 28)}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.4, 0, .2, 1)' }); setTimeout(() => { if (an.playState === 'running') an.finish(); }, 700); } // (1.0.2) a nova nunca fica parada fora do lugar
        let r;
        if (g) r = g.r;
        else {
          conteudo.append(painel);
          r = A.abas[id](painel, ctx, sub) || {};
          if (GUARDAR.has(id) && r.pausar) guardadas.set(id, { id, painel, r });
        }
        abaViva = guardadas.get(id) || null;
        const comTk = !!painel.querySelector(':scope > .tk'); painel.classList.toggle('com-tk', comTk); conteudo.classList.toggle('com-tk', comTk); // (0.5.9-9) antes: ":has(> .tk)" no CSS
        painel.classList.toggle('com-conex', !!painel.querySelector(':scope > .conex-area'));
        limparAba = abaViva ? null : r.limpar;
        posicionarTopo();
        // (0.9.4) a rolagem volta ao topo só agora, depois de todas as mudanças: mexer nela no meio obrigava um layout a mais
        conteudo.scrollTop = 0; if (g) painel.scrollTop = 0;
        if (g) { painel.style.width = painel.style.height = ''; if (r.retomar) { try { r.retomar(sub); } catch (e) { A.log.erro('retomar aba', e); } } }
      };
      if (!depois || document.hidden) return montar();
      montagem = requestAnimationFrame(() => { montagem = setTimeout(montar, 0); });
    }

    // avisos ao vivo: amigo ficou online, pedido de amizade chegou
    const offs = [];
    const contarPedidos = () => { const n = H.amigos.filter((a) => a.estado === 'recebido').length + ((A.talk && A.talk.naoLidas) || 0), tx = n > 99 ? '99+' : String(n); if (selos.talk.hidden === !n && selos.talk.textContent === tx) return; selos.talk.hidden = !n; U.marcarSelo(selos.talk); selos.talk.textContent = tx; }; // (0.8.3) igual ao de antes: não mexe na barra
    offs.push(A.evt.on('talk:lista', contarPedidos));
    // (0.8.3) desenvolvedor: quantos feedbacks ainda não lidos (a bolinha na aba)
    if (selos.dev) { const fb = () => { const n = (A.admin && A.admin.fb && A.admin.fb.n) || 0; selos.dev.hidden = !n; U.marcarSelo(selos.dev); selos.dev.textContent = n > 99 ? '99+' : n; }; offs.push(A.evt.on('fb:novos', fb)); fb(); if (A.admin && A.admin.contarFb) A.admin.contarFb(); }
    let amigosAntes = new Set(H.amigos.filter((a) => a.estado === 'recebido').map((a) => a.codigo));
    offs.push(A.evt.on('hub:amigos', () => {
      contarPedidos();
      H.amigos.filter((a) => a.estado === 'recebido' && !amigosAntes.has(a.codigo)).forEach((a) => {
        if (!U.naoPerturbe(a.codigo)) { U.toast(h('span', {}, h('b', {}, a.nome), ' ', T('quer ser seu amigo', 'wants to be your friend')), { avatar: a, som: 'msg', ms: 7000, acoes: [{ texto: T('Aceitar', 'Accept'), tipo: 'ok', onclick: () => API.amigos.aceitar(a.codigo) }] }); U.notificar(T('Pedido de amizade', 'Friend request'), a.nome + T(' quer ser seu amigo', ' wants to be your friend')); }
      });
      amigosAntes = new Set(H.amigos.filter((a) => a.estado === 'recebido').map((a) => a.codigo));
    }));
    offs.push(A.evt.on('hub:presenca', ({ p, novo }) => {
      // (0.6.0) só para os amigos em que você ligou "Avisar quando ficar online" (no perfil deles), e só quando a pessoa chega (o 1º aparelho)
      const a = H.amigos.find((x) => x.codigo === p.codigo);
      if (novo && a && a.avisarOnline && p.estado === 'online' && H.dispositivosDe(p.codigo).length === 1 && !U.naoPerturbe(p.codigo)) { U.toast(h('span', {}, h('b', {}, a.apelido || p.nome), ' ', T('ficou online', 'is now online')), { avatar: p, som: 'online', ms: 3600 }); U.notificar(a.apelido || p.nome, T('ficou online', 'is now online')); }
    }));
    offs.push(A.evt.on('hub:sessao-invalida', () => dados.sair && dados.sair()));
    const ciclar = (d) => {
      if (document.querySelector('#modais .fundo-modal')) return;
      const i = abas.findIndex((a) => a[0] === aba), id = abas[(i + d + abas.length) % abas.length][0];
      trocar(id);
      if (document.documentElement.dataset.entrada === 'pad') { botoes[id].focus({ preventScroll: true }); if (A.pad.entrarQuandoPronto) A.pad.entrarQuandoPronto('painel', botoes[id]); } // (1.0.0) o foco já entra no conteúdo da aba nova
    };
    offs.push(A.evt.on('pad:rb', () => ciclar(1)), A.evt.on('pad:lb', () => ciclar(-1)));
    offs.push(A.evt.on('abrir-config', (sub) => trocar('config', sub)));
    offs.push(A.evt.on('abrir-aba', (x) => { const id = typeof x === 'string' ? x : x.id; if (aba !== id) trocar(id, x.sub); }));
    contarPedidos();
    trocar(dados.aba || (A.cfg && A.cfg.v.ultAba) || 'conexoes');
    return { limpar() { cancelarMontagem(); offs.forEach((f) => f()); offB(); offR(); largo.removeEventListener('change', remontar); abrirDoca(false); if (limparAba) limparAba(); soltarGuardadas(); } };
  };
})();
