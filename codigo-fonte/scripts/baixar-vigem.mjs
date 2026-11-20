// Aero Stream - baixa o ViGEmBus (driver de controle virtual do Windows) e o ViGEmClient.dll para o build do Windows. Criado por Ryan Victtor.
// Os arquivos vêm das publicações oficiais e são conferidos pelo SHA-256 (se mudarem, o build para: ninguém troca o arquivo no caminho).
//  - ViGEmBus 1.22.0 (BSD-3, Nefarius): github.com/nefarius/ViGEmBus
//  - ViGEmClient.dll x64 (MIT), do pacote vgamepad 0.1.0 do PyPI (MIT, Yann Bouteiller)
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'desktop', 'extra');
const ARQ = [
  { url: 'https://github.com/nefarius/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe', sha: '89220a7865076b342892f98865f3499fb7c4cfd673159e89d352c360fd014c6a', para: 'vigem/ViGEmBus_setup.exe' },
  { url: 'https://files.pythonhosted.org/packages/8a/54/0eaddc33f84247963af078f364b37153d09fcd6cdc398f243ec3e8842c56/vgamepad-0.1.0.tar.gz', sha: '57f6bd01aec0c172947517fb782d150ef9b285f7f4d524c317374fa5c24a89de', tar: 'vgamepad-0.1.0/vgamepad/win/vigem/client/x64/ViGEmClient.dll', shaDentro: '2bf0cb1d809039573c922737d298a1653d4dbc61408060ff45a9bcfde82e97d2', para: 'nativo/ViGEmClient.dll' },
];
const sha = (b) => createHash('sha256').update(b).digest('hex');
for (const a of ARQ) {
  const r = await fetch(a.url); if (!r.ok) throw new Error('não consegui baixar ' + a.url + ' (' + r.status + ')');
  let dados = Buffer.from(await r.arrayBuffer());
  if (sha(dados) !== a.sha) throw new Error('SHA-256 diferente do esperado: ' + a.url);
  if (a.tar) {
    const tmp = mkdtempSync(join(tmpdir(), 'vigem-'));
    writeFileSync(join(tmp, 'p.tgz'), dados);
    execFileSync('tar', ['-xzf', join(tmp, 'p.tgz'), '-C', tmp, a.tar]);
    dados = readFileSync(join(tmp, a.tar)); rmSync(tmp, { recursive: true, force: true });
    if (sha(dados) !== a.shaDentro) throw new Error('SHA-256 do arquivo de dentro diferente do esperado: ' + a.tar);
  }
  const f = join(destino, a.para); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, dados);
  console.log('ok', a.para, dados.length, 'bytes');
}
