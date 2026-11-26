// Aero Stream - relatório de diagnóstico: um texto com tudo que ajuda a achar um problema. Sem senhas nem tokens.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero;
  A.diag = {
    // (1.0.2) quanto o app está pesando agora: quadros por segundo em 2 s, quadros lentos, animações sem fim (andando e paradas, as que mais
    // aparecem), camadas de vidro com desfoque, anéis desenhando, tamanho da página e memória. Nada de conta, conversa ou nome de pessoa
    async desempenho(ms = 2000) {
      const lentos = []; let po = null;
      try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lentos.push(e.duration); }); po.observe({ type: 'long-animation-frame' }); } catch (e) { po = null; }
      let q = 0, on = true; const f = () => { q++; if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      await new Promise((r) => setTimeout(r, ms)); on = false; if (po) po.disconnect();
      const inf = (typeof document.getAnimations === 'function' ? document.getAnimations() : []).filter((a) => { try { return a.effect.getTiming().iterations === Infinity; } catch (e) { return false; } });
      const nomes = {}; let andando = 0;
      for (const a of inf) { const parada = a._rel ? a._rel.parada : a.playState !== 'running'; if (!parada) andando++; const k = a.animationName || a.constructor.name; nomes[k] = (nomes[k] || 0) + 1; }
      let vidros = 0; for (const el of document.querySelectorAll('body *')) { const b = getComputedStyle(el).backdropFilter; if (b && b !== 'none' && el.getClientRects().length) vidros++; } // só os que estão na tela
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : '?';
      return { fps: Math.round(q * 1000 / ms), quadrosLentos: lentos.length, msLentos: Math.round(lentos.reduce((s, x) => s + x, 0)), animacoes: inf.length, andando,
        maisVistas: Object.entries(nomes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => k + '×' + n).join(' '), vidros, aneis: A.extras && A.extras._aneisVivos ? A.extras._aneisVivos() : '?',
        elementos: document.getElementsByTagName('*').length, memoria: mem, visual: document.documentElement.dataset.visual || '', foco: A.focado(), frente: A.naFrente(), tela: document.documentElement.dataset.tela || '' };
    },
    async relatorio() {
      const L = [];
      const add = (k, v) => L.push(`${k}: ${v}`);
      add('Aero', 'v' + A.versao + ' (por ' + A.autor + ')');
      add('Data', new Date().toString());
      add('Navegador', navigator.userAgent);
      add('Plataforma', JSON.stringify(A.plat));
      add('Idioma / visual', `${A.idioma()} / ${A.cfg.v.visual}`);
      add('Tema', JSON.stringify({ ...A.cfg.v.tema, imagem: A.cfg.v.tema.imagem ? '(imagem)' : null }));
      add('Servidor', A.api.servidor ? new URL(A.api.servidor).host : '(nenhum)');
      add('Conta', A.api.eu ? `${A.api.eu.nome}#${A.api.eu.tag} (${A.api.eu.codigo})` : '(sem login)');
      add('Hub', A.hub.pronto ? 'conectado' : 'desconectado');
      add('Tela', `${screen.width}x${screen.height} @${devicePixelRatio}x, janela ${innerWidth}x${innerHeight}${innerHeight >= screen.height * 0.97 ? ' (tela cheia)' : ''}`);
      add('CPU/Mem', `${navigator.hardwareConcurrency || '?'} núcleos / ${navigator.deviceMemory || '?'} GB`);
      if (A.plat.desktop && window.aero.diagnostico) { try { add('App do PC', JSON.stringify(await window.aero.diagnostico())); } catch (e) { add('App do PC', 'erro: ' + e.message); } }
      if (A.gpu) {
        const r = A.gpu.resultado;
        add('Teste da placa', r ? JSON.stringify({ hw: r.hw, melhor: r.melhor && r.melhor.id, codec: r.codec }) : '(não feito)');
        if (A.gpu.verificacao) add('Verificação da placa', JSON.stringify(A.gpu.verificacao));
        if (r) r.testes.forEach((t) => add('  - ' + t.id, `ok=${t.ok} fps=${t.fps ? t.fps.toFixed(1) : '-'} hw=${t.hw} impl=${t.impl || '-'} motivo=${t.motivo || '-'}`));
      }
      try { if (RTCRtpSender.getCapabilities) add('Codecs de vídeo', [...new Set(RTCRtpSender.getCapabilities('video').codecs.map((c) => c.mimeType.replace('video/', '')))].join(', ')); } catch (e) { /* ok */ }
      add('Controles', JSON.stringify(A.pad ? A.pad.lista() : []));
      const S = A.sala;
      if (S && S.ativa) {
        add('Sala', `${S.sala} papel=${S.papel} status=${S.status} participantes=${S.participantes.length}`);
        add('Conexões', JSON.stringify(S.estat));
        if (A.kms && S.local && S.local.kms) add('Captura direta', JSON.stringify({ ...(A.kms.info() || {}), transformacao: A.kms._est || null })); // (0.7.4) modo jogo pela placa
        add('Peers', [...S.peers.values()].map((p) => `${p.id}:${p.pc.connectionState}/${p.pc.iceConnectionState}/${p.pc.signalingState}`).join(' '));
      }
      try { const c = A.chamada && A.chamada.diag ? await A.chamada.diag() : null; if (c) add('Chamada', JSON.stringify(c)); } catch (e) { add('Chamada', 'erro: ' + e.message); } // (1.0.3) as salas viraram chamadas: sem isto o relatório não dizia nada da tela
      try { add('Desempenho', JSON.stringify(await A.diag.desempenho())); } catch (e) { add('Desempenho', 'erro: ' + e.message); }
      // (1.0.3) o log citava o código de amigo de quem estava na chamada: no relatório vira "pessoa 1", "pessoa 2"...
      const H = A.hub || {}, cods = new Set([...(H.amigos || []).map((x) => x && x.codigo), ...[...((H.presenca && H.presenca.values()) || [])].map((x) => x && x.codigo)].filter((c) => typeof c === 'string' && c.length >= 5));
      const apelido = new Map([...cods].map((c, i) => [c, 'pessoa' + (i + 1)]));
      const semCodigo = (t) => { let r = String(t); for (const [c, n] of apelido) if (r.includes(c)) r = r.split(c).join(n); return r; };
      L.push('', '--- últimas linhas do log ---', ...A.log.linhas().slice(-120).map(semCodigo));
      return L.join('\n');
    },
  };
})();
