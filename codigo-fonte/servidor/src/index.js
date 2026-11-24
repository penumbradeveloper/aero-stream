// Aero Stream - servidor (Cloudflare Worker + Durable Objects)
//  /            -> a interface (pasta "public", cópia da pasta app/)
//  /ice         -> lista de servidores STUN/TURN para a conexão atravessar roteadores
//  /api/*, /hub -> contas, amigos, perfis, estatísticas e presença (Hub)
//  /ws          -> sala (Room): participantes, chat e repasse das mensagens de conexão
// O vídeo NÃO passa por aqui: ele vai direto entre os aparelhos (WebRTC).
import * as midia from './midia.js';
import { SEGURANCA, CORS } from './util.js';
export { Hub } from './hub.js';
export { Room } from './sala.js';

const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
// quantas credenciais de TURN cada IP pede (por instância): passou do normal, recebe só STUN em vez de gastar o relay
const icePedidos = new Map();
// (0.8.7) quem entrou na conta pode pedir mais vezes; sem conta (convidado de sala) o limite é bem menor, para o TURN não virar relay grátis
function iceDemais(ip, comConta) {
  const agora = Date.now(), r = icePedidos.get(ip);
  if (!r || agora - r.t > 600000) { if (icePedidos.size > 5000) icePedidos.clear(); icePedidos.set(ip, { t: agora, n: 1 }); return false; }
  return ++r.n > (comConta ? 60 : 12);
}

const IMG_FIXA = /^\/api\/(avatar|banner|nameplate|fundo|ligacao|mural-fundo|grupo-foto|grupo-banner)\/[A-Za-z0-9_-]{1,40}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hub = () => env.HUB.get(env.HUB.idFromName('global'));

    // (0.8.7) o "ms" da chamada: cada um mede a própria internet até aqui (não mais o tempo entre as duas pessoas, que é o mesmo dos dois lados)
    if (url.pathname === '/ping') return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Timing-Allow-Origin': '*' } });

    if (url.pathname === '/ws') {
      const sala = (url.searchParams.get('sala') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,12}$/.test(sala)) return new Response('Código de sala inválido', { status: 400 });
      // A identidade só vale se o servidor verificou a conta: tudo que o cliente mandar disso é apagado.
      // (0.7.8) o app manda um bilhete de uso único, não o token da sessão: endereços acabam em registros. (0.9.6) o token na URL não vale mais
      const ticket = url.searchParams.get('ticket');
      for (const k of ['amigo', 'uid', 'tag', 'av', 'token', 'ticket', 'mudo']) url.searchParams.delete(k);
      if (ticket) {
        const r = await hub().fetch('https://hub/interno/verificar', { headers: { 'X-Aero-Ticket': ticket } });
        if (r.status === 403) return new Response('Conta suspensa', { status: 403 });
        if (r.ok) {
          const u = await r.json();
          url.searchParams.set('uid', u.id);
          url.searchParams.set('amigo', u.codigo);
          url.searchParams.set('nome', u.nome);
          url.searchParams.set('tag', u.tag || '');
          url.searchParams.set('av', String(u.av || 0));
          if (u.mudo) url.searchParams.set('mudo', '1'); // silenciado pela moderação: não manda mensagem no chat da sala
        }
      }
      return env.ROOM.get(env.ROOM.idFromName(sala)).fetch(new Request(url, request));
    }

    // A sala ainda existe? (a aba Transmitir só oferece "Retomar" se a sala anterior não foi fechada)
    // imagens do chat da sala: POST /api/sala/<COD>/img?id=&seg= (quem está na sala) e GET /api/sala/<COD>/img/<id>
    const mImg = /^\/api\/sala\/([A-Za-z0-9]{4,12})\/img(\/[0-9a-f]{16})?$/.exec(url.pathname);
    if (mImg) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const destino = new URL('https://sala/img' + (mImg[2] || '')); destino.search = url.search;
      const r = await env.ROOM.get(env.ROOM.idFromName(mImg[1].toUpperCase())).fetch(new Request(destino, request));
      const hd = new Headers(r.headers); for (const [k, v] of Object.entries(CORS)) hd.set(k, v);
      return new Response(r.body, { status: r.status, headers: hd });
    }
    const mSala = /^\/api\/sala\/([A-Za-z0-9]{4,12})$/.exec(url.pathname);
    if (mSala) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const r = await env.ROOM.get(env.ROOM.idFromName(mSala[1].toUpperCase())).fetch('https://sala/estado');
      return new Response(await r.text(), { status: r.status, headers: { ...CORS, ...SEGURANCA, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }

    // Busca de músicas do Spotify (perfil do Aero Talk). Só para quem está logado; as credenciais ficam só aqui no servidor.
    if (url.pathname === '/api/spotify') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, ...SEGURANCA, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      const auth = request.headers.get('Authorization') || '';
      const v = auth.startsWith('Bearer ') ? await hub().fetch('https://hub/interno/verificar', { headers: { 'X-Aero-Token': auth.slice(7) } }) : null;
      if (!v || !v.ok) return json({ erro: 'Entre na sua conta.' }, 401);
      if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return json({ erro: 'A busca do Spotify ainda não foi configurada no servidor.', codigo: 'spotify-nao-configurado' }, 503);
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
      if (q.length < 2) return json({ faixas: [] });
      try { return json({ faixas: await buscarSpotify(env, q) }); } catch (e) {
        console.error('spotify', String(e), e.detalhe || '');
        // a mensagem diz o motivo de verdade (antes era sempre "não respondeu", e não dava para saber o que consertar)
        const st = e.status || 0;
        const msg = e.etapa === 'token' ? (st === 400 || st === 401 ? 'O Spotify recusou o Client ID/Client Secret gravados no servidor (confira os dois no painel do Spotify).' : 'O Spotify não entregou a chave de acesso (' + st + ').')
          : st === 403 ? 'O Spotify recusou a busca (403). Apps em "modo de desenvolvimento" no painel do Spotify exigem que o dono do app tenha Spotify Premium, ou que o app seja liberado.'
            : st === 429 ? 'Muitas buscas no Spotify agora. Espere um pouco.' : 'O Spotify não respondeu (' + (st || 'sem conexão') + '). Tente de novo.';
        return json({ erro: msg, codigo: 'spotify-' + (e.etapa || 'busca') + '-' + st }, 502);
      }
    }

    // Música do perfil SEM Spotify Premium: busca no Deezer (API pública, sem chave; cada música tem 30 s de prévia) e links do Spotify
    // pela página pública "oEmbed" (sem login). A prévia do Deezer vence em algumas horas, então ela é buscada na hora de tocar.
    // (0.8.7) as capas de filmes, animes e músicas passam por aqui (só de sites conhecidos): quem vê o perfil não fala com sites de fora
    if (url.pathname === '/api/capa' && request.method === 'GET') return midia.capa(url.searchParams.get('u') || '', env, request);
    if (url.pathname === '/api/img' && request.method === 'GET') return midia.imgProxy(url.searchParams.get('u') || '', env, request);
    if (url.pathname === '/api/twvideo' && request.method === 'GET') return midia.twVideo(request, url.searchParams.get('u') || '', env);
    if (url.pathname.startsWith('/api/musica') || ['/api/letterboxd', '/api/busca', '/api/link'].includes(url.pathname)) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, ...SEGURANCA, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      const auth = request.headers.get('Authorization') || '';
      const v = auth.startsWith('Bearer ') ? await hub().fetch('https://hub/interno/verificar', { headers: { 'X-Aero-Token': auth.slice(7) } }) : null;
      if (!v || !v.ok) return json({ erro: 'Entre na sua conta.' }, 401);
      try {
        if (url.pathname === '/api/musica') {
          const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
          if (q.length < 2) return json({ faixas: [] });
          const r = await fetch('https://api.deezer.com/search?limit=12&q=' + encodeURIComponent(q));
          const d = await r.json();
          return json({ faixas: ((d && d.data) || []).filter((t) => t.readable !== false).map((t) => ({ fonte: 'deezer', id: String(t.id), nome: t.title, artista: t.artist && t.artist.name, album: t.album && t.album.title, capa: t.album && (t.album.cover_medium || t.album.cover), duracao: (t.duration || 0) * 1000 })) });
        }
        if (url.pathname === '/api/musica/previa') {
          const id = url.searchParams.get('id') || '';
          // (0.9.1) sem id: acha pelo nome e já devolve a prévia (uma ida só em vez de duas: o play começa mais rápido)
          const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
          if (!id && q.length >= 2) {
            const d = await (await fetch('https://api.deezer.com/search?limit=5&q=' + encodeURIComponent(q))).json();
            const t = ((d && d.data) || []).find((x) => x.readable !== false && x.preview);
            return t ? json({ previa: t.preview }) : json({ erro: 'Essa música não tem prévia.' }, 404);
          }
          if (!/^\d{1,15}$/.test(id)) return json({ erro: 'Música inválida.' }, 400);
          const d = await (await fetch('https://api.deezer.com/track/' + id)).json();
          return d && d.preview ? json({ previa: d.preview }) : json({ erro: 'Essa música não tem prévia.' }, 404);
        }
        // a música INTEIRA (para escolher o trecho de 30 s): acha a mesma música no YouTube; devolve até 3 vídeos (se um não deixar tocar
        // fora do YouTube, o app tenta o próximo) e a duração
        if (url.pathname === '/api/musica/youtube') {
          const q = (url.searchParams.get('q') || '').trim().slice(0, 140);
          if (q.length < 2) return json({ videos: [] });
          const r = await fetch('https://www.youtube.com/results?sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q + ' audio'), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1; SOCS=CAI' } });
          const t = await r.text(), m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(t);
          const videos = [];
          if (m) {
            const andar = (o) => { if (videos.length >= 3 || !o || typeof o !== 'object') return; if (o.videoRenderer) { const v = o.videoRenderer, d = (v.lengthText && v.lengthText.simpleText) || ''; const seg = d.split(':').reduce((a, x) => a * 60 + (+x || 0), 0); if (/^[A-Za-z0-9_-]{11}$/.test(v.videoId || '') && seg > 30 && seg < 1500) videos.push({ id: v.videoId, duracao: seg }); return; } for (const k in o) andar(o[k]); };
            try { andar(JSON.parse(m[1])); } catch (_) { /* página mudou */ }
          }
          return json({ videos });
        }
        // (0.8.7) Letterboxd (favoritos, curtidos e recentes com capas), busca de filmes/séries/animes/músicas/álbuns e links de música
        if (url.pathname === '/api/letterboxd') {
          const u = (url.searchParams.get('u') || '').toLowerCase();
          if (!/^[a-z0-9_]{2,15}$/.test(u)) return json({ erro: 'Usuário do Letterboxd inválido.' }, 400);
          try { return json(await midia.letterboxd(u)); } catch (e) { return json({ erro: e.status === 404 ? e.message : 'O Letterboxd não respondeu.' }, e.status === 404 ? 404 : 502); }
        }
        if (url.pathname === '/api/busca') return json({ itens: await midia.buscar(url.searchParams.get('tipo') || '', url.searchParams.get('q') || '') });
        if (url.pathname === '/api/link') { try { return json({ item: await midia.link(url.searchParams.get('url') || '') }); } catch (e) { return json({ erro: 'Não reconheci esse link. Use um link do Spotify, do Deezer ou do YouTube Music.' }, 400); } }
        if (url.pathname === '/api/musica/spotify') {
          const m = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/.exec(url.searchParams.get('url') || '');
          if (!m) return json({ erro: 'Cole o link de uma música do Spotify (open.spotify.com/track/...).' }, 400);
          const d = await (await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/track/' + m[1]))).json();
          return json({ faixa: { fonte: 'spotify', id: m[1], nome: d.title || 'Spotify', artista: '', capa: d.thumbnail_url || '' } });
        }
      } catch (e) { console.error('musica', String(e)); return json({ erro: 'O serviço de músicas não respondeu. Tente de novo.' }, 502); }
      return json({ erro: 'Não encontrado' }, 404);
    }

    // (1.0.0) fotos de perfil, banners, fundos e afins com versão no endereço (?v=) nunca mudam: ficam no cache da Cloudflare perto de quem
    // pede, e o servidor central só é acordado na primeira vez em cada lugar do mundo
    if (request.method === 'GET' && IMG_FIXA.test(url.pathname) && /^\d{1,15}$/.test(url.searchParams.get('v') || '') && typeof caches !== 'undefined' && caches.default) {
      const chave = new Request(url.origin + url.pathname + '?v=' + url.searchParams.get('v'));
      const ja = await caches.default.match(chave).catch(() => null); if (ja) return ja;
      const r = await hub().fetch(request);
      if (r.status === 200 && !r.headers.get('Content-Encoding') && /immutable/.test(r.headers.get('Cache-Control') || '')) { const p = caches.default.put(chave, r.clone()).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p); }
      return r;
    }
    // (1.0.2) os dados dos cartões de links (YouTube, Twitter, Reddit, lojas...) e o catálogo das integrações são iguais para todo mundo:
    // ficam no cache da Cloudflare perto de quem pede (1 h e 5 min, como já era guardado lá dentro), sem acordar o servidor central a cada vez
    if (request.method === 'GET' && typeof caches !== 'undefined' && caches.default) {
      const emb = url.pathname === '/api/embed' && /^Bearer .{20,}/.test(request.headers.get('Authorization') || '') && (url.searchParams.get('u') || '').length <= 400;
      if (emb || url.pathname === '/api/integ-catalogo') {
        const chave = new Request('https://cache.aero/' + (emb ? 'embed?u=' + encodeURIComponent(url.searchParams.get('u') || '') : 'integ-catalogo'));
        const ja = await caches.default.match(chave).catch(() => null); if (ja) return ja;
        const r = await hub().fetch(request);
        if (r.status === 200 && !r.headers.get('Content-Encoding')) {
          const corpo = await r.arrayBuffer(), cab = new Headers(r.headers);
          cab.set('Cache-Control', 'public, max-age=' + (emb ? 3600 : 300)); cab.delete('Set-Cookie');
          const p = caches.default.put(chave, new Response(corpo, { headers: cab })).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p);
          return new Response(corpo, { status: 200, headers: r.headers });
        }
        return r;
      }
    }
    if (url.pathname === '/hub' || url.pathname.startsWith('/api/')) return hub().fetch(request);

    if (url.pathname === '/ice') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      const auth = request.headers.get('Authorization') || '';
      const v = auth.startsWith('Bearer ') ? await hub().fetch('https://hub/interno/verificar', { headers: { 'X-Aero-Token': auth.slice(7) } }).catch(() => null) : null;
      const ice = iceDemais(request.headers.get('CF-Connecting-IP') || 'x', !!(v && v.ok)) ? { lista: STUN, turn: false } : await buscarIce(env);
      return new Response(JSON.stringify({ iceServers: ice.lista, turn: ice.turn, turnErro: ice.erro || undefined }), {
        headers: { ...CORS, ...SEGURANCA, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    // (0.6.0) os arquivos do app também saem com os cabeçalhos de segurança; só o tocador da música (yt.html) pode ficar dentro de outra página
    const r = await env.ASSETS.fetch(request);
    const cab = new Headers(r.headers);
    for (const [k, v] of Object.entries(SEGURANCA)) cab.set(k, k === 'Referrer-Policy' ? 'strict-origin-when-cross-origin' : v);
    // (0.7.14) mais camadas: nada de plugins (object/embed), a base dos links não pode ser trocada por HTML injetado, formulários só para o próprio
    // site, e a página só usa câmera, microfone e tela quando ela mesma pede (nenhum iframe de fora ganha acesso)
    cab.set('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), fullscreen=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()');
    if (/\.html?$|\/$/.test(url.pathname) && !/\/yt\.html$/.test(url.pathname)) { cab.set('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"); cab.set('X-Frame-Options', 'DENY'); }
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: cab });
  },
};

// ---------- Spotify (Client Credentials: só busca pública de músicas, nada da conta de ninguém) ----------
let spotifyToken = null, spotifyAte = 0;
async function buscarSpotify(env, q) {
  if (!spotifyToken || Date.now() > spotifyAte) {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(env.SPOTIFY_CLIENT_ID + ':' + env.SPOTIFY_CLIENT_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!r.ok) throw Object.assign(new Error('token ' + r.status), { etapa: 'token', status: r.status, detalhe: (await r.text()).slice(0, 200) });
    const d = await r.json(); spotifyToken = d.access_token; spotifyAte = Date.now() + (d.expires_in - 60) * 1000;
  }
  // limite 10: desde 2026 o Spotify recusa (400) "limit" maior que 10 para apps em modo de desenvolvimento
  const r = await fetch('https://api.spotify.com/v1/search?type=track&limit=10&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + spotifyToken } });
  if (r.status === 401) { spotifyToken = null; throw Object.assign(new Error('token expirado'), { etapa: 'busca', status: 401 }); }
  if (!r.ok) throw Object.assign(new Error('busca ' + r.status), { etapa: 'busca', status: r.status, detalhe: (await r.text()).slice(0, 200) });
  const d = await r.json();
  return ((d.tracks && d.tracks.items) || []).map((t) => ({
    id: t.id, nome: t.name, artista: (t.artists || []).map((a) => a.name).join(', '), album: t.album && t.album.name,
    capa: ((t.album && t.album.images) || []).slice(-2)[0] ? t.album.images.slice(-2)[0].url : '', duracao: t.duration_ms,
  }));
}

// Os navegadores costumam bloquear as portas 53 e 80, então ficam de fora.
function limpar(lista) {
  return lista
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:(53|80)(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length);
}

// Se você configurou o TURN da Cloudflare (opcional), usa ele; senão, só STUN.
// O token aceita os dois nomes: o painel da Cloudflare chama de "API token", mas o segredo foi salvo como TURN_API_KEY
// (com só TURN_API_TOKEN no código, o servidor ignorava o TURN e os amigos em outras redes ficavam com a tela preta).
async function buscarIce(env) {
  const token = env.TURN_API_TOKEN || env.TURN_API_KEY;
  if (env.TURN_KEY_ID && token) {
    try {
      const r = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: 43200 }), // (0.8.7) 12 h (antes 24 h): a credencial vale menos tempo se vazar
        }
      );
      if (r.ok) {
        const d = await r.json();
        const lista = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
        const limpa = limpar(lista);
        if (limpa.length) return { lista: limpa, turn: true };
        return { lista: STUN, turn: false, erro: 'resposta-vazia' };
      }
      console.error('TURN: a Cloudflare recusou as credenciais', r.status, (await r.text()).slice(0, 200));
      return { lista: STUN, turn: false, erro: 'http-' + r.status };
    } catch (e) {
      console.error('TURN: falha ao pedir credenciais', String(e));
      return { lista: STUN, turn: false, erro: 'rede' };
    }
  }
  return { lista: STUN, turn: false, erro: 'nao-configurado' };
}
