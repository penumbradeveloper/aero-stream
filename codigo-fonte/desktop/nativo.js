// Aero Stream - compila, no próprio Windows, os pequenos auxiliares em C# (entrada e áudio por aplicativo).
// Todo Windows 10/11 já traz o compilador do .NET Framework (csc.exe); nada precisa ser instalado e nenhum .exe vem pronto no pacote:
// o código-fonte fica em desktop/**/nativo/*.cs, à vista, e o .exe é gerado na pasta de dados do app na primeira vez que é preciso.
// Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

function acharCsc(env = process.env) {
  const win = env.WINDIR || env.SystemRoot || 'C:\\Windows';
  const lista = [path.join(win, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), path.join(win, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')];
  return lista.find((c) => { try { return fs.statSync(c).isFile(); } catch (e) { return false; } }) || null;
}

// Devolve o caminho do .exe (compilando só se ainda não existir uma versão igual ao código-fonte).
// { nome, fonte (texto C#), pasta (onde gravar), refs (DLLs extras) } -> Promise<{ ok, exe? , erro? }>
function compilar({ nome, fonte, pasta, refs = [], unsafe = false }) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({ ok: false, erro: 'so-windows' });
    const csc = acharCsc();
    if (!csc) return resolve({ ok: false, erro: 'sem-csc' });
    const hash = crypto.createHash('sha1').update(fonte).digest('hex').slice(0, 10);
    const exe = path.join(pasta, `${nome}-${hash}.exe`), cs = path.join(pasta, `${nome}-${hash}.cs`);
    try { fs.mkdirSync(pasta, { recursive: true }); if (fs.existsSync(exe) && fs.statSync(exe).size > 2048) return resolve({ ok: true, exe }); fs.writeFileSync(cs, fonte, 'utf8'); }
    catch (e) { return resolve({ ok: false, erro: 'gravar: ' + e.message }); }
    const args = ['/nologo', '/optimize+', '/target:exe', '/platform:anycpu', '/out:' + exe, ...(unsafe ? ['/unsafe'] : []), ...refs.map((r) => '/r:' + r), cs];
    execFile(csc, args, { timeout: 60000, windowsHide: true, maxBuffer: 1 << 20 }, (err, out, errout) => {
      if (err || !fs.existsSync(exe)) return resolve({ ok: false, erro: 'compilar: ' + String((out || '') + (errout || '') || (err && err.message)).trim().slice(0, 600) });
      // apaga versões antigas
      try { for (const f of fs.readdirSync(pasta)) if (f.startsWith(nome + '-') && !f.includes(hash)) fs.rmSync(path.join(pasta, f), { force: true }); } catch (e) { /* ok */ }
      resolve({ ok: true, exe });
    });
  });
}

module.exports = { compilar, acharCsc };
