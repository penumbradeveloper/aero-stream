// Compacta o código que vai para fora (site, pacote de atualização e o instalador do PC): tira comentários e espaços e troca os nomes
// internos por letras. O código de verdade (app/ e desktop/ no projeto) não muda; só as cópias publicadas.
// Interface: os nomes globais (Aero, window.*) ficam: cada arquivo continua sendo um <script> comum, na mesma ordem.
// App do PC (0.8.2): cada .js do desktop/ vira CommonJS compactado (os nomes das funções ficam guardados, por segurança).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

function esbuildDe(raiz) {
  for (const pj of ['servidor/package.json', 'desktop/package.json']) {
    try { return createRequire(join(raiz, pj))('esbuild'); } catch (e) { /* tenta o próximo */ }
  }
  throw new Error('esbuild não encontrado (rode npm ci em servidor/ ou desktop/)');
}

export async function minificar(pasta, raiz) {
  const esbuild = esbuildDe(raiz);
  let antes = 0, depois = 0;
  for (const [sub, loader] of [['js', 'js'], ['css', 'css']]) {
    for (const nome of readdirSync(join(pasta, sub))) {
      if (!nome.endsWith('.' + loader)) continue;
      const arq = join(pasta, sub, nome), fonte = readFileSync(arq, 'utf8');
      const { code } = await esbuild.transform(fonte, { loader, minify: true, legalComments: 'none', target: 'esnext', charset: 'utf8' });
      antes += fonte.length; depois += code.length;
      writeFileSync(arq, code);
    }
  }
  console.log(`Interface minificada: ${Math.round(antes / 1024)} KB -> ${Math.round(depois / 1024)} KB`);
}

// o script do KWin roda dentro do KWin (outro motor de JavaScript): fica como está
const DESKTOP_FORA = new Set(['node_modules', 'dist', 'build', 'extra', 'cursores_kwin.js']);
export async function minificarDesktop(pasta, raiz) {
  const esbuild = esbuildDe(raiz);
  let antes = 0, depois = 0;
  const andar = async (d) => {
    for (const nome of readdirSync(d)) {
      if (DESKTOP_FORA.has(nome)) continue;
      const arq = join(d, nome);
      if (statSync(arq).isDirectory()) { await andar(arq); continue; }
      if (!nome.endsWith('.js')) continue;
      const fonte = readFileSync(arq, 'utf8');
      const { code } = await esbuild.transform(fonte, { loader: 'js', format: 'cjs', platform: 'node', minify: true, keepNames: true, legalComments: 'none', target: 'node20', charset: 'utf8' });
      antes += fonte.length; depois += code.length;
      writeFileSync(arq, code);
    }
  };
  await andar(pasta);
  console.log(`App do PC minificado: ${Math.round(antes / 1024)} KB -> ${Math.round(depois / 1024)} KB`);
}

if (process.argv[1] && process.argv[1].endsWith('minificar.mjs')) {
  const { fileURLToPath } = await import('node:url'); const { dirname } = await import('node:path');
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  // --instalador: compacta app/ e desktop/ NO LUGAR (só na máquina que monta o instalador, como o GitHub Actions; nunca rode no projeto)
  if (process.argv[2] === '--instalador') {
    if (!process.env.CI) { console.error('Use --instalador só no GitHub Actions: ele reescreve app/ e desktop/.'); process.exit(1); }
    await minificar(join(raiz, 'app'), raiz); await minificarDesktop(join(raiz, 'desktop'), raiz);
  } else if (process.argv[2] && existsSync(process.argv[2])) await minificar(process.argv[2], raiz);
}
