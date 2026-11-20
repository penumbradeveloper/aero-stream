// Aero Stream - (0.8.3) "Novidades": o que cada versão trouxe (a partir da 0.8.3), em páginas. Os textos vêm de novidades-dados.js
// (gerado das notas de cada versão). Abre pelas Configurações > Sistema > Atualizações. Criado por Ryan Victtor.
(() => {
  const A = window.Aero, T = A.T, h = A.h;
  const MAX_LINHAS = 9; // cada página com no máximo umas 9 linhas: as seções de uma versão são divididas em várias páginas
  // **negrito** -> <b>; o resto é texto (nada de HTML vindo das notas)
  const texto = (s) => String(s).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) => (/^\*\*[^*]+\*\*$/.test(p) ? h('b', {}, p.slice(2, -2)) : p));
  function paginas(ver) {
    const out = []; let pag = [], n = 0;
    for (const s of ver.secoes) {
      // seção grande demais vai partida, repetindo o título
      for (let i = 0; i < s.itens.length || i === 0; i += MAX_LINHAS) {
        const pedaco = s.itens.slice(i, i + MAX_LINHAS);
        if (pag.length && n + pedaco.length + 1 > MAX_LINHAS) { out.push(pag); pag = []; n = 0; }
        pag.push({ t: s.t, itens: pedaco }); n += pedaco.length + 1;
        if (!s.itens.length) break;
      }
    }
    if (pag.length) out.push(pag);
    return out.length ? out : [[]];
  }
  const pintarPagina = (pag) => h('div', { class: 'nv-pagina' }, ...pag.map((s) => h('section', { class: 'nv-secao' },
    h('h4', {}, s.t),
    h('ul', {}, ...s.itens.map((it) => h('li', { class: it.n ? 'sub' : '' }, ...texto(it.x)))))));
  A.novidades = {
    tem: () => !!(A.NOVIDADES && A.NOVIDADES.length),
    abrir(versao) {
      const U = A.ui, lista = A.NOVIDADES || [];
      if (!lista.length) { U.toast(T('Ainda não há novidades para mostrar.', 'No release notes yet.')); return; }
      let iv = Math.max(0, lista.findIndex((x) => x.v === (versao || A.versao))), ip = 0, pags = paginas(lista[iv]);
      const palco = h('div', { class: 'nv-palco' });
      const titulo = h('div', { class: 'nv-titulo' });
      const pontos = h('div', { class: 'nv-pontos' });
      const ant = U.btn('', { icone: 'setaE', tipo: 'sec', redondo: true, peq: true, titulo: T('Página anterior', 'Previous page'), onclick: () => ir(-1) });
      const prox = U.btn('', { icone: 'setaD', tipo: 'sec', redondo: true, peq: true, titulo: T('Próxima página', 'Next page'), onclick: () => ir(1) });
      const contador = h('span', { class: 'nv-contador suave peq' });
      const versoes = lista.length > 1 ? h('div', { class: 'nv-versoes' }) : null;
      const pintar = (dir = 0) => {
        const v = lista[iv];
        titulo.replaceChildren(h('b', {}, 'Aero ' + v.v), v.v === A.versao ? h('span', { class: 'nv-atual' }, T('sua versão', 'your version')) : null);
        const nova = pintarPagina(pags[ip]);
        if (dir) nova.classList.add(dir > 0 ? 'entra-dir' : 'entra-esq');
        palco.replaceChildren(nova); palco.scrollTop = 0;
        pontos.replaceChildren(...pags.map((_, i) => h('button', { type: 'button', class: 'nv-ponto' + (i === ip ? ' on' : ''), 'aria-label': T('Página ', 'Page ') + (i + 1), onclick: () => { const d = i - ip; ip = i; pintar(d); } })));
        contador.textContent = T('Página ', 'Page ') + (ip + 1) + T(' de ', ' of ') + pags.length;
        ant.disabled = ip === 0 && iv === lista.length - 1; prox.disabled = ip === pags.length - 1 && iv === 0;
        if (versoes) versoes.replaceChildren(...lista.map((x, i) => h('button', { type: 'button', class: 'nv-versao' + (i === iv ? ' on' : ''), onclick: () => { if (i === iv) return; const d = i < iv ? 1 : -1; iv = i; pags = paginas(lista[iv]); ip = 0; pintar(d); } }, x.v)));
      };
      // passando da última página de uma versão, vai para a versão anterior (mais velha); voltando da primeira, para a mais nova
      const ir = (d) => {
        if (ip + d >= 0 && ip + d < pags.length) { ip += d; pintar(d); A.som.tocar('hover'); return; }
        const nv = iv + (d > 0 ? 1 : -1); if (nv < 0 || nv >= lista.length) return;
        iv = nv; pags = paginas(lista[iv]); ip = d > 0 ? 0 : pags.length - 1; pintar(d); A.som.tocar('hover');
      };
      const corpo = h('div', { class: 'nv' }, versoes, titulo, palco, h('div', { class: 'nv-rodape' }, ant, h('div', { class: 'nv-meio' }, pontos, contador), prox));
      const tecla = (e) => { if (e.key === 'ArrowRight') { ir(1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { ir(-1); e.preventDefault(); } };
      addEventListener('keydown', tecla);
      // arrastar de lado (toque) também troca de página
      let x0 = null; palco.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') x0 = e.clientX; });
      palco.addEventListener('pointerup', (e) => { if (x0 == null) return; const d = e.clientX - x0; x0 = null; if (Math.abs(d) > 50) ir(d < 0 ? 1 : -1); });
      pintar();
      return U.modal(T('Novidades', 'What\'s new'), [corpo], { largura: 620, classe: 'nv-modal', aoFechar: () => removeEventListener('keydown', tecla) });
    },
  };
  // (1.0.0) quem ligou "Mostrar as novidades depois de atualizar": na primeira vez que a tela inicial abre numa versão nova, as Novidades
  // dela aparecem sozinhas. A versão aberta fica guardada sempre (mesmo com a opção desligada), então ligar depois não mostra nada velho
  const aoAbrir = (nome) => {
    if (nome !== 'home') return;
    desligar();
    const at = A.cfg.v.atualizar || (A.cfg.v.atualizar = {});
    const antes = at.vista || '';
    if (antes === A.versao) return;
    at.vista = A.versao; A.cfg.salvar();
    if (!antes || at.novidades !== true || !(A.NOVIDADES || []).some((x) => x.v === A.versao)) return;
    setTimeout(() => { const t = A.ui.telaAtual && A.ui.telaAtual(); if (t && t.nome === 'home' && !document.querySelector('.nv-modal')) A.novidades.abrir(A.versao); }, 1500);
  };
  const desligar = A.evt.on('tela', aoAbrir);
})();
