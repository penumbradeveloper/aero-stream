// Copia a interface (../app) para www/ antes de empacotar o APK. Criado por Ryan Victtor.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const aqui = dirname(fileURLToPath(import.meta.url));
rmSync(join(aqui, 'www'), { recursive: true, force: true });
mkdirSync(join(aqui, 'www'), { recursive: true });
cpSync(join(aqui, '..', 'app'), join(aqui, 'www'), { recursive: true });
console.log('Interface copiada para android/www');
