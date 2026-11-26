// Gera desktop/jogos-lista.json: a lista pública de jogos que o Discord reconhece (/api/applications/detectable), só com o que o Aero usa
// (id, nome, ícone, executáveis e apelidos). Vai junto no app para detectar jogos mesmo sem internet; o app ainda atualiza sozinho
// uma vez por semana. Uso: node scripts/jogos-lista.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { compactar } = req(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'desktop', 'jogos.js'));
const r = await fetch('https://discord.com/api/v9/applications/detectable', { headers: { 'User-Agent': 'AeroStream (jogos)' } });
if (!r.ok) throw new Error('http ' + r.status);
const lista = compactar(await r.json());
const destino = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'desktop', 'jogos-lista.json');
fs.writeFileSync(destino, JSON.stringify({ em: Date.now(), apps: lista }));
console.log(`${lista.length} jogos -> ${destino} (${Math.round(fs.statSync(destino).size / 1024)} KB)`);
await import('./jogos-icones.mjs'); // (1.0.3) os ícones dos jogos do Mural saem da mesma lista
