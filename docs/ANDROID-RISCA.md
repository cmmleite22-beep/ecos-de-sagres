# Risca e Arrisca — app Android e Play Store

A app Android é o **comando** do jogo (o telemóvel). A TV continua a ser a página na Chromecast.
A app é uma *Trusted Web Activity* (TWA): abre a página `/risca/comando/` em ecrã inteiro, com o Chrome por baixo,
por isso o Chromecast funciona como no browser e qualquer melhoria no site chega logo à app, sem nova versão.

Código em `android-risca/`. Compila sozinha no GitHub (workflow **App Android Risca e Arrisca**) sempre que
`android-risca/` muda no `main`, ou à mão em *Actions → App Android Risca e Arrisca → Run workflow*.

## Instalar já (sem Play Store)

No telemóvel Android, abrir no Chrome:

**https://cmmleite22-beep.github.io/ecos-de-sagres/risca/app/**

O Android pede para autorizar a instalação a partir do Chrome. Enquanto o site estiver em `github.io`,
a app mostra uma barra fina com o endereço no topo (ver «Alojamento» abaixo); tudo o resto funciona.

Os ficheiros ficam também na release `risca-android` do repositório:
`risca-e-arrisca.apk` (instalar no telemóvel), `risca-e-arrisca.aab` (para a Play Store) e `LEIA-ME-chave.txt`.

## Alojamento grátis com domínio próprio (Cloudflare Pages)

Para a barra do endereço desaparecer, o Android tem de encontrar `/.well-known/assetlinks.json` na **raiz** do
domínio. No GitHub Pages o site está numa subpasta (`/ecos-de-sagres/`), por isso não dá. O Cloudflare Pages é grátis,
tem HTTPS e põe o site na raiz:

1. Criar conta grátis em https://dash.cloudflare.com/sign-up
2. *Workers & Pages → Create → Pages → Connect to Git* e escolher `cmmleite22-beep/ecos-de-sagres`.
3. Definições: *Production branch* `main`, *Build command* `npm ci && npm run build:site`, *Build output directory* `_site`.
4. O site fica em `https://<nome>.pages.dev` (o jogo em `/risca/tv/` e `/risca/comando/`).
5. Depois disso (o Claude pode fazer estes passos):
   - na consola Google Cast, mudar o endereço do receiver para `https://<nome>.pages.dev/risca/tv/`;
   - no GitHub, *Settings → Secrets and variables → Actions → Variables*, criar `RISCA_SITE_URL` = `https://<nome>.pages.dev`;
   - copiar a linha `assetlinks.json` do `LEIA-ME-chave.txt` para `public/.well-known/assetlinks.json` e voltar a compilar a app.

Outras opções grátis: Firebase Hosting e Netlify (também põem o site na raiz).

## Chave de assinatura (obrigatória para a Play Store)

Sem configuração, cada compilação usa uma chave temporária nova: serve para testar, mas a Play Store recusa
atualizações assinadas com chaves diferentes. Para fixar a chave, uma única vez, num computador com Java:

```
keytool -genkeypair -keystore risca.keystore -alias risca -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 risca.keystore > risca.keystore.b64
```

No GitHub, *Settings → Secrets and variables → Actions → New repository secret*:
- `RISCA_KEYSTORE_B64` = conteúdo de `risca.keystore.b64`
- `RISCA_KEYSTORE_PASS` = a palavra-passe escolhida

Guardar `risca.keystore` e a palavra-passe num sítio seguro (sem elas não há atualizações).

## Publicar na Play Store

1. **Conta de programador** Google Play: https://play.google.com/console (pagamento único de 25 USD, verificação de identidade).
2. Contas pessoais novas têm de fazer um **teste fechado com pelo menos 12 testadores durante 14 dias** antes de publicar.
3. *Criar app* → nome «Risca e Arrisca», jogo, grátis ou pago.
4. Carregar `risca-e-arrisca.aab` (release `risca-android`). Ativar a **Play App Signing**.
5. Em *Integridade da app → Assinatura*, copiar a impressão SHA-256 da **chave de assinatura da app** da Google e
   juntá-la à lista `sha256_cert_fingerprints` do `assetlinks.json` (além da chave de upload).
6. Ficha da loja: ícone `android-risca/loja/icone-512.png`, gráfico `android-risca/loja/grafico-destaque-1024x500.png`,
   capturas (há várias na pasta do projeto), descrição curta e longa.
7. **Política de privacidade**: `https://<site>/risca/privacidade.html`.
8. **Segurança dos dados**: o jogo não recolhe dados pessoais; nomes e desenhos só passam entre o telemóvel e a TV
   durante o jogo e não ficam guardados em servidor.
9. **Classificação de conteúdo** (questionário IARC) e público-alvo. Se escolher crianças com menos de 13 anos,
   aplica-se a política *Famílias* (sem anúncios não certificados, sem recolha de dados).
10. Rentabilizar: app paga (mais simples), ou grátis com compras na app (por exemplo pacotes de temas),
    o que obriga a usar a faturação da Google Play.

## Testes de que ainda não há garantia

- O Chromecast dentro da app usa o Chrome do telemóvel; deve funcionar como no browser, mas ainda não foi experimentado num telemóvel real.
- A app foi compilada no GitHub; não foi experimentada num emulador.
