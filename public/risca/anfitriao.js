// Risca e Arrisca — anfitriões pagos e salas grátis.
//
// • Quem abre a sala (o chefe, o primeiro a entrar) tem SALAS_GRATIS salas grátis por telemóvel.
// • Depois, desbloqueia o anfitrião com uma compra única na app Android (Google Play, produto «anfitriao»).
// • Os convidados nunca pagam: entram pelo código QR, pela app ou pelo Chrome.
// A TV pergunta à função na nuvem (functions/index.js) se a sala pode começar quando o chefe carrega em COMEÇAR.
// Se a função não responder (ainda não publicada, sem rede…), o jogo deixa jogar: nunca se estraga uma festa.
import { STATIC_MODE } from './config.js';
import { juntarTextos } from './i18n.js';

export const ANFITRIAO = {
  API: 'https://europe-west1-risca-e-arrisca.cloudfunctions.net/anfitriao',
  PRODUTO: 'anfitriao',      // ID do produto na Play Console (Rentabilizar → Produtos → Produtos na app)
  SALAS_GRATIS: 3,           // só para mostrar antes de o servidor responder; o número que conta está em functions/logica.js
  METODO: 'https://play.google.com/billing',
  LOJA: 'https://play.google.com/store/apps/details?id=pt.riscaearrisca.app',
  // Só se cobra no site público (web.app, que é o que a TV/Chromecast abre). Num servidor caseiro (npm start)
  // joga-se sem limites, a não ser que se junte ?anfitriao ao endereço (testes).
  ATIVO: STATIC_MODE || new URLSearchParams(location.search).has('anfitriao'),
};

// Pergunta à função na nuvem. Devolve o JSON da resposta, ou null se não houver resposta útil.
export async function api(acao, dados = {}, ms = 6000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctl?.abort(), ms);
  try {
    const r = await fetch(ANFITRIAO.API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, ...dados }), signal: ctl?.signal,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === 'object' && !j.erro ? j : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// ---------------- Google Play (só dentro da app Android) ----------------
let servico;
export async function servicoPlay() {
  if (servico !== undefined) return servico;
  servico = null;
  if ('getDigitalGoodsService' in window) {
    try { servico = await window.getDigitalGoodsService(ANFITRIAO.METODO); } catch { servico = null; }
  }
  return servico;
}
// preço já formatado na moeda de quem compra (ex.: «2,99 €»), ou null
export async function precoPlay(lang) {
  const s = await servicoPlay();
  if (!s) return null;
  try {
    const [d] = await s.getDetails([ANFITRIAO.PRODUTO]);
    if (!d?.price) return null;
    return new Intl.NumberFormat({ pt: 'pt-PT', zh: 'zh-CN' }[lang] || lang, { style: 'currency', currency: d.price.currency }).format(+d.price.value);
  } catch { return null; }
}
// abre a janela de pagamento da Google Play; devolve o token da compra (ou lança erro se a pessoa cancelar)
export async function comprarPlay() {
  const req = new PaymentRequest(
    [{ supportedMethods: ANFITRIAO.METODO, data: { sku: ANFITRIAO.PRODUTO } }],
    { total: { label: 'Total', amount: { currency: 'EUR', value: '0' } } },
  );
  const resp = await req.show();
  const token = resp.details?.purchaseToken || resp.details?.token;
  return { token, fechar: (ok) => resp.complete(ok ? 'success' : 'fail').catch(() => {}) };
}
// compras já feitas com esta conta Google (para restaurar num telemóvel novo ou depois de reinstalar)
export async function comprasPlay() {
  const s = await servicoPlay();
  if (!s) return [];
  try { return (await s.listPurchases()).filter((p) => p.itemId === ANFITRIAO.PRODUTO).map((p) => p.purchaseToken); } catch { return []; }
}

// ---------------- textos ----------------
juntarTextos({
  pt: {
    'a.title': '⭐ Desbloquear o anfitrião',
    'a.trialOver': 'Já usaste as {n} salas grátis deste telemóvel.',
    'a.pitch': 'Com uma compra única crias todas as salas que quiseres, para sempre. Os convidados jogam sempre de graça.',
    'a.buy': 'Desbloquear por {p}', 'a.buyNoPrice': 'Desbloquear',
    'a.restore': 'Já comprei: restaurar a compra',
    'a.guest': 'Sou convidado: entrar numa sala já aberta',
    'a.back': 'Voltar',
    'a.needApp': 'A compra faz-se na app Risca e Arrisca, num telemóvel Android. Os convidados não precisam de a ter.',
    'a.getApp': 'Abrir a app na Google Play',
    'a.checking': 'A confirmar a compra…',
    'a.done': 'Anfitrião desbloqueado! Já podes criar todas as salas que quiseres.',
    'a.fail': 'A compra não foi concluída.',
    'a.pending': 'A compra está pendente. Quando a Google a confirmar, toca em «Já comprei».',
    'a.none': 'Não encontrámos nenhuma compra nesta conta Google.',
    'a.offline': 'Sem ligação ao servidor. A compra fica guardada e confirmamos mais tarde.',
    'a.paid': '⭐ Anfitrião desbloqueado',
    'a.trial': '🎁 Salas grátis: restam {r} de {n}',
    'a.trial0': 'As salas grátis deste telemóvel acabaram.',
    'a.unlock': '⭐ Desbloquear anfitrião',
    'a.roomTrial': '🎁 Sala grátis! Restam {r} de {n}.',
    'a.leaderNeeds': '🔒 Para começar, o chefe da sala tem de desbloquear o anfitrião (ou outro jogador com a app desbloqueada entra primeiro).',
    'tv.checking': 'A confirmar o anfitrião…',
    'tv.locked': '🔒 As salas grátis acabaram: o chefe da sala pode desbloquear o anfitrião na app.',
    'tv.trial': '🎁 Sala grátis (restam {r} de {n})',
  },
  'pt-BR': {
    'a.title': '⭐ Desbloquear o anfitrião',
    'a.trialOver': 'Você já usou as {n} salas grátis deste celular.',
    'a.pitch': 'Com uma compra única você cria todas as salas que quiser, para sempre. Os convidados jogam sempre de graça.',
    'a.buy': 'Desbloquear por {p}', 'a.buyNoPrice': 'Desbloquear',
    'a.restore': 'Já comprei: restaurar a compra',
    'a.guest': 'Sou convidado: entrar numa sala já aberta',
    'a.back': 'Voltar',
    'a.needApp': 'A compra é feita no app Risca e Arrisca, num celular Android. Os convidados não precisam dele.',
    'a.getApp': 'Abrir o app no Google Play',
    'a.checking': 'Confirmando a compra…',
    'a.done': 'Anfitrião desbloqueado! Agora você pode criar todas as salas que quiser.',
    'a.fail': 'A compra não foi concluída.',
    'a.pending': 'A compra está pendente. Quando o Google confirmar, toque em «Já comprei».',
    'a.none': 'Não encontramos nenhuma compra nesta conta Google.',
    'a.offline': 'Sem conexão com o servidor. A compra fica guardada e confirmamos depois.',
    'a.paid': '⭐ Anfitrião desbloqueado',
    'a.trial': '🎁 Salas grátis: restam {r} de {n}',
    'a.trial0': 'As salas grátis deste celular acabaram.',
    'a.unlock': '⭐ Desbloquear anfitrião',
    'a.roomTrial': '🎁 Sala grátis! Restam {r} de {n}.',
    'a.leaderNeeds': '🔒 Para começar, o dono da sala precisa desbloquear o anfitrião (ou outro jogador com o app desbloqueado entra primeiro).',
    'tv.checking': 'Confirmando o anfitrião…',
    'tv.locked': '🔒 As salas grátis acabaram: o dono da sala pode desbloquear o anfitrião no app.',
    'tv.trial': '🎁 Sala grátis (restam {r} de {n})',
  },
  en: {
    'a.title': '⭐ Unlock hosting',
    'a.trialOver': 'You have used the {n} free rooms on this phone.',
    'a.pitch': 'With a one-time purchase you can create as many rooms as you like, forever. Guests always play for free.',
    'a.buy': 'Unlock for {p}', 'a.buyNoPrice': 'Unlock',
    'a.restore': 'I already bought it: restore',
    'a.guest': 'I’m a guest: join a room that’s already open',
    'a.back': 'Back',
    'a.needApp': 'The purchase is made in the Risca e Arrisca app on an Android phone. Guests don’t need it.',
    'a.getApp': 'Open the app on Google Play',
    'a.checking': 'Confirming your purchase…',
    'a.done': 'Hosting unlocked! You can now create as many rooms as you like.',
    'a.fail': 'The purchase was not completed.',
    'a.pending': 'The purchase is pending. When Google confirms it, tap “I already bought it”.',
    'a.none': 'We couldn’t find a purchase on this Google account.',
    'a.offline': 'No connection to the server. Your purchase is saved and we’ll confirm it later.',
    'a.paid': '⭐ Hosting unlocked',
    'a.trial': '🎁 Free rooms: {r} of {n} left',
    'a.trial0': 'The free rooms on this phone are used up.',
    'a.unlock': '⭐ Unlock hosting',
    'a.roomTrial': '🎁 Free room! {r} of {n} left.',
    'a.leaderNeeds': '🔒 To start, the room leader needs to unlock hosting (or another player with an unlocked app joins first).',
    'tv.checking': 'Checking the host…',
    'tv.locked': '🔒 The free rooms are used up: the room leader can unlock hosting in the app.',
    'tv.trial': '🎁 Free room ({r} of {n} left)',
  },
  es: {
    'a.title': '⭐ Desbloquear el anfitrión',
    'a.trialOver': 'Ya has usado las {n} salas gratis de este móvil.',
    'a.pitch': 'Con una compra única creas todas las salas que quieras, para siempre. Los invitados siempre juegan gratis.',
    'a.buy': 'Desbloquear por {p}', 'a.buyNoPrice': 'Desbloquear',
    'a.restore': 'Ya lo compré: restaurar la compra',
    'a.guest': 'Soy invitado: entrar en una sala ya abierta',
    'a.back': 'Volver',
    'a.needApp': 'La compra se hace en la app Risca e Arrisca, en un móvil Android. Los invitados no la necesitan.',
    'a.getApp': 'Abrir la app en Google Play',
    'a.checking': 'Confirmando la compra…',
    'a.done': '¡Anfitrión desbloqueado! Ya puedes crear todas las salas que quieras.',
    'a.fail': 'La compra no se completó.',
    'a.pending': 'La compra está pendiente. Cuando Google la confirme, toca «Ya lo compré».',
    'a.none': 'No encontramos ninguna compra en esta cuenta de Google.',
    'a.offline': 'Sin conexión con el servidor. La compra queda guardada y la confirmaremos más tarde.',
    'a.paid': '⭐ Anfitrión desbloqueado',
    'a.trial': '🎁 Salas gratis: quedan {r} de {n}',
    'a.trial0': 'Se acabaron las salas gratis de este móvil.',
    'a.unlock': '⭐ Desbloquear anfitrión',
    'a.roomTrial': '🎁 ¡Sala gratis! Quedan {r} de {n}.',
    'a.leaderNeeds': '🔒 Para empezar, el jefe de la sala tiene que desbloquear el anfitrión (o entra primero otro jugador con la app desbloqueada).',
    'tv.checking': 'Comprobando el anfitrión…',
    'tv.locked': '🔒 Se acabaron las salas gratis: el jefe de la sala puede desbloquear el anfitrión en la app.',
    'tv.trial': '🎁 Sala gratis (quedan {r} de {n})',
  },
  fr: {
    'a.title': '⭐ Débloquer l’hôte',
    'a.trialOver': 'Tu as utilisé les {n} salles gratuites de ce téléphone.',
    'a.pitch': 'Avec un achat unique, tu crées autant de salles que tu veux, pour toujours. Les invités jouent toujours gratuitement.',
    'a.buy': 'Débloquer pour {p}', 'a.buyNoPrice': 'Débloquer',
    'a.restore': 'Déjà acheté : restaurer l’achat',
    'a.guest': 'Je suis invité : rejoindre une salle déjà ouverte',
    'a.back': 'Retour',
    'a.needApp': 'L’achat se fait dans l’appli Risca e Arrisca, sur un téléphone Android. Les invités n’en ont pas besoin.',
    'a.getApp': 'Ouvrir l’appli sur Google Play',
    'a.checking': 'Confirmation de l’achat…',
    'a.done': 'Hôte débloqué ! Tu peux maintenant créer autant de salles que tu veux.',
    'a.fail': 'L’achat n’a pas abouti.',
    'a.pending': 'L’achat est en attente. Quand Google le confirmera, touche « Déjà acheté ».',
    'a.none': 'Aucun achat trouvé sur ce compte Google.',
    'a.offline': 'Pas de connexion au serveur. L’achat est enregistré et sera confirmé plus tard.',
    'a.paid': '⭐ Hôte débloqué',
    'a.trial': '🎁 Salles gratuites : il en reste {r} sur {n}',
    'a.trial0': 'Les salles gratuites de ce téléphone sont épuisées.',
    'a.unlock': '⭐ Débloquer l’hôte',
    'a.roomTrial': '🎁 Salle gratuite ! Il en reste {r} sur {n}.',
    'a.leaderNeeds': '🔒 Pour commencer, le chef de la salle doit débloquer l’hôte (ou un autre joueur avec l’appli débloquée entre en premier).',
    'tv.checking': 'Vérification de l’hôte…',
    'tv.locked': '🔒 Les salles gratuites sont épuisées : le chef de la salle peut débloquer l’hôte dans l’appli.',
    'tv.trial': '🎁 Salle gratuite (il en reste {r} sur {n})',
  },
  de: {
    'a.title': '⭐ Gastgeber freischalten',
    'a.trialOver': 'Du hast die {n} kostenlosen Räume auf diesem Handy verbraucht.',
    'a.pitch': 'Mit einem einmaligen Kauf erstellst du so viele Räume, wie du willst, für immer. Gäste spielen immer kostenlos.',
    'a.buy': 'Für {p} freischalten', 'a.buyNoPrice': 'Freischalten',
    'a.restore': 'Schon gekauft: Kauf wiederherstellen',
    'a.guest': 'Ich bin Gast: einem offenen Raum beitreten',
    'a.back': 'Zurück',
    'a.needApp': 'Gekauft wird in der App Risca e Arrisca auf einem Android-Handy. Gäste brauchen sie nicht.',
    'a.getApp': 'App bei Google Play öffnen',
    'a.checking': 'Kauf wird bestätigt…',
    'a.done': 'Gastgeber freigeschaltet! Du kannst jetzt so viele Räume erstellen, wie du willst.',
    'a.fail': 'Der Kauf wurde nicht abgeschlossen.',
    'a.pending': 'Der Kauf ist ausstehend. Sobald Google ihn bestätigt, tippe auf „Schon gekauft“.',
    'a.none': 'Für dieses Google-Konto wurde kein Kauf gefunden.',
    'a.offline': 'Keine Verbindung zum Server. Der Kauf ist gespeichert und wird später bestätigt.',
    'a.paid': '⭐ Gastgeber freigeschaltet',
    'a.trial': '🎁 Kostenlose Räume: noch {r} von {n}',
    'a.trial0': 'Die kostenlosen Räume auf diesem Handy sind aufgebraucht.',
    'a.unlock': '⭐ Gastgeber freischalten',
    'a.roomTrial': '🎁 Kostenloser Raum! Noch {r} von {n}.',
    'a.leaderNeeds': '🔒 Zum Starten muss die Spielleitung den Gastgeber freischalten (oder ein anderer Spieler mit freigeschalteter App tritt zuerst bei).',
    'tv.checking': 'Gastgeber wird geprüft…',
    'tv.locked': '🔒 Die kostenlosen Räume sind aufgebraucht: Die Spielleitung kann den Gastgeber in der App freischalten.',
    'tv.trial': '🎁 Kostenloser Raum (noch {r} von {n})',
  },
  zh: {
    'a.title': '⭐ 解锁房主',
    'a.trialOver': '这部手机的 {n} 个免费房间已经用完了。',
    'a.pitch': '一次性购买后，你可以永久创建任意多个房间。客人永远免费玩。',
    'a.buy': '以 {p} 解锁', 'a.buyNoPrice': '解锁',
    'a.restore': '我已经买过：恢复购买',
    'a.guest': '我是客人：进入已经打开的房间',
    'a.back': '返回',
    'a.needApp': '需要在 Android 手机上的 Risca e Arrisca 应用里购买。客人不需要这个应用。',
    'a.getApp': '在 Google Play 打开应用',
    'a.checking': '正在确认购买…',
    'a.done': '房主已解锁！现在你可以创建任意多个房间。',
    'a.fail': '购买没有完成。',
    'a.pending': '购买正在处理中。Google 确认后，请点「我已经买过」。',
    'a.none': '在这个 Google 帐号里没有找到购买记录。',
    'a.offline': '无法连接服务器。购买已保存，稍后会确认。',
    'a.paid': '⭐ 房主已解锁',
    'a.trial': '🎁 免费房间：还剩 {r} / {n} 个',
    'a.trial0': '这部手机的免费房间已经用完了。',
    'a.unlock': '⭐ 解锁房主',
    'a.roomTrial': '🎁 免费房间！还剩 {r} / {n} 个。',
    'a.leaderNeeds': '🔒 要开始，房主需要先解锁（或者让另一位已解锁应用的玩家先进入）。',
    'tv.checking': '正在确认房主…',
    'tv.locked': '🔒 免费房间已用完：房主可以在应用里解锁。',
    'tv.trial': '🎁 免费房间（还剩 {r} / {n} 个）',
  },
});
