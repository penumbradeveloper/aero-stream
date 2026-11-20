// Aero Stream - fila do som do computador (vindo do app do PC em blocos) tocada pela thread de áudio (0.6.6). Criado por Ryan Victtor.
// Antes isso rodava num ScriptProcessor na thread da interface: num PC fraco, qualquer travadinha da tela virava um buraco de 43 ms no som
// ("pipocando"). Aqui a thread de áudio pede 128 quadros por vez e a fila guarda uma folga para os blocos que chegam atrasados.
// (0.6.7) O som chega no ritmo da placa de som de onde ele vem, e esta fila é tocada no ritmo de OUTRO relógio (o do AudioContext). A
// diferença é minúscula, mas com o tempo a fila esvaziava (o som parava e voltava) ou transbordava (pulava um pedaço). Agora a velocidade
// de leitura se ajusta sozinha em até 0,4% (ninguém percebe) para a fila ficar sempre perto do alvo: nunca esvazia, nunca transborda.
class FilaAero extends AudioWorkletProcessor {
  constructor() {
    super();
    const N = Math.max(16384, Math.round(sampleRate)); // 1 s
    this.L = new Float32Array(N); this.R = new Float32Array(N); this.N = N; this.w = 0; this.pos = 0; this.pronto = false;
    // (0.6.8) folga maior (~150 ms): o som chega pela interface do app, e num PC fraco uma travadinha dela (ou do app do PC) segurava os blocos
    // por um instante. Com 150 ms guardados, a fila aguenta essa espera sem o som de quem assiste parar
    this.folga = Math.round(sampleRate * 0.1); this.alvo = Math.round(sampleRate * 0.15);
    this.teto = Math.round(sampleRate * 0.45); this.passo = 1; this.media = this.alvo;
    this.port.onmessage = (e) => this.escrever(e.data.pcm, e.data.canais || 2);
  }
  cheio() { return (this.w - Math.floor(this.pos) + this.N) % this.N; }
  escrever(pcm, canais) {
    if (!pcm || !pcm.length) return;
    const { L, R, N } = this, n = Math.floor(pcm.length / canais);
    for (let i = 0; i < n; i++) {
      const a = pcm[i * canais], b = canais > 1 ? pcm[i * canais + 1] : a;
      L[this.w] = a === a ? a : 0; R[this.w] = b === b ? b : 0; // NaN vira silêncio
      this.w = (this.w + 1) % N;
    }
    // acumulou demais de uma vez (o computador travou alguns segundos): volta para o alvo, a latência não cresce
    if (this.cheio() > this.teto) { this.pos = (this.w - this.alvo + N) % N; this.media = this.alvo; }
  }
  process(_entradas, saidas) {
    const out = saidas[0], sl = out[0], sr = out[1] || out[0], n = sl.length, N = this.N;
    if (!this.pronto) { if (this.cheio() >= this.folga) this.pronto = true; else { sl.fill(0); if (sr !== sl) sr.fill(0); return true; } }
    // quanto a fila está acima ou abaixo do alvo (média suave): ajusta a velocidade de leitura em no máximo ±0,4%
    this.media += (this.cheio() - this.media) * 0.01;
    const erro = (this.media - this.alvo) / this.alvo;
    this.passo = 1 + Math.max(-0.004, Math.min(0.004, erro * 0.01));
    for (let i = 0; i < n; i++) {
      if (this.cheio() < 2) { sl.fill(0, i); if (sr !== sl) sr.fill(0, i); this.pronto = false; return true; } // esvaziou mesmo: junta a folga de novo
      const k = Math.floor(this.pos), fr = this.pos - k, k2 = (k + 1) % N;
      sl[i] = this.L[k] + (this.L[k2] - this.L[k]) * fr;
      if (sr !== sl) sr[i] = this.R[k] + (this.R[k2] - this.R[k]) * fr;
      this.pos += this.passo; if (this.pos >= N) this.pos -= N;
    }
    return true;
  }
}
registerProcessor('fila-aero', FilaAero);
