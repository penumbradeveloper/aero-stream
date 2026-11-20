// Aero Stream - (1.0.2) o catálogo das integrações oficiais, que vem do servidor: uma integração nova aparece na aba Integrações (e na
// barra da chamada) sem atualizar o app. O catálogo só traz DADOS (textos, ícone, plano, plataformas, versão mínima e o tipo); o que cada
// tipo faz está aqui no app e nada que chega do servidor vira código:
//  - 'nativa': o comportamento já vem no app (MODULOS). Se o app não conhece o módulo, a página diz para atualizar.
//  - 'link':   um botão que abre um endereço https no navegador, sempre perguntando antes e mostrando o site.
//  - 'janela': uma janelinha do Aero com títulos, textos, listas e links, montada aqui (só texto, nunca HTML).
// O catálogo fica guardado neste aparelho (abre sem internet) e o app já vem com uma cópia (integ-semente.js) para a primeira vez.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  const C = (A.integCat = {});
  const CHAVE = 'aero.integCatalogo';

  // os módulos nativos que este app sabe fazer funcionar
  C.MODULOS = new Set(['musica', 'celmic', 'gunslol', 'assistindo', 'traducao', 'dicionario', 'horario', 'cartoes']);
  const TIPOS = ['nativa', 'link', 'janela'], CATS = ['conversa', 'widget'], PLATS = ['pc', 'web', 'celular'], LUGARES = ['chamada'], BLOCOS = ['titulo', 'texto', 'lista', 'link'];

  // ---------- a conferência (a mesma do servidor; aqui a entrada errada só fica de fora) ----------
  const tx = (v, n) => (v && typeof v === 'object' && typeof v.pt === 'string' && v.pt.trim() && v.pt.length <= n && (v.en == null || (typeof v.en === 'string' && v.en.length <= n)) ? { pt: v.pt, en: v.en || v.pt } : null);
  const httpsOk = (u) => { if (typeof u !== 'string' || u.length > 500) return false; try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password; } catch (e) { return false; } };
  const versao = (v) => (typeof v === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v) ? v : null);
  function entrada(x) {
    if (!x || typeof x !== 'object') return null;
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(x.id || '') || /^c-/.test(x.id)) return null;
    if (!TIPOS.includes(x.tipo) || !CATS.includes(x.cat) || !/^[a-zA-Z0-9]{1,24}$/.test(x.icone || '')) return null;
    const nome = tx(x.nome, 40), resumo = tx(x.resumo, 160), desc = tx(x.desc, 1200);
    if (!nome || !resumo || !desc || !versao(x.appMin)) return null;
    const plats = Array.isArray(x.plataformas) ? x.plataformas.filter((p) => PLATS.includes(p)) : [];
    if (!plats.length) return null;
    const o = { id: x.id, versao: Number.isInteger(x.versao) && x.versao >= 1 ? x.versao : 1, tipo: x.tipo, cat: x.cat, icone: x.icone, plano: Number.isInteger(x.plano) ? Math.max(0, Math.min(4, x.plano)) : 0, plataformas: plats, appMin: x.appMin, nome, resumo, desc };
    if (tx(x.onde, 400)) o.onde = tx(x.onde, 400);
    if (tx(x.curto, 16)) o.curto = tx(x.curto, 16);
    if (typeof x.cena === 'string' && /^[a-z]{1,16}$/.test(x.cena)) o.cena = x.cena;
    if (Array.isArray(x.seguro)) o.seguro = x.seguro.slice(0, 6).map((s) => tx(s, 240)).filter(Boolean);
    if (x.tipo === 'nativa') { if (!/^[a-z][a-z0-9]{1,23}$/.test(x.modulo || '')) return null; o.modulo = x.modulo; }
    if (x.tipo === 'link' || x.tipo === 'janela') {
      o.lugares = Array.isArray(x.lugares) ? x.lugares.filter((l) => LUGARES.includes(l)) : [];
      if (tx(x.rotulo, 60)) o.rotulo = tx(x.rotulo, 60);
    }
    if (x.tipo === 'link') { if (!httpsOk(x.url)) return null; o.url = x.url; }
    if (x.tipo === 'janela') {
      const bl = (Array.isArray(x.blocos) ? x.blocos.slice(0, 30) : []).map((b) => {
        if (!b || !BLOCOS.includes(b.t)) return null;
        if (b.t === 'lista') { const it = (Array.isArray(b.itens) ? b.itens.slice(0, 12) : []).map((i) => tx(i, 200)).filter(Boolean); return it.length ? { t: 'lista', itens: it } : null; }
        const y = { t: b.t, x: tx(b.x, b.t === 'titulo' ? 80 : 600) }; if (!y.x) return null;
        if (b.t === 'link') { if (!httpsOk(b.url)) return null; y.url = b.url; }
        return y;
      }).filter(Boolean);
      if (!bl.length) return null; o.blocos = bl;
    }
    return o;
  }
  C.limpar = (d) => {
    if (!d || typeof d !== 'object' || !Array.isArray(d.lista)) return null;
    const ids = new Set(), lista = [];
    for (const x of d.lista.slice(0, 200)) { const o = entrada(x); if (o && !ids.has(o.id)) { ids.add(o.id); lista.push(o); } }
    return { v: typeof d.v === 'string' ? d.v.slice(0, 40) : '', lista };
  };

  // ---------- o que este aparelho consegue usar ----------
  C.plataforma = () => (A.plat && A.plat.desktop ? 'pc' : A.plat && A.plat.apk ? 'celular' : 'web');
  C.compararVersao = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };
  const nivel = () => (A.extras && A.extras.nivel ? A.extras.nivel() : 0);
  // por que (ainda) não dá para instalar: 'app' (precisa de um app mais novo) ou 'plano'; null = pode
  C.bloqueio = (x) => {
    if (C.compararVersao(A.versao || '0.0.0', x.appMin) < 0) return 'app';
    if (x.tipo === 'nativa' && !C.MODULOS.has(x.modulo)) return 'app';
    if (x.plano && nivel() < x.plano) return 'plano';
    return null;
  };
  C.nestaPlataforma = (x) => x.plataformas.includes(C.plataforma());

  // ---------- a lista (guardada neste aparelho, com a cópia que vem no app para a primeira vez) ----------
  let atual = null;
  const ler = () => { try { return C.limpar(JSON.parse(localStorage.getItem(CHAVE) || 'null')); } catch (e) { return null; } };
  C.dados = () => atual || (atual = ler() || C.limpar(A.INTEG_SEMENTE) || { v: '', lista: [] });
  C.lista = () => C.dados().lista;
  C.porId = (id) => C.lista().find((x) => x.id === id) || null;
  C.texto = (v) => (v ? A.T(v.pt, v.en) : '');
  // busca a lista nova no servidor (no máximo uma vez por minuto); avisa 'integ:catalogo' só quando ela mudou
  let ultima = 0, pedindo = null;
  C.buscar = (forcar) => {
    if (pedindo) return pedindo;
    if (!forcar && Date.now() - ultima < 60000) return Promise.resolve(false);
    if (!A.api || !A.api.servidor) return Promise.resolve(false);
    ultima = Date.now();
    pedindo = A.api.req('integ-catalogo').then((d) => {
      const novo = C.limpar(d); if (!novo || !novo.lista.length) return false;
      if (novo.v && novo.v === C.dados().v) return false;
      atual = novo;
      try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch (e) { /* sem espaço: fica só nesta abertura */ }
      A.evt.emit('integ:catalogo');
      return true;
    }).catch((e) => { A.log && A.log.aviso && A.log.aviso('catálogo de integrações: ' + (e && e.message)); return false; }).finally(() => { pedindo = null; });
    return pedindo;
  };
  // ao abrir o app (e de novo quando a conta entra)
  setTimeout(() => C.buscar(true), 1500);
  if (A.evt) A.evt.on('hub:eu', () => C.buscar());
})();
