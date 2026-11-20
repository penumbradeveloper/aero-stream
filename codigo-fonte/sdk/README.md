# SDK de atividade do Aero

Mostre para os amigos, no Aero, o que acontece no seu jogo ou app. O cartão aparece no perfil e no mini perfil, e a linha "Jogando X" aparece nas listas de conversas, de membros e nas Conexões. O formato é o mesmo da presença do Discord.

```
Jogando
┌──────┐  Meu Jogo
│ capa │  Fase 3 — A Caverna
│    ◉ │  Modo difícil (2 de 4)
└──────┘  12:34 decorrido
```

*English version below.*

## Como funciona

O Aero (app do PC, Windows e Linux) abre um canal local chamado **`aero-ipc-0`**:

| Sistema | Caminho |
|---|---|
| Windows | `\\.\pipe\aero-ipc-0` |
| Linux | `$XDG_RUNTIME_DIR/aero-ipc-0` (ou `$TMPDIR`, `$TMP`, `$TEMP`, `/tmp`) |

O protocolo é **o mesmo do canal local do Discord** (`discord-ipc-0`). Por isso, qualquer biblioteca de presença do Discord funciona com o Aero: basta trocar o nome do canal de `discord-ipc` para `aero-ipc`. Só a própria pessoa consegue conectar, e nada sai do computador além do que o Aero mostra para os amigos.

O jogo **não precisa** ter um aplicativo cadastrado no Discord. Mande o campo `name` com o nome do jogo. Se você mandar o ID de um aplicativo do Discord como `client_id`, o Aero também usa o nome e as imagens cadastradas nele.

Os jogos que **já mandam presença ao Discord** aparecem no Aero sem mudar nada. Para isso, o Aero recebe pelo próprio canal do Discord e repassa tudo ao Discord, que continua funcionando igual. No Windows, o Aero precisa abrir antes do Discord.

## Bibliotecas prontas

### Node.js (`aero-atividade.js`, sem dependências)

```js
const { AeroAtividade } = require('./aero-atividade');
const aero = new AeroAtividade({ nome: 'Meu Jogo' });

aero.definir({
  details: 'Fase 3 — A Caverna',
  state: 'Modo difícil',
  timestamps: { start: Date.now() },
  assets: {
    large_image: 'https://i.imgur.com/capa.png', large_text: 'Meu Jogo',
    small_image: 'https://i.imgur.com/nivel.png', small_text: 'Nível 7',
  },
  party: { size: [2, 4] },
});

aero.limpar();  // tira a atividade
aero.fechar();  // desconecta (a atividade some sozinha)
```

Se o Aero estiver fechado, a biblioteca procura de novo a cada 15 s e manda a última atividade quando ele abrir.

### Python 3 (`aero_atividade.py`, só a biblioteca padrão)

```python
import time
from aero_atividade import AeroAtividade

aero = AeroAtividade(nome="Meu Jogo")
aero.definir(details="Fase 3", state="Modo difícil", start=time.time(),
             large_image="https://i.imgur.com/capa.png", large_text="Meu Jogo",
             party_size=2, party_max=4)
aero.limpar()
aero.fechar()
```

`definir` devolve `True` quando o Aero recebeu a atividade e `False` quando ele não está aberto. Nesse caso, a próxima chamada tenta de novo.

### Outras linguagens (C, C++, C#, Rust, Godot, Unity, Unreal...)

Use a biblioteca de presença do Discord que você já usa e troque o nome do canal (`discord-ipc-` → `aero-ipc-`). Na maioria delas, isso fica numa linha só, onde o caminho é montado. Ou implemente o protocolo abaixo, que tem poucas linhas.

## Protocolo

Cada mensagem é um quadro com o cabeçalho de 8 bytes (*little-endian*) seguido do JSON em UTF-8:

| Bytes | Conteúdo |
|---|---|
| 0–3 | `op` (int32): `0` handshake, `1` frame, `2` close, `3` ping, `4` pong |
| 4–7 | tamanho do JSON (int32) |
| 8… | JSON |

1. **Handshake** (op 0): `{"v": 1, "client_id": "meu-jogo"}`
2. O Aero responde (op 1): `{"cmd": "DISPATCH", "evt": "READY", "data": {...}}`
3. **Definir a atividade** (op 1):

```json
{ "cmd": "SET_ACTIVITY", "nonce": "1", "args": { "pid": 1234, "activity": {
  "name": "Meu Jogo",
  "type": 0,
  "details": "Fase 3 — A Caverna",
  "state": "Modo difícil",
  "timestamps": { "start": 1731900000, "end": 1731903600 },
  "assets": { "large_image": "https://...", "large_text": "texto do hover",
              "small_image": "https://...", "small_text": "texto do hover" },
  "party": { "id": "sala-1", "size": [2, 4] }
} } }
```

O Aero responde com o mesmo `nonce`. Para tirar a atividade, mande `SET_ACTIVITY` sem `activity`. Fechar a conexão também tira. Responda `ping` (op 3) com `pong` (op 4) e o mesmo conteúdo.

### Campos

| Campo | O que é | Limite |
|---|---|---|
| `name` | nome do jogo ou app ("Jogando **Meu Jogo**") | 100 caracteres |
| `type` | `0` Jogando, `2` Ouvindo, `3` Assistindo, `5` Competindo em | — |
| `details` | primeira linha | 100 |
| `state` | segunda linha (subtexto) | 100 |
| `timestamps.start` | quando começou: mostra o tempo decorrido | segundos ou milissegundos |
| `timestamps.end` | quando acaba: mostra o tempo que falta | segundos ou milissegundos |
| `assets.large_image` / `small_image` | ícone grande e ícone pequeno (o pequeno fica no canto do grande) | link `https` |
| `assets.large_text` / `small_text` | texto que aparece ao passar o mouse em cada ícone | 64 |
| `party.size` | `[atual, máximo]`: mostra "(2 de 4)" | — |

**Imagens:** os amigos veem as imagens por meio do servidor do Aero, e ninguém fala direto com sites de fora. Por isso, só aparecem imagens destes sites: `cdn.discordapp.com`, `media.discordapp.net`, `i.imgur.com`, `images.igdb.com`, os da Steam (`*.steamstatic.com`, `steamcdn-a.akamaihd.net`), os do Roblox (`tr.rbxcdn.com`) e `upload.wikimedia.org`. Também valem `mp:external/...` e os nomes das imagens de um aplicativo do Discord (quando `client_id` é o ID dele).

**Frequência:** mande só quando algo mudar. Os amigos recebem no máximo 30 atualizações por minuto.

---

# Aero activity SDK (English)

Show your friends on Aero what is happening in your game or app. The protocol is **the same as Discord's local IPC**, on the channel **`aero-ipc-0`** (`\\.\pipe\aero-ipc-0` on Windows, `$XDG_RUNTIME_DIR/aero-ipc-0` on Linux). Any Discord presence library works with Aero: just rename `discord-ipc` to `aero-ipc`.

- Send `name` with your game's name: no Discord application is needed.
- Fields: `name`, `type` (0 playing, 2 listening, 3 watching, 5 competing), `details`, `state`, `timestamps.start`/`end` (seconds or milliseconds), `assets.large_image`/`large_text`/`small_image`/`small_text`, `party.size`.
- Images must be `https` links from Discord's CDN, Imgur, IGDB, Steam, Roblox or Wikimedia. Friends load them through Aero's server.
- Ready-made libraries: `aero-atividade.js` (Node.js) and `aero_atividade.py` (Python 3), both dependency-free.
- Games that already send presence to Discord show on Aero automatically. Aero listens on Discord's channel and forwards everything to Discord. On Windows, Aero must start before Discord.
