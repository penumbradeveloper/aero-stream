// Aero Stream — o site: bolhas com parallax, animações ao rolar, versão atual e o convite "abrir no aplicativo". Criado por Ryan Victtor.
(() => {
  'use strict';
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const en = document.documentElement.lang === 'en', T = (pt, ing) => (en ? ing : pt);
  // (0.6.0) idioma: quem escolheu PT/EN fica no que escolheu; na primeira visita, navegador em outro idioma (não português) vai para o inglês
  const lerIdioma = () => { try { return localStorage.getItem('aero-site-idioma') || ''; } catch (e) { return ''; } };
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[data-idioma]'); if (a) { try { localStorage.setItem('aero-site-idioma', a.dataset.idioma); } catch (x) { /* ok */ } } });
  if (!en && !lerIdioma() && !/^pt/i.test(navigator.language || '') && !location.search.includes('sala=') && /\/(index\.html)?$/.test(location.pathname)) { location.replace('en/' + location.search); return; }
  if (en && lerIdioma() === 'pt') { location.replace('../' + location.pathname.split('/').pop() + location.search); return; }

  // ---------- convite (?sala=ABC234): pergunta se abre no aplicativo; senão segue para o Aero Web ----------
  const sala = (new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if (/^[A-Z0-9]{4,12}$/.test(sala)) {
    const web = (en ? '../' : '') + 'app/?sala=' + sala;
    const caixa = document.createElement('div');
    caixa.className = 'convite';
    caixa.innerHTML = `<div class="vidro" role="dialog" aria-modal="true" aria-labelledby="conv-t">
      <img src="${en ? '../' : ''}icon.svg" alt="" width="70" height="70">
      <h2 id="conv-t">${T('Você foi convidado para uma sala', 'You were invited to a room')}</h2>
      <div class="codigo">${sala}</div>
      <p>${T('Abrir no aplicativo do Aero (se estiver instalado) ou continuar no navegador?', 'Open in the Aero app (if installed) or continue in the browser?')}</p>
      <div class="botoes"><a class="btn pri" id="conv-app" href="aerostream://sala/${sala}">${T('Abrir no aplicativo', 'Open in the app')}</a><a class="btn sec" href="${web}">${T('Continuar no navegador', 'Continue in the browser')}</a></div></div>`;
    document.addEventListener('DOMContentLoaded', () => {
      document.body.append(caixa);
      // o navegador pergunta "Abrir Aero Stream?" sozinho; se o app não estiver instalado, nada acontece e a pessoa usa o outro botão
      setTimeout(() => { try { location.href = 'aerostream://sala/' + sala; } catch (e) { /* sem o app */ } }, 400);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // ---------- bolhas do céu ----------
    const ceu = document.createElement('div'); ceu.className = 'ceu'; ceu.setAttribute('aria-hidden', 'true');
    const bolhas = [];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('i'); const t = 30 + Math.random() * 150;
      Object.assign(b.style, { width: t + 'px', height: t + 'px', left: Math.random() * 100 + '%', top: Math.random() * 140 + '%', animationDelay: -Math.random() * 14 + 's', animationDuration: 10 + Math.random() * 10 + 's', opacity: 0.45 + Math.random() * 0.5 });
      b.dataset.vel = (0.1 + Math.random() * 0.5).toFixed(2);
      ceu.append(b); bolhas.push(b);
    }
    document.body.prepend(ceu);

    // ---------- parallax: bolhas e painéis de vidro andam em velocidades diferentes ----------
    const paineis = [...document.querySelectorAll('[data-vel]')].filter((e) => !e.closest('.ceu'));
    let pedido = 0;
    const mover = () => {
      pedido = 0; const y = scrollY;
      for (const b of bolhas) b.style.transform = `translate3d(0, ${-y * b.dataset.vel}px, 0)`;
      for (const p of paineis) { const r = p.parentElement.getBoundingClientRect(); const meio = r.top + r.height / 2 - innerHeight / 2; p.style.transform = `translate3d(0, ${meio * Number(p.dataset.vel)}px, 0)`; }
    };
    if (!reduzir) { addEventListener('scroll', () => { if (!pedido) pedido = requestAnimationFrame(mover); }, { passive: true }); mover(); }

    // ---------- surgir ao rolar ----------
    const io = new IntersectionObserver((itens) => itens.forEach((it) => { if (it.isIntersecting) { it.target.classList.add('visto'); io.unobserve(it.target); } }), { threshold: 0.15 });
    document.querySelectorAll('.surgir').forEach((e, i) => { e.style.transitionDelay = (Number(e.dataset.atraso) || 0) + 'ms'; io.observe(e); });

    // ---------- versão atual (vem do servidor) ----------
    fetch('/versao.json', { cache: 'no-store' }).then((r) => r.json()).then((v) => {
      document.querySelectorAll('[data-versao]').forEach((e) => { e.textContent = 'v' + v.versao + (e.dataset.versao === 'beta' ? ' beta' : ''); });
    }).catch(() => {});

    // ---------- copiar (PIX, comandos) ----------
    document.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copiar); const t = b.textContent; b.textContent = T('Copiado!', 'Copied!'); b.classList.add('ok'); setTimeout(() => { b.textContent = t; b.classList.remove('ok'); }, 1600); } catch (e) { prompt(T('Copie:', 'Copy:'), b.dataset.copiar); }
    }));
  });
})();
