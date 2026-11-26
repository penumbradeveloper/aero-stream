// Aero Stream - (1.0.2) até 3 estilos do app inteiro (cores, fundo, vidro, bolhas, barra das abas, chats, ícone, skin e a bolha do perfil).
// Arraste o cartão para o lado (ou Ctrl+Alt+← / →, ou dois dedos de lado no celular) e o app inteiro troca. Só o estilo em uso roda: os
// outros ficam guardados como dados (as prévias são só as cores, nada animado). Ficam neste aparelho (as imagens de fundo são grandes
// demais para a conta). Ao trocar, o que você mudou no estilo atual fica guardado nele. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const ES = (A.estilos = {});
  const CHAVES = ['tema', 'arranjo', 'chat', 'iconeApp', 'skin', 'bolhaArte'];
  const N = 3;
  // (1.0.3) trocar de estilo (arrastar, atalho e o Usar) é do Aero Bubble Donator; guardar e ver ficam para todo mundo (como prévia)
  const NIVEL = 3;
  ES.pode = () => !A.extras || A.extras.tem(NIVEL);
  const copia = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  // ---------- guardados no IndexedDB (cabem imagens de fundo) ----------
  const db = () => new Promise((ok, falha) => { const r = indexedDB.open('aero-estilos', 1); r.onupgradeneeded = () => r.result.createObjectStore('e'); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
  const fazer = async (modo, f) => { const d = await db(); return new Promise((ok, falha) => { const tx = d.transaction('e', modo), st = tx.objectStore('e'), r = f(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => falha(tx.error); }); };
  let cache = null;
  ES.lista = async () => {
    if (cache) return cache;
    let l = null; try { l = await fazer('readonly', (st) => st.get('slots')); } catch (_) { l = null; }
    cache = Array.from({ length: N }, (_, i) => (l && l[i]) || null);
    return cache;
  };
  const gravar = async () => { try { await fazer('readwrite', (st) => st.put(cache, 'slots')); } catch (e) { A.log && A.log.aviso && A.log.aviso('estilos', e); } };
  const foto = () => { const v = {}; for (const k of CHAVES) if (A.cfg.v[k] !== undefined) v[k] = copia(A.cfg.v[k]); return v; };
  ES.atual = () => { const i = A.cfg.v.estiloAtual; return Number.isInteger(i) && i >= 0 && i < N ? i : -1; };

  ES.salvar = async (i, nome) => {
    const l = await ES.lista();
    l[i] = { nome: (nome || (l[i] && l[i].nome) || T('Estilo ', 'Style ') + (i + 1)).slice(0, 24), v: foto(), t: Date.now() };
    A.cfg.v.estiloAtual = i; A.cfg.salvar(); await gravar(); A.evt.emit('estilos:mudou');
  };
  ES.apagar = async (i) => { const l = await ES.lista(); l[i] = null; if (ES.atual() === i) { A.cfg.v.estiloAtual = -1; A.cfg.salvar(); } await gravar(); A.evt.emit('estilos:mudou'); };
  ES.renomear = async (i, nome) => { const l = await ES.lista(); if (!l[i]) return; l[i].nome = String(nome || '').slice(0, 24) || l[i].nome; await gravar(); A.evt.emit('estilos:mudou'); };

  // troca o app inteiro para o estilo i (dir: -1/1, o lado da animação)
  let trocando = false;
  ES.usar = async (i, dir = 1, semAnim = false) => {
    const l = await ES.lista(), alvo = l[i]; if (!alvo || trocando || !ES.pode()) return false;
    const ant = ES.atual(); if (ant === i) return true;
    trocando = true;
    try {
      if (ant >= 0 && l[ant]) { l[ant].v = foto(); l[ant].t = Date.now(); } // o que mudou no estilo de agora fica nele
      const skinAntes = A.cfg.v.skin || '';
      const aplicar = async () => {
        for (const k of CHAVES) { if (alvo.v[k] !== undefined) A.cfg.v[k] = copia(alvo.v[k]); else if (k === 'skin') A.cfg.v.skin = ''; }
        A.cfg.v.estiloAtual = i; A.cfg.salvar();
        if (A.tema && A.tema.aplicar) A.tema.aplicar();
        if (A.arranjo && A.arranjo.aplicar) { try { A.arranjo.aplicar(); } catch (_) { /* ok */ } }
        if ((A.cfg.v.skin || '') !== skinAntes && A.aer) await A.aer.usar(A.cfg.v.skin || '');
        A.evt.emit('prefs:aplicadas');
      };
      document.documentElement.dataset.estiloDir = dir < 0 ? 'esq' : 'dir';
      const leve = A.cfg.v.visual === 'lite' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (document.startViewTransition && !leve && !semAnim) await document.startViewTransition(aplicar).finished.catch(() => {});
      else await aplicar();
      await gravar(); chip(alvo.nome, i); A.evt.emit('estilos:mudou');
      return true;
    } finally { trocando = false; delete document.documentElement.dataset.estiloDir; }
  };
  // o próximo (ou anterior) estilo salvo
  ES.passar = async (d) => {
    if (!ES.pode()) return false;
    const l = await ES.lista(), salvos = l.map((x, i) => (x ? i : -1)).filter((i) => i >= 0); if (salvos.length < 2) return false;
    const at = ES.atual(), pos = salvos.indexOf(at), prox = salvos[((pos < 0 ? (d > 0 ? -1 : 0) : pos) + d + salvos.length) % salvos.length];
    return ES.usar(prox, d);
  };

  // o nome do estilo aparece rapidinho no alto (sem notificação: some sozinho)
  let chipEl = null, tChip = 0;
  function chip(nome, i) {
    if (!chipEl) { chipEl = h('div', { class: 'estv-chip', 'aria-live': 'polite' }); document.body.append(chipEl); }
    chipEl.replaceChildren(h('span', { class: 'estv-chip-pts' }, ...Array.from({ length: N }, (_, j) => h('i', { class: j === i ? 'on' : '' }))), h('b', {}, nome));
    chipEl.classList.remove('some'); void chipEl.offsetWidth; chipEl.classList.add('mostra');
    clearTimeout(tChip); tChip = setTimeout(() => chipEl.classList.replace('mostra', 'some'), 1400);
  }

  // ---------- gestos: Ctrl+Alt+← / → no computador; dois dedos de lado no celular ----------
  addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable=""], [contenteditable=true]')) return;
    e.preventDefault(); ES.passar(e.key === 'ArrowRight' ? 1 : -1);
  }, true);
  let dois = null;
  addEventListener('touchstart', (e) => { dois = e.touches.length === 2 ? { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2, t: performance.now() } : null; }, { passive: true });
  addEventListener('touchmove', (e) => { if (dois && e.touches.length !== 2) dois = null; else if (dois) { dois.ux = (e.touches[0].clientX + e.touches[1].clientX) / 2; dois.uy = (e.touches[0].clientY + e.touches[1].clientY) / 2; } }, { passive: true });
  addEventListener('touchend', () => {
    const d = dois; dois = null; if (!d || d.ux == null) return;
    const dx = d.ux - d.x, dy = d.uy - d.y;
    if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2 && performance.now() - d.t < 700) ES.passar(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ---------- arrastar de lado num espaço vazio do app: a cor do próximo estilo vem da borda junto com o dedo/mouse ----------
  ES.lista();
  const proxDe = (d) => {
    const l = cache; if (!l) return -1; const salvos = l.map((x, i) => (x ? i : -1)).filter((i) => i >= 0); if (salvos.length < 2) return -1;
    const at = ES.atual(), pos = salvos.indexOf(at); return salvos[((pos < 0 ? (d > 0 ? -1 : 0) : pos) + d + salvos.length) % salvos.length];
  };
  const NAO = 'input, textarea, select, button, a, label, img, video, canvas, svg, iframe, audio, [contenteditable=""], [contenteditable=true], [role=button], [role=slider], [role=option], [role=menu], [role=dialog], [draggable=true], .cx-msg, .vi-palco, .estv-faixa, .menu, .menu-it';
  function vazio(t) {
    if (!t || t.nodeType !== 1 || t.closest(NAO)) return false;
    if ([...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; // em cima de texto, não
    const cs = getComputedStyle(t); if (cs.cursor !== 'auto' && cs.cursor !== 'default') return false; // alças, divisórias, coisas de arrastar
    for (let e = t; e && e !== document.body; e = e.parentElement) { // nada que já role de lado
      if (e.scrollWidth > e.clientWidth + 2) { const ox = getComputedStyle(e).overflowX; if (ox === 'auto' || ox === 'scroll') return false; }
    }
    const sel = getSelection(); return !(sel && String(sel).trim());
  }
  let ar = null, cortina = null;
  function cortinaPara(i, d) {
    const c = corDe(cache[i] && cache[i].v);
    if (!cortina) { cortina = h('div', { class: 'estv-cortina', 'aria-hidden': 'true' }); document.body.append(cortina); }
    cortina.className = 'estv-cortina ' + (d > 0 ? 'da-dir' : 'da-esq') + (c.escuro ? ' escuro' : '');
    cortina.style.cssText = `--c:${c.c};--f1:${c.f1};--f2:${c.f2}`;
    cortina.replaceChildren(h('div', { class: 'estv-cortina-in' }, h('span', { class: 'estv-chip-pts' }, ...Array.from({ length: N }, (_, j) => h('i', { class: j === i ? 'on' : '' }))), h('b', {}, cache[i].nome)));
  }
  const largura = (px) => { if (cortina) cortina.style.setProperty('--w', Math.max(0, Math.min(innerWidth, px)) + 'px'); };
  function comecar(x, y, id) { if (trocando || ar || !ES.pode()) return; ar = { x, y, id, ok: false, d: 0, i: -1, t: performance.now(), ux: x, ut: performance.now(), v: 0 }; }
  function mover(x, y) {
    if (!ar) return false;
    const dx = x - ar.x, dy = y - ar.y;
    if (!ar.ok) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { ar = null; return false; }
      if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.6) return false;
      ar.ok = true; document.documentElement.classList.add('estv-puxando'); try { getSelection().removeAllRanges(); } catch (_) { /* ok */ }
    }
    const d = dx < 0 ? 1 : -1; // puxou para a esquerda: o próximo vem da direita
    if (d !== ar.d) { ar.d = d; ar.i = proxDe(d); if (ar.i >= 0) cortinaPara(ar.i, d); else if (cortina) largura(0); }
    const agora = performance.now(); ar.v = (x - ar.ux) / Math.max(1, agora - ar.ut); ar.ux = x; ar.ut = agora;
    if (ar.i >= 0) largura(Math.abs(dx) * 1.15);
    return true;
  }
  async function soltar() {
    const a = ar; ar = null; if (!a) return;
    document.documentElement.classList.remove('estv-puxando'); if (!a.ok) return;
    const engole = (e) => { e.stopPropagation(); e.preventDefault(); }; addEventListener("click", engole, { capture: true, once: true }); setTimeout(() => removeEventListener("click", engole, true), 50);
    if (!cortina || a.i < 0) return;
    const w = parseFloat(cortina.style.getPropertyValue('--w')) || 0, rapido = Math.abs(a.v) > 0.6 && Math.sign(a.v) === -a.d;
    if (w < Math.min(170, innerWidth * 0.32) && !rapido) { cortina.classList.add('volta'); largura(0); setTimeout(() => cortina && cortina.classList.remove('volta'), 260); return; }
    cortina.classList.add('volta'); largura(innerWidth); await new Promise((r) => setTimeout(r, 220));
    await ES.usar(a.i, a.d, true); // embaixo da cortina, sem outra animação
    cortina.classList.add('sai'); setTimeout(() => { if (cortina) { cortina.remove(); cortina = null; } }, 320);
  }
  // mouse (e caneta)
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.button !== 0 || e.defaultPrevented || !vazio(e.target)) return; comecar(e.clientX, e.clientY, e.pointerId); }, true);
  addEventListener('pointermove', (e) => { if (ar && e.pointerId === ar.id && mover(e.clientX, e.clientY)) e.preventDefault(); }, true);
  addEventListener('pointerup', (e) => { if (ar && e.pointerId === ar.id) soltar(); }, true);
  addEventListener('pointercancel', () => { if (ar && ar.id !== 't') { ar.ok = false; soltar(); if (cortina) largura(0); } }, true);
  // toque (um dedo): o toque segura a rolagem só depois que ficou claro que é de lado
  addEventListener('touchstart', (e) => { if (e.touches.length !== 1) { if (ar) { ar.ok = false; soltar(); if (cortina) largura(0); } return; } if (vazio(e.target)) comecar(e.touches[0].clientX, e.touches[0].clientY, 't'); }, { passive: true, capture: true });
  addEventListener('touchmove', (e) => { if (ar && ar.id === 't' && e.touches.length === 1 && mover(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault(); }, { passive: false, capture: true });
  addEventListener('touchend', () => { if (ar && ar.id === 't') soltar(); }, { passive: true, capture: true });
  addEventListener('touchcancel', () => { if (ar && ar.id === 't') { ar.ok = false; soltar(); if (cortina) largura(0); } }, { passive: true, capture: true });

  // ---------- a seção em Configurações > Aparência: 3 cartões que se arrastam de lado ----------
  const corDe = (v) => { const t = (v && v.tema) || {}; const c = t.cor || '#2d9ee0', f = (t.fundoCores || []).filter(Boolean); return { c, f1: f[0] || (t.escuro ? '#0d1a26' : '#cfe8f7'), f2: f[1] || c, escuro: !!t.escuro }; };
  ES.secao = () => {
    // (1.0.0) um carrossel de verdade: sem barra de rolagem, com setas e bolinhas; arrastar (mouse ou dedo) encaixa no cartão mais perto.
    // Passar pelos cartões só mostra: o estilo só troca no "Usar". Cabendo os 3, ficam os 3 lado a lado
    const faixa = h('div', { class: 'estv-faixa', role: 'listbox', 'aria-label': T('Seus estilos', 'Your styles') });
    const janela = h('div', { class: 'estv-janela', tabindex: '0' }, faixa);
    const pontos = h('div', { class: 'estv-pts' });
    let idx = 0, todas = false;
    const seta = (lado) => h('button', { type: 'button', class: 'estv-seta ' + lado, 'aria-label': lado === 'esq' ? T('Anterior', 'Previous') : T('Próximo', 'Next'), onclick: () => ir(idx + (lado === 'esq' ? -1 : 1)) }, A.icone('chevron', 18));
    const sEsq = seta('esq'), sDir = seta('dir');
    const carrossel = h('div', { class: 'estv-carrossel' }, sEsq, janela, sDir);
    const centro = (i) => { const c = faixa.children[i]; return c ? janela.clientWidth / 2 - (c.offsetLeft + c.offsetWidth / 2) : 0; };
    const posicionar = (anim = true, dx = 0) => {
      faixa.classList.toggle('sem-anim', !anim);
      faixa.style.transform = todas ? '' : `translateX(${Math.round(centro(idx) + dx)}px)`;
      sEsq.disabled = todas || idx <= 0; sDir.disabled = todas || idx >= faixa.children.length - 1;
      pontos.querySelectorAll('.estv-pt').forEach((p, i) => p.classList.toggle('foco', i === idx));
      [...faixa.children].forEach((c, i) => c.classList.toggle('perto', todas || i === idx));
    };
    const ir = (i) => { const n = faixa.children.length; if (!n) return; const novo = Math.max(0, Math.min(n - 1, i)); if (novo !== idx) A.som.tocar('click'); idx = novo; posicionar(true); };
    const medir = () => {
      const n = faixa.children.length;
      todas = n > 0 && janela.clientWidth >= n * 220 + (n - 1) * 12; // os 3 cabem com folga
      carrossel.classList.toggle('todas', todas); carrossel.classList.toggle('estreito', carrossel.clientWidth < 420); posicionar(false);
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!caixa.isConnected) return; medir(); }) : null; if (ro) { ro.observe(janela); ro.observe(carrossel); }
    const caixa = h('div', { class: 'est-caixa' }, h('p', { class: 'peq suave', estilo: { margin: '0 0 10px' } }, T('Guarde até 3 jeitos do app inteiro (cores, fundo, barra, chats, ícone, skin) e troque arrastando de lado em qualquer espaço vazio do app (ou este cartão), com Ctrl+Alt+← / →, ou com dois dedos de lado no celular. Só o estilo em uso fica rodando.', 'Keep up to 3 looks for the whole app (colors, background, bar, chats, icon, skin) and switch by dragging sideways on any empty spot of the app (or this card), with Ctrl+Alt+← / →, or two fingers sideways on the phone. Only the style in use runs.')), A.extras && A.extras.faixaPrevia(NIVEL), carrossel, pontos);
    let pintou = false;
    const pintar = async () => {
      const l = await ES.lista(), at = ES.atual();
      faixa.replaceChildren(...l.map((x, i) => {
        const c = corDe(x && x.v), on = at === i;
        const prev = h('div', { class: 'estv-prev' + (c.escuro ? ' escuro' : ''), estilo: { '--c': c.c, '--f1': c.f1, '--f2': c.f2 } }, h('i', { class: 'estv-p-barra' }), h('i', { class: 'estv-p-bl a' }), h('i', { class: 'estv-p-bl b' }), h('i', { class: 'estv-p-bl c' }));
        const acoes = x
          ? [!on && !ES.pode() ? ((b) => { if (A.extras) b.append(A.extras.selo(NIVEL)); b.classList.add('preso'); return b; })(A.ui.btn(T('Usar', 'Use'), { peq: true, tipo: 'sec', titulo: T('Trocar de estilo é do Aero Bubble Donator', 'Switching styles is on Aero Bubble Donator'), onclick: (e) => { e.stopPropagation(); if (A.extras) A.extras.verPlanos(); } }))
            : A.ui.btn(on ? T('Em uso', 'In use') : T('Usar', 'Use'), { peq: true, tipo: on ? 'sec' : '', onclick: (e) => { e.stopPropagation(); if (!on) ES.usar(i, i > at ? 1 : -1); } }),
            A.ui.btn('', { icone: 'download', tipo: 'sec', redondo: true, peq: true, titulo: T('Guardar o app de agora aqui', 'Save the current look here'), onclick: async (e) => { e.stopPropagation(); if (await A.ui.confirmar(T('Trocar este estilo pelo jeito que o app está agora?', 'Replace this style with the app as it is now?'))) { await ES.salvar(i); A.som.tocar('sucesso'); } } }),
            A.ui.btn('', { icone: 'lapis', tipo: 'sec', redondo: true, peq: true, titulo: T('Renomear', 'Rename'), onclick: async (e) => { e.stopPropagation(); const campo = h('input', { class: 'campo', value: x.nome, maxlength: 24 }); if (await A.ui.confirmar(campo, { titulo: T('Nome do estilo', 'Style name'), sim: T('Salvar', 'Save') })) ES.renomear(i, campo.value.trim()); } }),
            A.ui.btn('', { icone: 'lixo', tipo: 'sec', redondo: true, peq: true, titulo: T('Apagar', 'Delete'), onclick: async (e) => { e.stopPropagation(); if (await A.ui.confirmar(T('Apagar este estilo? O app continua como está.', 'Delete this style? The app stays as it is.'), { perigo: true })) ES.apagar(i); } })]
          : [A.ui.btn(T('Guardar o app de agora', 'Save the current look'), { icone: 'mais', peq: true, onclick: async (e) => { e.stopPropagation(); await ES.salvar(i); A.som.tocar('sucesso'); } })];
        return h('div', { class: 'estv-cartao' + (on ? ' on' : '') + (x ? '' : ' vazio'), role: 'option', 'aria-selected': String(on), dados: { i } },
          prev, h('div', { class: 'estv-nome' }, h('b', {}, x ? x.nome : T('Espaço livre', 'Empty slot')), h('small', { class: 'suave' }, (i + 1) + '/' + N)), h('div', { class: 'estv-acoes' }, ...acoes));
      }));
      pontos.replaceChildren(...l.map((x, i) => h('button', { type: 'button', class: 'estv-pt' + (at === i ? ' on' : '') + (x ? '' : ' vazio'), 'aria-label': (x && x.nome) || (T('Espaço ', 'Slot ') + (i + 1)), onclick: () => ir(i) })));
      if (!pintou) { pintou = true; idx = Math.max(0, at); }
      requestAnimationFrame(medir);
    };
    // arrastar (mouse ou dedo): a faixa segue o ponteiro e, ao soltar, encaixa no cartão mais perto (ou no próximo, com um puxão)
    let ar = null;
    faixa.addEventListener('pointerdown', (e) => {
      if (todas || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button, input')) return;
      ar = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, moveu: false };
    });
    faixa.addEventListener('pointermove', (e) => {
      if (!ar || e.pointerId !== ar.id) return;
      const dx = e.clientX - ar.x, dy = e.clientY - ar.y;
      if (!ar.moveu) { if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) { ar = null; return; } if (Math.abs(dx) < 6) return; ar.moveu = true; faixa.setPointerCapture(e.pointerId); faixa.classList.add('arrastando'); }
      const n = faixa.children.length, borda = (idx === 0 && dx > 0) || (idx === n - 1 && dx < 0); // nas pontas, resiste
      posicionar(false, borda ? dx / 3 : dx);
    });
    const soltar = (e) => {
      if (!ar || (e && e.pointerId !== ar.id)) return;
      const a = ar; ar = null; faixa.classList.remove('arrastando'); if (!a.moveu) return;
      const dx = (e ? e.clientX : a.x) - a.x, c = faixa.children[idx], w = c ? c.offsetWidth + 12 : 260, rapido = Math.abs(dx) / Math.max(1, Date.now() - a.t) > 0.5;
      let passo = Math.round(-dx / w); if (!passo && rapido && Math.abs(dx) > 24) passo = dx < 0 ? 1 : -1;
      const antes = idx; idx = Math.max(0, Math.min(faixa.children.length - 1, idx + passo)); if (idx !== antes) A.som.tocar('click');
      posicionar(true);
    };
    faixa.addEventListener('pointerup', soltar); faixa.addEventListener('pointercancel', soltar);
    faixa.addEventListener('click', (e) => { const c = e.target.closest('.estv-cartao'); if (c && !e.target.closest('button') && !todas) ir(+c.dataset.i); }, true);
    // roda do mouse de lado (touchpad) ou com Shift: um cartão por vez
    let rodaT = 0;
    janela.addEventListener('wheel', (e) => { if (todas) return; const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0; if (!d) return; e.preventDefault(); if (Date.now() - rodaT < 350 || Math.abs(d) < 8) return; rodaT = Date.now(); ir(idx + (d > 0 ? 1 : -1)); }, { passive: false });
    janela.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); ir(idx - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); ir(idx + 1); } });
    const off = A.evt.on('estilos:mudou', () => { if (!caixa.isConnected) { if (typeof off === 'function') off(); return; } pintar(); });
    pintar();
    return caixa;
  };
})();
