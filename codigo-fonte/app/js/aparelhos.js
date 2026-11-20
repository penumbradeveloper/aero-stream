// Aero Stream - (1.0.2) os aparelhos conectados e o sistema de cada pessoa, em símbolos pequenos ao lado do nome (como o celularzinho do
// Discord), e o ícone do sistema: a distro do Linux, a versão do Windows, macOS, Android... Cada um escolhe em Conta > Privacidade se
// aparecem; o sistema é detectado sozinho e dá para trocar o ícone. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const AP = (A.aparelhos = {});

  // símbolos dos tipos de aparelho
  const TIPOS = {
    pc: ['<rect x="2.5" y="4" width="19" height="12.5" rx="2.2"/><path d="M9 20.5h6M12 16.5v4"/>', 'Computador', 'Computer'],
    cel: ['<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', 'Celular', 'Phone'],
    web: ['<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>', 'Navegador', 'Browser'],
  };
  // os sistemas: [nome, cor do selo (2 tons), desenho branco 24x24]. Desenhos simples, do próprio Aero
  const QUADROS = '<path d="M4 4h7.4v7.4H4zM12.6 4H20v7.4h-7.4zM4 12.6h7.4V20H4zM12.6 12.6H20V20h-7.4z" fill="#fff" stroke="none"/>';
  const PAINEIS = '<path d="M3 5.5 10.5 4.4v7.1H3zM12 4.2 21 3v8.5h-9zM3 13h7.5v7.1L3 19zM12 13h9v8l-9-1.2z" fill="#fff" stroke="none"/>';
  const BANDEIRA = '<path d="M3.6 6.4c2.3-1.3 4.6-1.4 6.9-.2v5.3c-2.3-1.2-4.6-1.1-6.9.2z" fill="#f65314"/><path d="M11.6 6.7c2.3 1.2 4.6 1.1 6.9-.2v5.3c-2.3 1.3-4.6 1.4-6.9.2z" fill="#7cbb00"/><path d="M3.6 12.9c2.3-1.3 4.6-1.4 6.9-.2V18c-2.3-1.2-4.6-1.1-6.9.2z" fill="#00a1f1"/><path d="M11.6 13.2c2.3 1.2 4.6 1.1 6.9-.2v5.3c-2.3 1.3-4.6 1.4-6.9.2z" fill="#ffbb00"/>';
  const SIS = {
    win11: ['Windows 11', '#3aa0ff', '#0067c0', QUADROS],
    win10: ['Windows 10', '#28b4f5', '#0078d7', PAINEIS],
    windows: ['Windows', '#28b4f5', '#0078d7', PAINEIS],
    win8: ['Windows 8', '#3fa9f5', '#1e5fd6', QUADROS],
    win7: ['Windows 7', '#2a5b8f', '#0c2340', BANDEIRA],
    winxp: ['Windows XP', '#4f8be8', '#1c4fc0', BANDEIRA],
    macos: ['macOS', '#7d8794', '#2b2f36', '<path fill="#fff" stroke="none" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z"/>'],
    ios: ['iOS', '#5c6670', '#16191d', '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6" stroke="#fff" stroke-width="1.8"/><path d="M10.5 18.5h3" stroke="#fff" stroke-width="1.8"/>'],
    android: ['Android', '#5fe39e', '#1f9e5c', '<path fill="#fff" stroke="none" d="M6 12a6 6 0 0 1 12 0z"/><rect fill="#fff" stroke="none" x="6" y="13" width="12" height="7" rx="1.8"/><circle cx="9.6" cy="10" r=".9" fill="#1f9e5c" stroke="none"/><circle cx="14.4" cy="10" r=".9" fill="#1f9e5c" stroke="none"/><path d="M8 5.4 9.3 7.4M16 5.4l-1.3 2" stroke="#fff" stroke-width="1.4"/>'],
    chromeos: ['ChromeOS', '#5a9cf8', '#1a63d6', '<circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="#fff" stroke="none"/><path d="M12 8.8h7.4M9.2 13.6 5.5 7.2M14.8 13.6l-3.7 6.4" stroke="#fff" stroke-width="1.8"/>'],
    linux: ['Linux', '#ffd54a', '#e0a500', '<ellipse fill="#1d2b38" stroke="none" cx="12" cy="14.6" rx="5.4" ry="6.2"/><circle fill="#1d2b38" stroke="none" cx="12" cy="7.6" r="4"/><ellipse fill="#fff" stroke="none" cx="12" cy="15.3" rx="3.6" ry="4.6"/><circle fill="#fff" stroke="none" cx="10.6" cy="7.2" r="1"/><circle fill="#fff" stroke="none" cx="13.4" cy="7.2" r="1"/><path fill="#f5a623" stroke="none" d="M10.4 9.2h3.2L12 10.8z"/>'],
    arch: ['Arch Linux', '#4cb3ec', '#1478b8', '<path fill="#fff" stroke="none" d="M12 2.8c-.8 2-1.3 3.3-2.2 5.2.6.6 1.3 1.3 2.4 2.1-1.2-.5-2-1-2.7-1.6C8.1 11.5 6 15.5 3.6 20.8c2-1.1 3.5-1.8 5-2.2-.1-.4-.1-.8-.1-1.2 0-2 1.6-3.8 3.5-3.8s3.4 1.9 3.4 3.9c0 .4 0 .7-.1 1.1 1.5.4 3 1.1 5 2.2-.4-.8-.8-1.5-1.1-2.2-.6-.5-1.3-1-2.6-1.6.9.2 1.6.5 2.1.8C16.8 12.6 15.2 9.2 12 2.8z"/>'],
    cachyos: ['CachyOS', '#3fe0c5', '#0b9f8c', '<path d="M17.2 7.2A6.7 6.7 0 1 0 17.2 16.8" stroke="#fff" stroke-width="2.6"/><circle cx="17.6" cy="12" r="1.7" fill="#fff" stroke="none"/><circle cx="20" cy="8.4" r="1" fill="#fff" stroke="none"/>'],
    manjaro: ['Manjaro', '#4fd97a', '#209f4a', '<path fill="#fff" stroke="none" d="M4.5 4.5h6.2v15H4.5zM12.6 4.5h6.9v6.2h-6.9zM12.6 12.6h6.9v6.9h-6.9z"/>'],
    endeavouros: ['EndeavourOS', '#a777f0', '#5a2bb0', '<path fill="#fff" stroke="none" d="M13 3.5c2.8 3.6 5.2 8.2 6 13.2-4.6-2-9.5-2.2-14.5-.6C8 11.8 10.3 7.4 13 3.5z" opacity=".95"/><path fill="#fff" stroke="none" d="M4.8 18c4.4-1.3 9.2-1.2 14.6.6-4.8 1.2-9.8 1.2-14.6-.6z" opacity=".7"/>'],
    ubuntu: ['Ubuntu', '#ff7a3d', '#d8471a', '<circle cx="12" cy="12" r="6.4" stroke="#fff" stroke-width="2.2"/><circle cx="12" cy="4.6" r="2.3" fill="#fff" stroke="#d8471a" stroke-width="1.2"/><circle cx="5.6" cy="15.7" r="2.3" fill="#fff" stroke="#d8471a" stroke-width="1.2"/><circle cx="18.4" cy="15.7" r="2.3" fill="#fff" stroke="#d8471a" stroke-width="1.2"/>'],
    kubuntu: ['Kubuntu', '#3c8ee8', '#0f5fbf', '<circle cx="12" cy="12" r="6.4" stroke="#fff" stroke-width="2.2"/><circle cx="12" cy="4.6" r="2.3" fill="#fff" stroke="#0f5fbf" stroke-width="1.2"/><circle cx="5.6" cy="15.7" r="2.3" fill="#fff" stroke="#0f5fbf" stroke-width="1.2"/><circle cx="18.4" cy="15.7" r="2.3" fill="#fff" stroke="#0f5fbf" stroke-width="1.2"/>'],
    debian: ['Debian', '#ef3b6e', '#b3073d', '<path d="M13.4 6.6a5.6 5.6 0 1 0 4 6.2c.3-2-1-3.6-2.8-3.8a2.3 2.3 0 0 0-2.4 2.6c.1.9.8 1.4 1.5 1.3" stroke="#fff" stroke-width="2"/>'],
    fedora: ['Fedora', '#5aa8e6', '#1d5fa6', '<circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="1.9"/><path d="M15.2 7.6c-2 0-3.3 1.3-3.3 3.3V17c0 1.6-1 2.5-2.4 2.5M8.6 11.4h5.8" stroke="#fff" stroke-width="2.2"/>'],
    mint: ['Linux Mint', '#9be15a', '#4f9a1f', '<path d="M4.5 6v8.5a4 4 0 0 0 4 4h7a4 4 0 0 0 4-4V9M9 9v6.5M9 11.2a1.6 1.6 0 0 1 3.2 0v4.3M12.2 11.2a1.6 1.6 0 0 1 3.2 0v4.3" stroke="#fff" stroke-width="1.8"/>'],
    pop: ['Pop!_OS', '#5fd2dd', '#2a98a6', '<path d="M12.2 5.5 10.6 14" stroke="#fff" stroke-width="2.6"/><circle cx="10" cy="17.6" r="1.6" fill="#fff" stroke="none"/><path d="M6 19.5h12" stroke="#fff" stroke-width="1.6" opacity=".7"/>'],
    opensuse: ['openSUSE', '#8fd14a', '#4b8c14', '<path d="M4.5 14.5c0-4.4 3.3-7.6 8-7.6 4 0 7 2.6 7 5.6 0 2-1.4 3.2-3 3.2s-2.7-1.1-2.7-2.4" stroke="#fff" stroke-width="2"/><circle cx="16.2" cy="12" r="1.2" fill="#fff" stroke="none"/>'],
    nixos: ['NixOS', '#8fc4ef', '#4171b8', '<path d="M12 3.5v17M4.6 7.8l14.8 8.4M4.6 16.2l14.8-8.4" stroke="#fff" stroke-width="2.2"/><circle cx="12" cy="12" r="2.4" fill="#4171b8" stroke="#fff" stroke-width="1.6"/>'],
    gentoo: ['Gentoo', '#9b8fd6', '#54487a', '<path fill="#fff" stroke="none" d="M9 4.5c4.5-1.2 10 2.2 10 5.6 0 3-6.6 6.5-9.6 9.4C7 21.8 5 20 7 17.2c1.7-2.3 4.8-3.6 4.8-4.8 0-1-3.7-1.5-4.6-3.2C6.4 7.7 7.4 5 9 4.5z"/><circle cx="13.4" cy="9.4" r="1.4" fill="#54487a" stroke="none"/>'],
    zorin: ['Zorin OS', '#48c0ff', '#0d84d6', '<path fill="#fff" stroke="none" d="M6.5 6h11l-1.6 2.6H4.9zM4.6 10.7h14.8v2.6H4.6zM8.1 15.4h11l-1.6 2.6h-11z"/>'],
    elementary: ['elementary OS', '#6f7a86', '#333a42', '<circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="1.8"/><path d="M5.2 14.5c4.3.2 10-1.6 10-4.6 0-1.7-1.4-2.6-3-2.6-3 0-4.7 3.6-3.6 6.6 1 2.8 4.6 3.6 7.6 2.2" stroke="#fff" stroke-width="1.6"/>'],
    kali: ['Kali Linux', '#5c9cff', '#1f5fd1', '<path d="M7 4.5v15M17.5 4.5 9.5 12l8 7.5" stroke="#fff" stroke-width="2.4"/>'],
    steamos: ['SteamOS', '#4fb6ff', '#1a5fa8', '<circle cx="12" cy="12" r="7.6" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="#fff" stroke="none"/>'],
    bazzite: ['Bazzite', '#a27bff', '#5b2fd0', '<path d="M7 4.5h6.3a3.7 3.7 0 0 1 0 7.4H7zM7 11.9h7a3.8 3.8 0 0 1 0 7.6H7z" stroke="#fff" stroke-width="2.2"/>'],
  };
  // a distro que o PC manda ("id:id_like") vira um dos ícones (o parente, se a distro não tiver o seu)
  const PARENTES = { linuxmint: 'mint', pop: 'pop', popos: 'pop', archarm: 'arch', endeavouros: 'endeavouros', garuda: 'arch', artix: 'arch', opensuseleap: 'opensuse', opensusetumbleweed: 'opensuse', suse: 'opensuse', sles: 'opensuse', rhel: 'fedora', centos: 'fedora', rocky: 'fedora', almalinux: 'fedora', nobara: 'fedora', ultramarine: 'fedora', holo: 'steamos', neon: 'kubuntu', elementaryos: 'elementary', raspbian: 'debian', kalilinux: 'kali', mx: 'debian', deepin: 'debian', void: 'linux' };
  AP.normal = (bruto, so) => {
    const [id, like] = String(bruto || '').toLowerCase().split(':');
    for (const x of [id, like]) { if (!x) continue; if (SIS[x]) return x; if (PARENTES[x]) return PARENTES[x]; }
    const s = String(so || '').toLowerCase();
    return s === 'linux' ? 'linux' : s === 'windows' ? 'windows' : s === 'macos' ? 'macos' : s === 'android' ? 'android' : s === 'ios' ? 'ios' : '';
  };
  AP.lista = () => Object.keys(SIS).filter((k) => k !== 'windows');
  AP.nome = (id) => (SIS[id] ? SIS[id][0] : '');

  // o selo do sistema: um quadradinho de vidro com a cor dele e o desenho em branco
  AP.selo = (id, tam = 16) => {
    const s = SIS[id]; if (!s) return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', Math.round(tam * 0.74)); svg.setAttribute('height', Math.round(tam * 0.74)); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = s[3]; // conteúdo fixo do código, nunca de usuários
    return h('span', { class: 'so-selo', title: s[0], 'aria-label': s[0], estilo: { '--a': s[1], '--b': s[2], '--t': tam + 'px' } }, svg);
  };
  const tipoIc = (k, tam) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', tam); svg.setAttribute('height', tam); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.1'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = TIPOS[k][0];
    return svg;
  };

  // os símbolos de quem está conectado: um por tipo de aparelho (com o sistema dele, se a pessoa deixa aparecer)
  AP.chave = (codigo) => { const ds = (A.hub && A.hub.dispositivosDe) ? A.hub.dispositivosDe(codigo) : []; return ds.map((d) => (d.ap || '') + (d.sov || '')).sort().join(); };
  AP.junto = (codigo, { tam = 14, rotulo = false } = {}) => {
    if (A.cfg && A.cfg.v.verAparelhos === false) return null;
    const ds = (A.hub && A.hub.dispositivosDe) ? A.hub.dispositivosDe(codigo) : [];
    const vistos = new Map();
    for (const d of ds) { if (!d.ap || !TIPOS[d.ap]) continue; const k = d.ap + ':' + (d.sov || ''); if (!vistos.has(k)) vistos.set(k, d); }
    if (!vistos.size) return null;
    const el = h('span', { class: 'ap-junto' + (rotulo ? ' com-rotulo' : '') });
    for (const d of vistos.values()) {
      const t = TIPOS[d.ap], so = SIS[d.sov] ? d.sov : '';
      const nome = T(t[1], t[2]) + (so ? ' · ' + SIS[so][0] : '');
      el.append(h('span', { class: 'ap-ic ap-' + d.ap, title: nome, 'aria-label': nome }, tipoIc(d.ap, tam), so ? AP.selo(so, Math.round(tam * 0.95)) : null, rotulo ? h('small', {}, nome) : null));
    }
    return el;
  };

  // ---------- o sistema deste aparelho ----------
  const doNavegador = () => {
    const ua = navigator.userAgent || '';
    if (/CrOS/.test(ua)) return 'chromeos';
    if (/Android/.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Mac OS X/.test(ua)) return 'macos';
    if (/Windows NT 10/.test(ua)) return 'windows';
    if (/Windows NT 6\.[23]/.test(ua)) return 'win8';
    if (/Windows NT 6\.1/.test(ua)) return 'win7';
    if (/Linux/.test(ua)) return 'linux';
    return '';
  };
  AP.detectado = async () => { const m = await A.maquina().catch(() => ({})); return AP.normal(m.sov, m.so) || doNavegador(); };
  AP.meu = async () => { const esc = A.cfg && A.cfg.v.sistemaIcone; return esc && SIS[esc] ? esc : AP.detectado(); };
  AP.escolher = async (id) => { A.cfg.v.sistemaIcone = SIS[id] ? id : ''; A.cfg.salvar(); if (A.hub && A.hub.enviar) A.hub.enviar({ tipo: 'sov', v: await AP.meu() }); A.evt.emit('aparelhos:mudou'); };

  // ---------- Conta > Privacidade: o que aparece ao lado do seu nome ----------
  AP.secao = (p, salvar) => {
    const U = A.ui;
    const prevSo = h('span', { class: 'ap-prev-so' });
    const grade = h('div', { class: 'so-grade', role: 'listbox', 'aria-label': T('Ícone do sistema', 'System icon') });
    const pintar = async () => {
      const auto = await AP.detectado(), esc = (A.cfg.v.sistemaIcone && SIS[A.cfg.v.sistemaIcone]) ? A.cfg.v.sistemaIcone : '';
      prevSo.replaceChildren(AP.selo(esc || auto || 'linux', 22) || '');
      grade.replaceChildren(
        h('button', { type: 'button', class: 'so-op' + (!esc ? ' on' : ''), role: 'option', 'aria-selected': String(!esc), onclick: () => AP.escolher('').then(pintar) }, AP.selo(auto || 'linux', 26), h('small', {}, T('Automático', 'Automatic'))),
        ...AP.lista().map((k) => h('button', { type: 'button', class: 'so-op' + (esc === k ? ' on' : ''), role: 'option', 'aria-selected': String(esc === k), onclick: () => AP.escolher(k).then(pintar) }, AP.selo(k, 26), h('small', {}, SIS[k][0]))));
    };
    pintar();
    const gradeCx = h('div', { class: 'so-grade-cx' + (p.mostrarSistema ? '' : ' fechado') }, h('p', { class: 'peq suave', estilo: { margin: '0 0 8px' } }, T('O ícone que aparece (vale para este aparelho). No automático, o Aero usa o sistema que ele encontrou.', 'The icon shown (for this device). On automatic, Aero uses the system it found.')), grade);
    const op = (titulo, chave, desc) => h('div', { class: 'opcao' }, h('div', { class: 'cresce' }, h('div', {}, titulo), h('small', { class: 'suave' }, desc)), chave);
    return h('div', { class: 'col ap-secao', estilo: { gap: '6px' } },
      op(T('Mostrar os aparelhos conectados ao lado do nome', 'Show connected devices next to your name'), U.chave(!p.esconderAparelhos, (v) => salvar({ esconderAparelhos: !v })), T('Um símbolo para cada um: computador, celular ou navegador.', 'One symbol each: computer, phone or browser.')),
      op(h('span', { class: 'linha', estilo: { gap: '8px' } }, T('Mostrar o ícone do sistema', 'Show the system icon'), prevSo), U.chave(!!p.mostrarSistema, (v) => { gradeCx.classList.toggle('fechado', !v); salvar({ mostrarSistema: v }); }), T('A distro do Linux, a versão do Windows, macOS ou Android, junto do símbolo do aparelho.', 'Your Linux distro, Windows version, macOS or Android, next to the device symbol.')),
      gradeCx,
      op(T('Ver os aparelhos dos amigos', 'See friends\' devices'), U.chave(A.cfg.v.verAparelhos !== false, (v) => { A.cfg.v.verAparelhos = v; A.cfg.salvar(); A.evt.emit('aparelhos:mudou'); }), T('Os símbolos ao lado do nome de quem deixa aparecer.', 'The symbols next to the name of those who allow it.')));
  };
})();

// os símbolos "ao vivo": um lugar que se atualiza sozinho quando a pessoa conecta ou sai de um aparelho
(() => {
  const A = window.Aero, AP = A.aparelhos, h = A.h;
  AP.vivo = (codigo, op = {}) => { const el = h('span', { class: 'ap-vivo', dados: { apCod: codigo, apOp: JSON.stringify(op) } }); const j = AP.junto(codigo, op); if (j) el.append(j); return el; };
  const atualizar = (codigo) => {
    for (const el of document.querySelectorAll(codigo ? `.ap-vivo[data-ap-cod="${CSS.escape(codigo)}"]` : '.ap-vivo')) {
      let op = {}; try { op = JSON.parse(el.dataset.apOp || '{}'); } catch (_) { /* padrão */ }
      const j = AP.junto(el.dataset.apCod, op); el.replaceChildren(...(j ? [j] : []));
    }
  };
  A.evt.on('hub:presenca', (d) => atualizar(d && d.p && d.p.codigo));
  A.evt.on('hub:offline', (p) => atualizar(p && p.codigo));
  A.evt.on('aparelhos:mudou', () => atualizar());
})();
