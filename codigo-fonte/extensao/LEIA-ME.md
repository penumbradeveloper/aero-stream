# Aero - Ouvindo e assistindo (extensão do navegador)

Mostra aos amigos do Aero a música que toca no **YouTube Music** e no **Deezer** do navegador (o app do Spotify o Aero já lê sozinho) e, com a integração **Assistindo agora**, a live da **Twitch** ou da **Kick**, o vídeo do **YouTube** e os sites que a pessoa adicionou no Aero (aba Integrações > Assistindo agora).

- Uma pasta só para todos: Chrome, Edge, Opera, Brave, Vivaldi (MV3 com `service_worker`) e Firefox, Zen, LibreWolf, Floorp (Firefox 121+, que usa `background.scripts`).
- Lê só as abas `music.youtube.com` e `www.deezer.com`: título, artista, álbum, capa e posição.
- Assistindo agora (`video.js`): lê nas abas da Twitch, da Kick e do YouTube só o título, o canal ou autor, a categoria, se é ao vivo e o tempo do vídeo. A lista de sites (ligados, desligados e os da pessoa, com o que ler em cada um) vem do app do Aero; cada site da pessoa só passa a ser lido depois que ela o permite no botão da extensão (`optional_host_permissions`).
- Manda só para o app do Aero **neste computador** (`http://127.0.0.1:41783`), com o código de pareamento de Configurações > Privacidade. Sem o código certo o app recusa; sites não conseguem mandar (o app só aceita origem de extensão).
- No Linux, Firefox e Zen já funcionam sem a extensão (o Aero lê pelo MPRIS).

## Testar sem publicar
- Chrome/Edge/Opera/Brave: `chrome://extensions` > Modo do desenvolvedor > Carregar sem compactação > esta pasta.
- Firefox/Zen: `about:debugging#/runtime/this-firefox` > Carregar extensão temporária > `manifest.json`.

## Publicar
- Chrome Web Store / Edge Add-ons / Opera Add-ons: zip desta pasta.
- Firefox (AMO, vale para Zen e variantes): `web-ext build` nesta pasta e enviar o zip.
