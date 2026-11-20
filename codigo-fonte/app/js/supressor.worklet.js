// Aero Stream - supressão de ruído do microfone na thread de áudio (0.8.4). Criado por Ryan Victtor.
// Antes a supressão era só uma porta controlada por um relógio da interface: ela só agia nos silêncios (o ruído passava inteiro junto
// com a fala) e, com o app minimizado ou atrás de um jogo em tela cheia, o navegador atrasava esse relógio e a porta ficava aberta.
// Agora tudo roda aqui, no ritmo do som:
//  1) filtro espectral: aprende o "chiado" de fundo (ventoinha, ar-condicionado, rua) faixa por faixa de frequência e tira ele de
//     dentro da própria fala; a potência decide o quanto tira;
//  2) porta: no silêncio entre as falas, abaixa o que sobrou (na potência máxima, mudo de verdade).
// Os dois usam a mesma janela de 512 amostras (~10 ms), que também serve de "olhar à frente": a porta abre antes da primeira sílaba.
const N = 512, H = 256, NB = N / 2 + 1;

class SupressorAero extends AudioWorkletProcessor {
  constructor() {
    super();
    this.p = { ligado: true, forca: 60, limiar: -45 };
    this.port.onmessage = (e) => { if (!e.data) return; if (e.data.p) Object.assign(this.p, e.data.p); if (typeof e.data.ref === 'number') this.refNovo = e.data.ref; };
    // (1.0.2) anti-eco: "ref" é o nível do que o Aero está tocando agora. "acop" é quanto desse som volta pelo microfone (dB), aprendido
    // sozinho; a referência demora a cair (o eco chega atrasado e a sala ressoa um pouco)
    this.refNovo = -90; this.ref = -90; this.acop = -25;
    // janela raiz de Hann (análise e síntese): com 50% de sobreposição a soma dá exatamente 1 (sem ruído do próprio filtro)
    this.win = new Float32Array(N);
    for (let i = 0; i < N; i++) this.win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    this.quadro = new Float32Array(N); this.novo = new Float32Array(H); this.nNovo = 0;
    this.soma = new Float32Array(N); this.saida = new Float32Array(H); this.iSaida = 0;
    this.re = new Float64Array(N); this.im = new Float64Array(N);
    this.ruido = new Float64Array(NB); this.suave = new Float64Array(NB); this.ganho = new Float64Array(NB).fill(1); this.g2 = new Float64Array(NB);
    this.quadros = 0;
    // FFT: inversão de bits e senos/cossenos prontos
    this.rev = new Uint16Array(N);
    for (let i = 0, b = Math.log2(N); i < N; i++) { let r = 0; for (let k = 0; k < b; k++) r |= ((i >> k) & 1) << (b - 1 - k); this.rev[i] = r; }
    this.cos = new Float64Array(N / 2); this.sin = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) { this.cos[i] = Math.cos((2 * Math.PI * i) / N); this.sin[i] = Math.sin((2 * Math.PI * i) / N); }
    // porta
    this.gPorta = 1; this.ultimoSom = -1e9; this.t = 0; this.aberto = true;
    this.ataque = Math.exp(-1 / (0.004 * sampleRate)); this.solta = Math.exp(-1 / (0.06 * sampleRate));
    this.segura = Math.round(0.22 * sampleRate); // segura 220 ms depois da última sílaba (não corta o final das palavras)
    this.blocos = 0; this.pico = -90;
  }

  fft(inv) {
    const re = this.re, im = this.im, rev = this.rev;
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let tam = 2; tam <= N; tam <<= 1) {
      const meio = tam >> 1, passo = N / tam;
      for (let i = 0; i < N; i += tam) {
        for (let j = 0, k = 0; j < meio; j++, k += passo) {
          const c = this.cos[k], s = inv ? this.sin[k] : -this.sin[k];
          const a = i + j, b = a + meio, tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }

  // um quadro de 512 amostras: tira o ruído aprendido de cada faixa de frequência
  filtrar(fala) {
    const re = this.re, im = this.im, w = this.win, q = this.quadro, p = this.p;
    for (let i = 0; i < N; i++) { re[i] = q[i] * w[i]; im[i] = 0; }
    this.fft(false);
    const f = Math.min(100, Math.max(0, +p.forca || 0)) / 100, ligado = p.ligado && f > 0;
    const aprende = this.quadros < 25; this.quadros++;
    const subir = 1.004; // o ruído estimado sobe devagar (~4 dB/s): segue um ruído que aumentou sem confundir a fala com ruído
    const exc = 1.5 + f * 5; // quanto do ruído aprendido é tirado (até 6,5x: o estimado fica um pouco abaixo do real, e não pode sobrar chiado)
    const piso = Math.pow(10, -(10 + f * 35) / 20); // o mínimo que cada faixa fica (até -45 dB)
    for (let k = 0; k < NB; k++) {
      const P = re[k] * re[k] + im[k] * im[k] + 1e-20;
      const s = (this.suave[k] = aprende ? P : 0.7 * this.suave[k] + 0.3 * P);
      let r = this.ruido[k];
      if (aprende) r = this.quadros === 1 ? s : 0.8 * r + 0.2 * s;
      else if (s < r) r = 0.85 * r + 0.15 * s; // achou um vale mais baixo: o ruído é no máximo isso
      else if (!fala) r = Math.min(r * 1.06, 0.95 * r + 0.05 * s); // silêncio: aprende rápido o ruído novo
      else r *= subir;
      this.ruido[k] = r;
      let g = 1;
      if (ligado) {
        g = 1 - (exc * r) / P;
        g = g > 0 ? Math.sqrt(g) : 0;
        if (g < piso) g = piso;
        const ant = this.ganho[k];
        g = g > ant ? 0.75 * g + 0.25 * ant : 0.45 * g + 0.55 * ant; // abre rápido, fecha devagar (sem o som "de água")
      }
      this.ganho[k] = g;
    }
    const G = this.g2, gk = this.ganho;
    for (let k = 0; k < NB; k++) G[k] = ligado ? (gk[k > 0 ? k - 1 : k] + 2 * gk[k] + gk[k < NB - 1 ? k + 1 : k]) / 4 : 1;
    for (let k = 0; k < NB; k++) { re[k] *= G[k]; im[k] *= G[k]; if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; } }
    this.fft(true);
    const s = this.soma;
    for (let i = 0; i < N; i++) s[i] += (re[i] / N) * w[i];
  }

  process(entradas, saidas) {
    const ent = entradas[0] && entradas[0][0], sai = saidas[0] && saidas[0][0];
    if (!sai) return true;
    const n = sai.length, p = this.p;
    // nível deste bloco (antes do filtro): decide a porta
    let e = 0;
    if (ent) for (let i = 0; i < n; i++) e += ent[i] * ent[i];
    const db = 10 * Math.log10(e / n + 1e-12);
    if (db > this.pico) this.pico = db;
    const f = Math.min(100, Math.max(0, +p.forca || 0));
    // anti-eco: segura a referência por ~250 ms depois que o som para (cai 0,6 dB a cada bloco de ~2,7 ms)
    this.ref = this.refNovo > this.ref ? this.refNovo : Math.max(this.refNovo, this.ref - 0.6);
    let eco = false;
    if (p.eco && p.ligado && this.ref > -60) {
      const d = db - this.ref; // quanto o microfone está acima do que toca
      // aprende o acoplamento pelos momentos mais baixos (só eco): desce rápido, sobe bem devagar (a sua voz não ensina errado)
      if (d < this.acop) this.acop = 0.9 * this.acop + 0.1 * d; else this.acop += 0.004;
      if (this.acop < -45) this.acop = -45; else if (this.acop > -3) this.acop = -3;
      eco = db < this.ref + this.acop + 9; // até 9 dB acima do eco esperado ainda é eco; a sua voz passa disso
    }
    if (db > p.limiar && !eco) this.ultimoSom = this.t;
    const fala = this.t - this.ultimoSom < this.segura;
    this.aberto = !p.ligado || fala;
    const reducao = 20 + f * 0.8; // dB que a porta fechada abaixa (60 -> 68 dB; 95+ -> mudo)
    const alvo = this.aberto ? 1 : f >= 95 ? 0 : Math.pow(10, -reducao / 20);
    for (let i = 0; i < n; i++) {
      sai[i] = this.saida[this.iSaida++];
      this.novo[this.nNovo++] = ent ? ent[i] : 0;
      if (this.nNovo === H) {
        this.quadro.copyWithin(0, H); this.quadro.set(this.novo, H); this.nNovo = 0;
        this.filtrar(fala);
        this.saida.set(this.soma.subarray(0, H)); this.soma.copyWithin(0, H); this.soma.fill(0, H); this.iSaida = 0;
      }
      const c = alvo > this.gPorta ? this.ataque : this.solta;
      this.gPorta = alvo + (this.gPorta - alvo) * c;
      sai[i] *= this.gPorta;
    }
    for (let k = 1; k < saidas[0].length; k++) saidas[0][k].set(sai);
    this.t += n;
    if (++this.blocos >= 16) { this.port.postMessage({ aberto: this.aberto, db: this.pico }); this.blocos = 0; this.pico = -90; }
    return true;
  }
}

registerProcessor('supressor-aero', SupressorAero);
