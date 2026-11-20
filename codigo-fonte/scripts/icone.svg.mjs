// Aero Stream - o desenho do ícone. A fonte única é app/icon.svg (bolha de vidro com o "play" e um anel inteiro, fundo transparente).
// Criado por Ryan Victtor.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const arquivo = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'icon.svg');
// "placa" era o fundo arredondado das versões antigas; o ícone novo já é transparente, então as duas variantes são iguais
export function svgIcone() { return readFileSync(arquivo, 'utf8'); }
