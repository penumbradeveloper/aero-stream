# Código-fonte do Aero (só leitura)

**Português** · [English](#english)

Esta é uma cópia do código do Aero **só para leitura**, para quem quiser ver como o app funciona e conferir a privacidade. O app de verdade é baixado nas [Releases](https://github.com/penumbradeveloper/aero-stream/releases) ou usado no [Aero Web](https://web.aerostream.workers.dev/app/).

O que foi tirado desta cópia, de propósito:

- tudo o que publica versões e atualizações (as atualizações do app são assinadas, e a chave nunca fica em código);
- as configurações e endereços dos servidores (aparecem como `servidor.exemplo.invalid`);
- chaves, tokens e segredos (eles nunca ficaram no código), e-mails e IDs de contas;
- os testes automáticos.

Onde olhar:

| Pasta | O que tem |
| :-- | :-- |
| `app/` | a interface (a mesma no PC, no celular e no navegador) |
| `app/js/talk.js`, `app/js/cripto*.js` | o Aero Talk e a cifra de ponta a ponta |
| `desktop/` | o app do PC (Electron): transmissão, captura, controles |
| `servidor/src/` | o servidor (Cloudflare Workers) |
| `android/` | o app do Android (Capacitor) |
| `extensao/` | a extensão do navegador (Ouvindo e Assistindo agora) |

Licença: **todos os direitos reservados**, veja [LICENSE](LICENSE). Achou um problema de segurança? Avise pelo Feedback dentro do app.

<a name="english"></a>
## English

A **read-only** copy of Aero's code, so anyone can see how the app works and check its privacy. Release and update tooling, server settings and addresses, account IDs and tests were removed on purpose; secrets were never in the code. License: all rights reserved (see [LICENSE](LICENSE)). Found a security issue? Report it through Feedback in the app.
