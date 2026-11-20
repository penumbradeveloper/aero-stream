// (0.8.3) animações de perfil só ao passar o mouse: com a opção ligada (Aparência), foto, banner e nameplate animados das pessoas
// ficam parados no primeiro quadro e só animam enquanto o mouse está em cima do cartão, da linha ou da mensagem onde aparecem.
(() => {
  const A = window.Aero;
  const RX = /\/api\/(?:avatar|banner|nameplate)\/[^"')\s]+/g;
  const ESCOPOS = '.perfil-cartao, .mini-perfil, .tk-item, .tk-eu, .cx-msg, .tk-membro, .tk-amigo, .conv-item, .cx-cab';
  const ligado = () => ((A.cfg && A.cfg.v && A.cfg.v.tema) || {}).animPerfil === 'hover';
  const quadros = new Map(); // url de verdade -> Promise<url do primeiro quadro | null (não é animada)>
  const parados = new Set(); // as urls dos quadros parados (blob:)

  const animada = async (b) => {
    if (typeof ImageDecoder !== 'function' || !b.type) return true;
    try {
      if (!(await ImageDecoder.isTypeSupported(b.type))) return true;
      const d = new ImageDecoder({ data: await b.arrayBuffer(), type: b.type });
      await d.tracks.ready; const s = !!(d.tracks.selectedTrack && d.tracks.selectedTrack.animated); d.close(); return s;
    } catch (_) { return true; }
  };
  const quadro = (real) => {
    if (!quadros.has(real)) quadros.set(real, (async () => {
      try {
        const r = await fetch((A.ui && A.ui.imgSegura && A.ui.imgSegura(real)) || real); if (!r.ok) return null;
        const b = await r.blob(); if (!(await animada(b))) return null;
        const bmp = await createImageBitmap(b), c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
        const out = await new Promise((ok) => c.toBlob(ok, 'image/png'));
        if (!out) return null; const u = URL.createObjectURL(out); parados.add(u); return u;
      } catch (_) { return null; }
    })());
    return quadros.get(real);
  };
  const urlsDe = (el) => {
    if (el.tagName === 'IMG') { const s = el.getAttribute('src') || ''; RX.lastIndex = 0; return RX.test(s) ? [s] : []; }
    const st = el.getAttribute('style') || ''; if (!st.includes('/api/')) return [];
    return [...new Set((st.match(/url\(\s*["']?([^"')]+)["']?\s*\)/g) || []).map((x) => x.replace(/^url\(\s*["']?|["']?\s*\)$/g, '')).filter((u) => { RX.lastIndex = 0; return RX.test(u); }))];
  };
  const trocar = (el, de, para) => {
    if (el.tagName === 'IMG') { if (el.getAttribute('src') === de) el.src = para; return; }
    const st = el.getAttribute('style') || ''; if (st.includes(de)) el.setAttribute('style', st.split(de).join(para));
  };
  // deixa parado (se a imagem for animada); idempotente: o que já está parado não muda
  const congelar = (el) => {
    if (!ligado() || el.dataset.animOn || !el.isConnected) return;
    for (const real of urlsDe(el)) {
      quadro(real).then((q) => {
        if (!q || !ligado() || el.dataset.animOn) return;
        (el._animPar || (el._animPar = new Map())).set(q, real);
        el.dataset.animP = '1'; trocar(el, real, q);
      });
    }
  };
  const animar = (el, sim) => {
    if (sim) {
      el.dataset.animOn = '1';
      if (el._animPar) for (const [q, real] of el._animPar) trocar(el, q, real);
    } else { delete el.dataset.animOn; congelar(el); }
  };
  const varrer = (raiz) => {
    if (!raiz || raiz.nodeType !== 1) return;
    if (raiz.matches('img, [style]')) congelar(raiz);
    raiz.querySelectorAll('img[src*="/api/"], [style*="/api/"]').forEach(congelar);
  };

  let obs = null, escopo = null;
  const escopoDe = (t) => {
    let e = t && t.closest ? t.closest(ESCOPOS) : null, fora = e;
    while (e) { fora = e; e = e.parentElement && e.parentElement.closest(ESCOPOS); }
    return fora || (t && t.closest ? t.closest('[data-anim-p], .avatar') : null);
  };
  const entrar = (novo) => {
    if (novo === escopo) return;
    if (escopo) { if (escopo.matches('[data-anim-p]')) animar(escopo, false); escopo.querySelectorAll('[data-anim-p]').forEach((x) => animar(x, false)); }
    escopo = novo;
    if (escopo) { if (escopo.matches('[data-anim-p]')) animar(escopo, true); escopo.querySelectorAll('[data-anim-p]').forEach((x) => animar(x, true)); }
  };
  const aoPassar = (e) => entrar(escopoDe(e.target));
  const aoSair = (e) => { if (!e.relatedTarget) entrar(null); };

  function aplicar() {
    if (ligado()) {
      if (obs) return;
      obs = new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.type === 'attributes') { const el = m.target; if (!el.dataset.animOn) congelar(el); }
          else m.addedNodes.forEach(varrer);
        }
      });
      obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'style'] });
      document.addEventListener('pointerover', aoPassar, true);
      document.documentElement.addEventListener('pointerout', aoSair, true);
      varrer(document.body);
      if (escopo) { const e = escopo; escopo = null; entrar(e); }
    } else {
      if (obs) { obs.disconnect(); obs = null; }
      document.removeEventListener('pointerover', aoPassar, true);
      document.documentElement.removeEventListener('pointerout', aoSair, true);
      escopo = null;
      document.querySelectorAll('[data-anim-p]').forEach((el) => { animar(el, true); delete el.dataset.animOn; delete el.dataset.animP; el._animPar = null; });
    }
  }

  A.animPerfil = { aplicar, parados };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar); else aplicar();
})();
