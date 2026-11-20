// Aero Stream - (0.8.3) arquivos de texto e de código no chat: reconhece pela extensão, pinta a sintaxe (leve, sem biblioteca)
// e mostra um cartão com as primeiras linhas, que abre inteiro, copia ou baixa. Nada de HTML do arquivo vira HTML: tudo entra como texto.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;

  // extensão -> [linguagem para as cores, nome que aparece]
  const LING = {
    txt: ['texto', 'Texto'], log: ['texto', 'Log'], md: ['md', 'Markdown'], markdown: ['md', 'Markdown'], rst: ['texto', 'Texto'], nfo: ['texto', 'Texto'],
    csv: ['texto', 'CSV'], tsv: ['texto', 'TSV'], srt: ['texto', 'Legenda'], vtt: ['texto', 'Legenda'],
    js: ['js', 'JavaScript'], mjs: ['js', 'JavaScript'], cjs: ['js', 'JavaScript'], jsx: ['js', 'JSX'], ts: ['js', 'TypeScript'], tsx: ['js', 'TSX'],
    json: ['json', 'JSON'], jsonc: ['js', 'JSON'], json5: ['js', 'JSON'],
    py: ['py', 'Python'], pyw: ['py', 'Python'], rb: ['rb', 'Ruby'], lua: ['lua', 'Lua'], luau: ['lua', 'Luau'],
    bat: ['bat', 'Batch'], cmd: ['bat', 'Batch'], ps1: ['ps', 'PowerShell'], psm1: ['ps', 'PowerShell'], sh: ['sh', 'Shell'], bash: ['sh', 'Bash'], zsh: ['sh', 'Zsh'], fish: ['sh', 'Fish'],
    html: ['html', 'HTML'], htm: ['html', 'HTML'], xml: ['html', 'XML'], svg: ['html', 'SVG'], vue: ['html', 'Vue'], svelte: ['html', 'Svelte'], xaml: ['html', 'XAML'], plist: ['html', 'Plist'],
    css: ['css', 'CSS'], scss: ['css', 'SCSS'], sass: ['css', 'Sass'], less: ['css', 'Less'],
    c: ['c', 'C'], h: ['c', 'C'], cpp: ['c', 'C++'], cc: ['c', 'C++'], cxx: ['c', 'C++'], hpp: ['c', 'C++'], cs: ['c', 'C#'], java: ['c', 'Java'], kt: ['c', 'Kotlin'], kts: ['c', 'Kotlin'],
    go: ['c', 'Go'], rs: ['c', 'Rust'], swift: ['c', 'Swift'], dart: ['c', 'Dart'], php: ['c', 'PHP'], gd: ['py', 'GDScript'], glsl: ['c', 'GLSL'], hlsl: ['c', 'HLSL'], shader: ['c', 'Shader'],
    sql: ['sql', 'SQL'], ini: ['ini', 'INI'], cfg: ['ini', 'Config'], conf: ['ini', 'Config'], toml: ['ini', 'TOML'], properties: ['ini', 'Properties'], env: ['ini', 'Env'],
    yaml: ['yaml', 'YAML'], yml: ['yaml', 'YAML'], r: ['py', 'R'], pl: ['sh', 'Perl'], vbs: ['vb', 'VBScript'], vb: ['vb', 'Visual Basic'], ahk: ['ini', 'AutoHotkey'], reg: ['ini', 'Registro'],
    gitignore: ['sh', 'Git'], dockerfile: ['sh', 'Dockerfile'], makefile: ['sh', 'Makefile'], gradle: ['c', 'Gradle'], mcfunction: ['sh', 'Minecraft'], sk: ['py', 'Skript'],
  };
  const extDe = (nome) => { const n = String(nome || '').toLowerCase(); const b = n.split(/[\\/]/).pop(); if (/^(dockerfile|makefile)$/.test(b)) return b; const m = b.match(/\.([a-z0-9]{1,12})$/); return m ? m[1] : ''; };
  const ehTexto = (nome, mime) => !!LING[extDe(nome)] || /^text\//.test(mime || '') || /^application\/(json|xml|javascript|x-sh|x-python)/.test(mime || '');
  const linguagem = (nome, mime) => LING[extDe(nome)] || (/json/.test(mime || '') ? LING.json : /xml|html/.test(mime || '') ? LING.html : LING.txt);

  // palavras-chave por linguagem
  const KW = {
    js: 'await async break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield interface type enum implements private public protected readonly as declare namespace abstract',
    py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self func var extends signal export onready',
    rb: 'alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield require puts',
    lua: 'and break do else elseif end for function goto if in local not or repeat return then until while self',
    bat: 'echo off on set if else goto call exit not exist defined errorlevel for in do pause cls rem setlocal endlocal enabledelayedexpansion shift start title color cd mkdir del copy move type nul equ neq lss leq gtr geq choice timeout',
    ps: 'begin break catch class continue data do dynamicparam else elseif end exit filter finally for foreach from function if in param process return switch throw trap try until using while write-host get-item set-item new-object',
    sh: 'if then else elif fi for while until do done case esac in function return local export echo exit source alias unset read set shift break continue sudo cd',
    c: 'auto break case catch char class const continue default delete do double else enum explicit extern false float for friend goto if inline int long namespace new nullptr operator private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while bool string var let fn func fun val pub mut impl trait match use mod package import interface extends implements final abstract override async await go chan defer select range map type struct echo foreach function readonly null nil self Self None',
    sql: 'select from where insert into values update set delete create table drop alter add primary key foreign references join left right inner outer on as and or not null is in like order by group having limit offset distinct union all case when then else end index view begin commit rollback',
    vb: 'dim set if then else elseif end sub function call wscript createobject msgbox for each next do loop while wend select case with nothing true false and or not',
    css: '', ini: '', yaml: 'true false null yes no on off', json: 'true false null', md: '', texto: '', html: '',
  };
  const kwSet = {}; for (const k in KW) kwSet[k] = new Set(KW[k].split(/\s+/).filter(Boolean));
  const CONST = new Set(['true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil', 'NaN', 'Infinity']);
  const S = String.raw;
  const STR = S`"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?`, NUM = S`\b(?:0x[\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b`, ID = S`[A-Za-z_$][\w$]*`;
  // cada linguagem: uma regex com grupos na ordem [comentário, texto, número, palavra, outro]
  const REGRAS = {
    js: [S`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`, STR + S`|\x60(?:[^\x60\\]|\\.)*\x60?`],
    json: [S`\/\/[^\n]*`, STR],
    py: [S`#[^\n]*`, S`"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[rbfu]{0,2}(?:` + STR + ')'],
    rb: [S`#[^\n]*`, STR],
    lua: [S`--\[\[[\s\S]*?(?:\]\]|$)|--[^\n]*`, STR + S`|\[\[[\s\S]*?(?:\]\]|$)`],
    bat: [S`(?:^|(?<=\n))[ \t@]*(?:rem\b|::)[^\n]*`, S`"[^"\n]*"?|%[\w~:,=-]*%|![\w]+!|%%?~?[a-zA-Z]`],
    ps: [S`<#[\s\S]*?(?:#>|$)|#[^\n]*`, STR + S`|\$[\w:]+`],
    sh: [S`(?:^|(?<=\s))#[^\n]*`, STR + S`|\$\{[^}\n]*\}|\$[\w@#?*]+`],
    c: [S`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|(?:^|(?<=\n))[ \t]*#[a-z]+[^\n]*`, STR + S`|\x60[^\x60]*\x60?`],
    sql: [S`--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`, STR],
    vb: [S`'[^\n]*|(?:^|(?<=\n))[ \t]*rem\b[^\n]*`, S`"[^"\n]*"?`],
    ini: [S`(?:^|(?<=\n))[ \t]*[;#][^\n]*`, STR],
    yaml: [S`(?:^|(?<=\s))#[^\n]*`, STR],
    css: [S`\/\*[\s\S]*?(?:\*\/|$)|(?:^|(?<=\s))\/\/[^\n]*`, STR],
  };
  const cacheRe = {};
  function reDe(l) {
    if (cacheRe[l]) return cacheRe[l];
    const r = REGRAS[l]; if (!r) return null;
    const flagsI = l === 'bat' || l === 'sql' || l === 'vb' ? 'gi' : 'g';
    return (cacheRe[l] = new RegExp(`(${r[0]})|(${r[1]})|(${NUM})|(${ID})`, flagsI));
  }
  const span = (cls, t) => { const s = document.createElement('span'); s.className = cls; s.textContent = t; return s; };

  // pinta um texto: devolve um fragmento (só nós de texto e <span>)
  function pintar(texto, l) {
    const f = document.createDocumentFragment();
    if (l === 'html') return pintarHtml(texto, f);
    if (l === 'md') return pintarMd(texto, f);
    const re = reDe(l);
    if (!re) { f.append(texto); return f; }
    const kws = kwSet[l] || new Set(), semCaixa = l === 'bat' || l === 'sql' || l === 'vb' || l === 'ps';
    let i = 0, m, solto = ''; re.lastIndex = 0;
    const solta = () => { if (solto) { f.append(solto); solto = ''; } };
    while ((m = re.exec(texto))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m.index > i) solto += texto.slice(i, m.index);
      i = m.index + m[0].length;
      let cls = '';
      if (m[1] !== undefined) cls = 'ck-c';
      else if (m[2] !== undefined) cls = 'ck-s';
      else if (m[3] !== undefined) cls = 'ck-n';
      else {
        const w = m[4], wk = semCaixa ? w.toLowerCase() : w;
        if (CONST.has(w)) cls = 'ck-n';
        else if (kws.has(wk)) cls = 'ck-k';
        else if (l === 'css' && texto[i] === ':' && texto[i + 1] !== ':') cls = 'ck-a';
        else if ((l === 'ini' || l === 'yaml' || l === 'json') && /^\s*[:=]/.test(texto.slice(i, i + 4))) cls = 'ck-a';
        else if (texto[i] === '(') cls = 'ck-f';
        else if (/^[A-Z][a-z]/.test(w) && l !== 'texto') cls = 'ck-t';
      }
      if (!cls) { solto += m[0]; continue; }
      solta(); f.append(span(cls, m[0]));
    }
    solto += texto.slice(i); solta();
    return f;
  }
  function pintarHtml(texto, f) {
    const re = /(<!--[\s\S]*?(?:-->|$))|(<\/?)([\w:-]+)|("[^"]*"?|'[^']*'?)|([\w:@.-]+)(?==)|(\/?>)|(&[#\w]+;)/g;
    let i = 0, m, dentro = false;
    while ((m = re.exec(texto))) {
      if (m.index > i) f.append(texto.slice(i, m.index));
      i = m.index + m[0].length;
      if (m[1]) f.append(span('ck-c', m[1]));
      else if (m[2]) { f.append(span('ck-p', m[2]), span('ck-k', m[3])); dentro = true; }
      else if (m[4]) { if (dentro) f.append(span('ck-s', m[4])); else f.append(m[4]); }
      else if (m[5]) { if (dentro) f.append(span('ck-a', m[5])); else f.append(m[5]); }
      else if (m[6]) { f.append(span('ck-p', m[6])); dentro = false; }
      else if (m[7]) f.append(span('ck-n', m[7]));
    }
    f.append(texto.slice(i));
    return f;
  }
  function pintarMd(texto, f) {
    const re = /^(#{1,6} [^\n]*)|^(\s*(?:[-*+]|\d+\.) )|(`[^`\n]+`|^```[^\n]*)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[[^\]\n]+\]\([^)\n]+\))|^(>[^\n]*)/gm;
    let i = 0, m;
    while ((m = re.exec(texto))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m.index > i) f.append(texto.slice(i, m.index));
      i = m.index + m[0].length;
      f.append(span(m[1] ? 'ck-k' : m[2] ? 'ck-p' : m[3] ? 'ck-s' : m[4] ? 'ck-t' : m[5] ? 'ck-f' : 'ck-c', m[0]));
    }
    f.append(texto.slice(i));
    return f;
  }

  // lê o texto do arquivo (até 512 KB para a tela; o arquivo inteiro continua para baixar e copiar)
  const MAX_VER = 512 * 1024, LINHAS_PREV = 10;
  const cache = new Map();
  async function lerTexto(url) {
    if (cache.has(url)) return cache.get(url);
    const p = fetch(url).then((r) => r.blob()).then(async (b) => {
      const corte = b.size > MAX_VER;
      let t = await (corte ? b.slice(0, MAX_VER) : b).text();
      if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
      // binário disfarçado: muitos caracteres de controle -> não mostra
      const amostra = t.slice(0, 4000); let ruins = 0; for (let i = 0; i < amostra.length; i++) { const c = amostra.charCodeAt(i); if ((c < 9 || (c > 13 && c < 32)) && c !== 27) ruins++; }
      return { texto: t.replace(/\r\n?/g, '\n'), corte, binario: ruins > amostra.length * 0.05, tam: b.size };
    });
    cache.set(url, p);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    return p;
  }
  const tamanho = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.0', '') + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B');

  // bloco de código com números de linha
  function bloco(texto, l, { maxLinhas } = {}) {
    let linhas = texto.split('\n');
    if (linhas.length > 1 && linhas[linhas.length - 1] === '') linhas.pop();
    const total = linhas.length;
    if (maxLinhas && linhas.length > maxLinhas) linhas = linhas.slice(0, maxLinhas);
    const nums = h('div', { class: 'ck-nums', 'aria-hidden': 'true' }, linhas.map((_, i) => String(i + 1)).join('\n'));
    const code = h('code', { class: 'ck-code' }); code.append(pintar(linhas.join('\n'), l[0]));
    return { el: h('div', { class: 'ck-bloco' }, nums, h('pre', { class: 'ck-pre selecionavel' }, code)), total };
  }

  // o cartão do chat
  function cartao(url, { nome = 'arquivo.txt', mime = '', tam = 0, aoMudar, baixar } = {}) {
    const U = A.ui, l = linguagem(nome, mime);
    const corpo = h('div', { class: 'ck-corpo carregando' }, h('div', { class: 'ck-esqueleto' }, h('i'), h('i'), h('i')));
    const info = h('span', { class: 'ck-info' }, tam ? tamanho(tam) + ' · ' + l[1] : l[1]);
    const btnCopiar = U.btn('', { icone: 'copiar', tipo: 'sec', redondo: true, peq: true, titulo: T('Copiar o texto', 'Copy the text'), onclick: async (e) => { e.stopPropagation(); const d = await lerTexto(url); U.copiar(d.texto); } });
    const btnAbrir = U.btn('', { icone: 'expandir', tipo: 'sec', redondo: true, peq: true, titulo: T('Abrir inteiro', 'Open in full'), onclick: (e) => { e.stopPropagation(); abrir(url, { nome, mime, baixar }); } });
    const btnBaixar = U.btn('', { icone: 'download', tipo: 'sec', redondo: true, peq: true, titulo: T('Baixar', 'Download'), onclick: (e) => { e.stopPropagation(); baixar ? baixar() : U.baixar(url, nome); } });
    const topo = h('div', { class: 'ck-topo' },
      h('span', { class: 'ck-ic ck-l-' + l[0] }, A.icone('codigo', 18)),
      h('div', { class: 'ck-titulo' }, h('b', { class: 'ck-nome', title: nome }, nome), info),
      h('div', { class: 'ck-acoes' }, btnCopiar, btnAbrir, btnBaixar));
    const el = h('div', { class: 'ck-cartao' }, topo, corpo);
    lerTexto(url).then((d) => {
      corpo.classList.remove('carregando'); corpo.textContent = '';
      if (d.binario) { corpo.append(h('div', { class: 'ck-vazio peq suave' }, T('Este arquivo não é texto. Baixe para abrir.', 'This file is not text. Download it to open.'))); btnCopiar.hidden = btnAbrir.hidden = true; aoMudar && aoMudar(); return; }
      if (!tam) info.textContent = tamanho(d.tam) + ' · ' + l[1];
      const { el: b, total } = bloco(d.texto, l, { maxLinhas: 400 });
      corpo.append(b);
      if (total > LINHAS_PREV) {
        corpo.classList.add('recolhido');
        const mais = h('button', { type: 'button', class: 'ck-mais', onclick: (e) => {
          e.stopPropagation();
          const ab = corpo.classList.toggle('recolhido');
          mais.lastChild.textContent = ab ? T('Mostrar tudo', 'Show all') + ' (' + total + ' ' + T('linhas', 'lines') + ')' : T('Recolher', 'Collapse');
          mais.classList.toggle('aberto', !ab); aoMudar && aoMudar();
          if (ab) el.scrollIntoView({ block: 'nearest' });
        } }, A.icone('chevron', 14), h('span', {}, T('Mostrar tudo', 'Show all') + ' (' + total + ' ' + T('linhas', 'lines') + ')'));
        el.append(mais);
      }
      aoMudar && aoMudar();
    }).catch(() => { corpo.classList.remove('carregando'); corpo.textContent = ''; corpo.append(h('div', { class: 'ck-vazio peq suave' }, T('Não consegui abrir o arquivo.', 'Could not open the file.'))); });
    return el;
  }

  // tela grande com o arquivo inteiro
  async function abrir(url, { nome = 'arquivo.txt', mime = '', baixar } = {}) {
    const U = A.ui, l = linguagem(nome, mime);
    const caixa = h('div', { class: 'ck-tela' }, h('div', { class: 'ck-esqueleto' }, h('i'), h('i'), h('i')));
    const m = U.modal(nome, caixa, { largura: 960, classe: 'ck-modal', acoes: [
      { texto: T('Copiar', 'Copy'), icone: 'copiar', tipo: 'sec', onclick: async () => { const d = await lerTexto(url); U.copiar(d.texto); return false; } },
      { texto: T('Baixar', 'Download'), icone: 'download', tipo: 'sec', onclick: () => { baixar ? baixar() : U.baixar(url, nome); return false; } },
    ] });
    try {
      const d = await lerTexto(url); caixa.textContent = '';
      if (d.binario) { caixa.append(h('div', { class: 'ck-vazio peq suave' }, T('Este arquivo não é texto. Baixe para abrir.', 'This file is not text. Download it to open.'))); return m; }
      const { el: b, total } = bloco(d.texto, l);
      caixa.append(h('div', { class: 'ck-tela-info peq suave' }, l[1] + ' · ' + total + ' ' + T('linhas', 'lines') + ' · ' + tamanho(d.tam) + (d.corte ? ' · ' + T('mostrando os primeiros 512 KB', 'showing the first 512 KB') : '')), b);
    } catch (e) { caixa.textContent = T('Não consegui abrir o arquivo.', 'Could not open the file.'); }
    return m;
  }

  A.codigo = { ehTexto, linguagem, pintar, cartao, abrir, extDe };
})();
