// Aero Stream - Discord Rich Presence (app do PC, Windows e Linux). A interface só diz o que está acontecendo; quem fala com o
// Discord é o processo principal (desktop/discord.js). Linha 1: onde você está (menu / sala). Linha 2: quantas pessoas estão na sala.
// Ícone grande: a sua foto de conta (nome e # aparecem ao passar o mouse); sem foto, o logo novo. Ícone pequeno: Aero Stream.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, T = A.T;
  const D = (A.discord = { _t: 0, _ultimo: '', _inicio: 0, _estado: '' });
  const ponte = () => (window.aero && window.aero.discord) || null;

  // O que vai para o Discord, calculado só a partir do estado do app (função pura: testável)
  D.montar = () => {
    const S = A.sala, eu = A.api.eu, cfg = A.cfg.v.discord;
    const naSala = !!(S.ativa && S.admitido);
    const servidor = A.api.servidor || '';
    const foto = eu && eu.av ? A.avatarUrl(eu.codigo, eu.av) : '';
    const logo = servidor ? servidor.replace(/\/+$/, '') + '/icon-512.png?v=logo2' : ''; // (1.0.2) o "?v=" troca o endereço: o Discord guardava o logo antigo pelo endereço (subir quando o logo mudar de novo)
    const n = naSala ? S.participantes.length : 0;
    const transmitindo = !!(naSala && S.local.tela);
    const assistindo = naSala && !transmitindo && [...S.remotas.values()].some((r) => r.tela);
    const estado = naSala ? (transmitindo ? 'transmitindo' : assistindo ? 'assistindo' : 'sala') : eu ? 'menu' : 'inicio';
    return {
      ativo: cfg.ativo !== false && !!eu, appId: cfg.appId || '', estado,
      linha1: { menu: T('No menu', 'In the menu'), inicio: T('Abrindo o Aero', 'Opening Aero'), sala: T('Em uma sala', 'In a room'), transmitindo: T('Transmitindo em uma sala', 'Streaming in a room'), assistindo: T('Assistindo em uma sala', 'Watching in a room') }[estado],
      linha2: naSala ? (n === 1 ? T('1 pessoa na sala', '1 person in the room') : T(`${n} pessoas na sala`, `${n} people in the room`)) : '',
      grande: foto || logo, grandeTexto: eu ? `${eu.nome} #${eu.tag}` : 'Aero',
      pequeno: foto ? logo : '', pequenoTexto: 'Aero', semFoto: !foto,
    };
  };

  D.enviar = () => {
    const p = ponte(); if (!p || !p.presenca) return;
    const dados = D.montar();
    if (dados.estado !== D._estado) { D._estado = dados.estado; D._inicio = Date.now(); }
    dados.inicio = D._inicio;
    const chave = JSON.stringify({ ...dados, inicio: 0 });
    if (chave === D._ultimo) return;
    D._ultimo = chave;
    p.presenca(dados).catch(() => {});
  };
  D.agendar = () => { clearTimeout(D._t); D._t = setTimeout(D.enviar, 700); }; // junta várias mudanças seguidas em um envio só

  D.iniciar = () => {
    if (!ponte()) return;
    ['tela', 'perfil', 'discord:config', 'idioma'].forEach((n) => A.evt.on(n, D.agendar));
    ['estado', 'fechada', 'local', 'stream', 'stream-fim', 'aprovado'].forEach((n) => A.evt.on('sala:' + n, D.agendar));
    setInterval(() => { D._ultimo = ''; D.enviar(); }, 60000); // reenvia de vez em quando (se o Discord foi aberto depois do Aero)
    D.agendar();
  };
})();
