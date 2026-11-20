// Aero - (1.0.0) SKINS (.aer): um arquivo que muda a cara do app inteiro de quem instalou (só dele; os outros não veem nada).
// O .aer é um zip com: manifesto.json, skin.css (com as MESMAS travas das integrações), camadas.json (as camadas do Estúdio),
// imagens (recodificadas aqui), fontes (.woff2) e sons. NUNCA código: nada aqui roda script de ninguém.
// As regras do formato são as mesmas do servidor (servidor/src/aer.js); os testes conferem que as duas listas batem.
// Modo seguro: Ctrl+Alt+Shift+S (o mesmo das integrações) volta ao Aero clássico; se o app fechar logo depois de aplicar uma skin,
// ela não volta na próxima abertura. O botão "Voltar ao Aero clássico" fica sempre na aba Skins.
(() => {
  'use strict';
  const A = window.Aero, T = A.T, h = A.h;
  const S = (A.aer = {});

  // ---------- as regras do formato (iguais às do servidor) ----------
  const R = (S.REGRAS = {
    formato: 1,
    maxArquivos: 200, maxTotal: 30 * 1048576, maxCss: 60000, maxManifesto: 16384, maxCamadas: 32768,
    caminhos: [
      [/^manifesto\.json$/, 'manifesto', 16384],
      [/^skin\.css$/, 'css', 60000],
      [/^camadas\.json$/, 'camadas', 32768],
      [/^imagens\/[a-z0-9_-]{1,40}\.(png|jpe?g|webp|gif)$/, 'imagem', 3 * 1048576],
      [/^fontes\/[a-z0-9_-]{1,40}\.woff2$/, 'fonte', 1048576],
      [/^fontes\/[a-z0-9_-]{1,40}\.(ttf|otf)$/, 'fonte', 4 * 1048576], // as fontes instaladas no PC (só as que a licença deixa embutir)
      [/^sons\/[a-z0-9_-]{1,40}\.(ogg|mp3|wav)$/, 'som', 1048576],
    ],
    // os sons do app que uma skin pode trocar
    sons: ['click', 'hover', 'foco', 'menu-item', 'sucesso', 'erro', 'bolha', 'abrir', 'pop-abrir', 'msg', 'estourar', 'grudar', 'chamada-entrada', 'cham-entrou', 'cham-entrei', 'tk-passar', 'tk-dm', 'tk-grupo', 'menu-abrir', 'menu-fechar', 'pop-fechar', 'fechar'],
  });
  const assinatura = {
    imagem: (b, nome) => (/\.png$/.test(nome) ? ini(b, [0x89, 0x50, 0x4e, 0x47]) : /\.jpe?g$/.test(nome) ? ini(b, [0xff, 0xd8, 0xff]) : /\.gif$/.test(nome) ? ini(b, [0x47, 0x49, 0x46, 0x38]) : ini(b, [0x52, 0x49, 0x46, 0x46]) && txt4(b, 8) === 'WEBP'),
    fonte: (b, nome) => (/\.woff2$/.test(nome) ? txt4(b, 0) === 'wOF2' : (/\.otf$/.test(nome) ? txt4(b, 0) === 'OTTO' : ini(b, [0, 1, 0, 0]) || txt4(b, 0) === 'true') && S.podeEmbutir(b) === true),
    som: (b, nome) => (/\.ogg$/.test(nome) ? txt4(b, 0) === 'OggS' : /\.wav$/.test(nome) ? txt4(b, 0) === 'RIFF' && txt4(b, 8) === 'WAVE' : txt4(b, 0).startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)),
  };
  // a licença da fonte (TTF/OTF): o campo fsType da tabela OS/2. "Restrita" (2) não pode ir dentro de um arquivo; sem a tabela, também não.
  // Devolve true, ou o motivo (texto) de não poder.
  S.podeEmbutir = (b) => {
    try {
      if (!b || b.length < 12) return T('Fonte inválida.', 'Invalid font.');
      if (txt4(b, 0) === 'ttcf') return T('Coleções de fontes (.ttc) não podem ser usadas.', 'Font collections (.ttc) cannot be used.');
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), n = dv.getUint16(4);
      if (n < 1 || n > 200 || 12 + n * 16 > b.length) return T('Fonte inválida.', 'Invalid font.');
      for (let i = 0; i < n; i++) {
        const r0 = 12 + i * 16; if (txt4(b, r0) !== 'OS/2') continue;
        const o = dv.getUint32(r0 + 8); if (o + 10 > b.length) return T('Fonte inválida.', 'Invalid font.');
        const fs = dv.getUint16(o + 8);
        if ((fs & 0x000f) === 0x0002) return T('A licença desta fonte não deixa ela ir junto num arquivo.', 'This font\'s license does not allow embedding it in a file.');
        if (fs & 0x0200) return T('A licença desta fonte só deixa embutir como imagem.', 'This font\'s license only allows bitmap embedding.');
        return true;
      }
      return T('Esta fonte não diz se pode ser embutida.', 'This font does not say whether it can be embedded.');
    } catch (e) { return T('Fonte inválida.', 'Invalid font.'); }
  };
  function ini(b, l) { return l.every((x, i) => b[i] === x); }
  function txt4(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }
  const limpa = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const num = (v, a, z, pad) => (Number.isFinite(+v) ? Math.max(a, Math.min(z, +v)) : pad);
  const HEX = /^#[0-9a-f]{6}$/i;

  // ---------- o zip (só "guardado" e "deflate"; nada de pastas fora, nem nomes estranhos, nem bomba de zip) ----------
  S.lerZip = async (buf) => {
    const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b.length < 22 || b.length > R.maxTotal) throw new Error(T('Arquivo grande demais ou vazio.', 'File too large or empty.'));
    let fim = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    if (fim < 0) throw new Error(T('Não é um arquivo .aer.', 'Not an .aer file.'));
    const n = dv.getUint16(fim + 10, true); let p = dv.getUint32(fim + 16, true);
    if (n > R.maxArquivos) throw new Error(T('Arquivos demais dentro da skin.', 'Too many files inside the skin.'));
    const out = new Map(); let total = 0;
    for (let k = 0; k < n; k++) {
      if (p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error(T('Arquivo .aer quebrado.', 'Broken .aer file.'));
      const metodo = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true), tam = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
      const nome = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
      if (nome.endsWith('/')) continue; // pasta
      if (/\.\.|\\|^\/|[\u0000-\u001f]/.test(nome)) throw new Error(T('Nome de arquivo não permitido: ', 'File name not allowed: ') + limpa(nome, 40));
      const regra = R.caminhos.find(([re]) => re.test(nome));
      if (!regra) throw new Error(T('Arquivo não permitido dentro da skin: ', 'File not allowed inside the skin: ') + limpa(nome, 40));
      if (tam > regra[2]) throw new Error(T('Arquivo grande demais: ', 'File too large: ') + nome);
      total += tam; if (total > R.maxTotal) throw new Error(T('A skin passa de 30 MB.', 'The skin is over 30 MB.'));
      if (loc + 30 > b.length || dv.getUint32(loc, true) !== 0x04034b50) throw new Error(T('Arquivo .aer quebrado.', 'Broken .aer file.'));
      const ini2 = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true), dados = b.subarray(ini2, ini2 + comp);
      let bytes;
      if (metodo === 0) bytes = dados.slice();
      else if (metodo === 8) bytes = await inflar(dados, regra[2]);
      else throw new Error(T('Compressão não suportada.', 'Unsupported compression.'));
      if (bytes.length !== tam) throw new Error(T('Arquivo .aer quebrado.', 'Broken .aer file.'));
      out.set(nome, { tipo: regra[1], bytes });
    }
    return out;
  };
  async function inflar(dados, max) {
    const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(dados).catch(() => {}); w.close().catch(() => {});
    const r = ds.readable.getReader(), partes = []; let n = 0;
    for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > max) { r.cancel().catch(() => {}); throw new Error(T('Arquivo grande demais dentro da skin.', 'File too large inside the skin.')); } partes.push(value); }
    const o = new Uint8Array(n); let i = 0; for (const x of partes) { o.set(x, i); i += x.length; } return o;
  }

  // ---------- montar um .aer (o Estúdio): zip "guardado" (sem compressão), com o CRC32 de cada arquivo ----------
  const TAB_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  S.crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TAB_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  S.criarZip = (lista) => { // lista: [[nome, Uint8Array], ...]
    const enc = new TextEncoder(), locais = [], centrais = []; let p = 0;
    for (const [nome, bytes] of lista) {
      const nb = enc.encode(nome), crc = S.crc32(bytes), l = new Uint8Array(30 + nb.length), dl = new DataView(l.buffer);
      dl.setUint32(0, 0x04034b50, true); dl.setUint16(4, 20, true); dl.setUint16(6, 0x0800, true); dl.setUint16(8, 0, true); dl.setUint16(10, 0, true); dl.setUint16(12, 0x21, true);
      dl.setUint32(14, crc, true); dl.setUint32(18, bytes.length, true); dl.setUint32(22, bytes.length, true); dl.setUint16(26, nb.length, true); l.set(nb, 30);
      const c = new Uint8Array(46 + nb.length), dc = new DataView(c.buffer);
      dc.setUint32(0, 0x02014b50, true); dc.setUint16(4, 20, true); dc.setUint16(6, 20, true); dc.setUint16(8, 0x0800, true); dc.setUint16(14, 0x21, true);
      dc.setUint32(16, crc, true); dc.setUint32(20, bytes.length, true); dc.setUint32(24, bytes.length, true); dc.setUint16(28, nb.length, true); dc.setUint32(42, p, true); c.set(nb, 46);
      locais.push(l, bytes); centrais.push(c); p += l.length + bytes.length;
    }
    const tamC = centrais.reduce((a, x) => a + x.length, 0), fim = new Uint8Array(22), df = new DataView(fim.buffer);
    df.setUint32(0, 0x06054b50, true); df.setUint16(8, lista.length, true); df.setUint16(10, lista.length, true); df.setUint32(12, tamC, true); df.setUint32(16, p, true);
    return new Blob([...locais, ...centrais, fim], { type: 'application/x-aero-skin' });
  };

  // ---------- o manifesto e as camadas ----------
  S.lerManifesto = (j, arquivos) => {
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error(T('manifesto.json inválido.', 'Invalid manifesto.json.'));
    if (+j.formato !== R.formato) throw new Error(T('Esta skin é de outra versão do formato .aer.', 'This skin uses another .aer format version.'));
    const id = String(j.id || '').toLowerCase();
    if (!/^[a-z0-9-]{3,32}$/.test(id)) throw new Error(T('O id da skin deve ter de 3 a 32 letras, números ou traços.', 'The skin id must have 3 to 32 letters, numbers or dashes.'));
    const nome = limpa(j.nome, 40); if (!nome) throw new Error(T('A skin precisa de um nome.', 'The skin needs a name.'));
    const tem = (c) => typeof c === 'string' && arquivos.has(c);
    const sons = {}; if (j.sons && typeof j.sons === 'object') for (const [k, v] of Object.entries(j.sons)) if (R.sons.includes(k) && tem(v) && /^sons\//.test(v)) sons[k] = v;
    const fontes = {}; if (j.fontes && typeof j.fontes === 'object') for (const [k, v] of Object.entries(j.fontes).slice(0, 8)) if (/^[A-Za-z0-9 _-]{1,30}$/.test(k) && tem(v) && /^fontes\//.test(v)) fontes[k] = v;
    return { formato: 1, id, nome, autor: limpa(j.autor, 40), versao: limpa(j.versao, 12) || '1', descricao: limpa(j.descricao, 600), sons, fontes };
  };
  // as camadas do Estúdio: só números, cores, textos curtos e nomes de imagem da própria skin
  const ANIM_LETRA = ['', 'onda', 'pulo', 'brilho', 'arcoiris', 'tremer', 'surgir'];
  // (1.0.0) a animação de entrada (e a mesma ao contrário na saída) dos elementos da tela de ligação
  S.ANIM_LIG = [['', 'Nenhuma', 'None'], ['fade', 'Aparecer (fade)', 'Fade'], ['glitch', 'Glitch', 'Glitch'], ['deslizar', 'Deslizar', 'Slide'], ['zoom', 'Zoom', 'Zoom'], ['pulo', 'Pulo', 'Bounce'],
    ['girar', 'Girar', 'Spin'], ['piscar', 'Piscar (neon)', 'Flicker (neon)'], ['cortina', 'Cortina', 'Wipe']];
  const ANIM_LIG = S.ANIM_LIG.map((x) => x[0]);
  S.lerCamadas = (j, arquivos) => {
    const o = {}; if (!j || typeof j !== 'object') return o;
    const img = (v) => (typeof v === 'string' && /^imagens\//.test(v) && arquivos.has(v) ? v : '');
    const cor = (v) => (HEX.test(v || '') ? v.toLowerCase() : '');
    // (1.0.0) a tela de ligação: o aviso continua onde sempre esteve; o que muda é DENTRO dele (botões no lugar escolhido, imagens, animação)
    if (j.ligacao && typeof j.ligacao === 'object') {
      const x = j.ligacao, pos = (q, dx, dy) => ({ x: num(q && q.x, 4, 96, dx), y: num(q && q.y, 6, 94, dy) });
      o.ligacao = { largura: num(x.largura, 300, 640, 460), raio: num(x.raio, 0, 40, 22), opacidade: num(x.opacidade, 0.5, 1, 1), fundo: img(x.fundo), cor: cor(x.cor), atender: cor(x.atender), recusar: cor(x.recusar), botoes: num(x.botoes, 36, 72, 48),
        livre: !!x.livre, altura: Math.round(num(x.altura, 96, 360, 150)), posAtender: pos(x.posAtender, 86, 50), posRecusar: pos(x.posRecusar, 70, 50), anim: ANIM_LIG.includes(x.anim) ? x.anim : '',
        nome: x.nome && x.sub && typeof x.nome === 'object' && typeof x.sub === 'object' ? { x: num(x.nome.x, 0, 92, 30), y: num(x.nome.y, 6, 94, 40) } : null,
        sub: x.nome && x.sub && typeof x.nome === 'object' && typeof x.sub === 'object' ? { x: num(x.sub.x, 0, 92, 30), y: num(x.sub.y, 6, 94, 60) } : null,
        onda: x.onda !== false, ondaCor: cor(x.ondaCor),
        foto: x.foto && typeof x.foto === 'object' ? { x: num(x.foto.x, 2, 98, 11.3), y: num(x.foto.y, 4, 96, 50), tam: Math.round(num(x.foto.tam, 32, 160, 64)), forma: x.foto.forma === 'quadrado' ? 'quadrado' : 'circulo' } : null,
        imagens: (Array.isArray(x.imagens) ? x.imagens.slice(0, 6) : []).map((i) => (i && typeof i === 'object' ? { src: img(i.src), x: num(i.x, 0, 100, 50), y: num(i.y, 0, 100, 50), w: num(i.w, 4, 100, 20), r: num(i.r, -180, 180, 0), p: num(i.p, 0.05, 20, 1), frente: !!i.frente } : null)).filter((i) => i && i.src) };
    }
    if (j.boasvindas && typeof j.boasvindas === 'object') { const x = j.boasvindas; o.boasvindas = { titulo: limpa(x.titulo, 60), texto: limpa(x.texto, 200), fundo: img(x.fundo), cor: cor(x.cor) }; }
    if (j.letras && typeof j.letras === 'object') o.letras = { anim: ANIM_LETRA.includes(j.letras.anim) ? j.letras.anim : '', titulos: !!j.letras.titulos, nomes: !!j.letras.nomes };
    if (j.regioes && typeof j.regioes === 'object') o.regioes = { lista: j.regioes.lista === 'direita' ? 'direita' : 'esquerda', abas: j.regioes.abas === 'baixo' ? 'baixo' : 'topo', compacto: !!j.regioes.compacto };
    if (j.icones && typeof j.icones === 'object') { o.icones = {}; for (const [k, v] of Object.entries(j.icones).slice(0, 40)) if (/^[a-zA-Z]{2,24}$/.test(k) && img(v)) o.icones[k] = img(v); }
    if (j.cores && typeof j.cores === 'object') { o.cores = {}; for (const k of ['cor', 'cor2', 'cor3', 'texto', 'fundo1', 'fundo2']) if (cor(j.cores[k])) o.cores[k] = cor(j.cores[k]); }
    return o;
  };

  // ---------- abrir um .aer: confere tudo e devolve o pacote pronto para guardar ----------
  const recodificar = (S.recodificar = async (bytes, nome) => {
    if (/\.gif$/.test(nome)) return new Blob([bytes], { type: 'image/gif' }); // o GIF fica (anima), mas só depois de conferir a assinatura
    const bm = await createImageBitmap(new Blob([bytes]));
    const lado = Math.min(1, 4096 / Math.max(bm.width, bm.height)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bm.width * lado)); cv.height = Math.max(1, Math.round(bm.height * lado));
    cv.getContext('2d').drawImage(bm, 0, 0, cv.width, cv.height); bm.close && bm.close();
    return await new Promise((ok) => cv.toBlob((x) => ok(x), 'image/webp', 0.92)); // desenhada de novo: nada escondido dentro da imagem passa
  });
  S.abrir = async (buf) => {
    const arqs = await S.lerZip(buf);
    const man = arqs.get('manifesto.json'); if (!man) throw new Error(T('Falta o manifesto.json.', 'manifesto.json is missing.'));
    let j; try { j = JSON.parse(new TextDecoder().decode(man.bytes)); } catch (e) { throw new Error(T('manifesto.json inválido.', 'Invalid manifesto.json.')); }
    const manifesto = S.lerManifesto(j, arqs);
    let camadas = {};
    if (arqs.get('camadas.json')) { try { camadas = S.lerCamadas(JSON.parse(new TextDecoder().decode(arqs.get('camadas.json').bytes)), arqs); } catch (e) { throw new Error(T('camadas.json inválido.', 'Invalid camadas.json.')); } }
    const cssBruto = arqs.get('skin.css') ? new TextDecoder().decode(arqs.get('skin.css').bytes).slice(0, R.maxCss) : '';
    const san = cssBruto && A.integ ? A.integ.sanitizar(cssBruto, 'aer-' + manifesto.id) : { css: '', kfs: '', tirados: [] };
    const arquivos = {};
    for (const [nome, x] of arqs) {
      if (x.tipo === 'manifesto' || x.tipo === 'css' || x.tipo === 'camadas') continue;
      if (!assinatura[x.tipo](x.bytes, nome)) throw new Error(T('Este arquivo não é o que diz ser: ', 'This file is not what it claims: ') + nome);
      arquivos[nome] = x.tipo === 'imagem' ? await recodificar(x.bytes, nome) : new Blob([x.bytes], { type: x.tipo === 'fonte' ? 'font/' + nome.split('.').pop() : 'audio/' + (nome.split('.').pop() === 'mp3' ? 'mpeg' : nome.split('.').pop()) });
    }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (x) => x.toString(16).padStart(2, '0')).join('');
    return { manifesto, camadas, css: cssBruto, tirados: san.tirados || [], arquivos, hash, em: Date.now() };
  };

  // ---------- guardadas neste aparelho ----------
  const idb = () => new Promise((ok, falha) => { const r = indexedDB.open('aero-skins', 1); r.onupgradeneeded = () => r.result.createObjectStore('skins'); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
  const fazer = async (modo, f) => { const db = await idb(); return new Promise((ok, falha) => { const tx = db.transaction('skins', modo), st = tx.objectStore('skins'), r = f(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => falha(tx.error); }); };
  S.lista = async () => { try { return (await fazer('readonly', (st) => st.getAll())) || []; } catch (e) { return []; } };
  S.ler = async (id) => { try { return await fazer('readonly', (st) => st.get(id)); } catch (e) { return null; } };
  S.guardar = (p) => fazer('readwrite', (st) => st.put(p, p.manifesto.id));
  S.apagar = async (id) => { await fazer('readwrite', (st) => st.delete(id)); if (A.cfg.v.skin === id) S.usar(''); A.evt.emit('aer:mudou'); };

  // ---------- aplicar ----------
  let caixaEstilo = null, urls = [], fontes = [], tVigia = 0, coresPostas = [];
  const raiz = document.body;
  function limpar() {
    if (caixaEstilo) caixaEstilo.textContent = '';
    for (const u of urls) URL.revokeObjectURL(u); urls = [];
    for (const f of fontes) { try { document.fonts.delete(f); } catch (e) { /* ok */ } } fontes = [];
    for (const k of [...raiz.style]) if (k.startsWith('--aer-')) raiz.style.removeProperty(k);
    for (const k of coresPostas) raiz.style.removeProperty(k); coresPostas = [];
    for (const k of Object.keys(raiz.dataset)) if (k.startsWith('aer')) delete raiz.dataset[k];
    if (A.som && A.som.limparSkin) A.som.limparSkin();
    S.atual = null; clearInterval(tVigia); tVigia = 0;
  }
  const url = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
  const nomeVar = (c) => c.replace(/^imagens\//, '').replace(/\.[a-z0-9]+$/, '');
  S.aplicar = async (p) => {
    limpar();
    if (!p) return;
    const m = p.manifesto, cam = p.camadas || {};
    if (!caixaEstilo) { caixaEstilo = h('style', { dados: { aer: '1' } }); document.head.append(caixaEstilo); }
    // as imagens viram variáveis (--aer-img-<nome>); o CSS da skin usa var(--aer-img-fundo) e nunca um url() próprio
    for (const [c, blob] of Object.entries(p.arquivos || {})) if (/^imagens\//.test(c)) raiz.style.setProperty('--aer-img-' + nomeVar(c), `url("${url(blob)}")`);
    for (const [fam, c] of Object.entries(m.fontes || {})) { try { const f = new FontFace('aer-' + fam, await p.arquivos[c].arrayBuffer()); await f.load(); document.fonts.add(f); fontes.push(f); } catch (e) { A.log.aviso('skin: fonte ' + fam, e); } }
    // os sons: tocam no lugar dos do app (o volume e o "sons desligados" continuam valendo)
    if (A.som && A.som.trocar && Object.keys(m.sons || {}).length) {
      for (const [nome, c] of Object.entries(m.sons)) {
        let buf = null; const blob = p.arquivos[c];
        A.som.trocar('aer:' + nome, (bus, t, args) => {
          const taxas = args && Array.isArray(args.taxas) && args.taxas.length ? args.taxas.slice(0, 4) : [1]; // (1.0.0) o mesmo arquivo em outro tom (veja som.js)
          const tocar = (ab) => taxas.forEach((x, i) => { const s = bus.c.createBufferSource(); s.buffer = ab; s.playbackRate.value = x; s.connect(bus.mestre); s.start(Math.max(t, bus.c.currentTime) + i * 0.06); });
          if (buf) tocar(buf); else blob.arrayBuffer().then((x) => bus.c.decodeAudioData(x)).then((ab) => { buf = ab; tocar(ab); }).catch(() => {});
        });
      }
    }
    // as camadas do Estúdio: variáveis e atributos no <body> que o CSS do próprio app (bloco das skins no app.css) entende
    const L = cam.ligacao; if (L) {
      raiz.dataset.aerLigacao = '1';
      const v = { largura: L.largura + 'px', raio: L.raio + 'px', opacidade: L.opacidade, botoes: L.botoes + 'px', altura: L.altura + 'px', ax: L.posAtender.x + '%', ay: L.posAtender.y + '%', rx: L.posRecusar.x + '%', ry: L.posRecusar.y + '%' };
      if (L.livre) raiz.dataset.aerLigLivre = '1';
      // (0.9.6) a foto de quem liga: lugar, tamanho e formato escolhidos no Estúdio; o nome vem logo depois dela
      if (L.livre && L.foto) { raiz.dataset.aerLigFoto = L.foto.forma; Object.assign(v, { fx: L.foto.x + '%', fy: L.foto.y + '%', ft: S.tamFoto(L) + 'px', recuo: S.recuoNome(L) + 'px', fim: S.fimNome(L) + 'px' }); }
      if (L.livre && L.nome && L.sub) { raiz.dataset.aerLigTexto = '1'; Object.assign(v, { nx: L.nome.x + '%', ny: L.nome.y + '%', sx: L.sub.x + '%', sy: L.sub.y + '%' }); } // (1.0.0) o nome e o "Chamada de voz…" no lugar escolhido
      if (L.onda === false) raiz.dataset.aerLigOnda = 'nao'; else if (L.ondaCor) raiz.style.setProperty('--aer-lig-onda', L.ondaCor); // (1.0.0) as ondas da foto: sem ou de outra cor
      if (L.anim) raiz.dataset.aerLigAnim = L.anim;
      for (const [k, x] of Object.entries(v)) raiz.style.setProperty('--aer-lig-' + k, x);
      if (L.cor) raiz.style.setProperty('--aer-lig-cor', L.cor); if (L.atender) raiz.style.setProperty('--aer-lig-atender', L.atender); if (L.recusar) raiz.style.setProperty('--aer-lig-recusar', L.recusar);
      if (L.fundo) raiz.style.setProperty('--aer-lig-fundo', `var(--aer-img-${nomeVar(L.fundo)})`);
    }
    if (cam.letras && cam.letras.anim) { raiz.dataset.aerLetras = cam.letras.anim; if (cam.letras.titulos) raiz.dataset.aerLetrasTitulos = '1'; if (cam.letras.nomes) raiz.dataset.aerLetrasNomes = '1'; }
    if (cam.regioes) { raiz.dataset.aerLista = cam.regioes.lista; raiz.dataset.aerAbas = cam.regioes.abas; if (cam.regioes.compacto) raiz.dataset.aerCompacto = '1'; }
    // as cores da skin entram por cima das da Aparência só enquanto ela está em uso (saem no limpar)
    if (cam.cores) {
      const VAR = { cor: '--cor', cor2: '--cor-2', cor3: '--cor-3', texto: '--texto' }, por = (k, v) => { raiz.style.setProperty(k, v); coresPostas.push(k); };
      for (const [k, c] of Object.entries(cam.cores)) { raiz.style.setProperty('--aer-' + k, c); if (VAR[k]) por(VAR[k], c); }
      if (cam.cores.cor) { por('--btn-2', cam.cores.cor); por('--amb-cor', cam.cores.cor); }
      if (cam.cores.cor2) por('--btn-1', cam.cores.cor2); if (cam.cores.cor3) por('--btn-3', cam.cores.cor3);
      if (cam.cores.fundo1 || cam.cores.fundo2) { const a = cam.cores.fundo1 || cam.cores.fundo2, b = cam.cores.fundo2 || a; por('--fundo-css', `linear-gradient(160deg, ${a} 0%, ${b} 100%)`); por('--bg-1', a); por('--bg-2', b); }
    }
    if (cam.icones) for (const [k, c] of Object.entries(cam.icones)) raiz.style.setProperty('--aer-ic-' + k, `var(--aer-img-${nomeVar(c)})`);
    if (cam.boasvindas && (cam.boasvindas.titulo || cam.boasvindas.fundo)) raiz.dataset.aerBoasvindas = '1';
    caixaEstilo.textContent = p.css && A.integ ? A.integ.escopado(p.css, 'aer-' + m.id) : '';
    S.atual = p; raiz.dataset.aer = m.id;
    vigiar();
  };
  // (1.0.0) a tela de ligação da skin: as imagens dentro do aviso e a ordem da animação (chamada.js chama ao montar o aviso). Só números e
  // nomes de imagem da própria skin (as imagens entram pelas variáveis, nunca por um endereço)
  S.vestirLigacao = (el) => {
    const L = S.atual && S.atual.camadas && S.atual.camadas.ligacao; if (!el || !L) return;
    let i = 0; const ordem = (x) => { if (x) x.style.setProperty('--aer-i', i++); };
    for (const im of L.imagens || []) {
      const larg = im.w;
      el.append(h('div', { class: 'aer-lig-img' + (im.frente ? ' frente' : ''), 'aria-hidden': 'true', estilo: { left: im.x + '%', top: im.y + '%', width: larg + '%', '--aer-r': im.r + 'deg' } },
        h('i', { estilo: { 'padding-top': (im.p * 100) + '%', 'background-image': `var(--aer-img-${nomeVar(im.src)})` } })));
    }
    ordem(el.querySelector(':scope > .cham-toque-av')); ordem(el.querySelector(':scope > .cresce'));
    el.querySelectorAll(':scope > .aer-lig-img > i').forEach(ordem);
    el.querySelectorAll('.cham-toque-botoes .btn').forEach(ordem);
  };
  // (0.9.6) quanto o nome anda para a direita para não ficar embaixo da foto: só quando a foto está na metade esquerda e na mesma altura do nome
  S.tamFoto = (L) => Math.max(32, Math.min(L.foto.tam, (L.altura || 150) - 16)); // nunca maior que o cartão
  S.recuoNome = (L) => { const f = L && L.foto; if (!f) return 64 + 16; const larg = L.largura || 460, alt = L.altura || 150, cx = (f.x / 100) * larg, cy = (f.y / 100) * alt, t = S.tamFoto(L);
    if (f.x > 50 || Math.abs(cy - alt / 2) > t / 2 + 14) return 0; return Math.max(0, Math.round(cx + t / 2 + 14 - 20)); };
  // (0.9.6) onde o nome tem que parar para não entrar embaixo dos botões que estão na mesma altura dele (o de vídeo fica à esquerda do atender)
  S.fimNome = (L) => { if (!L || !L.livre) return 0; const larg = L.largura || 460, alt = L.altura || 150, b = L.botoes || 48; let ini = larg;
    for (const [p, extra] of [[L.posRecusar, 0], [L.posAtender, b + 10]]) if (p && Math.abs((p.y / 100) * alt - alt / 2) < b / 2 + 14) ini = Math.min(ini, (p.x / 100) * larg - b / 2 - extra);
    return ini >= larg ? 0 : Math.max(0, Math.round(larg - ini + 10 - 20)); };
  S.tempoSaidaLigacao = () => (raiz.dataset.aerLigAnim ? 560 : 380);
  // a vigia das partes protegidas (a mesma das integrações): a skin escondeu uma? volta ao clássico
  function vigiar() {
    clearInterval(tVigia); if (!caixaEstilo || !caixaEstilo.textContent || !A.integ || !A.integ.escondida) return;
    // (1.0.2) com a janela escondida (abriu na bandeja, minimizada) ou no meio de uma animação, tudo parece "escondido": a skin só sai se
    // a trava pegar duas vezes seguidas com a janela à vista (antes ela desligava sozinha ao reiniciar o app no Windows)
    let suspeitas = 0;
    tVigia = setInterval(() => {
      if (document.hidden || innerWidth < 120 || innerHeight < 120) { suspeitas = 0; return; }
      const susp = [...document.querySelectorAll('[data-protegido]')].filter(A.integ.escondida); if (!susp.length) { suspeitas = 0; return; }
      caixaEstilo.disabled = true; const foi = susp.some((el) => !A.integ.escondida(el)); caixaEstilo.disabled = false;
      if (!foi) { suspeitas = 0; return; }
      if (++suspeitas < 2) return;
      A.log.aviso('skin desligada pela trava: ' + (S.atual && S.atual.manifesto.id)); S.usar('');
    }, 3000);
  }
  // usar uma skin (id) ou voltar ao clássico ('')
  S.usar = async (id) => {
    A.cfg.v.skin = id || ''; A.cfg.salvar();
    if (!id) { limpar(); A.evt.emit('aer:mudou'); return; }
    const p = await S.ler(id); if (!p) { A.cfg.v.skin = ''; A.cfg.salvar(); limpar(); A.evt.emit('aer:mudou'); return; }
    // modo seguro: se o app não passar de 10 s com a skin, na próxima abertura ela não volta
    A.store.gravar('aer-testando', id); setTimeout(() => A.store.gravar('aer-testando', ''), 10000);
    await S.aplicar(p); A.evt.emit('aer:mudou');
  };
  S.classico = () => S.usar('');

  // ---------- importar (arquivo escolhido, arrastado, aberto pelo sistema) ----------
  S.verificar = async (hash) => { try { const r = await A.api.req('aer/verificar/' + hash); return r && r.ok ? r : null; } catch (e) { return null; } };
  S.importar = async (buf, nomeArq) => {
    const U = A.ui;
    let p; try { p = await S.abrir(buf); } catch (e) { U.toast(e.message || String(e), { tipo: 'erro' }); return null; }
    const ver = A.api && A.api.token ? await S.verificar(p.hash) : null;
    p.verificado = !!ver; if (ver && ver.loja) p.loja = ver.loja;
    const m = p.manifesto, c = p.camadas, partes = [];
    if (p.css) partes.push(T('Visual (CSS)', 'Look (CSS)'));
    if (Object.keys(m.sons).length) partes.push(T('Sons', 'Sounds'));
    if (Object.keys(m.fontes).length) partes.push(T('Fontes', 'Fonts'));
    if (c.ligacao) partes.push(T('Aviso de ligação', 'Call popup'));
    if (c.boasvindas) partes.push(T('Tela de boas-vindas', 'Welcome screen'));
    if (c.letras) partes.push(T('Animação das letras', 'Letter animation'));
    if (c.regioes) partes.push(T('Lugar das partes do app', 'Layout'));
    if (c.icones) partes.push(T('Ícones', 'Icons'));
    return new Promise((ok) => {
      U.modal(T('Instalar skin', 'Install skin'), h('div', { class: 'col aer-instalar', estilo: { gap: '8px' }, dados: { protegido: '1' } },
        h('b', {}, m.nome), h('div', { class: 'suave peq' }, (m.autor ? T('por ', 'by ') + m.autor + ' · ' : '') + 'v' + m.versao + (nomeArq ? ' · ' + limpa(nomeArq, 40) : '')),
        m.descricao ? h('p', { class: 'peq', estilo: { margin: 0 } }, m.descricao) : null,
        h('div', { class: 'peq' }, T('Muda: ', 'Changes: ') + (partes.join(', ') || T('nada', 'nothing'))),
        h('div', { class: 'peq ' + (p.verificado ? 'aer-ok' : 'aer-nao') }, p.verificado ? T('✔ Verificada pelo Aero (publicada na loja).', '✔ Verified by Aero (published in the store).') : T('Não verificada: veio de fora da loja. Ela passa pelas travas do Aero (sem código, sem links, sem esconder as partes de segurança), mas só instale de quem você confia.', 'Not verified: it came from outside the store. It goes through Aero\'s locks (no code, no links, no hiding safety parts), but only install from people you trust.')),
        p.tirados.length ? h('div', { class: 'peq suave' }, T('Partes tiradas pelas travas: ', 'Parts removed by the locks: ') + p.tirados.slice(0, 6).join(', ') + (p.tirados.length > 6 ? '…' : '')) : null,
        h('div', { class: 'peq suave' }, T('Só muda o SEU app. Para voltar: Configurações > Skins > Voltar ao Aero clássico, ou Ctrl+Alt+Shift+S.', 'It only changes YOUR app. To go back: Settings > Skins > Back to classic Aero, or Ctrl+Alt+Shift+S.'))),
      { largura: 460, acoes: [{ texto: T('Cancelar', 'Cancel'), tipo: 'sec', valor: false }, { texto: T('Instalar e usar', 'Install and use'), valor: true }], aoFechar: async (v) => {
        if (!v) { ok(null); return; }
        try { await S.guardar(p); await S.usar(m.id); A.som.tocar('bolha-cresce'); ok(p); } catch (e) { U.toast(T('Não consegui guardar a skin.', 'Could not save the skin.'), { tipo: 'erro' }); ok(null); }
      } });
    });
  };
  S.exportar = async (p) => {
    if (!p || !p.bruto) return;
    const nome = (String(p.manifesto.nome || 'skin').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'skin') + '.aer';
    const u = URL.createObjectURL(p.bruto instanceof Blob ? p.bruto : new Blob([p.bruto], { type: 'application/x-aero-skin' }));
    try { await A.ui.baixar(u, nome); } catch (e) { A.ui.toast(T('Não consegui exportar a skin.', 'Could not export the skin.'), { tipo: 'erro' }); }
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  };
  S.escolherArquivo = () => { const i = h('input', { type: 'file', accept: '.aer,application/x-aero-skin,application/zip' }); i.onchange = async () => { const f = i.files[0]; if (f) S.importar(await f.arrayBuffer(), f.name); }; i.click(); };
  // aberto pelo sistema (duplo clique no .aer no Windows/Linux, "Abrir com" no Android)
  if (window.aero && window.aero.aoAbrirAer) window.aero.aoAbrirAer((d) => { if (d && d.bytes) S.importar(d.bytes, d.nome); });
  addEventListener('aero-abrir-aer', (e) => { // a ponte do Android (o arquivo chega em base64)
    const d = e.detail; if (!d || typeof d.b64 !== 'string' || d.b64.length > 42 * 1048576 || !/^[A-Za-z0-9+/=]*$/.test(d.b64)) return;
    const bin = atob(d.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    S.importar(u.buffer, String(d.nome || '').slice(0, 80));
  });

  // ---------- a aba Skins (Configurações) ----------
  S.secao = () => {
    const caixa = h('div', { class: 'col aer-secao', estilo: { gap: '10px' } });
    let loja = null; // a vitrine da loja não recarrega a cada mudança da lista de cima
    const pintar = async () => {
      const l = await S.lista(), atual = A.cfg.v.skin || '';
      caixa.replaceChildren(
        h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('Uma skin muda a cara do app inteiro (cores, fundo, fontes, sons, o aviso de ligação...). Só muda o seu app: os outros continuam vendo o deles.', 'A skin changes the whole app (colors, background, fonts, sounds, call popup...). Only your app changes: others keep seeing theirs.')),
        h('div', { class: 'linha', estilo: { gap: '8px', 'flex-wrap': 'wrap' } },
          A.ui.btn(T('Abrir arquivo .aer', 'Open .aer file'), { icone: 'pasta', tipo: 'sec', peq: true, onclick: S.escolherArquivo }),
          A.estudio && A.estudio.abrirSkins ? A.ui.btn(T('Criar no Estúdio', 'Create in Studio'), { icone: 'lapis', tipo: 'sec', peq: true, onclick: () => A.estudio.abrirSkins() }) : null,
          A.ui.btn(T('Voltar ao Aero clássico', 'Back to classic Aero'), { icone: 'atualizar', tipo: atual ? 'ok' : 'sec', peq: true, onclick: () => { S.classico(); A.som.tocar('bolha-estoura'); } })),
        l.length ? h('div', { class: 'aer-lista' }, ...l.sort((a, b) => b.em - a.em).map((p) => h('div', { class: 'aer-item' + (p.manifesto.id === atual ? ' sel' : '') },
          h('div', { class: 'cresce' }, h('b', {}, p.manifesto.nome), h('div', { class: 'peq suave' }, (p.manifesto.autor ? p.manifesto.autor + ' · ' : '') + 'v' + p.manifesto.versao + (p.verificado ? T(' · verificada', ' · verified') : ''))),
          // (1.0.0) exportar o .aer das skins que você fez no Estúdio (as da loja não: são de quem comprou)
          p.bruto ? A.ui.btn('', { icone: 'download', tipo: 'sec', peq: true, redondo: true, titulo: T('Exportar .aer', 'Export .aer'), onclick: () => S.exportar(p) }) : null,
          p.bruto && S.loja ? A.ui.btn('', { icone: 'subir', tipo: 'sec', peq: true, redondo: true, titulo: T('Publicar na loja', 'Publish in the store'), onclick: () => S.loja.publicar(p.manifesto.id) }) : null,
          p.doEstudio && A.estudio && A.estudio.abrirSkins ? A.ui.btn('', { icone: 'lapis', tipo: 'sec', peq: true, redondo: true, titulo: T('Editar no Estúdio', 'Edit in Studio'), onclick: () => A.estudio.abrirSkins(p.manifesto.id) }) : null,
          p.manifesto.id === atual ? h('span', { class: 'peq' }, T('Em uso', 'In use')) : A.ui.btn(T('Usar', 'Use'), { tipo: 'sec', peq: true, onclick: () => S.usar(p.manifesto.id) }),
          A.ui.btn('', { icone: 'lixo', tipo: 'perigo', peq: true, redondo: true, titulo: T('Apagar', 'Delete'), onclick: () => S.apagar(p.manifesto.id) })))) : h('div', { class: 'peq suave' }, T('Nenhuma skin instalada.', 'No skins installed.')),
        S.loja ? h('h4', { class: 'est-sub' }, T('Loja de skins', 'Skin store')) : null,
        S.loja ? (loja || (loja = S.loja.secao())) : null,
        h('div', { class: 'peq suave' }, T('Se uma skin deixar o app difícil de usar: Ctrl+Alt+Shift+S volta ao clássico na hora. Se o app fechar logo depois de aplicar uma skin, ela não volta na próxima abertura.', 'If a skin makes the app hard to use: Ctrl+Alt+Shift+S goes back to classic right away. If the app closes right after applying a skin, it will not come back next time.')));
    };
    pintar();
    const off = A.evt.on('aer:mudou', () => { if (!caixa.isConnected) { off && off(); return; } pintar(); });
    return caixa;
  };

  // a tela de boas-vindas da skin: aparece um instante ao abrir o app (some sozinha ou com um clique; nunca fica por cima de nada)
  S.boasVindas = (p, previa) => {
    const b = p && p.camadas && p.camadas.boasvindas; if (!b || (!b.titulo && !b.fundo && !b.texto)) return;
    if (!previa && (A.cfg.v.visual === 'lite' || document.documentElement.dataset.anim === 'nenhuma')) return;
    const img = b.fundo && p.arquivos[b.fundo] ? URL.createObjectURL(p.arquivos[b.fundo]) : '';
    const el = h('div', { class: 'aer-boasvindas', role: 'presentation', estilo: { ...(img ? { 'background-image': `url("${img}")` } : {}), ...(b.cor ? { '--aer-bv-cor': b.cor } : {}) } },
      h('div', { class: 'aer-bv-caixa' }, b.titulo ? h('h1', {}, b.titulo) : null, b.texto ? h('p', {}, b.texto) : null));
    let foi = false; const sair = () => { if (foi) return; foi = true; el.classList.add('saindo'); setTimeout(() => { el.remove(); if (img) URL.revokeObjectURL(img); }, 500); };
    el.addEventListener('pointerdown', sair); document.addEventListener('keydown', sair, { once: true, capture: true });
    (previa || document.body).append(el); setTimeout(sair, previa ? 2600 : 2200);
  };

  // ---------- ao abrir o app ----------
  addEventListener('keydown', (e) => { if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'S' || e.key === 's') && A.cfg.v.skin) S.classico(); }, true);
  // (1.0.2) fechar o app normalmente (sair, reiniciar para atualizar) logo depois de abrir não conta como "a skin travou o app"
  addEventListener('pagehide', () => { try { A.store.gravar('aer-testando', ''); } catch (_) { /* ok */ } });
  (async () => {
    try {
      const falhou = A.store.ler('aer-testando', '');
      if (falhou) { A.store.gravar('aer-testando', ''); if (A.cfg.v.skin === falhou) { A.log.aviso('skin não voltou (o app fechou logo depois de aplicar): ' + falhou); A.cfg.v.skin = ''; A.cfg.salvar(); } }
      if (A.cfg.v.skin) { const p = await S.ler(A.cfg.v.skin); if (p) { A.store.gravar('aer-testando', A.cfg.v.skin); setTimeout(() => A.store.gravar('aer-testando', ''), 10000); await S.aplicar(p); S.boasVindas(p); } else { A.cfg.v.skin = ''; A.cfg.salvar(); } }
    } catch (e) { A.log.erro('skin', e); }
  })();
})();
