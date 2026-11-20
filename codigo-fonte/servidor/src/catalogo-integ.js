// (1.0.2) O catálogo das integrações oficiais: o que aparece na aba Integrações e na barra da chamada vem daqui, e o app instalado busca
// esta lista ao abrir (GET /api/integ-catalogo). Para lançar uma integração nova basta pôr uma entrada aqui e publicar o worker:
// ninguém precisa atualizar o app.
//
// Nenhuma integração manda código para o app (a mesma regra das skins). O que ela FAZ é um dos tipos que o app já conhece:
//  - 'nativa'  o comportamento já vem no app (modulo: 'musica', 'celmic', 'gunslol'...). App velho que não conhece o módulo mostra
//              "Atualize o Aero" no lugar do botão de instalar.
//  - 'link'    um botão que abre um endereço https no navegador (o app pergunta antes, mostrando o site).
//  - 'janela'  uma janelinha do próprio Aero com texto, listas e links (blocos de dados; o app desenha, nada de HTML).
// Cada entrada: id, versao, nome/resumo/desc/onde (pt e en), icone (um dos ícones do app), cat ('conversa' ou 'widget'), plano mínimo
// (0 = todo mundo, 1 Standard, 2 Plus, 3 Donator, 4 Supporter), plataformas ('pc', 'web', 'celular'), appMin (versão mínima do app)
// e o tipo com o que ele precisa. Os textos dos tipos (botões, avisos) ficam no app; os de cada integração ficam aqui.

const ID = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, ICONE = /^[a-zA-Z0-9]{1,24}$/, VERSAO = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const RESERVADOS = /^c-/; // as da Comunidade usam c-xxxxxxxxxx
export const TIPOS_INTEG = ['nativa', 'link', 'janela'];
export const CATS_INTEG = ['conversa', 'widget'];
export const PLATAFORMAS = ['pc', 'web', 'celular'];
export const LUGARES = ['chamada']; // onde um 'link' ou 'janela' ganha botão além da própria página
const BLOCOS = ['titulo', 'texto', 'lista', 'link'];
const MAX = { nome: 40, resumo: 160, desc: 1200, onde: 400, seguro: 240, bloco: 600, item: 200, rotulo: 60 };

export const CATALOGO = [
  { id: 'musica', versao: 1, icone: 'musica', cat: 'conversa', cena: 'musica', plano: 0, plataformas: ['pc', 'web', 'celular'], appMin: '0.9.6',
    tipo: 'nativa', modulo: 'musica',
    nome: { pt: 'Música junto', en: 'Music together' },
    resumo: { pt: 'Música junto nas DMs, nos grupos e nas chamadas, sem bot.', en: 'Music together in DMs, groups and calls, no bot.' },
    desc: { pt: 'Cole um link do YouTube e a música toca ao mesmo tempo para todo mundo da conversa que também tem a integração, com fila. Começa sozinha para quem está na chamada ou com o chat aberto; quem quiser para de ouvir com um clique. Na DM os dois mexem; no grupo o dono e os admins, e o dono pode liberar para todo mundo.', en: 'Paste a YouTube link and the song plays at the same time for everyone in the chat who also has it, with a queue. It starts on its own for people in the call or with the chat open; anyone can stop listening in one click. In DMs both can control it; in groups the owner and admins, and the owner can open it to everyone.' },
    onde: { pt: 'No botão de nota musical no topo de cada conversa e na barra da chamada. O volume fica no próprio menu.', en: 'In the music note button at the top of each chat and in the call bar. Volume is in the menu itself.' },
    seguro: [{ pt: 'Feita pela equipe do Aero e revisada como o resto do app.', en: 'Made by the Aero team and reviewed like the rest of the app.' },
      { pt: 'Só conta ao servidor o link da música e quem pôs. Não lê as suas mensagens.', en: 'Only tells the server the song link and who added it. Does not read your messages.' }] },
  { id: 'celmic', versao: 1, icone: 'celular', cat: 'conversa', plano: 0, plataformas: ['pc'], appMin: '0.9.6',
    tipo: 'nativa', modulo: 'celmic', curto: { pt: 'Celular', en: 'Phone' },
    nome: { pt: 'Celular como microfone', en: 'Phone as microphone' },
    resumo: { pt: 'Use o microfone do celular na chamada, pelo seu Wi-Fi.', en: 'Use your phone microphone in the call, over your Wi-Fi.' },
    desc: { pt: 'Sem microfone bom no PC? Conecte o celular que está no mesmo Wi-Fi: leia o QR code, permita no PC e a sua voz sai pelo celular. Ele aparece no seletor do microfone da chamada, junto dos outros, e passa pela mesma supressão de ruído e volume.', en: 'No good microphone on the PC? Connect the phone that is on the same Wi-Fi: scan the QR code, allow it on the PC and your voice comes from the phone. It shows up in the call microphone picker next to the others and goes through the same noise suppression and volume.' },
    onde: { pt: 'Na barra da chamada (no botão do celular, ou no + quando você tem mais de uma integração) e na setinha do microfone. Só no app do PC.', en: 'In the call bar (the phone button, or the + when you have more than one integration) and in the microphone arrow. PC app only.' },
    seguro: [{ pt: 'O servidor fica só na sua rede local: atende só endereços de rede privada e nada vai para a internet.', en: 'The server stays on your local network: it only answers private network addresses and nothing goes to the internet.' },
      { pt: 'Código de uso único que vence em 2 minutos e aceita poucas tentativas; o PC sempre pergunta antes de aceitar um celular.', en: 'Single-use code that expires in 2 minutes with few tries; the PC always asks before accepting a phone.' },
      { pt: 'Só passa o áudio do microfone: nenhum comando, arquivo ou tela. Desliga sozinho quando a chamada termina.', en: 'Only microphone audio goes through: no commands, files or screen. Turns off by itself when the call ends.' }] },
  { id: 'gunslol', versao: 1, icone: 'link', cat: 'widget', cena: 'gunslol', plano: 0, plataformas: ['pc', 'web', 'celular'], appMin: '0.9.6',
    tipo: 'nativa', modulo: 'gunslol',
    nome: { pt: 'guns.lol', en: 'guns.lol' },
    resumo: { pt: 'Uma prévia do seu guns.lol no cartão do perfil.', en: 'A preview of your guns.lol on your profile card.' },
    desc: { pt: 'Coloque o seu nick do guns.lol e o cartão do seu perfil ganha uma prévia da sua página: o seu banner como capa, a sua foto com brilho, o seu nome, um pedaço da bio e o link. Quem abrir o seu perfil clica e vai direto para lá.', en: 'Add your guns.lol nickname and your profile card gets a preview of your page: your banner as the cover, your photo with a glow, your name, a bit of your bio and the link. Anyone who opens your profile clicks it and goes straight there.' },
    onde: { pt: 'Em Perfil > Widgets: o link já vem com https://guns.lol/, é só pôr o seu nick. Para mudar o lugar e o tamanho, use a aba Arranjo.', en: 'In Profile > Widgets: the link already starts with https://guns.lol/, just add your nickname. To move or resize it, use the Layout tab.' },
    seguro: [{ pt: 'Só guarda o seu nick no perfil, como o @ do Discord.', en: 'Only stores your nickname in your profile, like the Discord @.' },
      { pt: 'O app não abre o guns.lol sozinho: só quando alguém clica no widget.', en: 'The app never opens guns.lol by itself: only when someone clicks the widget.' }] },
  { id: 'assistindo', versao: 1, icone: 'tela', cat: 'widget', plano: 0, plataformas: ['pc'], appMin: '0.9.6',
    tipo: 'nativa', modulo: 'assistindo',
    nome: { pt: 'Assistindo agora', en: 'Watching now' },
    resumo: { pt: 'Mostra aos amigos a live ou o vídeo que você assiste: Twitch, Kick, YouTube e os sites que você quiser.', en: 'Shows friends the live or video you are watching: Twitch, Kick, YouTube and any site you want.' },
    desc: { pt: 'Como o "Assistindo" do Discord. Com a extensão do Aero no navegador (a mesma do "Ouvindo agora"), os amigos veem embaixo do seu nome a live da Twitch ou da Kick, ou o vídeo do YouTube que você está vendo, e no seu perfil um cartão com a miniatura, o título, o canal e o tempo. Você também pode adicionar outros sites, como o X: escolha o nome, o domínio, o ícone, o texto que aparece e de onde tirar o título e o autor. Cada site pode ser desligado quando quiser.', en: 'Like Discord\'s "Watching". With the Aero browser extension (the same one as "Listening now"), friends see under your name the Twitch or Kick live or the YouTube video you are watching, and a card on your profile with the thumbnail, title, channel and time. You can also add other sites, like X: pick the name, domain, icon, the text shown and where the title and author come from. Each site can be turned off any time.' },
    onde: { pt: 'Na própria página desta integração, depois de instalar: os sites ligados, os seus sites e o botão de instalar a extensão. No modo invisível ninguém vê.', en: 'On this integration\'s own page, after installing: the sites that are on, your own sites and the button to install the extension. In invisible mode nobody sees it.' },
    seguro: [{ pt: 'A extensão só lê o título, o canal e o tempo do vídeo nos sites ligados; nada mais da página.', en: 'The extension only reads the title, channel and video time on the sites that are on; nothing else from the page.' },
      { pt: 'Ela fala só com o Aero deste computador, com um código de pareamento; os sites novos precisam da sua permissão no navegador.', en: 'It only talks to Aero on this computer, with a pairing code; new sites need your permission in the browser.' },
      { pt: 'Os links e as imagens que os amigos veem são montados pelo Aero, e abrir um link sempre pergunta antes.', en: 'The links and images friends see are built by Aero, and opening a link always asks first.' }] },
  // (1.0.0) o que era do app e virou integração: só aparece para quem instala
  { id: 'traducao', versao: 1, icone: 'traduzir', cat: 'conversa', plano: 0, plataformas: ['pc', 'web', 'celular'], appMin: '1.0.0',
    tipo: 'nativa', modulo: 'traducao',
    nome: { pt: 'Tradução', en: 'Translation' },
    resumo: { pt: 'Traduza mensagens com um clique, ou deixe traduzir sozinho.', en: 'Translate messages in one click, or let it translate by itself.' },
    desc: { pt: 'Ganha o "Traduzir" no botão direito das mensagens. Se quiser, as mensagens dos outros chegam já traduzidas (com o original a um clique) e o que você escreve vai traduzido para a língua que escolher.', en: 'Adds "Translate" to the right-click menu of messages. If you want, other people\'s messages arrive already translated (with the original one click away) and what you write is sent translated into the language you choose.' },
    onde: { pt: 'No botão direito de cada mensagem. As opções ficam em Configurações > Chats > Tradução e horário.', en: 'In the right-click menu of each message. Options are in Settings > Chats > Translation and time.' },
    seguro: [{ pt: 'Passa pelo servidor do Aero: o seu endereço (IP) nunca chega no tradutor.', en: 'Goes through the Aero server: your address (IP) never reaches the translator.' },
      { pt: 'Só vai o texto que você mandou traduzir, nada da sua conta.', en: 'Only the text you asked to translate is sent, nothing from your account.' }] },
  { id: 'dicionario', versao: 1, icone: 'livro', cat: 'conversa', plano: 0, plataformas: ['pc', 'web', 'celular'], appMin: '1.0.0',
    tipo: 'nativa', modulo: 'dicionario',
    nome: { pt: 'Dicionário', en: 'Dictionary' },
    resumo: { pt: 'O significado de qualquer palavra das mensagens, comparando duas línguas.', en: 'The meaning of any word in messages, comparing two languages.' },
    desc: { pt: 'Selecione uma palavra (ou escolha entre as da mensagem) e veja o verbete do Wikcionário, com pronúncia e lado a lado em duas línguas.', en: 'Select a word (or pick one from the message) and see its Wiktionary entry, with pronunciation and side by side in two languages.' },
    onde: { pt: 'No botão direito de cada mensagem.', en: 'In the right-click menu of each message.' },
    seguro: [{ pt: 'Passa pelo servidor do Aero: o seu endereço (IP) nunca chega no Wikcionário.', en: 'Goes through the Aero server: your address (IP) never reaches Wiktionary.' }] },
  { id: 'horario', versao: 1, icone: 'relogio', cat: 'conversa', plano: 0, plataformas: ['pc', 'web', 'celular'], appMin: '1.0.0',
    tipo: 'nativa', modulo: 'horario',
    nome: { pt: 'Horário dos amigos', en: 'Friends\' time' },
    resumo: { pt: 'Veja que horas são para cada amigo, ao lado do nome dele.', en: 'See what time it is for each friend, next to their name.' },
    desc: { pt: 'O horário de cada amigo aparece no perfil e no topo da conversa, só de quem escolheu mostrar. Você também pode mostrar o seu.', en: 'Each friend\'s local time shows on their profile and at the top of the chat, only for those who chose to show it. You can show yours too.' },
    onde: { pt: 'Para mostrar o seu: Configurações > Chats > Tradução e horário.', en: 'To show yours: Settings > Chats > Translation and time.' },
    seguro: [{ pt: 'Só o fuso horário vai para o perfil, e só se você ligar.', en: 'Only your time zone goes to your profile, and only if you turn it on.' }] },
  { id: 'cartoes', versao: 1, icone: 'link', cat: 'conversa', plano: 0, plataformas: ['pc', 'web', 'celular'], appMin: '1.0.0',
    tipo: 'nativa', modulo: 'cartoes',
    nome: { pt: 'Cartões de links', en: 'Link cards' },
    resumo: { pt: 'Links do Spotify, Reddit, Amazon e AliExpress viram cartões bonitos.', en: 'Spotify, Reddit, Amazon and AliExpress links become nice cards.' },
    desc: { pt: 'Com capa, fotos, vídeo, trecho da música, preço e avaliações, direto na conversa.', en: 'With cover, photos, video, song preview, price and ratings, right in the chat.' },
    onde: { pt: 'Nas conversas, sempre que alguém manda um desses links.', en: 'In chats, whenever someone sends one of these links.' },
    seguro: [{ pt: 'Os dados do cartão passam pelo servidor do Aero: o seu endereço (IP) não chega nos sites.', en: 'Card data goes through the Aero server: your address (IP) does not reach the sites.' }] },
];

// ---------- a conferência (roda ao publicar o worker, nos testes e de novo no app) ----------
const txt = (v, n) => (v && typeof v === 'object' && typeof v.pt === 'string' && v.pt.trim() && v.pt.length <= n && (v.en === undefined || (typeof v.en === 'string' && v.en.length <= n)) ? { pt: v.pt, en: v.en || v.pt } : null);
const httpsOk = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password && u.length <= 500; } catch (e) { return false; } };
const versaoOk = (v) => typeof v === 'string' && VERSAO.test(v);

// devolve a entrada limpa ou lança um erro dizendo o que está errado
export function conferirEntrada(x) {
  const falha = (o) => { throw new Error('catálogo de integrações: ' + (x && x.id ? x.id + ': ' : '') + o); };
  if (!x || typeof x !== 'object') falha('entrada inválida');
  if (!ID.test(x.id || '') || RESERVADOS.test(x.id)) falha('id inválido');
  if (!TIPOS_INTEG.includes(x.tipo)) falha('tipo desconhecido');
  if (!CATS_INTEG.includes(x.cat)) falha('cat desconhecida');
  if (!ICONE.test(x.icone || '')) falha('ícone inválido');
  const nome = txt(x.nome, MAX.nome), resumo = txt(x.resumo, MAX.resumo), desc = txt(x.desc, MAX.desc), onde = x.onde === undefined ? null : txt(x.onde, MAX.onde);
  if (!nome || !resumo || !desc || (x.onde !== undefined && !onde)) falha('textos (nome, resumo, desc e onde precisam de pt, e de en se tiver)');
  const plano = Number.isInteger(x.plano) && x.plano >= 0 && x.plano <= 4 ? x.plano : falha('plano mínimo de 0 a 4');
  const plataformas = Array.isArray(x.plataformas) && x.plataformas.length && x.plataformas.every((p) => PLATAFORMAS.includes(p)) ? [...new Set(x.plataformas)] : falha('plataformas');
  if (!versaoOk(x.appMin)) falha('appMin (versão mínima do app, como 1.0.2)');
  const o = { id: x.id, versao: Number.isInteger(x.versao) && x.versao >= 1 ? x.versao : 1, tipo: x.tipo, cat: x.cat, icone: x.icone, plano, plataformas, appMin: x.appMin, nome, resumo, desc };
  if (onde) o.onde = onde;
  if (x.curto !== undefined) o.curto = txt(x.curto, 16) || falha('curto');
  if (x.cena !== undefined) o.cena = /^[a-z]{1,16}$/.test(x.cena) ? x.cena : falha('cena');
  if (x.seguro !== undefined) { o.seguro = Array.isArray(x.seguro) && x.seguro.length <= 6 ? x.seguro.map((s) => txt(s, MAX.seguro) || falha('seguro')) : falha('seguro'); }
  if (x.tipo === 'nativa') o.modulo = /^[a-z][a-z0-9]{1,23}$/.test(x.modulo || '') ? x.modulo : falha('modulo');
  if (x.tipo === 'link' || x.tipo === 'janela') {
    o.lugares = x.lugares === undefined ? [] : Array.isArray(x.lugares) && x.lugares.every((l) => LUGARES.includes(l)) ? [...new Set(x.lugares)] : falha('lugares');
    o.rotulo = x.rotulo === undefined ? null : txt(x.rotulo, MAX.rotulo) || falha('rotulo');
    if (!o.rotulo) delete o.rotulo;
  }
  if (x.tipo === 'link') o.url = httpsOk(x.url) ? x.url : falha('url (só https)');
  if (x.tipo === 'janela') {
    if (!Array.isArray(x.blocos) || !x.blocos.length || x.blocos.length > 30) falha('blocos (de 1 a 30)');
    o.blocos = x.blocos.map((b) => {
      if (!b || !BLOCOS.includes(b.t)) falha('bloco de tipo desconhecido');
      if (b.t === 'lista') return { t: 'lista', itens: Array.isArray(b.itens) && b.itens.length && b.itens.length <= 12 ? b.itens.map((i) => txt(i, MAX.item) || falha('item da lista')) : falha('lista') };
      const y = { t: b.t, x: txt(b.x, b.t === 'titulo' ? 80 : MAX.bloco) || falha('texto do bloco') };
      if (b.t === 'link') y.url = httpsOk(b.url) ? b.url : falha('url do bloco (só https)');
      return y;
    });
  }
  return o;
}
export function conferirCatalogo(lista) {
  const ids = new Set();
  return lista.map((x) => { const o = conferirEntrada(x); if (ids.has(o.id)) throw new Error('catálogo de integrações: id repetido ' + o.id); ids.add(o.id); return o; });
}

// conferido uma vez quando o worker sobe: um catálogo errado não chega a ninguém (o teste do servidor também confere)
const LIMPO = conferirCatalogo(CATALOGO);
// a "versão" do catálogo: muda sempre que qualquer coisa nele muda (o app só redesenha quando ela muda)
const hashTxt = (s) => { let a = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; } return a.toString(36); };
const CORPO = JSON.stringify({ v: hashTxt(JSON.stringify(LIMPO)), lista: LIMPO });
export const catalogoPublico = () => JSON.parse(CORPO);
export const catalogoCorpo = () => CORPO;
export const idsCatalogo = () => LIMPO.map((x) => x.id);
