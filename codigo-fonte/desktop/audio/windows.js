// Aero Stream - áudio por aplicativo no Windows: o auxiliar AeroAudio.exe (compilado na hora com o csc.exe do Windows) lista os
// programas com som, muda volume/mudo de cada um e captura o som só dos programas escolhidos (API oficial de "loopback por processo",
// no Windows 10 2004+ pelo modo "incluir", programa por programa; no Windows 11 também pelo modo "excluir"). Quando algo disso falha, o app volta ao som do sistema inteiro e avisa. Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { compilar } = require('../nativo');
const { criarMisturador } = require('./mixer');

// o som POR PROCESSO (PROCESS_LOOPBACK) só existe a partir do build 20348 (Windows 11 e Server 2022); o Windows 10 vai até o 19045.
// Antes o app aceitava 19041, tentava no Windows 10, falhava e (numa janela) mandava a transmissão sem som nenhum.
const BUILD_POR_PROCESSO = 20348;
// (0.6.4) no Windows 10 2004+ (build 19041) o som POR PROCESSO funciona no modo "incluir" (o OBS 28 e o win-capture-audio usam assim); só o
// modo "excluir um programa" é que precisa do Windows 11 (no 10 ele vinha mudo, e foi por isso que a 0.5.9 desistiu do Windows 10). Então no
// Windows 10 o app captura CADA programa com som, menos o Aero (e o Discord, se marcado), e quem começar a tocar depois entra sozinho.
const BUILD_INCLUIR = 19041;
const buildWindows = () => parseInt(String(os.release()).split('.')[2], 10) || 0;
const nomeExe = (caminho) => path.win32.basename(String(caminho || '')).toLowerCase();

function criarWindows({ pastaDados, pidsProprios = () => [process.pid], emitirPCM = () => {}, log = () => {}, compilador = compilar, build = buildWindows, pidAero = process.pid } = {}) {
  let exePromessa = null, ultimaLista = new Map(), sessao = null;
  const icones = new Map(); // caminho do exe -> data URL ('' enquanto busca)

  const ajudante = () => {
    if (!exePromessa) exePromessa = (async () => {
      const fonte = fs.readFileSync(path.join(__dirname, 'nativo', 'AeroAudio.cs'), 'utf8');
      const r = await compilador({ nome: 'AeroAudio', fonte, pasta: path.join(pastaDados, 'nativo'), refs: ['System.Drawing.dll'] });
      if (!r.ok) { log('audio: ' + r.erro); setTimeout(() => { exePromessa = null; }, 60000).unref(); return null; } // tenta de novo daqui a 1 min
      return r.exe;
    })();
    return exePromessa;
  };
  const rodar = async (args, ms = 5000) => {
    const exe = await ajudante(); if (!exe) throw new Error('sem-auxiliar');
    return new Promise((res, rej) => execFile(exe, args, { timeout: ms, windowsHide: true, maxBuffer: 4 << 20, encoding: 'utf8' }, (e, out) => (e ? rej(e) : res(String(out)))));
  };

  async function disponivel() {
    const exe = await ajudante();
    return { captura: !!exe && build() >= BUILD_INCLUIR, volume: !!exe, listar: !!exe, tipo: 'windows', soIncluir: build() < BUILD_POR_PROCESSO };
  }

  async function lerSessoes() {
    const linhas = (await rodar(['list'])).split('\n').map((l) => l.trim()).filter(Boolean);
    const r = [];
    for (const l of linhas) { try { r.push(JSON.parse(l)); } catch (e) { /* linha quebrada */ } }
    return r;
  }
  function agrupar(sessoes) {
    const meus = new Set(pidsProprios()), g = new Map();
    for (const s of sessoes) {
      if (!s.pid || meus.has(s.pid)) continue;
      const k = nomeExe(s.exe) || ('pid' + s.pid);
      let it = g.get(k);
      if (!it) { it = { id: 'w:' + k, nome: s.nome || k, exe: s.exe, volume: 0, mudo: true, pid: s.pid, tocando: false, pids: new Set() }; g.set(k, it); }
      it.pids.add(s.pid); it.volume = Math.max(it.volume, s.vol); it.mudo = it.mudo && !!s.mudo; it.tocando = it.tocando || !!s.ativo; it._ppids = (it._ppids || new Map()).set(s.pid, s.ppid);
    }
    return [...g.values()].sort((a, b) => Number(b.tocando) - Number(a.tocando) || a.nome.localeCompare(b.nome));
  }

  async function listar() {
    let grupos;
    try { grupos = agrupar(await lerSessoes()); } catch (e) { return []; }
    ultimaLista = new Map(grupos.map((g) => [g.id, g]));
    return grupos.map((g) => {
      if (g.exe && !icones.has(g.exe)) { // busca o ícone uma vez, sem travar a lista
        icones.set(g.exe, '');
        rodar(['icon', g.exe], 4000).then((b64) => { const t = b64.trim(); if (/^[A-Za-z0-9+/=]{20,60000}$/.test(t)) icones.set(g.exe, 'data:image/png;base64,' + t); }).catch(() => {});
      }
      return { id: g.id, nome: g.nome, icone: icones.get(g.exe) || '', volume: g.volume, mudo: g.mudo, pid: g.pid, tocando: g.tocando };
    });
  }
  const volume = async (id, v) => { if (/^w:/.test(id)) await rodar(['vol', id.slice(2), String(Math.max(0, Math.min(100, Math.round(v))))]).catch(() => {}); };
  const mudo = async (id, m) => { if (/^w:/.test(id)) await rodar(['mute', id.slice(2), m ? '1' : '0']).catch(() => {}); };

  // ---------- captura ----------
  // alvos: lista de { modo: 'include'|'exclude', pid }
  // (0.5.9-6) a API do Windows só exclui UM programa por captura. Para deixar de fora o Aero E o Discord, captura cada programa com som,
  // menos esses dois (e quem começar a tocar depois entra sozinho: ver "dinamico" em capturar). Sem Discord aberto, fica como antes.
  const raizes = (g) => [...g.pids].filter((pid) => !g.pids.has(g._ppids.get(pid))); // só a "raiz" de cada árvore (os filhos já entram junto)
  const ehDiscord = (g) => /discord|vesktop|vencord|equibop|equicord|webcord|armcord|legcord|goofcord|dorion/i.test(nomeExe(g.exe) + ' ' + (g.nome || ''));
  // (0.6.0) o som do Aero e o do Discord são escolhas SEPARADAS. Sem o Discord: cada programa com som entra, menos o Discord (e menos o
  // Aero se essa outra opção estiver ligada; antes o próprio Aero entrava aqui e dava eco)
  const ehAero = (g) => { const meus = new Set(pidsProprios()); return [...g.pids].some((p) => meus.has(p)); };
  // cada programa com som, menos o Discord (se semDiscord) e o Aero (o Aero nem entra na lista: agrupar já tira os processos dele).
  // "sempre": devolve a lista mesmo sem o Discord aberto (Windows 10, onde não dá para usar o modo excluir)
  const soIncluir = () => build() < BUILD_POR_PROCESSO;
  async function alvosIncluir({ semAero = true, semDiscord = true, sempre = false } = {}) {
    let grupos; try { grupos = agrupar(await lerSessoes()); } catch (e) { return null; }
    if (!sempre && !grupos.some(ehDiscord)) return null;
    return grupos.filter((g) => !(semDiscord && ehDiscord(g)) && !(semAero && ehAero(g))).flatMap((g) => raizes(g).map((pid) => ({ modo: 'include', pid })));
  }
  async function resolverAlvos({ ids, excluirAero, excluirDiscord, janela }) {
    let daJanela = null;
    if (janela) { // a janela compartilhada + os aplicativos marcados à mão
      const m = /^window:(\d+):/.exec(String(janela));
      if (m) { try { const pid = parseInt((await rodar(['hwnd', m[1]], 3000)).trim(), 10); if (pid > 0) daJanela = { modo: 'include', pid }; } catch (e) { /* cai no erro abaixo */ } }
      if (!daJanela && !(ids && ids.length)) return { erro: 'janela-sem-pid' };
      if (daJanela && !(ids && ids.length)) return { alvos: [daJanela] };
    }
    if (ids && ids.length) {
      let grupos; try { grupos = agrupar(await lerSessoes()); } catch (e) { return { erro: 'listar' }; }
      const alvos = [];
      for (const g of grupos) {
        if (!ids.includes(g.id)) continue;
        for (const pid of g.pids) if (!g.pids.has(g._ppids.get(pid))) alvos.push({ modo: 'include', pid }); // só a "raiz" de cada árvore (os filhos já entram junto)
      }
      if (daJanela && !alvos.some((a) => a.pid === daJanela.pid)) alvos.unshift(daJanela);
      return alvos.length ? { alvos } : { erro: 'apps-sem-sessao' };
    }
    // a API do Windows só sabe "tudo menos um programa": com o som do Aero junto, exclui o processo System (PID 4, que nunca toca som)
    if (soIncluir()) { // Windows 10: só o modo incluir
      if (excluirAero === false) return { erro: 'windows10-com-aero' }; // o som do próprio Aero junto: vai o som do sistema do Chromium
      const a = await alvosIncluir({ semAero: true, semDiscord: !!excluirDiscord, sempre: true });
      return a ? { alvos: a, dinamico: true, semAero: true, semDiscord: !!excluirDiscord } : { erro: 'listar' };
    }
    if (excluirDiscord) { const a = await alvosIncluir({ semAero: excluirAero !== false, semDiscord: true }); if (a) return { alvos: a, dinamico: true, semAero: excluirAero !== false, semDiscord: true }; }
    if (excluirAero === false) return { alvos: [{ modo: 'exclude', pid: 4 }] };
    return { alvos: [{ modo: 'exclude', pid: pidAero }] };
  }

  function abrirCaptura(exe, alvo, taxa) {
    return new Promise((resolve) => {
      let terminou = false, buf = Buffer.alloc(0), cabecalho = false, resto = Buffer.alloc(0);
      const p = spawn(exe, ['cap', alvo.modo, String(alvo.pid), String(taxa)], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      try { os.setPriority(p.pid, os.constants.priority.PRIORITY_HIGH); } catch (e) { /* segue na prioridade normal */ } // (0.7.8) com o jogo usando tudo, o som não pode esperar a vez
      const fim = (r) => { if (terminou) return; terminou = true; clearTimeout(t); resolve(r); };
      const t = setTimeout(() => { try { p.kill(); } catch (e) { /* ok */ } fim({ ok: false, erro: 'tempo-esgotado' }); }, 9000);
      let errTxt = '';
      p.stderr.on('data', (d) => { errTxt += String(d); });
      p.on('error', (e) => fim({ ok: false, erro: e.message }));
      p.on('exit', (code) => { if (!terminou) fim({ ok: false, erro: (errTxt.trim() || 'codigo ' + code).slice(0, 160) }); else if (!sessao || sessao.fechado) return; else if (alvo.aoSair) alvo.aoSair(); });
      p.stdin.on('error', () => {});
      p.stdout.on('data', (d) => {
        if (!cabecalho) {
          buf = Buffer.concat([buf, d]); const i = buf.indexOf(10); if (i < 0) return;
          const m = /^AERO_OK (\d+) (\d)/.exec(buf.slice(0, i).toString('ascii'));
          if (!m) { try { p.kill(); } catch (e) { /* ok */ } return fim({ ok: false, erro: 'resposta-invalida' }); }
          cabecalho = true; d = buf.slice(i + 1); buf = Buffer.alloc(0);
          fim({ ok: true, proc: p, taxa: +m[1], entregar: (f) => alvo.entregar && alvo.entregar(f) });
          if (!d.length) return;
        }
        const juntos = resto.length ? Buffer.concat([resto, d]) : d;
        const uteis = juntos.length - (juntos.length % 8); resto = juntos.slice(uteis);
        if (!uteis) return;
        const f = new Float32Array(uteis / 4); new Uint8Array(f.buffer).set(juntos.subarray(0, uteis));
        if (alvo.entregar) alvo.entregar(f);
      });
    });
  }

  async function capturar({ ids = [], excluirAero = true, excluirDiscord = false, janela = null } = {}) {
    await parar();
    if (build() < BUILD_INCLUIR) return { ok: false, erro: 'windows-antigo' };
    const exe = await ajudante(); if (!exe) return { ok: false, erro: 'sem-auxiliar' };
    const r = await resolverAlvos({ ids, excluirAero, excluirDiscord, janela }); if (r.erro) return { ok: false, erro: r.erro };
    // (1.0.2) nada tocando além do Discord: espera alguém tocar (como no Windows 10). Antes caía na captura de tudo e o Discord ia junto
    // ao compartilhar de novo, mesmo com "Não captar o som do Discord" marcado
    const s = { fechado: false, procs: [], mix: null, taxa: 48000, ja: new Set() };
    sessao = s;
    for (const taxa of [48000, 44100]) { // a primeira que o Windows aceitar vale para todos
      let falhou = null;
      s.mix = criarMisturador({ taxa, emitir: emitirPCM });
      const abertos = [];
      for (const [i, alvo] of r.alvos.entries()) {
        const id = 'f' + i; s.mix.adicionar(id);
        alvo.entregar = (f) => s.mix.escrever(id, f);
        // no dinâmico, a captura de um programa que terminou sai da mistura e o programa pode voltar na próxima conferida (0.6.9: antes ele ficava
        // de fora para sempre, e o som da tela sumia até a pessoa compartilhar de novo)
        alvo.aoSair = () => { if (r.dinamico) { s.ja.delete(alvo.pid); if (s.mix) s.mix.remover(id); return; } if (sessao === s && !s.fechado && s.procs.every((p) => p.exitCode !== null)) { log('audio: capturas terminaram'); parar(); } };
        const c = await abrirCaptura(exe, alvo, taxa);
        if (!c.ok) { falhou = c.erro; break; }
        abertos.push(c.proc);
      }
      if (!falhou) {
        s.procs = abertos; s.taxa = taxa;
        if (r.dinamico) { // programa novo começou a tocar: entra na captura (menos o Aero e o Discord)
          const ja = s.ja; r.alvos.forEach((a) => ja.add(a.pid)); let n = r.alvos.length;
          s.timer = setInterval(async () => {
            if (s.fechado || s.ocupado) return; s.ocupado = true;
            try {
              const novos = ((await alvosIncluir({ semAero: r.semAero, semDiscord: r.semDiscord, sempre: true })) || []).filter((a) => !ja.has(a.pid));
              for (const alvo of novos) {
                if (s.fechado) break;
                ja.add(alvo.pid); const id = 'f' + n++; s.mix.adicionar(id);
                alvo.aoSair = () => { ja.delete(alvo.pid); if (s.mix) s.mix.remover(id); };
                alvo.entregar = (f) => s.mix.escrever(id, f);
                const c = await abrirCaptura(exe, alvo, taxa);
                if (c.ok && !s.fechado) s.procs.push(c.proc); else if (c.ok) { try { c.proc.kill(); } catch (e) { /* ok */ } }
              }
            } catch (e) { /* tenta de novo no próximo */ }
            s.ocupado = false;
          }, 1500);
          if (s.timer.unref) s.timer.unref();
        }
        return { ok: true, taxa, canais: 2 };
      }
      abertos.forEach((p) => { try { p.kill(); } catch (e) { /* ok */ } }); s.mix.parar();
      if (taxa === 44100) { sessao = null; log('audio: captura por processo falhou: ' + falhou); return { ok: false, erro: falhou }; }
    }
    return { ok: false, erro: 'falhou' };
  }

  async function parar() {
    const s = sessao; if (!s) return; sessao = null; s.fechado = true; clearInterval(s.timer);
    for (const p of s.procs) { try { p.stdin.end(); } catch (e) { /* ok */ } setTimeout(() => { try { p.kill(); } catch (e) { /* ok */ } }, 400).unref(); }
    if (s.mix) s.mix.parar();
  }
  function limparSincrono() { const s = sessao; sessao = null; if (!s) return; s.fechado = true; clearInterval(s.timer); for (const p of s.procs) { try { p.kill(); } catch (e) { /* ok */ } } }

  return { disponivel, listar, volume, mudo, capturar, parar, limparSincrono };
}

module.exports = { criarWindows };
