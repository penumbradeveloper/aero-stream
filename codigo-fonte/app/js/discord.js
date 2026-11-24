// Aero Stream - Discord Rich Presence (app do PC, Windows e Linux). A interface só diz o que está acontecendo; quem fala com o
// Discord é o processo principal (desktop/discord.js). Linha 1: onde você está (sala, chamada, conversa, configurando...). Linha 2: o detalhe.
// Ícone grande: a sua foto de conta (nome e # aparecem ao passar o mouse); sem foto, o logo novo. Ícone pequeno: Aero Stream.
// Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, T = A.T;
  const D = (A.discord = { _t: 0, _ultimo: '', _inicio: 0, _estado: '' });
  const ponte = () => (window.aero && window.aero.discord) || null;

  // O que vai para o Discord, calculado só a partir do estado do app (função pura: testável)
  // (1.0.2) o que aparece é escolha da pessoa (Configurações > Conta > Privacidade): onde está no app, a conversa, a chamada, a sala,
  // o tempo e a própria conta. Tudo desligado: só o "Aero" com o logo
  D.PADRAO = { onde: true, conversa: 'tipo', chamada: 'sim', sala: true, conta: true, tempo: true };
  D.opcoes = () => ({ ...D.PADRAO, ...(A.cfg.v.discord || {}) });
  const ABAS = { conexoes: ['Vendo as conexões', 'Browsing connections'], talk: ['No Aero Talk', 'In Aero Talk'], integ: ['Nas integrações', 'In integrations'], dev: ['No painel do desenvolvedor', 'In the developer panel'], mod: ['Moderando', 'Moderating'] };
  const pessoas = (n) => (n === 1 ? T('1 pessoa', '1 person') : T(`${n} pessoas`, `${n} people`));
  D.montar = () => {
    const S = A.sala, eu = A.api.eu, cfg = A.cfg.v.discord, op = D.opcoes();
    const naSala = !!(S && S.ativa && S.admitido);
    const servidor = A.api.servidor || '';
    const foto = op.conta && eu && eu.av ? A.avatarUrl(eu.codigo, eu.av) : '';
    const logo = servidor ? servidor.replace(/\/+$/, '') + '/icon-512.png?v=logo2' : ''; // (1.0.2) o "?v=" troca o endereço: o Discord guardava o logo antigo pelo endereço (subir quando o logo mudar de novo)
    let estado = eu ? 'menu' : 'inicio', linha1 = '', linha2 = '';
    const ch = A.chamada && A.chamada.ativa, tk = A.talk, onde = A.onde || {};
    if (naSala && op.sala) {
      const n = S.participantes.length, transmitindo = !!S.local.tela, assistindo = !transmitindo && [...S.remotas.values()].some((r) => r.tela);
      estado = transmitindo ? 'transmitindo' : assistindo ? 'assistindo' : 'sala';
      linha1 = { sala: T('Em uma sala', 'In a room'), transmitindo: T('Transmitindo em uma sala', 'Streaming in a room'), assistindo: T('Assistindo em uma sala', 'Watching in a room') }[estado];
      linha2 = pessoas(n) + T(' na sala', ' in the room');
    } else if (ch && op.chamada !== 'nao') {
      const c = tk && (tk.conversas || []).find((x) => x.id === ch.cid), n = (ch.pares ? ch.pares.size : 0) + 1;
      estado = 'chamada';
      linha1 = ch.tela ? T('Mostrando a tela em uma chamada', 'Sharing the screen in a call') : T('Em uma chamada', 'In a call');
      linha2 = op.chamada === 'nome' && c ? (c.tipo === 'grupo' || c.pai ? T('em ', 'in ') : T('com ', 'with ')) + tk.titulo(c) + ' · ' + pessoas(n) : pessoas(n);
    } else if (onde.aba === 'talk' && tk && tk.aberta && op.conversa !== 'nao') {
      const c = (tk.conversas || []).find((x) => x.id === tk.aberta), grupo = !!(c && (c.tipo === 'grupo' || c.pai));
      estado = 'conversa';
      linha1 = grupo ? T('Conversando em um grupo', 'Chatting in a group') : T('Conversando', 'Chatting');
      linha2 = op.conversa === 'nome' && c ? (grupo ? '' : T('com ', 'with ')) + tk.titulo(c) : grupo ? '' : T('Mensagem direta', 'Direct message');
    } else if (eu && op.onde && onde.aba === 'config') {
      estado = 'config'; linha1 = T('Configurando', 'Configuring'); linha2 = onde.paginaNome || '';
    } else if (eu && op.onde && ABAS[onde.aba]) {
      estado = 'aba:' + onde.aba; linha1 = T(...ABAS[onde.aba]);
    } else if (eu && op.onde) linha1 = T('No menu', 'In the menu');
    else if (!eu) linha1 = T('Abrindo o Aero', 'Opening Aero');
    // (1.0.2) longe do computador (ou "ausente" escolhido): no Discord aparece "Ausente", mesmo com status personalizado ou não perturbe
    // (no app eles continuam como estão). Invisível: o Rich Presence some de vez
    const invisivel = !!(eu && eu.status === 'invisivel');
    if (eu && !invisivel && estado !== 'chamada' && !naSala && (eu.status === 'ausente' || (A.hub && A.hub.estado === 'ausente'))) { estado = 'ausente'; linha1 = T('Ausente', 'Away'); linha2 = ''; }
    return {
      ativo: cfg.ativo !== false && !!eu && !invisivel, appId: cfg.appId || '', estado, tempo: op.tempo,
      linha1, linha2,
      grande: foto || logo, grandeTexto: op.conta && eu ? `${eu.nome} #${eu.tag}` : 'Aero',
      pequeno: foto ? logo : '', pequenoTexto: 'Aero', semFoto: !foto,
    };
  };

  D.enviar = () => {
    const p = ponte(); if (!p || !p.presenca) return;
    const dados = D.montar();
    // (1.0.2) sala e chamada contam desde que começaram; no resto (abas, conversas, configurações) o tempo é o do app aberto, sem zerar a cada clique
    const fase = ['sala', 'transmitindo', 'assistindo', 'chamada'].includes(dados.estado) ? dados.estado : 'app';
    if (fase !== D._estado) { D._estado = fase; D._inicio = Date.now(); }
    dados.inicio = dados.tempo ? D._inicio : 0; delete dados.tempo;
    const chave = JSON.stringify({ ...dados, inicio: 0 });
    if (chave === D._ultimo) return;
    D._ultimo = chave;
    p.presenca(dados).catch(() => {});
  };
  D.agendar = () => { clearTimeout(D._t); D._t = setTimeout(D.enviar, 700); }; // junta várias mudanças seguidas em um envio só

  D.iniciar = () => {
    if (!ponte()) return;
    ['tela', 'perfil', 'discord:config', 'idioma', 'onde', 'chamada:entrou', 'chamada:fim', 'chamada:tela', 'talk:lista', 'hub:estado', 'status'].forEach((n) => A.evt.on(n, D.agendar));
    ['estado', 'fechada', 'local', 'stream', 'stream-fim', 'aprovado'].forEach((n) => A.evt.on('sala:' + n, D.agendar));
    setInterval(() => { D._ultimo = ''; D.enviar(); }, 60000); // reenvia de vez em quando (se o Discord foi aberto depois do Aero)
    D.agendar();
  };
})();
