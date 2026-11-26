// Aero - (1.0.0) A LOJA DE SKINS (na aba Skins): ver, instalar as grátis, comprar as pagas (PIX, o dinheiro vai direto para quem fez),
// publicar as suas (Donator e Supporter) e denunciar. A licença fica presa à conta: comprou, baixa de novo em qualquer aparelho.
(() => {
  'use strict';
  const A = window.Aero, T = A.T, h = A.h, S = A.aer;
  const L = (S.loja = {});
  const reais = (v) => (v ? 'R$ ' + (+v).toFixed(2).replace('.', ',') : T('Grátis', 'Free'));
  // os pedidos com bytes (o .aer) não são JSON: vão direto, com a mesma sessão
  const cru = async (rota, { metodo = 'GET', corpo } = {}) => {
    const API = A.api; const r = await fetch(`${API.servidor}/api/${rota}`, { method: metodo, headers: { ...(API.token ? { Authorization: 'Bearer ' + API.token } : {}), 'X-Aero-HW': await API.hw() }, body: corpo });
    if (!r.ok) { let d = {}; try { d = await r.json(); } catch (e) { /* ok */ } throw Object.assign(new Error(d.erro || T('Erro de conexão.', 'Connection error.')), { status: r.status }); }
    return r;
  };
  const instalarDaLoja = async (s) => {
    try { const r = await cru('loja/' + s.id + '/baixar'); await S.importar(await r.arrayBuffer(), s.nome + '.aer'); } catch (e) { A.ui.toast(e.message, { tipo: 'erro' }); }
  };

  // ---------- comprar (PIX) ----------
  // (1.0.3) o mesmo PIX compra as integrações pagas da Comunidade (o = { integ: true })
  function comprar(s, info, depois, o = {}) {
    const U = A.ui, corpo = h('div', { class: 'col', estilo: { gap: '10px' } });
    let fechou = false, timer = 0;
    const email = h('input', { class: 'campo', type: 'email', placeholder: T('Seu e-mail (para o recibo)', 'Your e-mail (for the receipt)'), maxlength: 254, value: A.store.ler('aero-email-recibo', '') });
    const credito = info.creditos > 0 ? U.chave(false, () => {}) : null;
    const erroEl = h('div', { class: 'peq est-erro' });
    const passo1 = () => corpo.replaceChildren(
      h('div', { class: 'bolha-valor' }, h('span', {}, reais(s.preco)), h('small', {}, s.nome)),
      info.desconto ? h('div', { class: 'peq aer-ok' }, T('Seu plano dá ', 'Your plan gives ') + Math.round(info.desconto * 100) + T('% de desconto (sai da parte do Aero; quem fez recebe igual).', '% off (it comes from Aero\'s share; the creator gets the same).')) : null,
      credito ? h('div', { class: 'linha', estilo: { gap: '8px' } }, credito, h('span', { class: 'peq' }, T('Usar meus créditos da loja (', 'Use my store credits (') + reais(info.creditos) + ')')) : null,
      email, erroEl,
      U.btn(T('Gerar PIX', 'Create PIX'), { icone: 'pix', onclick: async () => {
        erroEl.textContent = '';
        try {
          A.store.gravar('aero-email-recibo', email.value.trim());
          const r = await A.api.req('loja/' + s.id + '/comprar', { email: email.value.trim(), credito: !!(credito && credito.querySelector('input').checked) });
          if (r.tenho) { janela.fechar(); depois(); return; }
          passo2(r);
        } catch (e) { erroEl.textContent = e.message; }
      } }),
      h('div', { class: 'peq suave' }, o.integ ? T('O pagamento é pelo Mercado Pago, direto para a conta de quem fez a integração (o Aero fica só com a comissão). Ela fica na sua conta: instala de novo em qualquer aparelho.', 'Payment goes through Mercado Pago, straight to the creator\'s account (Aero only keeps a fee). It stays on your account: install it again on any device.')
        : T('O pagamento é pelo Mercado Pago, direto para a conta de quem fez a skin (o Aero fica só com a comissão). A skin fica na sua conta: baixa de novo em qualquer aparelho.', 'Payment goes through Mercado Pago, straight to the creator\'s account (Aero only keeps a fee). The skin stays on your account: download it again on any device.')));
    const passo2 = (r) => {
      const status = h('div', { class: 'bolha-espera peq' }, h('span', { class: 'bolha-girando', 'aria-hidden': 'true' }), h('span', {}, T('Esperando o pagamento…', 'Waiting for the payment…')));
      corpo.replaceChildren(h('div', { class: 'bolha-valor' }, h('span', {}, reais(r.valor)), h('small', {}, 'PIX')),
        r.qr ? h('img', { class: 'bolha-qr', src: 'data:image/png;base64,' + String(r.qr).replace(/[^A-Za-z0-9+/=]/g, ''), alt: T('QR Code do PIX', 'PIX QR code'), width: 200, height: 200 }) : null,
        h('code', { class: 'selecionavel bolha-codigo' }, r.codigo), U.btn(T('Copiar código PIX', 'Copy PIX code'), { icone: 'copiar', onclick: (e) => U.copiar(r.codigo, e.currentTarget) }), status);
      const fim = Date.now() + 30 * 60000;
      const conferir = async () => {
        if (fechou) return; if (Date.now() > fim) { status.textContent = T('O código expirou. Feche e gere outro.', 'The code expired. Close and create a new one.'); return; }
        try { const c = await A.api.req('loja/pix/' + r.cod); if (c.status === 'pago') { A.som.tocar('sucesso'); janela.fechar(); depois(); return; } if (c.status === 'cancelado') { status.textContent = T('O pagamento foi recusado. Feche e tente de novo.', 'The payment was declined. Close and try again.'); return; } } catch (e) { /* tenta de novo */ }
        timer = setTimeout(conferir, 4000);
      };
      timer = setTimeout(conferir, 4000);
    };
    passo1();
    const janela = U.modal(o.integ ? T('Comprar integração', 'Buy integration') : T('Comprar skin', 'Buy skin'), h('div', { dados: { protegido: '1' } }, corpo), { largura: 420, aoFechar: () => { fechou = true; clearTimeout(timer); } });
  }

  // (1.0.3) o aviso do Mercado Pago embaixo do preço (as skins e as integrações da Comunidade usam o mesmo)
  L.vendedor = (info, preco, erroEl, semVenda) => {
    const U = A.ui, vend = h('div', { class: 'col', estilo: { gap: '6px' } });
    const pintarVend = () => vend.replaceChildren(+preco.value > 0 ? (info.vendedor ? h('div', { class: 'peq aer-ok' }, T('✔ Sua conta do Mercado Pago está conectada. Você recebe ', '✔ Your Mercado Pago account is connected. You get ') + Math.round((1 - info.comissao) * 100) + T('% de cada venda, direto nela.', '% of each sale, straight into it.'))
      : info.splitPronto ? h('div', { class: 'col', estilo: { gap: '6px' } }, h('div', { class: 'peq' }, T('Para vender, conecte a sua conta do Mercado Pago: o dinheiro vai direto para ela (você recebe ', 'To sell, connect your Mercado Pago account: the money goes straight into it (you get ') + Math.round((1 - info.comissao) * 100) + T('% de cada venda).', '% of each sale).')),
        U.btn(T('Conectar Mercado Pago', 'Connect Mercado Pago'), { tipo: 'sec', peq: true, icone: 'externo', onclick: async () => { try { const r = await A.api.req('loja/mp/conectar', {}); window.open(r.url, '_blank', 'noopener'); U.toast(T('Depois de conectar, feche e abra esta janela de novo.', 'After connecting, close and reopen this window.')); } catch (e) { erroEl.textContent = e.message; } } }))
      : h('div', { class: 'peq suave' }, semVenda)) : null);
    preco.addEventListener('input', pintarVend); pintarVend();
    return vend;
  };
  L.comprar = comprar;

  // ---------- publicar ----------
  L.publicar = async (id) => {
    const U = A.ui, p = await S.ler(id);
    if (!p || !p.bruto) { U.toast(T('Só dá para publicar skins feitas no seu Estúdio.', 'You can only publish skins made in your Studio.'), { tipo: 'erro' }); return; }
    let info = {}; try { info = await A.api.req('loja'); } catch (e) { U.toast(e.message, { tipo: 'erro' }); return; }
    if (!info.pode) { U.toast(T('Publicar na loja é do Aero Bubble Donator.', 'Publishing in the store is on Aero Bubble Donator.')); return; }
    const preco = h('input', { class: 'campo', type: 'number', min: 0, max: 200, step: '0.5', value: 0 });
    const termos = h('input', { type: 'checkbox' }), erroEl = h('div', { class: 'peq est-erro' });
    const vend = L.vendedor(info, preco, erroEl, T('A venda de skins ainda não está disponível. Publique grátis por enquanto.', 'Selling skins is not available yet. Publish for free for now.'));
    const TERMOS = T('Eu fiz esta skin ou tenho o direito de usar tudo o que está nela (imagens, sons e fontes). Ela não tem conteúdo ilegal, de ódio, sexual ou que copie a marca de alguém. Sei que a equipe do Aero pode tirá-la da loja (e barrar o mesmo arquivo) se houver denúncia procedente, e que quem comprou continua com ela.',
      'I made this skin or have the right to use everything in it (images, sounds and fonts). It has no illegal, hateful or sexual content, and does not copy anyone\'s brand. I know the Aero team can remove it from the store (and block the same file) after a valid report, and that buyers keep it.');
    const janela = U.modal(T('Publicar na loja', 'Publish in the store'), h('div', { class: 'col', estilo: { gap: '10px' }, dados: { protegido: '1' } },
      h('b', {}, p.manifesto.nome), h('div', { class: 'est-linha' }, h('span', { class: 'est-rot' }, T('Preço (R$, 0 = grátis)', 'Price (R$, 0 = free)')), h('div', { class: 'est-ctl' }, preco)), vend,
      h('label', { class: 'linha', estilo: { gap: '8px', 'align-items': 'flex-start' } }, termos, h('span', { class: 'peq' }, TERMOS)), erroEl),
    { largura: 480, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Publicar', 'Publish'), icone: 'subir', onclick: async () => {
      erroEl.textContent = '';
      if (!termos.checked) { erroEl.textContent = T('Aceite os termos para publicar.', 'Accept the terms to publish.'); return; }
      try {
        const v = Math.max(0, +preco.value || 0);
        await cru('loja/publicar?' + new URLSearchParams({ termos: '1', preco: String(v) }), { metodo: 'POST', corpo: p.bruto });
        p.verificado = true; await S.guardar(p); A.som.tocar('sucesso'); U.toast(T('Skin publicada na loja!', 'Skin published in the store!'), { tipo: 'ok' }); janela.fechar(); A.evt.emit('aer:mudou');
      } catch (e) { erroEl.textContent = e.message; }
    } }] });
  };

  // ---------- denunciar e tirar ----------
  const denunciar = (s) => {
    const U = A.ui, motivo = h('textarea', { class: 'campo', rows: 3, maxlength: 400, placeholder: T('O que tem de errado com esta skin?', 'What is wrong with this skin?') });
    U.modal(T('Denunciar skin', 'Report skin'), h('div', { class: 'col', estilo: { gap: '8px' } }, h('b', {}, s.nome), motivo), { largura: 420, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Denunciar', 'Report'), tipo: 'perigo', onclick: async (fechar) => {
      try { await A.api.req('loja/' + s.id + '/denunciar', { motivo: motivo.value }); U.toast(T('Denúncia enviada. Obrigado!', 'Report sent. Thank you!'), { tipo: 'ok' }); fechar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
    } }] });
  };
  const tirar = async (s, recarregar) => {
    if (!(await A.ui.confirmar(T('Tirar "', 'Remove "') + s.nome + T('" da loja? Quem já tem continua com ela.', '" from the store? People who have it keep it.'), { sim: T('Tirar', 'Remove'), perigo: true }))) return;
    try { await A.api.req('loja/' + s.id + '/remover', {}); recarregar(); } catch (e) { A.ui.toast(e.message, { tipo: 'erro' }); }
  };

  // ---------- a vitrine ----------
  L.secao = () => {
    const U = A.ui, caixa = h('div', { class: 'col aer-loja', estilo: { gap: '8px' } }), busca = h('input', { class: 'campo', placeholder: T('Procurar skins...', 'Search skins...'), maxlength: 40 });
    let t = 0, info = null;
    const carregar = async () => {
      if (!A.api.token) { caixa.replaceChildren(h('div', { class: 'peq suave' }, T('Entre na sua conta para ver a loja.', 'Sign in to see the store.'))); return; }
      try { info = await A.api.req('loja' + (busca.value.trim() ? '?q=' + encodeURIComponent(busca.value.trim()) : '')); } catch (e) { caixa.replaceChildren(h('div', { class: 'peq suave' }, e.message)); return; }
      caixa.replaceChildren(...(info.skins.length ? info.skins.map((s) => h('div', { class: 'aer-item' },
        h('div', { class: 'cresce' }, h('b', {}, s.nome, s.oficial ? h('span', { class: 'aer-oficial' }, T('Oficial', 'Official')) : null),
          h('div', { class: 'peq suave' }, (s.autor ? T('por ', 'by ') + s.autor + ' · ' : '') + 'v' + s.versao + ' · ' + reais(s.preco) + (s.vendas ? ' · ' + s.vendas + T(' vendas', ' sales') : '')),
          s.descricao ? h('div', { class: 'peq aer-desc' }, s.descricao) : null),
        s.tenho ? U.btn(T('Instalar', 'Install'), { tipo: 'sec', peq: true, icone: 'download', onclick: () => instalarDaLoja(s) })
          : U.btn(reais(s.preco), { peq: true, icone: 'pix', onclick: () => comprar(s, info, () => { carregar(); instalarDaLoja(s); }) }),
        s.minha ? U.btn('', { icone: 'lixo', tipo: 'perigo', peq: true, redondo: true, titulo: T('Tirar da loja', 'Remove from store'), onclick: () => tirar(s, carregar) })
          : U.btn('', { icone: 'bandeira', tipo: 'sec', peq: true, redondo: true, titulo: T('Denunciar', 'Report'), onclick: () => denunciar(s) })))
        : [h('div', { class: 'peq suave' }, busca.value.trim() ? T('Nada encontrado.', 'Nothing found.') : T('A loja ainda está vazia. Que tal publicar a primeira?', 'The store is still empty. How about publishing the first one?'))]),
      info.creditos ? h('div', { class: 'peq aer-ok' }, T('Seus créditos na loja: ', 'Your store credits: ') + reais(info.creditos)) : null);
    };
    busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(carregar, 400); });
    carregar();
    return h('div', { class: 'col', estilo: { gap: '8px' } }, busca, caixa);
  };
})();
