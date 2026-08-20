# Captures de référence pour Veo

Trois images en 1920x1080, prises sur l'application réelle. Elles servent de
**première image** aux générations Veo (mode image-to-video), ou de contenu à
afficher sur ton écran quand tu filmes / photographies toi-même la scène.

| Fichier | Ce qu'on y voit | Sert pour |
|---|---|---|
| `ecran-1-tableau-de-bord.png` | Le tableau de bord, dette du jour et graphiques | Plan 4 (retour au bureau) |
| `ecran-2-overlay.png` | L'overlay de jeu : chrono 1:08:40, KDA 2/9/4, "Si perdu 38" | Plan 2 (gros plan overlay) |
| `ecran-3-historique.png` | L'historique, la défaite fraîche en haut de liste | Plan 4 (variante) |

## Pourquoi ces captures et pas un prompt texte

Veo ne sait pas inventer une interface lisible. Si tu lui demandes "une app de
fitness à l'écran", il produit du faux texte illisible et le rendu sent
immédiatement l'IA. Le seul moyen d'avoir une vraie interface nette :
la lui **donner en image de départ**, et ne lui demander que du mouvement.

## Ce que je ne peux pas te fournir

1. **L'écran de défaite League of Legends** : c'est l'interface de Riot, tu la
   captures toi-même en fin de partie (Impr. écran sur l'écran de fin).
2. **Toute photo contenant une personne** : je ne génère pas de photos de gens.
   Les plans 1 et 3 partent donc d'une photo que tu prends toi-même.

## Le montage visé : 4 plans, 16 secondes

Durée cible finale 15 à 18 s, en boucle propre (la dernière image doit
ressembler à la première). Veo génère par blocs de 8 s max : demande 4 à 6 s
par plan et coupe au montage.

### Plan 1 (0 à 4 s) : la défaite

- **Image de départ** : une photo que tu prends. Toi (ou un ami) de trois quarts
  dos, assis au bureau, l'écran de défaite LoL affiché sur le moniteur.
  Lumière tamisée, moniteur = source lumineuse principale.
- **Prompt Veo** :
  > Animate this photo. The person slowly leans back in the gaming chair and
  > drops their hands from the keyboard, shoulders sinking. Subtle handheld
  > camera drift, very slow push-in. The monitor content stays exactly as in the
  > image, unchanged and sharp. Cinematic low-key lighting, shallow depth of
  > field, realistic, no text overlays, no on-screen changes.

### Plan 2 (4 à 7 s) : la dette tombe

- **Image de départ** : `ecran-2-overlay.png`. Deux options :
  - la donner directement à Veo (rendu propre, un peu "capture d'écran"),
  - ou l'afficher en plein écran sur ton moniteur, éteindre la lumière, et
    photographier le coin de l'écran en légère plongée (rendu beaucoup plus
    naturel, c'est celui que je recommande).
- **Prompt Veo** :
  > Animate this image. Extremely slow camera push-in toward the overlay panel
  > in the corner of the screen. Faint screen glow and scanline shimmer. All
  > text and numbers remain exactly identical and perfectly legible, nothing
  > changes on screen. Cinematic, dark room, realistic monitor light.

  Le mot-clé qui compte : **"all text remains exactly identical"**. Sans ça,
  Veo réécrit les chiffres en bouillie.

### Plan 3 (7 à 14 s) : les pompes

- **Image de départ** : ta photo. La personne en position de pompe au sol,
  devant le bureau, le moniteur allumé derrière qui éclaire la scène par
  l'arrière (contre-jour bleuté). Cadre au ras du sol, objectif à hauteur
  d'épaule.
- **Prompt Veo** :
  > Animate this photo. The person performs push-ups with steady rhythm, two
  > full repetitions. Static camera on a low tripod, slight breathing motion.
  > Cool blue monitor backlight rimming the shoulders, warm key light from the
  > side. Realistic, cinematic, 24fps motion blur, no text overlays.

  C'est le plan le plus long parce que c'est le sujet de la vidéo. Deux
  répétitions complètes suffisent, au-delà ça traîne.

### Plan 4 (14 à 18 s) : retour, dette réglée

- **Image de départ** : ta photo, avec `ecran-1-tableau-de-bord.png` (ou
  `ecran-3-historique.png`) affiché plein écran sur le moniteur. Main qui se
  repose sur la souris, épaules détendues.
- **Prompt Veo** :
  > Animate this photo. The person sits back down and places a hand on the
  > mouse, exhaling. Very slow camera pull-back. The monitor interface stays
  > exactly as in the image, sharp and unchanged. Warm cinematic lighting,
  > shallow depth of field, realistic.

## Réglages Veo

- **Mode** : image-to-video (jamais text-to-video pour les plans 2 et 4).
- **Format** : 16:9 pour le fond de page d'accueil. Refais le plan 1 et le plan
  3 en 9:16 si tu veux la variante mobile.
- **Résolution** : la plus haute disponible, on compresse après.
- **Audio** : coupe-le, la vidéo tourne en muet sur le site.

## Après génération

1. Monte les 4 plans bout à bout (CapCut, DaVinci Resolve, les deux suffisent).
2. Fondu de 0,3 s entre chaque plan, et fondu de la fin vers le début pour que
   la boucle ne saute pas.
3. Export en 1280x720, puis compression :

```bash
# WebM (format principal)
ffmpeg -i montage.mp4 -c:v libvpx-vp9 -crf 34 -b:v 0 -an -vf scale=1280:-2 boucle.webm
# MP4 de repli (Safari)
ffmpeg -i montage.mp4 -c:v libx264 -crf 26 -preset slow -an -vf scale=1280:-2 boucle.mp4
# Image d'attente (la première frame doit déjà raconter l'histoire)
ffmpeg -i montage.mp4 -vframes 1 -q:v 3 boucle.jpg
```

4. Dépose `boucle.webm`, `boucle.mp4` et `boucle.jpg` dans `public/videos/`.
   La page d'accueil les détecte toute seule : si les fichiers sont là, la
   vidéo remplace la capture du tableau de bord en fond de hero. Si tu les
   retires, l'ancien visuel revient. Rien d'autre à toucher.

Vise moins de 3 Mo pour le WebM. Au-delà, baisse à `-crf 38`.
