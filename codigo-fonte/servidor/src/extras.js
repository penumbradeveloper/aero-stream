// Aero - (1.0.0) EXTRAS DO AERO BUBBLE: o que é a mais para quem apoia. Tudo que já existia continua grátis e igual; aqui só entra o novo.
// Cada item tem o nível mínimo: 1 Standard, 2 Plus, 3 Donator, 4 Supporter (o desenvolvedor tem tudo).
// O que a pessoa escolhe fica GUARDADO mesmo se o plano vencer; só não aparece para ninguém (nem para ela) até renovar.
// As mesmas listas estão no app (app/js/extras.js). O servidor é quem manda: o app só mostra o que veio daqui.
import { planoDe } from './bolha.js';

export const NIVEL = { standard: 1, plus: 2, donator: 3, supporter: 4 };
export const nivelDe = (conta) => (conta && conta.dev ? 4 : NIVEL[planoDe(conta)] || 0);

const HEX6 = /^#[0-9a-f]{6}$/i;
const cores = (v, n) => (Array.isArray(v) ? v.filter((x) => HEX6.test(x)).slice(0, n).map((x) => x.toLowerCase()) : []);
const num = (v, a, z, pad) => (Number.isFinite(+v) ? Math.max(a, Math.min(z, Math.round(+v))) : pad);

// efeitos de nome NOVOS (os 21 de antes seguem grátis; o Diamante continua do Donator, como sempre foi)
export const EFEITOS_NOME = { cromado: 1, vitral: 2, digitar: 2, eletrico: 3, tinta: 3, fumaca: 3, pulsar: 3, magma: 4, cometa: 4 };
// (0.9.6) os que saíram viram o parecido que ficou (quem já usava não perde o estilo)
export const NOME_LEGADO = { entardecer: 'degrade', arcoiris: 'prisma', nebulosa: 'galaxia', ouro: 'purpurina' };
// molduras da foto: as fixas (Standard e Plus), as animadas (Donator) e as exclusivas (Supporter)
export const MOLDURAS = { anel: 1, pontilhada: 1, dupla: 2, estrelas: 2, giro: 3, pulso: 3, faiscas: 3, bolhas: 3, galaxia: 4, prisma: 4, coroa: 4 };
// a animação quando abrem o seu perfil
export const ABERTURAS = { surgir: 3, zoom: 3, brilho: 3, confete: 3, cortina: 4, holograma: 4 };
// acessórios no cartão: emojis soltos (posição, tamanho, giro e um movimento)
export const ACESSORIOS_MAX = { 3: 3, 4: 8 };
const MOV_ACESSORIO = ['', 'flutua', 'gira', 'pisca', 'balanca'];
// o anel de quem fala na chamada: a cor (Plus), os animados (Donator) e os exclusivos (Supporter)
export const ANEIS = { cor: 2, onda: 3, chama: 3, brilho: 3, arco: 4, eletrico: 4, equalizador: 3, sonar: 3, notas: 3, orbita: 4, aurora: 4, coracoes: 4 };
// o som quando você entra numa chamada (os outros ouvem; quem não quiser desliga)
export const SONS_ENTRAR = { sino: 3, gota: 3, acorde: 3, estrela: 3, portal: 3, harpa: 3 };
// o cartão de ligação (o que aparece no aviso de quem você liga) e a moldura da sua câmera (desenhada em quem assiste)
export const MOLDURAS_CAMERA = { neon: 3, vidro: 3, polaroid: 3, fita: 3, holograma: 4, coracao: 4 };

// modelos de bolha de conversa novos (os 11 de antes seguem grátis)
export const BOLHAS = { cristal: 3, holografico: 3, vaporwave: 3, doce: 3, galaxia: 4, lava: 4 };
export const bcPublico = (bc, nivel) => (bc && BOLHAS[bc.m] && BOLHAS[bc.m] > nivel ? { ...bc, m: 'padrao', c: '', f: '' } : bc || undefined);
const MIN = { nm: { ...EFEITOS_NOME, diamante: 3 } }; // (0.9.7) o Diamante (Donator) também some quando o plano acaba
const umDe = (v, tab, nivel) => (typeof v === 'string' && tab[v] && tab[v] <= nivel ? v : '');
const emojiOk = (e) => typeof e === 'string' && e.length <= 16 && /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\p{Emoji_Component}‍️⃣]+$/u.test(e);

// o que chega do app ao salvar o perfil (só os campos novos). Quem não tem o plano não salva o item (o app já mostra travado).
export function limparPerfil(b, p, nivel) {
  const axs = Array.isArray(p.axs) ? p.axs : []; // (1.0.0) as imagens e GIFs de acessório que a pessoa enviou
  if (b.mo !== undefined) { const x = b.mo; const t = x && umDe(x.t, MOLDURAS, nivel); p.mo = t ? { t, c: cores(x.c, 2) } : null; if (!p.mo) delete p.mo; }
  if (b.ab !== undefined) { const t = umDe(b.ab, ABERTURAS, nivel); if (t) p.ab = t; else delete p.ab; }
  if (b.ac !== undefined) {
    const max = nivel >= 4 ? ACESSORIOS_MAX[4] : nivel >= 3 ? ACESSORIOS_MAX[3] : 0;
    const l = (Array.isArray(b.ac) ? b.ac : []).slice(0, max).map((a) => (a && (emojiOk(a.e) || (typeof a.i === 'string' && axs.includes(a.i))) ? { ...(emojiOk(a.e) ? { e: a.e } : { i: a.i }), x: num(a.x, 0, 100, 50), y: num(a.y, 0, 100, 50), s: num(a.s, 16, 96, 32), r: num(a.r, -180, 180, 0), m: MOV_ACESSORIO.includes(a.m) ? a.m : '', ...(a.z === 'atras' ? { z: 'atras' } : {}), ...(a.f ? { f: 1 } : {}) } : null) /* (1.0.2) z: 'atras' = atrás da foto e do conteúdo; f = espelhado */).filter(Boolean);
    if (l.length) p.ac = l; else delete p.ac;
  }
  if (b.an !== undefined) { const x = b.an; const t = x && umDe(x.t, ANEIS, nivel); if (t) p.an = { t, c: cores(x.c, 8) }; /* (1.0.2) o Arco-íris aceita até 8 cores */ else delete p.an; }
  if (b.se !== undefined) { const t = umDe(b.se, SONS_ENTRAR, nivel); if (t) p.se = t; else delete p.se; }
  if (b.mc !== undefined) { const x = b.mc; const t = x && umDe(x.t, MOLDURAS_CAMERA, nivel); if (t) p.mc = { t, c: cores(x.c, 6) }; else delete p.mc; }
  if (b.cl !== undefined) { // o cartão de ligação: só liga ou desliga (a imagem sobe na rota própria, como o banner)
    if (b.cl === false || nivel < 3) delete p.cl; else if (b.cl === true && p.clV) p.cl = 1;
  }
  return p;
}

// o nome que os outros veem: um efeito novo de quem está sem o plano volta a ser sólido (com as mesmas cores)
export function nmPublico(nm, nivel) {
  if (!nm || typeof nm !== 'object') return nm || undefined;
  if (NOME_LEGADO[nm.e]) nm = { ...nm, e: NOME_LEGADO[nm.e] };
  const min = MIN.nm[nm.e];
  return min && min > nivel ? { ...nm, e: 'solido', c: (nm.c || []).slice(0, 1) } : nm;
}

// os extras que os outros veem (e o próprio app): só o que o plano de agora cobre
export function extrasPublicos(e, nivel) {
  const o = {};
  if (e.mo && (e.mo.t === 'arte' || MOLDURAS[e.mo.t] <= nivel)) o.mo = e.mo; // (1.0.2) as de artistas da Comunidade valem para todos
  if (e.ab && ABERTURAS[e.ab] <= nivel) o.ab = e.ab;
  if (Array.isArray(e.ac) && nivel >= 3) o.ac = e.ac.slice(0, nivel >= 4 ? ACESSORIOS_MAX[4] : ACESSORIOS_MAX[3]);
  if (e.an && (e.an.t === 'arte' || ANEIS[e.an.t] <= nivel)) o.an = e.an;
  if (e.se && SONS_ENTRAR[e.se] <= nivel) o.se = e.se;
  if (e.mc && MOLDURAS_CAMERA[e.mc.t] <= nivel) o.mc = e.mc;
  if (e.cl && e.clV && nivel >= 3) o.clV = e.clV;
  return o;
}
