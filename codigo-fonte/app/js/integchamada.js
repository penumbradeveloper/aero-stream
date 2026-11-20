// Aero Stream - (1.0.2) as integrações na barra da chamada. Com UMA integração ligada, fica o botão dela (como antes, ao lado do chat);
// com MAIS DE UMA, o lugar vira um "+" que abre uma barrinha com todas: grade de até 5 por linha (passou de 5, continua na linha de
// baixo e a barrinha cresce para cima). Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  const { h, T } = A, U = A.ui;
  const POR_LINHA = 5;

  // as integrações que entram na chamada (na ordem da barrinha)
  // (1.0.2) os nomes vêm do catálogo (integcatalogo.js); as 'link' e 'janela' do catálogo marcadas para a chamada entram no fim
  const I = () => A.integ || {};
  const nome = (id, padrao) => (I().nomeDe ? I().nomeDe(id, padrao) : padrao);
  const lista = (ch) => [
    A.musica && A.musica.ligada() ? { id: 'musica', icone: 'musica', nome: nome('musica', T('Música junto', 'Music together')), acao: (b) => A.musica.abrir(ch.cid, b) } : null,
    A.celmic && A.celmic.ligada() ? { id: 'celmic', icone: 'celular', nome: nome('celmic', T('Celular como microfone', 'Phone as microphone')), curto: I().curtoDe ? I().curtoDe('celmic', T('Celular', 'Phone')) : T('Celular', 'Phone'), acao: () => A.celmic.abrir(), ativo: () => A.celmic.conectado() } : null,
    ...(I().daChamada ? I().daChamada() : []),
  ].filter(Boolean);

  // a barrinha: um popover com a grade
  function barrinha(ancora, itens) {
    if (U._pop && U._pop.ancora === ancora) { U._pop.fechar(); return null; }
    const cols = Math.min(POR_LINHA, Math.max(1, itens.length));
    const grade = h('div', { class: 'cham-integ-grade', role: 'menu', estilo: { '--cols': String(cols) } },
      ...itens.map((x) => {
        const b = h('button', { type: 'button', class: 'cham-integ-item' + (x.ativo && x.ativo() ? ' ativo' : ''), role: 'menuitem', title: x.nome, 'aria-label': x.nome },
          h('span', { class: 'cham-integ-ic' }, A.icone(x.icone, 22)), h('span', { class: 'cham-integ-nome' }, x.curto || x.nome));
        b.addEventListener('click', (e) => { e.stopPropagation(); pop.fechar(); x.acao(ancora); });
        return b;
      }));
    // abre acima da barra INTEIRA (no celular a barra quebra em duas linhas: a barrinha não cobre a de cima)
    const ajustar = () => {
      const barra = ancora.closest && ancora.closest('.cham-barra');
      if (!barra || !pop.el || pop.el.dataset.lado !== 'cima') return;
      const t = barra.getBoundingClientRect().top;
      pop.el.style.bottom = Math.max(8, innerHeight - t + 10) + 'px'; pop.el.style.maxHeight = Math.max(160, t - 24) + 'px';
    };
    const pop = U.popover(ancora, grade, { largura: cols * 84 + 28, titulo: T('Integrações', 'Integrations'), aoFechar: () => removeEventListener('resize', ajustar) });
    pop.el && pop.el.classList.add('cham-integ-pop');
    ajustar(); addEventListener('resize', ajustar);
    try { ancora.setAttribute('aria-expanded', 'true'); } catch (e) { /* ok */ }
    return pop;
  }

  // rb: o criador de botões redondos da barra da chamada (o mesmo dos outros botões)
  A.integChamada = (ch, rb) => {
    const itens = lista(ch);
    if (!itens.length) return null;
    let b;
    if (itens.length === 1) {
      const x = itens[0];
      b = rb(x.icone, x.nome, (e) => x.acao((e && e.currentTarget) || b));
    } else {
      b = rb('mais', T('Integrações', 'Integrations'), (e) => barrinha((e && e.currentTarget) || b, lista(ch)));
      b.classList.add('cham-integ-mais'); b.setAttribute('aria-haspopup', 'menu');
    }
    b.classList.add('cham-integ');
    // aceso enquanto alguma integração estiver em uso (o celular conectado, por exemplo)
    const acender = () => b.classList.toggle('ativo', itens.some((x) => x.ativo && x.ativo()));
    const off = A.evt.on('celmic:estado', () => { if (!b.isConnected) { if (off) off(); return; } acender(); });
    acender();
    return b;
  };
  A.integChamada._barrinha = barrinha; // (para testar a grade com muitas integrações)
})();
