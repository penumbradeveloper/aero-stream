// Monta o site para o Worker de arquivos (web.aerostream.workers.dev): a landing (site/) na raiz e o Aero Web (app/) em /app/.
// Roda com "npm run site" na pasta servidor. Criado por Ryan Victtor.
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'site-dist');
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
cpSync(join(raiz, 'site'), destino, { recursive: true });
cpSync(join(raiz, 'app'), join(destino, 'app'), { recursive: true });
await (await import('./minificar.mjs')).minificar(join(destino, 'app'), raiz);
for (const f of ['icon.svg', 'icon-512.png', 'icon-180.png']) cpSync(join(raiz, 'app', f), join(destino, f));
cpSync(join(raiz, 'app', 'img'), join(destino, 'img'), { recursive: true });
const versao = (/A\.versao = '([\d.-]+)'/.exec(readFileSync(join(raiz, 'app/js/base.js'), 'utf8')) || [])[1];
writeFileSync(join(destino, 'versao.json'), JSON.stringify({ versao }));
// cabeçalhos: o site pode ser cacheado; o app e o versao.json sempre conferem se há versão nova.
// Segurança em tudo: nenhum outro site pode abrir o Aero dentro de um quadro (clickjacking), só HTTPS, e sem adivinhar tipo de arquivo.
// O Referer continua no padrão do navegador: o player do YouTube precisa dele.
const SEGURANCA = [
  "Content-Security-Policy: frame-ancestors 'self'",
  'X-Frame-Options: SAMEORIGIN',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
].map((l) => '  ' + l + '\n').join('');
writeFileSync(join(destino, '_headers'), '/*\n' + SEGURANCA + '/versao.json\n  Cache-Control: no-store\n/app/*\n  Cache-Control: no-cache\n');
console.log('Site montado em site-dist/ (versão ' + versao + ')');
