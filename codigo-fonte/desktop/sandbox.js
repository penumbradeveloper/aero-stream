// Aero Stream - o sandbox do Chromium funciona neste Linux? Criado por Ryan Victtor.
// Fora do AppImage, sim (o pacote .deb instala o chrome-sandbox certinho). No AppImage o chrome-sandbox não pode ser setuid; o Chromium
// usa então os "user namespaces" sem privilégio, que quase todo Linux permite. Os que bloqueiam: kernel.unprivileged_userns_clone=0
// (Debian antigo) e kernel.apparmor_restrict_unprivileged_userns=1 (Ubuntu 24.04 ou mais novo).
'use strict';
const fs = require('fs');

const ler = (p) => { try { return fs.readFileSync(p, 'utf8').trim(); } catch (e) { return null; } };

function precisaSemSandbox({ env = process.env, plataforma = process.platform, lerArq = ler } = {}) {
  if (plataforma !== 'linux' || !env.APPIMAGE) return false;
  if (lerArq('/proc/sys/kernel/unprivileged_userns_clone') === '0') return true;
  if (lerArq('/proc/sys/kernel/apparmor_restrict_unprivileged_userns') === '1') return true;
  if (lerArq('/proc/sys/user/max_user_namespaces') === '0') return true;
  return false;
}

// (0.7.9) reiniciar pelo AppImage. O app roda de dentro de uma montagem temporária (/tmp/.mount_...) que some quando ele fecha, e o app.relaunch()
// tenta abrir o programa de lá: às vezes a montagem já tinha sumido e o app fechava sem voltar. Aqui um sh de fora espera o app fechar e abre o
// .AppImage de novo, sem herdar as variáveis que apontam para a montagem antiga.
function relancarAppImage({ env = process.env, plataforma = process.platform, pid = process.pid, argv = process.argv, existe = fs.existsSync } = {}) {
  const img = plataforma === 'linux' && env.APPIMAGE;
  if (!img || !existe(img)) return null;
  const limpo = { ...env };
  for (const k of ['APPIMAGE', 'APPDIR', 'ARGV0', 'OWD', 'LD_LIBRARY_PATH', 'LD_PRELOAD', 'PYTHONHOME', 'PYTHONPATH']) delete limpo[k];
  const sh = 'p=$1; i=$2; shift 2; while kill -0 "$p" 2>/dev/null; do sleep 0.2; done; exec "$i" "$@"';
  return { cmd: '/bin/sh', args: ['-c', sh, 'aero', String(pid), img, ...argv.slice(1)], opcoes: { detached: true, stdio: 'ignore', cwd: '/', env: limpo } };
}

module.exports = { precisaSemSandbox, relancarAppImage };
