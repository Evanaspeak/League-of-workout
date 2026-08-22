# Données de reconnaissance

`eng.traineddata` — le modèle de lecture de caractères, embarqué plutôt que
téléchargé.

La bibliothèque va le chercher sur un serveur public au premier usage. Ça
suppose un accès réseau au moment précis où l'on finit une partie, et ça
introduit une dépendance à un service qui ne nous appartient pas, pour un
fichier qui ne change jamais. Il vit donc ici.

Le modèle est anglais, ce qui n'a aucune importance : on ne lui demande que
des chiffres, et l'alphabet est restreint à `0123456789` sur la plupart des
zones. Le seul texte lu est le mot « CLASSEMENT », qui sert à confirmer l'écran.
