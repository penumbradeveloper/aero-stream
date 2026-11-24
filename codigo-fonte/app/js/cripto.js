// Aero Stream - criptografia do Aero Talk, POR CONTA (só WebCrypto do próprio navegador; nada de biblioteca de fora).
//  0.5.9-3: a criptografia é um processo interno do app, sem nada para a pessoa controlar. O pacote com as chaves da conta fica também no
//  servidor, cifrado pela chave secreta dele, e é entregue a qualquer sessão logada nessa conta (código de acesso ou e-mail): quem entra na
//  conta lê TODAS as mensagens, em qualquer aparelho, sem digitar nada. Quem está de fora (ou copia o banco de dados) não lê.
//  Contas antigas migram sozinhas: o primeiro aparelho que já tem a chave aberta manda o pacote. Sem nenhum jeito de abrir a chave antiga,
//  a conta ganha uma chave nova sozinha e o histórico volta pelos outros membros de cada conversa (re-compartilhamento "R.").
//  (Texto antigo, ainda válido para o resto:)
//  - O CÓDIGO DE ACESSO (AERO-XXXX-XXXX-XXXX) nunca sai do aparelho. Dele saem duas chaves (PBKDF2, 310 mil voltas, sais diferentes):
//      "acesso" (o servidor guarda só o hash dela: serve para entrar) e "cofre" (abre a chave da conta).
//  - A conta tem UM par de chaves ECDH P-256. A parte privada fica no servidor só dentro do cofre, cifrada pela chave "cofre":
//    qualquer aparelho em que você entrar com o seu código abre o cofre e lê TODAS as conversas. Sem o código, ninguém abre
//    (nem o servidor, nem quem copiar o banco de dados).
//  - Esqueceu o código? O e-mail da conta confirma quem é você e um código novo é criado: as conversas continuam. Não existe senha.
//  - Cada mensagem é cifrada com uma chave AES-GCM nova, embrulhada para a chave da conta de cada participante.
//  - Anexos: chave própria (AES-GCM), que vai DENTRO da mensagem cifrada.
//  - Mensagens de antes da 0.5.5 (cifradas para aparelhos): se este aparelho ainda tiver a chave antiga dele, abre essas mensagens uma
//    vez, re-embrulha para a chave da conta ("migração") e depois apaga a chave do aparelho. Não existe mais chave por aparelho.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, T = A.T;
  const C = (A.cripto = { pronto: false, kid: '', precisaCodigo: false, esperando: false, legado: false });
  const sub = () => crypto.subtle;
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const deb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const ALG = { name: 'ECDH', namedCurve: 'P-256' };
  const VOLTAS = 310000;
  const idDe = async (pub) => hex(await sub().digest('SHA-256', new TextEncoder().encode(pub.x + '.' + pub.y))).slice(0, 16);
  const pubDe = (jwk) => ({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y });
  const aes = async (chave, dados, iv) => new Uint8Array(await sub().encrypt({ name: 'AES-GCM', iv }, chave, dados));
  const desaes = async (chave, dados, iv) => new Uint8Array(await sub().decrypt({ name: 'AES-GCM', iv }, chave, dados));
  C.idDe = idDe;

  // ---------- o código de acesso ----------
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I (não confunde)
  C.gerarCodigo = () => { const r = crypto.getRandomValues(new Uint8Array(12)); const s = Array.from(r, (b) => LETRAS[b & 31]).join(''); return `AERO-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`; };
  // (0.9.6) dá para digitar só as 12 letras, sem o "AERO" e sem os traços (com espaço, minúscula, tudo junto): vira o mesmo código
  // (1.0.2) o "AERO" é só o começo: o que conta são as letras depois dele (12 nos códigos de hoje, 8 nos das contas de antes da 0.5.7).
  // Como o "O" nunca sai no sorteio, um "AERO" no começo é sempre o prefixo (digitado ou não, até repetido): vira sempre "AERO" + as letras
  C.letras = (cod) => { let n = String(cod || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); while (n.startsWith('AERO')) n = n.slice(4); return n; };
  C.normalizar = (cod) => { const n = C.letras(cod); return n ? 'AERO' + n : ''; };
  const pbkdf2 = async (texto, sal, bits = 256) => {
    const base = await sub().importKey('raw', new TextEncoder().encode(texto), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await sub().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: typeof sal === 'string' ? new TextEncoder().encode(sal) : sal, iterations: VOLTAS }, base, bits));
  };
  const chaveAes = (bytes) => sub().importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const cacheDeriv = new Map();
  // do código: "acesso" (hex, vai para o servidor) e "kek" (abre o cofre; nunca sai daqui)
  C.derivar = async (codigo, { bruto = false } = {}) => {
    const n = bruto ? String(codigo) : C.normalizar(codigo);
    if (cacheDeriv.has(n)) return cacheDeriv.get(n);
    const [a, k] = await Promise.all([pbkdf2(n, 'aero-stream/acesso/v1'), pbkdf2(n, 'aero-stream/cofre/v1')]);
    const r = { acesso: hex(a), kek: await chaveAes(k) };
    cacheDeriv.set(n, r); return r;
  };

  // (0.9.6) a senha (opção no lugar do código): vira o "acesso" com o sal da conta; a senha mesmo nunca sai do aparelho
  C.derivarSenha = async (senha, sal) => hex(await pbkdf2(String(senha || '').normalize('NFC'), 'aero-stream/senha/v1/' + sal));

  // ---------- IndexedDB: a chave da conta já aberta fica neste aparelho (não precisa digitar o código toda vez) ----------
  const db = () => new Promise((ok, falha) => { const r = indexedDB.open('aero-cripto', 1); r.onupgradeneeded = () => r.result.createObjectStore('chaves'); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
  const ler = async (k) => { const d = await db(); return new Promise((ok, falha) => { const t = d.transaction('chaves').objectStore('chaves').get(k); t.onsuccess = () => ok(t.result); t.onerror = () => falha(t.error); }); };
  const gravar = async (k, v) => { const d = await db(); return new Promise((ok, falha) => { const t = d.transaction('chaves', 'readwrite'); t.objectStore('chaves').put(v, k); t.oncomplete = () => ok(); t.onerror = () => falha(t.error); }); };
  const apagar = async (k) => { const d = await db(); return new Promise((ok) => { const t = d.transaction('chaves', 'readwrite'); t.objectStore('chaves').delete(k); t.oncomplete = () => ok(); t.onerror = () => ok(); }); };

  let conta = null; // { codigo, atual: kid, chaves: { kid: { priv, pub } } }
  let legado = null; // chave de APARELHO de versões antigas (só para migrar mensagens velhas; depois é apagada)
  const minhaConta = () => (conta && conta.atual && conta.chaves[conta.atual]) || null;
  const salvarConta = () => gravar('conta:' + conta.codigo, conta);

  // o cofre: TODAS as chaves da conta (a atual e as antigas), cifradas
  async function pacote() {
    const chaves = [];
    for (const [kid, c] of Object.entries(conta.chaves)) { const j = await sub().exportKey('jwk', c.priv); chaves.push({ kid, x: j.x, y: j.y, d: j.d }); }
    return new TextEncoder().encode(JSON.stringify({ atual: conta.atual, chaves }));
  }
  const fechar = async (kek, bytes) => { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv: b64(iv), ct: b64(await aes(kek, bytes, iv)) }; };
  // abre um cofre e devolve { atual, chaves: { kid: { priv, pub } } } (ou lança erro se a chave estiver errada)
  async function abrirCofre(kek, w) {
    const p = JSON.parse(new TextDecoder().decode(await desaes(kek, deb64(w.ct), deb64(w.iv))));
    const chaves = {};
    for (const x of p.chaves || []) {
      const pub = pubDe(x); if ((await idDe(pub)) !== x.kid) continue;
      chaves[x.kid] = { pub, priv: await sub().importKey('jwk', { kty: 'EC', crv: 'P-256', x: x.x, y: x.y, d: x.d, ext: true }, ALG, true, ['deriveKey']) };
    }
    return { atual: p.atual, chaves };
  }
  async function novaChave() {
    const par = await sub().generateKey(ALG, true, ['deriveKey']);
    const pub = pubDe(await sub().exportKey('jwk', par.publicKey));
    return { kid: await idDe(pub), pub, priv: par.privateKey };
  }

  const pacoteTexto = async () => new TextDecoder().decode(await pacote());
  // o pacote que o servidor devolve (texto JSON com as chaves da conta) -> { atual, chaves }
  async function abrirPacote(texto) {
    const p = JSON.parse(texto), chaves = {};
    for (const x of p.chaves || []) {
      const pub = pubDe(x); if ((await idDe(pub)) !== x.kid) continue;
      chaves[x.kid] = { pub, priv: await sub().importKey('jwk', { kty: 'EC', crv: 'P-256', x: x.x, y: x.y, d: x.d, ext: true }, ALG, true, ['deriveKey']) };
    }
    return { atual: p.atual, chaves };
  }

  // Para criar conta (e "esqueci o código" de conta antiga sem pacote no servidor): monta tudo no aparelho
  C.prepararConta = async () => {
    const codigo = C.gerarCodigo(), { acesso, kek } = await C.derivar(codigo);
    const k = await novaChave();
    conta = { codigo: '', atual: k.kid, chaves: { [k.kid]: { priv: k.priv, pub: k.pub } } };
    const bytes = await pacote(), cofre = { kid: k.kid, pub: k.pub, w1: await fechar(kek, bytes), pacote: new TextDecoder().decode(bytes) };
    return { codigo, acesso, cofre };
  };
  // "esqueci o código" com o pacote no servidor: só um código de acesso novo; a chave (e as conversas) continuam
  C.novoAcesso = async () => { const codigo = C.gerarCodigo(), { acesso } = await C.derivar(codigo); return { codigo, acesso }; };
  // depois de entrar/criar/recuperar: guarda a chave aberta neste aparelho
  C.guardarConta = async (codigoAmigo) => { if (conta) { conta.codigo = codigoAmigo; await salvarConta(); } };

  // ---------- ao abrir o app: acerta a chave da conta (sem perguntar nada para a pessoa) ----------
  let iniciando = null;
  C.iniciar = () => (iniciando = iniciando || iniciar0().finally(() => { iniciando = null; }));
  async function iniciar0() {
    if (!window.crypto || !crypto.subtle || !window.indexedDB) throw new Error(T('Este navegador não tem criptografia (use HTTPS ou o app).', 'This browser has no cryptography (use HTTPS or the app).'));
    const codigoAmigo = A.api.eu && A.api.eu.codigo; if (!codigoAmigo) return;
    if (!conta || conta.codigo !== codigoAmigo) conta = (await ler('conta:' + codigoAmigo).catch(() => null)) || { codigo: codigoAmigo, atual: '', chaves: {} };
    legado = await ler('eu').catch(() => null); if (legado && !legado.priv) legado = null;
    const cf = await A.api.req('cofre');
    // 1) o servidor entrega as chaves da conta (o caminho normal desde a 0.5.9-3)
    if (cf.pacote) { try { const p = await abrirPacote(cf.pacote); Object.assign(conta.chaves, p.chaves); } catch (e) { A.log.aviso('cripto pacote', e); } }
    let subir = !cf.pacote; // o servidor ainda não tem o pacote (conta antiga): este aparelho manda, se conseguir abrir a chave
    const codigo = A.api.codigoAcesso();
    const kek = codigo ? (await C.derivar(codigo).catch(() => null) || {}).kek : null;
    if (!cf.kid) { // conta ainda sem chave: este aparelho cria
      const k = await novaChave();
      conta.chaves[k.kid] = { priv: k.priv, pub: k.pub }; conta.atual = k.kid;
      const env = { kid: k.kid, pub: k.pub, pacote: await pacoteTexto() }; if (kek) env.w1 = await fechar(kek, await pacote());
      try { await A.api.req('cofre', env); subir = false; }
      catch (e) { if (e.status === 409) { delete conta.chaves[k.kid]; conta.atual = ''; return iniciar0(); } throw e; }
    } else if (!conta.chaves[cf.kid] && cf.w1 && kek) { // 2) conta antiga: abre o cofre pelo código de acesso guardado aqui
      try { const p = await abrirCofre(kek, cf.w1); Object.assign(conta.chaves, p.chaves); } catch (e) { /* código trocado em outro aparelho */ }
    }
    if (cf.kid && conta.chaves[cf.kid]) {
      conta.atual = cf.kid;
      if (subir) { try { await A.api.req('cofre', { pacote: await pacoteTexto(), ...(kek && !cf.w1 ? { w1: await fechar(kek, await pacote()) } : {}) }); } catch (e) { A.log.aviso('cripto subir', e); } }
    } else if (cf.kid) { // 3) ninguém consegue abrir a chave antiga: chave nova, automática (o histórico volta pelos outros membros)
      const k = await novaChave();
      conta.chaves[k.kid] = { priv: k.priv, pub: k.pub }; conta.atual = k.kid;
      const env = { kid: k.kid, pub: k.pub, pacote: await pacoteTexto(), novaChave: true }; if (kek) env.w1 = await fechar(kek, await pacote());
      try { await A.api.req('cofre', env); A.log.info('cripto: chave nova da conta (a antiga não abria)'); }
      catch (e) { delete conta.chaves[k.kid]; conta.atual = ''; A.log.aviso('cripto chave nova', e); }
    }
    C.precisaCodigo = false; C.esperando = false;
    C.kid = conta.chaves[conta.atual] ? conta.atual : '';
    if (!C.kid) conta.atual = '';
    await salvarConta();
    C.legado = !!(legado && C.kid);
    C.pronto = true;
    A.evt.emit('cripto:estado');
    if (C.kid) setTimeout(() => A.evt.emit('cripto:migrar'), 1500);
    return C.kid;
  }
  // o código digitado agora (aparelho que não tinha o código guardado, ou o código foi trocado em outro aparelho)
  C.desbloquear = async (codigo) => {
    const { kek } = await C.derivar(codigo);
    const cf = await A.api.req('cofre');
    if (!cf.w1) throw new Error(T('A conta ainda não tem cofre.', 'The account has no vault yet.'));
    try { await abrirCofre(kek, cf.w1); } catch (e) { throw new Error(T('Esse não é o código de acesso desta conta.', 'That is not this account\'s access code.')); }
    A.api.guardarCodigoAcesso(codigo);
    return C.iniciar();
  };
  // a chave da conta ficou presa num aparelho que não existe mais (nunca foi guardada no cofre): começa uma chave nova.
  // As conversas antigas voltam quando alguém da conversa abrir o app (ele re-compartilha o histórico com a chave nova).
  C.chaveNovaSemAparelho = async (codigo) => {
    if (codigo) A.api.guardarCodigoAcesso(codigo);
    const cod = A.api.codigoAcesso(); if (!cod) throw new Error(T('Digite o seu código de acesso.', 'Type your access code.'));
    const { kek } = await C.derivar(cod);
    const k = await novaChave();
    conta.chaves[k.kid] = { priv: k.priv, pub: k.pub }; conta.atual = k.kid;
    await A.api.req('cofre', { kid: k.kid, pub: k.pub, w1: await fechar(kek, await pacote()), novaChave: true });
    await salvarConta();
    return C.iniciar();
  };

  // trocar o código de acesso (com o app aberto): gera um novo, fecha o cofre com ele e derruba as outras sessões
  C.trocarCodigo = async () => {
    if (!minhaConta()) throw new Error(T('Abra as conversas primeiro.', 'Unlock your chats first.'));
    const codigo = C.gerarCodigo(), { acesso, kek } = await C.derivar(codigo);
    const d = await A.api.req('acesso/trocar', { acesso, cofre: { kid: C.kid, pub: minhaConta().pub, w1: await fechar(kek, await pacote()) } });
    A.api.definirToken(d.token); A.api.guardarCodigoAcesso(codigo);
    return codigo;
  };
  A.evt.on('hub:cofre-mudou', () => { if (!C.kid) C.iniciar().catch((x) => A.log.aviso('cripto', x)); });
  A.evt.on('hub:chave-conta-mudou', (e) => { if (e.kid !== C.kid) C.iniciar().catch((x) => A.log.aviso('cripto', x)); });

  // ---------- diretório de chaves públicas das contas (cache de 5 min) ----------
  const cacheChaves = new Map(); // codigo -> { t, conta: {kid, pub, antigas}, devs (só p/ mensagens antigas) }
  const emVoo = new Map();
  async function diretorio(codigos, forcar = false) {
    const faltam = codigos.filter((c) => forcar || !cacheChaves.has(c) || Date.now() - cacheChaves.get(c).t > 300000);
    if (faltam.length) {
      // (0.8.7) as mensagens agora abrem ao mesmo tempo: o mesmo pedido em andamento é reaproveitado (não sai um por mensagem)
      const q = faltam.join(','); let p = emVoo.get(q);
      if (!p) { p = A.api.req('chaves?codigos=' + encodeURIComponent(q)).then((d) => { for (const c of faltam) cacheChaves.set(c, { t: Date.now(), devs: (d.chaves && d.chaves[c]) || [], conta: (d.contas && d.contas[c]) || null }); }); emVoo.set(q, p); p.then(() => emVoo.delete(q), () => emVoo.delete(q)); }
      await p;
    }
    const out = {}; for (const c of codigos) out[c] = cacheChaves.get(c) || { devs: [], conta: null }; return out;
  }

  // as chaves atuais das contas (para saber se alguém da conversa ganhou uma chave nova)
  C.kidsDe = async (codigos) => { const d = await diretorio(codigos, true); return codigos.map((c) => (d[c].conta && d[c].conta.kid) || '').sort().join(','); };

  // segredo ECDH entre uma chave privada minha e uma pública de outra pessoa (cache)
  const segredos = new Map();
  async function segredo(priv, pub) {
    let porPriv = segredos.get(priv); if (!porPriv) segredos.set(priv, (porPriv = new Map()));
    const k = pub.x + pub.y; if (porPriv.has(k)) return porPriv.get(k);
    // (0.8.7) guarda a promessa: várias mensagens abrindo juntas usam o mesmo cálculo
    const p = sub().importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, ext: true }, ALG, false, [])
      .then((outro) => sub().deriveKey({ name: 'ECDH', public: outro }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
    porPriv.set(k, p); p.catch(() => porPriv.delete(k)); return p;
  }
  const embrulhar = async (s, kBruta) => { const iv = crypto.getRandomValues(new Uint8Array(12)); return b64(iv) + '.' + b64(await aes(s, kBruta, iv)); };

  // Cifra um objeto para a chave da conta de cada pessoa (inclui a sua)
  C.cifrar = async (obj, codigos) => {
    if (!C.pronto) await C.iniciar();
    const eu = minhaConta();
    if (!eu) throw new Error(T('As conversas ainda estão trancadas neste aparelho: digite o seu código de acesso no Aero Talk.', 'Your chats are still locked on this device: type your access code in Aero Talk.'));
    const dir = await diretorio(codigos);
    const K = await sub().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const kBruta = new Uint8Array(await sub().exportKey('raw', K));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await aes(K, new TextEncoder().encode(JSON.stringify(obj)), iv);
    const emb = {};
    const contas = Object.values(dir).map((x) => x.conta).filter(Boolean);
    if (!contas.some((x) => x.kid === C.kid)) contas.push({ kid: C.kid, pub: eu.pub });
    for (const c of contas) emb[c.kid] = await embrulhar(await segredo(eu.priv, c.pub), kBruta);
    return { iv: b64(iv), ct: b64(ct), dev: '0'.repeat(16), kc: C.kid, chaves: emb };
  };

  // chave pública de quem mandou (da conta; nas mensagens antigas, do aparelho), buscando de novo se for nova
  async function pubRemetente(codigo, cifra, daConta) {
    const procurar = (d) => (daConta ? (d.conta && (d.conta.kid === cifra.kc ? d.conta : (d.conta.antigas || []).find((x) => x.kid === cifra.kc))) : d.devs.find((x) => x.dev === cifra.dev));
    let achou = procurar((await diretorio([codigo]))[codigo]);
    if (!achou) achou = procurar((await diretorio([codigo], true))[codigo]);
    return achou ? achou.pub : null;
  }
  async function abrirChave(cifra, codigoRemetente) {
    const tentar = async (priv, pub, emb) => { try { const [ivk, ck] = emb.split('.'); return await desaes(await segredo(priv, pub), deb64(ck), deb64(ivk)); } catch (_) { return null; } };
    // 1) pela chave da conta (a atual e as antigas)
    const kids = conta ? [conta.atual, ...Object.keys(conta.chaves).filter((k) => k !== conta.atual)].filter(Boolean) : [];
    for (const kid of kids) {
      let emb = cifra.chaves[kid]; if (!emb) continue;
      const minha = conta.chaves[kid];
      let pub;
      if (emb.startsWith('M.')) { emb = emb.slice(2); pub = minha.pub; } // migrada: embrulhada pela minha própria conta
      else if (emb.startsWith('R.')) { // re-compartilhada por outro membro da conversa: "R.<código dele>.<chave dele>.<embrulho>"
        const [, cod, kidDele, ...resto] = emb.split('.'); emb = resto.join('.');
        pub = await pubRemetente(cod, { kc: kidDele }, true);
      }
      else if (cifra.kc) pub = cifra.kc === kid ? minha.pub : await pubRemetente(codigoRemetente, cifra, true);
      else pub = legado && cifra.dev === legado.dev ? legado.pub : await pubRemetente(codigoRemetente, cifra, false); // 0.5.5: mandada de um aparelho
      if (pub) { const k = await tentar(minha.priv, pub, emb); if (k) return { k, kid }; }
    }
    // 2) mensagens de antes da 0.5.5: pela chave antiga deste aparelho (só enquanto a migração não terminou)
    const emb = legado && cifra.chaves[legado.dev];
    if (emb) {
      const pub = cifra.dev === legado.dev ? legado.pub : await pubRemetente(codigoRemetente, cifra, false);
      if (pub) { const k = await tentar(legado.priv, pub, emb); if (k) return { k, kid: '' }; }
    }
    return null;
  }

  // Abre uma mensagem. Devolve o objeto, ou null se a conta não consegue abrir.
  // ref = { cid, seq }: se a mensagem ainda não tem entrada para a chave atual da conta, ela é "migrada" (em segundo plano).
  C.decifrar = async (cifra, codigoRemetente, ref) => {
    if (!C.pronto) await C.iniciar();
    if (!cifra || !cifra.chaves) return null;
    const r = await abrirChave(cifra, codigoRemetente);
    if (!r) return null;
    try {
      const K = await sub().importKey('raw', r.k, 'AES-GCM', false, ['decrypt']);
      const obj = JSON.parse(new TextDecoder().decode(await desaes(K, deb64(cifra.ct), deb64(cifra.iv))));
      const eu = minhaConta();
      if (ref && eu && !cifra.chaves[C.kid]) {
        const emb = 'M.' + (await embrulhar(await segredo(eu.priv, eu.pub), r.k));
        cifra.chaves[C.kid] = emb;
        fila(ref.cid, ref.seq, emb);
      }
      // quem está na conversa e ganhou uma chave nova (perdeu o aparelho antigo) recebe o histórico de volta, embrulhado por mim
      if (ref && eu && ref.membros && A.api.eu) {
        const dir = await diretorio(ref.membros.filter((c) => c !== A.api.eu.codigo));
        for (const d of Object.values(dir)) {
          const k = d.conta && d.conta.kid; if (!k || cifra.chaves[k]) continue;
          const emb = 'R.' + A.api.eu.codigo + '.' + C.kid + '.' + (await embrulhar(await segredo(eu.priv, d.conta.pub), r.k));
          cifra.chaves[k] = emb; fila(ref.cid, ref.seq, emb, k);
        }
      }
      return obj;
    } catch (e) { return null; }
  };
  // a migração das mensagens antigas acabou: a chave do aparelho deixa de existir
  C.esquecerLegado = async () => { if (!legado) return; legado = null; C.legado = false; await apagar('eu'); };

  // ---------- migração: manda as chaves re-embrulhadas em lotes ----------
  const pendentes = new Map(); let timerFila = null;
  function fila(cid, seq, emb, para) {
    if (!pendentes.has(cid)) pendentes.set(cid, []);
    pendentes.get(cid).push(para ? { seq, emb, para } : { seq, emb });
    clearTimeout(timerFila); timerFila = setTimeout(() => C.enviarFila().catch(() => {}), 1200);
  }
  C.enviarFila = async () => {
    for (const [cid, itens] of [...pendentes]) {
      pendentes.delete(cid);
      for (let i = 0; i < itens.length; i += 100) await A.api.req(`conv/${cid}/chaves`, { kid: C.kid, itens: itens.slice(i, i + 100) });
    }
  };

  // Anexos: bytes cifrados com uma chave própria (a chave vai dentro da mensagem cifrada)
  C.cifrarArquivo = async (blob) => {
    const K = await sub().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dados = await aes(K, new Uint8Array(await blob.arrayBuffer()), iv);
    return { dados, k: b64(await sub().exportKey('raw', K)), iv: b64(iv) };
  };
  C.decifrarArquivo = async (bytes, k, iv, mime) => {
    const K = await sub().importKey('raw', deb64(k), 'AES-GCM', false, ['decrypt']);
    return new Blob([await desaes(K, new Uint8Array(bytes), deb64(iv))], { type: mime || 'application/octet-stream' });
  };
  // (0.7.14) anexo grande (Aero Bubble): o arquivo é cifrado em partes de 8 MB, cada uma com a mesma chave e um iv próprio (o iv base com o
  // número da parte nos últimos 4 bytes). Assim sobe e desce uma parte de cada vez, sem precisar do arquivo inteiro na memória.
  const ivParte = (base, i) => { const v = new Uint8Array(base); const n = new DataView(v.buffer); n.setUint32(8, n.getUint32(8) ^ i); return v; };
  C.chaveArquivo = async () => { const K = await sub().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']); const iv = crypto.getRandomValues(new Uint8Array(12)); return { K, ivB: iv, k: b64(await sub().exportKey('raw', K)), iv: b64(iv) }; };
  C.cifrarParte = async (ch, i, bytes) => aes(ch.K, bytes, ivParte(ch.ivB, i));
  C.decifrarParte = async (k, iv, i, bytes) => { const K = await sub().importKey('raw', deb64(k), 'AES-GCM', false, ['decrypt']); return desaes(K, new Uint8Array(bytes), ivParte(deb64(iv), i)); };
  C._b64 = b64; C._deb64 = deb64;
})();
