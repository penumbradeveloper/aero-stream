// Aero Stream - corrige sozinho o bug do kernel que TRAVA a placa AMD (Polaris: RX 470/480/570/580/590, VegaM, Stoney) ao codificar vídeo.
// Criado por Ryan Victtor.
//
// O bug: o commit "drm/amdgpu: Implement insert_end for VCE 3" (kernel 6.12.105+, 6.18.46+ e o 7.3 de desenvolvimento) mudou como os comandos
// são escritos no anel do bloco de vídeo (VCE 3), mas o "align_mask" desse anel continuou 0xf. Com o maior quadro de comandos (20 palavras)
// o anel fica desalinhado e o VCE trava: "ring vce0 timeout" + reset da GPU (e o PC precisa ser reiniciado). A AMD corrigiu em
// "drm/amdgpu: Fix VCE 3 ring align_mask" (0xf -> 0x1f, commit 2ee9836545e6 do kernel principal, que entrou no 7.3), mas nenhum kernel LTS
// recebeu a correção ainda.
//
// O que este módulo faz (Linux, só nessas placas):
//   1. diagnosticar(): SEM administrador. Vê a placa (PCI), se o kernel tem a mudança problemática (o nome da função aparece em /proc/kallsyms),
//      se já está corrigido (kernel novo, ou o módulo corrigido por nós já carregado) e se dá para corrigir aqui (headers, compilador, fonte).
//   2. preparar(): SEM administrador, em segundo plano e com prioridade baixa. Baixa só a pasta do driver AMD do código-fonte EXATO do kernel
//      em uso (CachyOS, Arch ou kernel.org), aplica a correção de UMA linha e compila o amdgpu.ko contra os headers instalados. Qualquer aviso de
//      incompatibilidade aborta (um módulo que não carrega deixaria o PC sem vídeo).
//   3. instalar(): a ÚNICA parte com administrador, pelo pedido de senha do próprio sistema (pkexec/polkit). Copia o módulo para
//      /lib/modules/<kernel>/updates/ (o original do pacote fica intacto), roda o depmod e refaz o initramfs. Depois é só reiniciar.
//      Desfazer: apagar o arquivo de updates/ (ou o app faz: desfazer()).
// Quando o kernel é atualizado, a pasta muda: o app percebe e repete o processo para o kernel novo.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

// Placas com VCE 3 no modo "vm" (o único afetado): Polaris 10/11/12/20/30, VegaM e Stoney (ids PCI da AMD)
const ID_AFETADO = (id) => (id >= 0x67c0 && id <= 0x67ff) || (id >= 0x6980 && id <= 0x699f) || id === 0x6fdf || [0x694c, 0x694e, 0x694f, 0x98e4].includes(id);
// Kernels que já trazem a correção da AMD. O principal a partir do 7.3; os LTS entram aqui quando receberem (a lista chega pela atualização do app).
const CORRIGIDO_EM = { principal: [7, 3], estaveis: {} }; // ex.: estaveis: { '6.18': 60 } = 6.18.60 em diante
const ALVO = 'drivers/gpu/drm/amd';

const sh = (cmd, args, opts = {}) => new Promise((resolve) => {
  execFile(cmd, args, { timeout: opts.timeout || 20000, maxBuffer: 32 << 20, env: { ...process.env, LC_ALL: 'C', LANG: 'C' }, ...opts }, (err, out, eo) => resolve({ ok: !err, out: String(out || ''), err: String(eo || (err && err.message) || ''), codigo: err ? err.code : 0 }));
});
const existe = (p) => { try { fs.accessSync(p); return true; } catch (e) { return false; } };
const temCmd = async (c) => (await sh('sh', ['-c', 'command -v ' + c])).ok;
const versao = (kver) => { const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(kver); return m ? [+m[1], +m[2], +(m[3] || 0)] : [0, 0, 0]; };

function criarVce3({ pastaDados, log = () => {} } = {}) {
  const arqEstado = path.join(pastaDados, 'aero-vce3.json');
  const lerEstado = () => { try { return JSON.parse(fs.readFileSync(arqEstado, 'utf8')); } catch (e) { return {}; } };
  const gravarEstado = (e) => { try { fs.mkdirSync(pastaDados, { recursive: true }); fs.writeFileSync(arqEstado, JSON.stringify(e, null, 1)); } catch (x) { log('vce3 estado: ' + x.message); } };
  const cache = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'aero-stream', 'vce3');

  function placas() {
    const r = [];
    try {
      for (const d of fs.readdirSync('/sys/bus/pci/devices')) {
        const base = path.join('/sys/bus/pci/devices', d);
        const ler = (f) => { try { return fs.readFileSync(path.join(base, f), 'utf8').trim(); } catch (e) { return ''; } };
        if (ler('vendor') !== '0x1002' || !/^0x03/.test(ler('class'))) continue;
        const id = parseInt(ler('device'), 16);
        let driver = ''; try { driver = path.basename(fs.readlinkSync(path.join(base, 'driver'))); } catch (e) { /* sem driver */ }
        r.push({ pci: d, id, idHex: id.toString(16).padStart(4, '0'), afetada: ID_AFETADO(id), driver });
      }
    } catch (e) { /* sem /sys */ }
    return r;
  }

  // De onde vem o código-fonte EXATO do kernel em uso
  async function fonteDe(kver) {
    const [a, b, c] = versao(kver), base = `${a}.${b}.${c}`, baseCurta = c ? base : `${a}.${b}`;
    if (/cachyos/i.test(kver)) {
      const repo = 'https://github.com/CachyOS/linux';
      const r = await sh('git', ['ls-remote', '--tags', repo, `refs/tags/cachyos-${baseCurta}-*`], { timeout: 30000 });
      const tags = (r.out.match(/refs\/tags\/(cachyos-[\d.]+-\d+)$/gm) || []).map((t) => t.replace('refs/tags/', '')).sort((x, y) => +x.split('-').pop() - +y.split('-').pop());
      return tags.length ? { repo, tag: tags[tags.length - 1], distro: 'CachyOS' } : { erro: 'Não achei o código do kernel ' + kver + ' no repositório da CachyOS.' };
    }
    const arch = /-arch(\d+)/.exec(kver);
    if (arch) return { repo: 'https://github.com/archlinux/linux', tag: `v${baseCurta}-arch${arch[1]}`, distro: 'Arch' };
    if (/^\d+\.\d+(\.\d+)?$/.test(kver)) return { repo: 'https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git', tag: 'v' + baseCurta, distro: 'kernel.org' };
    return { erro: 'Este kernel (' + kver + ') é de uma distribuição com mudanças próprias no driver; o app não consegue corrigir sozinho com segurança. Atualize para um kernel 7.3 ou mais novo.' };
  }

  async function diagnosticar() {
    const kver = os.release();
    const r = { plataforma: process.platform, kver, placas: [], aplicavel: false, temBug: false, corrigido: false, podeCorrigir: false, faltando: [], motivo: '' };
    if (process.platform !== 'linux') { r.motivo = 'nao-linux'; return r; }
    r.placas = placas();
    const placa = r.placas.find((p) => p.afetada && p.driver === 'amdgpu');
    if (!placa) { r.motivo = 'placa-nao-afetada'; return r; }
    r.aplicavel = true; r.placa = placa;
    // o kernel tem a mudança problemática? (/proc/kallsyms mostra os nomes das funções mesmo sem administrador)
    // (0.7.9) quem procura é um grep à parte: esse arquivo tem dezenas de MB e o kernel o gera na hora (quase 300 ms). Lido aqui, a tela congelava no meio da
    // abertura: no Wayland é este processo que entrega cada quadro ao sistema
    const temInsertEnd = (await sh('grep', ['-qw', 'vce_v3_0_ring_insert_end', '/proc/kallsyms'])).ok;
    const [a, b, c] = versao(kver);
    const principalOk = a > CORRIGIDO_EM.principal[0] || (a === CORRIGIDO_EM.principal[0] && b >= CORRIGIDO_EM.principal[1]);
    const est = CORRIGIDO_EM.estaveis[`${a}.${b}`];
    const estavelOk = est != null && c >= est;
    r.temBug = temInsertEnd && !principalOk && !estavelOk;
    if (!r.temBug) { r.motivo = temInsertEnd ? 'kernel-ja-corrigido' : 'kernel-sem-a-mudanca'; return r; }
    // já corrigido por nós? (o módulo carregado é o que compilamos para este kernel)
    let src = ''; try { src = fs.readFileSync('/sys/module/amdgpu/srcversion', 'utf8').trim(); } catch (e) { /* ok */ }
    const e = lerEstado(), meu = e[kver];
    r.srcversion = src;
    if (src && ((meu && meu.srcversion === src) || (e.conhecidos || []).includes(src))) { r.corrigido = true; r.motivo = 'corrigido'; return r; }
    if (meu && meu.instalado && meu.srcversion !== src) r.reiniciarPendente = true; // instalado, mas o PC ainda não foi reiniciado
    if (meu && meu.arquivo && existe(meu.arquivo)) r.pronto = true; // já compilado, falta instalar
    // dá para corrigir aqui?
    const build = `/lib/modules/${kver}/build`;
    if (!existe(path.join(build, 'Makefile'))) r.faltando.push('headers');
    let compilador = '';
    try { compilador = fs.readFileSync(path.join(build, 'include/generated/compile.h'), 'utf8'); } catch (x) { /* ok */ }
    r.clang = /clang/i.test(compilador);
    for (const c2 of r.clang ? ['make', 'clang', 'ld.lld', 'git', 'pkexec'] : ['make', 'gcc', 'git', 'pkexec']) if (!(await temCmd(c2))) r.faltando.push(c2);
    const fonte = await fonteDe(kver);
    if (fonte.erro) { r.motivo = 'sem-fonte'; r.erroFonte = fonte.erro; return r; }
    r.fonte = fonte;
    r.podeCorrigir = r.faltando.length === 0;
    r.motivo = r.podeCorrigir ? 'pode-corrigir' : 'faltam-pacotes';
    return r;
  }

  let preparando = null;
  // progresso(etapa, detalhe)
  function preparar(progresso = () => {}) {
    if (preparando) return preparando;
    preparando = (async () => {
      const d = await diagnosticar();
      if (!d.temBug || d.corrigido) return { ok: true, nada: true, d };
      if (!d.podeCorrigir) return { ok: false, erro: d.erroFonte || 'Faltam: ' + d.faltando.join(', '), d };
      const kver = d.kver, pasta = path.join(cache, kver), src = path.join(pasta, 'src');
      const build = `/lib/modules/${kver}/build`;
      fs.mkdirSync(pasta, { recursive: true });
      // 1) só a pasta do driver AMD, do código exato deste kernel (alguns MB em vez do kernel inteiro)
      progresso('baixando', d.fonte.distro + ' ' + d.fonte.tag);
      if (!existe(path.join(src, ALVO, 'amdgpu', 'vce_v3_0.c'))) {
        fs.rmSync(src, { recursive: true, force: true });
        let r = await sh('git', ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', d.fonte.tag, d.fonte.repo, src], { timeout: 900000 });
        if (!r.ok) return { ok: false, erro: 'Não consegui baixar o código do kernel: ' + r.err.slice(-300) };
        r = await sh('git', ['-C', src, 'sparse-checkout', 'set', ALVO, 'include/drm/amd'], { timeout: 900000 });
        if (!r.ok) return { ok: false, erro: 'Não consegui baixar o driver AMD: ' + r.err.slice(-300) };
      }
      // 2) a correção da AMD (só no anel "vm" do VCE 3); se o código já vier com 0x1f, este kernel já está certo
      progresso('corrigindo', 'vce_v3_0.c');
      const arqVce = path.join(src, ALVO, 'amdgpu', 'vce_v3_0.c');
      let codigo = fs.readFileSync(arqVce, 'utf8');
      const ini = codigo.indexOf('vce_v3_0_ring_vm_funcs = {');
      if (ini < 0) return { ok: false, erro: 'O código do VCE 3 deste kernel é diferente do esperado; não mexi em nada.' };
      const fim = codigo.indexOf('};', ini);
      const bloco = codigo.slice(ini, fim);
      if (/\.align_mask\s*=\s*0x1f/.test(bloco)) { const e = lerEstado(); e[kver] = { semBug: true, quando: Date.now() }; gravarEstado(e); return { ok: true, nada: true, jaCorrigidoNoCodigo: true }; }
      if (!/\.align_mask\s*=\s*0xf,/.test(bloco) || !/insert_end\s*=\s*vce_v3_0_ring_insert_end/.test(bloco)) return { ok: false, erro: 'O código do VCE 3 deste kernel é diferente do esperado; não mexi em nada.' };
      codigo = codigo.slice(0, ini) + bloco.replace(/\.align_mask\s*=\s*0xf,/, '.align_mask = 0x1f,') + codigo.slice(fim);
      fs.writeFileSync(arqVce, codigo);
      // os headers de trace usam um caminho relativo à árvore completa do kernel; aqui só existe a pasta do driver
      const trace = path.join(src, ALVO, 'amdgpu', 'amdgpu_trace.h');
      try { fs.writeFileSync(trace, fs.readFileSync(trace, 'utf8').replace(/define TRACE_INCLUDE_PATH \.\.\/\.\.\/drivers/, 'define TRACE_INCLUDE_PATH ' + path.join(src, 'drivers'))); } catch (x) { /* ok */ }
      // 3) compila contra os headers instalados, com prioridade baixa (não atrapalha jogo/transmissão)
      progresso('compilando', 'amdgpu.ko');
      const dir = path.join(src, ALVO, 'amdgpu');
      const args = ['-n', '15', 'make', '-j' + Math.max(1, os.cpus().length), '-C', build, 'M=' + dir, 'modules', ...(d.clang ? ['LLVM=1'] : [])];
      const saida = await new Promise((resolve) => {
        const p = spawn('nice', args, { env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
        let t = ''; const juntar = (x) => { t += x; if (t.length > 4e6) t = t.slice(-2e6); };
        p.stdout.on('data', juntar); p.stderr.on('data', juntar);
        p.on('close', (cod) => resolve({ cod, t })); p.on('error', (e) => resolve({ cod: -1, t: String(e.message) }));
      });
      fs.writeFileSync(path.join(pasta, 'build.log'), saida.t);
      const ko = path.join(dir, 'amdgpu.ko');
      if (saida.cod !== 0 || !existe(ko)) return { ok: false, erro: 'A compilação falhou (detalhes em ' + path.join(pasta, 'build.log') + ').' };
      if (/WARNING: modpost:|undefined!/.test(saida.t)) return { ok: false, erro: 'O módulo compilado não combina com este kernel (modpost avisou). Por segurança não vou instalar.' };
      // 4) confere que é para ESTE kernel e deixa no mesmo formato do original (.ko.zst, .ko.xz ou .ko)
      const mi = await sh('modinfo', ['-F', 'vermagic', ko]);
      if (!mi.out.trim().startsWith(kver + ' ')) return { ok: false, erro: 'O módulo compilado é para outro kernel (' + mi.out.trim() + ').' };
      await sh('strip', ['--strip-debug', ko], { timeout: 120000 });
      const orig = (await sh('modinfo', ['-k', kver, '-n', 'amdgpu'])).out.trim();
      const ext = orig.endsWith('.zst') ? '.zst' : orig.endsWith('.xz') ? '.xz' : orig.endsWith('.gz') ? '.gz' : '';
      const final = path.join(pasta, 'amdgpu.ko' + ext);
      fs.rmSync(final, { force: true });
      if (ext === '.zst') { const r = await sh('zstd', ['-q', '-19', '-T0', '-f', ko, '-o', final], { timeout: 300000 }); if (!r.ok) return { ok: false, erro: 'zstd: ' + r.err }; }
      else if (ext === '.xz') { const r = await sh('sh', ['-c', 'xz -T0 -c --check=crc32 "$1" > "$2"', 'sh', ko, final], { timeout: 300000 }); if (!r.ok) return { ok: false, erro: 'xz: ' + r.err }; }
      else if (ext === '.gz') { const r = await sh('sh', ['-c', 'gzip -9 -c "$1" > "$2"', 'sh', ko, final], { timeout: 300000 }); if (!r.ok) return { ok: false, erro: 'gzip: ' + r.err }; }
      else fs.copyFileSync(ko, final);
      const srcversion = (await sh('modinfo', ['-F', 'srcversion', ko])).out.trim();
      const sha = crypto.createHash('sha256').update(fs.readFileSync(final)).digest('hex');
      fs.rmSync(src, { recursive: true, force: true }); // o código baixado ocupa centenas de MB: só o módulo pronto fica
      const e = lerEstado(); e[kver] = { arquivo: final, ext, srcversion, sha, fonte: d.fonte.tag, quando: Date.now(), instalado: false }; gravarEstado(e);
      progresso('pronto', final);
      return { ok: true, arquivo: final, srcversion };
    })().catch((e) => ({ ok: false, erro: String(e.message || e) })).finally(() => { preparando = null; });
    return preparando;
  }

  // O que roda como administrador. Vai inteiro no próprio comando do pkexec (não fica num arquivo que outro programa pudesse trocar), e o
  // módulo é copiado para uma pasta do root e conferido pelo sha256 DEPOIS da cópia (ninguém troca o arquivo entre a conferência e a instalação).
  const SCRIPT = `set -e
KVER="$1"; ARQ="$2"; EXT="$3"; SHA="$4"; ACAO="$5"
case "$KVER" in *[!A-Za-z0-9._+-]*|"") echo "kernel invalido"; exit 2;; esac
case "$EXT" in ""|.zst|.xz|.gz) ;; *) echo "extensao invalida"; exit 2;; esac
DEST="/lib/modules/$KVER/updates/amdgpu.ko$EXT"
if [ "$ACAO" = "desfazer" ]; then
  rm -f "/lib/modules/$KVER/updates/amdgpu.ko" "/lib/modules/$KVER/updates/amdgpu.ko.zst" "/lib/modules/$KVER/updates/amdgpu.ko.xz" "/lib/modules/$KVER/updates/amdgpu.ko.gz"
else
  TMP=$(mktemp -d /root/aero-vce3.XXXXXX)
  trap 'rm -rf "$TMP"' EXIT
  cp "$ARQ" "$TMP/amdgpu.ko$EXT"
  echo "$SHA  $TMP/amdgpu.ko$EXT" | sha256sum -c - >/dev/null
  install -Dm644 "$TMP/amdgpu.ko$EXT" "$DEST"
fi
depmod -a "$KVER"
if command -v limine-mkinitcpio >/dev/null 2>&1 && [ -d /etc/mkinitcpio.d ]; then limine-mkinitcpio </dev/null
elif [ -x /usr/bin/mkinitcpio ]; then /usr/bin/mkinitcpio -P </dev/null
elif command -v dracut >/dev/null 2>&1; then dracut --force --kver "$KVER"
elif command -v update-initramfs >/dev/null 2>&1; then update-initramfs -u -k "$KVER"
fi
`;

  async function comoAdmin(args) {
    const r = await sh('pkexec', ['/bin/sh', '-c', SCRIPT, 'aero-vce3', ...args], { timeout: 900000 });
    if (r.codigo === 126 || r.codigo === 127) return { ok: false, cancelado: true, erro: 'A senha não foi digitada (ou o pedido foi recusado).' };
    return r.ok ? { ok: true } : { ok: false, erro: (r.err || r.out).trim().slice(-400) };
  }

  async function instalar() {
    const kver = os.release(), e = lerEstado(), meu = e[kver];
    if (!meu || !meu.arquivo || !existe(meu.arquivo)) return { ok: false, erro: 'O módulo ainda não foi preparado.' };
    const sha = crypto.createHash('sha256').update(fs.readFileSync(meu.arquivo)).digest('hex');
    if (sha !== meu.sha) return { ok: false, erro: 'O módulo preparado foi alterado; prepare de novo.' };
    const r = await comoAdmin([kver, meu.arquivo, meu.ext || '', sha, 'instalar']);
    if (r.ok) { meu.instalado = true; meu.instaladoEm = Date.now(); gravarEstado(e); r.reiniciar = true; }
    return r;
  }

  async function desfazer() {
    const kver = os.release();
    const r = await comoAdmin([kver, '-', '', '-', 'desfazer']);
    if (r.ok) { const e = lerEstado(); delete e[kver]; gravarEstado(e); r.reiniciar = true; }
    return r;
  }

  // para quem já tinha corrigido à mão (como na 0.5.2): lembra este módulo como corrigido
  function lembrarCorrigido(srcversion) {
    const e = lerEstado(); e.conhecidos = [...new Set([...(e.conhecidos || []), srcversion])].slice(-20); gravarEstado(e);
  }

  return { diagnosticar, preparar, instalar, desfazer, lembrarCorrigido, _placas: placas, _fonteDe: fonteDe };
}

module.exports = { criarVce3, ID_AFETADO, CORRIGIDO_EM, versao };
