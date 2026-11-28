# Risca e Arrisca — salas grátis e compra do anfitrião

## Como funciona

- A app é **grátis** na Google Play.
- Quem abre a sala (o **chefe da sala**, o primeiro a entrar) tem **3 salas grátis** por telemóvel para experimentar.
- Depois, desbloqueia o **anfitrião** com uma **compra única** na app (produto `anfitriao`, por exemplo 2,99 €)
  e abre todas as salas que quiser, para sempre. A compra fica na conta Google: num telemóvel novo ou depois de
  reinstalar, volta sozinha ao abrir a app (ou com «Já comprei: restaurar a compra»).
- Os **convidados nunca pagam**: entram pelo código QR, pela app ou pelo Chrome.
- Basta haver **um** anfitrião desbloqueado na sala, mesmo que não seja o chefe.
- Uma sala conta uma vez: «Jogar de novo» na mesma sala não gasta outra sala grátis.
- Se o servidor não responder, o jogo deixa jogar (nunca se estraga uma festa por falta de rede).
- Num servidor caseiro (`npm start`) joga-se sem limites; só se cobra no site público (`risca-e-arrisca.web.app`).

Onde se mudam as coisas:

| O quê | Onde |
|---|---|
| Número de salas grátis | `SALAS_GRATIS` em `functions/logica.js` (e o mesmo número em `public/risca/anfitriao.js`, só para mostrar) |
| Preço | Play Console → Rentabilizar → Produtos na app → `anfitriao` (a app mostra sempre o preço da Google Play) |
| ID do produto | `PRODUTO` em `functions/logica.js` e `public/risca/anfitriao.js` |

## As peças

1. **Telemóvel** (`public/risca/comando/` + `public/risca/anfitriao.js`): mostra as salas grátis que restam e a janela
   de compra. Dentro da app Android usa a Google Play (Digital Goods API + Payment Request); no Chrome manda instalar a app.
2. **App Android** (`android-risca/`): biblioteca `com.google.androidbrowserhelper:billing` (Play Billing Library 8),
   `PaymentActivity`, `PaymentService` e um `DelegationService` próprio. Android 7 ou mais recente.
3. **Função na nuvem** (`functions/`, Firebase Cloud Functions, `europe-west1`): confirma cada compra com a Google Play,
   reconhece-a (sem isso a Google reembolsa ao fim de 3 dias), dá ao telemóvel um *passe de anfitrião* e conta as
   salas grátis no Firestore.
4. **TV** (`public/risca/tv/jogo.js`): quando alguém carrega em COMEÇAR, pergunta à função se a sala pode abrir.
   Se não puder, a sala fica à espera e o chefe vê o pedido de compra.

Testes: `node tests/risca-anfitriao-logica.mjs` (regras) e, com `npm start` a correr, `node tests/risca-anfitriao-e2e.mjs`.

## O que falta fazer (só uma vez)

1. **Perfil de pagamentos** na Play Console (Definições → Perfil de pagamentos): dados fiscais e conta bancária.
2. **Carregar o novo AAB** (release `risca-android`, já com a faturação) num teste da Play Console. A Google só deixa
   criar produtos depois de haver uma versão com a permissão de faturação.
3. **Criar o produto**: Rentabilizar → Produtos → Produtos na app → Criar produto. ID **`anfitriao`**, nome
   «Anfitrião», descrição «Cria todas as salas que quiseres», preço 2,99 €. Ativar.
4. **Firebase no plano Blaze** (https://console.firebase.google.com/project/risca-e-arrisca/usage/details): pede cartão,
   mas com este volume fica dentro da parte grátis. Criar um **alerta de orçamento** de 1 € para ficar descansado.
5. Abrir o **Cloud Shell** (https://shell.cloud.google.com/?project=risca-e-arrisca) e correr:
   `bash <(curl -s https://raw.githubusercontent.com/cmmleite22-beep/ecos-de-sagres/main/scripts/configurar-pagamentos.sh)`
6. Na Play Console → **Utilizadores e autorizações** → Convidar: `risca-pagamentos@risca-e-arrisca.iam.gserviceaccount.com`,
   app Risca e Arrisca, com «Ver dados financeiros» e «Gerir encomendas e subscrições».
7. No GitHub (Settings → Secrets and variables → Actions → **Variables**) criar `RISCA_FUNCOES` = `1` e correr de novo
   o workflow «Publicar no Firebase Hosting». A partir daí a função fica publicada e as salas passam a contar.
8. **Testar sem pagar**: Play Console → Definições → Testes de licenças → juntar o e-mail de quem testa. Essas contas
   «compram» sem serem cobradas.
9. **Segurança dos dados** na Play Console: juntar «Histórico de compras» e «Identificadores do dispositivo ou outros»
   (recolhidos, não partilhados, para funcionalidade da app). A política de privacidade já foi atualizada.

Até ao passo 7, o jogo continua grátis para todos (a TV não encontra a função e deixa jogar).

## Limites conhecidos

- As salas grátis contam-se por telemóvel com um identificador guardado na app. Quem apagar os dados da app volta a
  ter 3 salas grátis. Para fechar isto seria preciso a Play Integrity API ou pedir conta Google; não vale a pena para já.
- Reembolsos: uma compra reembolsada continua desbloqueada. Pode juntar-se mais tarde uma verificação periódica
  (Voided Purchases API).
