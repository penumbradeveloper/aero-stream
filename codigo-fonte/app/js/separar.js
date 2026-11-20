// Aero Stream - (1.0.2) uma parte do app (uma conversa, com a chamada, telas e câmeras) numa janela separada do Aero. É a mesma conexão e o
// mesmo app: os elementos só mudam de janela. No lugar fica um aviso; fechar a janela traz tudo de volta. Criado por Ryan Victtor.
(() => {
  const A = window.Aero, { h, T } = A;
  const abertas = new Map(); // chave -> api

  const pode = () => typeof window.open === 'function' && !A.plat.apk && !A.plat.ios && !A.plat.android && !(A.plat.toque && innerWidth < 900);

  function copiarAtributos(de, para) {
    for (const a of [...para.attributes]) if (!de.hasAttribute(a.name)) para.removeAttribute(a.name);
    for (const a of [...de.attributes]) if (para.getAttribute(a.name) !== a.value) para.setAttribute(a.name, a.value);
  }

  function abrir(chave, el, { titulo = 'Aero', largura = 560, altura = 780, aviso, aoVoltar } = {}) {
    if (abertas.has(chave)) { abertas.get(chave).focar(); return abertas.get(chave); }
    const w = window.open('', 'aero-sep-' + String(chave).replace(/[^\w-]/g, ''), `width=${largura},height=${altura}`);
    if (!w) { A.ui.toast(T('Não deu para abrir outra janela.', 'Could not open another window.'), { tipo: 'erro' }); return null; }
    const d = w.document;
    d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'); d.close();
    d.title = titulo + ' · Aero';
    for (const s of document.querySelectorAll('link[rel="stylesheet"], style')) {
      if (s.tagName === 'LINK') d.head.append(h('link', { rel: 'stylesheet', href: s.href })); else d.head.append(d.importNode(s, true));
    }
    d.head.append(Object.assign(d.createElement('style'), { textContent: 'html,body{margin:0;height:100%;overflow:hidden}body{display:flex}.sep-raiz{display:flex;flex:1;min-width:0;min-height:0}.sep-raiz>*{flex:1;min-width:0;min-height:0}.sep-casca{display:contents}' }));
    const espelhar = () => { copiarAtributos(document.documentElement, d.documentElement); copiarAtributos(document.body, d.body); };
    espelhar();
    const obs = new MutationObserver(espelhar);
    obs.observe(document.documentElement, { attributes: true }); obs.observe(document.body, { attributes: true });
    // os "pais" do elemento entram como cascas invisíveis (display: contents): o visual que depende deles continua igual
    let dentro = d.createElement('div'); dentro.className = 'sep-raiz';
    const raiz = dentro;
    const pais = []; for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) pais.unshift(p);
    for (const p of pais) { const c = d.createElement('div'); copiarAtributos(p, c); c.removeAttribute('id'); c.classList.add('sep-casca'); c.style.display = 'contents'; dentro.append(c); dentro = c; }
    const tocando = [...el.querySelectorAll('video, audio')].filter((v) => !v.paused);
    const lugar = h('div', { class: 'sep-lugar' },
      h('div', { class: 'sep-aviso vidro' }, A.icone('externo', 30), h('b', {}, aviso || T('Aberto numa janela separada', 'Open in a separate window')),
        h('div', { class: 'peq suave' }, T('Feche a outra janela para voltar para cá.', 'Close the other window to bring it back here.')),
        A.ui.btn(T('Trazer de volta', 'Bring back'), { icone: 'voltar', tipo: 'sec', onclick: () => api.fechar() })));
    lugar.className += ' ' + el.className; // ocupa o mesmo lugar no layout
    el.replaceWith(lugar);
    dentro.append(d.adoptNode(el));
    d.body.append(raiz);
    const retomar = (lista) => setTimeout(() => lista.forEach((v) => { if (v.isConnected && v.paused) v.play().catch(() => {}); }), 50);
    retomar(tocando);
    let fechado = false;
    const api = {
      el, janela: w,
      focar() { try { w.focus(); } catch (e) {} },
      fechar() {
        if (fechado) return; fechado = true; abertas.delete(chave); obs.disconnect(); clearInterval(vigia);
        const tocandoAgora = [...el.querySelectorAll('video, audio')].filter((v) => !v.paused);
        if (lugar.isConnected) lugar.replaceWith(document.adoptNode(el)); else document.adoptNode(el);
        retomar(tocandoAgora);
        try { if (!w.closed) w.close(); } catch (e) {}
        aoVoltar && aoVoltar();
      },
    };
    // a janela fechou (pelo X dela): volta tudo
    w.addEventListener('pagehide', () => api.fechar());
    const vigia = setInterval(() => { if (w.closed) api.fechar(); }, 700);
    addEventListener('beforeunload', () => { try { w.close(); } catch (e) {} });
    abertas.set(chave, api);
    return api;
  }

  A.separar = { pode, abrir, aberta: (chave) => abertas.get(chave) || null, fecharTodas: () => [...abertas.values()].forEach((x) => x.fechar()) };
})();
