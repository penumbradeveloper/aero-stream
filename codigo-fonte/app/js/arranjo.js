// Aero Stream - (0.7.14) o arranjo da janela: segurar e arrastar a barra de cima (abas), a lista do Aero Talk e o seu cartão de perfil
// para outro lado. Cada peça gruda num dos lugares possíveis e o resto da tela se ajusta (nada fica por cima de nada). Guardado neste
// aparelho (A.cfg). No celular (tela estreita) o arranjo é sempre o padrão. Criado por Ryan Victtor.
(() => {
  const A = window.Aero, T = A.T, h = A.h;
  const PADRAO = { topo: 'cima', lado: 'esquerda', perfil: 'cima', filtro: 'todas' };
  const LUGARES = { topo: ['cima', 'baixo', 'esquerda', 'direita'], lado: ['esquerda', 'direita', 'cima', 'baixo'], perfil: ['cima', 'baixo', 'cima-esquerda', 'cima-direita', 'cima-centro', 'baixo-esquerda', 'baixo-direita', 'baixo-centro'] };
  const R = (A.arranjo = {});
  // (0.8.0) o cartão de perfil num canto ou no meio fica compacto (só a foto e o status)
  R.perfilCompacto = (v) => /-/.test(v || R.v().perfil);
  R.v = () => { const a = A.cfg.v.arranjo || {}; return { ...PADRAO, ...a }; };
  const valido = (peca, lugar) => (LUGARES[peca] || []).includes(lugar);
  // os lugares viram atributos no <html> (o CSS faz o resto)
  R.aplicar = () => {
    const a = R.v(), d = document.documentElement.dataset;
    d.arTopo = valido('topo', a.topo) ? a.topo : 'cima';
    // (0.8.7) bolha do perfil e doca têm lugar fixo (a bolha fica no alto, à esquerda; a doca, embaixo no meio)
    d.arTopo = 'cima'; // (0.8.7) a barra virou a bolha do perfil ou a doca, que têm lugar próprio
    d.arLado = valido('lado', a.lado) ? a.lado : 'esquerda';
    const pf = valido('perfil', a.perfil) ? a.perfil : 'cima';
    d.arPerfil = pf; d.arPerfilV = pf.split('-')[0]; d.arPerfilC = pf.split('-')[1] || 'normal';
    // (0.8.0) recolhidas (a setinha) e o tamanho que você deu à lista do Aero Talk
    const rec = a.rec || {}, tam = a.tam || {}, st = document.documentElement.style;
    for (const p of ['lado', 'topo']) { const k = 'arRec' + p[0].toUpperCase() + p.slice(1); if (rec[p]) d[k] = '1'; else delete d[k]; }
    if (tam.ladoW > 0) st.setProperty('--ar-lado-w', Math.round(tam.ladoW) + 'px'); else st.removeProperty('--ar-lado-w');
    if (tam.ladoH > 0) { st.setProperty('--ar-lado-hr', 'clamp(' + R.MIN_H + 'px, ' + Math.round(tam.ladoH) + 'px, 62vh)'); st.setProperty('--ar-lado-hmax', 'none'); } else { st.removeProperty('--ar-lado-hr'); st.removeProperty('--ar-lado-hmax'); }
  };
  R.mudar = (peca, valor) => {
    if (peca !== 'filtro' && !valido(peca, valor)) return;
    A.cfg.v.arranjo = { ...R.v(), [peca]: valor }; A.cfg.salvar(); R.aplicar();
    A.evt.emit('arranjo', { peca, valor });
  };
  R.restaurar = () => { A.cfg.v.arranjo = { ...PADRAO, filtro: R.v().filtro }; A.cfg.salvar(); R.aplicar(); A.evt.emit('arranjo', {}); };
  // (0.8.0) tamanho mínimo da lista: abaixo disso as partes dela entrariam umas nas outras (vale em qualquer resolução)
  R.MIN_W = 270; R.MIN_H = 100;
  R.recolhida = (peca) => !!(R.v().rec || {})[peca];
  R.tamanho = (chave, valor) => { const a = R.v(); A.cfg.v.arranjo = { ...a, tam: { ...(a.tam || {}), [chave]: valor } }; A.cfg.salvar(); R.aplicar(); A.evt.emit('arranjo', { peca: 'tam' }); };
  const estreita = () => matchMedia('(max-width: 760px)').matches;

  // ---------- segurar e arrastar ----------
  // Com o mouse: segurar e já sair arrastando (passou de 6 px) pega a peça, como em qualquer programa; segurar parado 350 ms também pega.
  // No toque: só segurar parado (mexer antes é rolagem). Pegou: a peça "desgruda" (som e animação), segue o ponteiro e os lugares possíveis
  // acendem; passar por um lugar dá um toque de "pode grudar aqui"; soltar gruda ali (som e animação). Clique rápido continua sendo clique.
  // Esc cancela. (0.8.0: antes era preciso segurar PARADO; quem clicava e já arrastava não pegava nada, e a foto puxava o arrastar do
  // navegador, que cancelava tudo.)
  // o: { peca, lugares: () => [{ nome, rect, rotulo }], ignorar: seletor do que não pega (campos, por exemplo) }
  R.arrastavel = (el, o) => {
    let t = 0, ini = null, ativo = null;
    // (0.8.3) antes de pegar, o movimento é seguido pela janela toda: arrastando rápido, o mouse saía da peça e ela não era pega
    const limpar = () => { clearTimeout(t); clearTimeout(ini && ini.t2); t = 0; ini = null; removeEventListener('pointermove', prever, true); removeEventListener('pointerup', soltou, true); removeEventListener('pointercancel', soltou, true); };
    const soltou = () => { if (!ativo) limpar(); };
    // (0.8.3) mais tolerante: com o mouse, só pega depois de segurar 220 ms E mexer 10 px (clicar rápido passando por cima não pega mais);
    // segurar parado pega com 420 ms
    const ESPERA = 220, LONGE = 10, PARADO = 420;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (estreita() && !o.celular) || ativo || (o.pode && !o.pode())) return; // (0.8.3) o cartão do perfil também se mexe no celular
      if (e.target.closest('input, textarea, select, [contenteditable], .menu-ctx' + (o.ignorar ? ', ' + o.ignorar : ''))) return;
      // (0.8.0) segurar a barra de rolagem (de uma lista dentro da peça) é rolar, nunca pegar a peça; e dentro de uma área que rola, só
      // segurar parado pega (arrastar ali é rolar / selecionar)
      // (0.8.3) vale também para a barra de rolagem de lado (a lista deitada em cima ou embaixo)
      let rola = false;
      for (let x = e.target; x && x !== el.parentNode; x = x.parentElement) {
        const cs = getComputedStyle(x), rv = x.scrollHeight > x.clientHeight + 1 && /(auto|scroll)/.test(cs.overflowY), rh = x.scrollWidth > x.clientWidth + 1 && /(auto|scroll)/.test(cs.overflowX);
        if (rv || rh) {
          const r = x.getBoundingClientRect();
          if ((rv && e.clientX >= r.left + x.clientLeft + x.clientWidth) || (rh && e.clientY >= r.top + x.clientTop + x.clientHeight)) return;
          rola = true;
        }
        if (x === el) break;
      }
      ini = { x: e.clientX, y: e.clientY, id: e.pointerId, mouse: e.pointerType !== 'touch' && !rola, t0: performance.now(), longe: null };
      t = setTimeout(() => comecar(e), PARADO);
      if (ini.mouse) ini.t2 = setTimeout(() => { if (ini && ini.longe && !ativo) { clearTimeout(t); comecar(ini.longe); } }, ESPERA);
      addEventListener('pointermove', prever, true); addEventListener('pointerup', soltou, true); addEventListener('pointercancel', soltou, true);
    });
    function prever(e) {
      if (!ini || ativo || e.pointerId !== ini.id) return;
      const d = Math.hypot(e.clientX - ini.x, e.clientY - ini.y);
      if (ini.mouse && d > LONGE) { if (performance.now() - ini.t0 >= ESPERA) { clearTimeout(t); comecar(e); } else ini.longe = e; } else if (!ini.mouse && d > 8) limpar();
    }
    el.addEventListener('dragstart', (e) => { if (ini || ativo) e.preventDefault(); }); // foto/link: o arrastar do navegador cancelava a pega
    function comecar(e0) {
      t = 0; if (!ini || !el.isConnected) return;
      removeEventListener('pointermove', prever, true); removeEventListener('pointerup', soltou, true); removeEventListener('pointercancel', soltou, true);
      // (0.8.3) o ponteiro fica preso à janela enquanto segura: passar por cima de um vídeo/embed não perde mais o arrastar
      const raizEl = document.documentElement, pid = ini.id; try { raizEl.setPointerCapture(pid); } catch (_) { /* ok */ }
      const caixa = el.getBoundingClientRect();
      if (!o.lugares().some((l) => l.rect && l.rect.width > 0)) return;
      A.som.tocar('desgrudar');
      try { getSelection().removeAllRanges(); } catch (_) { /* ok */ }
      // (0.8.0) a própria peça se compacta e sai dali seguindo o mouse (não fica um fantasma separado): o cartão vira a bolinha
      // compacta dele; a lista e a barra viram uma pílula com o nome. O lugar dela fica vazio (o cartão sai de verdade da lista).
      const voador = o.voador ? o.voador() : h('div', { class: 'ar-pilula vidro' }, A.icone(o.icone || 'grade', 18), h('span', {}, o.nome || ''));
      voador.classList.add('ar-voador'); voador.removeAttribute('id');
      const camada = h('div', { class: 'ar-camada' });
      document.body.append(camada, voador);
      // o tamanho compacto (medido antes de começar a encolher)
      Object.assign(voador.style, { visibility: 'hidden', width: '', height: '' }); const cw = voador.offsetWidth, ch = voador.offsetHeight;
      Object.assign(voador.style, { visibility: '', width: caixa.width + 'px', height: caixa.height + 'px' });
      el.classList.add('ar-pegando'); if (o.sai) el.classList.add('ar-fora');
      document.documentElement.classList.add('ar-arrastando');
      // com a peça fora, os lugares são medidos de novo (o cartão saiu da lista)
      const lugares = o.lugares().filter((l) => l.rect && l.rect.width > 0 && l.rect.height > 0);
      camada.append(...lugares.map((l) => h('div', { class: 'ar-lugar', dados: { nome: l.nome }, estilo: { left: l.rect.left + 'px', top: l.rect.top + 'px', width: l.rect.width + 'px', height: l.rect.height + 'px' } }, h('span', {}, l.rotulo || ''))));
      // (0.8.0) uma dica que segue o mouse diz o que mais dá para fazer enquanto segura (ex.: botão direito = compacto no meio)
      const dica = o.direito ? h('div', { class: 'ar-dica' }, A.icone('mouse', 14), h('span', {}, o.direito.texto)) : null;
      if (dica) camada.append(dica);
      // segue o mouse com uma mola (atrasa um tiquinho e inclina com a velocidade, como algo meio líquido)
      const ox = Math.min(ini.x - caixa.left, cw * 0.5), oy = Math.min(ini.y - caixa.top, ch * 0.5);
      let x = caixa.left, y = caixa.top, vx = 0, vy = 0, mx = e0.clientX, my = e0.clientY, raf = 0, destino = null, w = cw, hh = ch;
      requestAnimationFrame(() => { voador.classList.add('compactando'); voador.style.width = cw + 'px'; voador.style.height = ch + 'px'; });
      const passo = () => {
        const tx = destino ? destino.left : mx - ox, ty = destino ? destino.top : my - oy;
        // (0.8.3) pousando, a mola fica bem amortecida: ela desliza até o lugar sem passar dele (antes ia e voltava, parecia tremer)
        const am = destino ? 0.42 : 0.6, fo = destino ? 0.2 : 0.24;
        vx = vx * am + (tx - x) * fo; vy = vy * am + (ty - y) * fo; x += vx; y += vy;
        const inc = destino ? 0 : Math.max(-9, Math.min(9, vx * 0.35)), est = destino ? 0 : Math.min(0.08, Math.hypot(vx, vy) * 0.0025);
        voador.style.transform = 'translate(' + x + 'px, ' + y + 'px) rotate(' + inc + 'deg) scale(' + (1 + est) + ', ' + (1 - est) + ')';
        raf = requestAnimationFrame(passo);
      };
      passo();
      let alvo = null, iniciou = false;
      const perto = (x, y) => { let m = null, md = Infinity; for (const l of lugares) { const r = l.rect, cx = Math.max(r.left, Math.min(x, r.right)), cy = Math.max(r.top, Math.min(y, r.bottom)), d = Math.hypot(x - cx, y - cy); if (d < md) { md = d; m = l; } } return m; };
      const mover = (e) => {
        mx = e.clientX; my = e.clientY;
        if (dica) { dica.style.left = Math.min(innerWidth - dica.offsetWidth - 8, e.clientX + 18) + 'px'; dica.style.top = Math.min(innerHeight - 40, e.clientY + 22) + 'px'; }
        const l = perto(e.clientX, e.clientY);
        if (l !== alvo) { // chegou num lugar novo: "pode grudar aqui"
          alvo = l;
          camada.querySelectorAll('.ar-lugar').forEach((z) => { const s = !!l && z.dataset.nome === l.nome; z.classList.toggle('sel', s); if (s) { z.classList.remove('mira'); void z.offsetWidth; z.classList.add('mira'); } });
          voador.classList.toggle('mirando', !!l);
          if (l && iniciou) A.som.tocar('mirar');
        }
      };
      const fim = (ok) => {
        removeEventListener('pointermove', mover, true); removeEventListener('pointerup', soltar, true); removeEventListener('keydown', tecla, true); removeEventListener('pointercancel', cancelar, true);
        removeEventListener('mousedown', direito, true); removeEventListener('contextmenu', direito, true);
        // o menu do botão direito pode chegar depois (no Windows ele vem ao soltar o botão): segura até soltar
        const tirar = () => { removeEventListener('contextmenu', semMenu, true); removeEventListener('mouseup', soltouDir, true); };
        const soltouDir = (e) => { if (e.button === 2) setTimeout(tirar, 0); };
        addEventListener('contextmenu', semMenu, true); addEventListener('mouseup', soltouDir, true); setTimeout(tirar, 1500);
        camada.classList.add('sai'); setTimeout(() => camada.remove(), 220);
        // o clique que vem junto com o soltar não pode abrir o menu da peça
        const engolir = (e) => { e.stopPropagation(); e.preventDefault(); }; addEventListener('click', engolir, true); setTimeout(() => removeEventListener('click', engolir, true), 0);
        try { raizEl.releasePointerCapture(pid); } catch (_) { /* ok */ }
        ativo = null; ini = null; document.documentElement.classList.remove('ar-arrastando');
        const grudou = ok && alvo;
        if (grudou) { A.som.tocar('grudar'); try { R.mudar(o.peca, alvo.nome); } catch (e) { A.log && A.log.erro && A.log.erro('arranjo', e); } }
        // (0.8.7) rede de segurança: a peça nunca fica escondida depois de soltar, aconteça o que acontecer no meio
        setTimeout(() => { el.classList.remove('ar-pegando', 'ar-fora'); el.style.visibility = ''; }, 900);
        // a peça volta a existir (no lugar novo ou no de antes), ainda invisível; o voador vai até ela e só então ela aparece
        el.classList.remove('ar-fora'); el.style.visibility = 'hidden';
        requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          destino = { left: r.left, top: r.top }; w = r.width; hh = r.height;
          voador.classList.add('pousando'); voador.style.width = Math.max(1, w) + 'px'; voador.style.height = Math.max(1, hh) + 'px';
          // (0.8.3) a peça aparece por baixo enquanto o voador se dissolve nela; grudando, um brilho sai das bordas
          setTimeout(() => {
            el.style.visibility = ''; el.classList.remove('ar-pegando');
            if (grudou) { el.classList.remove('ar-grudou'); void el.offsetWidth; el.classList.add('ar-grudou'); setTimeout(() => el.classList.remove('ar-grudou'), 760); }
            voador.classList.add('some');
            setTimeout(() => { cancelAnimationFrame(raf); voador.remove(); }, 200);
          }, 280);
        });
      };
      const soltar = (e) => { if (e && e.button === 2) return; fim(true); }, cancelar = () => fim(false);
      // botão direito com a peça segura: o atalho dela (o cartão vai compacto para o meio), sem abrir menu nenhum
      const semMenu = (e) => { e.preventDefault(); e.stopPropagation(); };
      // (com o esquerdo apertado, apertar o direito não gera pointerdown, só mousedown; o contextmenu cobre o resto)
      const direito = (e) => { if (!ativo || (e.type === 'mousedown' && e.button !== 2) || !o.direito) return; e.preventDefault(); e.stopPropagation(); alvo = { nome: o.direito.lugar() }; fim(true); };
      addEventListener('mousedown', direito, true); addEventListener('contextmenu', direito, true);
      const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fim(false); } };
      addEventListener('pointermove', mover, true); addEventListener('pointerup', soltar, true); addEventListener('pointercancel', cancelar, true); addEventListener('keydown', tecla, true);
      ativo = true; mover(e0); iniciou = true;
    }
  };

  // retângulos das faixas de cada lado de uma área (os lugares de soltar). (0.8.0) Nenhum entra no outro: em cima e embaixo pegam a
  // largura toda; esquerda e direita ficam só no meio, entre as duas, com um respiro entre cada lugar.
  R.faixas = (rect, espessura, nomes, rotulos = {}) => {
    const g = 8, e = Math.max(40, Math.min(espessura, (rect.width - 3 * g) / 3, (rect.height - 3 * g) / 3));
    const tem = (n) => nomes.includes(n);
    const L = rect.left + g, W = rect.width - 2 * g;
    const y0 = rect.top + g + (tem('cima') ? e + g : 0), y1 = rect.bottom - g - (tem('baixo') ? e + g : 0);
    const todas = {
      cima: new DOMRect(L, rect.top + g, W, e), baixo: new DOMRect(L, rect.bottom - g - e, W, e),
      esquerda: new DOMRect(L, y0, e, Math.max(0, y1 - y0)), direita: new DOMRect(rect.right - g - e, y0, e, Math.max(0, y1 - y0)),
    };
    return nomes.map((n) => ({ nome: n, rect: todas[n], rotulo: rotulos[n] || '' }));
  };
  // uma faixa partida em pedaços lado a lado, com respiro (os cantos e o meio do cartão de perfil). partes: [{ nome, peso, rotulo }]
  R.partes = (rect, partes) => {
    const g = 8, total = partes.reduce((s, p) => s + p.peso, 0), livre = rect.width - g * (partes.length - 1);
    let x = rect.left;
    return partes.map((p) => { const w = (livre * p.peso) / total, r = new DOMRect(x, rect.top, w, rect.height); x += w + g; return { nome: p.nome, rect: r, rotulo: p.rotulo || '' }; });
  };
  R.rotulos = () => ({ cima: T('Em cima', 'Top'), baixo: T('Embaixo', 'Bottom'), esquerda: T('Esquerda', 'Left'), direita: T('Direita', 'Right') });

  // ---------- (0.8.0) a borda de uma peça: a setinha que recolhe/abre e, na lista do Aero Talk, o puxador que muda o tamanho.
  // A setinha fica numa ponta da borda e o puxador no resto (um não fica dentro do outro). A borda fica no espaço entre a peça e o
  // resto: não cobre nada. Segurar a setinha e arrastar puxa a própria peça ao vivo, como algo meio líquido, que segue o mouse;
  // soltando, ela termina de abrir ou de fechar (ou volta, se não foi longe o bastante).
  // o: { peca: 'lado' | 'topo', el, onde: () => 'esquerda'|'direita'|'cima'|'baixo' (onde a peça está), medir: () => DOMRect (a área toda), redimensionar }
  const pecaEl = (peca) => document.querySelector(peca === 'lado' ? '.tk-lado' : '.home > .topo');
  const calma = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ultimo = {}; // o tamanho da peça aberta (para ela voltar com ele)
  const ondeDe = (peca) => (peca === 'lado' ? R.v().lado : R.v().topo);
  const deitada = (peca) => ['cima', 'baixo'].includes(ondeDe(peca));
  // o tamanho da peça aberta, no eixo em que ela abre e fecha
  const cheio = (peca) => {
    const el = pecaEl(peca), d = deitada(peca);
    if (el && !R.recolhida(peca) && !el.classList.contains('ar-vivo')) { const r = el.getBoundingClientRect(); const v = d ? r.height : r.width; if (v > 20) ultimo[peca] = v; }
    if (ultimo[peca]) return ultimo[peca];
    const tam = R.v().tam || {};
    if (peca === 'topo') return d ? 76 : 84;
    return d ? Math.max(R.MIN_H, Math.min(tam.ladoH || 150, innerHeight * 0.62)) : Math.max(R.MIN_W, Math.min(tam.ladoW || 340, innerWidth * 0.55));
  };
  // (0.8.0) "ao vivo": a peça sai da borda como uma gaveta, já do tamanho dela (nada se espreme por dentro), e o resto da tela
  // (a conversa, o conteúdo) encolhe junto, separado dela pelo mesmo vão de sempre. Nada fica por cima de nada.
  const vivo = (peca, px, total, mole = 0) => {
    const el = pecaEl(peca), st = document.documentElement.style, f = Math.max(0, Math.min(1, px / total));
    document.documentElement.classList.add('ar-vivo-' + peca); if (el) el.classList.add('ar-vivo');
    st.setProperty('--ar-vivo-' + peca, Math.round(Math.max(0, Math.min(total, px)) * 10) / 10 + 'px'); st.setProperty('--ar-cheio-' + peca, Math.round(total) + 'px'); st.setProperty('--ar-f-' + peca, f.toFixed(3));
    st.setProperty('--ar-mole-' + peca, Math.max(-1, Math.min(1, mole)).toFixed(3)); // o "líquido": estica na direção em que vai e volta como gelatina
  };
  const semVivo = (peca) => {
    const el = pecaEl(peca), st = document.documentElement.style;
    document.documentElement.classList.remove('ar-vivo-' + peca); if (el) el.classList.remove('ar-vivo');
    for (const k of ['--ar-vivo-', '--ar-cheio-', '--ar-f-', '--ar-mole-']) st.removeProperty(k + peca);
  };
  const rodando = {};
  // de um tamanho a outro com uma mola de verdade: abrindo ela passa um tiquinho e volta (a sobra vira o "estica" da gelatina);
  // fechando é mais firme, sem sobra. Quadro a quadro pelo tempo real (não depende da taxa da tela).
  const levar = (peca, de, para, total, _ms, fim, vel0 = 0) => {
    cancelAnimationFrame(rodando[peca]);
    const abre = para > de, k = abre ? 210 : 260, c = abre ? 17 : 30;
    let px = de, vel = vel0, t0 = performance.now(), parado = 0;
    const quadro = (agora) => {
      const dt = Math.min(0.034, (agora - t0) / 1000); t0 = agora;
      for (let i = 0; i < 4; i++) { const a = k * (para - px) - c * vel; vel += a * dt / 4; px += vel * dt / 4; }
      if (!abre && px < 0) { px = 0; vel = 0; }
      const sobra = abre ? Math.max(0, px - total) / total : 0;
      vivo(peca, px, total, vel / 1800 + sobra * 3);
      if (Math.abs(para - px) < 0.6 && Math.abs(vel) < 8) parado++; else parado = 0;
      if (parado < 2) rodando[peca] = requestAnimationFrame(quadro); else { rodando[peca] = 0; vivo(peca, para, total, 0); fim && fim(); }
    };
    rodando[peca] = requestAnimationFrame(quadro);
  };
  const gravarRec = (peca, vai) => { A.cfg.v.arranjo = { ...R.v(), rec: { ...(R.v().rec || {}), [peca]: vai } }; A.cfg.salvar(); R.aplicar(); A.evt.emit('arranjo', { peca: 'rec' }); };
  R.alternar = (peca, on, o2 = {}) => {
    const vai = on == null ? !R.recolhida(peca) : !!on;
    A.som.tocar(vai ? 'mini-fechar' : 'grudar');
    if (estreita() || calma() || !pecaEl(peca)) { semVivo(peca); gravarRec(peca, vai); return; }
    const total = o2.total || cheio(peca), de = o2.de == null ? (vai ? total : 0) : o2.de;
    if (vai) levar(peca, de, 0, total, 0, () => { gravarRec(peca, true); semVivo(peca); if (o2.depois) o2.depois(); }, o2.vel || 0);
    else { gravarRec(peca, false); levar(peca, de, total, total, 0, () => semVivo(peca), o2.vel || 0); }
  };
  R.borda = (o) => {
    const vertical = () => ['esquerda', 'direita'].includes(o.onde()); // a peça de pé num lado: a borda é uma coluna
    const seta = h('button', { type: 'button', class: 'ar-seta', 'aria-label': T('Recolher ou abrir', 'Collapse or expand') }, A.icone('chevron', 16));
    // (0.8.0) aberta, a peça não tem setinha nem linha: a borda inteira é o puxador. Puxar para menor que o mínimo começa a fechar,
    // como líquido, e soltando ali ela recolhe; a setinha só aparece quando a peça já está escondida.
    const puxa = h('div', { class: 'ar-puxa', title: o.redimensionar ? T('Puxe para mudar o tamanho (ou até o fim para esconder) · dois cliques: tamanho padrão', 'Drag to resize (or all the way to hide) · double click: default size') : T('Puxe para esconder', 'Drag to hide') });
    const borda = h('div', { class: 'ar-borda ar-borda-' + o.peca + (o.redimensionar ? ' redimensiona' : '') }, seta, puxa);
    const pintar = () => {
      const onde = o.onde(), rec = R.recolhida(o.peca);
      borda.dataset.onde = onde; borda.dataset.rec = rec ? '1' : ''; borda.classList.toggle('vertical', vertical());
      seta.title = T('Mostrar de novo (clique ou arraste)', 'Show again (click or drag)'); seta.tabIndex = rec ? 0 : -1; seta.setAttribute('aria-hidden', rec ? 'false' : 'true');
    };
    pintar();
    const off = A.evt.on('arranjo', () => { if (!borda.isConnected) { if (typeof off === 'function') off(); return; } pintar(); });
    // a setinha: clique alterna; segurar e arrastar puxa a peça ao vivo (ela segue o mouse com uma mola, meio líquida) e, ao soltar,
    // termina de abrir ou de fechar (ou volta, se não foi longe o bastante)
    seta.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
      const peca = o.peca, onde = o.onde(), eixoX = vertical(), rec0 = R.recolhida(peca);
      const sinal = onde === 'esquerda' || onde === 'cima' ? 1 : -1; // para que lado do mouse a peça cresce
      const x0 = e.clientX, y0 = e.clientY, raizEl = document.documentElement, pid = e.pointerId;
      try { raizEl.setPointerCapture(pid); } catch (_) { /* ok */ }
      let total = 1, moveu = false, alvo = 0, px = 0, vel = 0, raf = 0, vMouse = 0, ult = { d: 0, t: performance.now() };
      const passo = () => { vel = vel * 0.62 + (alvo - px) * 0.26; px += vel; vivo(peca, Math.max(0, Math.min(total, px)), total, vel / 30); raf = requestAnimationFrame(passo); };
      const mover = (ev) => {
        const dd = (eixoX ? ev.clientX - x0 : ev.clientY - y0) * sinal;
        if (!moveu) {
          if (Math.abs(dd) < 5) return;
          moveu = true; cancelAnimationFrame(rodando[peca]); total = cheio(peca); px = alvo = rec0 ? 0 : total;
          seta.classList.add('puxando'); document.documentElement.classList.add('ar-puxando'); passo();
        }
        alvo = Math.max(0, Math.min(total, (rec0 ? 0 : total) + dd));
        const agora = performance.now(), dt = Math.max(1, agora - ult.t); vMouse = vMouse * 0.5 + ((dd - ult.d) / dt) * 0.5; ult = { d: dd, t: agora };
      };
      const fim = (ev) => {
        removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
        cancelAnimationFrame(raf); seta.classList.remove('puxando'); document.documentElement.classList.remove('ar-puxando');
        try { raizEl.releasePointerCapture(pid); } catch (_) { /* ok */ }
        const engolir = (x) => { x.stopPropagation(); x.preventDefault(); }; addEventListener('click', engolir, true); setTimeout(() => removeEventListener('click', engolir, true), 0);
        if (!moveu) { if (ev.type === 'pointerup') R.alternar(peca); return; }
        // (0.8.3) conta onde o mouse está (e um puxão rápido), não onde a mola chegou: arrastando rápido ela ficava para trás e voltava
        const atual = Math.max(0, Math.min(total, px)), f = alvo / total, jogou = rec0 ? vMouse > 0.6 : vMouse < -0.6;
        if (ev.type === 'pointerup' && (jogou || (rec0 ? f > 0.35 : f < 0.65))) { R.alternar(peca, !rec0, { de: atual, vel: vel * 60 }); return; }
        A.som.tocar('hover'); // não foi longe o bastante: volta macio para como estava
        levar(peca, atual, rec0 ? 0 : total, total, 0, () => semVivo(peca), vel * 60);
      };
      addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
    });
    // controle e teclado: A / Enter na setinha (o clique que o nav.js manda)
    seta.addEventListener('click', (e) => { if (e.detail === 0) R.alternar(o.peca); });
    // o puxador (a borda toda, com a peça aberta): muda o tamanho (lista do Aero Talk); abaixo do mínimo a peça começa a fechar ao vivo,
    // seguindo o mouse como líquido. Soltando com ela já bem fechada, termina de recolher; senão volta macio. Dois cliques: tamanho padrão.
    puxa.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || R.recolhida(o.peca)) return;
      e.preventDefault();
      const peca = o.peca, onde = o.onde(), area = o.medir(), r0 = o.el.getBoundingClientRect(), eixoX = vertical();
      const ini = eixoX ? e.clientX : e.clientY, base = eixoX ? r0.width : r0.height, sinal = onde === 'esquerda' || onde === 'cima' ? 1 : -1;
      const muda = !!o.redimensionar && !estreita();
      const max = muda ? (eixoX ? Math.min(620, area.width * 0.55) : area.height * 0.6) : base, min = muda ? (eixoX ? R.MIN_W : R.MIN_H) : base;
      const varTam = eixoX ? '--ar-lado-w' : '--ar-lado-hr', raiz = document.documentElement;
      raiz.classList.add('ar-redimensionando', eixoX ? 'ar-col' : 'ar-lin');
      const pid = e.pointerId; let preso = false; // (0.8.3) o ponteiro é preso ao começar a mexer (os dois cliques do tamanho padrão continuam)
      let v = base, liquido = false, px = min, alvo = min, vel = 0, raf = 0;
      const passo = () => { vel = vel * 0.62 + (alvo - px) * 0.26; px += vel; vivo(peca, Math.max(0, Math.min(min, px)), min, vel / 30); raf = requestAnimationFrame(passo); };
      const mover = (ev) => {
        if (!preso) { preso = true; try { raiz.setPointerCapture(pid); } catch (_) { /* ok */ } }
        const quer = base + sinal * ((eixoX ? ev.clientX : ev.clientY) - ini);
        if (quer < min - 2 && !calma() && peca !== 'lado') { // (0.8.7) a lista do Aero Talk só encolhe até o mínimo (puxando, ela sumia); passou do mínimo: começa a fechar, ao vivo
          if (!liquido) {
            liquido = true; px = min; vel = 0;
            if (muda) { raiz.style.setProperty(varTam, min + 'px'); if (!eixoX) raiz.style.setProperty('--ar-lado-hmax', 'none'); }
            raiz.classList.add('ar-puxando'); A.som.tocar('hover'); passo();
          }
          alvo = Math.max(0, quer);
          return;
        }
        if (liquido) { liquido = false; cancelAnimationFrame(raf); semVivo(peca); raiz.classList.remove('ar-puxando'); }
        if (!muda) return;
        v = Math.round(Math.max(min, Math.min(max, quer)));
        raiz.style.setProperty(varTam, v + 'px');
        if (!eixoX) raiz.style.setProperty('--ar-lado-hmax', 'none');
      };
      const fim = (ev) => {
        removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
        raiz.classList.remove('ar-redimensionando', 'ar-col', 'ar-lin', 'ar-puxando'); cancelAnimationFrame(raf);
        try { raiz.releasePointerCapture(pid); } catch (_) { /* ok */ }
        if (liquido) {
          const atual = Math.max(0, Math.min(min, px));
          if (ev.type === 'pointerup' && Math.min(atual, alvo) / min < 0.72) { // fecha: a peça volta a ter o tamanho de antes quando abrir de novo
            ultimo[peca] = base;
            R.alternar(peca, true, { de: atual, total: min, vel: vel * 60 });
            return;
          }
          levar(peca, atual, min, min, 0, () => { semVivo(peca); if (muda) R.tamanho(eixoX ? 'ladoW' : 'ladoH', min); else R.aplicar(); }, vel * 60);
          return;
        }
        if (muda && v !== base) R.tamanho(eixoX ? 'ladoW' : 'ladoH', v);
      };
      addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
    });
    if (o.redimensionar) puxa.addEventListener('dblclick', () => { R.tamanho(vertical() ? 'ladoW' : 'ladoH', 0); A.som.tocar('grudar'); });
    return borda;
  };
  // menu de "onde fica" de uma peça (botão direito num espaço vazio dela, ou X no controle): tudo o que o arrastar faz, sem arrastar
  R.menuPeca = (e, peca, extra = []) => {
    const at = R.v()[peca], rot = R.rotulos(), U = A.ui;
    const it = (v) => ({ texto: (at === v ? '✓ ' : '') + (peca === 'topo' ? T('Barra ', 'Bar ') : T('Lista ', 'List ')) + rot[v].toLowerCase(), icone: { cima: 'setaC', baixo: 'seta', esquerda: 'setaE', direita: 'setaD' }[v], onclick: () => { R.mudar(peca, v); A.som.tocar('grudar'); } });
    U.menuContexto(e, [
      { texto: R.recolhida(peca) ? T('Mostrar de novo', 'Show again') : T('Recolher', 'Collapse'), icone: 'chevron', onclick: () => R.alternar(peca) },
      ...extra, null, ...LUGARES[peca].map(it), null,
      { texto: T('Voltar tudo ao padrão', 'Reset the layout'), icone: 'atualizar', onclick: () => { R.restaurar(); A.som.tocar('grudar'); } },
    ]);
  };

  R.aplicar();
  A.evt.on('cfg', () => R.aplicar());
})();
