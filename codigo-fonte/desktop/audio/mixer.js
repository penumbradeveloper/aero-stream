// Aero Stream - mistura o som de vários programas (cada um vem de uma captura separada) em um só fluxo estéreo.
// Com uma fonte só, o som passa direto (sem atraso extra). Com várias, junta a cada ~10 ms. Criado por Ryan Victtor.
'use strict';

// (0.6.6) dois motivos do som "pipocando" com vários programas (o normal no Windows 10, que captura programa por programa):
//  1) o relógio: cada passo soltava 10 ms de som, mas o timer do Node dispara sempre um pouco atrasado. Saía menos som do que o tempo real
//     e quem recebia ficava sem som a toda hora. (0.6.7) E o relógio do computador também não serve: o som de cada programa vem no ritmo da
//     PLACA DE SOM, que anda um tiquinho diferente; com o tempo a fila esvaziava (o som parava e voltava) ou transbordava. Agora quem manda
//     é o próprio som: cada passo solta o que a fonte mais adiantada tem além da folga (todas vêm da mesma placa, então andam juntas).
//  2) cada programa entrega o som em blocos, um pouco antes ou depois. Um bloco atrasado virava um buraco. Agora cada fonte junta uma folga
//     (40 ms) antes de entrar na mistura; se esvaziar, junta a folga de novo, sem picotar as outras.
function criarMisturador({ taxa = 48000, emitir = () => {}, passoMs = 10, folgaMs = 40 } = {}) {
  const fontes = new Map(); // id -> { blocos: Float32Array[], quadros, pronta }
  const N = Math.max(1, Math.round((taxa * passoMs) / 1000));
  const folga = Math.round((taxa * folgaMs) / 1000);
  let timer = null;

  function iniciarTimer() {
    if (timer) return;
    timer = setInterval(() => passo(), Math.max(4, Math.round(passoMs / 2))); if (timer.unref) timer.unref(); // confere com frequência; quem decide quanto sai é o som
  }
  function pararTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function retirar(f, n) { // tira n quadros da fila da fonte (completa com silêncio se faltar)
    const saida = new Float32Array(n * 2); let pos = 0;
    while (pos < n && f.blocos.length) {
      const b = f.blocos[0], q = b.length / 2, pegar = Math.min(q, n - pos);
      saida.set(b.subarray(0, pegar * 2), pos * 2); pos += pegar;
      if (pegar === q) f.blocos.shift(); else f.blocos[0] = b.subarray(pegar * 2);
      f.quadros -= pegar;
    }
    return saida;
  }

  // n: quantos quadros soltar (o timer calcula pelo som que chegou; os testes passam o número)
  function passo(n) {
    if (fontes.size < 2) return;
    if (n == null) {
      let maior = 0; for (const f of fontes.values()) if (f.quadros > maior) maior = f.quadros;
      n = Math.min(maior - folga, Math.round(taxa * 0.1)); // o que a fonte mais adiantada tem além da folga (no máximo 100 ms por vez)
      if (n <= 0) return;
    }
    const soma = new Float32Array(n * 2);
    for (const f of fontes.values()) {
      if (f.quadros > taxa * 0.25) { retirar(f, f.quadros - Math.round(taxa * 0.06)); } // acumulou demais: a latência não cresce
      if (!f.pronta) { if (f.quadros >= folga) f.pronta = true; else continue; } // ainda juntando a folga: fica em silêncio por enquanto
      const tinha = f.quadros, x = retirar(f, n);
      if (tinha < n) f.pronta = folga === 0; // esvaziou: junta a folga de novo antes de voltar
      for (let i = 0; i < soma.length; i++) soma[i] += x[i];
    }
    for (let i = 0; i < soma.length; i++) { const v = soma[i]; soma[i] = v > 1 ? 1 : v < -1 ? -1 : v; } // nunca estoura
    emitir(soma);
  }

  return {
    adicionar(id) { fontes.set(id, { blocos: [], quadros: 0, pronta: folga === 0 }); if (fontes.size > 1) iniciarTimer(); },
    remover(id) { fontes.delete(id); if (fontes.size < 2) pararTimer(); },
    escrever(id, f32) {
      const f = fontes.get(id); if (!f || !f32.length) return;
      if (fontes.size < 2) { emitir(f32); return; } // fonte única: direto
      f.blocos.push(f32); f.quadros += f32.length / 2;
    },
    parar() { pararTimer(); fontes.clear(); },
    _passo: (n) => passo(n == null ? N : n),
    N,
  };
}

module.exports = { criarMisturador };
