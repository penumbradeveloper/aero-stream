// Aero Stream - termos de serviço (a tela de aceitar, ao criar a conta e ao entrar) e os créditos. Criado por Ryan Victtor.
// Os termos completos ficam no site (site/termos.html e site/en/termos.html); aqui vai o resumo e o link para ler tudo.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, U = A.ui, API = A.api;
  const L = (A.legal = {});
  L.V = 1; // a versão dos termos: subiu, todo mundo vê a tela de aceitar de novo
  const SITE = 'https://web.aerostream.workers.dev/';
  L.url = () => SITE + (A.idioma() === 'en' ? 'en/termos.html' : 'termos.html');
  L.abrir = () => U.abrirFora(L.url());

  // ---------- o link "Termos de Serviço" (no criar conta, nas configurações) ----------
  L.link = (texto) => h('a', { href: L.url(), class: 'legal-link', onclick: (e) => { e.preventDefault(); L.abrir(); } }, texto || T('Termos de Serviço', 'Terms of Service'));
  // a caixinha do criar conta: sem marcar, a conta não é criada
  L.caixaCriar = () => {
    const c = h('input', { type: 'checkbox', class: 'legal-check' });
    const el = h('label', { class: 'linha peq legal-aceite' }, c, h('span', {}, T('Li e aceito os ', 'I have read and accept the '), L.link(), '.'));
    return { el, marcado: () => c.checked, focar: () => c.focus() };
  };

  // ---------- a tela de aceitar (quem já tinha conta, ou quando os termos mudam) ----------
  const PONTOS = () => [
    ['coracao', T('O Aero é um projeto independente, feito por uma pessoa só, e é oferecido como está. A gente faz o possível para ele funcionar sempre.', 'Aero is an independent project made by one person and is provided as is. We do our best to keep it working.')],
    ['cadeado', T('As suas conversas são cifradas de ponta a ponta: ninguém lê o que você escreve, nem a gente. Guardamos só o mínimo para a conta e a segurança funcionarem, e nunca vendemos os seus dados.', 'Your chats are end-to-end encrypted: nobody reads what you write, not even us. We keep only the minimum for your account and security, and never sell your data.')],
    ['escudo', T('Nada de conteúdo ilegal, assédio, golpes ou invasão. Skins, CSS, integrações, fundos e perfis são para enfeitar, nunca para enganar, rastrear, esconder avisos ou travar o app de alguém.', 'No illegal content, harassment, scams or hacking. Skins, CSS, integrations, backgrounds and profiles are for decoration, never to deceive, track, hide warnings or crash someone\'s app.')],
    ['estrela', T('Aero Bubble: no cartão renova todo mês e você cancela quando quiser; no PIX vale 1 mês. Você tem 7 dias para se arrepender da compra.', 'Aero Bubble: on a card it renews monthly and you can cancel anytime; PIX lasts 1 month. You have 7 days to change your mind about a purchase.')],
    ['cartao', T('Quem vende skins ou integrações na Comunidade recebe pelo Mercado Pago o valor da venda menos a comissão do Aero e as taxas do Mercado Pago.', 'Creators who sell skins or integrations in the Community get paid through Mercado Pago: the sale price minus Aero\'s commission and Mercado Pago\'s fees.')],
    ['bloquear', T('Quem quebra as regras pode ter a conta suspensa ou banida.', 'Accounts that break the rules may be suspended or banned.')],
  ];
  let aberta = null;
  L.conferir = () => {
    const eu = API.eu; if (!eu || aberta || (eu.termos || 0) >= L.V) return;
    const check = h('input', { type: 'checkbox', class: 'legal-check' });
    const aceitar = U.btn(T('Aceitar e continuar', 'Accept and continue'), { icone: 'ok', onclick: async () => {
      if (!check.checked) return;
      aceitar.disabled = true;
      try { const r = await API.req('termos', { v: L.V }); eu.termos = r.termos || L.V; A.som.tocar('sucesso'); fechar(); }
      catch (e) { aceitar.disabled = false; U.toast(e.message || String(e), { tipo: 'erro' }); }
    } });
    aceitar.disabled = true;
    check.addEventListener('change', () => { aceitar.disabled = !check.checked; });
    const sair = U.btn(T('Sair da conta', 'Sign out'), { tipo: 'sec', onclick: async () => { fechar(); if (A.homeDados && A.homeDados.sair) await A.homeDados.sair(); } });
    const caixa = h('div', { class: 'modal vidro legal-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'legal-tit' },
      h('div', { class: 'legal-topo' }, h('img', { src: 'icon.svg', alt: '', width: 40, height: 40, draggable: 'false' }), h('div', {}, h('h2', { id: 'legal-tit' }, T('Termos de Serviço', 'Terms of Service')), h('div', { class: 'peq suave' }, T('Para continuar usando o Aero, leia e aceite.', 'To keep using Aero, please read and accept.')))),
      h('div', { class: 'legal-pontos' }, ...PONTOS().map(([ic, txt]) => h('div', { class: 'legal-ponto' }, h('span', { class: 'legal-ic', 'aria-hidden': 'true' }, A.icone(ic, 18)), h('p', {}, txt)))),
      h('div', { class: 'legal-ler' }, U.btn(T('Ler os termos completos', 'Read the full terms'), { icone: 'externo', tipo: 'sec', peq: true, onclick: L.abrir })),
      h('label', { class: 'linha legal-aceite' }, check, h('span', {}, T('Li e aceito os Termos de Serviço do Aero.', 'I have read and accept Aero\'s Terms of Service.'))),
      h('div', { class: 'linha legal-acoes' }, sair, aceitar));
    const fundo = h('div', { class: 'fundo-modal prioridade legal-fundo' }, caixa);
    // não fecha com ESC nem clicando fora: só aceitando (ou saindo da conta)
    const prende = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); } };
    document.addEventListener('keydown', prende, true);
    function fechar() { if (!aberta) return; aberta = null; document.removeEventListener('keydown', prende, true); fundo.classList.add('fechando'); setTimeout(() => fundo.remove(), 260); }
    aberta = fundo; document.body.append(fundo); A.som.tocar('janela-abrir');
  };
  A.evt.on('hub:eu', () => setTimeout(L.conferir, 400));

  // ---------- créditos ----------
  const TESTERS = ['Willian', 'Caio', 'Theran', 'Delirium', 'Xeon', 'Paula'];
  L.creditos = () => {
    const papel = (t) => h('span', { class: 'cred-papel' }, t);
    const corpo = h('div', { class: 'cred' },
      h('div', { class: 'cred-logo' }, h('img', { src: 'icon.svg', alt: '', width: 64, height: 64, draggable: 'false' }), h('div', {}, h('b', {}, 'Aero'), h('div', { class: 'peq suave' }, 'v' + A.versao))),
      h('section', { class: 'cred-bloco cred-criador' },
        h('div', { class: 'cred-rot' }, T('Criado por', 'Created by')),
        h('div', { class: 'cred-nome' }, A.autor || 'Ryan Victtor'),
        h('div', { class: 'cred-papeis' }, ...[T('Criador e ideia', 'Creator and idea'), T('Design e direção de arte', 'Design and art direction'), T('Desenvolvimento', 'Development'), T('Tester principal', 'Lead tester'), T('Debugger', 'Debugger'), T('Servidores e lançamentos', 'Servers and releases'), T('Comunidade', 'Community')].map(papel)),
        h('p', { class: 'peq suave' }, T('Imaginou o Aero, desenhou cada tela, testou cada versão em todos os aparelhos, caçou cada bug e fez tudo isso existir.', 'Imagined Aero, designed every screen, tested every version on every device, hunted every bug and made all of this exist.'))),
      h('section', { class: 'cred-bloco' },
        h('div', { class: 'cred-rot' }, T('Desenvolvido junto com', 'Built together with')),
        h('div', { class: 'cred-nome peq-nome' }, 'Claude', h('span', { class: 'suave peq' }, ' · Anthropic')),
        h('div', { class: 'cred-papeis' }, papel(T('Programação com IA', 'AI pair programming')))),
      h('section', { class: 'cred-bloco' },
        h('div', { class: 'cred-rot' }, T('Testers oficiais', 'Official testers')),
        h('div', { class: 'cred-testers' }, ...TESTERS.map((n) => h('span', { class: 'cred-tester' }, U.selos ? U.selos(['tester']) : null, n)))),
      h('p', { class: 'cred-fim peq suave' }, T('O Aero é feito por uma pessoa só, então bugs vão aparecer. Ele só fica melhor com todo mundo que usa, apoia e manda feedback. Obrigado!', 'Aero is made by one person, so bugs will show up. It only gets better thanks to everyone who uses it, supports it and sends feedback. Thank you!')));
    U.modal(T('Créditos', 'Credits'), corpo, { largura: 460, classe: 'cred-modal' });
  };
})();
