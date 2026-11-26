// (1.0.3) Gera servidor/estaticos/jogos-icones/<letra>.json a partir de desktop/jogos-lista.json: o nome do jogo (simplificado) -> o ícone dele na lista
// pública de jogos do Discord ("id/hash"). O Mural mostra esse ícone (o "L" do League of Legends, o "V" do Valorant) no lugar do logo
// gigante da Wikipédia. Dividido pela primeira letra: o app só baixa o pedaço do jogo que aparece. Uso: node scripts/jogos-icones.mjs
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const { apps } = JSON.parse(fs.readFileSync(path.join(raiz, 'desktop', 'jogos-lista.json'), 'utf8'));
// a mesma conta do app (mural.js normT)
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '');
const parte = (n) => (/^[a-z]/.test(n) ? n[0] : '0');
const partes = {};
for (const [id, nome, ic, , apelidos] of apps) {
  if (!/^\d{5,25}$/.test(String(id)) || !/^[a-f0-9]{32}$/.test(String(ic || ''))) continue;
  for (const n of new Set([nome, ...(apelidos || [])].map(norm).filter((x) => x.length >= 2))) {
    const p = (partes[parte(n)] = partes[parte(n)] || {});
    if (!p[n]) p[n] = id + '/' + ic; // o nome principal vem antes dos apelidos de outros jogos
  }
}
const pasta = path.join(raiz, 'servidor', 'estaticos', 'jogos-icones'); // vai para o site no deploy (sincronizar.mjs), não dentro do app
fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
let total = 0;
for (const [k, v] of Object.entries(partes)) { const s = JSON.stringify(v); total += s.length; fs.writeFileSync(path.join(pasta, k + '.json'), s); }
console.log(`${Object.keys(partes).length} pedaços, ${Math.round(total / 1024)} KB -> ${pasta}`);
