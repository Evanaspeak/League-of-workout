import type { Metadata } from "next";
import { type Locale } from "./langues";
import { avecLocale, languesAlternatives } from "./cheminLocalise";

/**
 * Les titres et descriptions des pages publiques, dans les six langues.
 *
 * Ils ne pouvaient pas passer par `useT` : Next.js les rend par route, au
 * serveur, sans composant et sans stockage de navigateur. Tant que la langue
 * vivait dans le navigateur, une seule version pouvait donc partir — et c'était
 * le français, pour tout le monde. C'est la raison d'être du préfixe de langue
 * dans l'adresse : sans lui, les dix pages publiques et les quinze pages par
 * jeu n'existaient qu'en français aux yeux d'un moteur de recherche, alors
 * qu'elles sont le seul canal d'acquisition qui travaille sans qu'on s'en
 * occupe.
 *
 * Un titre qui dépasse soixante caractères se fait couper dans un résultat de
 * recherche, et c'est la fin de la phrase qui saute — celle qui porte le nom
 * du jeu. `e2e/seo.spec.ts` le refuse.
 */
type Textes = { titre: string; description: string };

const PAGES = {
  accueil: {
    fr: {
      titre: "Win or Workout · Gagne ta game, ou paie en sueur",
      description: "Chaque partie a un prix, calculé sur ta performance. Tu le paies en pompes, en squats ou en boxe. Quinze jeux pris en charge, application Windows gratuite.",
    },
    en: {
      titre: "Win or Workout · Win the game, or pay in sweat",
      description: "Every match has a price, worked out from how you played. You pay it in push-ups, squats or boxing. Fifteen games supported, free Windows app.",
    },
    es: {
      titre: "Win or Workout · Gana la partida, o paga sudando",
      description: "Cada partida tiene un precio, calculado según tu rendimiento. Lo pagas en flexiones, sentadillas o boxeo. Quince juegos compatibles, app de Windows gratuita.",
    },
    de: {
      titre: "Win or Workout · Gewinn dein Spiel, oder zahl mit Schweiß",
      description: "Jede Partie hat ihren Preis, berechnet aus deiner Leistung. Du zahlst in Liegestützen, Kniebeugen oder Boxen. Fünfzehn Spiele, kostenlose Windows-App.",
    },
    zh: {
      titre: "Win or Workout · 赢下这局，或者用汗水买单",
      description: "每一局都有代价，按你的表现计算，用俯卧撑、深蹲或拳击来偿还。支持十五款游戏，Windows 应用免费。",
    },
    ja: {
      titre: "Win or Workout · 勝つか、汗で払うか",
      description: "試合ごとに代償があり、プレイ内容から計算されます。腕立て、スクワット、ボクシングで返済。15タイトル対応、Windows アプリは無料。",
    },
  },
  beta: {
    fr: {
      titre: "Accès bêta : un pseudo suffit",
      description: "Rejoins la bêta de Win or Workout en 30 secondes : entre un pseudo, reçois ton code d'accès, et commence à payer tes défaites en pompes.",
    },
    en: {
      titre: "Beta access: a username is enough",
      description: "Join the Win or Workout beta in 30 seconds: pick a username, get your access code, and start paying for your defeats in push-ups.",
    },
    es: {
      titre: "Acceso beta: basta con un alias",
      description: "Únete a la beta de Win or Workout en 30 segundos: elige un alias, recibe tu código y empieza a pagar tus derrotas en flexiones.",
    },
    de: {
      titre: "Beta-Zugang: ein Name genügt",
      description: "Tritt der Win-or-Workout-Beta in 30 Sekunden bei: Namen wählen, Zugangscode erhalten, und deine Niederlagen in Liegestützen abbezahlen.",
    },
    zh: {
      titre: "内测入口：一个昵称就够了",
      description: "30 秒加入 Win or Workout 内测：填一个昵称，拿到访问码，开始用俯卧撑偿还失败。",
    },
    ja: {
      titre: "ベータ参加：ユーザー名だけ",
      description: "30秒で Win or Workout のベータに参加。ユーザー名を入力してアクセスコードを受け取り、負けを腕立てで払い始めましょう。",
    },
  },
  calculateur: {
    fr: {
      titre: "Combien de pompes pour une défaite ?",
      description: "Le calculateur de Win or Workout, jeu par jeu : réglez votre partie, obtenez le nombre de pompes. Sans compte et sans inscription.",
    },
    en: {
      titre: "How many push-ups for a loss?",
      description: "The Win or Workout calculator, game by game: set up your match, get the number of push-ups. No account, no sign-up.",
    },
    es: {
      titre: "¿Cuántas flexiones por una derrota?",
      description: "La calculadora de Win or Workout, juego a juego: configura tu partida y obtén el número de flexiones. Sin cuenta ni registro.",
    },
    de: {
      titre: "Wie viele Liegestütze für eine Niederlage?",
      description: "Der Rechner von Win or Workout, Spiel für Spiel: Partie einstellen, Zahl der Liegestütze erhalten. Ohne Konto, ohne Anmeldung.",
    },
    zh: {
      titre: "输一局要做多少个俯卧撑？",
      description: "Win or Workout 的计算器，逐个游戏：设置你的对局，得出俯卧撑数量。无需账号，无需注册。",
    },
    ja: {
      titre: "1敗で腕立て何回？",
      description: "Win or Workout の計算ツール、タイトル別。試合の内容を入れると腕立ての回数が出ます。アカウント登録は不要です。",
    },
  },
  telechargement: {
    fr: {
      titre: "Télécharger l'app Windows",
      description: "L'application desktop Win or Workout pour Windows : détection automatique de tes games et compteur de pompes en temps réel.",
    },
    en: {
      titre: "Download the Windows app",
      description: "The Win or Workout desktop app for Windows: automatic match detection and a live push-up counter.",
    },
    es: {
      titre: "Descargar la app de Windows",
      description: "La aplicación de escritorio Win or Workout para Windows: detección automática de partidas y contador de flexiones en directo.",
    },
    de: {
      titre: "Windows-App herunterladen",
      description: "Die Win-or-Workout-App für Windows: automatische Spielerkennung und ein Liegestütz-Zähler in Echtzeit.",
    },
    zh: {
      titre: "下载 Windows 应用",
      description: "Win or Workout 的 Windows 桌面应用：自动识别对局，实时显示俯卧撑计数。",
    },
    ja: {
      titre: "Windows アプリをダウンロード",
      description: "Win or Workout のデスクトップアプリ。試合を自動検出し、腕立ての残数をリアルタイムで表示します。",
    },
  },
  recuperation: {
    fr: { titre: "Récupération de compte", description: "Récupérez l'accès à votre compte Win or Workout : un lien vous est envoyé par courriel, et il remplace votre code d'accès." },
    en: { titre: "Account recovery", description: "Recover access to your Win or Workout account: a link is sent to you by email, and it replaces your access code." },
    es: { titre: "Recuperación de cuenta", description: "Recupere el acceso a su cuenta de Win or Workout: se le envía un enlace por correo, y sustituye a su código de acceso." },
    de: { titre: "Kontowiederherstellung", description: "Stellen Sie den Zugang zu Ihrem Win-or-Workout-Konto wieder her: Sie erhalten einen Link per E-Mail, der Ihren Zugangscode ersetzt." },
    zh: { titre: "找回账号", description: "找回你的 Win or Workout 账号：我们会给你发送一个链接，它会替换你的访问码。" },
    ja: { titre: "アカウントの復旧", description: "Win or Workout のアカウントへのアクセスを取り戻します。メールでリンクをお送りし、アクセスコードを置き換えます。" },
  },
  cgu: {
    fr: {
      titre: "CGU",
      description: "Conditions générales d'utilisation de Win or Workout : ce que le service fait, ce qu'il ne fait pas, et les règles de santé qui l'encadrent.",
    },
    en: {
      titre: "Terms of use",
      description: "Win or Workout's terms of use: what the service does, what it does not do, and the health rules that frame it.",
    },
    es: {
      titre: "Condiciones de uso",
      description: "Condiciones de uso de Win or Workout: qué hace el servicio, qué no hace, y las reglas de salud que lo enmarcan.",
    },
    de: {
      titre: "Nutzungsbedingungen",
      description: "Die Nutzungsbedingungen von Win or Workout: was der Dienst tut, was er nicht tut, und die Gesundheitsregeln dahinter.",
    },
    zh: {
      titre: "使用条款",
      description: "Win or Workout 的使用条款：本服务做什么、不做什么，以及相关的健康规则。",
    },
    ja: {
      titre: "利用規約",
      description: "Win or Workout の利用規約。このサービスがすること、しないこと、そして健康上の決まりについて。",
    },
  },
  confidentialite: {
    fr: {
      titre: "Confidentialité",
      description: "Politique de confidentialité de Win or Workout : données collectées, usage et droits.",
    },
    en: {
      titre: "Privacy",
      description: "Win or Workout's privacy policy: what is collected, what it is used for, and your rights.",
    },
    es: {
      titre: "Privacidad",
      description: "Política de privacidad de Win or Workout: datos recogidos, uso y derechos.",
    },
    de: {
      titre: "Datenschutz",
      description: "Die Datenschutzerklärung von Win or Workout: erhobene Daten, Verwendung und Rechte.",
    },
    zh: {
      titre: "隐私政策",
      description: "Win or Workout 的隐私政策：收集哪些数据、如何使用，以及你的权利。",
    },
    ja: {
      titre: "プライバシー",
      description: "Win or Workout のプライバシーポリシー。収集する情報、その用途、そしてあなたの権利について。",
    },
  },
} as const satisfies Record<string, Record<Locale, Textes>>;

export type PageMeta = keyof typeof PAGES;

/**
 * La description d'une page, hors du bloc de métadonnées.
 *
 * Deux endroits en ont besoin sans passer par `Metadata` : le bloc de données
 * structurées de l'accueil, que Google lit, et la description par défaut de la
 * mise en page. Les deux étaient écrits en français en dur, et partaient tels
 * quels dans les six langues.
 */
export function descriptionPage(cle: PageMeta, locale: Locale): string {
  return (PAGES[cle][locale] ?? PAGES[cle].en).description;
}

/**
 * Les métadonnées d'une page publique, canonique et hreflang compris.
 *
 * `alternates.languages` est ce qui dit à un moteur que les six adresses sont
 * la même page dans six langues. Sans lui, elles se font concurrence entre
 * elles au lieu de s'additionner, et c'est la version française qui gagne
 * partout parce qu'elle est la plus ancienne.
 */
export function metadonneesPage(cle: PageMeta, locale: Locale, chemin: string): Metadata {
  const textes: Textes = PAGES[cle][locale] ?? PAGES[cle].en;
  return {
    title: textes.titre,
    description: textes.description,
    alternates: {
      canonical: avecLocale(chemin, locale),
      languages: languesAlternatives(chemin),
    },
  };
}

/**
 * Le titre et la description d'une page par jeu.
 *
 * Le titre EST la question qu'on a tapée : c'est ce qui dit à la personne
 * qu'elle est arrivée au bon endroit, avant même qu'elle ait lu une ligne. Il
 * doit donc se poser dans chaque langue, sinon un hispanophone qui cherche
 * « cuántas flexiones » tombe sur une phrase française.
 *
 * Le nom du jeu ne se traduit pas : « League of Legends » est « League of
 * Legends » partout, et le traduire ferait rater la recherche.
 */
const PAR_JEU: Record<Locale, (jeu: string) => Textes> = {
  fr: (jeu) => ({
    titre: `Combien de pompes pour une défaite sur ${jeu} ?`,
    description: `Le calcul de Win or Workout pour ${jeu} : réglez votre partie, obtenez le nombre de pompes. Sans compte et sans inscription.`,
  }),
  en: (jeu) => ({
    titre: `How many push-ups for a loss on ${jeu}?`,
    description: `The Win or Workout calculation for ${jeu}: set up your match, get the number of push-ups. No account, no sign-up.`,
  }),
  es: (jeu) => ({
    titre: `¿Cuántas flexiones por una derrota en ${jeu}?`,
    description: `El cálculo de Win or Workout para ${jeu}: configura tu partida y obtén el número de flexiones. Sin cuenta ni registro.`,
  }),
  de: (jeu) => ({
    titre: `Wie viele Liegestütze für eine Niederlage in ${jeu}?`,
    description: `Die Rechnung von Win or Workout für ${jeu}: Partie einstellen, Zahl der Liegestütze erhalten. Ohne Konto, ohne Anmeldung.`,
  }),
  zh: (jeu) => ({
    titre: `${jeu} 输一局要做多少个俯卧撑？`,
    description: `Win or Workout 针对 ${jeu} 的计算：设置你的对局，得出俯卧撑数量。无需账号，无需注册。`,
  }),
  ja: (jeu) => ({
    titre: `${jeu} で1敗すると腕立て何回？`,
    description: `${jeu} 向けの Win or Workout の計算。試合の内容を入れると腕立ての回数が出ます。アカウント登録は不要です。`,
  }),
};

export function metadonneesJeu(jeu: string, locale: Locale, chemin: string): Metadata {
  const { titre, description } = (PAR_JEU[locale] ?? PAR_JEU.en)(jeu);
  return {
    /**
     * `absolute` retire le suffixe « · Win or Workout » du gabarit.
     *
     * Avec lui, la question atteignait 75 caractères et Google la coupait — au
     * milieu du nom du jeu, c'est-à-dire au mot qui prouvait qu'on répondait
     * bien à SA question.
     */
    title: { absolute: titre },
    description,
    alternates: {
      canonical: avecLocale(chemin, locale),
      languages: languesAlternatives(chemin),
    },
    /**
     * L'image et l'adresse sont redites ici, et il le faut.
     *
     * Next.js REMPLACE le bloc `openGraph` du parent au lieu de le compléter :
     * déclarer un titre suffisait à faire disparaître l'image et l'adresse
     * héritées de la mise en page racine. Ces pages sont précisément celles
     * qu'on colle dans un salon Discord, et elles y arrivaient sans vignette.
     */
    openGraph: {
      title: titre,
      type: "website",
      url: `https://winorworkout.com${avecLocale(chemin, locale)}`,
      siteName: "Win or Workout",
      images: ["/opengraph-image"],
    },
  };
}
