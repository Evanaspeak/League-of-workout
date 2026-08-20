# La vidéo de démonstration

Dépose ici la vidéo qui montre la boucle : tu joues, tu perds, l'application
réclame ta dette, tu fais tes pompes à côté de la chaise, tu relances une
partie.

## Fichiers attendus

| Fichier         | Rôle                                                    |
|-----------------|---------------------------------------------------------|
| `boucle.mp4`    | La vidéo (H.264, obligatoire : c'est ce que tout lit)   |
| `boucle.webm`   | La même en WebM (facultatif, plus léger, servi d'abord) |
| `boucle.jpg`    | L'image d'affiche, montrée avant le premier octet       |

Dès que `boucle.mp4` est là, la section « La boucle » de la page d'accueil
remplace son animation dessinée par la vidéo, et les trois temps passent en
légende dessous. Rien d'autre à changer.

## Le cahier des charges

**Durée : 15 à 20 secondes.** C'est le point d'équilibre pour une vidéo qui
tourne en boucle dans une page : en dessous de 10 secondes on ne raconte pas la
boucle, au-delà de 30 personne ne voit la fin et le fichier devient lourd.

Découpage conseillé pour 18 secondes :

| Temps      | Ce qu'on voit                                                    |
|------------|------------------------------------------------------------------|
| 0 à 4 s    | Tu joues, l'écran de fin annonce la défaite                       |
| 4 à 7 s    | L'application affiche la dette : 38 pompes                        |
| 7 à 14 s   | Tu descends à côté de la chaise et tu fais les pompes             |
| 14 à 18 s  | Tu te rassieds, le compteur est à zéro, tu relances une partie     |

**Les trois premières secondes décident de tout.** Quelqu'un qui arrive sur la
page regarde trois secondes avant de décider s'il continue : l'écran de défaite
doit être visible presque tout de suite, pas après une intro.

## Les contraintes techniques

- **Sans son.** Un navigateur ne lance une vidéo tout seul que si elle est
  muette. Rien d'essentiel ne doit passer par la bande-son : ni voix off, ni
  texte qu'on entendrait sans le voir.
- **Boucle propre.** Termine sur le même cadrage que le début (assis au
  bureau), pour que la reprise ne saute pas.
- **16:9, 1280 × 720 suffit.** La vidéo s'affiche autour de 900 px de large :
  du 1080p ne se verra pas et pèsera le double.
- **Moins de 3 Mo** pour le MP4. Au-delà, elle met trop longtemps à démarrer
  sur une connexion mobile.
- **Pas de texte incrusté**, ou alors en français seulement : le site est
  bilingue et la vidéo est la même dans les deux langues.
- **L'image d'affiche doit déjà raconter.** C'est elle qu'on voit avant le
  chargement, et sur les connexions lentes c'est parfois la seule. Prends
  l'écran de défaite ou le moment où la dette s'affiche, pas un plan noir.

## Une version verticale, tant que tu y es

Le même tournage cadré en 9:16 donne la vidéo à poster sur TikTok, les Shorts
ou Reddit. Ce n'est pas le site qui la sert, mais c'est le même effort de
tournage, et c'est le canal qui te manque le plus aujourd'hui.
