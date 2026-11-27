// Aero Stream - tela de aparência (Configurações). Básico: cor, modo escuro, vidro, desfoques, arredondamento, bolhas, parallax,
// animações. Avançado: cada parte com a sua cor, fundo sólido/degradê (forma, ângulo, posição), bolhas (cores, degradê, direção,
// quantidade, tamanho, velocidade, PNG próprio). Tudo passa por A.tema.sanear: nenhum valor consegue quebrar a interface.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, U = A.ui, T = A.T;
  const PALETAS = ['#2d9ee0', '#1fb6a6', '#4caf50', '#a3c614', '#f0a020', '#e5533d', '#e0559c', '#8a63e0'];
  const t = () => A.cfg.v.tema;

  // (1.0.3) arrastando um controle, o tema entra no máximo a cada 50 ms e é gravado 400 ms depois do último passo: cada passo refazia o
  // estilo da página inteira e gravava todas as configurações (com a imagem de fundo junto), e o controle travava na mão
  let tAplicar = 0, ultimoAplicar = 0, tGravar = 0;
  const aplicarJa = () => { clearTimeout(tAplicar); tAplicar = 0; ultimoAplicar = performance.now(); A.tema.aplicar(); };
  const gravarJa = () => { clearTimeout(tGravar); tGravar = 0; if (!A.cfg.salvar()) U.toast(T('Sem espaço para guardar essa configuração (a imagem pode estar pesada demais).', 'No room to store this setting (the image may be too heavy).'), { tipo: 'erro' }); };
  addEventListener('pagehide', () => { if (tGravar) gravarJa(); });
  // (1.0.5) mexeu no fundo ou nas bolhas aqui: a marca de "imagem em outro aparelho" (veja api.js) deixa de valer
  function esquecerFora(m) { const t = A.cfg.v.tema || {}; if (m && ('fundoTipo' in m || 'imagem' in m)) delete t.imgFora; if (m && 'bolhasImagem' in m) delete t.bolhasFora; }
  function salvarSuave(mudou) {
    esquecerFora(mudou);
    Object.assign(A.cfg.v.tema, mudou);
    const falta = 50 - (performance.now() - ultimoAplicar);
    if (falta <= 0 && !tAplicar) aplicarJa(); else if (!tAplicar) tAplicar = setTimeout(aplicarJa, Math.max(0, falta));
    clearTimeout(tGravar); tGravar = setTimeout(gravarJa, 400);
  }
  function salvar(mudou) {
    esquecerFora(mudou);
    if (tAplicar) { clearTimeout(tAplicar); tAplicar = 0; }
    if (tGravar) { clearTimeout(tGravar); tGravar = 0; }
    Object.assign(A.cfg.v.tema, mudou);
    A.tema.aplicar();
    if (!A.cfg.salvar()) U.toast(T('Sem espaço para guardar essa configuração (a imagem pode estar pesada demais).', 'No room to store this setting (the image may be too heavy).'), { tipo: 'erro' });
  }
  const autoPaleta = () => A.tema.paleta(t().cor, t().escuro, t().destaque);
  const autoFundo = () => A.tema.paleta(A.tema.COR_PADRAO, t().escuro); // o fundo e as bolhas não seguem a cor principal
  const opcao = (rot, controle, desc) => h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', { estilo: { 'font-weight': '600' } }, rot), desc ? h('div', { class: 'peq suave' }, desc) : null), controle);

  // Slider com valor ao lado. O limite vem de A.tema.LIM (o mesmo que o saneador usa).
  function slid(rot, k, fmt, { dica, aoMudar } = {}) {
    const [mi, ma] = A.tema.LIM[k];
    const v = h('b', {}, fmt(t()[k]));
    const s = U.slider({ min: mi, max: ma, valor: t()[k], oninput: (x) => { v.textContent = fmt(x); salvarSuave({ [k]: x }); aoMudar && aoMudar(x); }, onchange: (x) => salvar({ [k]: x }) });
    const caixa = h('div', { class: 'slid' }, h('div', { class: 'linha entre' }, h('span', {}, rot), v), s, dica ? h('div', { class: 'peq suave' }, dica) : null);
    caixa.sync = () => { s.atualizar(t()[k]); v.textContent = fmt(t()[k]); };
    return caixa;
  }

  // Campo de cor: seletor + HEX + "auto" (volta para a cor que a paleta escolheria sozinha)
  function campoCor(rot, ler, gravar, auto) {
    const hex = h('input', { class: 'campo', maxlength: 7, spellcheck: 'false', placeholder: 'auto', 'aria-label': rot, estilo: { width: '104px', 'font-family': 'monospace' } });
    const cor = h('input', { type: 'color', 'aria-label': rot });
    const sync = () => { const v = ler(); hex.value = v || ''; cor.value = v || auto(); cor.classList.toggle('auto', !v); };
    cor.addEventListener('input', () => { gravar(cor.value); hex.value = cor.value; cor.classList.remove('auto'); });
    hex.addEventListener('change', () => {
      const bruto = hex.value.trim();
      if (!bruto) { gravar(''); sync(); return; }
      const v = A.tema.validarHex(bruto);
      if (!v) { U.toast(T('Cor inválida. Use algo como #2d9ee0', 'Invalid color. Use something like #2d9ee0'), { tipo: 'erro' }); sync(); return; }
      gravar(v); sync();
    });
    // (0.8.7) vira um "pote de tinta": a gota grande é o seletor (abre a Aquarela), com o nome, o código e o botão de voltar ao automático
    const caixa = h('div', { class: 'cor-campo tinta' }, cor, h('div', { class: 'tinta-tx' }, h('b', {}, rot), hex),
      U.btn('', { icone: 'atualizar', tipo: 'sec', peq: true, redondo: true, titulo: T('Voltar à cor automática', 'Back to the automatic color'), onclick: () => { gravar(''); sync(); } }));
    caixa.sync = sync; sync();
    return caixa;
  }

  function secao() {
    const sincronizaveis = [];
    const reg = (x) => { sincronizaveis.push(x); return x; };

    // ----- cor principal -----
    const hexI = h('input', { class: 'campo', maxlength: 7, spellcheck: 'false', 'aria-label': T('Cor principal em HEX', 'Main color as HEX'), estilo: { width: '110px', 'font-family': 'monospace' } });
    const cor = h('input', { type: 'color', 'aria-label': T('Cor principal', 'Main color') });
    const sincCor = () => { hexI.value = t().cor; cor.value = t().cor; };
    const trocarCor = (hex) => { const v = A.tema.validarHex(hex); if (v) { salvar({ cor: v }); sincCor(); sincronizaveis.forEach((x) => x.sync && x.sync()); } };
    cor.addEventListener('input', () => { hexI.value = cor.value; salvar({ cor: cor.value }); });
    cor.addEventListener('change', () => sincronizaveis.forEach((x) => x.sync && x.sync()));
    hexI.addEventListener('change', () => { if (!A.tema.validarHex(hexI.value)) { U.toast(T('Cor inválida. Use algo como #2d9ee0', 'Invalid color. Use something like #2d9ee0'), { tipo: 'erro' }); sincCor(); } else trocarCor(hexI.value); });
    sincCor();

    // ----- imagem de fundo -----
    const nomeImg = h('span', { class: 'peq suave' });
    const textoFundo = () => { nomeImg.textContent = t().fundoTipo === 'imagem' ? T('imagem personalizada', 'custom image') : t().fundoTipo === 'solido' ? T('cor sólida', 'solid color') : T('degradê', 'gradient'); };
    textoFundo();
    const imgArq = h('input', { type: 'file', accept: 'image/*', hidden: true });
    imgArq.addEventListener('change', async () => {
      try {
        const f = imgArq.files[0]; if (!f) return;
        const r = await A.tema.imagemDeFundo(f);
        salvar({ fundoTipo: 'imagem', imagem: r.dataUrl, imagemAnim: r.anim, cor: r.hex }); A.tema.limparArqs(); sincCor(); textoFundo(); tipoFundo.atualizar('imagem'); mostrarTipo();
        sincronizaveis.forEach((x) => x.sync && x.sync());
        A.som.tocar('sucesso'); U.toast(T('Cores ajustadas à imagem!', 'Colors matched to the image!'), { tipo: 'ok' });
      } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      imgArq.value = '';
    });
    const bolhaArq = h('input', { type: 'file', accept: 'image/png,image/webp,image/gif,image/jpeg', hidden: true });
    const nomeBolha = h('span', { class: 'peq suave' });
    const textoBolha = () => { nomeBolha.textContent = t().bolhasImagem ? T('imagem própria', 'custom image') : T('padrão (vidro)', 'default (glass)'); };
    textoBolha();
    bolhaArq.addEventListener('change', async () => {
      try {
        const f = bolhaArq.files[0]; if (!f) return;
        const d = await A.tema.imagemDeBolha(f);
        salvar({ bolhasImagem: d, bolhas: true }); textoBolha(); A.som.tocar('sucesso');
      } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      bolhaArq.value = '';
    });

    // ----- tipo de fundo (avançado) -----
    const blocoGrad = h('div', { class: 'col', estilo: { gap: '10px' } }), blocoSolido = h('div', { class: 'col', estilo: { gap: '10px' } }), blocoImagem = h('div', { class: 'col', estilo: { gap: '10px' } });
    const mostrarTipo = () => { const k = t().fundoTipo; blocoGrad.hidden = k !== 'gradiente'; blocoSolido.hidden = k !== 'solido'; blocoImagem.hidden = k !== 'imagem'; textoFundo(); };
    const tipoFundo = U.seg([['gradiente', T('Degradê', 'Gradient')], ['solido', T('Cor sólida', 'Solid')], ['imagem', T('Imagem', 'Image')]], t().fundoTipo, (v) => {
      if (v === 'imagem' && !t().imagem) { mostrarTipo(); tipoFundo.atualizar(t().fundoTipo); imgArq.click(); return; } // sem imagem ainda: abre o seletor e mantém a seleção antiga se ele for cancelado
      salvar({ fundoTipo: v }); mostrarTipo();
    });
    // o seg não tem "atualizar": refaz a seleção na mão
    tipoFundo.atualizar = (v) => tipoFundo.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', ['gradiente', 'solido', 'imagem'][i] === v));
    const corFundo = (i, rot) => reg(campoCor(rot, () => t().fundoCores[i], (v) => { const c = t().fundoCores.slice(); c[i] = v; salvar({ fundoCores: c }); }, () => [autoFundo().bg1, autoFundo().bg2, autoFundo().bg3][i]));
    const formaSeg = U.seg([['linear', T('Linear', 'Linear')], ['radial', T('Radial', 'Radial')]], t().fundoForma, (v) => { salvar({ fundoForma: v }); formaMostrar(); });
    const blocoLinear = h('div', {}), blocoRadial = h('div', { class: 'col', estilo: { gap: '8px' } });
    const formaMostrar = () => { blocoLinear.hidden = t().fundoForma !== 'linear'; blocoRadial.hidden = t().fundoForma !== 'radial'; };
    blocoLinear.append(reg(slid(T('Ângulo', 'Angle'), 'fundoAngulo', (x) => x + '°')));
    blocoRadial.append(reg(slid(T('Posição horizontal', 'Horizontal position'), 'fundoX', (x) => x + '%')), reg(slid(T('Posição vertical', 'Vertical position'), 'fundoY', (x) => x + '%')));
    blocoGrad.append(formaSeg, blocoLinear, blocoRadial, corFundo(0, T('Cor 1 (início)', 'Color 1 (start)')), corFundo(1, T('Cor 2 (meio)', 'Color 2 (middle)')), corFundo(2, T('Cor 3 (fim)', 'Color 3 (end)')));
    blocoSolido.append(corFundo(0, T('Cor do fundo', 'Background color')));
    blocoImagem.append(h('div', { class: 'linha' }, nomeImg, U.btn(T('Trocar imagem', 'Change image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => imgArq.click() })));
    formaMostrar(); mostrarTipo();

    // ----- bolhas (avançado) -----
    const modos = [['subir', T('Subir', 'Up')], ['descer', T('Descer', 'Down')], ['esq', T('Esquerda', 'Left')], ['dir', T('Direita', 'Right')], ['parado', T('Flutuar no lugar', 'Float in place')]];
    const modoSel = h('select', { class: 'campo', 'aria-label': T('Direção das bolhas', 'Bubble direction') }, modos.map(([v, r]) => h('option', { value: v }, r)));
    modoSel.value = t().bolhasModo; modoSel.addEventListener('change', () => salvar({ bolhasModo: modoSel.value }));
    const gradAng = reg(slid(T('Ângulo do degradê da bolha', 'Bubble gradient angle'), 'bolhasAngulo', (x) => x + '°'));
    const gradChave = U.chave(t().bolhasGradiente, (v) => { salvar({ bolhasGradiente: v }); gradAng.hidden = !v; });
    gradAng.hidden = !t().bolhasGradiente;

    // ----- layout (0.8.3): vidro (cor e padrão, como o fundo), HUD, texto, fonte e a moldura das embeds -----
    const vImgArq = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const vBlocoSol = h('div', { class: 'col', estilo: { gap: '10px' } }), vBlocoGrad = h('div', { class: 'col', estilo: { gap: '10px' } }), vBlocoImg = h('div', { class: 'col', estilo: { gap: '10px' } });
    const vMostrar = () => { const k = t().vidroTipo; vBlocoSol.hidden = k !== 'solido'; vBlocoGrad.hidden = k !== 'gradiente'; vBlocoImg.hidden = k !== 'imagem'; };
    const V_TIPOS = ['auto', 'solido', 'gradiente', 'imagem'];
    const tipoVidro = U.seg([['auto', T('Automático', 'Automatic')], ['solido', T('Cor sólida', 'Solid')], ['gradiente', T('Degradê', 'Gradient')], ['imagem', T('Imagem', 'Image')]], t().vidroTipo, (v) => {
      if (v === 'imagem' && !t().vidroImagem) { tipoVidro.atualizar(t().vidroTipo); vImgArq.click(); return; }
      salvar({ vidroTipo: v }); vMostrar();
    });
    tipoVidro.atualizar = (v) => tipoVidro.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', V_TIPOS[i] === v));
    vImgArq.addEventListener('change', async () => {
      try {
        const f = vImgArq.files[0]; if (!f) return;
        const r = await A.tema.imagemDeFundo(f);
        salvar({ vidroTipo: 'imagem', vidroImagem: r.dataUrl, vidroAnim: r.anim }); A.tema.limparArqs(); tipoVidro.atualizar('imagem'); vMostrar(); A.som.tocar('sucesso');
      } catch (e) { U.toast(e.message, { tipo: 'erro' }); }
      vImgArq.value = '';
    });
    const corVidro = (i, rot) => reg(campoCor(rot, () => t().vidroCores[i], (v) => { const c = t().vidroCores.slice(); c[i] = v; salvar({ vidroCores: c }); }, () => { const [r, g, b] = (getComputedStyle(document.documentElement).getPropertyValue('--vidro-rgb') || '255,255,255').split(',').map((x) => +x || 0); return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''); }));
    vBlocoSol.append(corVidro(0, T('Cor do vidro', 'Glass color')));
    vBlocoGrad.append(reg(slid(T('Ângulo', 'Angle'), 'vidroAngulo', (x) => x + '°')), corVidro(0, T('Cor 1 (início)', 'Color 1 (start)')), corVidro(1, T('Cor 2 (meio)', 'Color 2 (middle)')), corVidro(2, T('Cor 3 (fim)', 'Color 3 (end)')));
    vBlocoImg.append(h('div', { class: 'linha' }, h('span', { class: 'peq suave cresce' }, T('Imagem própria nos painéis, na frente do papel de parede.', 'Your own image on the panels, in front of the wallpaper.')), U.btn(T('Trocar imagem', 'Change image'), { icone: 'imagem', tipo: 'sec', peq: true, onclick: () => vImgArq.click() })));
    vMostrar();
    const fonteSel = h('select', { class: 'campo', 'aria-label': T('Fonte', 'Font') }, [
      ['padrao', T('Padrão', 'Default')], ['sistema', T('Do sistema', 'System')], ['arredondada', T('Arredondada', 'Rounded')], ['serifa', T('Serifa', 'Serif')],
      ['elegante', T('Elegante', 'Elegant')], ['mono', T('Código', 'Code')], ['maquina', T('Máquina de escrever', 'Typewriter')], ['estreita', T('Estreita', 'Narrow')],
      ['verdana', 'Verdana'], ['manuscrita', T('Manuscrita', 'Handwritten')],
    ].map(([v, r]) => h('option', { value: v, estilo: { 'font-family': A.tema.FONTES[v] || 'inherit' } }, r)));
    fonteSel.value = t().fonte || 'padrao'; fonteSel.addEventListener('change', () => salvar({ fonte: fonteSel.value }));
    const molduraCor = reg(campoCor(T('Cor da moldura', 'Frame color'), () => t().molduraCor, (v) => salvar({ molduraCor: v }), () => autoPaleta().cor));
    molduraCor.hidden = !t().moldura;
    const tintas = (...xs) => h('div', { class: 'tintas' }, ...xs);
    const avBloco = (icone, titulo, desc, ...filhos) => h('div', { class: 'av-bloco' }, h('div', { class: 'av-bloco-cab' }, A.orbe(icone, 34), h('div', { class: 'cresce' }, h('b', {}, titulo), h('small', {}, desc))), ...filhos);
    const blocoLayout = [
      opcao(T('Vidro dos painéis', 'Panel glass'), null, T('A cor e o padrão do layout, como o fundo: uma cor só, várias cores ou uma imagem.', 'The layout color and pattern, like the background: one color, several colors or an image.')),
      tipoVidro, vBlocoSol, vBlocoGrad, vBlocoImg, vImgArq,
      tintas(reg(campoCor(T('Cor da HUD (botões, abas, seleção)', 'HUD color (buttons, tabs, selection)'), () => t().hudCor, (v) => salvar({ hudCor: v }), () => autoPaleta().btn2 || autoPaleta().cor)),
      reg(campoCor(T('Texto da HUD', 'HUD text'), () => t().hudTexto, (v) => salvar({ hudTexto: v }), () => autoPaleta().textoCor)),
      reg(campoCor(T('Cor do texto', 'Text color'), () => t().textoCor, (v) => salvar({ textoCor: v }), () => autoPaleta().texto))),
      opcao(T('Fonte', 'Font'), fonteSel),
      opcao(T('Moldura das embeds', 'Embed frame'), U.chave(t().moldura, (v) => { salvar({ moldura: v }); molduraCor.hidden = !v; }), T('A borda líquida animada em volta de imagens, vídeos e links no chat.', 'The animated liquid border around images, videos and links in the chat.')),
      molduraCor,
    ];

    const avancado = h('div', { class: 'col avancado', estilo: { gap: '12px' }, hidden: !t().avancado },
      avBloco('oPaleta', T('Cores', 'Colors'), T('O tom de destaque do app inteiro', 'The highlight tone of the whole app'),
        tintas(reg(campoCor(T('Botões e destaques', 'Buttons and highlights'), () => t().destaque, (v) => salvar({ destaque: v }), () => autoPaleta().cor)))),
      avBloco('apps', T('Layout', 'Layout'), T('O vidro, a HUD, o texto e a fonte', 'The glass, the HUD, the text and the font'), ...blocoLayout),
      avBloco('imagem', T('Fundo', 'Background'), T('O que fica atrás de tudo', 'What sits behind everything'), tipoFundo, blocoGrad, blocoSolido, blocoImagem),
      avBloco('oConexoes', T('Bolhas', 'Bubbles'), T('As bolhas de vidro que flutuam no fundo', 'The glass bubbles floating in the background'),
      h('div', { class: 'av-bolhas-cena', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
      tintas(reg(campoCor(T('Cor da bolha 1', 'Bubble color 1'), () => t().bolhasCor1, (v) => salvar({ bolhasCor1: v }), () => autoFundo().bolhaA)),
      reg(campoCor(T('Cor da bolha 2', 'Bubble color 2'), () => t().bolhasCor2, (v) => salvar({ bolhasCor2: v }), () => autoFundo().bolhaB))),
      opcao(T('Bolhas com degradê', 'Gradient bubbles'), gradChave), gradAng,
      reg(slid(T('Opacidade das bolhas', 'Bubble opacity'), 'bolhasOpac', (x) => x + '%')),
      opcao(T('Direção do movimento', 'Movement direction'), modoSel),
      reg(slid(T('Quantidade', 'Amount'), 'bolhasQtd', (x) => String(x), { dica: A.plat.celular ? T('No celular o app limita a 8 bolhas para não gastar bateria.', 'On phones the app limits it to 8 bubbles to save battery.') : T('Até 30: acima disso o computador começaria a engasgar.', 'Up to 30: above that the computer would start to stutter.') })),
      reg(slid(T('Tamanho máximo', 'Maximum size'), 'bolhasTam', (x) => x + ' px')),
      reg(slid(T('Velocidade', 'Speed'), 'bolhasVel', (x) => x + '%', { dica: T('Limites seguros: nada aqui consegue travar o app.', 'Safe limits: nothing here can freeze the app.') })),
      opcao(T('Imagem da bolha (PNG)', 'Bubble image (PNG)'), h('div', { class: 'linha' }, nomeBolha, U.btn('', { icone: 'imagem', tipo: 'sec', redondo: true, peq: true, titulo: T('Escolher PNG', 'Choose PNG'), onclick: () => bolhaArq.click() }), U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Voltar ao padrão', 'Back to default'), onclick: () => { salvar({ bolhasImagem: null }); textoBolha(); } })), T('Use um PNG com fundo transparente. O app reduz para caber.', 'Use a PNG with a transparent background. The app shrinks it to fit.')),
      bolhaArq));

    // ----- tudo junto -----
    const blur2 = (x) => salvar({ desfoqueFundo: x, desfoqueBolhas: x });
    const sBlurFundo = (() => {
      const v = h('b', {}, t().desfoqueFundo + ' px');
      const s = U.slider({ min: 0, max: 40, valor: t().desfoqueFundo, oninput: (x) => { v.textContent = x + ' px'; blur2(x); } });
      const c = h('div', { class: 'slid' }, h('div', { class: 'linha entre' }, h('span', {}, T('Desfoque do fundo e das bolhas', 'Background and bubbles blur')), v), s);
      c.sync = () => { s.atualizar(t().desfoqueFundo); v.textContent = t().desfoqueFundo + ' px'; };
      return c;
    })();
    reg(sBlurFundo);
    const chaveAv = U.chave(t().avancado, (v) => { salvar({ avancado: v }); avancado.hidden = !v; });

    // ===== (0.8.7) Estúdio Aero: a aparência repaginada (cenário ao vivo, céu dia/noite, cortina de gotas, lâmina de vidro) =====
    const tit = (txt, sub) => h('div', { class: 'est-tit' }, h('i'), h('b', {}, txt), sub ? h('span', {}, sub) : null);
    // o cenário: uma janelinha do app desenhada só com as variáveis do tema, então muda junto com cada ajuste
    const mini = h('div', { class: 'est-mini', 'aria-hidden': 'true' },
      h('div', { class: 'est-mini-bolhas' }, h('i'), h('i'), h('i'), h('i'), h('i')),
      h('div', { class: 'est-mini-jan' },
        h('div', { class: 'est-mini-topo' }, h('b', { class: 'est-mini-eu' }), h('span', { class: 'est-mini-nome' }), h('span', { class: 'est-mini-orbes' }, h('i'), h('i', { class: 'sel' }), h('i'), h('i'))),
        h('div', { class: 'est-mini-corpo' },
          h('div', { class: 'est-mini-lista' }, h('i'), h('i', { class: 'sel' }), h('i'), h('i')),
          h('div', { class: 'est-mini-chat' }, h('span', { class: 'est-mini-bal ele' }, T('oi! bora jogar?', 'hey! wanna play?')), h('span', { class: 'est-mini-bal eu' }, T('bora!! já entro', 'sure!! joining')), h('span', { class: 'est-mini-bal ele' }, '✨')))));
    // o céu: dia ou noite (o modo escuro)
    const rotCeu = h('b', {});
    const subCeu = h('small', {});
    const ceu = h('button', { type: 'button', class: 'est-ceu', role: 'switch', 'aria-label': T('Modo escuro', 'Dark mode') }, h('span', { class: 'est-ceu-estrelas' }), h('span', { class: 'est-ceu-nuvem' }), h('span', { class: 'est-ceu-nuvem b' }), h('span', { class: 'est-ceu-astro' }));
    const pintarCeu = () => { const e = !!t().escuro; ceu.setAttribute('aria-checked', String(e)); ceu.classList.toggle('noite', e); rotCeu.textContent = e ? T('Noite', 'Night') : T('Dia', 'Day'); subCeu.textContent = e ? T('Escuro confortável, sem preto total.', 'Comfortable dark, never pure black.') : T('Claro e arejado. Toque para a noite.', 'Light and airy. Tap for night.'); };
    ceu.addEventListener('click', () => { salvar({ escuro: !t().escuro }); pintarCeu(); A.som.tocar(t().escuro ? 'noite' : 'dia'); sincronizaveis.forEach((x) => x.sync && x.sync()); });
    pintarCeu();
    // o papel de parede: a amostra mostra o fundo de agora
    const amostraPapel = h('div', { class: 'est-papel-amostra' });
    const pintarPapel = () => { const u = A.tema.urlFundoAgora(t()); amostraPapel.style.background = u ? `url("${u}") center / cover` : 'var(--fundo-css)'; };
    pintarPapel();
    const papel = h('div', { class: 'est-papel' }, amostraPapel,
      h('div', { class: 'cresce' }, h('b', {}, T('Papel de parede', 'Wallpaper')), h('small', {}, T('A cor do app se ajusta à imagem.', 'The app color adapts to the image.'))),
      U.btn('', { icone: 'imagem', tipo: 'sec', redondo: true, peq: true, titulo: T('Escolher imagem', 'Choose image'), onclick: () => imgArq.click() }),
      U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Remover imagem', 'Remove image'), onclick: () => { salvar({ fundoTipo: 'gradiente', imagem: null, imagemAnim: null }); A.tema.limparArqs(); tipoFundo.atualizar('gradiente'); mostrarTipo(); pintarPapel(); } }));
    papel.sync = pintarPapel; reg(papel);
    // a cortina de gotas: cada gota pendurada num fio, a de arco-íris escolhe qualquer cor
    const ALTURAS = [10, 26, 4, 30, 14, 34, 8, 22];
    const gotas = PALETAS.map((c, i) => h('button', { type: 'button', role: 'radio', class: 'est-gota', title: c, 'aria-label': c, estilo: { '--g': c, '--y': ALTURAS[i % ALTURAS.length] + 'px', '--atraso': (i * 0.07) + 's' }, onclick: (e) => { trocarCor(c); A.som.tocar('bolha'); pingar(e.currentTarget); } }, h('i')));
    cor.classList.add('est-gota-input');
    const livre = h('label', { class: 'est-gota livre', title: T('Qualquer cor', 'Any color'), estilo: { '--y': '18px', '--atraso': (PALETAS.length * 0.07) + 's' } }, cor, h('i'));
    const pingar = (b) => { b.classList.remove('pinga'); void b.offsetWidth; b.classList.add('pinga'); };
    const pintarGotas = () => {
      const atual = String(t().cor || '').toLowerCase(); let achou = false;
      gotas.forEach((g, i) => { const on = PALETAS[i].toLowerCase() === atual; achou = achou || on; g.classList.toggle('sel', on); g.setAttribute('aria-checked', String(on)); });
      livre.classList.toggle('sel', !achou); livre.style.setProperty('--g', t().cor);
    };
    pintarGotas();
    cor.addEventListener('input', pintarGotas); cor.addEventListener('change', () => { pintarGotas(); pingar(livre); });
    const cortina = h('div', { class: 'est-cortina' }, h('div', { class: 'est-haste' }), h('div', { class: 'est-gotas', role: 'radiogroup', 'aria-label': T('Cor principal', 'Main color') }, ...gotas, livre));
    const placa = h('div', { class: 'est-placa' }, h('span', { class: 'est-placa-cor' }), hexI, h('small', {}, T('o resto da paleta acompanha, no mesmo tom', 'the rest of the palette follows, in the same hue')));
    reg({ sync: pintarGotas });
    // a lâmina: um pedaço de vidro de verdade em cima de faixas coloridas (mostra a opacidade, o desfoque e o arredondamento)
    const lamina = h('div', { class: 'est-lamina', 'aria-hidden': 'true' }, h('div', { class: 'est-lamina-fundo' }, h('i'), h('i'), h('i'), h('i')), h('div', { class: 'est-lamina-vidro' }, h('b', {}, 'Aero'), h('small', {}, T('vidro', 'glass'))));
    const tile = (k, ic, titulo, desc) => {
      const b = h('button', { type: 'button', class: 'est-tile', 'aria-pressed': String(!!t()[k]) }, A.orbe(ic, 34), h('span', { class: 'cresce' }, h('b', {}, titulo), h('small', {}, desc)), h('i', { class: 'est-led' }));
      b.addEventListener('click', () => { const v = !t()[k]; salvar({ [k]: v }); b.setAttribute('aria-pressed', String(v)); A.som.tocar('click'); });
      b.sync = () => b.setAttribute('aria-pressed', String(!!t()[k]));
      return reg(b);
    };

    // (0.8.7) a barra das abas: duas maquetes animadas (a bolha girando as abas; a doca subindo da alça) e um clique escolhe
    const escolhaBarra = () => {
      const orbes = () => h('span', { class: 'mq-orbes' }, h('i', { class: 'mq-o o1' }), h('i', { class: 'mq-o o2' }), h('i', { class: 'mq-o o3' }));
      const cartao = (id, nome, desc, maquete) => {
        const b = h('button', { type: 'button', class: 'mq-cartao mq-' + id, role: 'radio', 'aria-checked': String((t().barra === 'doca' ? 'doca' : 'bolha') === id) }, maquete, h('b', {}, nome), h('small', {}, desc));
        b.addEventListener('click', () => { salvar({ barra: id }); A.evt.emit('arranjo', { peca: 'barra' }); A.som.tocar('click'); sync(); });
        return b;
      };
      const bolha = cartao('bolha', T('Bolha do perfil', 'Profile bubble'), T('Você e as abas num cartão, em cima das conversas. As abas giram para a frente.', 'You and the tabs in one card, above your chats. Tabs spin to the front.'),
        h('div', { class: 'mq-tela', 'aria-hidden': 'true' }, h('div', { class: 'mq-col' }, h('div', { class: 'mq-eu' }, h('i', { class: 'mq-foto' }), h('i', { class: 'mq-linha' })), orbes(), h('i', { class: 'mq-item' }), h('i', { class: 'mq-item' }), h('i', { class: 'mq-item' })), h('div', { class: 'mq-conv' }, h('i', { class: 'mq-msg a' }), h('i', { class: 'mq-msg b' }), h('i', { class: 'mq-msg a2' }))));
      const doca = cartao('doca', T('Doca', 'Dock'), T('Some da tela. Passe o mouse na alça (ou puxe no celular) e ela sobe. Segure para levar a outra borda.', 'Hides away. Hover the handle (or pull it on phones) and it rises. Hold to move it to another edge.'),
        h('div', { class: 'mq-tela', 'aria-hidden': 'true' }, h('div', { class: 'mq-col mq-col-fina' }, h('i', { class: 'mq-item' }), h('i', { class: 'mq-item' }), h('i', { class: 'mq-item' })), h('div', { class: 'mq-conv' }, h('i', { class: 'mq-msg a' }), h('i', { class: 'mq-msg b' })), h('i', { class: 'mq-alca' }), h('div', { class: 'mq-doca' }, h('i', { class: 'mq-foto' }), orbes()), h('i', { class: 'mq-cursor' })));
      const caixa = h('div', { class: 'mq-escolha', role: 'radiogroup', 'aria-label': T('Barra das abas', 'Tab bar') }, bolha, doca);
      const sync = () => { const v = t().barra === 'doca' ? 'doca' : 'bolha'; bolha.setAttribute('aria-checked', String(v === 'bolha')); doca.setAttribute('aria-checked', String(v === 'doca')); };
      caixa.sync = sync;
      return reg(caixa);
    };
    // (0.8.7) cada parte da aparência numa caixa só dela (como a das bolhas de conversa), em vez de tudo numa rolagem só
    const parte = (...f) => h('div', { class: 'col aparencia estudio est-parte' }, ...f);
    const partes = [
      parte(tit(T('Tema e fundo', 'Theme and background')),
      h('div', { class: 'est-palco' }, mini,
        h('div', { class: 'est-lado' }, h('div', { class: 'est-ceu-caixa' }, ceu, h('div', { class: 'est-ceu-rot' }, rotCeu, subCeu)), papel, imgArq))),
      parte(
      tit(T('Barra das abas', 'Tab bar'), T('passe o mouse para ver', 'hover to preview')), escolhaBarra()),
      parte(
      tit(T('Cor', 'Color'), T('toque numa gota', 'tap a drop')), cortina, placa),
      parte(
      tit(T('Vidro', 'Glass')),
      h('div', { class: 'est-vidro' }, lamina, h('div', { class: 'est-vidro-faixas' },
        reg(slid(T('Opacidade do vidro', 'Glass opacity'), 'vidro', (x) => x + '%', { dica: T('0% deixa o vidro totalmente transparente; 100% deixa sólido.', '0% makes the glass fully transparent; 100% makes it solid.') })),
        reg(slid(T('Desfoque da interface', 'Interface blur'), 'desfoqueUI', (x) => x + ' px')),
        sBlurFundo,
        reg(slid(T('Arredondamento', 'Roundness'), 'raio', (x) => x + ' px'))))),
      parte(
      tit(T('Movimento', 'Motion')),
      h('div', { class: 'est-tiles' },
        tile('bolhas', 'bolhas', T('Bolhas flutuando no fundo', 'Floating background bubbles'), T('As bolhas de vidro passeando atrás de tudo.', 'Glass bubbles drifting behind everything.')),
        tile('parallax', 'cursor', T('Vidro que segue o mouse (parallax)', 'Mouse-following glass (parallax)'), T('A luz do vidro acompanha o seu mouse.', 'The glass light follows your mouse.'))),
      opcao(T('Animações', 'Animations'), U.seg([['total', T('Todas', 'All')], ['reduzida', T('Leves', 'Light')], ['nenhuma', T('Nenhuma', 'None')]], t().anim, (v) => salvar({ anim: v })), T('Leves: sem tremer nem piscar, só aparecer e sumir suave.', 'Light: no shaking or flicker, just soft fades.')),
      opcao(T('Animações do perfil das pessoas', 'People\'s profile animations'), U.seg([['sempre', T('Sempre', 'Always')], ['hover', T('Ao passar o mouse', 'On hover')]], t().animPerfil === 'hover' ? 'hover' : 'sempre', (v) => { salvar({ animPerfil: v }); if (A.animPerfil) A.animPerfil.aplicar(); }), T('Foto, banner e nameplate animados: sempre animando, ou parados até você passar o mouse em cima.', 'Animated picture, banner and nameplate: always moving, or still until you hover them.'))),
      parte(tit(T('Cores avançadas', 'Advanced colors')),
      opcao(T('Cores avançadas', 'Advanced colors'), chaveAv, T('Escolha a cor de cada parte, o layout, a fonte, o fundo e as bolhas.', 'Pick the color of each part, the layout, the font, the background and the bubbles.')),
      avancado,
      h('div', { class: 'linha', estilo: { 'margin-top': '6px' } }, U.btn(T('Restaurar aparência', 'Reset appearance'), { tipo: 'sec', peq: true, onclick: async () => {
        if (!(await U.confirmar(T('Voltar a aparência inteira ao padrão? Cores, fundo, vidro, layout, fonte, bolhas, skin, ícone e o estilo das suas mensagens voltam ao original (os seus estilos salvos continuam guardados).', 'Reset the whole appearance to default? Colors, background, glass, layout, font, bubbles, skin, icon and your message style go back to the original (your saved styles stay stored).')))) return;
        // (1.0.2) restaura TUDO da aba Aparência, não só o tema: antes a skin, o ícone, o estilo em uso, as imagens guardadas e o estilo das mensagens ficavam
        A.cfg.restaurarTema();
        A.cfg.v.estiloAtual = -1; A.cfg.v.iconeApp = ''; A.cfg.v.chamJuntos = false; A.cfg.salvar();
        await A.tema.limparArqs();
        try { if (A.aer && A.cfg.v.skin) await A.aer.usar(''); } catch (e) { A.log.aviso('restaurar: skin', e && e.message); }
        try { if (A.extras && A.extras.aplicarIcone) await A.extras.aplicarIcone(); } catch (e) { /* ok */ }
        try { const bc = A.api.eu && A.api.eu.bc; if (bc && (bc.m && bc.m !== 'padrao' || bc.c || bc.f || bc.g)) await A.api.salvarPerfil({ bc: { m: 'padrao', c: '', f: '' } }); } catch (e) { A.log.aviso('restaurar: bolhas das mensagens', e && e.message); }
        if (A.animPerfil) A.animPerfil.aplicar(); A.tema.aplicar(); A.evt.emit('estilos:mudou'); A.evt.emit('arranjo', { peca: 'barra' }); U.reconstruir();
      } }))),
    ];
    const el = h('div', { class: 'col aparencia estudio' }, ...partes);
    el.partes = partes;
    el.sincronizar = () => { sincCor(); sincronizaveis.forEach((x) => x.sync && x.sync()); };
    return el;
  }

  A.aparencia = { secao, PALETAS };
})();
