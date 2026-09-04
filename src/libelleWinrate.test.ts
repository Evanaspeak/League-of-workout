import { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import { bilanSaison } from "@/lib/i18n/dictionaries/bilanSaison";
import { motsImage } from "@/lib/i18n/imageBilan";
import { LANGUES, type Locale } from "@/lib/i18n/langues";

/**
 * Le taux de victoire porte le même mot à ses trois endroits.
 *
 * Il est affiché trois fois — sur le tableau de bord, sur l'écran de saison et
 * sur l'IMAGE qu'on partage — et la valeur est un POURCENTAGE dans les trois
 * cas. Les mots, eux, ne s'accordaient nulle part :
 *
 * | langue | tableau de bord | écran de saison | image |
 * |---|---|---|---|
 * | fr | Winrate | « Victoires » | « victoires » |
 * | en | Winrate | « Wins » | « wins » |
 * | es | « Victorias » | « Victorias » | « victorias » |
 * | de | Siegquote | « Siege » | « Siege » |
 * | zh | 胜率 | « 胜场 » | 胜率 |
 * | ja | 勝率 | « 勝利 » | 勝率 |
 *
 * Autrement dit : quatre langues sur six annonçaient un NOMBRE de victoires et
 * montraient un taux, et le japonais disait deux choses différentes pour le
 * même chiffre selon qu'on lisait la page ou l'image qu'elle propose de
 * partager. C'est ce dernier point qui l'a fait voir — il ne se remarque qu'en
 * lisant le produit dans une écriture où les deux mots ne se ressemblent pas.
 *
 * La clé s'appelle `winrate` partout maintenant, y compris là où elle
 * s'appelait `victoires` : c'est le NOM qui empêche d'y remettre un compte,
 * comme `pointsPayes` face à `totalPoints`.
 */

/**
 * L'image écrit ses légendes en minuscules, la page en capitale initiale.
 * C'est une décision de mise en page, pas de vocabulaire : la comparaison
 * porte donc sur le mot, pas sur sa casse.
 */
const mot = (s: string) => s.trim().toLocaleLowerCase("fr-FR");

describe("le libellé du taux de victoire", () => {
  it("est le même aux trois endroits, dans les six langues", () => {
    const ecarts: string[] = [];
    let comparees = 0;
    for (const l of LANGUES as readonly Locale[]) {
      comparees += 1;
      const a = mot(dashboard[l].winrate as string);
      const b = mot(bilanSaison[l].winrate as string);
      const c = mot(motsImage(l).winrate);
      if (a === "" || b === "" || c === "") { ecarts.push(`${l} → un libellé vide`); continue; }
      if (a !== b || b !== c) ecarts.push(`${l} → « ${a} » / « ${b} » / « ${c} »`);
    }
    /**
     * Le témoin porte sur ce qui a été COMPARÉ, pas sur la longueur de la
     * liste des langues. Mon premier jet vérifiait `LANGUES.length === 6` :
     * vider la boucle laissait le contrôle vert, puisque la constante ne
     * bougeait pas. C'est exactement le défaut que ce projet attrape ailleurs,
     * et il était chez moi — trouvé par le sabotage, pas par la relecture.
     */
    expect(comparees).toBe(6);
    expect(ecarts).toEqual([]);
  });

  it("ne dit jamais « victoire » au singulier ni au pluriel dans une langue latine", () => {
    /**
     * Le contrôle qui aurait attrapé le défaut d'origine, et il ne vaut que
     * pour les langues où le mot du COMPTE et celui du TAUX se ressemblent :
     * « Victoires » contre « Winrate ». En chinois et en japonais ils ne
     * partagent qu'un caractère sur deux (勝利 contre 勝率), donc un motif y
     * serait faux dans les deux sens.
     */
    const fautifs: string[] = [];
    for (const l of ["fr", "en", "es", "de"] as const) {
      const v = mot(bilanSaison[l].winrate as string);
      /**
       * Les motifs sont ANCRÉS des deux côtés, et mon premier jet ne l'était
       * que d'un : `victorias?$` recalait « % de victorias », qui est juste —
       * le signe dit que c'est un taux. Ce qu'on refuse, c'est un libellé qui
       * n'est QUE le mot du compte.
       */
      if (/^(victoires?|wins?|siege|victorias?)$/.test(v)) fautifs.push(`${l} → « ${v} »`);
    }
    expect(fautifs).toEqual([]);
  });
});
