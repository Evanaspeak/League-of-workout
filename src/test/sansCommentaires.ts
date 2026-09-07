/**
 * Le source privé de ses commentaires.
 *
 * Trois gardes en ont besoin, et pour la même raison : sans ce retrait, ils
 * lisent l'explication écrite au-dessus du code plutôt que le code. Le piège
 * a été payé dans les deux sens — un commentaire qui CITE le motif fautif
 * déclenche le garde, un commentaire qui l'explique le CALME — d'où un seul
 * exemplaire ici plutôt qu'un par test.
 *
 * Les chaînes et les gabarits sont préservés : c'est souvent là que vit ce
 * qu'on cherche.
 */
export function sansCommentaires(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const suivant = source[i + 1];
    if (c === "/" && suivant === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && suivant === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const fin = c;
      out += c;
      i++;
      while (i < source.length && source[i] !== fin) {
        if (source[i] === "\\") { out += source[i]; i++; }
        if (i < source.length) { out += source[i]; i++; }
      }
      out += source[i] ?? "";
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
