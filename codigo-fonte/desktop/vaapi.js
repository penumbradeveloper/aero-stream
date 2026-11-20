// Aero Stream - verifica se o Linux oferece codificação de vídeo por hardware (VA-API) para o Chromium usar.
// Roda o programa "vainfo" (pacote libva-utils) e lê quais codecs a placa sabe CODIFICAR. Serve para explicar, em português,
// por que o teste da placa caiu no processador (modo leve) e o que instalar/ajustar. Só faz sentido no Linux. Criado por Ryan Victtor.
'use strict';
const { execFile } = require('child_process');

// Lê a saída do vainfo. Devolve { driver, versaoVA, perfis: { H264High: { decodifica, codifica }, ... } }
function interpretar(texto) {
  const t = String(texto || '');
  const driver = (/Driver version:\s*(.+)/i.exec(t) || [])[1] || '';
  const versaoVA = (/VA-API version:\s*([\d.]+)/i.exec(t) || [])[1] || '';
  const perfis = {};
  for (const m of t.matchAll(/VAProfile(\w+)\s*:\s*VAEntrypoint(\w+)/g)) {
    const p = (perfis[m[1]] = perfis[m[1]] || { decodifica: false, codifica: false });
    if (m[2] === 'VLD') p.decodifica = true;
    if (m[2] === 'EncSlice' || m[2] === 'EncSliceLP' || m[2] === 'EncPicture') p.codifica = true;
  }
  return { driver: driver.trim(), versaoVA, perfis };
}

const familia = (perfis, prefixo) => {
  const lista = Object.entries(perfis).filter(([n]) => n.startsWith(prefixo));
  return { decodifica: lista.some(([, v]) => v.decodifica), codifica: lista.some(([, v]) => v.codifica) };
};

// Resume para a interface: o que a placa faz e o que fazer a respeito
function resumir(r) {
  if (!r || !r.presente) return { codigo: r && r.motivo === 'sem-vainfo' ? 'sem-vainfo' : 'erro', h264: { decodifica: false, codifica: false }, hevc: { decodifica: false, codifica: false }, av1: { decodifica: false, codifica: false }, vp9: { decodifica: false, codifica: false } };
  const h264 = familia(r.perfis, 'H264'), hevc = familia(r.perfis, 'HEVC'), av1 = familia(r.perfis, 'AV1'), vp9 = familia(r.perfis, 'VP9');
  return { codigo: h264.codifica ? 'ok' : 'sem-h264-encode', h264, hevc, av1, vp9, driver: r.driver };
}

// Executa o vainfo. Primeiro do jeito automático (Wayland/X11); se falhar, direto pelo dispositivo de vídeo.
function sondar({ exec = execFile, tempo = 5000 } = {}) {
  const rodar = (args) => new Promise((resolve) => {
    exec('vainfo', args, { timeout: tempo, maxBuffer: 1 << 20, env: { ...process.env, LC_ALL: 'C' } }, (erro, saida, saidaErro) => {
      if (erro && erro.code === 'ENOENT') return resolve({ presente: false, motivo: 'sem-vainfo' });
      const texto = String(saida || '') + '\n' + String(saidaErro || '');
      const i = interpretar(texto);
      if (!Object.keys(i.perfis).length) return resolve({ presente: false, motivo: 'sem-perfis', texto: texto.trim().split('\n').slice(0, 12).join('\n') });
      resolve({ presente: true, ...i, linhas: texto.split('\n').filter((l) => /VAProfile|Driver version|VA-API version/.test(l)).map((l) => l.trim()).slice(0, 60) });
    });
  });
  return rodar([]).then((r) => (r.presente || r.motivo === 'sem-vainfo' ? r : rodar(['--display', 'drm', '--device', '/dev/dri/renderD128'])));
}

module.exports = { interpretar, resumir, sondar };
