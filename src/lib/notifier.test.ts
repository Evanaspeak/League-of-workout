/**
 * Par quel chemin part un rappel, et dans quel ordre on les essaie.
 *
 * L'ordre n'est pas une préférence : dans l'application de bureau, le push web
 * ne PEUT PAS marcher — il exige un abonnement auprès du service de
 * notification du navigateur, dont Electron n'a pas les identifiants. Le
 * bouton « Activer » des réglages ne pouvait rien donner. C'est le défaut que
 * ce module existe pour empêcher, et rien ne le tenait.
 *
 * Le module lit `window`, pas `globalThis` : une doublure posée à côté ne
 * serait jamais lue et le test passerait en n'éprouvant rien. C'est le piège
 * déjà rencontré sur le stockage.
 */
import { notifierSysteme } from "@/lib/notifier";

type Fenetre = {
  electronLOL?: { notifier?: (t: string, c: string) => void };
  Notification?: unknown;
};

function poserFenetre(f: Fenetre | undefined) {
  if (f === undefined) {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { Notification?: unknown }).Notification;
    return;
  }
  (globalThis as { window?: unknown }).window = f;
  // En navigateur les deux désignent le même objet : la doublure doit faire
  // pareil, sinon `"Notification" in window` et l'appel qui suit divergent.
  (globalThis as { Notification?: unknown }).Notification = f.Notification;
}

afterEach(() => poserFenetre(undefined));

describe("notifierSysteme", () => {
  it("ne fait rien au rendu serveur", () => {
    poserFenetre(undefined);
    expect(() => notifierSysteme("t", "c")).not.toThrow();
  });

  it("passe par l'application de bureau quand elle est là", () => {
    const notifier = jest.fn();
    poserFenetre({ electronLOL: { notifier } });
    notifierSysteme("Dette", "23 pompes");
    expect(notifier).toHaveBeenCalledWith("Dette", "23 pompes");
  });

  /**
   * Le cœur du sujet. L'API du navigateur EXISTE dans Electron et son
   * autorisation peut être accordée : sans priorité explicite, c'est elle qui
   * servirait, et c'est justement le chemin qui ne marche pas là-bas.
   */
  it("préfère l'application de bureau à l'API du navigateur", () => {
    const notifier = jest.fn();
    const Notif = jest.fn();
    (Notif as unknown as { permission: string }).permission = "granted";
    poserFenetre({ electronLOL: { notifier }, Notification: Notif });
    notifierSysteme("Dette", "23 pompes");
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(Notif).not.toHaveBeenCalled();
  });

  it("passe par le navigateur quand l'autorisation est accordée", () => {
    const Notif = jest.fn();
    (Notif as unknown as { permission: string }).permission = "granted";
    poserFenetre({ Notification: Notif });
    notifierSysteme("Dette", "23 pompes", "dette");
    expect(Notif).toHaveBeenCalledWith("Dette", expect.objectContaining({
      body: "23 pompes", tag: "dette",
    }));
  });

  it("se tait quand l'autorisation n'est pas accordée", () => {
    const Notif = jest.fn();
    (Notif as unknown as { permission: string }).permission = "default";
    poserFenetre({ Notification: Notif });
    notifierSysteme("Dette", "23 pompes");
    expect(Notif).not.toHaveBeenCalled();
  });

  it("se tait quand le navigateur n'a pas l'API du tout", () => {
    poserFenetre({});
    expect(() => notifierSysteme("Dette", "23 pompes")).not.toThrow();
  });

  /**
   * Certains navigateurs refusent une notification construite hors service
   * worker. L'échec ne doit pas remonter : il traverserait l'appelant, qui
   * est souvent une fin de partie qu'on est en train d'enregistrer.
   */
  it("avale le refus du navigateur", () => {
    const Notif = jest.fn(() => { throw new TypeError("illegal constructor"); });
    (Notif as unknown as { permission: string }).permission = "granted";
    poserFenetre({ Notification: Notif });
    expect(() => notifierSysteme("Dette", "23 pompes")).not.toThrow();
    expect(Notif).toHaveBeenCalled();
  });
});
