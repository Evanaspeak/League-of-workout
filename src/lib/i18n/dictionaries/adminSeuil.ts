export const adminSeuil = {
  fr: {
    titre: "Seuil du compteur de boxe",
    description:
      "À partir de combien de temps de boxe accumulé la pastille passe en alerte et déclenche la notification. La valeur s'applique à ton compte.",
    label: "Déclencher à partir de",
    minutes: "min",
    secondes: "s",
    desactive: "0 min désactive complètement le rappel.",
    enregistrer: "Enregistrer",
    enregistrement: "Enregistrement…",
    enregistre: "✓ Seuil mis à jour",
    erreur: "Impossible d'enregistrer le seuil.",
    actuel: (t: string) => `Actuellement : ${t}`,
    jamais: "Rappel désactivé",
  },
  en: {
    titre: "Boxing counter threshold",
    description:
      "How much accumulated boxing time before the badge turns red and fires the notification. Applies to your account.",
    label: "Trigger at",
    minutes: "min",
    secondes: "s",
    desactive: "0 min turns the reminder off entirely.",
    enregistrer: "Save",
    enregistrement: "Saving…",
    enregistre: "✓ Threshold updated",
    erreur: "Could not save the threshold.",
    actuel: (t: string) => `Currently: ${t}`,
    jamais: "Reminder off",
  },
};
