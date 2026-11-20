// Aero Stream - "Apoie / Donate": a mensagem do Ryan, Ko-fi, PIX do Nubank (QR + copia e cola) e as redes sociais.
// Usado em Configurações e na página de doação do site. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const KOFI = 'https://ko-fi.com/penumbra_dev';
  const X = 'https://x.com/penumbradev';
  const GITHUB = 'https://github.com/penumbradeveloper';
  const PIX_CHAVE = '16954d14-75a4-43eb-b87f-efb717454ec8';
  // o mesmo conteúdo do QR code do Nubank ("PIX copia e cola")
  const PIX_COPIA = '00020126580014BR.GOV.BCB.PIX013616954d14-75a4-43eb-b87f-efb717454ec85204000053039865802BR5925Ryan Victtor Fernandes de6009SAO PAULO62140510vwSNyUBTBt6304A482';

  const MSG_PT = [
    'Oi! Pra você que usa o Aero e gosta do aplicativo: eu gostaria de pedir a sua ajuda.',
    'Eu tirei um tempo para desenvolver este aplicativo (e continuo desenvolvendo) por necessidade, mas o deixei aberto ao público porque tenho certeza de que muitos de vocês têm a mesma necessidade que eu: muita gente precisa disso e é barrada por algumas determinações sem sentido.',
    'Não vou me expor muito, mas ainda moro com os meus pais e, sei que não é problema de ninguém, mas aqui em casa é muito difícil: vivo sob pressão constante e passo por outras situações difíceis. Eu preciso consertar o meu computador com peças novas, comprar uma cama e, além disso, custear o desenvolvimento do Aero, em que eu uso o Claude. Conforme mais gente usa o aplicativo, os gastos crescem e vou precisar pagar pelos servidores que mantêm contas, mensagens e salas no ar, pela retransmissão de chamadas e transmissões de quem não consegue conectar direto, pelo armazenamento de fotos e arquivos, pela assinatura que libera mais e-mails por dia (como os códigos de verificação) e pelo certificado que tira o aviso de segurança ao instalar no Windows.',
    'De qualquer forma, se você se sentir tocado, por favor, doe: qualquer centavo ajuda, eu realmente preciso. No mais, agradeço por você simplesmente usar o meu aplicativo. Obrigado, e continuemos fortes no desenvolvimento do ambiente que todos nós merecemos, um ambiente necessário.',
    'Assinaturas pensadas para não pressionar quem usa, enquanto ajudam a manter os custos do aplicativo. Sem medo de ser único, sem medo de não agradar. Paz!',
  ];
  const MSG_EN = [
    'Hi! To you who use Aero and like the app: I would like to ask for your help.',
    'I took the time to build this app (and I keep building it) out of necessity, but I made it public because I am sure many of you have the same need I do: a lot of people need this and are blocked by some senseless restrictions.',
    'I will not expose myself too much, but I still live with my parents and, I know it is nobody\'s problem, things are very hard at home: I live under constant pressure and go through other difficult situations. I need to fix my computer with new parts, buy a bed and also fund the development of Aero, where I use Claude. As more people use the app, the costs grow and I will need to pay for the servers that keep accounts, messages and rooms online, for relaying calls and streams of people who cannot connect directly, for storing photos and files, for the subscription that allows more e-mails per day (like verification codes) and for the certificate that removes the security warning when installing on Windows.',
    'Anyway, if you feel touched, please donate: every cent helps, I really need it. Other than that, thank you for simply using my app. Thank you, and let us keep strong building the environment we all deserve, a necessary environment.',
    'Subscriptions designed not to pressure anyone who uses the app, while helping keep the app running. No fear of being unique, no fear of not pleasing. Peace!',
  ];

  // link que abre fora do app (no app do PC: no navegador padrão; no site: numa aba nova)
  const link = (url, ...filhos) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'apoio-link' }, ...filhos);

  // (0.7.14) AERO BUBBLE: a assinatura. Os mesmos planos do servidor (servidor/src/bolha.js). Paga em reais pelo Mercado Pago (PIX que vale
  // 1 mês, ou cartão que renova sozinho): o plano entra sozinho assim que o pagamento cai. De fora do Brasil: Ko-fi (o plano entra pela
  // conta com o mesmo e-mail, ou pela # escrita na mensagem).
  // (0.8.1) quatro planos. É mais um apoio do que uma compra: o app continua todo de graça, e os planos dão um obrigado com limites maiores
  const PLANOS = [
    { id: 'standard', nome: 'Standard Patreon', preco: 10, cor: ['#7fd3ff', '#2d9ee0'], itens: () => [T('Anexos de até 100 MB no Aero Talk', 'Attachments up to 100 MB in Aero Talk'), T('Seus grupos com até 15 pessoas', 'Your groups with up to 15 people'), T('Insígnia Standard no seu nome', 'Standard badge next to your name')] },
    { id: 'plus', nome: 'Plus Patreon', preco: 15, cor: ['#9fe8b0', '#2fb36b'], itens: () => [T('Anexos de até 250 MB no Aero Talk', 'Attachments up to 250 MB in Aero Talk'), T('Seus grupos com até 25 pessoas', 'Your groups with up to 25 people'), T('Insígnia Plus no seu nome', 'Plus badge next to your name')] },
    { id: 'donator', nome: 'Donator', preco: 25, cor: ['#e9a6ff', '#9b4dff'], itens: () => [T('Anexos de até 500 MB no Aero Talk', 'Attachments up to 500 MB in Aero Talk'), T('Seus grupos com até 30 pessoas', 'Your groups with up to 30 people'), T('Transmitir em até 1440p 60 fps, e 120 fps até 1080p', 'Stream up to 1440p 60 fps, and 120 fps up to 1080p'),
      T('Exclusivo: o efeito de nome Diamante', 'Exclusive: the Diamond name effect'), T('Exclusivo: a insígnia de coroa', 'Exclusive: the crown badge'), T('Exclusivo: a borda animada no seu perfil', 'Exclusive: the animated border on your profile')] },
    { id: 'supporter', nome: 'Supporter', preco: 50, cor: ['#ffb3c4', '#f43f5e'], coracao: true, itens: () => [T('Tudo do Donator, e mais:', 'Everything in Donator, plus:'), T('Anexos de até 1 GB no Aero Talk', 'Attachments up to 1 GB in Aero Talk'), T('Seus grupos com até 40 pessoas', 'Your groups with up to 40 people'), T('Até 10 chats e 5 chamadas de voz em cada grupo', 'Up to 10 chats and 5 voice calls in each group'),
      T('Transmitir sem limite: até 4K e 240 fps', 'Stream with no limit: up to 4K and 240 fps'), T('5 perfis salvos para trocar num clique', '5 saved profiles to switch in one click'), T('Versões e novidades em teste antes de todo mundo, para testar e mandar a sua opinião', 'New versions and features in testing before everyone else, to try and send feedback'),
      T('Integrações da Comunidade: só o Supporter publica temas e visuais para a Comunidade; baixar e usar é para todo mundo', 'Community integrations: only Supporters can publish themes and looks to the Community; anyone can download and use them'), T('Exclusivo: a insígnia de coração e a borda animada de coração no perfil', 'Exclusive: the heart badge and the heart animated border on your profile')] },
  ];
  const KOFI_TIERS = KOFI + '/tiers';
  const dataDe = (t) => new Date(t).toLocaleDateString(A.idioma && A.idioma() === 'en' ? 'en-US' : 'pt-BR');

  // a janela de pagar: e-mail do recibo, PIX ou cartão
  function pagar(p) {
    const U = A.ui, API = A.api, eu = API.eu || {};
    let timer = 0, offEvt = null, fechou = false, para = null; // para: null = para mim; [amigos] = presente
    const escolhidos = new Map(); // (0.8.2) amigos escolhidos para o presente (código -> amigo)
    const parar = () => { fechou = true; clearTimeout(timer); if (offEvt) offEvt(); offEvt = null; };
    const corpo = h('div', { class: 'col bolha-pagar' });
    const md = U.modal('Aero Bubble · ' + p.nome, corpo, { largura: 440, aoFechar: parar, classe: 'bolha-pag-modal' });
    const pronto = (b) => {
      parar(); A.som.tocar('sucesso');
      corpo.textContent = '';
      if (para) {
        corpo.append(h('div', { class: 'bolha-pronto' }, h('span', { class: 'bolha-esfera grande', 'aria-hidden': 'true', estilo: { '--b1': p.cor[0], '--b2': p.cor[1] } }),
          h('b', {}, T('Presente entregue!', 'Gift delivered!')),
          h('div', { class: 'suave peq' }, para.length === 1 ? T((para[0].nome || '') + ' ganhou o ' + p.nome + ' por 1 mês.', (para[0].nome || '') + ' got ' + p.nome + ' for 1 month.') : T(para.length + ' amigos ganharam o ' + p.nome + ' por 1 mês.', para.length + ' friends got ' + p.nome + ' for 1 month.'))),
          h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end' } }, U.btn(T('Fechar', 'Close'), { onclick: () => md.fechar() })));
        return;
      }
      corpo.append(h('div', { class: 'bolha-pronto' }, h('span', { class: 'bolha-esfera grande', 'aria-hidden': 'true', estilo: { '--b1': p.cor[0], '--b2': p.cor[1] } }),
        h('b', {}, T('Pronto! Obrigado por apoiar.', 'Done! Thank you for your support.')),
        h('div', { class: 'suave peq' }, T('Seu plano ' + p.nome + ' está ativo', 'Your ' + p.nome + ' plan is active') + (b && b.ate ? T(' até ', ' until ') + dataDe(b.ate) : '') + '.')),
        h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end' } }, U.btn(T('Fechar', 'Close'), { onclick: () => md.fechar() })));
    };
    // o plano mudou pelo servidor (aviso ao vivo): se é este plano, terminou
    const vigiar = () => { if (!para && !offEvt) offEvt = A.evt.on('bolha', (b) => { if (b && b.plano === p.id && b.ate > Date.now()) pronto(b); }); };
    const email = h('input', { class: 'campo', type: 'email', value: eu.email || '', placeholder: T('seu@email.com', 'you@email.com'), autocomplete: 'email', spellcheck: 'false', maxlength: 254 });
    const erroEl = h('div', { class: 'peq bolha-erro', hidden: true });
    const falhou = (e) => { erroEl.textContent = (e && e.message) || String(e); erroEl.hidden = false; };
    const opcao = (ic, titulo, sub, agir) => { const b = h('button', { type: 'button', class: 'bolha-opcao', onclick: async () => { erroEl.hidden = true; b.disabled = true; try { await agir(); } catch (e) { falhou(e); } b.disabled = false; } }, h('span', { class: 'bolha-opcao-ic' }, A.icone(ic, 22)), h('span', {}, h('b', {}, titulo), h('small', {}, sub))); return b; };
    const emailDe = () => { const v = email.value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { email.focus(); throw new Error(T('Escreva um e-mail válido.', 'Type a valid e-mail.')); } return v; };
    let anual = false; // (1.0.0) plano anual no PIX: paga 10 meses e leva 12
    const total = () => Math.round(p.preco * (para ? para.length : anual ? 10 : 1) * 100) / 100;
    const reais = (v) => 'R$ ' + (Number.isInteger(v) ? v : v.toFixed(2).replace('.', ','));
    const voltar = (f) => U.btn(T('Voltar', 'Back'), { icone: 'voltar', tipo: 'sec', peq: true, onclick: () => { erroEl.hidden = true; f(); } });
    // (0.8.2) primeiro: para quem é
    const escolher = () => {
      para = null; corpo.textContent = '';
      corpo.append(
        h('div', { class: 'bolha-valor' }, h('span', {}, reais(p.preco)), h('small', {}, T('/mês', '/month'))),
        h('div', { class: 'col', estilo: { gap: '8px' } },
          opcao('pessoa', T('Para mim', 'For me'), T('O plano fica na sua conta.', 'The plan goes to your account.'), async () => inicio()),
          opcao('presente', T('Presente', 'Gift'), T('1 mês do plano para os amigos que você escolher. O valor soma por amigo.', '1 month of the plan for the friends you choose. The price adds up per friend.'), async () => amigosTela())));
    };
    // (0.8.2) o presente: a lista de amigos com pesquisa; escolha quantos quiser (até 20) e o valor soma
    const precoDe = (id) => ((PLANOS.find((x) => x.id === id) || {}).preco || 0);
    const amigosTela = () => {
      corpo.textContent = '';
      const amigos = ((A.hub && A.hub.amigos) || []).filter((a) => a.estado === 'aceita').sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      const busca = h('input', { class: 'campo', type: 'search', placeholder: T('Pesquisar amigos...', 'Search friends...'), 'aria-label': T('Pesquisar amigos', 'Search friends'), spellcheck: 'false' });
      const lista = h('div', { class: 'bolha-amigos', role: 'group', 'aria-label': T('Amigos', 'Friends') });
      const resumo = h('div', { class: 'bolha-resumo' });
      const seguir = U.btn(T('Continuar', 'Continue'), { onclick: () => { para = [...escolhidos.values()]; inicio(); } });
      const pintarResumo = () => {
        const n = escolhidos.size;
        resumo.replaceChildren(h('span', {}, n ? (n === 1 ? T('1 amigo', '1 friend') : T(n + ' amigos', n + ' friends')) : T('Ninguém escolhido', 'No one chosen')), h('b', {}, reais(Math.round(p.preco * Math.max(n, 0) * 100) / 100)));
        seguir.disabled = !n;
      };
      const pintarLista = () => {
        const q = busca.value.trim().toLowerCase().replace(/^#/, '');
        const vis = amigos.filter((a) => !q || (a.nome || '').toLowerCase().includes(q) || (a.tag || '').toLowerCase().includes(q));
        if (!amigos.length) { lista.replaceChildren(h('div', { class: 'peq suave bolha-amigos-vazio' }, T('Você ainda não tem amigos no Aero para presentear.', 'You have no friends on Aero to gift yet.'))); return; }
        if (!vis.length) { lista.replaceChildren(h('div', { class: 'peq suave bolha-amigos-vazio' }, T('Ninguém com esse nome.', 'No one with that name.'))); return; }
        lista.replaceChildren(...vis.map((a) => {
          const maior = (a.sl || []).find((x) => precoDe(x) > p.preco);
          const cx = h('input', { type: 'checkbox', checked: escolhidos.has(a.codigo), disabled: !!maior });
          cx.addEventListener('change', () => {
            if (cx.checked && escolhidos.size >= 20) { cx.checked = false; U.toast(T('Dá para presentear até 20 amigos de uma vez.', 'You can gift up to 20 friends at once.')); return; }
            if (cx.checked) escolhidos.set(a.codigo, a); else escolhidos.delete(a.codigo);
            linha.classList.toggle('sel', cx.checked); pintarResumo();
          });
          const linha = h('label', { class: 'bolha-amigo' + (escolhidos.has(a.codigo) ? ' sel' : '') + (maior ? ' off' : '') }, cx, U.avatar(a, 34),
            h('span', { class: 'cresce bolha-amigo-nome' }, h('b', {}, a.nome || ''), h('small', {}, maior ? T('Já tem um plano maior', 'Already has a bigger plan') : a.tag ? '#' + a.tag : '')));
          return linha;
        }));
      };
      busca.addEventListener('input', pintarLista);
      pintarLista(); pintarResumo();
      corpo.append(h('b', {}, T('Para quem é o presente?', 'Who is the gift for?')), busca, lista, resumo, h('div', { class: 'linha entre' }, voltar(escolher), seguir));
      setTimeout(() => busca.focus(), 60);
    };
    const inicio = () => {
      anual = false;
      corpo.textContent = '';
      corpo.append(
        h('div', { class: 'bolha-valor' }, h('span', {}, reais(total())), h('small', {}, para ? (para.length > 1 ? T(' (' + para.length + ' × ' + reais(p.preco) + ')', ' (' + para.length + ' × ' + reais(p.preco) + ')') : T(' por 1 mês', ' for 1 month')) : T('/mês', '/month'))),
        para ? h('div', { class: 'bolha-para' }, h('span', { class: 'peq suave' }, T('Presente para:', 'Gift for:')), ...para.map((a) => h('span', { class: 'bolha-chip' }, U.avatar(a, 20), a.nome || ''))) : null,
        h('label', { class: 'col', estilo: { gap: '6px' } }, h('span', { class: 'rot' }, T('E-mail para o recibo', 'E-mail for the receipt')), email),
        h('div', { class: 'col', estilo: { gap: '8px' } },
          opcao('pix', 'PIX', para ? T('Cada amigo ganha 1 mês. O presente entra assim que o PIX cair.', 'Each friend gets 1 month. The gift turns on as soon as the PIX lands.') : T('Vale 1 mês. O plano entra assim que o PIX cair.', 'Lasts 1 month. The plan turns on as soon as the PIX lands.'), comPix),
          para ? null : opcao('pix', T('PIX anual', 'Yearly PIX'), T('12 meses pagando 10 (', '12 months for the price of 10 (') + reais(p.preco * 10) + T('). Não renova sozinho.', '). Does not renew by itself.'), async () => { anual = true; try { await comPix(); } catch (e) { anual = false; throw e; } }),
          opcao('cartao', T('Cartão', 'Card'), para ? T('Pagamento único, não renova.', 'One-time payment, does not renew.') : T('Renova sozinho todo mês. Cancele quando quiser.', 'Renews every month by itself. Cancel anytime.'), comCartao)),
        h('div', { class: 'linha' }, voltar(para ? amigosTela : escolher)),
        erroEl,
        h('div', { class: 'peq suave' }, T('O pagamento é feito pelo Mercado Pago. O e-mail vai só para o recibo; o Aero não vê o seu cartão nem o seu CPF.', 'Payment goes through Mercado Pago. The e-mail is only for the receipt; Aero never sees your card or ID number.')));
    };
    async function comPix() {
      const r = await API.req('bolha/pix', { plano: p.id, email: emailDe(), ...(para ? { para: para.map((a) => a.codigo) } : anual ? { anual: true } : {}) });
      vigiar();
      const status = h('div', { class: 'bolha-espera peq' }, h('span', { class: 'bolha-girando', 'aria-hidden': 'true' }), h('span', {}, T('Esperando o pagamento…', 'Waiting for the payment…')));
      const copiar = U.btn(T('Copiar código PIX', 'Copy PIX code'), { icone: 'copiar', onclick: (e) => U.copiar(r.codigo, e.currentTarget) });
      corpo.textContent = '';
      corpo.append(
        h('div', { class: 'bolha-valor' }, h('span', {}, reais(total())), h('small', {}, anual ? T('PIX · 12 meses', 'PIX · 12 months') : 'PIX')),
        r.qr ? h('img', { class: 'bolha-qr', src: 'data:image/png;base64,' + r.qr, alt: T('QR Code do PIX', 'PIX QR code'), width: 200, height: 200 }) : null,
        h('div', { class: 'peq suave', estilo: { 'text-align': 'center' } }, A.plat && (A.plat.celular || A.plat.toque) ? T('Copie o código e cole no app do seu banco, em "PIX copia e cola".', 'Copy the code and paste it in your bank app, under "PIX copy & paste".') : T('Aponte a câmera do app do banco para o QR Code, ou copie o código.', 'Point your bank app camera at the QR code, or copy the code.')),
        h('code', { class: 'selecionavel bolha-codigo' }, r.codigo),
        copiar, status,
        h('div', { class: 'peq suave', estilo: { 'text-align': 'center' } }, T('O código vale 30 minutos. Pode fechar esta janela: o plano entra mesmo assim.', 'The code lasts 30 minutes. You can close this window: the plan turns on anyway.')));
      // confere de tempos em tempos (não depende só do aviso do Mercado Pago)
      const conferir = async () => {
        if (fechou) return;
        if (Date.now() > r.expira) { status.textContent = T('O código expirou. Feche e gere outro.', 'The code expired. Close and create a new one.'); return; }
        try {
          const c = await API.req('bolha/pix/' + r.id);
          if (c.status === 'pago') { if (c.bolha && API.eu && !para) { API.eu.bolha = c.bolha; A.evt.emit('bolha', c.bolha); } pronto(c.bolha); return; }
          if (c.status === 'cancelado') { status.textContent = T('O pagamento foi recusado. Feche e tente de novo.', 'The payment was declined. Close and try again.'); return; }
        } catch (_) { /* tenta de novo */ }
        timer = setTimeout(conferir, 4000);
      };
      timer = setTimeout(conferir, 4000);
    }
    async function comCartao() {
      const r = await API.req('bolha/cartao', { plano: p.id, email: emailDe(), ...(para ? { para: para.map((a) => a.codigo) } : {}) });
      vigiar();
      corpo.textContent = '';
      corpo.append(
        h('div', { class: 'bolha-valor' }, h('span', {}, reais(total())), h('small', {}, para ? T(' no cartão', ' on card') : T('/mês no cartão', '/month on card'))),
        para ? h('div', { class: 'peq suave' }, T('Termine o pagamento na página do Mercado Pago. Assim que for aprovado, seus amigos recebem o plano e um aviso.', 'Finish the payment on the Mercado Pago page. As soon as it is approved, your friends get the plan and a notice.')) : h('div', { class: 'peq suave' }, T('Termine a assinatura na página do Mercado Pago (entre com a conta do e-mail que você escreveu). Assim que for aprovada, o plano entra sozinho aqui.', 'Finish the subscription on the Mercado Pago page (sign in with the account of the e-mail you typed). As soon as it is approved, the plan turns on here by itself.')),
        link(r.link, h('span', { class: 'apoio-acao' }, T('Continuar no Mercado Pago', 'Continue on Mercado Pago'))),
        h('div', { class: 'bolha-espera peq' }, h('span', { class: 'bolha-girando', 'aria-hidden': 'true' }), h('span', {}, T('Esperando a aprovação…', 'Waiting for approval…'))));
    }
    escolher();
  }
  async function cancelarCartao(btn) {
    const U = A.ui;
    const ok = await new Promise((res) => U.modal(T('Cancelar a renovação?', 'Cancel the renewal?'), h('p', {}, T('O cartão não será mais cobrado. O seu plano continua até a data já paga.', 'Your card will not be charged again. Your plan stays until the date already paid.')), { largura: 400, acoes: [{ texto: T('Voltar', 'Back'), tipo: 'sec', valor: false }, { texto: T('Cancelar renovação', 'Cancel renewal'), valor: true }], aoFechar: res }));
    if (!ok) return;
    btn.disabled = true;
    try { const r = await A.api.req('bolha/cancelar', {}); if (A.api.eu) A.api.eu.bolha = r.bolha; A.evt.emit('bolha', r.bolha); U.toast(T('Renovação cancelada.', 'Renewal canceled.'), { ms: 2500 }); } catch (e) { btn.disabled = false; U.toast(e.message, { tipo: 'erro' }); }
  }
  function bolha() {
    const caixa = h('div', { class: 'bolha-sec' });
    const pintar = () => {
      const U = A.ui, eu = A.api && A.api.eu, b = eu && eu.bolha, meu = b && b.plano, mp = !!(b && b.mp);
      const botao = (p) => mp ? h('button', { type: 'button', class: 'apoio-acao bolha-assinar', onclick: () => pagar(p) }, meu === p.id ? T('Renovar', 'Renew') : T('Assinar', 'Subscribe')) : link(KOFI_TIERS, h('span', { class: 'apoio-acao' }, T('Assinar', 'Subscribe')));
      const cartoes = PLANOS.map((p) => h('div', { class: 'bolha-plano' + (meu === p.id ? ' meu' : ''), estilo: { '--b1': p.cor[0], '--b2': p.cor[1] } },
        h('div', { class: 'bolha-esfera', 'aria-hidden': 'true' }),
        h('b', { class: 'bolha-nome' }, p.coracao ? h('span', { class: 'bolha-coracao', 'aria-hidden': 'true' }, A.icone('coracao', 16)) : null, p.nome, U.selos ? U.selos([p.id]) : null),
        h('div', { class: 'bolha-preco' }, h('span', {}, 'R$ ' + p.preco), h('small', {}, T('/mês', '/month'))),
        h('ul', {}, ...p.itens().map((x) => h('li', {}, A.icone('ok', 14), h('span', {}, x)))),
        meu === p.id ? h('div', { class: 'bolha-ativo' }, T('Seu plano', 'Your plan') + (b.ate ? ' · ' + T('até ', 'until ') + dataDe(b.ate) : '') + (b.cartao ? ' · ' + T('renova sozinho', 'auto-renews') : '')) : null,
        meu === p.id && b.cartao ? h('button', { type: 'button', class: 'bolha-cancelar peq', onclick: (e) => cancelarCartao(e.currentTarget) }, T('Cancelar renovação', 'Cancel renewal'))
          : meu === p.id && !b.ate ? null : botao(p)));
      caixa.textContent = '';
      caixa.append(
        h('div', { class: 'apoio-topo' }, h('span', { class: 'bolha-logo', 'aria-hidden': 'true' }), h('div', {}, h('h3', {}, 'Aero Bubble'), h('div', { class: 'suave peq' }, T('A assinatura é mais um apoio do que uma compra: ela ajuda a pagar os custos do aplicativo e, como obrigado, dá limites maiores e alguns mimos. Sem ela, tudo continua de graça (anexos de até 10 MB, grupos de até 10 pessoas e transmissão até 1080p 60 fps).', 'The subscription is more of a support than a purchase: it helps pay for the app and, as a thank-you, gives bigger limits and a few extras. Without it, everything stays free (attachments up to 10 MB, groups up to 10 people and streaming up to 1080p 60 fps).')))),
        h('div', { class: 'bolha-grade' }, ...cartoes),
        h('div', { class: 'peq suave bolha-como' }, mp
          ? h('span', {}, T('Pague em reais pelo Mercado Pago, com PIX (vale 1 mês) ou cartão (renova sozinho todo mês). O plano entra sozinho assim que o pagamento cai. De fora do Brasil? ', 'Pay in reais through Mercado Pago, with PIX (lasts 1 month) or card (renews every month). The plan turns on by itself as soon as the payment lands. Outside Brazil? '), h('a', { href: KOFI_TIERS, target: '_blank', rel: 'noopener noreferrer' }, T('assine pelo Ko-fi', 'subscribe on Ko-fi')), T(' com o mesmo e-mail da sua conta.', ' with the same e-mail as your account.'))
          : T('Assine no Ko-fi com o mesmo e-mail da sua conta do Aero (ou escreva a sua # na mensagem): o plano entra sozinho em alguns segundos.', 'Subscribe on Ko-fi with the same e-mail as your Aero account (or write your # in the message): the plan turns on by itself in a few seconds.') + (eu && eu.tag ? T(' Sua #: ', ' Your #: ') + eu.tag : '')));
    };
    pintar();
    const off = A.evt.on('bolha', () => { if (!caixa.isConnected) { off && off(); return; } pintar(); });
    return caixa;
  }
  function secao() {
    const U = A.ui;
    const ingles = A.idioma && A.idioma() === 'en';
    const msg = h('div', { class: 'apoio-msg' }, ...(ingles ? MSG_EN : MSG_PT).map((p) => h('p', {}, p)), h('p', { class: 'apoio-assina' }, '— Ryan Victtor'));
    const kofi = link(KOFI, h('span', { class: 'apoio-ic kofi' }, A.icone('cafe', 26)), h('span', {}, h('b', {}, 'Ko-fi'), h('small', {}, T('cartão e PayPal, de qualquer país', 'card and PayPal, from any country')), h('span', { class: 'apoio-acao' }, T('Doar no Ko-fi', 'Donate on Ko-fi'))), A.icone('externo', 16));
    const btnChave = U.btn(T('Copiar chave', 'Copy key'), { icone: 'copiar', tipo: 'sec', peq: true, onclick: (e) => U.copiar(PIX_CHAVE, e.currentTarget) });
    const btnCopia = U.btn(T('PIX copia e cola', 'PIX copy & paste'), { icone: 'copiar', tipo: 'sec', peq: true, onclick: (e) => U.copiar(PIX_COPIA, e.currentTarget) });
    const pix = h('div', { class: 'apoio-pix' },
      h('img', { src: 'img/pix-nubank.svg', alt: T('QR code PIX do Nubank', 'Nubank PIX QR code'), class: 'apoio-qr', width: 180, height: 180 }),
      h('div', { class: 'col', estilo: { gap: '8px', 'min-width': 0, flex: '1 1 200px' } },
        h('b', {}, T('PIX · Nubank', 'PIX · Nubank (Brazil)')),
        h('div', { class: 'peq suave' }, T('Chave aleatória', 'Random key')),
        h('code', { class: 'selecionavel apoio-chave' }, PIX_CHAVE),
        h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap' } }, btnChave, btnCopia)));
    const redes = h('div', { class: 'apoio-redes' },
      link(X, h('span', { class: 'apoio-ic x' }, A.icone('xlogo', 20)), h('span', {}, h('b', {}, 'X (Twitter)'), h('small', {}, '@penumbradev')), A.icone('externo', 16)),
      link(GITHUB, h('span', { class: 'apoio-ic gh' }, A.icone('estrela', 20)), h('span', {}, h('b', {}, 'GitHub'), h('small', {}, 'penumbradeveloper')), A.icone('externo', 16)));
    return h('div', { class: 'apoio' },
      h('div', { class: 'apoio-topo' }, h('span', { class: 'apoio-coracao' }, A.icone('coracao', 30)), h('div', {}, h('h3', {}, T('Apoie o Aero', 'Support Aero')), h('div', { class: 'suave peq' }, 'Donate'))),
      msg, bolha(), h('div', { class: 'apoio-grade' }, kofi, pix), h('div', { class: 'rot', estilo: { 'margin-top': '14px' } }, T('Me acompanhe', 'Follow me')), redes);
  }

  // (0.8.2) a assinatura da própria pessoa (Configurações > Conta): o plano, se renova sozinho, quando vence ou renova e cancelar o cartão
  const ORIGEM = () => ({ cartao: T('Cartão (Mercado Pago)', 'Card (Mercado Pago)'), 'mp-cartao': T('Cartão (Mercado Pago)', 'Card (Mercado Pago)'), pix: 'PIX (Mercado Pago)', 'mp-pix': 'PIX (Mercado Pago)', kofi: 'Ko-fi', nubank: 'PIX', presente: T('Presente', 'Gift'), dev: T('Dado pelo desenvolvedor', 'Given by the developer'), manual: T('Dado pelo desenvolvedor', 'Given by the developer'), outro: T('Outro', 'Other') });
  const dataLonga = (t) => new Date(t).toLocaleDateString(A.idioma && A.idioma() === 'en' ? 'en' : 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const linhaInfo = (rot, val) => h('div', { class: 'ass-linha' }, h('span', { class: 'suave' }, rot), h('b', {}, val));
  // (1.0.0) o presente da fidelidade do Supporter: escolhe um amigo e ele ganha 1 mês de Standard
  function darPresenteFiel() {
    const U = A.ui, API = A.api, amigos = ((A.hub && A.hub.amigos) || []).filter((a) => a.estado === 'aceita');
    const lista = h('div', { class: 'col', estilo: { gap: '4px', 'max-height': '320px', 'overflow-y': 'auto', padding: '4px' } });
    const m = U.modal(T('Para quem é o presente?', 'Who is the gift for?'), [lista], { largura: 400, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec' }] });
    if (!amigos.length) lista.append(h('p', { class: 'suave' }, T('Você ainda não tem amigos no Aero.', 'You have no friends on Aero yet.')));
    for (const a of amigos) lista.append(h('button', { type: 'button', class: 'linha bolha-chip', estilo: { gap: '8px', padding: '6px 10px' }, onclick: async () => {
      try { const r = await API.req('bolha/presente-fiel', { para: a.codigo }); if (r.bolha && API.eu) { API.eu.bolha = r.bolha; A.evt.emit('bolha', r.bolha); } U.toast(T('Presente enviado para ', 'Gift sent to ') + (a.nome || ''), { tipo: 'ok' }); m.fechar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
    } }, U.avatar(a, 24), h('span', {}, a.apelido || a.nome || '')));
  }
  function secaoAssinatura() {
    const caixa = h('div', { class: 'ass-caixa col' });
    const pintar = () => {
      const U = A.ui, b = (A.api && A.api.eu && A.api.eu.bolha) || {}, P = PLANOS.find((p) => p.id === b.plano);
      caixa.textContent = '';
      if (!P) {
        caixa.append(h('p', { class: 'suave', estilo: { margin: 0 } }, T('Você não tem o Aero Bubble agora.', "You don't have Aero Bubble right now.")),
          h('div', { class: 'linha' }, U.btn(T('Ver os planos', 'See the plans'), { icone: 'coracao', tipo: 'sec', peq: true, onclick: () => { if (A.cfgPagina) A.cfgPagina('apoio', true); const g = document.getElementById('grupo-apoio'); if (!g) return; setTimeout(() => (g.querySelector('.bolha-sec') || g).scrollIntoView({ behavior: 'smooth', block: 'start' }), 260); } })));
        return;
      }
      const cancelada = !b.cartao && /cartao/.test(b.origem || '') && b.ate;
      const estado = b.cartao ? T('Ativa · renova sozinha', 'Active · renews automatically') : cancelada ? T('Renovação cancelada', 'Renewal canceled') : T('Ativa', 'Active');
      const quando = !b.ate ? [T('Prazo', 'Ends'), T('Sem prazo', 'No end date')] : b.cartao ? [T('Próxima cobrança', 'Next charge'), dataLonga(b.ate)] : [T('Vale até', 'Valid until'), dataLonga(b.ate)];
      caixa.append(
        h('div', { class: 'ass-topo', estilo: { '--b1': P.cor[0], '--b2': P.cor[1] } }, h('span', { class: 'ass-bola', 'aria-hidden': 'true' }, U.selos ? U.selos([P.id]) : null), h('div', { class: 'cresce' }, h('b', {}, 'Aero Bubble ' + P.nome), h('div', { class: 'peq ' + (cancelada ? 'ass-cancelada' : 'ass-ok') }, estado))),
        linhaInfo(quando[0], quando[1]),
        b.origem ? linhaInfo(T('Pagamento', 'Payment'), ORIGEM()[b.origem] || b.origem) : null,
        b.desde ? linhaInfo(T('Desde', 'Since'), dataLonga(b.desde)) : null,
        b.meses ? linhaInfo(T('Meses seguidos', 'Months in a row'), String(b.meses) + ((x) => !x ? '' : x < 12 ? T(` (o selo evolui aos ${x} meses)`, ` (badge evolves at ${x} months)`) : x === 12 ? T(' (o selo evolui com 1 ano)', ' (badge evolves at 1 year)') : T(` (o selo evolui com ${x / 12} anos)`, ` (badge evolves at ${x / 12} years)`))([1, 2, 3, 6, 12, 24, 36, 48, 60, 84, 96, 108, 120].find((x) => x > b.meses))) : null,
        b.fundador ? linhaInfo(T('Fundador', 'Founder'), T('Apoiou o Aero no lançamento da 1.0', 'Supported Aero at the 1.0 launch')) : null,
        b.plano === 'supporter' ? linhaInfo(T('Presentes de fidelidade', 'Loyalty gifts'), b.presentesFiel ? String(b.presentesFiel) + T(' para dar', ' to give') : T('A cada 3 meses seguidos você ganha 1 mês de Standard para dar a um amigo', 'Every 3 months in a row you get 1 month of Standard to give a friend')) : null,
        h('p', { class: 'peq suave', estilo: { margin: '4px 0 0' } }, b.cartao ? T('O cartão é cobrado todo mês. Se cancelar, o plano continua até a data já paga.', 'Your card is charged every month. If you cancel, the plan stays until the date already paid.')
          : cancelada ? T('O cartão não será mais cobrado. O plano continua até a data acima.', 'Your card will not be charged again. The plan stays until the date above.')
          : b.ate ? T('Não renova sozinho: para continuar, renove antes da data acima.', 'It does not renew by itself: renew before the date above to keep it.') : ''),
        h('div', { class: 'linha', estilo: { gap: '6px', 'flex-wrap': 'wrap' } },
          b.cartao ? U.btn(T('Cancelar a assinatura', 'Cancel subscription'), { icone: 'fechar', tipo: 'perigo', peq: true, onclick: (e) => cancelarCartao(e.currentTarget) }) : null,
          !b.cartao && b.ate && b.mp ? U.btn(T('Renovar', 'Renew'), { icone: 'coracao', tipo: 'sec', peq: true, onclick: () => pagar(P) }) : null,
          b.presentesFiel ? U.btn(T('Dar 1 mês de Standard', 'Give 1 month of Standard'), { icone: 'presente', tipo: 'sec', peq: true, onclick: () => darPresenteFiel() }) : null));
    };
    pintar();
    const off = A.evt.on('bolha', () => { if (!caixa.isConnected) { off && off(); return; } pintar(); });
    return caixa;
  }
  // (0.8.2) só o desenvolvedor (o servidor só manda para ele): a assinatura de quem ele está vendo no perfil
  function resumoDev(a) {
    const P = PLANOS.find((p) => p.id === a.plano), O = ORIGEM(), VIA = { ...O, kofi: 'Ko-fi', nubank: 'PIX Nubank', mp: 'Mercado Pago' };
    const estado = !P ? (a.venceu ? T('Venceu (era ', 'Expired (was ') + ((PLANOS.find((p) => p.id === a.venceu) || {}).nome || a.venceu) + ')' : T('Sem plano', 'No plan'))
      : a.cartao ? T('Ativa · renova no cartão', 'Active · renews by card') : a.cancelou ? T('Cancelada em ', 'Canceled on ') + dataLonga(a.cancelou) + T(' (vale até o fim)', ' (valid until the end)') : T('Ativa · não renova sozinha', 'Active · does not auto-renew');
    const hist = (a.historico || []).map((v) => h('div', { class: 'ass-hist' }, h('span', { class: 'suave' }, dataLonga(v.t)), h('span', {}, v.tipo === 'pago' ? (PLANOS.find((p) => p.id === v.plano) || {}).nome || v.plano : T('cancelou', 'canceled')), h('span', { class: 'suave' }, VIA[v.via] || v.via || ''), h('b', {}, v.tipo === 'pago' ? 'R$ ' + (+v.valor || 0).toFixed(2).replace('.', ',') : '')));
    return h('details', { class: 'mais ass-dev' }, h('summary', {}, A.icone('escudo', 16), ' ', T('Assinatura (só você vê)', 'Subscription (only you see this)'), ' · ', h('b', {}, P ? P.nome : T('nenhuma', 'none'))),
      h('div', { class: 'col', estilo: { gap: '4px', 'margin-top': '8px' } },
        linhaInfo(T('Situação', 'Status'), estado),
        P ? linhaInfo(a.cartao ? T('Próxima cobrança', 'Next charge') : T('Vale até', 'Valid until'), a.ate ? dataLonga(a.ate) : T('Sem prazo', 'No end date')) : null,
        P && a.origem ? linhaInfo(T('Método', 'Method'), O[a.origem] || a.origem) : null,
        P && a.desde ? linhaInfo(T('Desde', 'Since'), dataLonga(a.desde)) : null,
        linhaInfo(T('Total pago', 'Total paid'), 'R$ ' + (+a.total || 0).toFixed(2).replace('.', ',')),
        hist.length ? h('div', { class: 'col', estilo: { gap: '2px', 'margin-top': '6px' } }, h('span', { class: 'peq suave' }, T('Últimos pagamentos', 'Latest payments')), ...hist) : null));
  }

  A.apoio = { secao, secaoAssinatura, resumoDev, pagar, PLANOS, KOFI, X, GITHUB, PIX_CHAVE, PIX_COPIA, MSG_PT, MSG_EN };
})();
