// Gera app/js/integ-semente.js: a cópia do catálogo de integrações (servidor/src/catalogo-integ.js) que vai dentro do app, para a primeira
// abertura sem internet. Depois disso o app usa o catálogo que busca no servidor, então rodar isto é opcional ao lançar uma integração
// nova (a cópia pode ficar para trás; o teste só confere que ela não tem nada fora do catálogo). Uso: node scripts/integ-catalogo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { catalogoCorpo } from '../servidor/src/catalogo-integ.js';

const destino = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'app', 'js', 'integ-semente.js');
fs.writeFileSync(destino, '// gerado por scripts/integ-catalogo.mjs a partir de servidor/src/catalogo-integ.js (não edite à mão)\nwindow.Aero.INTEG_SEMENTE = ' + catalogoCorpo() + ';\n');
console.log('catálogo -> ' + destino);
