// Aero - (1.0.0) entrar em outro aparelho pelo QR code. O aparelho LOGADO mostra um QR e um código curto que muda a cada 30 s
// (A.ui.mostrarQrEntrada); o aparelho novo, na tela de entrar, lê o QR com a câmera (A.ui.cameraQr) ou digita o código, e o logado
// ainda confirma "entrar em tal aparelho?". A leitura usa o BarcodeDetector do sistema quando existe; se não, carrega o jsQR
// (js/jsqr.js, licença Apache 2.0) só nessa hora.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  let jsqrPromessa = null;
  const carregarJsqr = () => jsqrPromessa || (jsqrPromessa = new Promise((ok, falha) => {
    if (window.jsQR) return ok(window.jsQR);
    const s = document.createElement('script'); s.src = 'js/jsqr.js';
    s.onload = () => (window.jsQR ? ok(window.jsQR) : falha(new Error('jsQR'))); s.onerror = () => { jsqrPromessa = null; falha(new Error('jsQR')); };
    document.head.append(s);
  }));
  // o texto do QR: "AERO-ENTRAR:" + 8 letras e números
  // (1.0.2) o QR agora é um LINK do site (…/app/?qr=XXXXXXXX): lido pela câmera normal do celular, abre o Aero Web já entrando. Antes era só
  // o texto "AERO-ENTRAR:…", que a câmera do celular não sabia abrir (o "leitor de QR não funciona"). Os dois jeitos continuam valendo
  A.ui.linkQrEntrada = (id) => (A.SITE || 'https://web.aerostream.workers.dev') + '/app/?qr=' + id;
  A.ui.codigoQrEntrada = (txt) => {
    const t = String(txt || '').trim();
    let m = /^AERO-ENTRAR:([A-Z0-9]{8})$/i.exec(t); if (m) return m[1].toUpperCase();
    m = /^https:\/\/[a-z0-9.-]+\/app\/?\?(?:.*&)?qr=([A-Z0-9]{8})(?:&.*)?$/i.exec(t); return m ? m[1].toUpperCase() : null;
  };
  let qrDoLink = null;
  { const q = new URLSearchParams(location.search).get('qr'); if (q && /^[A-Z0-9]{8}$/i.test(q)) { qrDoLink = q.toUpperCase(); try { history.replaceState(null, '', location.pathname); } catch (_) { /* ok */ } } }
  A.ui.qrPendente = () => { const q = qrDoLink; qrDoLink = null; return q; }; // (uma vez só)

  // liga a câmera num <video> e chama aoLer(texto) com o que achar; devolve uma promessa com { parar } (ou um erro com a explicação)
  A.ui.cameraQr = async (video, aoLer) => {
    let st = null, laco = 0, acabou = false;
    const parar = () => { acabou = true; clearTimeout(laco); if (st) st.getTracks().forEach((t) => t.stop()); st = null; video.srcObject = null; };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error(T('Sem câmera aqui: digite o código.', 'No camera here: type the code.'));
    try { st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }); }
    catch (e) { throw new Error(T('Não consegui abrir a câmera: digite o código.', 'Could not open the camera: type the code.')); }
    video.muted = true; video.srcObject = st; video.play().catch(() => {});
    let detector = null;
    try { if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { detector = null; }
    let jsqr = null; if (!detector) { try { jsqr = await carregarJsqr(); } catch (_) { parar(); throw new Error(T('Não consegui ler QR aqui: digite o código.', 'Could not read QR codes here: type the code.')); } }
    const tela = document.createElement('canvas'), ctx = tela.getContext('2d', { willReadFrequently: true });
    const ler = async () => {
      if (acabou) return;
      try {
        if (video.readyState >= 2 && video.videoWidth) {
          let txt = null;
          if (detector) { const r = await detector.detect(video); txt = r && r[0] && r[0].rawValue; }
          else {
            const esc = Math.min(1, 720 / video.videoWidth); tela.width = Math.round(video.videoWidth * esc); tela.height = Math.round(video.videoHeight * esc);
            ctx.drawImage(video, 0, 0, tela.width, tela.height);
            const r = jsqr(ctx.getImageData(0, 0, tela.width, tela.height).data, tela.width, tela.height, { inversionAttempts: 'dontInvert' });
            txt = r && r.data;
          }
          if (txt && !acabou && aoLer(txt) === true) return; // aoLer devolve true quando era o QR certo (aí a câmera para de procurar)
        }
      } catch (_) { /* quadro ruim: tenta o próximo */ }
      laco = setTimeout(ler, 220);
    };
    ler();
    return { parar };
  };

  // o aparelho logado: QR + código que muda a cada 30 s; quando alguém lê, pergunta se pode entrar
  A.ui.mostrarQrEntrada = () => {
    const U = A.ui, API = A.api;
    let atual = null, ate = 0, laco = 0, erroTxt = '', tentarDe = 0, fechado = false, ocupado = false, decidindo = false;
    const desenho = h('div', { class: 'qr-ent-desenho' });
    const codigo = h('div', { class: 'qr-ent-codigo selecionavel' });
    const barra = h('i'), tempo = h('div', { class: 'qr-ent-barra', 'aria-hidden': 'true' }, barra);
    const falta = h('div', { class: 'peq suave qr-ent-falta' });
    const telaQr = h('div', { class: 'col qr-ent' },
      h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('No outro aparelho, escolha "QR code" na tela de entrar e leia este QR com a câmera (ou digite o código embaixo dele).', 'On the other device, pick "QR code" on the sign-in screen and scan this QR with the camera (or type the code below it).')),
      desenho, codigo, tempo, falta);
    const corpo = h('div', { class: 'col' }, telaQr);
    const parar = () => { fechado = true; clearInterval(laco); };
    const m = U.modal(T('Entrar em outro aparelho', 'Sign in on another device'), corpo, { largura: 400, aoFechar: parar, acoes: [{ texto: T('Fechar', 'Close'), tipo: 'sec', valor: false }] });
    const novo = async () => {
      let r;
      try { r = await API.qrGerar(atual); } catch (e) { atual = null; erroTxt = e.message; tentarDe = Date.now() + 5000; desenho.replaceChildren(); codigo.textContent = ''; throw e; }
      erroTxt = ''; if (fechado) return;
      atual = r.id; ate = Date.now() + (r.validade || 30000);
      desenho.replaceChildren(A.qr ? A.qr(A.ui.linkQrEntrada(r.id), 220) : h('span'));
      codigo.textContent = r.id.slice(0, 4) + '-' + r.id.slice(4);
    };
    const pintarTempo = () => {
      if (!atual) { barra.style.transform = 'scaleX(0)'; falta.textContent = erroTxt; return; }
      const f = Math.max(0, ate - Date.now());
      barra.style.transform = `scaleX(${(f / 30000).toFixed(3)})`;
      falta.textContent = T('Muda em ', 'Changes in ') + Math.ceil(f / 1000) + ' s';
    };
    const perguntar = (info) => {
      decidindo = true;
      const onde = [info.maquina, info.so].filter(Boolean).join(' · ') || T('um aparelho', 'a device');
      const decidir = async (sim) => {
        try { await API.qrDecidir(atual, sim); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
        if (sim) { U.toast(T('Pronto! O outro aparelho já está entrando.', 'Done! The other device is signing in.'), { tipo: 'ok' }); m.fechar(); return; }
        atual = null; decidindo = false; corpo.replaceChildren(telaQr); try { await novo(); pintarTempo(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      };
      corpo.replaceChildren(h('div', { class: 'col qr-ent-pedido' },
        h('p', { estilo: { 'font-size': '17px', margin: 0 } }, T('Entrar na sua conta em ', 'Sign in to your account on '), h('b', {}, onde), '?'),
        h('p', { class: 'peq suave', estilo: { margin: 0 } }, T('Só permita se esse aparelho for seu e estiver na sua frente. Quem tiver ele vai usar a sua conta.', 'Only allow it if that device is yours and right in front of you. Whoever has it will use your account.')),
        h('div', { class: 'linha', estilo: { gap: '8px', 'justify-content': 'flex-end', 'flex-wrap': 'wrap' } },
          U.btn(T('Recusar', 'Decline'), { tipo: 'sec', onclick: () => decidir(false) }), U.btn(T('Permitir', 'Allow'), { icone: 'ok', onclick: () => decidir(true) }))));
      A.som.tocar('msg');
    };
    (async () => {
      try { await novo(); } catch (_) { /* aparece embaixo do QR */ }
      pintarTempo();
      laco = setInterval(async () => {
        if (fechado || !corpo.isConnected) { parar(); return; }
        if (!decidindo) pintarTempo();
        if (ocupado || decidindo) return; ocupado = true;
        try {
          const d = atual ? await API.qrMeu(atual) : null; if (fechado) return;
          if (d && d.estado === 'pedido') { perguntar(d); return; }
          if (!atual && Date.now() < tentarDe) return; // não deu para gerar: tenta de novo a cada 5 s
          if (!atual || Date.now() >= ate || (d && d.estado === 'venceu')) { await novo(); pintarTempo(); }
        } catch (_) { /* sem internet agora: tenta de novo no próximo */ } finally { ocupado = false; }
      }, 1000);
    })();
  };
})();
