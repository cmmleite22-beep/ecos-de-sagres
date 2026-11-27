# Risca e Arrisca — app Android e Play Store

A app Android é o **comando** do jogo (o telemóvel). A TV continua a ser a página na Chromecast.
A app é uma *Trusted Web Activity* (TWA): abre a página `/risca/comando/` em ecrã inteiro, com o Chrome por baixo,
por isso o Chromecast funciona como no browser e qualquer melhoria no site chega logo à app, sem nova versão.

Código em `android-risca/`. Compila sozinha no GitHub (workflow **App Android Risca e Arrisca**) sempre que
`android-risca/` muda no `main`, ou à mão em *Actions → App Android Risca e Arrisca → Run workflow*.

## Instalar já (sem Play Store)

No telemóvel Android, abrir no Chrome:

**https://risca-e-arrisca.web.app/risca/app/**

O Android pede para autorizar a instalação a partir do Chrome. Até haver `assetlinks.json` com a chave definitiva (ver «Chave de assinatura»), a app mostra uma barra fina
com o endereço no topo; tudo o resto funciona.

Os ficheiros ficam também na release `risca-android` do repositório:
`risca-e-arrisca.apk` (instalar no telemóvel), `risca-e-arrisca.aab` (para a Play Store) e `LEIA-ME-chave.txt`.

## Alojamento grátis com domínio próprio (Firebase Hosting)

Para a barra do endereço desaparecer, o Android tem de encontrar `/.well-known/assetlinks.json` na **raiz** do
domínio. No GitHub Pages o site está numa subpasta (`/ecos-de-sagres/`), por isso não dá. O Firebase Hosting é grátis
(plano Spark), tem HTTPS e põe o site na raiz: `https://<projeto>.web.app`.
Já está configurado: projeto Firebase `risca-e-arrisca`, site **https://risca-e-arrisca.web.app**.
O workflow **Publicar no Firebase Hosting** publica o site sempre que o `main` muda. Não usa chave secreta:
o GitHub identifica-se ao Google (*Workload Identity Federation*, pool `github`, provedor `github-actions`, só aceita
este repositório) e usa a conta de serviço `github-deploy`, que só tem permissões de Hosting.

Passos seguintes:
   - na consola Google Cast, mudar o receiver para `https://risca-e-arrisca.web.app/risca/tv/?cast=1` e o sender para `https://risca-e-arrisca.web.app/risca/comando/`;
   - criar a variável `RISCA_SITE_URL` = `https://risca-e-arrisca.web.app`;
   - feito: `public/.well-known/assetlinks.json` com a chave de upload fixa (falta juntar a da Play App Signing, ver abaixo).

Outras opções grátis: Cloudflare Pages (build `npm ci && npm run build:site`, pasta `_site`) e Netlify.

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

1. **Conta de programador** Google Play: https://play.google.com/console (já existe).
2. Contas pessoais criadas depois de novembro de 2023 têm de fazer um **teste fechado com pelo menos 12 testadores durante 14 dias** antes de publicar.
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
