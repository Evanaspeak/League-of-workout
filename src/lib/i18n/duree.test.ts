import { dureeLocalisee } from "./duree";
import { formaterDuree } from "@/lib/exercices";
import { etiquetteLocale, LANGUES, type Locale } from "./langues";

/**
 * L'unité de la durée suit la langue.
 *
 * « min » et « s » étaient écrits en toutes lettres dans `formaterDuree`, donc
 * en français dans les six langues. Trouvé en lisant la rubrique « Ton effort »
 * EN JAPONAIS : « 1 min 55 » au milieu des idéogrammes. C'est l'unité de la
 * dette, celle qu'on lit sur la pastille pendant qu'on joue.
 */
describe("la durée d'effort", () => {
  it("garde les mêmes MOTS en français, et une espace insécable en plus", () => {
    /**
     * Je croyais le français inchangé, et le test l'a démenti — c'est
     * exactement pour ça qu'il est écrit sur les valeurs et pas sur une
     * intention. `Intl` pose une espace INSÉCABLE entre le nombre et son
     * unité : fine (U+202F) devant « s », normale (U+00A0) devant « min ».
     * L'ancien code posait une espace ordinaire.
     *
     * Le changement est invisible et il est juste : le français exige
     * l'insécable devant une unité, et sur la pastille elle empêche « 5 » et
     * « min » de se séparer en fin de ligne. Mais c'est un changement, et le
     * dire vaut mieux que de laisser croire à une identité qui n'existe pas.
     */
    expect(dureeLocalisee(45, "fr-FR")).toBe("45\u202Fs");
    expect(dureeLocalisee(840, "fr-FR")).toBe("14\u00A0min");
    expect(dureeLocalisee(307, "fr-FR")).toBe("5\u00A0min 07");
    // Les MOTS, eux, ne bougent pas : c'est ce qui rendait la reprise sûre.
    expect(dureeLocalisee(307, "fr-FR").replace(/\s/g, " ")).toBe("5 min 07");

    // Et sans étiquette, c'est le rendu d'avant le module, au caractère près.
    expect(formaterDuree(307)).toBe("5 min 07");
    expect(formaterDuree(45)).toBe("45 s");
  });

  it("garde les bornes du cadran, avec étiquette comme sans", () => {
    /**
     * Ces bornes étaient éprouvées sur `duree`, une COPIE de `formaterDuree`
     * qui vivait dans `compteurDette.ts` et recollait « s » et « min » à la
     * main. La copie est partie ; ses cas restent, sur l'original, et sur les
     * DEUX branches — sinon on garderait la borne du rendu par défaut en
     * laissant la branche que tous les appelants empruntent sans témoin.
     */
    expect(formaterDuree(0)).toBe("0 s");
    expect(formaterDuree(59)).toBe("59 s");
    expect(formaterDuree(60)).toBe("1 min");
    expect(formaterDuree(320)).toBe("5 min 20");
    expect(formaterDuree(600)).toBe("10 min");
    // Une durée négative n'existe pas, et la dette peut passer sous zéro le
    // temps d'une requête.
    expect(formaterDuree(-10)).toBe("0 s");

    const de = etiquetteLocale("de");
    expect(formaterDuree(-10, de)).toBe(formaterDuree(0, de));
    expect(formaterDuree(320, de).replace(/\s/g, " ")).toBe("5 Min. 20");
  });

  it("est bien celle que `formaterDuree` emploie quand on lui donne la langue", () => {
    /**
     * La branche que TOUS les appelants empruntent, et que rien ne gardait :
     * le sabotage qui débranche la délégation passait au vert, parce que les
     * contrôles au-dessus éprouvent `dureeLocalisee` en direct et
     * `formaterDuree` seulement SANS étiquette. Un module juste dont personne
     * ne vérifie le branchement ne sert à rien.
     */
    for (const l of ["ja", "de", "zh"] as const) {
      const etiquette = etiquetteLocale(l);
      expect({ l, via: formaterDuree(307, etiquette) })
        .toEqual({ l, via: dureeLocalisee(307, etiquette) });
    }
    // Et le rendu délégué diffère vraiment du rendu par défaut, sinon le
    // contrôle serait vrai quoi qu'il arrive.
    expect(formaterDuree(307, etiquetteLocale("ja"))).not.toBe(formaterDuree(307));
  });

  it("écrit l'unité de chaque langue", () => {
    /**
     * Le japonais n'a PAS d'espace, et ce contrôle en exigeait une.
     *
     * Il normalisait les blancs pour se lire facilement, ce qui lui faisait
     * accepter le « 45 秒 » de CLDR — c'est-à-dire épingler le défaut. Trouvé
     * en lisant l'historique d'un compte compté au temps : « 45 秒 » y suivait
     * « 27分 » et « 3時間50分 », dans la même colonne. C'est la forme la plus
     * coûteuse d'un mauvais test — il ne se contente pas de ne rien attraper,
     * il fait échouer la correction.
     *
     * Les deux écritures à idéogrammes s'écrivent donc sans blanc du tout, et
     * on l'exige au caractère près.
     */
    expect(dureeLocalisee(45, "ja-JP")).toBe("45秒");
    expect(dureeLocalisee(45, "zh-CN")).toBe("45秒");
    expect(dureeLocalisee(45, "de-DE").replace(/\s/g, " ")).toBe("45 Sek.");
    expect(dureeLocalisee(840, "de-DE").replace(/\s/g, " ")).toBe("14 Min.");
    expect(dureeLocalisee(840, "zh-CN")).toBe("14分钟");
  });

  it("et la forme ronde des SECONDES s'accorde avec le composé", () => {
    /**
     * La règle « la langue qui écrit son composé à la main écrit aussi sa
     * forme ronde » était posée pour la MINUTE et pas pour la SECONDE, donc à
     * un de ses deux endroits. Les trois formes se croisent sur la même
     * colonne de l'historique.
     *
     * Le chinois tombait juste par accident : CLDR y rend déjà « 45秒 ». On
     * l'exige quand même, sinon la règle ne tient que tant qu'une table
     * externe est d'accord.
     */
    for (const l of ["ja", "zh"] as const) {
      const e = etiquetteLocale(l);
      expect({ l, blanc: /\s/.test(dureeLocalisee(45, e)) }).toEqual({ l, blanc: false });
      expect({ l, blanc: /\s/.test(dureeLocalisee(120, e)) }).toEqual({ l, blanc: false });
      expect({ l, blanc: /\s/.test(dureeLocalisee(115, e)) }).toEqual({ l, blanc: false });
    }
    // Et les quatre langues européennes gardent le blanc d'`Intl` : le
    // retirer y serait le défaut inverse.
    for (const l of ["fr", "en", "es", "de"] as const) {
      expect({ l, blanc: /\s/.test(dureeLocalisee(45, etiquetteLocale(l))) }).toEqual({ l, blanc: true });
    }
  });

  it("compose le cadran selon la langue, pas selon une forme unique", () => {
    // Une forme unique produirait « 5分钟 07 » en chinois, où l'on écrit
    // « 5分07秒 » : le composé n'est pas une unité, c'est un cadran, et `Intl`
    // ne le connaît pas — `Intl.DurationFormat` le saurait, il n'existe pas
    // dans le Node de ce projet.
    expect(dureeLocalisee(307, "zh-CN")).toBe("5分07秒");
    expect(dureeLocalisee(307, "ja-JP")).toBe("5分07秒");
    expect(dureeLocalisee(307, "de-DE").replace(/\s/g, " ")).toBe("5 Min. 07");
  });

  it("ne laisse aucune langue sans unité, ni deux langues avec la même", () => {
    /**
     * Le témoin. Sans lui, une table vidée rendrait « 45 » partout et les
     * contrôles au-dessus ne regardent que quatre langues sur six.
     *
     * Le japonais et le chinois partagent 秒 : ce sont les DEUX seules à
     * pouvoir coïncider, et l'exiger toutes différentes ferait un test faux.
     */
    const rendus = new Map<Locale, string>();
    for (const l of LANGUES as readonly Locale[]) {
      const rendu = dureeLocalisee(45, etiquetteLocale(l));
      expect({ l, chiffreSeul: rendu.trim() === "45" }).toEqual({ l, chiffreSeul: false });
      rendus.set(l, rendu);
    }
    expect(rendus.size).toBe(6);
    expect(new Set(rendus.values()).size).toBeGreaterThanOrEqual(4);
  });
});
