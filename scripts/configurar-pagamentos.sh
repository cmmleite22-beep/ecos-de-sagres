#!/usr/bin/env bash
# Risca e Arrisca — prepara o projeto Google Cloud/Firebase para a função «anfitriao» (compras e salas grátis).
# Corre-se UMA vez, no Cloud Shell da consola Google Cloud (https://shell.cloud.google.com), com a conta dona do
# projeto, DEPOIS de o projeto Firebase passar ao plano Blaze:
#   bash <(curl -s https://raw.githubusercontent.com/cmmleite22-beep/ecos-de-sagres/main/scripts/configurar-pagamentos.sh)
# Pode correr-se outra vez sem problema.
set -euo pipefail
P=risca-e-arrisca
NUM=1027394540234
SA_RUN=risca-pagamentos@$P.iam.gserviceaccount.com
SA_DEPLOY=github-deploy@$P.iam.gserviceaccount.com
gcloud config set project "$P" >/dev/null

echo "1/4 A ligar as APIs (função, compilação, Firestore, Google Play)…"
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com firestore.googleapis.com firebaserules.googleapis.com \
  androidpublisher.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com firebaseextensions.googleapis.com cloudbilling.googleapis.com

echo "2/4 Base de dados Firestore (Europa)…"
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 || \
  gcloud firestore databases create --database='(default)' --location=eur3 --type=firestore-native

echo "3/4 Conta de serviço da função (risca-pagamentos)…"
gcloud iam service-accounts describe "$SA_RUN" >/dev/null 2>&1 || \
  gcloud iam service-accounts create risca-pagamentos --display-name="Risca e Arrisca - pagamentos"
gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$SA_RUN" --role=roles/datastore.user --condition=None >/dev/null

echo "4/4 Permissões para o GitHub publicar a função…"
for R in roles/cloudfunctions.admin roles/run.admin roles/artifactregistry.admin roles/cloudbuild.builds.editor \
         roles/firebaserules.admin roles/datastore.indexAdmin roles/serviceusage.serviceUsageConsumer roles/firebase.viewer; do
  gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$SA_DEPLOY" --role="$R" --condition=None >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$SA_RUN" --member="serviceAccount:$SA_DEPLOY" --role=roles/iam.serviceAccountUser >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$P@appspot.gserviceaccount.com" --member="serviceAccount:$SA_DEPLOY" --role=roles/iam.serviceAccountUser >/dev/null 2>&1 || true
gcloud iam service-accounts add-iam-policy-binding "$NUM-compute@developer.gserviceaccount.com" --member="serviceAccount:$SA_DEPLOY" --role=roles/iam.serviceAccountUser >/dev/null 2>&1 || true

echo
echo "Feito. Falta, na Play Console (Utilizadores e autorizações → Convidar novos utilizadores):"
echo "  convidar  $SA_RUN"
echo "  com acesso à app Risca e Arrisca e as autorizações «Ver dados financeiros» e «Gerir encomendas e subscrições»."
echo "Depois, no GitHub, criar a variável RISCA_FUNCOES = 1."
