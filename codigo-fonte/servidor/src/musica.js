// (0.8.7) Música junto (integração oficial "Música junto"): uma fila de músicas por conversa (DM, grupo ou chat do grupo), tocada ao mesmo
// tempo para todo mundo da conversa que tem a integração, também durante a chamada. Sem bot: cada aparelho toca a música sozinho e o
// servidor só guarda a fila e "quando começou" (todo mundo calcula o mesmo ponto da música a partir disso).
// Quem mexe: na DM, os dois; no grupo, o dono e os admins sempre, e os outros só se o dono deixar ("livre").
// Só guarda o código do vídeo, o título e quem pôs: nada de mensagens nem chaves.

import * as midia from './midia.js';

const CID = /^[dg][0-9a-f]{20}$/;
const VID = /^[A-Za-z0-9_-]{11}$/;
const MAX_FILA = 50;

export class Musica {
  constructor(hub) { this.hub = hub; }
  get social() { return this.hub.social; }

  async estado(cid) { return (await this.hub.get('mu:' + cid)) || { fila: [], i: null, ini: 0, pausa: null, livre: false, v: 0 }; }
  // (0.8.7) a música só "acabava" quando alguém estava ouvindo na hora: sem ninguém, a conversa ficava tocando para sempre, e quem
  // entrava dias depois ouvia a música começar do zero com a barra já no fim. Agora o servidor vê pelo relógio: as que já acabaram saem
  // da fila e a próxima conta como tendo começado quando a anterior acabou. Sem duração conhecida, depois de 6 horas ela para.
  vencer(st, agora) {
    let mudou = false;
    for (let n = 0; n < 60 && st.i != null && st.pausa == null; n++) {
      const it = st.fila[st.i], d = it && it.d ? it.d * 1000 : 0;
      const fim = d ? st.ini + d + 2000 : st.ini + 6 * 3600 * 1000;
      if (it && agora < fim) break;
      if (it) st.fila.splice(st.i, 1);
      if (st.i < st.fila.length && d) st.ini = fim; else { st.i = null; st.ini = agora; }
      mudou = true;
    }
    return mudou;
  }
  mandar(cv, st) { this.social.avisar(Object.keys(cv.membros), { tipo: 'musica', cid: cv.id, st, agora: Date.now() }); }
  erro(a, cid, msg) { this.social.avisar([a.conta], { tipo: 'musica-erro', cid, msg }); }
  // o título e o canal do vídeo (e se ele pode tocar fora do YouTube)
  async info(v) {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v), { signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 401 || r.status === 403 || r.status === 404) return null; // (1.0.0) só esses dizem que o vídeo não toca fora do YouTube
      if (!r.ok) return { t: '', a: '' }; // 429/5xx: o YouTube só está ocupado ou bloqueando o servidor por um tempo: toca mesmo assim
      const d = await r.json();
      return { t: String(d.title || '').slice(0, 140), a: String(d.author_name || '').slice(0, 80) };
    } catch (_) { return { t: '', a: '' }; } // sem resposta: toca mesmo assim (o título fica o código)
  }

  async acao(a, m) {
    const cid = String(m.cid || '');
    if (!CID.test(cid) || !a.conta) return;
    if (!this.hub.limitar('mu:' + a.dev, 30, 10000)) return;
    const cv = await this.hub.get('cv:' + cid);
    if (!cv || !cv.membros || !cv.membros[a.conta]) return;
    const st = await this.estado(cid);
    if (this.vencer(st, Date.now())) { st.v = (st.v || 0) + 1; await this.hub.put({ ['mu:' + cid]: st }); if (m.acao === 'ver' || m.acao === 'fim' || m.acao === 'dur') { this.mandar(cv, st); return; } }
    if (m.acao === 'ver') { this.social.avisar([a.conta], { tipo: 'musica', cid, st, agora: Date.now() }); return; }
    const papel = cv.membros[a.conta].papel;
    const manda = cv.tipo !== 'grupo' || papel === 'dono' || papel === 'admin';
    const pode = manda || st.livre;
    const agora = Date.now();
    const tocarDe = (i) => { st.i = i != null && i >= 0 && i < st.fila.length ? i : null; st.ini = agora; st.pausa = null; };
    switch (m.acao) {
      case 'por': {
        if (!pode) return this.erro(a, cid, 'O dono do grupo não liberou a música para todo mundo.');
        if (st.fila.length >= MAX_FILA) return this.erro(a, cid, 'A fila está cheia (50 músicas).');
        // (0.8.7) do YouTube / YouTube Music (o vídeo), do Deezer (escolhida na busca) ou um link do Spotify, Deezer ou YouTube Music:
        // o que não é do YouTube é achado no YouTube pelo nome e artista (cada aparelho toca o vídeo; ninguém precisa de Premium)
        let it = null;
        try {
          const v = String(m.v || ''), id = String(m.id || ''), url = String(m.url || '');
          if (VID.test(v)) { const inf = await this.info(v); if (!inf) return this.erro(a, cid, 'Esse vídeo não pode tocar fora do YouTube.'); it = { v, t: inf.t, a: inf.a.replace(/ - Topic$/, ''), c: '', f: m.f === 'ytmusic' ? 'ytmusic' : 'youtube' }; }
          else if (/^\d{1,15}$/.test(id)) it = await midia.link('https://www.deezer.com/track/' + id);
          else if (url) it = await midia.link(url);
          else return this.erro(a, cid, 'Escolha uma música ou cole um link.');
          if (it.k === 'l') return this.erro(a, cid, 'Isso é um álbum: escolha uma música dele.');
          it = await midia.paraTocar(it);
        } catch (_) { return this.erro(a, cid, 'Não reconheci esse link. Use um link do Spotify, do Deezer ou do YouTube Music.'); }
        if (!it || !VID.test(it.v || '')) return this.erro(a, cid, 'Não achei essa música para tocar.');
        st.fila.push({ v: it.v, t: String(it.t || '').slice(0, 140), a: String(it.a || '').slice(0, 80), c: midia.capaOk(it.c), f: ['spotify', 'deezer', 'ytmusic', 'youtube'].includes(it.f) ? it.f : 'youtube', por: a.codigo, nome: String(a.nome || '').slice(0, 40), em: agora });
        if (st.i == null) tocarDe(st.fila.length - 1);
        break;
      }
      case 'pular': if (!pode) return; tocarDe(st.i == null ? null : st.i + 1); break;
      case 'voltar': if (!pode) return; tocarDe(st.i == null ? st.fila.length - 1 : Math.max(0, st.i - 1)); break;
      case 'ir': if (!pode) return; tocarDe(Math.round(Number(m.k))); break;
      case 'pausar': if (!pode || st.i == null || st.pausa != null) return; st.pausa = Math.max(0, (agora - st.ini) / 1000); break;
      case 'tocar': if (!pode || st.i == null || st.pausa == null) return; st.ini = agora - st.pausa * 1000; st.pausa = null; break;
      case 'buscar': { if (!pode || st.i == null) return; const s = Math.max(0, Math.min(36000, Number(m.s) || 0)); if (st.pausa != null) st.pausa = s; else st.ini = agora - s * 1000; break; }
      case 'tirar': {
        if (!pode) return;
        const k = Math.round(Number(m.k)); if (!(k >= 0 && k < st.fila.length)) return;
        st.fila.splice(k, 1);
        if (st.i != null) { if (k < st.i) st.i--; else if (k === st.i) tocarDe(st.i); }
        break;
      }
      case 'limpar': if (!pode) return; st.fila = []; st.i = null; st.pausa = null; break;
      // qualquer um da conversa avisa que a música acabou: só vale para a que está tocando agora (vários avisos = um pulo só)
      // (0.8.7) a que acabou sai da fila e a próxima (que fica no mesmo lugar) começa
      case 'fim': if (st.i == null || Math.round(Number(m.i)) !== st.i || st.pausa != null || agora - st.ini < 5000) return; st.fila.splice(st.i, 1); tocarDe(st.i); break;
      case 'recomecar': if (!pode || st.i == null) return; tocarDe(st.i); break;
      // (0.8.7) a duração da música (o tocador de quem ouve conta): só a da que está tocando, só uma vez. É o que mostra a barra de tempo
      case 'dur': { const it = st.fila[st.i], d = Math.round(Number(m.d)); if (st.i == null || Math.round(Number(m.i)) !== st.i || !it || it.d || !(d > 0 && d <= 36000)) return; it.d = d; break; }
      case 'livre': if (cv.tipo !== 'grupo' || !manda) return; st.livre = !!m.sim; break;
      default: return;
    }
    // a fila não cresce para sempre: as que já tocaram há tempo saem
    if (st.i != null && st.i > 20) { st.fila.splice(0, st.i - 20); st.i = 20; }
    if (st.i == null && st.fila.length > 20) st.fila.splice(0, st.fila.length - 20);
    st.v = (st.v || 0) + 1;
    await this.hub.put({ ['mu:' + cid]: st });
    this.mandar(cv, st);
  }
}
