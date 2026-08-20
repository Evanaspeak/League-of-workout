export const adminRatios = {
  fr: {
    titre: "Ratios entre exercices",
    description:
      "Ce que coûte une même dette selon l'exercice choisi. La pompe est l'unité de référence : les deux autres se règlent par rapport à elle.",
    reference: "1 pompe = 1 pompe",
    referenceNote:
      "Non modifiable. Toutes les parties déjà enregistrées sont stockées dans cette unité ; la déplacer relirait l'historique autrement.",
    pompesUnite: "pompes",
    squatsLabel: "1 pompe vaut",
    squatsUnite: "squats",
    boxeLabel: "1 pompe vaut",
    boxeUnite: "secondes de boxe",
    borne: (min: number, max: number) => `de ${min} à ${max}`,
    apercuTitre: "Sur une défaite à 38 pompes",
    enregistrer: "Enregistrer",
    enregistrement: "Enregistrement…",
    enregistre: "Ratios mis à jour",
    erreur: "Impossible d'enregistrer les ratios.",
    reinitialiser: "Revenir aux valeurs d'origine",
    parDefaut: "Valeurs d'origine",
    personnalise: "Valeurs personnalisées",
    propagation:
      "La modification s'applique au prochain chargement de page, pour tout le monde. Elle ne touche pas aux parties déjà enregistrées : leur coût ne bouge pas, seule la façon de le payer change.",
  },
  en: {
    titre: "Ratios between exercises",
    description:
      "What the same debt costs depending on the exercise. The push-up is the reference unit: the other two are set relative to it.",
    reference: "1 push-up = 1 push-up",
    referenceNote:
      "Not editable. Every game already logged is stored in this unit; changing it would re-read the whole history differently.",
    pompesUnite: "push-ups",
    squatsLabel: "1 push-up is worth",
    squatsUnite: "squats",
    boxeLabel: "1 push-up is worth",
    boxeUnite: "seconds of boxing",
    borne: (min: number, max: number) => `${min} to ${max}`,
    apercuTitre: "On a 38 push-up loss",
    enregistrer: "Save",
    enregistrement: "Saving…",
    enregistre: "Ratios updated",
    erreur: "Could not save the ratios.",
    reinitialiser: "Back to original values",
    parDefaut: "Original values",
    personnalise: "Custom values",
    propagation:
      "The change applies on the next page load, for everyone. It leaves logged games untouched: their cost does not move, only the way you pay it.",
  },
};
