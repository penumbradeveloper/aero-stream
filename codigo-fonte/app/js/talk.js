// Aero Stream - "Aero Talk": conversas privadas e em grupo (cifradas de ponta a ponta), amigos, apelidos e chamadas de voz/vídeo.
// Pense num Skype de console, com bolhas: à esquerda as conversas (ou os amigos), à direita a conversa aberta.
// As chamadas (voz e vídeo, estilo Skype, sem criar sala) ficam em chamada.js.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T, API = A.api, H = A.hub;
  const TK = (A.talk = { conversas: [], abertas: new Map(), aberta: null, naoLidas: 0 });
  // duração "1:05:12" / "12:04" e as mensagens do sistema das chamadas (como no Discord)
  TK.duracao = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
  TK.textoSistema = (m) => {
    const quem = TK.nomeDe ? TK.nomeDe(m.de) : m.de, s = m.sis || {};
    if (s.tipo === 'chamada') return { sistema: 'chamada', texto: quem + (s.video ? T(' iniciou uma chamada de vídeo.', ' started a video call.') : T(' iniciou uma chamada.', ' started a call.')) };
    if (s.tipo === 'chamada-fim') return { sistema: 'fim', texto: T('A chamada terminou · durou ', 'The call ended · lasted ') + TK.duracao(s.dur || 0) };
    if (s.tipo === 'fixou') return { sistema: 'fixou', alvo: s.seq, texto: quem + T(' fixou uma mensagem.', ' pinned a message.') }; // (1.0.2)
    if (s.tipo === 'chamada-perdida') return { sistema: 'perdida', texto: T('Chamada perdida de ', 'Missed call from ') + quem };
    return { sistema: 'outro', texto: '' };
  };
  // (1.0.1) quem fala na faixa da chamada: com o anel de fala, ele sai suave e para quando a pessoa se cala
  const falaEm = (el, on) => { if (A.extras && A.extras.fala) A.extras.fala(el, on); else el.classList.toggle('falando', on); };
  const MAX_GRUPO = 10; // grupos do Aero Talk: você e mais 9 (para mais gente, existem as salas)
  TK.MAX_GRUPO = MAX_GRUPO;
  // (0.7.14) com o Aero Bubble, grupos maiores: o limite de um grupo vem do servidor (c.limite); para criar, vale o da sua conta
  const maxDe = (c) => (c && c.limite) || (!c && API.eu && API.eu.bolha && API.eu.bolha.grupo) || MAX_GRUPO;
  const LIMITE = 10 * 1024 * 1024, PARTE = 8 * 1024 * 1024;
  // (0.7.14) o limite de anexo da conta (10 MB, ou 50/100/500 MB com o Aero Bubble)
  TK.limiteAnexo = () => Math.max(LIMITE, (API.eu && API.eu.bolha && API.eu.bolha.anexo) || 0);
  const dicaLimite = () => (API.eu && API.eu.bolha && API.eu.bolha.tx === 2 ? '' : T('Com o Aero Bubble, arquivos maiores.', 'With Aero Bubble, bigger files.'));

  // ---------- dados ----------
  const amigo = (cod) => H.amigos.find((a) => a.codigo === cod);
  const nomeDe = (cod) => { if (API.eu && cod === API.eu.codigo) return API.eu.nome; const a = amigo(cod); if (a) return a.apelido || a.nome; for (const c of TK.conversas) { const m = (c.membros || []).find((x) => x.codigo === cod); if (m) return m.apelido || m.nome; } return '?'; };
  const pessoaDe = (cod) => { if (API.eu && cod === API.eu.codigo) return API.eu; return amigo(cod) || TK.conversas.flatMap((c) => c.membros || []).find((x) => x.codigo === cod) || { codigo: cod, nome: '?' }; };
  const outroDaDM = (c) => { const m = (c.membros || []).find((x) => !API.eu || x.codigo !== API.eu.codigo) || {}; const a = m.codigo && amigo(m.codigo); return a ? { ...m, nome: a.nome, tag: a.tag, av: a.av, apelido: a.apelido || m.apelido, nm: a.nm || m.nm, np: a.np, npV: a.npV, bannerV: a.bannerV } : m; }; // o amigo traz o nome/foto mais novos
  // (0.7.14) chats e chamadas de voz de dentro de um grupo: conversas "filhas" (c.pai), com as mesmas pessoas do grupo
  TK.paiDe = (c) => (c && c.pai ? TK.conversas.find((x) => x.id === c.pai) || null : null);
  TK.filhos = (c) => (c ? TK.conversas.filter((x) => x.pai === c.id) : []);
  TK.raizDe = (c) => TK.paiDe(c) || c;
  const nomeCanal = (c) => (c.canal === 'voz' ? '🔊 ' : '# ') + (c.nome || '');
  TK.titulo = (c) => (c.pai ? ((TK.paiDe(c) || {}).nome || '') + ' · ' + nomeCanal(c) : c.tipo === 'grupo' ? c.nome : (outroDaDM(c).apelido || outroDaDM(c).nome || '?'));
  // não lidas de um grupo na lista: as do chat principal e as dos chats de dentro dele
  TK.naoLidasGrupo = (c) => TK.naoLidasDe(c) + TK.filhos(c).filter((f) => f.canal !== 'voz' && !f.mudo).reduce((s, f) => s + TK.naoLidasDe(f), 0);
  const codigos = (c) => (c.membros || []).map((m) => m.codigo);

  async function reqBinario(rota, dados) {
    const r = await fetch(`${API.servidor}/api/${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + API.token }, body: dados });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || T('Não consegui enviar o arquivo.', 'Could not send the file.'));
    return d;
  }

  // (0.6.0) não lidas: conversa silenciada só conta menções a você; "marcar como não lida" conta como 1
  TK.mencoes = {};
  // (0.6.1) não lidas: as que chegaram depois da última lida, ou, se a pessoa marcou "não lida" numa mensagem, DESSA mensagem até o fim
  TK.naoLidasDe = (c) => { const seq = c.seq || 0, n = Math.max(0, seq - (c.lido || 0)), m = +c.marca; return Number.isFinite(m) && m > 0 ? Math.max(n, seq - m + 1, 1) : c.marca ? Math.max(n, 1) : n; };
  // o total (aba, bandeja e barra de tarefas) conta exatamente o que a lista mostra: canal de voz não tem não lidas visíveis (antes entrava
  // na soma e deixava um "1" preso que nunca sumia) e o chat de dentro de um grupo silenciado só conta menções, como o próprio grupo
  const contaNoTotal = (c) => { if (c.canal === 'voz') return 0; const p = c.pai && TK.paiDe(c); return c.mudo || (p && p.mudo) ? TK.mencoes[c.id] || 0 : TK.naoLidasDe(c); };
  const contar = () => { TK.naoLidas = TK.conversas.reduce((s, c) => s + contaNoTotal(c), 0); A.evt.emit('talk:naoLidas', TK.naoLidas); };
  TK.contar = contar;
  // (0.6.1) dois pedidos da lista ao mesmo tempo podiam voltar fora de ordem: a resposta velha chegava por último e apagava a conversa
  // que acabou de aparecer. Só a resposta do pedido mais novo vale (as outras esperam por ela)
  let pedidoLista = 0, ultimaLista = null;
  TK.carregar = async () => {
    const n = ++pedidoLista, p = API.req('conv'); ultimaLista = p; TK.listaEm = Date.now();
    const d = await p;
    if (n !== pedidoLista) { await ultimaLista.catch(() => {}); return TK.conversas; }
    const antigas = new Map(TK.conversas.map((c) => [c.id, c]));
    TK.conversas = (d.conversas || []).map((c) => { const a = antigas.get(c.id); if (a && a.recibos && c.recibos) c.recibos = juntarRecibos(a.recibos, c.recibos); return a && a.previa && (a.previaSeq || 0) >= ((c.um && c.um.seq) || 0) ? { ...c, previa: a.previa, previaSeq: a.previaSeq, previaDe: a.previaDe, previaT: a.previaT } : c; });
    contar();
    A.evt.emit('talk:lista');
    previasIniciais(TK.conversas);
    return TK.conversas;
  };
  // status de uma mensagem minha (como no WhatsApp): enviada, recebida (algum aparelho de todos pegou) ou lida (só se todos deixam)
  TK.statusDe = (c, m) => {
    // (0.8.2) a conversa de agora: a lista recarregada troca os objetos, e o chat aberto ficava lendo os recibos da antiga (uma setinha só até reabrir)
    const atual = c && TK.conversas.find((x) => x.id === c.id);
    const r = ((atual || c) && (atual || c).recibos) || []; if (!r.length) return 'enviada';
    if (r.every((x) => x.lido != null && x.lido >= m.seq)) return 'lida';
    if (r.every((x) => (x.entregue || 0) >= m.seq)) return 'recebida';
    return 'enviada';
  };
  TK.iniciar = async () => {
    try { await A.cripto.iniciar(); } catch (e) { A.log.aviso('cripto', e); }
    try { await TK.carregar(); } catch (e) { A.log.aviso('talk', e); }
  };

  // mensagem do servidor (cifrada) -> mensagem do chat (aberta)
  // (0.8.3) a prévia da lista (texto da última mensagem, quem mandou e quando): igual ao vivo e ao abrir o app
  function fazerPrevia(c, m) {
    const eu = API.eu && API.eu.codigo, minha = m.de === eu;
    let t = m.texto || (m.anexo ? '📎 ' + (m.anexo.tipo === 'imagem' ? T('imagem', 'image') : m.anexo.tipo === 'audio' ? T('áudio', 'audio') : m.anexo.tipo === 'video' ? T('vídeo', 'video') : m.anexo.tipo === 'texto' && m.anexo.nome ? String(m.anexo.nome).slice(0, 40) : T('arquivo', 'file')) : '');
    t = t.replace(/<@(todos|aqui)>/gi, (_, x) => '@' + x.toLowerCase()).replace(/<@([A-Z0-9]{6})>/gi, (_, x) => '@' + nomeDe(x.toUpperCase())).replace(/<fig:[^>]+>/gi, T('figurinha', 'sticker')).replace(/<em:[A-Z0-9]{6}:[0-9a-f]{10}:([a-z0-9_]{2,24})>/gi, ':$1:'); // (1.0.0) emoji próprio: :nome:
    // (1.0.2) mensagem que é só um link de GIF (ou de imagem/vídeo): a prévia diz "GIF" em vez do endereço
    const so = /^\s*(https?:\/\/\S+)\s*$/i.exec(t);
    if (so) { const u = so[1].toLowerCase(); if (/(klipy\.com|klipy\.co|tenor\.com|giphy\.com|gfycat\.com)\//.test(u) || /\.gif(\?|#|$)/.test(u)) t = 'GIF'; else if (/\.(png|jpe?g|webp|avif)(\?|#|$)/.test(u)) t = '📎 ' + T('imagem', 'image'); else if (/\.(mp4|webm|mov)(\?|#|$)/.test(u)) t = '📎 ' + T('vídeo', 'video'); }
    const quem = minha ? T('Você: ', 'You: ') : c.tipo === 'grupo' && !m.sistema && m.de ? nomeDe(m.de) + ': ' : '';
    c.previa = quem + t; c.previaSeq = m.seq; c.previaDe = m.de; c.previaT = m.t || Date.now();
  }
  let previasPedido = 0;
  async function previasIniciais(convs) {
    const n = ++previasPedido;
    const faltam = convs.filter((c) => c.um && (c.previaSeq || 0) < c.um.seq);
    if (!faltam.length) return;
    await Promise.all(faltam.map(async (c) => {
      try {
        const u = c.um;
        if (u.apagado) { c.previa = T('mensagem apagada', 'message deleted'); c.previaSeq = u.seq; c.previaDe = null; c.previaT = u.t; return; }
        const m = await abrirMsg(c, u); if (m && n === previasPedido && (c.previaSeq || 0) < u.seq) fazerPrevia(c, m);
      } catch (_) { /* fica sem prévia */ }
    }));
    if (n === previasPedido) A.evt.emit('talk:lista');
  }
  TK.recenteDe = (c) => Math.max(c.previaT || 0, c.ult || 0, ...TK.filhos(c).map((f) => Math.max(f.previaT || 0, f.ult || 0)));
  async function abrirMsg(c, m) {
    const base = { id: m.seq, seq: m.seq, de: m.de, t: m.t, editado: m.editado, rea: m.rea || null };
    if (m.apagado) return null;
    if (m.sis) return { ...base, ...TK.textoSistema(m) }; // chamada iniciada / quanto durou (mensagem do servidor, sem conteúdo privado)
    const p = await A.cripto.decifrar(m.cifra, m.de, { cid: c.id, seq: m.seq, membros: codigos(c) });
    if (!p) return { ...base, texto: T('🔒 Esta mensagem ainda não chegou para esta conta (ela volta quando quem mandou abrir o app).', '🔒 This message has not reached this account yet (it comes back when the sender opens the app).'), trancada: true };
    const msg = { ...base, texto: p.texto || '' };
    if (p.enc) msg.enc = true;
    if (p.resp) msg.resp = { id: p.resp.seq, nome: nomeDe(p.resp.de), trecho: p.resp.trecho || '', img: !!p.resp.anexo };
    const tipoDe = (an) => /^image\//.test(an.mime) ? 'imagem' : /^audio\//.test(an.mime) || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)$/i.test(an.nome || '') ? 'audio' : /^video\//.test(an.mime) ? 'video' : A.codigo && A.codigo.ehTexto(an.nome, an.mime) ? 'texto' : 'arquivo';
    if (p.anexo && m.anexo) msg.anexo = { ...p.anexo, sid: m.anexo.id, tipo: tipoDe(p.anexo) }; // (0.6.9) áudio baixado com cara de vídeo (.m4a/.mp3 como video/mp4) vira áudio
    // (0.9.5) várias fotos/vídeos numa mensagem só: a lista inteira (o primeiro continua em "anexo")
    if (Array.isArray(p.anexos) && Array.isArray(m.anexos) && p.anexos.length === m.anexos.length && p.anexos.length > 1) {
      msg.anexos = p.anexos.slice(0, 20).map((an, i) => ({ ...an, sid: m.anexos[i].id, tipo: tipoDe(an) }));
      msg.anexo = msg.anexos[0];
    }
    return msg;
  }
  // anexos: baixa os bytes cifrados, abre aqui e vira um endereço local (blob:)
  // (0.9.4) só os ~60 anexos abertos mais recentes ficam na memória. Antes cada foto, vídeo ou áudio aberto ao rolar o chat ficava guardado
  // até fechar o app (centenas de MB lendo uma conversa antiga, e o app ficando cada vez mais lento). Os que ainda estão na tela não saem;
  // os que saíram são abertos de novo se voltarem a aparecer
  const urls = new Map(), abrindo = new Map(), mortas = new Set(), MAX_URLS = 60;
  TK.urlMorta = (u) => !!u && mortas.has(u);
  TK.urlViva = (a) => (a && a.url && !mortas.has(a.url) ? a.url : null);
  const enxugarUrls = () => {
    if (urls.size <= MAX_URLS) return;
    for (const [k, u] of urls) {
      if (urls.size <= MAX_URLS) break;
      let usada = false; try { usada = !!document.querySelector('[src="' + CSS.escape(u) + '"]'); } catch (_) { usada = true; }
      if (usada) continue;
      urls.delete(k); mortas.add(u); try { URL.revokeObjectURL(u); } catch (_) { /* ok */ }
    }
  };
  TK.urlAnexo = (cid, a) => {
    const k = cid + a.sid;
    if (urls.has(k)) { const u = urls.get(k); urls.delete(k); urls.set(k, u); return Promise.resolve(u); } // a mais usada vai para o fim da fila
    if (abrindo.has(k)) return abrindo.get(k); // a mesma aberta duas vezes ao mesmo tempo: uma decifragem só
    const p = abrirUrl(cid, a, k).finally(() => abrindo.delete(k)); abrindo.set(k, p); return p;
  };
  // (0.9.5) abre a mídia da mensagem: a única ou cada uma da grade (cada uma que fica pronta avisa)
  TK.abrirMidias = (cid, m, pronto) => {
    const l = m.anexos || (m.anexo ? [m.anexo] : []);
    for (const a of l) if (a && a.sid && !TK.urlViva(a) && a.tipo !== 'arquivo') TK.urlAnexo(cid, a).then((u) => { a.url = u; pronto(m, a); }).catch(() => {});
  };
  const abrirUrl = async (cid, a, k) => {
    const baixar = async (rota) => { const r = await fetch(`${API.servidor}/api/conv/${cid}/anexo/${rota}`, { headers: { Authorization: 'Bearer ' + API.token } }); if (!r.ok) throw new Error('anexo'); return r.arrayBuffer(); };
    let blob;
    if (a.partes > 0) { // (0.7.14) anexo grande: uma parte por vez
      const pedacos = [];
      for (let i = 0; i < Math.min(a.partes, 100); i++) pedacos.push(await A.cripto.decifrarParte(a.k, a.iv, i, await baixar(a.sid + '/' + i)));
      blob = new Blob(pedacos, { type: a.mime || 'application/octet-stream' });
    } else blob = await A.cripto.decifrarArquivo(await baixar(a.sid), a.k, a.iv, a.mime);
    const u = URL.createObjectURL(blob);
    urls.set(k, u); enxugarUrls(); return u;
  };

  // (0.8.3) "copiar link" de uma imagem/GIF/vídeo do chat. O link leva a chave depois do # (o servidor nunca vê essa parte): colado em
  // qualquer conversa do Aero, vira a própria mídia. Ex.: https://servidor/m/<conversa>/<anexo>#<chave>
  const b64u = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const deb64u = (t) => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/')))));
  TK.linkAnexo = (cid, a) => (a && a.sid && a.k && a.iv ? `${API.servidor}/m/${cid}/${a.sid}#` + b64u({ k: a.k, iv: a.iv, m: a.mime || '', p: a.partes || 0, n: a.nome || '' }) : null);
  const RE_LINK = /\/m\/([a-z0-9_-]{4,48})\/([0-9a-f]{20})#([A-Za-z0-9_-]{20,})$/i;
  TK.ehLinkAnexo = (u) => { try { const x = new URL(u); return x.origin === new URL(API.servidor).origin && RE_LINK.test(x.pathname + x.hash); } catch (_) { return false; } };
  const doLink = new Map();
  TK.midiaDeLink = (u) => {
    if (!doLink.has(u)) doLink.set(u, (async () => {
      const x = new URL(u), [, cid, sid, chave] = (x.pathname + x.hash).match(RE_LINK), d = deb64u(chave);
      if (!/^(image|video)\//.test(d.m || '')) return null;
      const baixar = async (rota) => { const r = await fetch(`${API.servidor}/api/midia/${cid}/${rota}`, { headers: { Authorization: 'Bearer ' + API.token } }); if (!r.ok) throw new Error('anexo'); return r.arrayBuffer(); };
      let blob;
      if (d.p > 0) { const ps = []; for (let i = 0; i < Math.min(d.p, 100); i++) ps.push(await A.cripto.decifrarParte(d.k, d.iv, i, await baixar(sid + '/' + i))); blob = new Blob(ps, { type: d.m }); }
      else blob = await A.cripto.decifrarArquivo(await baixar(sid), d.k, d.iv, d.m);
      return { url: URL.createObjectURL(blob), mime: d.m, nome: d.n || '' };
    })().catch(() => { doLink.delete(u); return null; }));
    return doLink.get(u);
  };

  TK.mensagens = async (c, antes, limite) => {
    const d = await API.req(`conv/${c.id}/msgs` + (antes ? '?antes=' + antes : '') + (limite ? (antes ? '&' : '?') + 'limite=' + limite : ''));
    // (0.8.7) todas se abrem ao mesmo tempo (antes uma esperava a outra), na mesma ordem
    const out = (await Promise.all((d.msgs || []).map((m) => abrirMsg(c, m).catch(() => null)))).filter(Boolean);
    return { msgs: out, mais: d.mais };
  };
  // (0.6.0) sem internet: a mensagem aparece na hora como "pendente" (relógio) e vai sozinha quando a conexão volta
  const fila = []; let tentando = false;
  TK.pendentes = (cid) => fila.filter((x) => x.c.id === cid).map((x) => x.m);
  async function tentarFila() {
    if (tentando || !fila.length) return; tentando = true;
    while (fila.length) {
      const x = fila[0];
      try { await enviarJa(x.c, x.d); fila.shift(); A.evt.emit('talk:pendente-fim', { cid: x.c.id, id: x.m.id }); }
      catch (e) { if (e.status && e.status !== 0 && e.status < 500 && e.status !== 429) { fila.shift(); A.evt.emit('talk:pendente-fim', { cid: x.c.id, id: x.m.id }); A.ui.toast(e.message, { tipo: 'erro' }); continue; } break; }
    }
    tentando = false;
    if (fila.length) setTimeout(tentarFila, 4000);
  }
  addEventListener('online', tentarFila); A.evt.on('hub:eu', tentarFila);
  let idPend = 0, filaAnexos = Promise.resolve();
  TK.enviar = async (c, d) => { if (TK.euDigito && c) TK.euDigito(c.id, false);
    if (d.anexos && d.anexos.length > 1 && !d.anexo) d = { ...d, anexo: d.anexos[0] };
    if (d.anexo && d.segundoPlano) {
      // (0.8.3) como no Discord: a mensagem aparece na hora com a prévia e "Enviando...", o campo fica livre e o arquivo sobe em segundo plano
      // (um de cada vez, na ordem). Quando a de verdade chega, ela toma o lugar da prévia
      const an = d.anexo, url = URL.createObjectURL(an), r = d.resp;
      const m = { id: 'p' + (++idPend), seq: Infinity, de: API.eu.codigo, t: Date.now(), texto: d.texto || '', pendente: true, subindo: { nome: d.anexos && d.anexos.length > 1 ? d.anexos.length + T(' arquivos', ' files') : String(an.nome || an.name || 'arquivo').slice(0, 80), mime: an.type || '', url },
        resp: r ? { id: r.seq || r.id, nome: nomeDe(r.de), trecho: (r.texto || '').slice(0, 120), img: !!r.anexo } : undefined };
      A.evt.emit('talk:pendente', { cid: c.id, msg: m });
      const fim = (e) => { A.evt.emit('talk:pendente-fim', { cid: c.id, id: m.id }); setTimeout(() => URL.revokeObjectURL(url), 8000); if (e) A.ui.toast(e.message || String(e), { tipo: 'erro' }); };
      filaAnexos = filaAnexos.then(() => enviarJa(c, { ...d, segundoPlano: undefined })).then(() => fim(), fim);
      return;
    }
    if (d.anexo || d.anexos) return enviarJa(c, d); // anexo vai direto (precisa subir o arquivo)
    const r = d.resp; // (0.8.3) a cópia já mostra a resposta: a de verdade entra no lugar dela sem trocar nada na tela
    const m = { id: 'p' + (++idPend), seq: Infinity, de: API.eu.codigo, t: Date.now(), texto: d.texto, pendente: true, resp: r ? { id: r.seq || r.id, nome: nomeDe(r.de), trecho: (r.texto || '').slice(0, 120), img: !!r.anexo } : undefined };
    // (0.9.1) anti-spam: no máximo 20 esperando para sair (o servidor libera 10 a cada 5 s); o resto não entra na fila
    if (fila.length >= 20) throw new Error(T('Devagar! Muitas mensagens seguidas.', 'Slow down! Too many messages in a row.'));
    fila.push({ c, d, m }); A.evt.emit('talk:pendente', { cid: c.id, msg: m });
    tentarFila();
  };
  // largura x altura de uma foto ou vídeo (só números; se não der para medir, vai sem)
  async function medirMidia(f) {
    const tipo = String(f.type || '');
    try {
      if (/^image\//.test(tipo) && window.createImageBitmap) { const b = await createImageBitmap(f); const r = [b.width, b.height]; b.close(); return r[0] > 0 && r[1] > 0 ? r : null; }
      if (/^video\//.test(tipo)) {
        const u = URL.createObjectURL(f), v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.src = u;
        const r = await new Promise((ok) => { const fim = (x) => { clearTimeout(t); ok(x); }; const t = setTimeout(() => fim(null), 4000); v.onloadedmetadata = () => fim(v.videoWidth > 0 && v.videoHeight > 0 ? [v.videoWidth, v.videoHeight] : null); v.onerror = () => fim(null); });
        v.removeAttribute('src'); v.load(); URL.revokeObjectURL(u); return r;
      }
    } catch (_) { /* vai sem o tamanho */ }
    return null;
  }
  async function subirUm(c, anexo) {
    let sid = '', info2 = null;
    {
      const lim = TK.limiteAnexo();
      if (anexo.size > lim) throw new Error(T('Arquivo grande demais (máximo ', 'File too large (max ') + Math.round(lim / 1048576) + ' MB).');
      const info = { mime: anexo.type || 'application/octet-stream', nome: String(anexo.nome || anexo.name || 'arquivo').slice(0, 80), tam: anexo.size };
      const dm = await medirMidia(anexo); if (dm) { info.w = dm[0]; info.h = dm[1]; } // (0.9.4) o tamanho vai junto (cifrado): quem recebe já reserva o espaço
      if (anexo.size <= LIMITE) {
        const f = await A.cripto.cifrarArquivo(anexo);
        sid = (await reqBinario(`conv/${c.id}/anexo`, f.dados)).id;
        info2 = { k: f.k, iv: f.iv, ...info };
      } else {
        // (0.7.14) arquivo grande (Aero Bubble): cifra e sobe uma parte de 8 MB por vez
        const ch = await A.cripto.chaveArquivo(), partes = Math.ceil(anexo.size / PARTE);
        sid = (await API.req(`conv/${c.id}/anexo-grande`, { tam: anexo.size, partes })).id;
        for (let i = 0; i < partes; i++) await reqBinario(`conv/${c.id}/anexo-grande/${sid}/${i}`, await A.cripto.cifrarParte(ch, i, new Uint8Array(await anexo.slice(i * PARTE, (i + 1) * PARTE).arrayBuffer())));
        info2 = { k: ch.k, iv: ch.iv, ...info, partes };
      }
    }
    return { sid, info: info2 };
  }
  async function enviarJa(c, { texto, anexo, anexos, resp, enc }) {
    const payload = { texto: texto || '' };
    if (enc) payload.enc = 1; // (0.7.2) encaminhada (vai dentro da mensagem cifrada: o servidor não vê)
    let sid = '', sids = null;
    if (anexos && anexos.length > 1) { // (0.9.5) várias fotos/vídeos juntos: sobem um por vez e vão numa mensagem só
      const l = []; for (const a of anexos.slice(0, 20)) l.push(await subirUm(c, a));
      sids = l.map((x) => x.sid); sid = sids[0]; payload.anexo = l[0].info; payload.anexos = l.map((x) => x.info);
    } else if (anexo) { const x = await subirUm(c, anexo); sid = x.sid; payload.anexo = x.info; }
    if (resp) payload.resp = { seq: resp.seq || resp.id, de: resp.de, trecho: (resp.texto || '').slice(0, 120), anexo: !!resp.anexo };
    const cifra = await A.cripto.cifrar(payload, codigos(c));
    await API.req(`conv/${c.id}/msgs`, { cifra, anexo: sid || undefined, anexos: sids || undefined, resp: resp ? resp.seq || resp.id : undefined });
    A.som.tocar('chat-envio');
  }
  TK.editar = async (c, m, texto) => {
    const payload = { texto };
    if (m.enc) payload.enc = 1;
    const so = (a) => ({ k: a.k, iv: a.iv, mime: a.mime, nome: a.nome, tam: a.tam, partes: a.partes, ...(a.w > 0 && a.h > 0 ? { w: a.w, h: a.h } : {}) });
    if (m.anexo) payload.anexo = so(m.anexo);
    if (m.anexos) payload.anexos = m.anexos.map(so);
    if (m.resp) payload.resp = { seq: m.resp.id, trecho: m.resp.trecho };
    await API.req(`conv/${c.id}/msgs/${m.seq}`, { cifra: await A.cripto.cifrar(payload, codigos(c)) }, 'PUT');
  };
  // (0.7.2) ENCAMINHAR (como no Discord, com a cara do Aero): escolhe uma ou mais conversas (com busca), uma mensagem opcional e envia.
  // Vale para qualquer mensagem: texto, links/embeds, GIFs, figurinhas e anexos (o anexo é enviado de novo, cifrado para a conversa nova)
  TK.encaminhar = (m, origem) => {
    const U = A.ui, marcados = new Set();
    const busca = h('input', { class: 'campo enc-busca', type: 'search', placeholder: T('Buscar', 'Search'), 'aria-label': T('Buscar conversa', 'Search conversation') });
    const lista = h('div', { class: 'enc-lista' });
    const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const subt = (c) => (c.tipo === 'grupo' ? (c.membros || []).slice(0, 4).map((p) => p.apelido || p.nome).join(', ') + ((c.membros || []).length > 4 ? T(' e mais ', ' and ') + ((c.membros || []).length - 4) : '') : '#' + (outroDaDM(c).tag || outroDaDM(c).codigo || ''));
    const enviarBtn = U.btn(T('Enviar', 'Send'), { icone: 'enviar', onclick: () => enviar() }); enviarBtn.disabled = true;
    const pintar = () => {
      const q = norm(busca.value.trim()); lista.textContent = '';
      const cs = TK.conversas.filter((c) => !c.pedido || c.pedido.aceito).filter((c) => !q || norm(TK.titulo(c) + ' ' + subt(c)).includes(q));
      if (!cs.length) { lista.append(h('p', { class: 'suave peq', estilo: { padding: '10px' } }, T('Nenhuma conversa encontrada.', 'No conversation found.'))); return; }
      cs.forEach((c, i) => {
        const chk = h('input', { type: 'checkbox', tabindex: '-1' }); chk.checked = marcados.has(c.id);
        const it = h('label', { class: 'enc-item' + (chk.checked ? ' marcado' : ''), estilo: { '--i': Math.min(i, 12) } },
          c.tipo === 'grupo' ? TK.avatarGrupo(c, 36) : U.avatar(outroDaDM(c), 36), h('div', { class: 'cresce' }, h('b', {}, TK.titulo(c)), h('div', { class: 'peq suave' }, subt(c))), chk);
        chk.addEventListener('change', () => { if (chk.checked) marcados.add(c.id); else marcados.delete(c.id); it.classList.toggle('marcado', chk.checked); enviarBtn.disabled = !marcados.size; A.som.tocar('click'); });
        lista.append(it);
      });
    };
    busca.addEventListener('input', pintar);
    const extra = h('input', { class: 'campo', placeholder: T('Adicione uma mensagem opcional...', 'Add an optional message...'), maxlength: 2000 });
    const previa = h('div', { class: 'enc-previa' }, A.icone('encaminhar', 16), h('span', { class: 'cresce' }, m.anexo ? T('1 arquivo', '1 file') + (m.texto ? ' · ' + m.texto.slice(0, 80) : '') : (m.texto || '').slice(0, 120)));
    extra.addEventListener('keydown', (e) => { if (e.key === 'Enter' && marcados.size) enviar(); });
    const md = U.modal(T('Encaminhar para', 'Forward to'), h('div', { class: 'col enc-caixa' }, h('p', { class: 'suave peq', estilo: { margin: '0' } }, T('Selecione onde você quer compartilhar esta mensagem.', 'Choose where you want to share this message.')), busca, lista, previa, h('div', { class: 'linha', estilo: { gap: '8px' } }, extra, enviarBtn)), { largura: '480px' });
    pintar(); setTimeout(() => busca.focus(), 60);
    async function enviar() {
      if (!marcados.size) return;
      enviarBtn.disabled = true;
      try {
        let arquivo = null;
        if (m.anexo) {
          const url = TK.urlViva(m.anexo) || (origem && m.anexo.sid ? await TK.urlAnexo(origem.id, m.anexo) : null);
          if (url) { const b = await (await fetch(url)).blob(); arquivo = new File([b], m.anexo.nome || 'arquivo', { type: m.anexo.mime || b.type }); }
        }
        for (const cid of marcados) {
          const c = TK.conversas.find((x) => x.id === cid); if (!c) continue;
          if (arquivo) await enviarJa(c, { texto: m.texto || '', anexo: arquivo, enc: true }); else await TK.enviar(c, { texto: m.texto || '', enc: true });
          if (extra.value.trim()) await TK.enviar(c, { texto: extra.value.trim() });
        }
        md.fechar(); A.som.tocar('sucesso');
        U.toast(marcados.size > 1 ? T('Encaminhada para ' + marcados.size + ' conversas.', 'Forwarded to ' + marcados.size + ' conversations.') : T('Mensagem encaminhada.', 'Message forwarded.'), { tipo: 'ok', ms: 2200 });
      } catch (e) { enviarBtn.disabled = false; U.toast(e.message || String(e), { tipo: 'erro' }); }
    }
  };
  TK.apagar = (c, m) => API.req(`conv/${c.id}/msgs/${m.seq}`, null, 'DELETE');
  // (0.6.0) "lida" de verdade: chamado quando a conversa está aberta, visível, com a janela em foco e o fim da conversa na tela
  TK.marcarLido = (c, seq) => {
    seq = Math.max(seq || 0, c.seq || 0);
    if (TK.mencoes[c.id]) delete TK.mencoes[c.id];
    if (seq > (c.lido || 0)) { c.lido = seq; mandarLido(c.id, seq); contar(); A.evt.emit('talk:lista'); }
  };
  // (0.9.1) o "lida" vai ao servidor um por vez por conversa, sempre com o mais novo: muitas mensagens seguidas não viram muitos pedidos
  // fora de ordem, e um erro não zera mais o contador (tenta de novo depois)
  const lidoFila = new Map(); // cid -> { quer, indo }
  function mandarLido(cid, seq) {
    const f = lidoFila.get(cid) || { quer: 0, indo: false }; f.quer = Math.max(f.quer, seq); lidoFila.set(cid, f);
    if (f.indo) return;
    f.indo = true; const vai = f.quer;
    API.req(`conv/${cid}/lido`, { seq: vai }).then(() => { f.indo = false; if (f.quer > vai) mandarLido(cid, f.quer); else lidoFila.delete(cid); })
      .catch(() => { f.indo = false; setTimeout(() => mandarLido(cid, f.quer), 2500); });
  }
  TK.marca = (c, seq) => { c.marca = seq || 0; contar(); A.evt.emit('talk:lista'); return API.req(`conv/${c.id}/marca`, { seq: seq || 0 }).catch(() => {}); };
  TK.silenciar = async (c, mudo) => { await API.req(`conv/${c.id}/mudo`, { mudo }); c.mudo = mudo; contar(); A.evt.emit('talk:lista'); A.som.tocar(mudo ? 'mic-off' : 'mic-on'); };
  TK.fechar = async (c) => { await API.req(`conv/${c.id}/ocultar`, {}); await TK.carregar(); };
  TK.fixar = async (c, m, sim) => { const r = await API.req(`conv/${c.id}/fixar`, { seq: m.seq || m.id, sim }); c.fixadas = r.fixadas || []; A.evt.emit('talk:fixadas', c.id); A.som.tocar(sim ? 'bolha' : 'mini-fechar'); };
  TK.sair = async (c) => { await API.req(`conv/${c.id}/sair`, {}); A.som.tocar('estourar'); await TK.carregar(); A.evt.emit('talk:fechar-se', c.id); };
  TK.responderPedido = async (c, aceitar) => { await API.req(`conv/${c.id}/pedido`, { aceitar }); await TK.carregar(); };
  // GIFs (Klipy, pelo servidor) e figurinhas da conta
  let favsCache = null;
  A.evt.on('hub:gifs-fav', () => { favsCache = null; });
  TK.gifs = {
    buscar: async (q, pag) => API.req('gifs?pag=' + pag + (q ? '&q=' + encodeURIComponent(q) : '')),
    favoritos: async () => favsCache || (favsCache = (await API.req('gifs/favoritos')).favoritos || []),
    favoritar: async (g, sim) => { const r = await API.req('gifs/favoritos', { gif: g, sim }); favsCache = r.favoritos || []; A.som.tocar(sim ? 'bolha' : 'mini-fechar'); },
    eFavorito: (url) => !!(favsCache && favsCache.some((g) => g.url === url)),
  };
  TK.figurinhas = {
    listar: async () => { const r = await API.req('figurinhas'); return { lista: r.figurinhas || [], codigo: r.codigo }; },
    criar: async (f) => {
      let corpo = f, tipo = f.type;
      if (f.type !== 'image/gif') { // todas no mesmo tamanho (320x320, sem distorcer, fundo transparente)
        const bmp = await createImageBitmap(f); const cv = document.createElement('canvas'); cv.width = 320; cv.height = 320;
        const e = Math.min(320 / bmp.width, 320 / bmp.height); cv.getContext('2d').drawImage(bmp, (320 - bmp.width * e) / 2, (320 - bmp.height * e) / 2, bmp.width * e, bmp.height * e);
        corpo = await new Promise((ok) => cv.toBlob(ok, 'image/webp', 0.9)); tipo = 'image/webp';
      } else if (f.size > 2 * 1048576) throw new Error(T('GIF grande demais para figurinha (máximo 2 MB).', 'GIF too large for a sticker (max 2 MB).'));
      const r = await fetch(`${API.servidor}/api/figurinhas`, { method: 'POST', headers: { Authorization: 'Bearer ' + API.token, 'Content-Type': tipo }, body: corpo });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || T('Não consegui criar a figurinha.', 'Could not create the sticker.'));
      return d.id;
    },
    apagar: (id) => API.req('figurinhas/' + id, null, 'DELETE'),
    // (0.8.5) favoritas: figurinhas de qualquer pessoa, guardadas na conta (a lista vem com o código de quem criou)
    favoritas: async () => figsCache || (figsCache = (await API.req('figurinhas/favoritas')).favoritas || []),
    favoritar: async (codigo, id, sim) => { const r = await API.req('figurinhas/favoritas', { codigo, id, sim }); figsCache = r.favoritas || []; A.som.tocar(sim ? 'bolha' : 'mini-fechar'); A.evt.emit('talk:figs-fav'); },
    eFavorita: (codigo, id) => !!(figsCache && figsCache.some((f) => f.c === codigo && f.id === id)),
    // (1.0.2) nome (para a busca do painel) e importar um emoji como figurinha
    nomear: async (codigo, id, n) => { const r = await API.req('figurinhas/nome', { codigo, id, n }); figsCache = r.favoritas || figsCache; },
    importar: async (url, n) => {
      const r = await fetch(url); if (!r.ok) throw new Error(T('Não consegui pegar essa imagem.', 'Could not get that image.'));
      const b = await r.blob(); const id = await TK.figurinhas.criar(b);
      if (n && id) await TK.figurinhas.nomear('', id, n).catch(() => {});
    },
  };
  let figsCache = null;
  A.evt.on('hub:figs-fav', () => { figsCache = null; TK.figurinhas.favoritas().then(() => A.evt.emit('talk:figs-fav')).catch(() => {}); });
  // (0.8.1) a conversa a dois que já está na lista abre na hora (antes: duas idas ao servidor, quase 1 s); só uma nova é pedida ao servidor
  TK.abrirDM = async (codigo) => {
    const ja = (TK.conversas || []).find((x) => x.tipo === 'dm' && Array.isArray(x.membros) && x.membros.some((m) => m.codigo === codigo));
    if (ja) return ja;
    const c = await API.req('conv/dm', { codigo }); await TK.carregar(); return TK.conversas.find((x) => x.id === c.id) || c;
  };
  TK.criarGrupo = async (nome, membros) => { const c = await API.req('conv/grupo', { nome, membros }); await TK.carregar(); return TK.conversas.find((x) => x.id === c.id) || c; };

  // Migração: este aparelho abre as mensagens antigas que só ele lê e embrulha a chave delas para a chave da conta,
  // para os seus outros aparelhos lerem também. Roda uma vez por chave da conta, em segundo plano e sem pressa.
  let migrando = false;
  A.evt.on('cripto:migrar', async () => {
    const C = A.cripto;
    if (migrando || !C.kid) return;
    migrando = true;
    try {
      if (!TK.conversas.length) await (ultimaLista && Date.now() - (TK.listaEm || 0) < 15000 ? ultimaLista.catch(() => {}) : TK.carregar()); // (1.0.2) usa o pedido que acabou de sair
      for (const c of TK.conversas) {
        // refaz a conversa quando muda a MINHA chave ou a de alguém dela (aí o histórico é re-compartilhado com a chave nova)
        const marca = 'aero-migrado:' + c.id + ':' + C.kid + ':' + (await C.kidsDe(codigos(c))) + (C.legado ? ':legado' : '');
        try { if (localStorage.getItem(marca)) continue; } catch (_) { /* sem armazenamento: refaz, não faz mal */ }
        let antes = 0;
        for (let pag = 0; pag < 40; pag++) {
          const d = await API.req(`conv/${c.id}/msgs?limite=80` + (antes ? '&antes=' + antes : ''));
          for (const m of d.msgs || []) if (!m.apagado && m.cifra) await C.decifrar(m.cifra, m.de, { cid: c.id, seq: m.seq, membros: codigos(c) });
          if (!d.mais || !(d.msgs || []).length) break;
          antes = d.msgs[0].seq;
        }
        await C.enviarFila();
        try { localStorage.setItem(marca, '1'); } catch (_) { /* ok */ }
      }
      if (C.legado) await C.esquecerLegado(); // tudo o que a chave antiga do aparelho abria já está na chave da conta
    } catch (e) { A.log.aviso('migrar', e); }
    migrando = false;
  });

  // ao vivo
  const avisados = new Set(); // "cid:seq" das mensagens que já tiveram aviso
  if (window.aero && window.aero.aoNotificacaoClique) window.aero.aoNotificacaoClique((cid) => { if (cid && TK.irPara) TK.irPara(cid); });
  // (0.8.6) celular: tocar na notificação abre a conversa
  { // (0.9.1) tocou na notificação push do site com o Aero fechado: abre direto na conversa
    const cid = new URLSearchParams(location.search).get('conv');
    if (cid && /^[\w-]{1,64}$/.test(cid)) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* ok */ } const tira = A.evt.on('hub:conectou', () => { tira(); setTimeout(() => TK.irPara && TK.irPara(cid), 800); }); }
  }
  { const N = A.plat.apk && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AeroNotif; if (N && N.addListener) N.addListener('clique', (d) => { const cid = d && d.cid; if (cid && TK.irPara) setTimeout(() => TK.irPara(cid), 300); }); }
  // (0.8.3) quem está digitando em cada conversa (mesmo sem ela aberta): a lista de conversas e a de membros mostram a bolinha com "..."
  const digitam = new Map(); // cid (de cima: o grupo, não o chat de dentro) -> Map(codigo -> até quando)
  const cidDeCima = (cid) => { const c = TK.conversas.find((x) => x.id === cid); return (c && c.pai) || cid; };
  let timerDig = 0;
  const avisarDig = () => { A.evt.emit('tk:digitando'); clearTimeout(timerDig); const agora = Date.now(); let prox = Infinity; for (const m of digitam.values()) for (const t of m.values()) if (t > agora) prox = Math.min(prox, t); if (prox < Infinity) timerDig = setTimeout(() => { limparDig(); avisarDig(); }, prox - agora + 30); };
  const limparDig = () => { const agora = Date.now(); for (const [cid, m] of digitam) { for (const [k, t] of m) if (t <= agora) m.delete(k); if (!m.size) digitam.delete(cid); } };
  TK.digitandoEm = (cid) => { limparDig(); const m = digitam.get(cid); const eu = API.eu && API.eu.codigo; return m ? [...m.keys()].filter((k) => k !== eu) : []; }; // a lista de conversas mostra só os outros
  // (0.8.4) eu também apareço digitando (na lateral de membros), como no Discord
  TK.euDigito = (cid, liga = true) => { const eu = API.eu && API.eu.codigo; if (!eu || !cid) return; cid = cidDeCima(cid); if (liga) { if (!digitam.has(cid)) digitam.set(cid, new Map()); digitam.get(cid).set(eu, Date.now() + 4500); } else { const m = digitam.get(cid); if (!m || !m.delete(eu)) return; } avisarDig(); };
  TK.estaDigitando = (cod, cid) => { limparDig(); if (cid) { const m = digitam.get(cid); return !!(m && m.has(cod)); } for (const m of digitam.values()) if (m.has(cod)) return true; return false; };
  // a bolinha do status vira uma pílula com três pontinhos (como no Discord)
  const marcarDig = (av, liga) => { if (!av) return av; const ja = av.querySelector(':scope > .tk-dig'); if (liga && !ja) av.append(h('i', { class: 'tk-dig', title: T('Digitando...', 'Typing...') }, h('b'), h('b'), h('b'))); else if (!liga && ja) ja.remove(); av.classList.toggle('digitando', !!liga); return av; };
  A.evt.on('hub:digitando', (e) => { if (!e || !e.cid || !e.de || (API.eu && e.de === API.eu.codigo)) return; const cid = cidDeCima(e.cid); if (!digitam.has(cid)) digitam.set(cid, new Map()); digitam.get(cid).set(e.de, Date.now() + 5000); avisarDig(); });
  A.evt.on('hub:conv-msg', (e) => { const m = e && e.msg && digitam.get(cidDeCima(e.cid)); if (m && m.delete(e.msg.de)) avisarDig(); });
  A.evt.on('hub:conv-msg', async (e) => {
    let c = TK.conversas.find((x) => x.id === e.cid);
    if (!c) { await TK.carregar().catch(() => {}); c = TK.conversas.find((x) => x.id === e.cid); if (!c) return; }
    c.seq = Math.max(c.seq || 0, e.msg.seq); c.ult = e.msg.t;
    const m = await abrirMsg(c, e.msg); if (!m) return;
    if (m.seq >= (c.previaSeq || 0)) fazerPrevia(c, m);
    const minha = API.eu && m.de === API.eu.codigo;
    if (minha) { const x = fila.find((f) => f.c.id === c.id && !f.chegou && f.d.texto === m.texto); if (x) { x.chegou = true; A.evt.emit('talk:pendente-fim', { cid: c.id, id: x.m.id }); } } // a real chegou: some a cópia "pendente"
    const vendo = TK.vendo && TK.vendo(c.id);
    const mencionou = !minha && (A.chatMeChama ? A.chatMeChama(m.texto || '') : !!(API.eu && new RegExp('<@' + API.eu.codigo + '>', 'i').test(m.texto || ''))); // (0.6.9) @todos e @aqui também
    if (minha) TK.marcarLido(c, m.seq);
    else if (vendo) TK.marcarLido(c, m.seq);
    else if (!m.sistema) { // aviso de chamada: sem som nem balão (o telefone já toca)
      if (mencionou) TK.mencoes[c.id] = (TK.mencoes[c.id] || 0) + 1;
      contar();
      // (0.6.0) silenciada: nada, a não ser menção (balão sem som, como no Discord); não perturbe: nada
      // (0.7.0) quem já está vendo a conversa (no Aero Talk ou no chat da chamada) não recebe aviso dela
      const naConversa = (TK.aberta === c.id && !document.hidden) || (A.chamada && A.chamada.chatVisivel && A.chamada.chatVisivel(c.id));
      const avisar = !A.ui.naoPerturbe() && (!c.mudo || mencionou) && !naConversa;
      // (0.7.0) a mesma mensagem chegando duas vezes (o servidor reenviou depois de reconectar) avisa uma vez só
      const chave = c.id + ':' + m.seq, repetida = avisados.has(chave); avisados.add(chave); if (avisados.size > 500) avisados.delete(avisados.values().next().value);
      if (!A.ui.naoPerturbe() && !c.mudo && !repetida) A.som.tocar(mencionou ? 'talk-mencao' : 'talk-msg');
      if (avisar && !repetida) A.ui.notificar(c.tipo === 'grupo' ? TK.titulo(c) + ' · ' + nomeDe(m.de) : nomeDe(m.de), (mencionou ? T('mencionou você: ', 'mentioned you: ') : '') + (c.previa || '').slice(0, 120), { cid: c.id, pessoa: pessoaDe(m.de), nome: nomeDe(m.de) });
      if (avisar && !repetida && avisoNaConversa(c, m, mencionou)) { /* (0.8.6) com uma conversa aberta: o cartãozinho embaixo do nome */ }
      else if (avisar && !repetida) A.ui.toast(h('span', {}, h('b', {}, c.tipo === 'grupo' ? TK.titulo(c) + ' · ' + nomeDe(m.de) : nomeDe(m.de)), mencionou ? T(' mencionou você', ' mentioned you') : '', ': ', (c.previa || '').slice(0, 80)), { avatar: pessoaDe(m.de), ms: 4200, som: c.mudo ? 'nenhum' : undefined, acoes: [{ texto: T('Abrir', 'Open'), tipo: 'sec', onclick: () => TK.irPara(c.id) }] });
    }
    A.evt.emit('talk:msg', { cid: c.id, msg: m }); A.evt.emit('talk:lista');
  });
  // (0.8.6) com uma conversa aberta no Aero Talk, as mensagens das outras aparecem num cartãozinho embaixo do nome dela (no lugar do
  // toast). Um cartão só: cada conversa entra uma vez (a mensagem mais nova) e as outras ficam empilhadas atrás, com o número. Clicar
  // pula para a conversa; o número abre a lista. Some sozinho depois de alguns segundos (ou com o X)
  const avisosFora = new Map(); // cid -> { c, quem, texto, mencionou }
  let avisoEl = null, avisoTimer = 0, avisoLista = false;
  function avisoNaConversa(c, m, mencionou) {
    if (A.cfg.v.avisoConversa === false || document.hidden) return false;
    const cab = [...document.querySelectorAll('.tk-painel > .tk-cab, .tk-painel .tk-cab')].find((x) => x.offsetParent);
    if (!cab || TK.aberta === c.id) return false;
    avisosFora.delete(c.id);
    avisosFora.set(c.id, { c, quem: pessoaDe(m.de), nome: (c.tipo === 'grupo' ? TK.titulo(c) + ' · ' : '') + nomeDe(m.de), texto: (c.previa || '').slice(0, 120), mencionou });
    while (avisosFora.size > 9) avisosFora.delete(avisosFora.keys().next().value);
    pintarAviso(cab);
    return true;
  }
  const fecharAviso = () => { clearTimeout(avisoTimer); avisosFora.clear(); avisoLista = false; if (avisoEl) { const e = avisoEl; avisoEl = null; e.classList.add('saindo'); setTimeout(() => e.remove(), 220); } };
  function pintarAviso(cab) {
    const itens = [...avisosFora.values()].reverse(); if (!itens.length) return fecharAviso();
    const ir = (x) => { fecharAviso(); TK.irPara(x.c.id); };
    const cartao = (x, principal) => h('button', { type: 'button', class: 'tk-aviso-it', onclick: () => ir(x) }, A.ui.avatar(x.quem || { nome: x.nome }, principal ? 34 : 26),
      h('span', { class: 'tk-aviso-tx' }, h('b', {}, x.nome, x.mencionou ? h('span', { class: 'tk-aviso-men' }, '@') : null), h('span', {}, x.texto || T('Nova mensagem', 'New message'))));
    const [prim, ...resto] = itens;
    const el = h('div', { class: 'tk-aviso' + (resto.length ? ' pilha' : '') + (resto.length > 1 ? ' pilha2' : '') + (avisoLista ? ' aberto' : ''), role: 'status' },
      cartao(prim, true),
      resto.length ? h('button', { type: 'button', class: 'tk-aviso-mais', title: avisoLista ? T('Esconder', 'Hide') : T('Ver as outras conversas', 'See the other chats'), onclick: () => { avisoLista = !avisoLista; pintarAviso(cab); } }, avisoLista ? '−' : '+' + resto.length) : null,
      h('button', { type: 'button', class: 'tk-aviso-x', title: T('Fechar', 'Close'), onclick: fecharAviso }, '×'),
      avisoLista && resto.length ? h('div', { class: 'tk-aviso-lista' }, ...resto.map((x) => cartao(x, false))) : null);
    if (avisoEl && avisoEl.isConnected && avisoEl.parentNode === cab.parentNode) { el.classList.add('ja'); avisoEl.replaceWith(el); } else { if (avisoEl) avisoEl.remove(); cab.after(el); }
    // por cima das mensagens (abaixo do nome e da barra de canais do grupo), sem empurrar nada
    // (0.9.1) a barra de cima virou uma cápsula no canto: o cartão fica logo abaixo dela, sem cobrir os botões
    avisoEl = el; { const op = el.offsetParent || cab.parentNode, pn = cab.closest('.tk-painel'), ms = pn && pn.querySelector('.cx-msgs'), base = op.getBoundingClientRect().top;
      const y = Math.max(ms ? ms.getBoundingClientRect().top - base : 0, cab.getBoundingClientRect().bottom - base); el.style.top = (y + 8) + 'px'; }
    clearTimeout(avisoTimer); const parar = () => clearTimeout(avisoTimer), seguir = () => { clearTimeout(avisoTimer); avisoTimer = setTimeout(fecharAviso, 7000); };
    el.addEventListener('pointerenter', parar); el.addEventListener('pointerleave', seguir); seguir();
  }
  A.evt.on('talk:aberta', (e) => { if (e) avisosFora.delete(e.cid); if (avisoEl && !avisoEl.isConnected) { avisoEl = null; avisosFora.clear(); avisoLista = false; } });
  // (0.7.14) a edição ao vivo mantém a hora e as reações (sem a hora a mensagem ficava "NaN décadas atrás")
  A.evt.on('hub:conv-editada', async (e) => { const c = TK.conversas.find((x) => x.id === e.cid); if (!c) return; const ca = TK.cacheDe(e.cid, e.seq) || {}, sid = (e.anexo && e.anexo.id) || ca.sidAnexo; const m = await abrirMsg(c, { seq: e.seq, de: e.de || ca.de, t: e.t || ca.t || Date.now(), rea: e.rea || ca.rea, cifra: e.cifra, editado: e.editado, anexo: sid ? { id: sid } : null, anexos: e.anexos || (ca.sidsAnexos ? ca.sidsAnexos.map((id) => ({ id })) : null) }); if (m) A.evt.emit('talk:editada', { cid: e.cid, msg: m }); });
  // (0.7.2) reações: alguém pôs ou tirou uma; a mensagem aberta na tela se atualiza
  TK.reagir = (c, m, e) => API.req(`conv/${c.id}/msgs/${m.seq}/reacao`, { e }).then((r) => { if (r && 'rea' in r) A.evt.emit('talk:reacao', { cid: c.id, seq: m.seq, rea: r.rea }); });
  A.evt.on('hub:conv-reacao', (e) => A.evt.emit('talk:reacao', { cid: e.cid, seq: e.seq, rea: e.rea || null, sup: e.sup || null }));
  A.evt.on('hub:conv-apagada', (e) => { const c = TK.conversas.find((x) => x.id === e.cid); if (c && c.previaSeq === e.seq) { c.previa = T('mensagem apagada', 'message deleted'); c.previaDe = null; A.evt.emit('talk:lista'); } A.evt.emit('talk:apagada', e); });
  A.evt.on('hub:conv-mudou', () => TK.carregar().catch(() => {}));
  // (0.8.3) alguém trocou a bolha: guarda a nova (amigos, membros das conversas e a sua) e os chats abertos trocam as bolhas dessa pessoa
  A.evt.on('hub:bolha-mudou', (e) => {
    if (!e || !e.codigo) return;
    const bc = e.bc || undefined;
    if (API.eu && API.eu.codigo === e.codigo) API.eu.bc = bc;
    const a = amigo(e.codigo); if (a) a.bc = bc;
    for (const c of TK.conversas || []) for (const m of c.membros || []) if (m.codigo === e.codigo) m.bc = bc;
    A.evt.emit('talk:bolha', e.codigo);
  });
  // (0.6.0) recibos (recebida/lida), lida em outro aparelho, marcação de "não lida"
  // (0.9.1) os recibos só andam para a frente: com muitas mensagens seguidas, um aviso atrasado não volta a setinha de "lida" para "enviada"
  const juntarRecibos = (velhos, novos) => (novos || []).map((n) => { const v = (velhos || []).find((x) => x.codigo === n.codigo); if (!v) return n;
    return { ...n, entregue: Math.max(n.entregue || 0, v.entregue || 0), lido: n.lido == null ? undefined : Math.max(n.lido || 0, v.lido || 0) }; });
  A.evt.on('hub:conv-recibo', (e) => { const c = TK.conversas.find((x) => x.id === e.cid); if (!c) return; const antes = JSON.stringify(c.recibos || []); c.recibos = juntarRecibos(c.recibos, e.recibos); if (JSON.stringify(c.recibos) !== antes) A.evt.emit('talk:recibos', c.id); });
  A.evt.on('hub:conv-lido', (e) => { const c = TK.conversas.find((x) => x.id === e.cid); if (!c) return; c.lido = Math.max(c.lido || 0, e.lido || 0); delete TK.mencoes[c.id]; contar(); A.evt.emit('talk:lista'); if (c.lido >= (c.seq || 0) && A.ui.tirarNotif) A.ui.tirarNotif(c.id); });
  A.evt.on('hub:conv-marca', (e) => { const c = TK.conversas.find((x) => x.id === e.cid); if (!c) return; c.marca = e.marca || 0; contar(); A.evt.emit('talk:lista'); });
  // chamada em andamento numa conversa (começou, alguém entrou ou saiu, acabou)
  A.evt.on('hub:conectou', () => { if (TK.conversas && TK.conversas.length && Date.now() - (TK.listaEm || 0) > 15000) TK.carregar().catch(() => {}); }); // (1.0.2) a lista que acabou de chegar (ao abrir o app) não é pedida de novo // (0.9.0) voltou a conexão: as chamadas em andamento conferidas de novo
  A.evt.on('hub:chamada-estado', (e) => { const c = TK.conversas.find((x) => x.id === e.cid); if (c) c.cham = e.cham || null; A.evt.emit('talk:cham', e); A.evt.emit('talk:lista'); });
  A.evt.on('hub:conv-removido', (e) => { TK.carregar().catch(() => {}); if (TK.aberta === e.cid) A.evt.emit('talk:fechar'); });
  // a conversa aberta guarda quem mandou cada mensagem (a edição ao vivo só traz a cifra)
  const quemMandou = new Map();
  TK.lembrar = (cid, m) => quemMandou.set(cid + ':' + m.seq, { de: m.de, t: m.t, rea: m.rea, sidAnexo: m.anexo && m.anexo.sid, sidsAnexos: m.anexos && m.anexos.map((a) => a.sid) });
  TK.cacheDe = (cid, seq) => quemMandou.get(cid + ':' + seq);

  // ---------- chamadas: ficam em chamada.js (direto entre os aparelhos, sem sala) ----------
  TK.ligar = (c, video) => A.chamada.ligar(c, video);
  TK.nomeDe = nomeDe; TK.pessoaDe = pessoaDe;
  // a foto do grupo (0.5.9-5); sem foto, as bolhinhas de quem está nele
  TK.urlBannerGrupo = (c) => (c && c.bannerV ? `${API.servidor}/api/grupo-banner/${c.id}?v=${c.bannerV}` : '');
  TK.avatarGrupo = (c, tam) => {
    if (c.fotoV) { const el = h('div', { class: 'avatar', estilo: { '--t': tam + 'px', '--ah': 200 } }, h('span', {}, (c.nome || '?').charAt(0).toUpperCase())); const img = h('img', { alt: '', src: `${API.servidor}/api/grupo-foto/${c.id}?v=${c.fotoV}`, loading: 'lazy', draggable: 'false' }); img.addEventListener('error', () => img.remove()); el.append(img); return el; }
    return h('span', { class: 'tk-av-grupo' }, ...(c.membros || []).slice(0, 3).map((m) => A.ui.avatar(m, Math.round(tam * 0.66))));
  };
  // (0.6.0) o que todo chat do Aero Talk sabe fazer (o da aba e o do canto da chamada)
  const SITE_APP = 'https://web.aerostream.workers.dev/app/';
  TK.linkConvite = (codigo) => SITE_APP + '#convite=' + codigo;
  const convitesVistos = new Map();
  TK.cartaoConvite = (codigo) => {
    const el = h('div', { class: 'cx-convite' }, h('div', { class: 'peq suave' }, T('Convite para um grupo', 'Invite to a group')), h('div', { class: 'cx-convite-corpo' }, h('span', { class: 'peq suave' }, T('Carregando...', 'Loading...'))));
    const pintar = (d) => {
      const corpo = el.querySelector('.cx-convite-corpo'); corpo.textContent = '';
      if (!d || !d.valido) { corpo.append(h('span', { class: 'suave' }, T('Este convite venceu ou não existe mais.', 'This invite expired or no longer exists.'))); return; }
      const foto = d.fotoV ? TK.avatarGrupo({ id: d.cid, nome: d.nome, fotoV: d.fotoV }, 48) : h('span', { class: 'tk-av-grupo' }, ...(d.avatares || []).slice(0, 3).map((p) => A.ui.avatar(p, 30)));
      const btn = A.ui.btn(d.ja ? T('Entrou', 'Joined') : d.cheio ? T('Cheio', 'Full') : T('Entrar', 'Join'), { tipo: d.ja ? 'sec' : 'ok', peq: true, onclick: async () => {
        if (d.ja) { TK.irPara(d.cid); return; }
        try { await API.req('convite/' + codigo + '/entrar', {}); A.som.tocar('sucesso'); d.ja = true; await TK.carregar(); pintar(d); TK.irPara(d.cid); } catch (e) { A.ui.toast(e.message, { tipo: 'erro' }); }
      } });
      if (d.cheio && !d.ja) btn.disabled = true;
      corpo.append(foto, h('div', { class: 'cresce' }, h('b', {}, d.nome), h('div', { class: 'peq suave' }, d.membros + T(' membros', ' members'))), btn);
    };
    const v = convitesVistos.get(codigo);
    if (v) setTimeout(() => pintar(v), 0); else API.req('convite/' + codigo).then((d) => { convitesVistos.set(codigo, d); pintar(d); }).catch(() => pintar(null));
    return el;
  };
  TK.opcoesChat = (c) => ({
    // (0.9.0) qualquer arquivo (zip, exe, pdf...): baixa e abre a cifra só quando a pessoa clica em baixar
    baixarAnexo: async (m) => { const u = TK.urlViva(m.anexo) || await TK.urlAnexo(c.id, m.anexo); m.anexo.url = u; await A.ui.baixar(u, m.anexo.nome || 'arquivo'); },
    linkAnexo: (m) => TK.linkAnexo(c.id, m.anexo), ehLinkMidia: (u) => TK.ehLinkAnexo(u), midiaDeLink: (u) => TK.midiaDeLink(u),
    statusDe: (m) => TK.statusDe(c, m),
    membros: () => c.membros || [], nomeDe: (cod) => nomeDe(cod),
    convite: (cod) => TK.cartaoConvite(cod),
    fixar: (m) => TK.fixar(c, m, !(c.fixadas || []).includes(m.seq || m.id)).catch((e) => A.ui.toast(e.message, { tipo: 'erro' })),
    fixada: (m) => (c.fixadas || []).includes(m.seq || m.id),
    marcarNaoLida: (m) => { TK.marca(c, m.seq || m.id); A.ui.toast(T('Marcada: ao voltar, a conversa abre neste ponto.', 'Marked: when you come back, the chat opens here.'), { ms: 2500 }); },
    gifs: TK.gifs, figurinhas: TK.figurinhas, gravarAudio: true,
    favoritarGif: (url, w, hh) => TK.gifs.favoritar({ url, prev: url, w: w || 0, h: hh || 0 }, !TK.gifs.eFavorito(url)).catch((e) => A.ui.toast(e.message, { tipo: 'erro' })), gifFavorito: (url) => TK.gifs.eFavorito(url),
  });
  // (0.6.0) a conversa inteira aberta (para procurar): até 2000 mensagens, decifradas uma vez só e guardadas enquanto o app está aberto
  // (0.9.0) guardada por conversa e só completada com as novas; cada página é decifrada em paralelo e entregue logo (da mais nova para a mais antiga)
  const todasCache = new Map();
  TK.todas = async (c, aoProgresso, aoPagina, vivo) => {
    const k = c.id, ja = todasCache.get(k);
    if (ja && ja.seq === c.seq) { if (aoPagina) aoPagina(ja.msgs); return ja.msgs; }
    const topo = ja ? ja.topo : 0;
    const novas = []; let antes = 0, juntou = false, maior = 0;
    for (let pag = 0; pag < 30; pag++) {
      if (vivo && !vivo()) return null;
      const d = await API.req(`conv/${c.id}/msgs?limite=80` + (antes ? '&antes=' + antes : ''));
      const cru = d.msgs || [];
      for (const m of cru) if (m.seq > maior) maior = m.seq;
      const l = (await Promise.all(cru.filter((m) => !m.bloqueada && !(topo && m.seq <= topo)).map((m) => abrirMsg(c, m).catch(() => null)))).filter(Boolean);
      novas.unshift(...l);
      if (aoPagina && l.length) aoPagina(l);
      if (aoProgresso) aoProgresso(novas.length);
      if (topo && cru.length && cru[0].seq <= topo) { juntou = true; break; }
      if (!d.mais || !cru.length) break;
      antes = cru[0].seq;
    }
    let msgs = novas;
    if (juntou) { if (aoPagina && ja.msgs.length) aoPagina(ja.msgs); msgs = ja.msgs.concat(novas).slice(-2400); }
    todasCache.set(k, { seq: c.seq, topo: Math.max(maior, topo || 0), msgs });
    return msgs;
  };
  TK.abrirMsgs = async (c, seqs) => { const d = await API.req(`conv/${c.id}/msgs?seqs=` + seqs.join(',')); const out = []; for (const m of d.msgs || []) { const x = await abrirMsg(c, m); if (x) out.push(x); } return out; };

  // o chat da conversa num painel compacto (usado no canto da chamada enquanto alguém compartilha a tela, como na sala)
  TK.chatCompacto = (cid) => {
    const c = TK.conversas.find((x) => x.id === cid); if (!c) return null;
    const cx = A.chatUI.criar({
      ehMeu: (m) => API.eu && m.de === API.eu.codigo, nome: (m) => nomeDe(m.de), avatar: (m) => pessoaDe(m.de), perfilDe: (m) => m.de, bolhaDe: (m) => pessoaDe(m.de).bc, nomeEstiloDe: (m) => pessoaDe(m.de).nm, selosDe: (m) => (A.ui.selosVisiveis ? A.ui.selosVisiveis(pessoaDe(m.de)) : pessoaDe(m.de).sl),
      aceitar: '*', limite: TK.limiteAnexo, dicaLimite, placeholder: T('Mensagem para ', 'Message ') + TK.titulo(c),
      urlAnexo: (m) => TK.urlViva(m.anexo), urlDe: (a) => TK.urlViva(a), multiAnexo: true, aoMontar: (m) => { if ((m.anexos || [m.anexo]).some((a) => a && TK.urlMorta(a.url))) setTimeout(() => anexo(m), 0); },
      rascunho: c.id, enviar: (d) => TK.enviar(c, d), editar: (m, t) => TK.editar(c, m, t), apagar: (m) => TK.apagar(c, m), encaminhar: (m) => TK.encaminhar(m, c), reagir: (m, e) => TK.reagir(c, m, e), superReacoes: true,
      digitando: (sm) => { TK.euDigito(c.id); H.enviar({ tipo: 'digitando', cid: c.id, s: sm }); },
      ...TK.opcoesChat(c),
    });
    const anexo = (m) => TK.abrirMidias(c.id, m, (mm, a) => cx.midiaPronta(mm, a));
    TK.mensagens(c).then((r) => { r.msgs.forEach((m) => TK.lembrar(c.id, m)); cx.adicionarVarias(r.msgs); r.msgs.forEach(anexo); if (r.msgs.length) TK.marcarLido(c, r.msgs[r.msgs.length - 1].seq); }).catch(() => {});
    const offs = [
      A.evt.on('talk:msg', ({ cid: x, msg }) => { if (x !== cid) return; cx.parouDeDigitar(nomeDe(msg.de)); TK.lembrar(cid, msg); cx.adicionar(msg); anexo(msg); TK.marcarLido(c, msg.seq); }),
      A.evt.on('talk:editada', ({ cid: x, msg }) => { if (x === cid) { cx.atualizar(msg); anexo(msg); } }),
      A.evt.on('talk:reacao', ({ cid: x, seq, rea, sup }) => { if (x === cid) { cx.atualizar({ id: seq, rea }); if (sup && cx.superReacao) cx.superReacao(seq, sup); } }),
      A.evt.on('talk:apagada', ({ cid: x, seq }) => { if (x === cid) cx.remover(seq); }),
      A.evt.on('hub:digitando', (e) => { if (e.cid === cid) cx.digitando(nomeDe(e.de) || e.nome, e.dg); }),
      A.evt.on('talk:recibos', (x) => { if (x === cid) cx.atualizarStatus(); }),
      A.evt.on('talk:bolha', (cod) => cx.trocarBolhas((m) => cod == null || m.de === cod)),
      A.evt.on('talk:lista', () => cx.atualizarStatus()), // (0.8.2) a lista recarregada pode trazer recibos novos
      A.evt.on('talk:pendente', ({ cid: x, msg }) => { if (x === cid) cx.adicionar(msg); }),
      A.evt.on('talk:pendente-fim', ({ cid: x, id }) => { if (x === cid) cx.remover(id, true); }),
    ];
    return { el: cx.el, focar: cx.focar, limpar: () => offs.forEach((f) => f()) };
  };

  // ---------- interface: a aba ----------
  TK.irPara = (cid) => { A.evt.emit('abrir-aba', 'talk'); setTimeout(() => A.evt.emit('talk:abrir', cid), 120); };

  A.abas.talk = (el, ctx, sub) => {
    const U = A.ui, offs = [];
    const ouvir = (ev, f) => offs.push(A.evt.on(ev, f));
    // (0.8.3) "digitando" na lista de conversas e na de membros, sem refazer a lista
    ouvir('tk:digitando', () => {
      for (const [cid, x] of itensFeitos) if (x.av && x.av.isConnected) marcarDig(x.av, TK.digitandoEm(cid).length > 0);
      const cm = atual ? atual.pai || atual.id : null;
      if (cm) for (const b of document.querySelectorAll('.tk-membros .tk-membro-bolha[data-cod]')) marcarDig(b.querySelector('.avatar'), TK.estaDigitando(b.dataset.cod, cm));
    });
    if (typeof sub !== 'string') sub = '';
    let modo = 'conversas', atual = null, cx = null, mais = false, carregandoMais = false, prox = null, irParaSeq = async () => {};

    const lista = h('div', { class: 'tk-lista', role: 'list' });
    // (0.7.6) passar o mouse pelas conversas: uma bolhinha de vidro bem baixinha (uma por conversa, sem repetir enquanto fica nela)
    let itemSob = null;
    lista.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const it = e.target.closest('.tk-item'); if (it === itemSob) return; itemSob = it; if (it) A.som.tocar('tk-passar'); }, { passive: true });
    lista.addEventListener('pointerleave', () => { itemSob = null; }, { passive: true });
    // (0.9.1) no toque, o toque que só PARA a rolagem (ou na barra de rolagem) não abre a conversa que estava passando por baixo do dedo
    let rolouEm = 0; document.addEventListener('scroll', (e) => { if (e.target && e.target.contains && e.target.contains(lista)) rolouEm = performance.now(); }, { capture: true, passive: true });
    lista.addEventListener('click', (e) => { if (A.plat.toque && performance.now() - rolouEm < 250) { e.stopPropagation(); e.preventDefault(); } }, true);
    const busca = h('input', { class: 'campo tk-busca', 'data-busca': '', placeholder: T('Procurar...', 'Search...'), 'aria-label': T('Procurar conversas', 'Search conversations') });
    const amigosEl = h('div', { class: 'tk-amigos' });
    const seg = U.seg([['conversas', T('Conversas', 'Chats'), 'chat'], ['amigos', T('Amigos', 'Friends'), 'pessoas']], modo, (v) => { modo = v; pintarLado(); });
    seg.classList.add('largo'); // (0.6.0) os dois botões ocupam a largura toda (antes sobrava um vazio à direita)
    // (0.6.0) procurar um amigo rápido (perfil, mensagem, grupo, ligar, remover, bloquear)
    const buscaAmigo = h('input', { class: 'campo tk-busca-amigo', placeholder: T('Procurar amigo...', 'Find a friend...'), 'aria-label': T('Procurar amigo', 'Find a friend') });
    const resultadosAmigo = h('div', { class: 'tk-amigo-res vidro', hidden: true });
    const pintarAmigos = () => {
      const q = buscaAmigo.value.trim().toLowerCase(); resultadosAmigo.textContent = '';
      if (!q) { resultadosAmigo.hidden = true; return; }
      const l = H.amigos.filter((a) => a.estado === 'aceita' && ((a.apelido || a.nome).toLowerCase().includes(q) || (a.tag || '').toLowerCase().includes(q))).slice(0, 6);
      if (!l.length) resultadosAmigo.append(h('p', { class: 'peq suave', estilo: { margin: '6px 8px' } }, T('Ninguém com esse nome.', 'Nobody with that name.')));
      // (0.7.14) parece um código ou uma #tag: dá para mandar o pedido de amizade daqui mesmo
      const v = buscaAmigo.value.trim();
      if (!l.length && /^#?[\w.-]{3,24}$/.test(v)) resultadosAmigo.append(U.btn(T('Enviar pedido de amizade para ', 'Send friend request to ') + v, { icone: 'mais', tipo: 'sec', peq: true, onclick: () => pedirAmizade(v) }));
      for (const a of l) {
        const bt = (ic, tit, f, tipo = 'sec') => U.btn('', { icone: ic, tipo, redondo: true, peq: true, titulo: tit, onclick: async (e) => { e.stopPropagation(); buscaAmigo.value = ''; pintarAmigos(); try { await f(); } catch (x) { U.toast(x.message, { tipo: 'erro' }); } } });
        resultadosAmigo.append(h('div', { class: 'tk-amigo-it' }, U.avatar(a, 34, U.estadoDe(a.codigo)), h('div', { class: 'cresce' }, h('b', {}, a.apelido || a.nome), h('div', { class: 'peq suave' }, '#' + (a.tag || ''))),
          bt('pessoa', T('Perfil', 'Profile'), () => A.perfil.ver(a.codigo)), bt('chat', T('Mensagem', 'Message'), async () => abrir(await TK.abrirDM(a.codigo))),
          bt('telefone', T('Chamada de voz', 'Voice call'), async () => TK.ligar(await TK.abrirDM(a.codigo), false)), A.plat.camera ? bt('video', T('Chamada de vídeo', 'Video call'), async () => TK.ligar(await TK.abrirDM(a.codigo), true)) : null,
          bt('menu', T('Mais', 'More'), () => A.perfil.menu({ clientX: buscaAmigo.getBoundingClientRect().right, clientY: buscaAmigo.getBoundingClientRect().bottom, preventDefault() {} }, a, { extras: [{ texto: T('Criar grupo com ', 'Create group with ') + (a.apelido || a.nome), icone: 'grupo', onclick: () => criarGrupo([a.codigo]) }] }))));
      }
      resultadosAmigo.hidden = false;
    };
    // (0.7.14) adicionar amigo sem sair do Aero Talk: pelo código de amigo ou pela #tag
    async function pedirAmizade(v) {
      try { await API.amigos.pedir(v); buscaAmigo.value = ''; pintarAmigos(); A.som.tocar('sucesso'); U.toast(T('Pedido enviado!', 'Request sent!'), { tipo: 'ok' }); }
      catch (x) { A.som.tocar('erro'); U.toast(x.message, { tipo: 'erro' }); }
    }
    function adicionarAmigo() {
      const campo = h('input', { class: 'campo', placeholder: T('Código de amigo ou #tag', 'Friend code or #tag'), maxlength: 24, spellcheck: 'false' });
      const ir = async () => { const v = campo.value.trim(); if (!v) return; await pedirAmizade(v); m.fechar(); };
      campo.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ir(); });
      const m = U.modal(T('Adicionar amigo', 'Add a friend'), h('div', { class: 'col', estilo: { gap: '10px' } },
        h('p', { class: 'suave peq' }, T('Peça o código de amigo ou a #tag da pessoa (fica no perfil dela).', 'Ask for their friend code or #tag (it is on their profile).')),
        h('div', { class: 'linha' }, campo, U.btn(T('Enviar', 'Send'), { icone: 'mais', onclick: ir }))), { largura: 420 });
      setTimeout(() => campo.focus(), 50);
    }
    const addAmigo = U.btn('', { icone: 'mais', tipo: 'sec', redondo: true, peq: true, titulo: T('Nova conversa, novo grupo ou adicionar amigo', 'New chat, new group or add a friend'), onclick: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      U.menuContexto({ clientX: r.left, clientY: r.bottom + 6, preventDefault() {}, ancora: e.currentTarget }, [
        { texto: T('Nova conversa', 'New chat'), icone: 'chat', onclick: () => escolherAmigo() },
        { texto: T('Novo grupo', 'New group'), icone: 'grupo', onclick: () => criarGrupo() },
        null,
        { texto: T('Adicionar amigo', 'Add a friend'), icone: 'pessoa', onclick: adicionarAmigo },
      ]);
    } });
    addAmigo.classList.add('tk-add-amigo');
    buscaAmigo.addEventListener('input', pintarAmigos);
    buscaAmigo.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { buscaAmigo.value = ''; pintarAmigos(); } });
    buscaAmigo.addEventListener('blur', () => setTimeout(() => { if (!resultadosAmigo.contains(document.activeElement)) resultadosAmigo.hidden = true; }, 200));
    buscaAmigo.addEventListener('focus', pintarAmigos);
    const eu = API.eu;
    // (0.8.0) compacto (num canto ou no meio): só a foto e o status; clicar abre o mesmo menu
    const euSt = h('span', { class: 'tk-eu-st' });
    const pintarEuSt = () => { const st = U.estadoDe(eu.codigo); const x = st === 'invisivel' ? null : U.statusPers(eu.codigo); euSt.className = 'tk-eu-st st-' + (st === 'invisivel' ? 'offline' : st) + (x ? ' pers' : ''); if (x) euSt.style.setProperty('--stc', x.c); else euSt.style.removeProperty('--stc'); euSt.textContent = U.textoStatusDe(eu.codigo, st === 'invisivel' ? 'offline' : st); };
    const meuCard = h('button', { type: 'button', class: 'tk-eu', dados: { menu: 'perfil' }, onclick: (e) => U.menuConta(e, { sair: () => ctx.sair && ctx.sair() }) },
      U.avatar(eu, 52, U.estadoDe(eu.codigo)), h('div', { class: 'cresce' }, h('b', { dados: { nomeCod: eu.codigo } }, eu.nome), h('div', { class: 'peq suave tk-eu-bio' }, eu.bio || T('Toque para editar o seu perfil', 'Tap to edit your profile'))), euSt, A.icone('lapis', 18));
    pintarEuSt();
    // (0.8.0) compacto: passando o mouse, os quatro cantos viram alças; puxar aumenta ou diminui a sua foto ali (fica guardado)
    const EU_AV = [28, 72];
    let euAvPuxou = false;
    for (const c of ['ce', 'cd', 'be', 'bd']) {
      const al = h('span', { class: 'tk-eu-canto', dados: { c }, 'aria-hidden': 'true', title: T('Puxe para mudar o tamanho da foto', 'Drag to resize the photo') });
      al.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });
      al.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !meuCard.classList.contains('compacto')) return;
        e.preventDefault(); e.stopPropagation();
        const av = meuCard.querySelector('.avatar'); if (!av) return;
        const t0 = av.getBoundingClientRect().width, x0 = e.clientX, y0 = e.clientY, sx = c[1] === 'd' ? 1 : -1, sy = c[0] === 'b' ? 1 : -1;
        let t = t0; meuCard.classList.add('puxando'); euAvPuxou = true;
        const mover = (ev) => { const d = Math.max((ev.clientX - x0) * sx, (ev.clientY - y0) * sy); t = Math.round(Math.max(EU_AV[0], Math.min(EU_AV[1], t0 + d * 2))); meuCard.style.setProperty('--eu-av', t + 'px'); };
        const fim = () => {
          removeEventListener('pointermove', mover, true); removeEventListener('pointerup', fim, true); removeEventListener('pointercancel', fim, true);
          meuCard.classList.remove('puxando'); setTimeout(() => { euAvPuxou = false; }, 0);
          if (A.arranjo && t !== t0) { A.arranjo.tamanho('euAv', t); A.som.tocar('grudar'); }
        };
        addEventListener('pointermove', mover, true); addEventListener('pointerup', fim, true); addEventListener('pointercancel', fim, true);
      });
      meuCard.append(al);
    }
    meuCard.addEventListener('click', (e) => { if (euAvPuxou) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    const pintarEuFundo = () => { if (A.perfil && A.perfil.fundoCartaoLista && API.eu) A.perfil.fundoCartaoLista(meuCard, API.eu); }; // (0.8.0) nameplate / banner / fundo do perfil no seu cartão
    pintarEuFundo(); ouvir('perfil', pintarEuFundo);
    ouvir('perfil', () => { const b = meuCard.querySelector('.tk-eu-bio'); if (b && API.eu) b.textContent = API.eu.bio || T('Toque para editar o seu perfil', 'Tap to edit your profile'); pintarEuSt(); });
    const novoGrupo = U.btn(T('Novo grupo', 'New group'), { icone: 'grupo', tipo: 'sec', peq: true, onclick: () => criarGrupo() });
    const novaConversa = U.btn(T('Nova conversa', 'New chat'), { icone: 'chat', peq: true, onclick: () => escolherAmigo() });
    // conversas trancadas neste aparelho (o código de acesso não está guardado aqui ou foi trocado) e o lembrete da senha de recuperação
    const aviso = h('div', { class: 'tk-chave', hidden: true });
    // (0.5.9-3) a criptografia é automática: nada de "digite o código", "Permitir" ou senha de recuperação aqui
    const pintarAviso = () => {
      aviso.textContent = '';
      aviso.hidden = !aviso.children.length;
    };
    const pedidosEl = h('div', { class: 'tk-pedidos', hidden: true });
    // (0.7.14) filtro da lista: todas, só as conversas a dois ou só os grupos (fica guardado)
    // (0.8.3) com pastas, aparece também "Pastas" (só as pastas)
    let filtro = null;
    function pintarFiltro() {
      const tem = pastasLer().l.length > 0;
      let v = (A.arranjo && A.arranjo.v().filtro) || 'todas';
      if (v === 'pastas' && !tem) { v = 'todas'; if (A.arranjo) A.arranjo.mudar('filtro', v); }
      const sig = (tem ? 'p' : '') + v;
      if (filtro && filtro.dataset.sig === sig) return;
      const novo = U.seg([['todas', T('Todas', 'All')], ['dms', T('Privadas', 'Direct')], ['grupos', T('Grupos', 'Groups')], ...(tem ? [['pastas', T('Pastas', 'Folders')]] : [])], v, (x) => { if (A.arranjo) A.arranjo.mudar('filtro', x); novo.dataset.sig = (tem ? 'p' : '') + x; pintarLista(); });
      novo.classList.add('tk-filtro', 'largo'); novo.dataset.sig = sig;
      if (filtro && filtro.parentNode) filtro.replaceWith(novo);
      filtro = novo;
    }
    pintarFiltro();
    const buscaLinha = h('div', { class: 'tk-busca-linha' }, filtro);
    // a linha da busca de amigos: com o cartão compacto num canto de cima, ele fica nesta linha, ao lado da busca (sem ocupar uma linha só para ele)
    // (0.8.0) sem "Procurar amigo" nem o "+": a linha de cima é a busca das conversas (o cartão compacto num canto fica ao lado dela).
    // Nova conversa e novo grupo: botão direito num espaço vazio da lista; amigos e pedidos ficam em Conexões > Todas as conexões
    const linhaTopo = h('div', { class: 'tk-linha-topo' }, h('div', { class: 'tk-busca-amigo-caixa' }, busca));
    // (0.8.0) sem "Conversas / Amigos" nem os botões grandes: os amigos ficam em Conexões (Todas as conexões) e nova conversa, novo grupo
    // e adicionar amigo ficam no "+" ao lado da busca
    const lado = h('aside', { class: 'tk-lado vidro', dados: { menu: 'lado' } }, meuCard, linhaTopo, aviso, buscaLinha, pedidosEl, lista, amigosEl);
    const vazioConv = h('div', { class: 'tk-vazio' }, h('div', { class: 'tk-cena', 'aria-hidden': 'true' }, h('i', { class: 'tk-balao b2' }, A.icone('coracao', 22)), h('i', { class: 'tk-balao b1' }, h('b'), h('b'), h('b')), h('i', { class: 'tk-gota g1' }), h('i', { class: 'tk-gota g2' }), h('i', { class: 'tk-gota g3' })), h('h3', {}, 'Aero Talk'),
      h('p', { class: 'suave' }, T('Converse com os amigos no privado ou em grupo, mande fotos, áudios e vídeos e faça chamadas. Tudo cifrado de ponta a ponta.', 'Chat with friends privately or in groups, send photos, voice notes and videos, and make calls. All end-to-end encrypted.')));
    const painel = h('section', { class: 'tk-painel vidro' }, vazioConv);
    // (0.8.0) a borda entre a lista e a conversa: a setinha que recolhe a lista e, puxando, o tamanho dela
    const ladoOnde = () => (A.arranjo ? A.arranjo.v().lado : 'esquerda');
    const borda = A.arranjo ? A.arranjo.borda({ peca: 'lado', el: lado, onde: ladoOnde, medir: () => raiz.getBoundingClientRect(), redimensionar: true }) : null;
    const raiz = h('div', { class: 'tk' + (sub ? '' : '') }, lado, borda, painel);
    el.append(raiz);
    // (0.7.14) segurar e arrastar: a lista (para a direita, para cima ou para baixo, compacta) e o seu cartão (em cima ou embaixo da lista)
    if (A.arranjo) {
      const R = A.arranjo, rot = R.rotulos();
      R.arrastavel(lado, { peca: 'lado', ignorar: '.tk-eu', nome: T('Lista do Aero Talk', 'Aero Talk list'), icone: 'chat', lugares: () => { const r = raiz.getBoundingClientRect(); return R.faixas(r, Math.max(140, Math.min(r.width, r.height) * 0.3), ['esquerda', 'direita', 'cima', 'baixo'], rot); } });
      // o cartão: em cima ou embaixo (normal), num dos cantos (compacto); com ele seguro, o botão direito o deixa compacto no meio
      const rotC = { esquerda: T('Canto', 'Corner'), direita: T('Canto', 'Corner') };
      R.arrastavel(meuCard, {
        peca: 'perfil', sai: true, celular: true, ignorar: '.tk-eu-canto',
        // (0.8.0) é o próprio cartão que se compacta (só a foto e a bolinha do status) e segue o mouse
        voador: () => { const c = meuCard.cloneNode(true); c.classList.remove('ar-pegando', 'ar-fora', 'ar-grudou', 'ar-desgrudou'); c.classList.add('compacto'); return c; },
        direito: { texto: T('Botão direito: compacto no meio', 'Right click: compact in the middle'), lugar: () => (R.v().perfil.split('-')[0] || 'cima') + '-centro' },
        lugares: () => {
          const fx = R.faixas(lado.getBoundingClientRect(), 84, ['cima', 'baixo'], rot), out = [];
          for (const f of fx) out.push(...R.partes(f.rect, [{ nome: f.nome + '-esquerda', peso: 1, rotulo: rotC.esquerda }, { nome: f.nome, peso: 1.6, rotulo: f.rotulo }, { nome: f.nome + '-direita', peso: 1, rotulo: rotC.direita }]));
          return out;
        },
      });
      // onde o cartão fica de verdade: normal no topo, compacto ao lado da busca, ou no fim da lista
      const posicionarEu = () => {
        const v = R.v().perfil, [vert, canto] = v.split('-');
        meuCard.classList.toggle('compacto', !!canto); meuCard.dataset.canto = canto || '';
        { const ta = (R.v().tam || {}).euAv; if (canto && ta) meuCard.style.setProperty('--eu-av', ta + 'px'); else meuCard.style.removeProperty('--eu-av'); }
        if (vert === 'cima' && (canto === 'esquerda' || canto === 'direita')) { if (canto === 'esquerda') linhaTopo.prepend(meuCard); else linhaTopo.append(meuCard); }
        else if (vert === 'cima') { if (lado.firstChild !== meuCard) lado.prepend(meuCard); }
        else if (meuCard.parentNode !== lado || lado.lastChild !== meuCard) lado.append(meuCard);
        pintarEuSt();
      };
      posicionarEu(); ouvir('arranjo', posicionarEu);
      // botão direito num espaço vazio da lista (ou X no controle): recolher, mudar de lugar e de tamanho sem arrastar
      lado.addEventListener('contextmenu', (e) => {
        if (e.defaultPrevented || e.target.closest('[data-menu]') !== lado || e.target.closest('input, textarea')) return;
        e.preventDefault();
        const horiz = ['cima', 'baixo'].includes(R.v().lado), r = lado.getBoundingClientRect(), tam = horiz ? r.height : r.width;
        const mudarTam = (dv) => () => { const area = raiz.getBoundingClientRect(); const max = horiz ? area.height * 0.6 : Math.min(620, area.width * 0.55); R.tamanho(horiz ? 'ladoH' : 'ladoW', Math.round(Math.max(horiz ? R.MIN_H : R.MIN_W, Math.min(max, tam + dv)))); A.som.tocar('grudar'); };
        R.menuPeca(e, 'lado', [
          { texto: T('Nova conversa', 'New chat'), icone: 'chat', onclick: () => escolherAmigo() },
          { texto: T('Novo grupo', 'New group'), icone: 'grupo', onclick: () => criarGrupo() },
          { texto: T('Nova pasta', 'New folder'), icone: 'pasta', onclick: () => editarPasta(null) },
          null,
          { texto: horiz ? T('Mais alta', 'Taller') : T('Mais larga', 'Wider'), icone: 'mais', onclick: mudarTam(60) },
          { texto: horiz ? T('Mais baixa', 'Shorter') : T('Mais estreita', 'Narrower'), icone: 'menos', onclick: mudarTam(-60) },
          { texto: T('Tamanho padrão', 'Default size'), icone: 'atualizar', onclick: () => { R.tamanho(horiz ? 'ladoH' : 'ladoW', 0); A.som.tocar('grudar'); } },
        ]);
      });
      // botão direito no cartão (ou X no controle): mudar de lugar sem arrastar
      meuCard.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        const at = R.v().perfil, [vert] = at.split('-'), outro = vert === 'cima' ? 'baixo' : 'cima';
        const ir = (v) => () => { R.mudar('perfil', v); A.som.tocar('grudar'); };
        const it = (v, texto, icone) => ({ texto: (at === v ? '✓ ' : '') + texto, icone, onclick: ir(v) });
        U.menuContexto(e, [
          it(vert + '-centro', T('Compacto no meio', 'Compact in the middle'), 'compacto'),
          it(vert + '-esquerda', T('Compacto no canto esquerdo', 'Compact, left corner'), 'setaE'),
          it(vert + '-direita', T('Compacto no canto direito', 'Compact, right corner'), 'setaD'),
          it(vert, T('Tamanho normal', 'Normal size'), 'pessoa'),
          null,
          it(outro + (at.includes('-') ? '-' + at.split('-')[1] : ''), outro === 'cima' ? T('Levar para cima', 'Move to the top') : T('Levar para baixo', 'Move to the bottom'), outro === 'cima' ? 'setaC' : 'seta'),
          null,
          U.itemStatus(),
        ]);
      });
    }

    // (0.5.9-6) cada conversa só "nasce" (a animação de entrada) uma vez: repintar a lista (mensagem nova, alguém ficou online, abrir o
    // Aero Talk e o servidor responder) reaproveita o item igual e, quando muda, troca sem animar de novo
    const itensFeitos = new Map(); // cid -> { sig, el }
    const fixadas = () => { try { const l = JSON.parse(A.store.ler('aero-talk-fixadas', '[]')); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
    const fixar = (cid, sim) => { const l = fixadas().filter((x) => x !== cid); if (sim) l.unshift(cid); A.store.gravar('aero-talk-fixadas', JSON.stringify(l.slice(0, 50))); A.som.tocar(sim ? 'bolha' : 'mini-fechar'); pintarLista(); };
    // (0.8.3) PASTAS de conversas (como as do Discord, com a cara do Aero): guardadas só neste aparelho, como as fixadas.
    // Cada pasta tem nome, cor, fixa ou não, aberta ou recolhida, e a ordem. Tudo pelo botão direito (na pasta ou na conversa).
    const PASTA_CORES = ['#5b8cff', '#8a5bff', '#e65bd0', '#ff5b7a', '#ff8a3d', '#f5c542', '#3fbf6a', '#2bb5c9'];
    function pastasLer() {
      try { const d = JSON.parse(A.store.ler('aero-talk-pastas', '{}')) || {}; const l = Array.isArray(d.l) ? d.l.filter((p) => p && typeof p.id === 'string').map((p) => ({ id: p.id, nome: String(p.nome || '').slice(0, 30) || T('Pasta', 'Folder'), cor: /^#[0-9a-f]{6}$/i.test(p.cor || '') ? p.cor : '#5b8cff', cor2: /^#[0-9a-f]{6}$/i.test(p.cor2 || '') ? p.cor2 : '', fixa: !!p.fixa, aberta: p.aberta !== false, em: typeof p.em === 'string' ? p.em.slice(0, 16) : '', ani: !!p.ani, cids: Array.isArray(p.cids) ? p.cids.filter((x) => typeof x === 'string').slice(0, 200) : [] })) : []; return { l, esconder: !!d.esconder }; } catch (e) { return { l: [], esconder: false }; }
    }
    const pastasGravar = (d) => { A.store.gravar('aero-talk-pastas', JSON.stringify({ l: d.l.slice(0, 30), esconder: !!d.esconder })); pintarFiltro(); pintarLista(); };
    const pastaDe = (cid) => pastasLer().l.find((p) => p.cids.includes(cid)) || null;
    const mudarPasta = (pid, f) => { const d = pastasLer(); const p = d.l.find((x) => x.id === pid); if (!p) return; f(p, d); pastasGravar(d); };
    function moverParaPasta(cid, pid) {
      const d = pastasLer(); d.l.forEach((p) => { p.cids = p.cids.filter((x) => x !== cid); });
      const p = pid && d.l.find((x) => x.id === pid); if (p) { p.cids.push(cid); p.aberta = true; }
      A.som.tocar(p ? 'grudar' : 'mini-fechar'); pastasGravar(d);
    }
    function editarPasta(pid, cidJunto) {
      const d0 = pastasLer(), p0 = pid ? d0.l.find((x) => x.id === pid) : null;
      if (!p0 && d0.l.length >= 30) { U.toast(T('No máximo 30 pastas.', 'At most 30 folders.'), { tipo: 'erro' }); return; }
      let cor = p0 ? p0.cor : PASTA_CORES[d0.l.length % PASTA_CORES.length];
      const nome = h('input', { class: 'campo', maxlength: '30', placeholder: T('Ex.: Família', 'E.g. Family') }); nome.value = p0 ? p0.nome : '';
      // (1.0.0) o ícone da pasta: um emoji (Standard) e animado (Donator), com o selo do Aero Bubble
      let em = p0 ? p0.em || '' : '', ani = p0 ? !!p0.ani : false;
      const icP = () => (A.extras ? A.extras.iconePasta({ em, ani }, true) : h('span', { class: 'tk-pasta-ic' }, A.icone('pasta', 18)));
      const previa = h('div', { class: 'tk-pasta-previa' }, icP(), h('b', {}, nome.value || T('Nova pasta', 'New folder')));
      const pintarIc = () => previa.firstChild.replaceWith(icP());
      const linhaEmoji = A.extras ? A.extras.editorIconePasta(() => ({ em, ani }), (v) => { em = v.em; ani = v.ani; pintarIc(); }) : null;
      const cores = h('div', { class: 'tk-pasta-cores' });
      // (0.9.6) mais cores: uma segunda cor opcional faz um degradê no ícone e no fundo da pasta
      let cor2 = p0 ? p0.cor2 || '' : '';
      const livre2 = h('input', { type: 'color', class: 'tk-pasta-livre', title: T('Segunda cor', 'Second color') });
      livre2.addEventListener('input', () => { cor2 = livre2.value.toLowerCase(); pintarCor(); });
      const comDeg = U.chave(!!cor2, (v) => { cor2 = v ? cor2 || livre2.value || '#e65bd0' : ''; pintarCor(); });
      const linhaDeg = h('div', { class: 'opcao curta tk-pasta-deg' }, h('div', { class: 'cresce' }, T('Degradê com uma segunda cor', 'Gradient with a second color')), livre2, comDeg);
      const pintarCor = () => { previa.style.setProperty('--pasta', cor); previa.style.setProperty('--pasta2', cor2 || cor); cores.querySelectorAll('.tk-pasta-cor').forEach((b) => b.classList.toggle('sel', b.dataset.cor === cor)); livre.value = cor; livre2.value = cor2 || '#e65bd0'; livre2.disabled = !cor2; };
      const livre = h('input', { type: 'color', class: 'tk-pasta-livre', title: T('Outra cor', 'Other color') });
      livre.addEventListener('input', () => { cor = livre.value.toLowerCase(); pintarCor(); });
      PASTA_CORES.forEach((c) => cores.append(h('button', { type: 'button', class: 'tk-pasta-cor', dados: { cor: c }, estilo: { '--c': c }, title: c, onclick: () => { cor = c; pintarCor(); } })));
      cores.append(livre);
      nome.addEventListener('input', () => { previa.lastChild.textContent = nome.value.trim() || T('Nova pasta', 'New folder'); });
      const salvar = (fechar) => {
        const n = nome.value.trim().slice(0, 30) || T('Pasta', 'Folder');
        const d = pastasLer();
        if (p0) { const p = d.l.find((x) => x.id === p0.id); if (p) { p.nome = n; p.cor = cor; p.cor2 = cor2; p.em = em; p.ani = ani; } }
        else {
          const nova = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome: n, cor, cor2, em, ani, fixa: false, aberta: true, cids: [] };
          if (cidJunto) { d.l.forEach((p) => { p.cids = p.cids.filter((x) => x !== cidJunto); }); nova.cids.push(cidJunto); }
          d.l.push(nova);
        }
        A.som.tocar('grudar'); pastasGravar(d); fechar();
      };
      nome.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); salvar(m.fechar); } });
      const m = U.modal(p0 ? T('Editar pasta', 'Edit folder') : T('Nova pasta', 'New folder'), [previa, h('label', { class: 'rot', estilo: { 'margin-top': '12px' } }, T('Nome', 'Name')), nome, h('label', { class: 'rot', estilo: { 'margin-top': '12px' } }, T('Cor', 'Color')), cores, linhaDeg, ...(linhaEmoji ? [linhaEmoji] : [])], {
        largura: 400, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec' }, { texto: p0 ? T('Salvar', 'Save') : T('Criar pasta', 'Create folder'), icone: 'pasta', onclick: (fechar) => salvar(fechar) }],
      });
      pintarCor(); setTimeout(() => nome.focus(), 80);
    }
    function menuPasta(e, pid) {
      const d = pastasLer(), p = d.l.find((x) => x.id === pid); if (!p) return;
      const mesmos = d.l.filter((x) => x.fixa === p.fixa), i = mesmos.indexOf(p);
      const trocar = (outro) => mudarPasta(pid, (pp, dd) => { const a = dd.l.findIndex((x) => x.id === pp.id), b = dd.l.findIndex((x) => x.id === outro.id); [dd.l[a], dd.l[b]] = [dd.l[b], dd.l[a]]; A.som.tocar('bolha'); });
      U.menuContexto(e, [
        { texto: p.aberta ? T('Recolher pasta', 'Collapse folder') : T('Abrir pasta', 'Expand folder'), icone: 'chevron', onclick: () => mudarPasta(pid, (pp) => { pp.aberta = !pp.aberta; }) },
        { texto: T('Nome e cor…', 'Name and color…'), icone: 'lapis', onclick: () => editarPasta(pid) },
        { texto: p.fixa ? T('Desafixar pasta', 'Unpin folder') : T('Fixar pasta no topo', 'Pin folder to top'), icone: 'pino', onclick: () => mudarPasta(pid, (pp, dd) => { pp.fixa = !pp.fixa; const a = dd.l.indexOf(pp); dd.l.splice(a, 1); if (pp.fixa) { const ult = dd.l.map((x) => x.fixa).lastIndexOf(true); dd.l.splice(ult + 1, 0, pp); } else dd.l.push(pp); A.som.tocar(pp.fixa ? 'bolha' : 'mini-fechar'); }) },
        ...(i > 0 ? [{ texto: T('Mover para cima', 'Move up'), icone: 'subir', onclick: () => trocar(mesmos[i - 1]) }] : []),
        ...(i < mesmos.length - 1 ? [{ texto: T('Mover para baixo', 'Move down'), icone: 'descer', onclick: () => trocar(mesmos[i + 1]) }] : []),
        null,
        { texto: T('Nova pasta', 'New folder'), icone: 'mais', onclick: () => editarPasta(null) },
        { texto: d.esconder ? T('Mostrar pastas em Todas e Privadas', 'Show folders in All and Direct') : T('Esconder pastas de Todas e Privadas', 'Hide folders from All and Direct'), icone: 'olho', onclick: () => { const dd = pastasLer(); dd.esconder = !dd.esconder; pastasGravar(dd); if (dd.esconder) U.toast(T('As pastas continuam em "Pastas".', 'Folders are still under "Folders".'), { ms: 2600 }); } },
        null,
        { texto: T('Apagar pasta', 'Delete folder'), icone: 'lixo', perigo: true, onclick: async () => { if (await U.confirmar(T('Apagar a pasta "', 'Delete the folder "') + p.nome + T('"? As conversas dela voltam para a lista.', '"? Its chats go back to the list.'), { sim: T('Apagar pasta', 'Delete folder'), perigo: true })) { const dd = pastasLer(); dd.l = dd.l.filter((x) => x.id !== pid); A.som.tocar('estourar'); pastasGravar(dd); } } },
      ]);
    }
    function itemPastaMenu(c) {
      const d = pastasLer(), atualP = d.l.find((p) => p.cids.includes(c.id));
      const lista = [];
      if (!d.l.length) lista.push({ texto: T('Criar pasta com esta conversa', 'New folder with this chat'), icone: 'pasta', onclick: () => editarPasta(null, c.id) });
      else lista.push({ texto: T('Mover para pasta', 'Move to folder'), icone: 'pasta', sub: [...d.l.map((p) => ({ texto: p.nome, icone: 'pasta', sel: atualP && atualP.id === p.id, onclick: () => moverParaPasta(c.id, p.id) })), null, { texto: T('Nova pasta…', 'New folder…'), icone: 'mais', onclick: () => editarPasta(null, c.id) }] });
      if (atualP) lista.push({ texto: T('Tirar da pasta', 'Remove from folder'), icone: 'fechar', onclick: () => moverParaPasta(c.id, null) });
      return lista;
    }
    function menuConversa(e, c) {
      const fx = fixadas().includes(c.id);
      const itemFixar = { texto: fx ? T('Desafixar', 'Unpin') : T('Fixar no topo', 'Pin to top'), icone: 'pino', onclick: () => fixar(c.id, !fx) };
      const naoLida = (c.seq || 0) > (c.lido || 0) || c.marca;
      const lida = { texto: T('Marcar como lida', 'Mark as read'), icone: 'ok', onclick: () => { TK.marcarLido(c, c.seq || 0); if (c.marca) TK.marca(c, 0); } };
      const mudo = { texto: c.mudo ? T('Reativar notificações', 'Unmute') : T('Silenciar conversa', 'Mute conversation'), icone: c.mudo ? 'sino' : 'sinoOff', onclick: () => TK.silenciar(c, !c.mudo).catch((x) => U.toast(x.message, { tipo: 'erro' })) };
      const fundoC = A.extras ? { texto: T('Fundo desta conversa', 'Background for this chat'), icone: 'imagem', onclick: () => A.extras.fundoConversa.editar(c.id, () => { if (atual && atual.id === c.id && cx) A.extras.fundoConversa.aplicar(c.id, cx.el); }) } : null; // (1.0.0)
      const toqueA = A.extras && c.tipo !== 'grupo' && outroDaDM(c).codigo ? { texto: T('Toque desta pessoa', 'Ringtone for this person'), icone: 'telefone', onclick: () => A.extras.editarToqueAmigo(outroDaDM(c).codigo, nomeDe(outroDaDM(c).codigo)) } : null; // (1.0.0) Donator e Supporter
      const extras = [itemFixar, ...itemPastaMenu(c), ...(naoLida ? [lida] : []), mudo, ...(fundoC ? [fundoC] : []), ...(toqueA ? [toqueA] : [])];
      if (c.tipo !== 'grupo' && A.perfil && A.perfil.menu) {
        // (0.6.0) fechar a DM: some da lista (volta sozinha com mensagem nova)
        extras.push({ texto: T('Fechar conversa', 'Close conversation'), icone: 'fechar', onclick: async () => { try { await TK.fechar(c); if (atual === c) fecharConversa(); A.som.tocar('mini-fechar'); } catch (x) { U.toast(x.message, { tipo: 'erro' }); } } });
        return A.perfil.menu(e, outroDaDM(c), { extras });
      }
      U.menuContexto(e, [...extras, null,
        { texto: T('Abrir', 'Open'), icone: 'chat', onclick: () => abrir(c) },
        { texto: T('Convidar pessoas', 'Invite people'), icone: 'convidar', onclick: () => convidar(c) },
        { texto: T('Chamada de voz', 'Voice call'), icone: 'telefone', onclick: () => TK.ligar(c, false).catch((x) => U.toast(x.message, { tipo: 'erro' })) },
        { texto: T('Configurações do grupo', 'Group settings'), icone: 'ajustes', onclick: () => configGrupo(c) }, null,
        { texto: T('Sair do grupo', 'Leave group'), icone: 'sair', perigo: true, onclick: () => sairDoGrupo(c) }]);
    }
    async function sairDoGrupo(c) { if (await U.confirmar(T('Sair de "', 'Leave "') + c.nome + T('"? Você só volta se alguém te adicionar ou convidar.', '"? You only come back if someone adds or invites you.'), { sim: T('Sair do grupo', 'Leave group'), perigo: true })) { try { await TK.sair(c); if (atual && atual.id === c.id) fecharConversa(); } catch (x) { U.toast(x.message, { tipo: 'erro' }); } } }
    function itemConversa(c, fixada) {
      const n = c.tipo === 'grupo' ? TK.naoLidasGrupo(c) : TK.naoLidasDe(c);
      const pess = c.tipo === 'grupo' ? null : outroDaDM(c);
      const st = pess ? U.estadoDe(pess.codigo) : '', on = st && st !== 'offline';
      const sel = !!(atual && (atual.id === c.id || atual.pai === c.id));
      const cham = c.cham && c.cham.quem.some((q) => H.online(q) || (A.chamada && A.chamada.estado && (A.chamada.estado() || {}).cid === c.id)) ? c.cham : null; // sem ninguém online: chamada fantasma
      const men = TK.mencoes[c.id] || 0, num = c.mudo ? men : n;
      // (0.8.3) a prévia é a da mensagem mais nova (no grupo, também a dos chats de dentro dele); minha: com os vistos
      const fonte = [c, ...(c.tipo === 'grupo' ? TK.filhos(c).filter((f) => f.canal !== 'voz') : [])].filter((x) => x.previa).sort((a, b) => (b.previaT || 0) - (a.previaT || 0))[0];
      const prevTxt = fonte ? (fonte !== c ? nomeCanal(fonte) + ' · ' : '') + fonte.previa : '';
      const vis = fonte && API.eu && fonte.previaDe === API.eu.codigo ? TK.statusDe(fonte, { seq: fonte.previaSeq }) : '';
      const sig = JSON.stringify([TK.titulo(c), prevTxt, vis, num, sel, st, cham ? cham.quem.length : 0, fixada, c.fotoV || 0, c.bannerV || 0, (c.membros || []).map((m) => m.codigo + (m.av || '')).join(), pess ? pess.av || 0 : 0, pess ? JSON.stringify([pess.nm, pess.np, pess.npV, pess.bannerV]) : '', !!c.mudo, !!c.marca, men, pess && A.aparelhos ? A.aparelhos.chave(pess.codigo) : '']);
      const ja = itensFeitos.get(c.id);
      if (ja && ja.sig === sig) return ja.el;
      const av = c.tipo === 'grupo' ? TK.avatarGrupo(c, 46) : U.avatar(pess, 46, st);
      const el = h('button', { type: 'button', role: 'listitem', class: 'tk-item' + (sel ? ' sel' : '') + ((num || c.marca) ? ' nova' : '') + (ja ? ' fixo' : '') + (c.mudo ? ' mudo' : ''), dados: { cid: c.id, menu: '1' }, onclick: () => { A.som.tocar(c.tipo === 'grupo' ? 'tk-grupo' : 'tk-dm'); abrir(c); }, oncontextmenu: (e) => menuConversa(e, c) },
        av, h('div', { class: 'cresce' }, h('div', { class: 'tk-item-nome' }, fixada ? h('span', { class: 'tk-fixada', title: T('Fixada', 'Pinned') }, A.icone('pino', 13)) : null, c.mudo ? h('span', { class: 'tk-fixada', title: T('Silenciada', 'Muted') }, A.icone('sinoOff', 13)) : null, TK.titulo(c)), h('div', { class: 'tk-item-previa' }, vis ? h('span', { class: 'cx-status tk-vis ' + vis, title: { enviada: T('Enviada', 'Sent'), recebida: T('Recebida', 'Delivered'), lida: T('Lida', 'Read') }[vis] }, A.icone(vis === 'enviada' ? 'check' : 'check2', 14)) : null, prevTxt || (c.tipo === 'grupo' ? (c.membros || []).length + T(' pessoas', ' people') : U.textoEstado(st))), pess && A.jogando ? A.jogando.linha(pess.codigo) : null, pess && A.assistindo ? A.assistindo.linha(pess.codigo) : null, pess && A.ouvindo ? A.ouvindo.linha(pess.codigo) : null),
        cham ? h('span', { class: 'tk-cham-ativa', title: T('Chamada em andamento', 'Call in progress') }, A.icone('telefone', 14), String(cham.quem.length)) : null,
        num ? h('span', { class: 'selo' + (men ? ' mencao' : '') }, men && c.mudo ? '@' + men : num > 99 ? '99+' : num) : c.marca ? h('span', { class: 'selo ponto', title: T('Marcada como não lida', 'Marked as unread') }) : null);
      // (0.8.3) a foto continua a mesma (só o texto mudou): reaproveita a de antes, sem recarregar a imagem (a linha não pisca)
      const avK = c.tipo === 'grupo' ? 'g' + (c.fotoV || 0) + (c.membros || []).map((m) => m.codigo + (m.av || '')).join() : pess.codigo + ':' + (pess.av || 0) + ':' + st;
      let avUsado = av; if (ja && ja.avK === avK && ja.av && av.parentNode === el) { el.replaceChild(ja.av, av); avUsado = ja.av; }
      if (c.tipo === 'grupo' && c.bannerV) { el.classList.add('com-np'); el.style.setProperty('--np', `url("${TK.urlBannerGrupo(c)}") center / cover no-repeat`); } // (0.8.7) o banner do grupo atrás do nome
      if (pess && A.perfil && A.perfil.nameplate) { A.perfil.nameplate(el, pess); const nmEl = h('span', { class: 'tk-item-nm' }); const tn = el.querySelector('.tk-item-nome'); if (tn && pess.nm) { nmEl.append(tn.lastChild); tn.append(nmEl); A.ui.aplicarNome(nmEl, pess.nm); } } // (0.8.0) nameplate e estilo do nome de quem está na conversa
      if (pess && c.tipo !== 'grupo' && A.aparelhos) { const tn = el.querySelector('.tk-item-nome'); if (tn) tn.append(A.aparelhos.vivo(pess.codigo, { tam: 12 })); } // (1.0.2) os aparelhos conectados
      itensFeitos.set(c.id, { sig, el, avK, av: avUsado });
      marcarDig(avUsado, TK.digitandoEm(c.id).length > 0);
      if (!ja) el.addEventListener('animationend', () => el.classList.add('fixo'), { once: true });
      return el;
    }
    // (0.8.3) uma pasta na lista: o cabeçalho (clique abre e fecha; botão direito: o menu da pasta) e as conversas dela
    const pastasFeitas = new Map();
    const raizAnima = () => document.documentElement.dataset.anim !== 'nenhuma' && document.documentElement.dataset.visual !== 'lite';
    function elPasta(p, convs, fx) {
      let x = pastasFeitas.get(p.id);
      if (!x) {
        const cab = h('button', { type: 'button', class: 'tk-pasta-cab', dados: { menu: '1' } });
        const corpo = h('div', { class: 'tk-pasta-corpo', role: 'list' });
        const el = h('div', { class: 'tk-pasta', role: 'group', dados: { pasta: p.id } }, cab, corpo);
        // (0.8.7) abrir e fechar a pasta tem som e animação próprios: a tampa da pastinha abre, as conversas descem uma a uma; fechando,
        // elas sobem para dentro da pasta e o corpo recolhe
        cab.addEventListener('click', () => {
          const pa = x.p, abrir = !pa.aberta, anima = raizAnima();
          A.som.tocar(abrir ? 'pasta-abrir' : 'pasta-fechar');
          const ic = cab.querySelector('.tk-pasta-ic'); if (ic && anima) { ic.classList.remove('abre', 'fecha'); void ic.offsetWidth; ic.classList.add(abrir ? 'abre' : 'fecha'); }
          if (x.anim) { x.anim.cancel(); x.anim = null; }
          if (!anima) { mudarPasta(pa.id, (pp) => { pp.aberta = abrir; }); return; }
          if (abrir) {
            mudarPasta(pa.id, (pp) => { pp.aberta = true; });
            const alt = corpo.scrollHeight;
            x.anim = corpo.animate([{ height: '0px', opacity: 0 }, { height: alt + 'px', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2, .8, .3, 1)' });
            corpo.style.overflow = 'hidden';
            x.anim.onfinish = x.anim.oncancel = () => { x.anim = null; corpo.style.overflow = ''; };
            [...corpo.children].forEach((it, i) => it.animate([{ transform: 'translateY(-10px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: Math.min(i, 8) * 35, easing: 'cubic-bezier(.2, .8, .3, 1.1)', fill: 'backwards' }));
          } else {
            const alt = corpo.offsetHeight;
            [...corpo.children].forEach((it, i, l) => it.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-8px) scale(.94)', opacity: 0 }], { duration: 180, delay: Math.min(l.length - 1 - i, 8) * 20, easing: 'ease-in', fill: 'forwards' }));
            x.anim = corpo.animate([{ height: alt + 'px' }, { height: '0px' }], { duration: 240, delay: 60, easing: 'cubic-bezier(.5, 0, .7, .4)', fill: 'forwards' });
            corpo.style.overflow = 'hidden';
            x.anim.onfinish = () => { x.anim = null; corpo.style.overflow = ''; corpo.getAnimations({ subtree: true }).forEach((an) => an.cancel()); mudarPasta(pa.id, (pp) => { pp.aberta = false; }); };
            x.anim.oncancel = () => { corpo.style.overflow = ''; };
          }
        });
        cab.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); menuPasta(e, p.id); });
        x = { el, cab, corpo, sig: '' }; pastasFeitas.set(p.id, x);
      }
      x.p = p;
      const nao = convs.reduce((s, c) => s + (c.mudo ? (TK.mencoes[c.id] || 0) : c.tipo === 'grupo' ? TK.naoLidasGrupo(c) : TK.naoLidasDe(c)), 0);
      const caras = p.aberta ? [] : convs.slice(0, 3).map((c) => (c.tipo === 'grupo' ? { codigo: '', nome: TK.titulo(c), grupo: c.fotoV ? c : null, av: c.fotoV || 0 } : outroDaDM(c)));
      const sig = JSON.stringify([p.nome, p.cor, p.fixa, p.aberta, p.em, p.ani, A.extras ? A.extras.nivel() : 0, nao, convs.length, caras.map((c) => c.codigo + ':' + (c.av || 0))]);
      x.el.style.setProperty('--pasta', p.cor); x.el.style.setProperty('--pasta2', p.cor2 || p.cor); x.el.classList.toggle('fechada', !p.aberta); x.el.classList.toggle('fixa', p.fixa);
      if (x.sig !== sig) {
        x.sig = sig; x.cab.title = p.aberta ? T('Recolher pasta (botão direito: opções)', 'Collapse folder (right click: options)') : T('Abrir pasta (botão direito: opções)', 'Expand folder (right click: options)');
        x.cab.replaceChildren(A.extras ? A.extras.iconePasta(p) : h('span', { class: 'tk-pasta-ic' }, A.icone('pasta', 18)),
          h('span', { class: 'tk-pasta-nome' }, p.fixa ? h('span', { class: 'tk-fixada', title: T('Fixada', 'Pinned') }, A.icone('pino', 12)) : null, p.nome),
          caras.length ? h('span', { class: 'tk-pasta-caras' }, ...caras.map((c) => (c.grupo ? TK.avatarGrupo({ id: c.grupo.id, nome: c.nome, fotoV: c.grupo.fotoV }, 22) : U.avatar(c, 22)))) : h('span', { class: 'tk-pasta-n' }, String(convs.length)),
          nao ? h('span', { class: 'selo' }, nao > 99 ? '99+' : String(nao)) : null,
          h('span', { class: 'tk-pasta-seta' }, A.icone('chevron', 14)));
      }
      const filhos = p.aberta ? (convs.length ? convs.map((c) => itemConversa(c, fx.includes(c.id))) : [x.vazio || (x.vazio = h('p', { class: 'tk-pasta-vazia peq suave' }, T('Pasta vazia. Botão direito numa conversa > Mover para pasta.', 'Empty folder. Right click a chat > Move to folder.')))]) : [];
      [...x.corpo.children].forEach((e) => { if (!filhos.includes(e)) e.remove(); });
      filhos.forEach((e, i) => { if (x.corpo.children[i] !== e) x.corpo.insertBefore(e, x.corpo.children[i] || null); });
      return x.el;
    }
    function pintarLista() {
      const q = busca.value.trim().toLowerCase();
      const fx = fixadas();
      const pedidoPraMim = (c) => c.pedido && !c.pedido.deMim && !c.pedido.aceito;
      const pd = pastasLer();
      let fl = A.arranjo ? A.arranjo.v().filtro : 'todas'; if (fl === 'pastas' && !pd.l.length) fl = 'todas';
      const passaFiltro = (c) => fl === 'grupos' ? c.tipo === 'grupo' : fl === 'dms' ? c.tipo !== 'grupo' : true; // (0.7.14) o filtro: tudo, só conversas a dois ou só grupos
      const itens = TK.conversas.filter((c) => !c.pai && !pedidoPraMim(c) && passaFiltro(c) && (!q || TK.titulo(c).toLowerCase().includes(q)));
      const pedidos = TK.conversas.filter(pedidoPraMim);
      if (pedidosEl) pedidosEl.hidden = !pedidos.length;
      if (pedidosEl && pedidos.length) { pedidosEl.textContent = ''; pedidosEl.append(h('div', { class: 'tk-membros-cab' }, T('Pedidos de mensagem', 'Message requests') + ' — ' + pedidos.length), ...pedidos.map((c) => itemConversa(c, false))); }
      // (0.8.3) pastas: em "Pastas" só elas; em Todas e Privadas elas aparecem também (a não ser que você esconda). Procurando: lista simples
      const usarPastas = !q && pd.l.length > 0 && (fl === 'pastas' || ((fl === 'todas' || fl === 'dms') && !pd.esconder));
      if (usarPastas) {
        const emPasta = new Set(pd.l.flatMap((p) => p.cids));
        const soltos = fl === 'pastas' ? [] : itens.filter((c) => !emPasta.has(c.id));
        const recente = (a, b) => TK.recenteDe(b) - TK.recenteDe(a);
        const pastas = pd.l.map((p) => ({ p, convs: itens.filter((c) => p.cids.includes(c.id)).sort(recente) })).filter((x) => !x.p.cids.length || x.convs.length || fl === 'pastas');
        const elP = (x) => elPasta(x.p, x.convs, fx);
        const novosP = [...pastas.filter((x) => x.p.fixa).map(elP), ...soltos.filter((c) => fx.includes(c.id)).sort((a, b) => fx.indexOf(a.id) - fx.indexOf(b.id)).map((c) => itemConversa(c, true)),
          ...pastas.filter((x) => !x.p.fixa).map(elP), ...soltos.filter((c) => !fx.includes(c.id)).sort(recente).map((c) => itemConversa(c, false))];
        [...lista.children].forEach((e) => { if (!novosP.includes(e)) e.remove(); });
        novosP.forEach((e, i) => { if (lista.children[i] !== e) lista.insertBefore(e, lista.children[i] || null); });
        for (const id of [...pastasFeitas.keys()]) if (!pd.l.some((p) => p.id === id)) pastasFeitas.delete(id);
        return;
      }
      const ordem = [...itens.filter((c) => fx.includes(c.id)).sort((a, b) => fx.indexOf(a.id) - fx.indexOf(b.id)), ...itens.filter((c) => !fx.includes(c.id)).sort((a, b) => TK.recenteDe(b) - TK.recenteDe(a))]; // (0.8.3) a conversa mais recente em cima
      const novos = ordem.map((c) => itemConversa(c, fx.includes(c.id)));
      if (!itens.length) { lista.textContent = ''; lista.append(h('p', { class: 'suave peq', estilo: { padding: '16px', 'text-align': 'center' } }, q ? T('Nada encontrado.', 'Nothing found.') : T('Nenhuma conversa ainda. Comece uma com um amigo!', 'No chats yet. Start one with a friend!'))); return; }
      // só mexe no que mudou (tirar e pôr de volta um item reiniciaria a animação dele)
      [...lista.children].forEach((e) => { if (!novos.includes(e)) e.remove(); });
      novos.forEach((e, i) => { if (lista.children[i] !== e) lista.insertBefore(e, lista.children[i] || null); });
    }
    let limparAmigos = null;
    function pintarLado() {
      const conv = modo === 'conversas';
      lista.hidden = !conv; buscaLinha.hidden = !conv; novaConversa.hidden = !conv; novoGrupo.hidden = !conv; amigosEl.hidden = conv;
      if (!conv && !amigosEl.children.length) { const r = A.abas.amigos(amigosEl, ctx) || {}; limparAmigos = r.limpar; }
      if (conv) pintarLista();
    }
    busca.addEventListener('input', pintarLista);

    // ---------- conversa aberta ----------
    // (0.7.14) os chats e as chamadas de voz de dentro do grupo: uma faixa de botões embaixo do topo. O chat principal é o "geral" e a chamada
    // dele é a primeira de voz. Dono e admins criam (+), renomeiam e apagam (botão direito). Entrar numa chamada de voz não toca o telefone de ninguém
    function faixaCanais(c) {
      const raizG = TK.raizDe(c), adm = raizG.meuPapel === 'dono' || raizG.meuPapel === 'admin';
      const lc = raizG.limCanais || {}, MAX_CHATS_EXTRA = lc.chats || 5, MAX_VOZ = lc.voz || 3; // (0.8.1) mais com o Supporter do dono ou de um admin
      const el = h('div', { class: 'tk-canais', role: 'tablist', 'aria-label': T('Chats e chamadas do grupo', 'Group chats and calls') });
      const naCham = (x) => (x.cham && x.cham.quem ? x.cham.quem.length : 0);
      const chip = (x, rotulo, icone, aoClicar, extra = '') => {
        const n = x.canal === 'voz' || extra === 'voz' ? naCham(x) : TK.naoLidasDe(x) && !x.mudo ? TK.naoLidasDe(x) : 0;
        const b = h('button', { type: 'button', role: 'tab', class: 'tk-canal' + (atual && atual.id === x.id && extra !== 'voz' ? ' sel' : '') + (extra === 'voz' || x.canal === 'voz' ? ' voz' : '') + (naCham(x) && (extra === 'voz' || x.canal === 'voz') ? ' ativo' : ''), title: rotulo, onclick: aoClicar },
          A.icone(icone, 15), h('span', {}, rotulo), n ? h('i', { class: 'tk-canal-n' }, n > 99 ? '99+' : String(n)) : null);
        if (adm && x.pai) b.addEventListener('contextmenu', (e) => U.menuContexto(e, [
          { texto: T('Renomear', 'Rename'), icone: 'lapis', onclick: () => nomearCanal(raizG, x) },
          { texto: T('Apagar', 'Delete'), icone: 'lixo', perigo: true, onclick: () => U.confirmar ? U.confirmar(T('Apagar ', 'Delete ') + nomeCanal(x) + '? ' + T('As mensagens dele somem para todos.', 'Its messages are removed for everyone.')).then((sim) => sim && mexerCanais(raizG, { acao: 'apagar', id: x.id })) : mexerCanais(raizG, { acao: 'apagar', id: x.id }) }]));
        return b;
      };
      const pintar = () => {
        const fs = TK.filhos(raizG), textos = fs.filter((x) => x.canal !== 'voz'), vozes = fs.filter((x) => x.canal === 'voz');
        el.textContent = '';
        el.append(chip(raizG, T('geral', 'general'), 'chat', () => { if (atual !== raizG) abrir(raizG); }),
          ...textos.map((x) => chip(x, x.nome, 'chat', () => { if (atual !== x) abrir(x); })),
          h('span', { class: 'tk-canais-sep' }),
          chip(raizG, T('Voz geral', 'General voice'), 'telefone', () => TK.ligar(raizG, false).catch((e) => U.toast(e.message, { tipo: 'erro' })), 'voz'),
          ...vozes.map((x) => chip(x, x.nome, 'telefone', () => TK.ligar(x, false).catch((e) => U.toast(e.message, { tipo: 'erro' })))));
        if (adm) {
          const novo = h('button', { type: 'button', class: 'tk-canal novo', title: T('Novo chat ou chamada de voz', 'New chat or voice call'), onclick: (e) => U.menuContexto(e, [
            textos.length < MAX_CHATS_EXTRA ? { texto: T('Novo chat', 'New chat'), icone: 'chat', onclick: () => nomearCanal(raizG, null, 'texto') } : null,
            vozes.length < MAX_VOZ - 1 ? { texto: T('Nova chamada de voz', 'New voice call'), icone: 'telefone', onclick: () => nomearCanal(raizG, null, 'voz') } : null,
          ].filter(Boolean).concat(textos.length >= MAX_CHATS_EXTRA && vozes.length >= MAX_VOZ - 1 ? [{ texto: T('O grupo já tem tudo o que cabe', 'The group is full'), icone: 'ok', onclick: () => {} }] : [])) }, A.icone('mais', 15));
          el.append(novo);
        }
      };
      pintar();
      const off1 = A.evt.on('talk:lista', () => { if (el.isConnected) pintar(); else off1(); });
      const off2 = A.evt.on('talk:cham', () => { if (el.isConnected) pintar(); else off2(); });
      return el;
    }
    async function mexerCanais(g, dados) {
      try { await API.req(`conv/${g.id}/canais`, dados); await TK.carregar(); if (dados.acao === 'apagar' && atual && atual.id === dados.id) abrir(g); }
      catch (e) { U.toast(e.message, { tipo: 'erro' }); }
    }
    function nomearCanal(g, x, tipo) {
      const campo = h('input', { class: 'campo', maxlength: 24, value: x ? x.nome : '', placeholder: (x ? x.canal : tipo) === 'voz' ? T('Ex.: jogando', 'E.g. gaming') : T('Ex.: memes', 'E.g. memes') });
      const ir = async () => { const nome = campo.value.trim(); if (!nome) return; m.fechar(); await mexerCanais(g, x ? { acao: 'renomear', id: x.id, nome } : { acao: 'criar', tipo, nome }); };
      campo.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ir(); });
      const m = U.modal(x ? T('Renomear', 'Rename') : tipo === 'voz' ? T('Nova chamada de voz', 'New voice call') : T('Novo chat', 'New chat'), h('div', { class: 'col', estilo: { gap: '10px' } },
        h('p', { class: 'suave peq' }, (x ? x.canal : tipo) === 'voz' ? T('Uma chamada de voz que fica no grupo: quem quiser entra, sem tocar o telefone de ninguém.', 'A voice call that stays in the group: anyone can join, without ringing anyone.') : T('Um chat a mais no grupo, com as mesmas pessoas e as suas próprias mensagens fixadas.', 'Another chat in the group, with the same people and its own pinned messages.')),
        h('div', { class: 'linha' }, campo, U.btn(x ? T('Salvar', 'Save') : T('Criar', 'Create'), { icone: 'ok', onclick: ir }))), { largura: 420 });
      setTimeout(() => campo.focus(), 50);
    }
    // (0.7.14) os botões do topo do chat. Na tela estreita (celular) ficam só a voz e o vídeo; o resto vai para o botão "mais opções"
    function botoesCab(c, alternarMembros, pess) {
      const grupo = c.tipo === 'grupo';
      const extras = [
        !grupo && pess && pess.codigo ? { texto: T('Ver perfil', 'View profile'), icone: 'pessoa', agir: () => A.perfil && A.perfil.ver(pess.codigo) } : null,
        { texto: T('Procurar na conversa', 'Search the conversation'), icone: 'lupa', agir: (alvo) => buscarNa(c, alvo) },
        A.separar && A.separar.pode() ? { texto: T('Abrir em janela separada', 'Open in a separate window'), icone: 'externo', agir: () => separarConversa(c) } : null, // (1.0.2) a conversa (e a chamada) numa janela só dela
        { texto: T('Mensagens fixadas', 'Pinned messages'), icone: 'alfinete', agir: (alvo) => verFixadas(c, alvo) },
        { texto: T('Mídias da conversa', 'Chat media'), icone: 'imagem', agir: () => galeriaDe(c) }, // (1.0.2)
        grupo ? { texto: T('Convidar pessoas', 'Invite people'), icone: 'convidar', agir: () => convidar(TK.raizDe(c)) } : null,
        grupo ? { texto: T('Membros', 'Members'), icone: 'pessoas', agir: () => alternarMembros() } : null,
        grupo ? { texto: T('Configurações do grupo', 'Group settings'), icone: 'ajustes', agir: () => configGrupo(TK.raizDe(c)) } : null,
        A.musica && A.musica.ligada() ? { texto: T('Música junto', 'Music together'), icone: 'musica', musica: true, agir: (alvo) => A.musica.abrir(c.id, alvo) } : null, // (0.8.7) a integração Música junto
      ].filter(Boolean);
      const mais = U.btn('', { icone: 'pontos', tipo: 'sec', redondo: true, titulo: T('Mais opções', 'More options'), onclick: (e) => { const b = e.currentTarget; U.menuContexto(e, extras.map((x) => ({ texto: x.texto, icone: x.icone, onclick: () => x.agir(b) }))); } });
      mais.classList.add('tk-cab-mais');
      // (0.8.7) repaginado: as chamadas viram duas gotas de gel (voz e vídeo) e as ferramentas ficam num só trilho de vidro
      const voz = U.btn('', { icone: 'telefone', tipo: 'sec', redondo: true, titulo: T('Chamada de voz', 'Voice call'), onclick: () => TK.ligar(TK.raizDe(c), false).catch((e) => U.toast(e.message, { tipo: 'erro' })) });
      voz.classList.add('tk-cg', 'voz');
      const vid = A.plat.camera ? U.btn('', { icone: 'video', tipo: 'sec', redondo: true, titulo: T('Chamada de vídeo', 'Video call'), onclick: () => TK.ligar(TK.raizDe(c), true).catch((e) => U.toast(e.message, { tipo: 'erro' })) }) : null;
      if (vid) vid.classList.add('tk-cg', 'vid');
      return [
        h('div', { class: 'tk-cab-chamar' }, voz, vid),
        h('div', { class: 'tk-cab-trilho' }, ...extras.map((x) => { const b = U.btn('', { icone: x.icone, tipo: 'sec', redondo: true, titulo: x.texto, onclick: (e) => x.agir(e.currentTarget) }); b.classList.add('tk-cab-extra'); if (x.musica) { /* acende enquanto você ouve esta conversa */ b.classList.add('mu-bt'); let viu = false; const offs2 = []; const acender = () => { if (b.isConnected) viu = true; else if (viu) { offs2.forEach((f) => f()); offs2.length = 0; return; } b.classList.toggle('tocando', A.musica.tocandoEm(c.id)); }; offs2.push(A.evt.on('musica:tocando', acender), A.evt.on('musica:estado', acender)); acender(); } return b; }), mais),
      ];
    }
    async function abrir(c) {
      if (!c) return;
      atual = c; TK.aberta = c.id; A.evt.emit('onde'); raiz.classList.add('com-conversa'); kidAberto = A.cripto && A.cripto.kid;
      A.store.gravar('aero-talk-ultima', c.id); // ao voltar para o Aero Talk, abre de novo nesta conversa
      A.evt.emit('talk:abriu', c.id); // (0.8.7) a Música junto passa a tocar a última conversa aberta que está tocando
      pintarLista();
      if (sepConv && sepConv.cid !== c.id) sepConv.api.fechar(); // (1.0.2) abrir outra conversa traz de volta a que estava separada
      painel.textContent = ''; A.evt.emit('talk:aberta', { cid: c.id });
      const titulo = TK.titulo(c), pess = c.tipo === 'grupo' ? null : outroDaDM(c);
      const voltar = U.btn('', { icone: 'voltar', tipo: 'sec', redondo: true, peq: true, titulo: T('Voltar', 'Back'), onclick: () => fecharConversa() });
      voltar.classList.add('tk-voltar');
      // (0.9.2) a barra de cima voltou (nome, foto e status da conversa); no celular quem sai da frente é o cartão do seu perfil
      const cab = h('header', { class: 'tk-cab', 'data-area': 'cab' }, voltar,
        h('button', { type: 'button', class: 'tk-cab-quem', onclick: () => (c.tipo === 'grupo' ? configGrupo(TK.raizDe(c)) : A.perfil && A.perfil.ver(pess.codigo)) },
          c.tipo === 'grupo' ? TK.avatarGrupo(TK.raizDe(c), 44) : U.avatar(pess, 44, U.estadoDe(pess.codigo)),
          h('div', {}, c.tipo === 'grupo' ? h('b', {}, titulo) : h('b', { dados: { nomeCod: pess.codigo } }, titulo, A.aparelhos ? A.aparelhos.vivo(pess.codigo) : null), c.tipo === 'grupo' ? h('div', { class: 'peq suave' }, (c.membros || []).map((m) => m.apelido || m.nome).join(', ')) : h('div', { class: 'peq suave tk-cab-st', dados: { estadoCod: pess.codigo, st: U.estadoDe(pess.codigo), topo: '1' } }, U.textoTopo(pess.codigo, U.estadoDe(pess.codigo))))),
        h('div', { class: 'tk-cab-botoes' }, ...botoesCab(c, (...a) => alternarMembros(...a), pess)));
      if (pess && A.idiomas && A.perfil && A.integ && A.integ.ligada('horario')) A.perfil.buscar(pess.codigo).then((p) => { const r = p && A.idiomas.relogio(p.fz), b = cab.querySelector('.tk-cab-quem b'); if (r && b) b.append(r); }).catch(() => {}); // (1.0.2) que horas são para a pessoa
      // (0.8.6) o "visto por último" da pessoa (se as duas deixam) aparece embaixo do nome quando ela está off-line
      if (pess && A.perfil && A.perfil.buscar) A.perfil.buscar(pess.codigo).then((p) => { U.lembrarVisto(pess.codigo, p && p.visto, p && p.vm); U.atualizarVivos(); }).catch(() => {});
      cx = A.chatUI.criar({
        ehMeu: (m) => API.eu && m.de === API.eu.codigo,
        nome: (m) => nomeDe(m.de), avatar: (m) => pessoaDe(m.de), perfilDe: (m) => m.de, bolhaDe: (m) => pessoaDe(m.de).bc, nomeEstiloDe: (m) => pessoaDe(m.de).nm, selosDe: (m) => (A.ui.selosVisiveis ? A.ui.selosVisiveis(pessoaDe(m.de)) : pessoaDe(m.de).sl),
        podeApagar: () => c.tipo === 'grupo' && (c.meuPapel === 'dono' || c.meuPapel === 'admin'),
        aceitar: '*', limite: TK.limiteAnexo, dicaLimite,
        tituloAnexo: (() => { const mb = Math.round(TK.limiteAnexo() / 1048576), lim = mb >= 1024 ? Math.round(mb / 1024) + ' GB' : mb + ' MB'; return T('Enviar um arquivo (até ' + lim + ') · também dá para colar ou arrastar', 'Send a file (up to ' + lim + ') · you can also paste or drag'); })(),
        placeholder: T('Mensagem para ', 'Message ') + titulo,
        urlAnexo: (m) => TK.urlViva(m.anexo), urlDe: (a) => TK.urlViva(a), multiAnexo: true, aoMontar: (m) => { if ((m.anexos || [m.anexo]).some((a) => a && TK.urlMorta(a.url)) && TK._carregarAnexo) setTimeout(() => TK._carregarAnexo && TK._carregarAnexo(m), 0); },
        rascunho: c.id, enviar: (d) => TK.enviar(c, d), editar: (m, t) => TK.editar(c, m, t), apagar: (m) => TK.apagar(c, m), encaminhar: (m) => TK.encaminhar(m, c), reagir: (m, e) => TK.reagir(c, m, e), superReacoes: true,
        digitando: (sm) => { TK.euDigito(c.id); H.enviar({ tipo: 'digitando', cid: c.id, s: sm }); },
        ...opcoesChat(c),
        aoRolar: (fundo) => { if (fundo) { lerSeVendo(); if (c.marca) TK.marca(c, 0); } },
        // (0.9.1) depois de pular para um trecho antigo: as mais novas que ele, uma página por vez ao descer
        maisRecentes: async (ult) => {
          const r = await TK.mensagens(c, ult + 81, 80); if (atual !== c) return null;
          const l = r.msgs.filter((m) => m.seq > ult); l.forEach((m) => TK.lembrar(c.id, m));
          const cv = TK.conversas.find((x) => x.id === c.id) || c;
          const fim = !l.length || l[l.length - 1].seq >= (cv.seq || 0);
          aosPoucos(c, l);
          return { msgs: fim ? [...l, ...TK.pendentes(c.id)] : l, fim };
        },
        aoPresente: async () => {
          const r = await TK.mensagens(c); if (atual !== c) return;
          r.msgs.forEach((m) => TK.lembrar(c.id, m)); prox = null;
          cx.definir([...r.msgs, ...TK.pendentes(c.id)]); cx.lista.prepend(topoLista); mais = r.mais; topoLista.hidden = !mais; if (cx.semMaisAcima) cx.semMaisAcima(!mais);
          aosPoucos(c, r.msgs); lerSeVendo();
        },
        irParaMsg: (seq) => irParaSeq(seq),
        aoPodarTopo: () => { if (atual !== c) return; mais = true; const tp = cx && cx.lista.querySelector('.tk-carregar'); if (tp) tp.hidden = false; },
      });
      if (A.extras) A.extras.fundoConversa.aplicar(c.id, cx.el); // (1.0.0) o fundo que você escolheu para esta conversa
      // (1.0.2) clicar (ou entrar com o teclado) na conversa já conta como lida: um pedido só, e só se tem algo não lido (nada fica checando)
      const lerAoTocar = () => { if (atual !== c || document.hidden) return; const cv = TK.conversas.find((x) => x.id === c.id) || c; if ((cv.seq || 0) > (cv.lido || 0)) TK.marcarLido(cv, cv.seq); };
      cx.el.addEventListener('pointerdown', lerAoTocar, { passive: true }); cx.el.addEventListener('focusin', lerAoTocar);
      const topoLista = h('div', { class: 'tk-carregar', hidden: true }, U.btn(T('Mensagens anteriores', 'Earlier messages'), { tipo: 'link', peq: true, onclick: () => carregarMais() }));
      cx.lista.prepend(topoLista);
      // (0.7.1) subindo o chat, as mensagens anteriores chegam sozinhas antes de você chegar no topo (o botão fica de reserva)
      cx.lista.addEventListener('scroll', () => { if (cx.lista.scrollTop - (cx.vaoTopo ? cx.vaoTopo() : 0) < Math.max(1400, cx.lista.clientHeight * 3) && !topoLista.hidden) carregarMais(); }, { passive: true }); // (0.9.4) três telas antes do topo // (0.8.7) começa bem antes do topo
      // a chamada desta conversa no topo do chat (0.5.9-5, como no Discord, com a cara do Aero): as bolhas de quem está nela (brilham
      // quando a pessoa fala) e os botões. Sem estar na chamada: "Entrar com voz / vídeo". Dentro: microfone, câmera, tela, desligar e
      // maximizar. Com esta faixa na tela, a janelinha da chamada some (chamada.js) e volta quando você sai do chat.
      const faixa = h('div', { class: 'tk-cham-palco', hidden: true, dados: { cid: c.id } });
      let assinatura = '';
      const pintarFaixa = () => {
        const CH = A.chamada, est = CH && CH.estado ? CH.estado() : null, minha = !!(est && est.cid === c.id);
        let k = (TK.conversas.find((x) => x.id === c.id) || c).cham; const toque = !minha && CH && CH.tocandoEm ? CH.tocandoEm(c.id) : null;
        // (0.5.9-7) ninguém da chamada está online: é uma chamada "fantasma" (o servidor perdeu o aviso de que saíram). Esconde e pede a
        // lista de novo, que já vem conferida pelo servidor.
        // (0.9.0) a chamada de outros na faixa é conferida com o servidor a cada 20 s (o aviso de que ela acabou pode ter se perdido com o
        // app em segundo plano; antes a faixa ficava até sair e voltar para o chat)
        if (k && !minha && (!faixa.conferiu || Date.now() - faixa.conferiu > 20000)) { faixa.conferiu = Date.now(); TK.carregar().catch(() => {}); }
        if (k && !minha && !k.quem.some((q) => H.online(q))) { k = null; if (!faixa.recarregou || Date.now() - faixa.recarregou > 30000) { faixa.recarregou = Date.now(); TK.carregar().catch(() => {}); } }
        if (!minha && !k && !toque) { if (!faixa.hidden) { faixa.hidden = true; faixa.textContent = ''; assinatura = ''; faixa._avs = null; faixa._vistos = null; if (CH && CH.ajustarJanela) CH.ajustarJanela(); if (CH && CH.ajustarToque) CH.ajustarToque(); } return; }
        const pessoas = minha ? [{ ...est.eu, eu: true }, ...est.pares.map((q) => ({ ...q, ...pessoaDe(q.codigo) }))] : (k ? k.quem : [toque.de.codigo]).map((q) => ({ codigo: q, ...pessoaDe(q) }));
        // (0.7.0) quem está falando NÃO entra na assinatura: só a bolinha verde muda (antes a faixa inteira era refeita e as fotos de todo mundo
        // recarregavam a cada fala). E quem está compartilhando a tela aparece aqui mesmo (não tem a janelinha nessa hora)
        const telaDe = minha ? est.pares.find((q) => q.tela && A.chamada.midiaTela && A.chamada.midiaTela(q.codigo)) : null;
        const sig = JSON.stringify([minha, !!toque, est && est.modo, est && est.chamando, pessoas.map((q) => [q.codigo, !!q.mudo, !!q.cam, !!q.tela]), est && est.eu.mudo, est && est.eu.surdo, est && est.eu.cam, est && est.eu.tela, telaDe && telaDe.codigo]);
        const marcarFala = () => { for (const q of pessoas) { const b = faixa.querySelector('.tk-cham-bolha[data-cod="' + q.codigo + '"]'); if (b) falaEm(b, !!q.falando); } };
        if (sig === assinatura && faixa.querySelector('.tk-cham-tempo')) { const t = faixa.querySelector('.tk-cham-tempo'); const ini = minha ? est.inicio : k && k.inicio; t.textContent = ini ? TK.duracao(Date.now() - ini) : T('chamando…', 'calling…'); marcarFala(); return; }
        assinatura = sig; faixa.hidden = false; faixa.textContent = '';
        let telaBox = null;
        if (telaDe) {
          const v = faixa._video || (faixa._video = h('video', { autoplay: true, playsinline: true, class: 'tk-cham-video' })); v.muted = true;
          const st = A.chamada.midiaTela(telaDe.codigo); if (v.srcObject !== st) { v.srcObject = st; v.play().catch(() => {}); }
          telaBox = h('button', { type: 'button', class: 'tk-cham-telabox', title: T('Abrir a tela de ', 'Open the screen of ') + nomeDe(telaDe.codigo), onclick: () => { A.chamada.modo('max'); if (A.chamada.focarTela) A.chamada.focarTela(telaDe.codigo); } }, v, h('span', { class: 'tk-cham-telanome' }, T('Tela de ', 'Screen of ') + nomeDe(telaDe.codigo)));
        } else if (faixa._video) { faixa._video.srcObject = null; faixa._video = null; }
        // (0.7.1) a foto de cada pessoa é a MESMA de antes quando a faixa é refeita (antes era criada de novo: a imagem recarregava e a bolha
        // "nascia" outra vez, parecendo que a faixa ficava atualizando). Só quem acabou de entrar ganha a animação de nascer
        const avs = faixa._avs || (faixa._avs = new Map()), vistos = faixa._vistos || new Set();
        const fotoDe = (q) => { const k = q.codigo + '|' + (q.av || 0); let a = avs.get(k); if (!a) { a = U.avatar(q, 58); avs.set(k, a); } return a; };
        faixa._vistos = new Set(pessoas.map((q) => q.codigo));
        // (0.7.2) botão direito na foto de alguém da chamada: o volume dessa pessoa (só para você)
        const volume = (q) => (ev) => { if (q.eu || !minha || !A.chamada.volumePessoa) return; ev.preventDefault(); ev.stopPropagation(); A.chamada.volumePessoa(q.codigo, fotoDe(q)); };
        const bolhas = h('div', { class: 'tk-cham-bolhas' }, ...pessoas.map((q, i) => (A.extras ? A.extras.marcarChamada : (x) => x)(h('div', { class: 'tk-cham-bolha' + (vistos.has(q.codigo) ? '' : ' nova') + (q.falando ? ' falando' : '') + (q.mudo ? ' mudo' : ''), dados: { cod: q.codigo }, estilo: { '--i': i }, oncontextmenu: volume(q), title: (q.eu ? T('Você', 'You') : nomeDe(q.codigo) + (minha ? T(' · botão direito: volume', ' · right-click: volume') : '')) + (q.mudo ? T(' (microfone desligado)', ' (mic off)') : '') },
          fotoDe(q), q.mudo ? h('span', { class: 'tk-cham-mudo' }, A.icone('micOff', 13)) : null, q.tela ? h('span', { class: 'tk-cham-tela' }, 'TELA') : null), q.codigo)));
        const ini = minha ? est.inicio : k && k.inicio;
        const outroAparelho = !minha && k && API.eu && k.quem.includes(API.eu.codigo); // (0.6.0) a chamada é do aparelho
        const info = h('div', { class: 'tk-cham-info' }, h('b', {}, minha ? (est.chamando ? T('Chamando…', 'Calling…') : T('Você está na chamada', 'You are in the call')) : toque ? nomeDe(toque.de.codigo) + T(' está te ligando…', ' is calling you…') : outroAparelho ? T('Você está nesta chamada em outro aparelho', 'You are in this call on another device') : T('Chamada em andamento', 'Call in progress')), h('span', { class: 'tk-cham-tempo' }, ini ? TK.duracao(Date.now() - ini) : T('chamando…', 'calling…')));
        const bt = (icone, titulo, f, tipo = 'sec', extra = '') => { const b = U.btn('', { icone, tipo, redondo: true, titulo, onclick: f }); if (extra) b.classList.add(...extra.split(' ')); return b; };
        let botoes;
        if (minha) {
          const seta = (titulo, abrir) => { const b = U.btn('', { icone: 'chevron', tipo: 'sec', redondo: true, peq: true, titulo }); b.classList.add('seta'); b.onclick = (e) => { e.stopPropagation(); if (U._pop && U._pop.ancora === b) { U._pop.fechar(); return; } abrir(b); }; return b; };
          const mic = bt(est.eu.mudo ? 'micOff' : 'mic', est.eu.mudo ? T('Ligar o microfone', 'Unmute') : T('Desligar o microfone', 'Mute'), () => A.chamada.mudo(), 'sec', est.eu.mudo ? 'desligado' : 'ativo');
          botoes = h('div', { class: 'tk-cham-botoes' },
            h('div', { class: 'par' }, mic, seta(T('Opções do microfone', 'Microphone options'), (b) => A.chamada.opcoesMic(b))),
            h('div', { class: 'par' }, bt(est.eu.surdo ? 'mudo' : 'volume', est.eu.surdo ? T('Ligar o som', 'Unmute sound') : T('Deixar de ouvir (mudo geral)', 'Stop hearing (mute all)'), () => A.chamada.mudoSom(), 'sec', est.eu.surdo ? 'desligado' : ''), seta(T('Saída de som e volumes', 'Sound output and volumes'), (b) => A.chamada.opcoesSom(b))),
            A.plat.camera ? h('div', { class: 'par' }, bt(est.eu.cam ? 'video' : 'videoOff', T('Câmera', 'Camera'), () => A.chamada.camera(), 'sec', est.eu.cam ? 'ativo' : ''), seta(T('Escolher a câmera', 'Choose the camera'), (b) => A.chamada.opcoesCamera(b))) : null,
            A.plat.podeCompartilhar ? h('div', { class: 'par' }, bt('enviarTela', est.eu.tela ? T('Parar de compartilhar', 'Stop sharing') : T('Compartilhar a tela', 'Share screen'), () => A.chamada.tela(), 'sec', est.eu.tela ? 'ativo' : ''), seta(T('Opções de compartilhamento', 'Sharing options'), (b) => A.chamada.opcoesTela(b))) : null,
            h('i', { class: 'tk-cham-div', 'aria-hidden': 'true' }),
            bt('expandir', T('Maximizar a chamada', 'Maximize the call'), () => A.chamada.modo('max')),
            bt('desligarTel', T('Desligar', 'Hang up'), () => A.chamada.desligar(), 'perigo', 'tk-cham-fim'));
        } else if (toque) { // tocando para você: atender aqui mesmo
          const erro = (e) => U.toast(e.message || String(e), { tipo: 'erro' });
          botoes = h('div', { class: 'tk-cham-botoes' },
            U.btn(T('Recusar', 'Decline'), { icone: 'desligarTel', tipo: 'perigo', onclick: () => CH.recusarTocando() }),
            U.btn(T('Atender', 'Answer'), { icone: 'telefone', tipo: 'ok', onclick: () => Promise.resolve(CH.atenderTocando(false)).catch(erro) }),
            A.plat.camera ? U.btn(T('Com vídeo', 'With video'), { icone: 'video', tipo: 'ok', onclick: () => Promise.resolve(CH.atenderTocando(true)).catch(erro) }) : null);
          botoes.classList.add('tocando');
        } else {
          botoes = h('div', { class: 'tk-cham-botoes' },
            U.btn(outroAparelho ? T('Passar para este aparelho', 'Move to this device') : T('Entrar com voz', 'Join with voice'), { icone: 'telefone', tipo: 'ok', onclick: () => A.chamada.entrarNa(c, false).catch((e) => U.toast(e.message || String(e), { tipo: 'erro' })) }),
            A.plat.camera ? U.btn(T('Entrar com vídeo', 'Join with video'), { icone: 'video', tipo: 'ok', onclick: () => A.chamada.entrarNa(c, true).catch((e) => U.toast(e.message || String(e), { tipo: 'erro' })) }) : null);
        }
        faixa.append(h('div', { class: 'tk-cham-ceu', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), telaBox, bolhas, info, botoes); faixa.classList.toggle('com-tela', !!telaBox);
        if (A.chamada && A.chamada.ajustarJanela) A.chamada.ajustarJanela();
        if (CH && CH.ajustarToque) CH.ajustarToque();
      };
      pintarFaixa();
      faixa.t = setInterval(() => { if (!faixa.isConnected) { clearInterval(faixa.t); return; } pintarFaixa(); }, 300);
      // (0.7.1) a bolinha verde de quem fala acompanha a voz mais de perto (só ela, sem refazer a faixa)
      faixa.tf = setInterval(() => {
        if (!faixa.isConnected) { clearInterval(faixa.tf); return; } if (faixa.hidden) return;
        const est = A.chamada && A.chamada.estado ? A.chamada.estado() : null; if (!est || est.cid !== c.id) return;
        for (const q of [est.eu, ...est.pares]) { const b = faixa.querySelector('.tk-cham-bolha[data-cod="' + q.codigo + '"]'); if (b) falaEm(b, !!q.falando); }
      }, 150);
      const offFaixa = [A.evt.on('talk:cham', (e) => { if (e.cid === c.id && atual === c) pintarFaixa(); }), A.evt.on('chamada:fim', () => { if (atual === c) { assinatura = ''; pintarFaixa(); } }), A.evt.on('chamada:entrou', () => { if (atual === c) { assinatura = ''; pintarFaixa(); } })];
      faixa.limpar = () => { clearInterval(faixa.t); clearInterval(faixa.tf); offFaixa.forEach((f) => f()); };
      if (TK._faixa) TK._faixa.limpar(); TK._faixa = faixa;
      // lateral de MEMBROS do grupo (como no Discord, com a cara do Aero): cada pessoa é uma bolha que aparece em sequência; ao fechar,
      // as bolhas estouram uma por uma. Botão direito numa bolha abre o menu da pessoa (com o que o seu papel no grupo permite).
      const membrosEl = h('aside', { class: 'tk-membros', hidden: true });
      const agirMembro = async (acao, p) => { try { await API.req(`conv/${c.id}/membro`, { codigo: p.codigo, acao }); if (acao === 'remover') A.som.tocar('estourar'); await TK.carregar(); const nova = TK.conversas.find((x) => x.id === c.id); if (nova) { Object.assign(c, nova); if (!membrosEl.hidden) pintarMembros(); } } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
      const papelTxt = { dono: T('dono', 'owner'), admin: 'admin', membro: '' };
      // (0.8.4) o nameplate e o estilo do nome de cada membro, como na lista de conversas. Amigos (e você) já estão à mão; os outros vêm do
      // perfil (guardado por alguns minutos), sem atrasar a lista
      function estiloMembro(b, p, i) {
        const aplicar = (x) => {
          if (!x || !b.isConnected) return;
          if (A.perfil && A.perfil.nameplate) A.perfil.nameplate(b, { ...x, codigo: p.codigo });
          const nmEl = b.querySelector('.tk-membro-nm'); if (nmEl && x.nm) A.ui.aplicarNome(nmEl, x.nm);
        };
        const eu = API.eu && p.codigo === API.eu.codigo ? API.eu : null, a = eu || amigo(p.codigo);
        if (a && (a.np || a.nm)) return aplicar(a);
        if (p.np || p.nm) return aplicar(p);
        if (!eu && i < 40 && A.perfil && A.perfil.buscar) A.perfil.buscar(p.codigo).then(aplicar).catch(() => {});
      }
      function pintarMembros() {
        membrosEl.textContent = '';
        const eOn = (q) => H.online(q.codigo) || (API.eu && q.codigo === API.eu.codigo);
        const lista = [...(c.membros || [])].sort((a, b) => (eOn(b) ? 1 : 0) - (eOn(a) ? 1 : 0));
        membrosEl.append(h('div', { class: 'tk-membros-cab' }, T('Membros', 'Members') + ' — ' + lista.length));
        lista.forEach((p, i) => {
          const on = H.online(p.codigo) || (API.eu && p.codigo === API.eu.codigo); // você mesmo está online, claro
          const b = h('button', { type: 'button', class: 'tk-membro-bolha' + (on ? '' : ' off'), dados: { menu: '1', mudo: '1', cod: p.codigo }, estilo: { '--i': i }, onpointerenter: (e) => { if (e.pointerType !== 'touch' && document.documentElement.dataset.lock !== '1') A.som.tocar('tk-passar'); }, onclick: (e) => A.perfil && A.perfil.mini(p.codigo, e.currentTarget), oncontextmenu: (e) => A.perfil && A.perfil.menu(e, p, { grupo: { c, agir: agirMembro } }) },
            marcarDig(U.avatar(p, 40, on ? 'online' : 'offline'), TK.estaDigitando(p.codigo, c.pai || c.id)), h('div', { class: 'cresce' }, h('div', { class: 'tk-membro-nome' }, h('span', { class: 'tk-membro-nm' }, p.apelido || p.nome), p.papel === 'dono' ? h('span', { class: 'tk-coroa', title: T('dono', 'owner') }, A.icone('coroa', 13)) : null, ' ', A.ui.insignias && !(p.pf && p.pf.si === false) ? A.ui.insignias(p.ins, null, p.pf && p.pf.so) : null), papelTxt[p.papel] ? h('div', { class: 'peq suave' }, papelTxt[p.papel]) : null, A.jogando ? A.jogando.linha(p.codigo) : null, A.assistindo ? A.assistindo.linha(p.codigo) : null, A.ouvindo ? A.ouvindo.linha(p.codigo) : null));
          membrosEl.append(b);
          estiloMembro(b, p, i);
          if (somMembros) timersMembros.push(setTimeout(() => A.som.tocar('bolha-cresce'), i * 70)); // cada bolha "nasce" crescendo
        });
      }
      // (0.7.9) a lateral lembra se ficou aberta. Clicar várias vezes seguidas cancela a animação anterior, e os sons só tocam no primeiro clique
      // (antes cada clique deixava na fila um estouro por pessoa e uma janela fechando por cima da outra)
      let timersMembros = [], somMembros = true, ultMembros = 0;
      function alternarMembros(forcar, salvar = true) {
        const abrir = forcar != null ? forcar : membrosEl.hidden || membrosEl.classList.contains('fechando');
        timersMembros.forEach(clearTimeout); timersMembros = [];
        somMembros = salvar && Date.now() - ultMembros > 500; ultMembros = Date.now();
        if (salvar) A.store.gravar('aero-membros-aberto', abrir ? '1' : '0');
        if (abrir) { membrosEl.hidden = false; membrosEl.classList.remove('fechando'); pintarMembros(); return; }
        if (!somMembros) { membrosEl.hidden = true; membrosEl.classList.remove('fechando'); membrosEl.textContent = ''; return; }
        const bolhas = [...membrosEl.querySelectorAll('.tk-membro-bolha')].reverse();
        bolhas.forEach((b, i) => timersMembros.push(setTimeout(() => { b.classList.add('estourando'); A.som.tocar('bolha-estoura'); }, i * 60)));
        membrosEl.classList.add('fechando');
        timersMembros.push(setTimeout(() => { membrosEl.hidden = true; membrosEl.classList.remove('fechando'); membrosEl.textContent = ''; }, bolhas.length * 60 + 380));
      }
      // (0.6.0) pedido de mensagem: quem recebe aceita ou recusa; quem mandou espera
      const faixaPedido = h('div', { class: 'tk-pedido-faixa', hidden: true });
      const pintarPedido = () => {
        const p = c.pedido; faixaPedido.textContent = '';
        if (!p || p.aceito) { faixaPedido.hidden = true; cx.el.classList.remove('travado'); return; }
        faixaPedido.hidden = false;
        if (p.deMim) { faixaPedido.append(h('span', {}, p.recusado ? T('A pessoa recusou o seu pedido de mensagem.', 'They declined your message request.') : T('Pedido de mensagem enviado. Espere a pessoa aceitar para continuar a conversa.', 'Message request sent. Wait for them to accept to keep talking.'))); }
        else faixaPedido.append(h('span', { class: 'cresce' }, h('b', {}, TK.titulo(c)), T(' quer conversar com você. Aceitar?', ' wants to chat with you. Accept?')),
          U.btn(T('Recusar', 'Decline'), { tipo: 'perigo', peq: true, onclick: async () => { await TK.responderPedido(c, false).catch((e) => U.toast(e.message, { tipo: 'erro' })); fecharConversa(); } }),
          U.btn(T('Aceitar', 'Accept'), { tipo: 'ok', peq: true, onclick: async () => { await TK.responderPedido(c, true).catch((e) => U.toast(e.message, { tipo: 'erro' })); const nova = TK.conversas.find((x) => x.id === c.id); if (nova) Object.assign(c, nova); pintarPedido(); } }));
      };
      pintarPedido();
      // (0.6.0) divisores: a faixa da chamada fica do tamanho que você puxar (como no Discord) e a lateral de membros também
      const divFaixa = h('div', { class: 'tk-divisor y', title: T('Arraste para mudar o tamanho (duplo clique volta ao normal)', 'Drag to resize (double-click resets)') });
      const divMembros = h('div', { class: 'tk-divisor x', title: T('Arraste para mudar a largura', 'Drag to change the width') });
      U.redimensionar(faixa, divFaixa, { eixo: 'y', min: 170, max: Math.round(innerHeight * 0.7), chave: 'tk-faixa' });
      U.redimensionar(membrosEl, divMembros, { eixo: 'x', sinal: -1, min: 180, max: 440, chave: 'tk-membros' });
      const verDivFaixa = () => { divFaixa.hidden = faixa.hidden; divMembros.hidden = membrosEl.hidden; };
      new MutationObserver(verDivFaixa).observe(faixa, { attributes: true, attributeFilter: ['hidden'] });
      new MutationObserver(verDivFaixa).observe(membrosEl, { attributes: true, attributeFilter: ['hidden'] });
      verDivFaixa();
      const canaisEl = c.tipo === 'grupo' ? faixaCanais(c) : null;
      painel.append(canaisEl || '', faixaPedido, h('div', { class: 'tk-corpo' }, h('div', { class: 'tk-coluna' }, cab, faixa, divFaixa, cx.el), divMembros, membrosEl));
      if (c.tipo === 'grupo' && A.store.ler('aero-membros-aberto', '0') === '1' && !matchMedia('(max-width: 760px)').matches) alternarMembros(true, false);
      // (0.9.1) ir para uma mensagem antiga (busca, fixada, resposta, marcada): busca só o trecho em volta dela, de uma vez (como no Discord);
      // antes subia a conversa página por página até chegar nela, montando todas as do meio
      irParaSeq = async (seq, op) => {
        if (atual !== c || !seq) return;
        if (cx.perto(seq)) { cx.irPara(seq, op); return; }
        const r = await TK.mensagens(c, seq + 41, 80); if (atual !== c) return;
        r.msgs.forEach((m) => TK.lembrar(c.id, m)); prox = null;
        const cv = TK.conversas.find((x) => x.id === c.id) || c;
        const fim = !r.msgs.length || r.msgs[r.msgs.length - 1].seq >= (cv.seq || 0);
        cx.definir(fim ? [...r.msgs, ...TK.pendentes(c.id)] : r.msgs, { solto: !fim });
        cx.lista.prepend(topoLista); mais = r.mais; topoLista.hidden = !mais; if (cx.semMaisAcima) cx.semMaisAcima(!mais);
        cx.irPara(seq, op);
        aosPoucos(c, r.msgs);
      };
      // as fotos e os vídeos do trecho abrem um por vez, quando o app está livre (todos juntos travavam a rolagem)
      const aosPoucos = (cc, l) => { const fila = l.slice().reverse(); const prox2 = () => { const m = fila.shift(); if (!m || atual !== cc) return; carregarAnexo(m); (window.requestIdleCallback || setTimeout)(prox2, { timeout: 120 }); }; prox2(); };
      const carregarAnexo = (m) => TK.abrirMidias(c.id, m, (mm, a) => cx.midiaPronta(mm, a));
      try {
        const r = await TK.mensagens(c);
        if (atual !== c) return;
        mais = r.mais; topoLista.hidden = !mais;
        r.msgs.forEach((m) => TK.lembrar(c.id, m)); cx.adicionarVarias([...r.msgs, ...TK.pendentes(c.id)]); r.msgs.forEach(carregarAnexo); if (cx.semMaisAcima) cx.semMaisAcima(!mais);
        // (0.6.0) marcada como não lida: volta no ponto marcado; senão, sempre no fim (e só aí conta como lida)
        if (c.marca) await irParaSeq(c.marca, { piscar: true, bloco: 'start' });
        else lerSeVendo();
      } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      if (document.documentElement.dataset.entrada !== 'pad') cx.focar();
      TK._carregarAnexo = carregarAnexo;
    }
    async function carregarMais() {
      if (!atual || !mais || carregandoMais) return;
      carregandoMais = true;
      const c = atual, prim = cx.lista.querySelector('.cx-msg'), pid = cx.primeiraId ? cx.primeiraId() : null; const antesDe = typeof pid === 'number' ? pid : prim ? Number(prim.dataset.id) : 0; // (0.9.4) conta as que ainda estão entrando
      // (0.8.7) a próxima página já vem buscada em segundo plano (veja o fim): subir o chat não espera a internet nem a decifragem
      const buscar = (cc, ant) => { if (prox && prox.c === cc && prox.ant === ant) return prox.p; const p = TK.mensagens(cc, ant); prox = { c: cc, ant, p }; p.catch(() => { if (prox && prox.p === p) prox = null; }); return p; };
      try {
        const r = await buscar(c, antesDe); if (prox && prox.c === c && prox.ant === antesDe) prox = null;
        if (atual !== c) return; mais = r.mais;
        r.msgs.forEach((m) => TK.lembrar(c.id, m));
        cx.antes(r.msgs); // (ela mesma deixa a rolagem onde estava)
        const topo = cx.lista.querySelector('.tk-carregar'); if (topo) topo.hidden = !mais; if (cx.semMaisAcima) cx.semMaisAcima(!mais);
        // as fotos das antigas carregam aos poucos, sem travar a rolagem
        const fila = r.msgs.slice().reverse(); const proxAnexo = () => { const m = fila.shift(); if (!m) return; if (atual === c && TK._carregarAnexo) TK._carregarAnexo(m); (window.requestIdleCallback || setTimeout)(proxAnexo, { timeout: 120 }); }; proxAnexo();
        const p2 = r.msgs.length ? r.msgs[0].seq : 0; if (mais && p2) setTimeout(() => { if (atual === c) buscar(c, p2); }, 60);
      } catch (e) { A.ui.toast(e.message, { tipo: 'erro' }); } finally { carregandoMais = false; }
    }
    // ---------- lida de verdade (0.6.0): conversa aberta, janela em foco e visível, e o fim da conversa na tela ----------
    TK.vendo = (cid) => !!(atual && atual.id === cid && cx && !document.hidden && A.focado() && cx.noFundo() && !document.querySelector('.fundo-modal'));
    function lerSeVendo() { if (atual && TK.vendo && TK.vendo(atual.id)) TK.marcarLido(atual, atual.seq || 0); } // (0.6.6) o timer de "voltou para a janela" podia rodar depois que a aba do Talk fechou
    const aoVoltar = () => setTimeout(lerSeVendo, 150);
    addEventListener('focus', aoVoltar); document.addEventListener('visibilitychange', aoVoltar);
    offs.push(() => { removeEventListener('focus', aoVoltar); document.removeEventListener('visibilitychange', aoVoltar); TK.vendo = null; });
    // (0.6.9) "Mencionar" no botão direito de uma pessoa: escreve a menção dela no campo da conversa aberta
    TK.podeMencionar = () => !!(atual && cx && cx.mencionar);
    TK.mencionar = (p) => { if (atual && cx && cx.mencionar) cx.mencionar(p); };
    offs.push(() => { TK.podeMencionar = null; TK.mencionar = null; });
    ouvir('talk:recibos', (cid) => { if (atual && atual.id === cid && cx) cx.atualizarStatus(); });
    ouvir('talk:bolha', (cod) => { if (atual && cx) cx.trocarBolhas((m) => cod == null || m.de === cod); });
    ouvir('talk:lista', () => { if (atual && cx) cx.atualizarStatus(); });
    ouvir('talk:pendente', ({ cid, msg }) => { if (atual && atual.id === cid && cx) cx.adicionar(msg); });
    ouvir('talk:pendente-fim', ({ cid, id }) => { if (atual && atual.id === cid && cx) cx.remover(id, true); });
    ouvir('talk:fechar-se', (cid) => { if (atual && atual.id === cid) fecharConversa(); });
    ouvir('talk:fixadas', () => {});
    // (1.0.2) a conversa aberta (com a chamada, telas e câmeras) numa janela separada; no lugar fica um aviso, e fechar a janela traz de volta
    let sepConv = null;
    function separarConversa(c) {
      if (sepConv) { sepConv.api.focar(); return; }
      const api = A.separar.abrir('talk', painel, { titulo: TK.titulo(c), aviso: T('Esta conversa está numa janela separada', 'This chat is in a separate window'), aoVoltar: () => { const sc = sepConv; sepConv = null; if (sc && !sc.semReabrir && atual && atual.id === sc.cid && painel.isConnected) abrir(atual); } }); // (1.0.2) de volta: a conversa abre de novo, carregando direito (o chat tinha ficado preso à outra janela)
      if (api) sepConv = { cid: c.id, api };
    }
    function fecharConversa() { if (sepConv) { sepConv.semReabrir = true; sepConv.api.fechar(); } A.store.gravar('aero-talk-ultima', ''); atual = null; TK.aberta = null; A.evt.emit('onde'); raiz.classList.remove('com-conversa'); painel.textContent = ''; painel.append(vazioConv); pintarLista(); }

    const opcoesChat = TK.opcoesChat;
    // ---------- procurar na conversa (0.6.0, inspirado na busca do Discord) ----------
    const TEM = { link: T('link', 'link'), youtube: 'YouTube', video: T('vídeo', 'video'), audio: T('áudio', 'audio'), imagem: T('imagem', 'image'), gif: 'GIF', arquivo: T('arquivo', 'file'), texto: T('código ou texto', 'code or text'), figurinha: T('figurinha', 'sticker') };
    const histKey = (c) => 'aero-busca:' + (API.eu ? API.eu.codigo : '') + ':' + c.id;
    const historico = (c) => { try { return JSON.parse(A.store.ler(histKey(c), '[]')) || []; } catch (e) { return []; } };
    function buscarNa(c, ancora) {
      const inp = h('input', { class: 'campo', placeholder: T('Procurar (de: tem: menciona:)', 'Search (from: has: mentions:)'), 'aria-label': T('Procurar', 'Search') });
      const corpo = h('div', { class: 'busca-corpo' });
      const pessoaPor = (t) => { t = t.toLowerCase().replace(/^@/, ''); return (c.membros || []).find((p) => (p.apelido || p.nome || '').toLowerCase() === t || (p.tag || '').toLowerCase() === t) || (c.membros || []).find((p) => (p.apelido || p.nome || '').toLowerCase().startsWith(t)); };
      const filtros = () => {
        corpo.textContent = '';
        const add = (txt) => { inp.value = (inp.value.trim() + ' ' + txt).trim(); inp.focus(); filtros(); };
        corpo.append(h('div', { class: 'busca-tit' }, T('Filtros', 'Filters')),
          h('button', { type: 'button', class: 'busca-filtro', onclick: () => add('de:') }, A.icone('pessoa', 18), h('div', {}, h('b', {}, T('De uma pessoa', 'From someone')), h('div', { class: 'peq suave' }, 'de: ' + T('nome', 'name')))),
          h('button', { type: 'button', class: 'busca-filtro', onclick: () => add('tem:') }, A.icone('clipe', 18), h('div', {}, h('b', {}, T('Com um tipo de conteúdo', 'With a content type')), h('div', { class: 'peq suave' }, 'tem: ' + Object.keys(TEM).join(', ')))),
          h('button', { type: 'button', class: 'busca-filtro', onclick: () => add('menciona:') }, h('span', { class: 'busca-arroba' }, '@'), h('div', {}, h('b', {}, T('Que menciona alguém', 'That mentions someone')), h('div', { class: 'peq suave' }, 'menciona: ' + T('nome', 'name')))));
        if (/(de|menciona):$/.test(inp.value.trim())) { const pre = /(de|menciona):$/.exec(inp.value.trim())[1]; corpo.textContent = ''; corpo.append(h('div', { class: 'busca-tit' }, pre === 'de' ? T('De quem?', 'From whom?') : T('Que menciona quem?', 'Mentioning whom?')), ...(c.membros || []).map((p) => h('button', { type: 'button', class: 'busca-filtro', onclick: () => { inp.value = inp.value.trim() + (p.apelido || p.nome).replace(/\s+/g, '_') + ' '; inp.focus(); filtros(); } }, A.ui.avatar(p, 24), h('b', {}, p.apelido || p.nome)))); return; }
        if (/tem:$/.test(inp.value.trim())) { corpo.textContent = ''; corpo.append(h('div', { class: 'busca-tit' }, T('Que tipo?', 'Which type?')), ...Object.entries(TEM).map(([k, v]) => h('button', { type: 'button', class: 'busca-filtro', onclick: () => { inp.value = inp.value.trim() + k + ' '; inp.focus(); filtros(); } }, h('b', {}, v)))); return; }
        const hist = historico(c);
        if (hist.length) corpo.append(h('div', { class: 'busca-tit linha entre' }, T('Histórico', 'History'), U.btn('', { icone: 'lixo', tipo: 'link', peq: true, titulo: T('Limpar', 'Clear'), onclick: () => { A.store.gravar(histKey(c), '[]'); filtros(); } })), ...hist.map((q) => h('button', { type: 'button', class: 'busca-filtro', onclick: () => { inp.value = q; procurar(); } }, A.icone('lupa', 16), h('span', {}, q))));
      };
      let geracao = 0;
      const procurar = async () => {
        const q = inp.value.trim(); if (!q) { geracao++; filtros(); return; }
        const eu = ++geracao, vivo = () => eu === geracao && corpo.isConnected;
        A.store.gravar(histKey(c), JSON.stringify([q, ...historico(c).filter((x) => x !== q)].slice(0, 8)));
        let de = null, men = null; const tem = []; const palavras = [];
        for (const tok of q.split(/\s+/)) {
          const m = /^(de|from|tem|has|menciona|mentions):(.*)$/i.exec(tok);
          if (!m) { palavras.push(tok.toLowerCase()); continue; }
          const k = m[1].toLowerCase(), v = m[2].replace(/_/g, ' ');
          if (k === 'de' || k === 'from') de = pessoaPor(v); else if (k === 'menciona' || k === 'mentions') men = pessoaPor(v); else if (v) tem.push(v.toLowerCase());
        }
        const temTipo = (m, t) => {
          const txt = m.texto || '', a = m.anexo;
          if (t === 'link') return /https?:\/\//.test(txt);
          if (t === 'youtube') return /youtu\.?be/.test(txt);
          if (t === 'video') return a && a.tipo === 'video';
          if (t === 'audio') return a && a.tipo === 'audio';
          if (t === 'imagem' || t === 'image') return a && a.tipo === 'imagem';
          if (t === 'gif') return (a && a.mime === 'image/gif') || /klipy\.co/.test(txt);
          if (t === 'figurinha' || t === 'sticker') return /<fig:/.test(txt);
          if (t === 'arquivo' || t === 'file') return !!a;
          return true;
        };
        const reMen = men ? new RegExp('<@' + men.codigo + '>', 'i') : null;
        const bate = (m) => !m.sistema && (!de || m.de === de.codigo) && (!reMen || reMen.test(m.texto || '')) && tem.every((t) => temTipo(m, t)) && (!palavras.length || palavras.every((p) => (m.texto || '').replace(/<@([A-Z0-9]{6})>/gi, (_, x) => '@' + nomeDe(x.toUpperCase())).toLowerCase().includes(p)));
        corpo.textContent = '';
        const tit = h('div', { class: 'busca-tit' }, T('Procurando...', 'Searching...')); corpo.append(tit);
        let n = 0, procurando = true;
        const placar = () => { tit.textContent = n + T(' resultado(s)', ' result(s)') + (procurando ? T(' · procurando...', ' · searching...') : ''); };
        const pintar = (m) => {
          const prev = (m.texto || '').replace(/<@([A-Z0-9]{6})>/gi, (_, x) => '@' + nomeDe(x.toUpperCase())).replace(/<fig:[^>]+>/gi, '[' + T('figurinha', 'sticker') + ']').replace(/<em:[A-Z0-9]{6}:[0-9a-f]{10}:([a-z0-9_]{2,24})>/gi, ':$1:') || (m.anexo ? '📎 ' + (TEM[m.anexo.tipo] || m.anexo.tipo) : '');
          const pv = previaMsg(c, m, prev.slice(0, 200));
          corpo.append(h('div', { class: 'busca-res' + (pv ? ' com-previa' : '') }, U.avatar(pessoaDe(m.de), 30), h('div', { class: 'cresce' },
            h('button', { type: 'button', class: 'sem-botao busca-ir', title: T('Ir para a mensagem', 'Jump to message'), onclick: async () => { pop.fechar(); if (atual !== c) await abrir(c); await irParaSeq(m.seq); } },
              h('div', { class: 'linha entre' }, h('b', {}, nomeDe(m.de)), h('span', { class: 'peq suave' }, new Date(m.t).toLocaleString())), pv ? null : h('div', { class: 'busca-trecho' }, prev.slice(0, 200))), pv)));
        };
        // os resultados aparecem conforme cada página chega (da mais nova para a mais antiga) e param no 200º
        const aoPagina = (lista) => {
          if (!vivo() || n >= 200) return;
          for (let i = lista.length - 1; i >= 0 && n < 200; i--) if (bate(lista[i])) { n++; pintar(lista[i]); }
          placar();
        };
        try { await TK.todas(c, null, aoPagina, () => vivo() && n < 200); } catch (e) { if (vivo()) A.ui.toast(e.message, { tipo: 'erro' }); }
        if (!vivo()) return;
        procurando = false; placar();
      };
      let t = 0;
      inp.addEventListener('input', () => { clearTimeout(t); if (/(de|menciona|tem):$/i.test(inp.value.trim()) || !inp.value.trim()) { filtros(); return; } t = setTimeout(procurar, 450); });
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { clearTimeout(t); procurar(); } });
      const pop = U.popover(ancora, [inp, corpo], { largura: 420, titulo: T('Procurar em ', 'Search in ') + TK.titulo(c) });
      filtros(); setTimeout(() => inp.focus(), 60);
    }
    // (0.8.7) prévia de mídia na busca e nas fixadas: imagem, GIF, áudio, vídeo, YouTube e embeds como no chat (o anexo só carrega quando aparece)
    const temMidia = (m) => !!m.anexo || /https?:\/\/|<fig:/i.test(m.texto || '');
    function previaMsg(c, m, trecho) {
      if (!cx || !cx.previa || !temMidia(m)) return null;
      const caixa = h('div', { class: 'busca-previa' });
      const pintar = () => { const p = cx.previa(m); caixa.replaceChildren(p.childElementCount ? p : h('div', { class: 'busca-trecho' }, trecho)); };
      pintar();
      if (m.anexo && m.anexo.sid && !TK.urlViva(m.anexo) && m.anexo.tipo !== 'arquivo') {
        const io = new IntersectionObserver((ents) => {
          if (!ents.some((e) => e.isIntersecting)) return; io.disconnect();
          TK.urlAnexo(c.id, m.anexo).then((u) => { m.anexo.url = u; if (caixa.isConnected) pintar(); }).catch(() => {});
        });
        io.observe(caixa);
      }
      return caixa;
    }
    // ---------- (1.0.2) mídias da conversa: fotos e vídeos, áudios, links (sem GIFs) e arquivos, em grade ou lista, com páginas ----------
    function galeriaDe(c) {
      const POR = { grade: 30, lista: 15 };
      const ehGifUrl = (u) => /\.gif(\?|$)|klipy\.co|tenor\.com|giphy\.com/i.test(u);
      const itens = { midia: [], audio: [], link: [], arquivo: [] };
      let tipo = 'midia', modo = A.store.ler('aero-galeria-modo') === 'lista' ? 'lista' : 'grade', pag = 0, lendo = true;
      const corpo = h('div', { class: 'gal-corpo' }), rodape = h('div', { class: 'gal-rodape' }), estado = h('span', { class: 'peq suave' });
      const anexosDe = (m) => (m.anexos && m.anexos.length ? m.anexos : m.anexo ? [m.anexo] : []);
      const ir = async (m) => { janela.fechar(); if (atual !== c) await abrir(c); await irParaSeq(m.seq); };
      const quando = (m) => new Date(m.t).toLocaleDateString(A.idioma() === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      const urlDe = async (a) => TK.urlViva(a) || (a.url = await TK.urlAnexo(c.id, a));
      const ladrilho = (it, k, lista) => {
        const a = it.a, video = a.tipo === 'video';
        const b = h('button', { type: 'button', class: 'gal-tile' + (video ? ' video' : ''), title: a.nome || '' });
        const carregar = async () => {
          try {
            const u = await urlDe(a); if (!u) return;
            b.prepend(video ? h('video', { src: u + '#t=0.1', muted: '', preload: 'metadata', playsinline: '' }) : h('img', { src: u, alt: '', loading: 'lazy', draggable: 'false' }));
          } catch (e) { b.classList.add('falhou'); }
        };
        const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); carregar(); } }); io.observe(b);
        if (video) b.append(h('span', { class: 'gal-play' }, A.icone('play', 18)));
        b.onclick = async () => {
          const vis = lista.slice(Math.max(0, k - 40), k + 41);
          const urls = await Promise.all(vis.map((x) => urlDe(x.a).catch(() => null)));
          const gal = vis.map((x, j) => ({ url: urls[j], nome: x.a.nome, video: x.a.tipo === 'video' })).filter((x) => x.url);
          U.verImagem(urls[vis.indexOf(it)] || gal[0].url, { nome: a.nome, galeria: { itens: gal } });
        };
        b.addEventListener('contextmenu', (e) => U.menuContexto(e, [{ texto: T('Ir para a mensagem', 'Jump to message'), icone: 'responder', onclick: () => ir(it.m) }]));
        return modo === 'lista' ? h('div', { class: 'gal-linha' }, b, h('div', { class: 'cresce' }, h('b', {}, nomeDe(it.m.de)), h('div', { class: 'peq suave' }, quando(it.m) + (a.nome ? ' · ' + a.nome : ''))), U.btn('', { icone: 'responder', tipo: 'sec', redondo: true, peq: true, titulo: T('Ir para a mensagem', 'Jump to message'), onclick: () => ir(it.m) })) : b;
      };
      const linhaGeral = (it) => {
        const cab = h('div', { class: 'linha entre gal-cab-it' }, h('b', {}, nomeDe(it.m.de)), h('span', { class: 'peq suave' }, quando(it.m)));
        if (tipo === 'link') {
          let dom = ''; try { dom = new URL(it.u).hostname.replace(/^www\./, ''); } catch (e) { /* ok */ }
          return h('div', { class: 'gal-linha' }, h('span', { class: 'gal-ic' }, A.icone('link', 18)), h('div', { class: 'cresce gal-txt' }, cab, h('a', { href: it.u, onclick: (e) => { e.preventDefault(); U.abrirFora(it.u); } }, dom || it.u), h('div', { class: 'peq suave gal-url' }, it.u)), U.btn('', { icone: 'responder', tipo: 'sec', redondo: true, peq: true, titulo: T('Ir para a mensagem', 'Jump to message'), onclick: () => ir(it.m) }));
        }
        if (tipo === 'audio') return h('div', { class: 'gal-linha gal-audio' }, h('div', { class: 'cresce gal-txt' }, cab, previaMsg(c, { ...it.m, anexo: it.a, anexos: null, texto: '' }, it.a.nome || '')), U.btn('', { icone: 'responder', tipo: 'sec', redondo: true, peq: true, titulo: T('Ir para a mensagem', 'Jump to message'), onclick: () => ir(it.m) }));
        return h('div', { class: 'gal-linha' }, h('span', { class: 'gal-ic' }, A.icone('clipe', 18)), h('div', { class: 'cresce gal-txt' }, cab, h('div', { class: 'gal-url' }, it.a.nome || T('Arquivo', 'File'))),
          U.btn('', { icone: 'download', tipo: 'sec', redondo: true, peq: true, titulo: T('Baixar', 'Download'), onclick: async () => { try { U.baixar(await urlDe(it.a), it.a.nome); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } }),
          U.btn('', { icone: 'responder', tipo: 'sec', redondo: true, peq: true, titulo: T('Ir para a mensagem', 'Jump to message'), onclick: () => ir(it.m) }));
      };
      const pintar = () => {
        const lista = itens[tipo], por = tipo === 'midia' ? POR[modo] : POR.lista, total = Math.max(1, Math.ceil(lista.length / por));
        pag = Math.min(pag, total - 1);
        const fatia = lista.slice(pag * por, pag * por + por);
        corpo.className = 'gal-corpo ' + (tipo === 'midia' && modo === 'grade' ? 'grade' : 'lista');
        corpo.replaceChildren(...(fatia.length ? fatia.map((it, j) => (tipo === 'midia' ? ladrilho(it, pag * por + j, lista) : linhaGeral(it))) : [h('div', { class: 'suave peq gal-vazio' }, lendo ? T('Procurando…', 'Looking…') : T('Nada por aqui ainda.', 'Nothing here yet.'))]));
        estado.textContent = lista.length + (lendo ? '+' : '') + ' · ' + T('página ', 'page ') + (pag + 1) + '/' + total;
        const ant = U.btn(T('Anterior', 'Previous'), { icone: 'setaE', tipo: 'sec', peq: true, onclick: () => { pag--; pintar(); corpo.scrollTop = 0; } }), prox = U.btn(T('Próxima', 'Next'), { icone: 'setaD', tipo: 'sec', peq: true, onclick: () => { pag++; pintar(); corpo.scrollTop = 0; } });
        ant.disabled = pag === 0; prox.disabled = pag >= total - 1;
        rodape.replaceChildren(ant, estado, prox);
        btModo.hidden = tipo !== 'midia';
      };
      const abas = U.seg([['midia', T('Fotos e vídeos', 'Photos & videos')], ['audio', T('Áudios', 'Audio')], ['link', 'Links'], ['arquivo', T('Arquivos', 'Files')]], tipo, (v) => { tipo = v; pag = 0; pintar(); });
      abas.classList.add('quebra');
      const btModo = U.btn('', { icone: modo === 'grade' ? 'menu' : 'apps', tipo: 'sec', redondo: true, peq: true, titulo: T('Grade ou lista', 'Grid or list'), onclick: () => { modo = modo === 'grade' ? 'lista' : 'grade'; A.store.gravar('aero-galeria-modo', modo); btModo.replaceChildren(A.icone(modo === 'grade' ? 'menu' : 'apps', 18)); pag = 0; pintar(); } });
      const janela = U.modal(T('Mídias de ', 'Media in ') + TK.titulo(c), h('div', { class: 'gal' }, h('div', { class: 'gal-topo' }, abas, btModo), corpo, rodape), { largura: 760, classe: 'gal-modal' });
      pintar();
      let ult = 0;
      const aoPagina = (lote) => {
        for (let i = lote.length - 1; i >= 0; i--) {
          const m = lote[i]; if (m.sistema || m.trancada) continue;
          for (const a of anexosDe(m)) {
            if (!a) continue;
            if (a.tipo === 'imagem' || a.tipo === 'video') { if (a.mime !== 'image/gif') itens.midia.push({ m, a }); }
            else if (a.tipo === 'audio') itens.audio.push({ m, a }); else itens.arquivo.push({ m, a });
          }
          for (const u of new Set((m.texto || '').match(/\bhttps?:\/\/[^\s<>"']+/g) || [])) if (!ehGifUrl(u)) itens.link.push({ m, u });
        }
        if (Date.now() - ult > 400) { ult = Date.now(); pintar(); }
      };
      TK.todas(c, null, aoPagina, () => corpo.isConnected && itens.midia.length + itens.audio.length + itens.link.length + itens.arquivo.length < 3000)
        .catch((e) => U.toast(e.message, { tipo: 'erro' })).finally(() => { lendo = false; if (corpo.isConnected) pintar(); });
    }
    // ---------- mensagens fixadas (0.6.0) ----------
    async function verFixadas(c, ancora) {
      const corpo = h('div', { class: 'busca-corpo' }, h('p', { class: 'peq suave' }, T('Carregando...', 'Loading...')));
      const pop = U.popover(ancora, corpo, { largura: 420, titulo: T('Mensagens fixadas', 'Pinned messages') });
      const pintar = async () => {
        const seqs = c.fixadas || [];
        if (!seqs.length) { corpo.replaceChildren(h('p', { class: 'peq suave' }, T('Nenhuma mensagem fixada ainda. Clique com o botão direito numa mensagem para fixar.', 'No pinned messages yet. Right-click a message to pin it.'))); return; }
        let msgs = []; try { msgs = await TK.abrirMsgs(c, seqs); } catch (e) { corpo.replaceChildren(h('p', { class: 'msg erro' }, e.message)); return; }
        corpo.textContent = '';
        for (const m of msgs.sort((x, y) => seqs.indexOf(x.seq) - seqs.indexOf(y.seq))) {
          const prev = (m.texto || '').replace(/<@([A-Z0-9]{6})>/gi, (_, x) => '@' + nomeDe(x.toUpperCase())) || (m.anexo ? '📎 ' + m.anexo.tipo : '');
          const pv = previaMsg(c, m, prev.slice(0, 240));
          corpo.append(h('div', { class: 'busca-res' + (pv ? ' com-previa' : '') }, U.avatar(pessoaDe(m.de), 30), h('div', { class: 'cresce' }, h('button', { type: 'button', class: 'sem-botao busca-ir', title: T('Ir para a mensagem', 'Jump to message'), onclick: async () => { pop.fechar(); await irParaSeq(m.seq); } }, h('div', { class: 'linha entre' }, h('b', {}, nomeDe(m.de)), h('span', { class: 'peq suave' }, new Date(m.t).toLocaleString())), pv ? null : h('div', { class: 'busca-trecho' }, prev.slice(0, 240))), pv),
            U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Desafixar', 'Unpin'), onclick: async () => { await TK.fixar(c, m, false).catch((e) => U.toast(e.message, { tipo: 'erro' })); pintar(); } })));
        }
      };
      pintar();
    }
    // ---------- convidar para o grupo (0.6.0, como no Discord): amigos com caixinha + um link que vale 24 h ----------
    async function convidar(c) {
      const fora = H.amigos.filter((a) => a.estado === 'aceita' && !(c.membros || []).some((m) => m.codigo === a.codigo));
      const vagas = maxDe(c) - (c.membros || []).length;
      const marcados = new Set();
      const busca = h('input', { class: 'campo cresce', placeholder: T('Procurar amigos', 'Search friends') });
      const add = U.btn(T('Adicionar', 'Add'), { onclick: async () => { if (!marcados.size) return; try { await API.req(`conv/${c.id}/membros`, { codigos: [...marcados] }); A.som.tocar('sucesso'); m.fechar(); await TK.carregar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } } });
      add.disabled = true;
      const lista = h('div', { class: 'conv-lista' });
      const pintar = () => {
        const q = busca.value.trim().toLowerCase(); lista.textContent = '';
        for (const a of fora.filter((x) => !q || (x.apelido || x.nome).toLowerCase().includes(q) || (x.tag || '').toLowerCase().includes(q))) {
          const ck = h('input', { type: 'checkbox' });
          ck.checked = marcados.has(a.codigo);
          ck.addEventListener('change', () => { if (ck.checked && marcados.size >= vagas) { ck.checked = false; U.toast(T('O grupo não tem mais vagas.', 'The group has no more room.')); return; } if (ck.checked) marcados.add(a.codigo); else marcados.delete(a.codigo); add.disabled = !marcados.size; A.som.tocar('bolha'); });
          lista.append(h('label', { class: 'conv-item' }, U.avatar(a, 36, U.estadoDe(a.codigo)), h('div', { class: 'cresce' }, h('b', {}, a.apelido || a.nome), h('div', { class: 'peq suave' }, '#' + (a.tag || ''))), ck));
        }
        if (!lista.children.length) lista.append(h('p', { class: 'peq suave' }, fora.length ? T('Ninguém com esse nome.', 'Nobody with that name.') : T('Todos os seus amigos já estão no grupo.', 'All your friends are already in the group.')));
      };
      busca.addEventListener('input', pintar); busca.addEventListener('keydown', (e) => e.stopPropagation());
      const linkCampo = h('input', { class: 'campo cresce', readonly: true, value: T('Gerando link...', 'Creating link...') });
      const copiar = U.btn(T('Copiar', 'Copy'), { peq: true, onclick: (e) => U.copiar(linkCampo.value, e.currentTarget) });
      const corpo = [h('div', { class: 'peq suave' }, vagas > 0 ? T('Você pode adicionar mais ', 'You can add ') + vagas + T(' pessoa(s).', ' more people.') : T('O grupo está cheio.', 'The group is full.')),
        h('div', { class: 'linha' }, busca, add), lista,
        h('div', { class: 'rot' }, T('Ou envie um link de convite', 'Or send an invite link')), h('div', { class: 'linha' }, linkCampo, copiar), h('div', { class: 'peq suave' }, T('O link vence em 24 horas.', 'The link expires in 24 hours.'))];
      const m = U.modal(T('Convidar para ', 'Invite to ') + c.nome, corpo, { largura: 480 });
      pintar(); setTimeout(() => busca.focus(), 80);
      try { const r = await API.req(`conv/${c.id}/convite`, {}); linkCampo.value = TK.linkConvite(r.codigo); } catch (e) { linkCampo.value = e.message; copiar.disabled = true; }
    }
    async function escolherAmigo() {
      const amigos = H.amigos.filter((a) => a.estado === 'aceita');
      if (!amigos.length) { U.toast(T('Adicione um amigo primeiro (aba Amigos).', 'Add a friend first (Friends tab).')); return; }
      // (0.8.5) com muitos amigos a grade passava da tela: busca em cima e uma área de rolagem com no máximo 3 fileiras visíveis
      const grade = h('div', { class: 'tk-escolher' });
      const busca = h('input', { class: 'campo tk-escolher-busca', type: 'search', placeholder: T('Procurar amigo', 'Search friends'), 'aria-label': T('Procurar amigo', 'Search friends') });
      const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const ordem = amigos.slice().sort((a, b) => (H.online(b.codigo) ? 1 : 0) - (H.online(a.codigo) ? 1 : 0) || norm(a.apelido || a.nome).localeCompare(norm(b.apelido || b.nome)));
      const m = U.modal(T('Conversar com...', 'Chat with...'), [busca, grade], { largura: 520 });
      const ir = async (a) => { m.fechar(); try { abrir(await TK.abrirDM(a.codigo)); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
      let achados = ordem;
      const pintar = () => {
        const q = norm(busca.value.trim());
        achados = q ? ordem.filter((a) => norm([a.apelido, a.nome, a.tag ? '#' + a.tag : ''].join(' ')).includes(q)) : ordem;
        grade.textContent = ''; grade.scrollTop = 0;
        achados.forEach((a) => grade.append(h('button', { type: 'button', class: 'tk-pessoa', title: a.apelido || a.nome, onclick: () => ir(a) }, U.avatar(a, 54, H.online(a.codigo) ? 'online' : 'offline'), h('b', {}, a.apelido || a.nome))));
        if (!achados.length) grade.append(h('p', { class: 'peq suave tk-escolher-vazio' }, T('Nenhum amigo com esse nome.', 'No friend with that name.')));
      };
      busca.addEventListener('input', pintar);
      busca.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && achados[0]) ir(achados[0]); else if (e.key === 'Escape') m.fechar(); });
      pintar(); if (document.documentElement.dataset.entrada !== 'pad') setTimeout(() => busca.focus({ preventScroll: true }), 80);
    }
    async function criarGrupo(pre) {
      const amigos = H.amigos.filter((a) => a.estado === 'aceita');
      const nome = h('input', { class: 'campo', placeholder: T('Nome do grupo', 'Group name'), maxlength: 40 });
      const marcados = new Set(Array.isArray(pre) ? pre : []);
      const grade = h('div', { class: 'tk-escolher' }, ...amigos.map((a) => { const b = h('button', { type: 'button', class: 'tk-pessoa' + (marcados.has(a.codigo) ? ' sel' : ''), 'aria-pressed': String(marcados.has(a.codigo)), onclick: () => { const on = !marcados.has(a.codigo); if (on && marcados.size >= maxDe() - 1) { U.toast(T('Grupos têm no máximo ', 'Groups have at most ') + maxDe() + T(' pessoas (você e mais ', ' people (you and ') + (maxDe() - 1) + T('). Para mais gente, crie uma sala!', ' more). For more people, create a room!')); return; } if (on) marcados.add(a.codigo); else marcados.delete(a.codigo); b.setAttribute('aria-pressed', on); b.classList.toggle('sel', on); A.som.tocar('bolha'); } }, U.avatar(a, 48), h('b', {}, a.apelido || a.nome)); return b; }));
      U.modal(T('Novo grupo', 'New group'), [h('label', { class: 'rot' }, T('Nome', 'Name')), nome, h('label', { class: 'rot', estilo: { 'margin-top': '12px' } }, T('Quem entra (só amigos seus, até 9)', 'Who joins (your friends only, up to 9)')), grade], {
        largura: 560, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Criar grupo', 'Create group'), valor: true }],
        aoFechar: async (v) => { if (!v) return; try { abrir(await TK.criarGrupo(nome.value.trim() || T('Grupo', 'Group'), [...marcados])); A.som.tocar('sucesso'); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } },
      });
      setTimeout(() => nome.focus(), 200);
    }
    function configGrupo(c) {
      const pode = c.meuPapel === 'dono' || c.meuPapel === 'admin', dono = c.meuPapel === 'dono';
      const corpo = h('div', { class: 'col', estilo: { gap: '10px' } });
      const agir = async (f) => { try { const r = await f(); if (r && r.id) { Object.assign(c, r); } await TK.carregar(); m.fechar(); configGrupo(TK.conversas.find((x) => x.id === c.id) || c); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
      if (pode) { const nm = h('input', { class: 'campo', value: c.nome, maxlength: 40 }); nm.value = c.nome; corpo.append(h('label', { class: 'rot' }, T('Nome do grupo', 'Group name')), h('div', { class: 'linha' }, nm, U.btn(T('Salvar', 'Save'), { peq: true, onclick: () => agir(() => API.req(`conv/${c.id}/config`, { nome: nm.value })) }))); }
      { // (0.8.7) o banner do grupo no topo, com a foto por cima; dono e admin trocam os dois (imagem ou GIF)
        const subir = (rota, max, f) => (async () => {
          try {
            if (f) f = await U.encolher(f, max * 1048576); // (0.9.4) acima do limite: reduz a qualidade até caber
            if (f && f.size > max * 1048576) throw new Error(T('Imagem grande demais (máximo ', 'Image too large (max ') + max + ' MB).');
            const r = await fetch(`${API.servidor}/api/conv/${c.id}/${rota}`, { method: 'POST', headers: { Authorization: 'Bearer ' + API.token, 'Content-Type': (f && f.type) || 'image/png' }, body: f || new Uint8Array(0) });
            const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || T('Não consegui enviar a imagem.', 'Could not upload the image.'));
            A.som.tocar('sucesso'); agir(async () => ({}));
          } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
        })();
        const arqF = h('input', { type: 'file', accept: 'image/*', hidden: true }), arqB = h('input', { type: 'file', accept: 'image/*', hidden: true });
        arqF.addEventListener('change', () => { const f = arqF.files[0]; arqF.value = ''; if (f) subir('foto', 20, f); });
        arqB.addEventListener('change', () => { const f = arqB.files[0]; arqB.value = ''; if (f) subir('banner', 20, f); });
        const bn = TK.urlBannerGrupo(c);
        const capa = h('div', { class: 'tk-gr-capa' + (bn ? '' : ' vazia'), estilo: bn ? { 'background-image': `url("${bn}")` } : {} },
          pode ? h('div', { class: 'tk-gr-capa-bt' }, U.btn(bn ? T('Trocar banner', 'Change banner') : T('Pôr banner', 'Add banner'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => arqB.click() }), bn ? U.btn(T('Tirar', 'Remove'), { tipo: 'sec', peq: true, onclick: () => subir('banner', 20, null) }) : null) : null);
        const foto = h('div', { class: 'tk-gr-foto' }, TK.avatarGrupo(c, 72), pode ? h('button', { type: 'button', class: 'tk-gr-foto-bt', title: T('Trocar foto do grupo', 'Change group photo'), 'aria-label': T('Trocar foto do grupo', 'Change group photo'), onclick: () => arqF.click() }, A.icone('camera', 16)) : null);
        corpo.prepend(h('div', { class: 'tk-gr-topo' }, capa, foto, arqF, arqB));
      }
      corpo.append(h('div', { class: 'rot' }, T('Pessoas', 'People')));
      const papelTxt = { dono: T('dono', 'owner'), admin: 'admin', membro: T('membro', 'member') };
      (c.membros || []).forEach((p) => {
        const souEu = API.eu && p.codigo === API.eu.codigo;
        const botoes = [];
        if (!souEu && p.papel !== 'dono') {
          if (dono) botoes.push(U.btn(p.papel === 'admin' ? T('Tirar admin', 'Remove admin') : T('Tornar admin', 'Make admin'), { tipo: 'sec', peq: true, onclick: () => agir(() => API.req(`conv/${c.id}/membro`, { codigo: p.codigo, acao: p.papel === 'admin' ? 'membro' : 'admin' })) }));
          if (dono || (c.meuPapel === 'admin' && p.papel === 'membro')) {
            botoes.push(U.btn(p.semChamada ? T('Liberar chamadas', 'Allow calls') : T('Bloquear chamadas', 'Block calls'), { tipo: 'sec', peq: true, onclick: () => agir(() => API.req(`conv/${c.id}/membro`, { codigo: p.codigo, acao: p.semChamada ? 'comChamada' : 'semChamada' })) }));
            botoes.push(U.btn(T('Remover', 'Remove'), { tipo: 'perigo', peq: true, onclick: async () => { if (await U.confirmar(T('Remover ', 'Remove ') + (p.apelido || p.nome) + T(' do grupo?', ' from the group?'), { perigo: true })) agir(() => API.req(`conv/${c.id}/membro`, { codigo: p.codigo, acao: 'remover' })); } }));
          }
        }
        corpo.append(h('div', { class: 'tk-membro' }, U.avatar(p, 40, H.online(p.codigo) ? 'online' : 'offline'), h('div', { class: 'cresce' }, h('b', {}, p.apelido || p.nome), h('div', { class: 'peq suave' }, papelTxt[p.papel] + (p.semChamada ? ' · ' + T('sem chamadas', 'no calls') : ''))), h('div', { class: 'linha', estilo: { 'flex-wrap': 'wrap', 'justify-content': 'flex-end' } }, ...botoes)));
      });
      if (pode) {
        const fora = H.amigos.filter((a) => a.estado === 'aceita' && !(c.membros || []).some((m) => m.codigo === a.codigo));
        if ((c.membros || []).length >= maxDe(c)) corpo.append(h('div', { class: 'peq suave' }, T('O grupo está cheio (', 'The group is full (') + maxDe(c) + T(' pessoas). Para mais gente, crie uma sala e convide!', ' people). For more people, create a room and invite!')));
        else if (fora.length) {
          const sel = h('select', { class: 'campo', 'aria-label': T('Adicionar amigo', 'Add friend') }, h('option', { value: '' }, T('Adicionar um amigo...', 'Add a friend...')), ...fora.map((a) => h('option', { value: a.codigo }, a.apelido || a.nome)));
          corpo.append(h('div', { class: 'linha' }, sel, U.btn(T('Adicionar', 'Add'), { peq: true, icone: 'mais', onclick: () => sel.value && agir(() => API.req(`conv/${c.id}/membros`, { codigos: [sel.value] })) })));
        }
      }
      corpo.append(h('div', { class: 'linha', estilo: { 'justify-content': 'flex-end', 'margin-top': '6px' } }, U.btn(T('Sair do grupo', 'Leave group'), { tipo: 'perigo', icone: 'sair', onclick: async () => { if (await U.confirmar(T('Sair de ', 'Leave ') + c.nome + '?', { perigo: true })) { await API.req(`conv/${c.id}/sair`, {}); m.fechar(); await TK.carregar(); fecharConversa(); } } })));
      const m = U.modal(c.nome, corpo, { largura: 560 });
    }

    // ---------- ao vivo ----------
    // (0.8.3) a lista é refeita no máximo uma vez por quadro: antes cada recibo, presença ou mensagem refazia a lista na hora (dezenas de
    // vezes por segundo numa conversa movimentada, travando a rolagem e a digitação)
    let listaPedida = 0;
    const pedirLista = () => { if (modo !== 'conversas' || listaPedida) return; listaPedida = requestAnimationFrame(() => { listaPedida = 0; if (modo === 'conversas') pintarLista(); }); };
    ouvir('talk:lista', pedirLista);
    ouvir('talk:recibos', pedirLista); // (0.8.3) os vistos da lista mudam a cada recibo
    // a chave da conta mudou: reabre a conversa (as mensagens que não abriam podem abrir agora). A mesma chave de antes não refaz nada
    // (refazia a conversa inteira, com a animação, logo depois de entrar no Aero Talk)
    let kidAberto = null;
    ouvir('cripto:estado', () => { pintarAviso(); if (atual && A.cripto.kid && A.cripto.kid !== kidAberto) abrir(atual); }); pintarAviso();
    ouvir('hub:digitando', (e) => { if (atual && atual.id === e.cid && cx) cx.digitando(nomeDe(e.de) || e.nome, e.dg); });
    ouvir('talk:msg', ({ cid, msg }) => { if (atual && atual.id === cid && cx) { cx.parouDeDigitar(nomeDe(msg.de)); TK.lembrar(cid, msg); cx.adicionar(msg); if (TK._carregarAnexo) TK._carregarAnexo(msg); } });
    ouvir('talk:reacao', ({ cid, seq, rea, sup }) => { if (atual && atual.id === cid && cx) { cx.atualizar({ id: seq, rea }); if (sup && cx.superReacao) cx.superReacao(seq, sup); } });
    ouvir('talk:editada', ({ cid, msg }) => { if (atual && atual.id === cid && cx) { cx.atualizar(msg); if (TK._carregarAnexo) TK._carregarAnexo(msg); } });
    ouvir('talk:apagada', ({ cid, seq }) => { if (atual && atual.id === cid && cx) cx.remover(seq); });
    ouvir('talk:abrir', (cid) => { const c = TK.conversas.find((x) => x.id === cid); if (c) { modo = 'conversas'; seg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === 0)); pintarLado(); abrir(c); } });
    ouvir('talk:fechar', fecharConversa);
    ouvir('hub:presenca', pedirLista); ouvir('hub:offline', pedirLista);
    ouvir('hub:amigos', pedirLista); // nome, apelido ou foto de alguém mudou: só o item dele é trocado, sem animar
    pintarLado();
    TK.carregar().then(() => {
      const cid = typeof sub === 'string' && sub.startsWith('c:') ? sub.slice(2) : !sub ? A.store.ler('aero-talk-ultima', '') : '';
      const c = cid && TK.conversas.find((x) => x.id === cid);
      if (c && !atual) abrir(c);
    }).catch((e) => U.toast(e.message, { tipo: 'erro' }));
    // (0.8.7) a aba do Aero Talk fica guardada (escondida) quando você vai para outra aba: voltar não remonta nada. Escondida, ela conta
    // como fechada (não marca como lida, a notificação toca e a janelinha da chamada volta)
    let guardada = null;
    // (0.8.7) no jeito "Bolha do perfil", a lista de conversas fica na coluna da esquerda, embaixo da bolha (como as sub-abas das
    // Configurações): a bolha e a coluna não saem do lugar ao entrar no Aero Talk, e o resto da interface não se mexe. Com a lista
    // arrumada em outro lado (direita, cima, baixo ou recolhida) fica do jeito de antes
    const rz = document.documentElement;
    // (0.9.2) em qualquer lado: a coluna (ou a faixa, em cima/embaixo) da bolha acompanha o lado da lista, e a bolha nunca entra na lista
    const ladoNaColuna = () => !!(ctx.lateralNaBolha && ctx.lateralNaBolha()) && rz.dataset.arRecLado !== '1';
    // (0.8.7) a bolha do perfil pode estar dentro da lista (lista à direita): ao levar a lista para a coluna, a bolha volta para o lugar
    // dela logo em seguida (senão as duas iam juntas para a coluna, que fica escondida com a bolha dentro da lista, e a lista sumia da tela).
    // Montando ainda fora da tela, tenta de novo no quadro seguinte
    let tentativas = 0;
    const encaixarLado = () => {
      if (guardada) return;
      if (!raiz.isConnected) { if (tentativas++ < 30) requestAnimationFrame(encaixarLado); return; }
      tentativas = 0;
      if (ladoNaColuna()) {
        if (lado.parentNode === raiz || !lado.parentNode) ctx.lateral(lado);
        raiz.classList.add('lado-fora');
      } else { if (lado.parentNode !== raiz) { raiz.prepend(lado); ctx.lateral(null); } raiz.classList.remove('lado-fora'); }
      if (ctx.reposicionar) ctx.reposicionar();
    };
    encaixarLado();
    ouvir('arranjo', () => encaixarLado());
    const vendoAntes = TK.vendo;
    TK.vendo = (cid) => !guardada && !!vendoAntes && vendoAntes(cid);
    return {
      limpar() { offs.forEach((f) => f()); if (limparAmigos) limparAmigos(); TK.aberta = null; TK.vendo = null; },
      pausar() {
        guardada = { lista: lista.scrollTop, cx: cx && cx.lista ? cx.lista.scrollTop : 0, fundo: !!(cx && cx.noFundo && cx.noFundo()) };
        TK.aberta = null;
      },
      retomar(sub2) {
        const g = guardada; guardada = null;
        encaixarLado();
        if (atual) TK.aberta = atual.id;
        if (g) { lista.scrollTop = g.lista; if (cx && cx.lista) cx.lista.scrollTop = g.fundo ? cx.lista.scrollHeight : g.cx; }
        if (A.chamada && A.chamada.ajustarJanela) A.chamada.ajustarJanela();
        if (typeof sub2 === 'string' && sub2.startsWith('c:')) A.evt.emit('talk:abrir', sub2.slice(2));
        setTimeout(lerSeVendo, 150);
      },
    };
  };
})();
