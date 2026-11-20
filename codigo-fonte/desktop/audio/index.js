// Aero Stream - áudio por aplicativo do app do PC: escolhe o jeito certo para o sistema (Linux: PulseAudio/PipeWire; Windows: Core Audio)
// e entrega o som capturado em blocos PCM (float32, estéreo, entrelaçado). Criado por Ryan Victtor.
'use strict';

function criarAudio({ pastaDados, pidsProprios = () => [process.pid], emitirPCM = () => {}, log = () => {}, plataforma = process.platform, impl = null, extra = {} } = {}) {
  let base = impl;
  const obter = () => {
    if (base) return base;
    if (plataforma === 'win32') base = require('./windows').criarWindows({ pastaDados, pidsProprios, emitirPCM, log, ...extra });
    else if (plataforma === 'linux') base = require('./linux').criarLinux({ pidsProprios, emitirPCM, log });
    return base;
  };
  const SEM = { captura: false, volume: false, listar: false, tipo: plataforma };
  const idOk = (id) => typeof id === 'string' && id.length <= 200;
  return {
    disponivel: async () => { const b = obter(); try { return b ? await b.disponivel() : SEM; } catch (e) { return { ...SEM, tipo: 'erro' }; } },
    listar: async () => { const b = obter(); try { return b ? await b.listar() : []; } catch (e) { return []; } },
    volume: async (id, v) => { const b = obter(); if (b && idOk(id)) await b.volume(id, Math.max(0, Math.min(100, +v || 0))); },
    mudo: async (id, m) => { const b = obter(); if (b && idOk(id)) await b.mudo(id, !!m); },
    capturar: async (o = {}) => {
      const b = obter(); if (!b) return { ok: false, erro: 'sistema-sem-suporte' };
      const ids = Array.isArray(o.ids) ? o.ids.filter(idOk).slice(0, 32) : [];
      try { return await b.capturar({ ids, excluirAero: o.excluirAero !== false, excluirDiscord: !!o.excluirDiscord, janela: typeof o.janela === 'string' ? o.janela.slice(0, 64) : null, nomeJanela: typeof o.nomeJanela === 'string' ? o.nomeJanela.slice(0, 200) : '' }); } catch (e) { return { ok: false, erro: String(e.message || e).slice(0, 200) }; }
    },
    parar: async () => { if (base) { try { await base.parar(); } catch (e) { /* ok */ } } },
    limparAoSair: () => { if (base && base.limparSincrono) { try { base.limparSincrono(); } catch (e) { /* ok */ } } },
  };
}
module.exports = { criarAudio };
