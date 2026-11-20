// Gera desktop/capas-lista.json: o índice das imagens de jogos de console do libretro-thumbnails (thumbnails.libretro.com), as mesmas
// capas, logos e telas de título que os front-ends de emulador usam. Para cada jogo de cada console guarda só o nome do arquivo da
// melhor versão (EUA, depois Mundo, Europa, Japão; nada de beta, demo ou hack). O app do PC procura nesse índice para oferecer as
// imagens do jogo no editor da atividade (o jogo de Nintendo 64, e não só o remake). Uso: node scripts/capas-lista.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://thumbnails.libretro.com/';
// pasta do libretro -> nome curto que aparece no editor
const SISTEMAS = [
  ['Nintendo - Nintendo Entertainment System', 'NES'], ['Nintendo - Family Computer Disk System', 'Famicom Disk'],
  ['Nintendo - Super Nintendo Entertainment System', 'Super Nintendo'], ['Nintendo - Nintendo 64', 'Nintendo 64'],
  ['Nintendo - GameCube', 'GameCube'], ['Nintendo - Wii', 'Wii'], ['Nintendo - Wii U', 'Wii U'],
  ['Nintendo - Game Boy', 'Game Boy'], ['Nintendo - Game Boy Color', 'Game Boy Color'], ['Nintendo - Game Boy Advance', 'Game Boy Advance'],
  ['Nintendo - Nintendo DS', 'Nintendo DS'], ['Nintendo - Nintendo 3DS', 'Nintendo 3DS'], ['Nintendo - Virtual Boy', 'Virtual Boy'],
  ['Sega - Master System - Mark III', 'Master System'], ['Sega - Mega Drive - Genesis', 'Mega Drive'], ['Sega - Mega-CD - Sega CD', 'Sega CD'],
  ['Sega - 32X', '32X'], ['Sega - Saturn', 'Saturn'], ['Sega - Dreamcast', 'Dreamcast'], ['Sega - Game Gear', 'Game Gear'],
  ['Sony - PlayStation', 'PlayStation'], ['Sony - PlayStation 2', 'PlayStation 2'], ['Sony - PlayStation 3', 'PlayStation 3'],
  ['Sony - PlayStation Portable', 'PSP'], ['Sony - PlayStation Vita', 'PS Vita'],
  ['Microsoft - Xbox', 'Xbox'], ['Microsoft - Xbox 360', 'Xbox 360'],
  ['NEC - PC Engine - TurboGrafx 16', 'PC Engine'], ['NEC - PC Engine CD - TurboGrafx-CD', 'PC Engine CD'],
  ['SNK - Neo Geo Pocket Color', 'Neo Geo Pocket Color'], ['Atari - 2600', 'Atari 2600'], ['Atari - Lynx', 'Atari Lynx'],
  ['Bandai - WonderSwan Color', 'WonderSwan Color'],
];
const TIPOS = [['Named_Boxarts', 'b'], ['Named_Logos', 'l'], ['Named_Titles', 't']];

const RUIM = /\((beta|proto|prototype|demo|sample|debug|kiosk|hack|pirate|unl|aftermarket|program|test|promo|competition|preview|trial)[^)]*\)|\[(b|h|t|f|o)\d*\]/i;
const nota = (f) => { // menor é melhor
  let n = RUIM.test(f) ? 100 : 0;
  n += /\(USA\)/.test(f) ? 0 : /\(World\)/.test(f) ? 1 : /\(USA,/.test(f) ? 2 : /Europe/.test(f) ? 4 : /Japan/.test(f) ? 6 : 8;
  n += /\(Rev|\(v\d/.test(f) ? 1 : 0;
  n += (f.match(/\(/g) || []).length * 0.1;
  return n;
};
const baseDe = (f) => f.replace(/\.png$/i, '').replace(/\s*[([][^)\]]*[)\]]/g, '').trim();

async function listar(pasta, tipo) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + encodeURIComponent(pasta) + '/' + tipo + '/', { headers: { 'User-Agent': 'AeroStream (capas)' } });
      if (r.status === 404) return [];
      if (!r.ok) throw new Error('http ' + r.status);
      const t = await r.text(), l = [];
      for (const m of t.matchAll(/href="([^"?/][^"]*\.png)"/g)) { try { l.push(decodeURIComponent(m[1])); } catch (e) { /* nome torto */ } }
      return l;
    } catch (e) { if (i === 2) { console.warn('  falhou', pasta, tipo, e.message); return []; } await new Promise((r) => setTimeout(r, 1500)); }
  }
  return [];
}

const jogos = []; let total = 0;
for (let s = 0; s < SISTEMAS.length; s++) {
  const [pasta, rot] = SISTEMAS[s];
  const porBase = new Map();
  for (const [tipo, k] of TIPOS) {
    for (const f of await listar(pasta, tipo)) {
      const b = baseDe(f); if (!b) continue;
      const x = porBase.get(b) || {}; const atual = x[k];
      if (!atual || nota(f) < nota(atual + '.png')) x[k] = f.replace(/\.png$/i, '');
      porBase.set(b, x);
    }
  }
  let n = 0;
  for (const x of porBase.values()) {
    if (!x.b && !x.l && !x.t) continue;
    const ref = x.b || x.t || x.l; // os outros tipos quase sempre usam o mesmo nome: 1 = igual, 0 = não tem
    jogos.push([s, ref, x.l ? (x.l === ref ? 1 : x.l) : 0, x.t ? (x.t === ref ? 1 : x.t) : 0, x.b ? 1 : 0]);
    n++;
  }
  total += n; console.log(`${rot}: ${n}`);
}
const destino = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'desktop', 'capas-lista.json');
fs.writeFileSync(destino, JSON.stringify({ em: Date.now(), s: SISTEMAS, j: jogos }));
console.log(`${total} jogos -> ${destino} (${Math.round(fs.statSync(destino).size / 1024)} KB)`);
