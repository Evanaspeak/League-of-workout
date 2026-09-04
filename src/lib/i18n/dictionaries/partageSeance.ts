/** Ce qu'on propose après une grosse séance (réponse 122). */
export const partageSeance = {
  fr: {
    titre: "Ta plus grosse séance du mois",
    aide: (n: number) => `${n} points d'effort payés d'un coup. Enregistre l'image et poste-la où tu veux.`,
    alt: (n: number) => `Image de partage : ${n} points d'effort payés`,
    echec: "L'image n'a pas pu être dessinée. Ta séance, elle, est bien enregistrée.",
  },
  en: {
    titre: "Your biggest session this month",
    aide: (n: number) => `${n} effort points paid in one go. Save the image and post it wherever you like.`,
    alt: (n: number) => `Share image: ${n} effort points paid`,
    echec: "The image could not be drawn. Your session is safely recorded.",
  },
  es: {
    titre: "Tu mayor sesión del mes",
    aide: (n: number) => `${n} puntos de esfuerzo pagados de una vez. Guarda la imagen y publícala donde quieras.`,
    alt: (n: number) => `Imagen para compartir: ${n} puntos de esfuerzo pagados`,
    echec: "No se ha podido dibujar la imagen. Tu sesión sí está registrada.",
  },
  de: {
    titre: "Deine größte Einheit des Monats",
    aide: (n: number) => `${n} Aufwandspunkte auf einen Schlag. Speichere das Bild und poste es, wo du willst.`,
    alt: (n: number) => `Teilbild: ${n} Aufwandspunkte abgearbeitet`,
    echec: "Das Bild konnte nicht gezeichnet werden. Deine Einheit ist trotzdem gespeichert.",
  },
  zh: {
    titre: "你本月最大的一次训练",
    aide: (n: number) => `一次性完成 ${n} 点努力。保存图片，随便发到哪里。`,
    alt: (n: number) => `分享图片：已完成 ${n} 点努力`,
    echec: "图片没能生成。你的训练已经保存好了。",
  },
  ja: {
    titre: "今月いちばん大きなセッション",
    aide: (n: number) => `一度に ${n} 努力ポイント。画像を保存して、好きなところに投稿してください。`,
    alt: (n: number) => `共有画像：${n} 努力ポイントをこなしました`,
    echec: "画像を生成できませんでした。セッションはきちんと記録されています。",
  },
};
