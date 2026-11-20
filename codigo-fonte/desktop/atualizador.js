// Aero Stream - atualização automática do app do PC (Windows e Linux). Criado por Ryan Victtor.
//
// O que se atualiza sozinho é o CÓDIGO do app (a interface app/ e os arquivos .js do desktop/); o Electron (o "motor") só muda quando sai um
// instalador novo, e o manifesto avisa quando um é necessário. A cada deploy, o servidor publica:
//   /atualizacao/manifesto.json        { dados: "<json>", assinatura: "<base64>" }  dados = { versao, electronMin, arquivos: [{ p, sha256, tam }] }
//   /atualizacao/<versao>/<p>          cada arquivo
// O manifesto é ASSINADO (Ed25519) com uma chave que só existe no computador de quem publica; a chave pública está abaixo. Sem a assinatura
// certa nada é instalado: um site invadido não consegue mandar código para o PC dos seus amigos. Cada arquivo também é conferido (sha256).
//
// Instalação: os arquivos vão para <dados do app>/atualizacao/<versao>.tmp e, conferidos, viram <dados>/atualizacao/atual (as versões antigas
// são apagadas). Ao abrir, este módulo vê se "atual" é mais nova que a instalada e passa a execução para ela. Se a versão nova não conseguir
// abrir 2 vezes seguidas, ela é deixada de lado e o app volta para a versão instalada.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHAVE_PUBLICA = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA6xNFH8MY/T7+TA1z7gjqIZ+NpTSv3LYMvU7FFKbVtJI=
-----END PUBLIC KEY-----`;
const MAX_ARQUIVOS = 400, MAX_TAM = 25 << 20;

const partes = (v) => String(v || '0').replace('-', '.').split('.').map((x) => parseInt(x, 10) || 0); // "0.5.7-1" = 0.5.7.1
function comparar(a, b) { const x = partes(a), y = partes(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; }

// O caminho de um arquivo do pacote é seguro? (relativo, sem "..", só dentro de app/ ou desktop/)
const caminhoOk = (p) => typeof p === 'string' && p.length < 200 && /^(app|desktop)\/[A-Za-z0-9._\-/]+$/.test(p) && !p.split('/').some((s) => s === '..' || s === '.' || s === '');

function verificarManifesto(m, chave = CHAVE_PUBLICA) {
  if (!m || typeof m.dados !== 'string' || typeof m.assinatura !== 'string') return null;
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(m.dados, 'utf8'), crypto.createPublicKey(chave), Buffer.from(m.assinatura, 'base64')); } catch (e) { ok = false; }
  if (!ok) return null;
  let d; try { d = JSON.parse(m.dados); } catch (e) { return null; }
  if (!d || !/^\d+\.\d+\.\d+(-\d+)?$/.test(String(d.versao)) || !Array.isArray(d.arquivos) || d.arquivos.length > MAX_ARQUIVOS) return null;
  if (!d.arquivos.every((a) => a && caminhoOk(a.p) && /^[0-9a-f]{64}$/.test(a.sha256) && a.tam >= 0 && a.tam <= MAX_TAM)) return null;
  if (!d.arquivos.some((a) => a.p === 'desktop/main.js') || !d.arquivos.some((a) => a.p === 'app/index.html')) return null;
  return d;
}

function criarAtualizador({ app, log = () => {}, buscar = (u) => globalThis.fetch(u, { cache: 'no-store' }), chave = CHAVE_PUBLICA, versaoElectron = process.versions.electron } = {}) {
  const raiz = () => path.join(app.getPath('userData'), 'atualizacao');
  const atual = () => path.join(raiz(), 'atual');
  // (0.7.8) a pasta "atual" fica nos dados do usuário, onde qualquer programa dele escreve: antes de confiar nela, a assinatura e o sha256 de cada
  // arquivo são conferidos de novo. Sem o manifesto assinado (versão antiga) ou com um arquivo mexido, ela é ignorada e a versão é baixada de novo.
  let conferida; // uma vez por execução; instalar outra versão zera
  function conferirAtual() {
    try {
      const i = JSON.parse(fs.readFileSync(path.join(atual(), 'aero-versao.json'), 'utf8'));
      const d = verificarManifesto(JSON.parse(fs.readFileSync(path.join(atual(), 'aero-manifesto.json'), 'utf8')), chave);
      if (!d || d.versao !== i.versao) return null;
      for (const a of d.arquivos) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(atual(), ...a.p.split('/')))).digest('hex') !== a.sha256) return null;
      return i;
    } catch (e) { return null; }
  }
  const infoAtual = () => (conferida === undefined ? (conferida = conferirAtual()) : conferida);
  const arqTent = () => path.join(raiz(), 'tentativas.json');
  const lerTent = () => { try { return JSON.parse(fs.readFileSync(arqTent(), 'utf8')); } catch (e) { return {}; } };
  const gravarTent = (t) => { try { fs.mkdirSync(raiz(), { recursive: true }); fs.writeFileSync(arqTent(), JSON.stringify(t)); } catch (e) { /* ok */ } };
  // marcado num global (não numa variável de ambiente: o app.relaunch() e as cópias escondidas herdariam e abririam a versão antiga)
  const versaoRodando = () => globalThis.__aeroVersaoAtualizada || app.getVersion();

  // Chamado na PRIMEIRA linha do main.js. true = a execução passou para a versão atualizada (o main.js antigo para por aí).
  function delegar() {
    if (globalThis.__aeroVersaoAtualizada) return false; // já é a versão atualizada rodando
    const i = infoAtual();
    if (!i || !i.verificado || comparar(i.versao, app.getVersion()) <= 0) return false;
    if (comparar(versaoElectron, i.electronMin || '0') < 0) return false; // precisa de um instalador novo
    const t = lerTent();
    if (t.versao === i.versao && t.n >= 2) { log('atualização ' + i.versao + ' não abriu 2 vezes: usando a versão instalada'); return false; }
    gravarTent({ versao: i.versao, n: (t.versao === i.versao ? t.n || 0 : 0) + 1 });
    globalThis.__aeroVersaoAtualizada = i.versao;
    try { require(path.join(atual(), 'desktop', 'main.js')); return true; }
    catch (e) { log('atualização ' + i.versao + ' falhou ao carregar: ' + e.message); delete globalThis.__aeroVersaoAtualizada; return false; }
  }
  // A versão atualizada abriu e ficou de pé: zera a contagem de tentativas
  function confirmarAbriu() { const t = lerTent(); if (t.n) gravarTent({ versao: t.versao, n: 0 }); }

  let baixando = null;
  // servidor: o endereço do servidor do Aero (o mesmo da conta). Devolve { ok, versao?, nada?, precisaInstalador?, erro? }
  // canal (1.0.2): 'teste' quando veio do canal de versões de teste (fica anotado, para dar para voltar à normal)
  function verificarEBaixar(servidor, canal = 'normal') {
    if (baixando) return baixando;
    baixando = (async () => {
      const s = String(servidor || '').replace(/\/+$/, '');
      if (!/^https:\/\/[^/\s]+$/.test(s) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(s)) return { ok: false, erro: 'endereço do servidor inválido' };
      const r = await buscar(s + '/atualizacao/manifesto.json');
      if (!r.ok) return { ok: false, erro: 'manifesto ' + r.status };
      const assinado = await r.json(), d = verificarManifesto(assinado, chave);
      if (!d) return { ok: false, erro: 'assinatura inválida: atualização recusada' };
      const ja = infoAtual();
      if (comparar(d.versao, versaoRodando()) <= 0 || (ja && ja.verificado && ja.versao === d.versao)) return { ok: true, nada: true, versao: d.versao };
      if (comparar(versaoElectron, d.electronMin || '0') < 0) return { ok: false, precisaInstalador: true, versao: d.versao, electronMin: d.electronMin };
      const tmp = path.join(raiz(), d.versao + '.tmp');
      fs.rmSync(tmp, { recursive: true, force: true });
      for (const a of d.arquivos) {
        const resp = await buscar(s + '/atualizacao/' + d.versao + '/' + a.p.split('/').map(encodeURIComponent).join('/'));
        if (!resp.ok) throw new Error('baixar ' + a.p + ': ' + resp.status);
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length !== a.tam || crypto.createHash('sha256').update(buf).digest('hex') !== a.sha256) throw new Error('arquivo diferente do assinado: ' + a.p);
        const destino = path.join(tmp, ...a.p.split('/'));
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, buf);
      }
      fs.writeFileSync(path.join(tmp, 'aero-manifesto.json'), JSON.stringify({ dados: assinado.dados, assinatura: assinado.assinatura }));
      fs.writeFileSync(path.join(tmp, 'aero-versao.json'), JSON.stringify({ versao: d.versao, electronMin: d.electronMin || '', verificado: true, quando: Date.now(), canal: canal === 'teste' ? 'teste' : 'normal' }));
      // troca: a nova vira "atual" e TODO o resto (versões antigas, sobras) é apagado
      fs.rmSync(atual(), { recursive: true, force: true });
      fs.renameSync(tmp, atual());
      conferida = undefined;
      for (const n of fs.readdirSync(raiz())) if (n !== 'atual' && n !== 'tentativas.json') fs.rmSync(path.join(raiz(), n), { recursive: true, force: true });
      gravarTent({ versao: d.versao, n: 0 });
      log('atualização ' + d.versao + ' pronta');
      return { ok: true, versao: d.versao, pronta: true };
    })().catch((e) => { log('atualização: ' + e.message); return { ok: false, erro: String(e.message || e) }; }).finally(() => { baixando = null; });
    return baixando;
  }

  // (0.5.9-6) só olha (sem baixar nada): o app pergunta à pessoa antes de atualizar. Devolve { ok, versao?, nova?, pronta?, precisaInstalador?, erro? }
  async function checar(servidor) {
    try {
      const s = String(servidor || '').replace(/\/+$/, '');
      if (!/^https:\/\/[^/\s]+$/.test(s) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(s)) return { ok: false, erro: 'endereço do servidor inválido' };
      const r = await buscar(s + '/atualizacao/manifesto.json');
      if (!r.ok) return { ok: false, erro: 'manifesto ' + r.status };
      const d = verificarManifesto(await r.json(), chave);
      if (!d) return { ok: false, erro: 'assinatura inválida: atualização recusada' };
      if (comparar(d.versao, versaoRodando()) <= 0) return { ok: true, nova: false, versao: d.versao };
      const ja = infoAtual();
      if (ja && ja.verificado && ja.versao === d.versao) return { ok: true, nova: true, pronta: true, versao: d.versao }; // já baixada: falta reiniciar
      if (comparar(versaoElectron, d.electronMin || '0') < 0) return { ok: true, nova: true, precisaInstalador: true, versao: d.versao };
      return { ok: true, nova: true, versao: d.versao };
    } catch (e) { return { ok: false, erro: String(e.message || e) }; }
  }

  // (1.0.2) apaga a versão baixada (a de teste): ao reiniciar, o app abre a versão instalada e a normal chega pela atualização de sempre
  function descartar() {
    try { fs.rmSync(atual(), { recursive: true, force: true }); fs.rmSync(arqTent(), { force: true }); conferida = undefined; log('atualização: versão baixada descartada (voltando para a normal)'); return true; }
    catch (e) { log('atualização: não deu para descartar (' + e.message + ')'); return false; }
  }
  const canal = () => { const i = globalThis.__aeroVersaoAtualizada ? infoAtual() : null; return i && i.canal === 'teste' ? 'teste' : 'normal'; };

  return { delegar, confirmarAbriu, verificarEBaixar, checar, versaoRodando, infoAtual, descartar, canal };
}

module.exports = { criarAtualizador, verificarManifesto, comparar, caminhoOk, CHAVE_PUBLICA };
