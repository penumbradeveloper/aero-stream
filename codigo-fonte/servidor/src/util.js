// Utilidades compartilhadas do servidor.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  // X-Aero-HW (0.5.9-5): o id do aparelho. Sem ele aqui, o navegador e o celular barravam TODO pedido (o app do PC não barra)
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Aero-HW, X-Nome',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400', // a permissão vale um dia: menos uma ida e volta a cada pedido (ajuda em internet lenta)
};
// (0.6.0) cabeçalhos de segurança em toda resposta da API: nada de "adivinhar" o tipo, nada guardado em cache (dados pessoais) e sem
// mandar de onde veio o pedido para outros sites
export const SEGURANCA = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' };
export const resposta = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, ...SEGURANCA, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const erro = (msg, status = 400) => resposta({ erro: msg }, status);
export const txt = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
export const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 símbolos, sem 0/O/1/I
export const aleatorio = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => ALFA[x % 32]).join('');
export const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const dehex = (s) => Uint8Array.from(s.match(/../g), (h) => parseInt(h, 16));

export function enviar(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (_) { /* conexão já fechou */ }
}

// A # do perfil: 3 a 20 caracteres, sem espaços, escolhida pelo usuário e única.
export const TAG_REGEX = /^[A-Za-z0-9_.-]{3,20}$/;
export const normalizarTag = (t) => txt(t, 40).replace(/^#/, '');

// (0.8.7) um emoji de verdade (um só caractere visível, com as variações de cor/pele/família/bandeira) ou nada
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const EH_EMOJI = /^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}]|[#*0-9]\uFE0F?\u20E3)/u, SO_EMOJI = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\p{Emoji_Component}\u200D\uFE0F\u20E3\u{E0020}-\u{E007F}]+$/u;
export function umEmoji(v) {
  const t = String(v || '').replace(/\s+/g, '').slice(0, 32);
  const g = SEG ? [...SEG.segment(t)].map((x) => x.segment) : [...t];
  return g.length === 1 && EH_EMOJI.test(g[0]) && SO_EMOJI.test(g[0]) ? g[0] : '';
}
