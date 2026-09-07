import { colleCjk } from "../cjk";

/** Déclarer un jeu absent du catalogue, depuis les réglages (réponse 180). */
export const demandeJeu = {
  fr: {
    titre: "Un jeu manque ?",
    aide: "Dis-nous lequel. On compte les demandes, et c'est ce qui décide du prochain jeu ajouté.",
    champ: "Nom du jeu",
    envoyer: "Demander",
    envoi: "Envoi…",
    merci: (nom: string) => `C'est noté pour ${nom}.`,
    echec: "La demande n'est pas partie. Réessaie dans un instant.",
  },
  en: {
    titre: "A game is missing?",
    aide: "Tell us which one. We count the requests, and that decides which game comes next.",
    champ: "Game name",
    envoyer: "Request",
    envoi: "Sending…",
    merci: (nom: string) => `Noted for ${nom}.`,
    echec: "The request did not go through. Try again in a moment.",
  },
  es: {
    titre: "¿Falta un juego?",
    aide: "Dinos cuál. Contamos las solicitudes, y eso decide cuál será el próximo juego.",
    champ: "Nombre del juego",
    envoyer: "Solicitar",
    envoi: "Enviando…",
    merci: (nom: string) => `Anotado para ${nom}.`,
    echec: "La solicitud no ha salido. Inténtalo de nuevo en un momento.",
  },
  de: {
    titre: "Fehlt ein Spiel?",
    aide: "Sag uns welches. Wir zählen die Anfragen, und das entscheidet, welches Spiel als Nächstes dazukommt.",
    champ: "Name des Spiels",
    envoyer: "Anfragen",
    envoi: "Wird gesendet…",
    merci: (nom: string) => `Notiert für ${nom}.`,
    echec: "Die Anfrage ist nicht rausgegangen. Versuch es gleich noch einmal.",
  },
  zh: {
    titre: "少了一款游戏？",
    aide: "告诉我们是哪一款。我们会统计申请，下一款加入的游戏由此决定。",
    champ: "游戏名称",
    envoyer: "申请",
    envoi: "发送中…",
    // Le nom vient de la personne : s'il est en idéogrammes, l'espace
    // latine du gabarit coud deux caractères qui n'en veulent pas.
    merci: (nom: string) => colleCjk(`已记下 ${nom}。`),
    echec: "申请没有发出去，请稍后再试。",
  },
  ja: {
    titre: "ないゲームがありますか？",
    aide: "どのゲームか教えてください。リクエストを数え、次に追加するゲームを決めます。",
    champ: "ゲーム名",
    envoyer: "リクエスト",
    envoi: "送信中…",
    merci: (nom: string) => colleCjk(`${nom} を受け付けました。`),
    echec: "リクエストを送れませんでした。少しあとでもう一度お試しください。",
  },
};
