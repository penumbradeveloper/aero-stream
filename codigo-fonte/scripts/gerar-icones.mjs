// Gera os ícones do Aero Stream (PNG para PWA/iOS, PNG e ICO para o app do PC). Precisa do pacote "sharp".
// Uso: node scripts/gerar-icones.mjs   (os arquivos já vêm prontos no projeto; isto é só para refazer)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { svgIcone } from './icone.svg.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
let sharp;
for (const c of ['sharp', '/home/claude/.npm-global/lib/node_modules/sharp']) { try { sharp = req(c); break; } catch (e) { /* tenta o próximo */ } }
if (!sharp) { console.error('Instale o sharp (npm i sharp) para gerar os ícones.'); process.exit(1); }

const png = async (svg, tam) => sharp(Buffer.from(svg)).resize(tam, tam).png({ compressionLevel: 9 }).toBuffer();
const cheio = svgIcone({ placa: false }), placa = svgIcone({ placa: true });

mkdirSync(join(raiz, 'desktop', 'build'), { recursive: true });
writeFileSync(join(raiz, 'app', 'icon-512.png'), await png(cheio, 512));
writeFileSync(join(raiz, 'app', 'icon-180.png'), await png(cheio, 180));
writeFileSync(join(raiz, 'app', 'icon.svg'), cheio);
writeFileSync(join(raiz, 'desktop', 'build', 'icon.png'), await png(placa, 512));

// ICO com várias resoluções (cada imagem é um PNG dentro do contêiner .ico)
const tamanhos = [16, 24, 32, 48, 64, 128, 256];
const imgs = await Promise.all(tamanhos.map((t) => png(placa, t)));
const cab = Buffer.alloc(6); cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(imgs.length, 4);
let desloc = 6 + 16 * imgs.length;
const entradas = imgs.map((b, i) => {
  const e = Buffer.alloc(16), t = tamanhos[i];
  e.writeUInt8(t >= 256 ? 0 : t, 0); e.writeUInt8(t >= 256 ? 0 : t, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(b.length, 8); e.writeUInt32LE(desloc, 12);
  desloc += b.length; return e;
});
writeFileSync(join(raiz, 'desktop', 'build', 'icon.ico'), Buffer.concat([cab, ...entradas, ...imgs]));
console.log('Ícones gerados: app/icon-512.png, app/icon-180.png, app/icon.svg, desktop/build/icon.png, desktop/build/icon.ico');
