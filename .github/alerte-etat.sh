#!/bin/sh
# Décide s'il faut crier, à partir de l'état précédent et de l'état courant.
#
# Extrait tel quel du travail de supervision pour être éprouvé hors de GitHub :
# une logique d'alerte qu'on ne peut pas faire échouer sur commande n'est pas
# une logique d'alerte, c'est un espoir.
#
#   $1 = "oui" si le site répond, "non" sinon
#   $2 = chemin du fichier d'état
#   $3 = instant courant, en secondes
# Écrit "crier" ou "taire" sur la sortie, et met le fichier d'état à jour.

sain="$1"; fichier="$2"; maintenant="$3"

# Rappel après vingt-quatre heures de panne continue : la première alerte peut
# se perdre, et un silence de trois jours ne se distingue pas d'un site debout.
RAPPEL=86400

precedent_etat=haut
depuis=0
dernier_cri=0
[ -f "$fichier" ] && . "$fichier"

if [ "$sain" = "oui" ]; then
  [ "$precedent_etat" = "bas" ] && echo "revenu"
  printf 'precedent_etat=haut\ndepuis=0\ndernier_cri=0\n' > "$fichier"
  echo "taire"
  exit 0
fi

if [ "$precedent_etat" != "bas" ]; then
  depuis=$maintenant
  dernier_cri=$maintenant
  verdict=crier
elif [ $((maintenant - dernier_cri)) -ge $RAPPEL ]; then
  dernier_cri=$maintenant
  verdict=crier
else
  verdict=taire
fi

printf 'precedent_etat=bas\ndepuis=%s\ndernier_cri=%s\n' "$depuis" "$dernier_cri" > "$fichier"
echo "$verdict"
