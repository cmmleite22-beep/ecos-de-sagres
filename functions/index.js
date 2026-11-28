// Risca e Arrisca — função na nuvem (Firebase Cloud Functions, região europe-west1) que:
//   • confirma com a Google Play as compras do produto «anfitriao» e reconhece-as (senão a Google reembolsa);
//   • conta as salas grátis de cada telemóvel;
//   • responde à TV se uma sala pode começar.
// Endereço: https://europe-west1-risca-e-arrisca.cloudfunctions.net/anfitriao  (POST com JSON { acao, ... })
// Dados no Firestore: compras/{passe} e experiencias/{chave do telemóvel}. Ninguém lê o Firestore diretamente
// (regras em firestore.rules); só esta função, com a conta de serviço risca-pagamentos.
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import { tratar, PACOTE, PRODUTO } from './logica.js';

initializeApp();
const fs = getFirestore();
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACOTE}/purchases/products/${PRODUTO}/tokens/`;

const db = {
  async getExperiencia(k) { const d = await fs.collection('experiencias').doc(k).get(); return d.exists ? d.data() : null; },
  usarExperiencia(k, max) {
    const ref = fs.collection('experiencias').doc(k);
    return fs.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      const u = d.exists ? d.data().usadas || 0 : 0;
      if (u >= max) return { ok: false, usadas: u };
      tx.set(ref, { usadas: u + 1, ultima: FieldValue.serverTimestamp(), ...(d.exists ? {} : { primeira: FieldValue.serverTimestamp() }) }, { merge: true });
      return { ok: true, usadas: u + 1 };
    });
  },
  async getCompra(p) { const d = await fs.collection('compras').doc(p).get(); return d.exists ? d.data() : null; },
  async setCompra(p, dados) { await fs.collection('compras').doc(p).set({ ...dados, atualizada: FieldValue.serverTimestamp() }, { merge: true }); },
};

const play = {
  async verificar(token) {
    const client = await auth.getClient();
    try {
      const { data } = await client.request({ url: BASE + encodeURIComponent(token) });
      // purchaseState: 0 comprada, 1 cancelada, 2 pendente (ex.: pagamento em dinheiro numa loja)
      const estado = data.purchaseState === 0 ? 'pago' : data.purchaseState === 2 ? 'pendente' : 'cancelado';
      return { estado, orderId: data.orderId, reconhecida: data.acknowledgementState === 1 };
    } catch (e) {
      const s = e?.response?.status;
      if (s === 400 || s === 404 || s === 410) return { estado: 'invalido' };
      throw e;
    }
  },
  async reconhecer(token) {
    const client = await auth.getClient();
    await client.request({ url: BASE + encodeURIComponent(token) + ':acknowledge', method: 'POST', data: {} });
  },
};

export const anfitriao = onRequest(
  { region: 'europe-west1', cors: true, maxInstances: 5, memory: '256MiB', timeoutSeconds: 20, serviceAccount: 'risca-pagamentos@' },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({ erro: 'metodo' }); return; }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      res.json(await tratar(body, { db, play }));
    } catch (e) {
      console.error(e);
      res.status(500).json({ erro: 'servidor' });
    }
  },
);
