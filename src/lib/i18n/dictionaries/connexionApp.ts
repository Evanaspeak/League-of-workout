/**
 * L'écran de départ de la connexion depuis l'application Windows.
 *
 * C'est le PREMIER écran qu'on voit dans l'application installée, et ses trois
 * phrases étaient écrites en dur, en français, dans les six langues. Deux
 * d'entre elles ont échappé au garde des textes en dur pour deux raisons
 * distinctes, toutes deux instructives : l'une vit dans un gabarit entre
 * accents graves, que le motif ne lisait pas ; l'autre — « Continuer avec
 * Google » — ne porte aucun accent, ce qui est l'angle mort par construction
 * de ce garde-là.
 */
export const connexionApp = {
  fr: {
    ouverture: (nom: string) => `Ouverture de ${nom}…`,
    horsApplication: (nom: string) =>
      `Cette page se lance depuis l'application. Continue avec ${nom} si tu es arrivé ici autrement.`,
    continuer: (nom: string) => `Continuer avec ${nom}`,
  },
  en: {
    ouverture: (nom: string) => `Opening ${nom}…`,
    horsApplication: (nom: string) =>
      `This page is opened by the app. Continue with ${nom} if you got here another way.`,
    continuer: (nom: string) => `Continue with ${nom}`,
  },
  es: {
    ouverture: (nom: string) => `Abriendo ${nom}…`,
    horsApplication: (nom: string) =>
      `Esta página la abre la aplicación. Continúa con ${nom} si has llegado aquí de otra forma.`,
    continuer: (nom: string) => `Continuar con ${nom}`,
  },
  de: {
    ouverture: (nom: string) => `${nom} wird geöffnet …`,
    horsApplication: (nom: string) =>
      `Diese Seite wird von der App geöffnet. Mach mit ${nom} weiter, wenn du anders hierhergekommen bist.`,
    continuer: (nom: string) => `Weiter mit ${nom}`,
  },
  zh: {
    ouverture: (nom: string) => `正在打开 ${nom}…`,
    horsApplication: (nom: string) =>
      `这个页面由应用打开。如果你是从别处过来的，请继续使用 ${nom}。`,
    continuer: (nom: string) => `继续使用 ${nom}`,
  },
  ja: {
    ouverture: (nom: string) => `${nom} を開いています…`,
    horsApplication: (nom: string) =>
      `このページはアプリから開きます。別の経路で来た場合は ${nom} で続けてください。`,
    continuer: (nom: string) => `${nom} で続ける`,
  },
};
