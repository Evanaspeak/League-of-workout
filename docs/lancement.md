# Messages de lancement

Brouillons. **Rien n'est envoyé** — c'est à vous de le faire, et il reste ce
qui est marqué « Blocage » ci-dessous. **Aucun nombre n'est écrit ici, et c'est
délibéré** : ce document a annoncé deux fois un compte qui avait cessé d'être
vrai, la seconde fois en réclamant la rotation d'un mot de passe déjà tournée.
Un total posé au-dessus de quelque chose qui bouge est le défaut que ce dépôt
trouve le plus souvent. Les blocages se comptent en lisant les titres.

## Avant d'envoyer quoi que ce soit

### Blocage · La clé Riot ne tient pas la charge
Mesuré le 24 août, chiffre à l'appui : une clé de développement autorise cent requêtes par deux minutes. Le
mode session en consomme deux par joueur toutes les deux minutes, et une
ouverture de l'historique en coûte vingt et une. **Cinquante joueurs
simultanés vident la clé**, sans que personne n'ait rien fait d'anormal. Un
garde-fou empêche désormais l'effondrement — les appels en trop sont refusés
proprement plutôt que de partir chercher des 429 en cascade — mais refuser
poliment reste refuser. La clé de production que vous avez demandée est ce
qui débloque, pas du code.

### Réglé le 8 septembre · Le déclencheur des envois programmés
Ce n'est plus un blocage, et la section est gardée parce qu'elle porte une
mesure qu'on ne veut pas refaire.

Le rappel du
matin, la relance des absents et le bilan hebdomadaire sont déclenchés par un
travail GitHub Actions censé passer toutes les heures. Il ne le fait pas.

Le code tolère l'irrégularité depuis : la fenêtre couvre la matinée — neuf
heures à midi en heure locale, soit 07:00 à 10:00 UTC en septembre — au lieu
d'une heure pile, et une marque par compte empêche les doublons.

**Ce que ça donne réellement, mesuré sur les cent dernières exécutions
(douze jours, 8,3 passages par jour) : six jours ont eu un passage dans la
fenêtre, six n'en ont eu aucun.** Autrement dit le rappel du matin part environ
un jour sur deux. Et le bilan hebdomadaire, qui ne part que le LUNDI matin,
perd une semaine sur deux — un lundi manqué n'est pas rattrapé le mardi, il est
perdu.

Élargir la fenêtre au-delà de midi ferait un « rappel de la journée », ce qui
n'est pas la même promesse : c'est un arbitrage de produit, pas une tolérance
d'implémentation.

**Ce qui l'a réglé.** `vercel.json` porte deux tâches planifiées, à 8 h et
9 h UTC, qui appellent `/api/cron/matin` avec le même secret. Ça fait 10 h et
11 h en France l'été, 9 h et 10 h l'hiver : quatre heures qui tombent toutes
dans la fenêtre, aux deux saisons, et un test le vérifie plutôt que de
l'affirmer. La matinée française est couverte pour de bon.

**Ce qui vous revient encore, et c'est une ligne de facture, pas un réglage** :
le PLAN Vercel. Sur Hobby les tâches sont limitées à deux et à un passage par
jour — c'est exactement ce qui est écrit, donc ça tient, et c'est aussi la
raison pour laquelle les deux crons passent par un aiguilleur plutôt que
d'appeler chacun sa route. Sur Pro elles descendent à la minute, et un seul
`0 * * * *` remplacerait les deux ET le travail GitHub, en couvrant tous les
fuseaux au lieu du seul fuseau français.

Ça compte pour un lancement : la rétention repose entièrement sur ces trois
envois, et inviter cent personnes à un produit dont les relances ne partent pas
revient à les inviter une fois.

**Ce qui n'est plus un blocage, et pourquoi c'est écrit ici.**

**La chaîne de connexion Neon est tournée.** Elle avait circulé en clair dans
une conversation, ce qui donnait un accès direct à la base sans passer par
l'application ni par la moindre session — elle valait alors toutes les
protections décrites ailleurs. Le propriétaire du produit l'a changée côté Neon
et reportée dans `DATABASE_URL` et `DIRECT_URL` sur Vercel. C'était le seul
geste de cette liste qui réparait quelque chose de cassé plutôt que d'ajouter
ce qui manquait.

Les deux secrets de sauvegarde figuraient aussi à cette place. Ils sont posés :
la sauvegarde tourne tous les matins, exporte, restaure dans un PostgreSQL
neuf, compare table par table, chiffre, et dépose l'archive. **Relevé le
9 septembre : vingt exécutions, une par jour, la dernière le 8 septembre à
08 h 04, toutes vertes.** Elle part vers huit heures et non à 03 h 17 comme le
cron le demande — c'est la dérive ordinaire du planificateur de GitHub, et
elle ne coûte rien à un travail quotidien.

Une liste d'avant le lancement qui réclame ce qui est déjà fait finit par ne
plus se lire du tout — c'est pour ça que ces lignes sont corrigées plutôt que
supprimées.

Un lancement réussi qui tombe en panne fait plus de mal que pas de lancement :
les gens n'y reviennent pas deux fois.

### À savoir · ce qui s'arrête tout seul au bout de soixante jours
**Ce n'est pas un blocage pour envoyer**, c'est ce qui arrive ensuite si vous
n'y touchez plus. GitHub désactive un workflow programmé après soixante jours
sans activité dans le dépôt — il prévient par courriel avant de couper. Les
trois travaux programmés tombent sous cette règle, et ils ne se valent pas :

- **la supervision meurt**, et c'est la seule chose qui crie quand le site
  tombe. Une panne de deux semaines ne se verrait plus ;
- **la sauvegarde meurt**, et sa dernière archive expire quatre-vingt-dix jours
  plus tard (`retention-days: 90`). **Au cent cinquantième jour, il n'existe
  plus aucune sauvegarde restaurable nulle part** ;
- **les envois SURVIVENT**, par les deux tâches planifiées de `vercel.json`,
  que Vercel ne désactive pas pour inactivité. La relance des absents continue
  donc de partir — sans elles, le mécanisme qui rattrape une absence serait
  mort de l'absence qu'il rattrape.

Les options sont chiffrées dans `docs/questions-ouvertes.md`, question 16.

## Ce qu'il faut dire, et ce qu'il ne faut pas

**Dire** que c'est une bêta, que vous êtes seul, que ça compte moins de dix
utilisateurs. C'est vérifiable en trois clics, et l'annoncer soi-même
transforme une faiblesse en raison de faire confiance.

**Ne pas dire** « la meilleure application pour », ni « révolutionnaire », ni
aucun superlatif. Sur Reddit, le premier commentaire descendra le message et
les suivants suivront.

**Ne pas cacher** que vous l'avez écrite. « J'ai fait un truc » se pardonne ;
« regardez ce que j'ai trouvé » suivi de la découverte que c'est votre projet
ne se pardonne pas.

## Reddit

Vérifiez les règles de chaque sous-forum avant de poster : plusieurs
interdisent la promotion de projets personnels, d'autres la tolèrent dans un
fil dédié, et les règles changent. Un message supprimé pour cette raison coûte
en plus un avertissement au compte.

Postez un sous-forum à la fois, à quelques jours d'intervalle. Trois messages
identiques le même jour se voient, et se signalent.

### r/summonerschool — le plus favorable

Ce forum parle d'amélioration et de discipline : le sujet y est chez lui.

> **Titre** : J'ai écrit une appli qui me fait faire des pompes quand je perds
> une game. Six mois plus tard, je fais toujours mes pompes.
>
> Je jouais mal quand j'enchaînais les défaites, et je restais quand même. J'ai
> écrit un truc pour moi : à chaque défaite, l'appli calcule un nombre de
> pompes à partir du KDA, du rôle et de mon niveau de force, et me le réclame.
> Une victoire coûte moitié moins.
>
> Ce que je n'attendais pas : ça m'a moins fait arrêter de jouer que ça ne m'a
> fait bouger. Vingt minutes d'effort réparties sur une soirée, sans y penser.
>
> C'est en bêta, je suis seul dessus, on est moins de dix à s'en servir. Ça
> marche avec League, Valorant, CS2, Apex et une dizaine d'autres. Il y a un
> calculateur sans compte si vous voulez juste voir ce que ça donne :
> [lien vers /calculateur/league-of-legends]
>
> Je prends tous les retours, y compris ceux qui font mal.

### r/leagueoflegends — le plus large, le plus dur

Le plus gros public, et celui qui supprime le plus. À tenter en dernier, une
fois que les deux autres ont donné des retours à citer.

Même message, plus court, sans la partie personnelle : ce forum préfère la
chose au récit.

### r/fitness30plus — l'angle inverse

Ici, ce n'est pas une appli de jeu, c'est une façon de bouger sans aller à la
salle.

> **Titre** : Je me suis mis à faire des pompes en jouant aux jeux vidéo, et
> c'est le seul truc qui a tenu.
>
> Je n'ai jamais réussi à tenir une routine. Ce qui a marché : lier l'effort à
> quelque chose que je faisais déjà tous les soirs. Chaque défaite en jeu me
> coûte un nombre de pompes calculé à partir de mon niveau de force, entre
> quinze et quarante en général. Trois heures de jeu font une séance
> honnête, sauf qu'on ne la sent pas passer.
>
> J'ai fini par en faire une appli. Elle est en bêta et je suis seul dessus. Je
> la poste ici parce que l'idée vaut peut-être plus que l'appli : n'importe
> quel minuteur fait pareil.

## Discord

Ne postez pas un lien dans un salon général : dans la plupart des serveurs
c'est une exclusion immédiate. Écrivez d'abord à un modérateur.

> Bonjour, je développe une petite application qui transforme les défaites en
> pompes. Les gens la trouvent drôle ou détestable, rarement entre les deux.
> Est-ce que je peux la partager quelque part sur le serveur, et si oui, où ?
> Je ne veux pas poster au mauvais endroit.

Ce message obtient une réponse dans la plupart des cas, parce qu'il demande au
lieu de prendre. Et un refus vous coûte deux lignes au lieu d'un bannissement.

## Streamers

Cinq petits streamers francophones, moins de deux cents spectateurs. Les gros
ne répondent pas, et l'overlay ne se voit pas sur une chaîne à trois mille
personnes qui parle d'autre chose.

Ce que vous offrez : une source pour OBS qui affiche la dette en direct. Le
public voit le compteur monter à chaque défaite, et réclame les pompes à la
place du streamer. C'est le ressort, et il fonctionne tout seul.

> **Objet** : Un compteur de pompes en direct sur ton stream
>
> Salut [prénom],
>
> Je développe Win or Workout : l'application calcule un nombre de pompes à
> chaque défaite, à partir du KDA et du rôle, et tient le compte de ce qui est
> dû. Il y a une surcouche en jeu qui affiche le compteur en direct.
>
> Je pense que ça marche bien en stream : le chat voit la dette monter et te la
> réclame. Tu n'as rien à faire, c'est le compteur qui parle.
>
> Je te propose de l'installer et de l'essayer une soirée. Si ça ne te plaît
> pas, tu le désinstalles et on n'en parle plus. Si ça te plaît, dis-moi ce qui
> manque. Tu seras le premier à t'en servir devant du monde, et ça se verra
> dans ce que je construis ensuite.
>
> C'est en bêta, gratuit, et je suis seul dessus.
>
> Evan

**La source OBS existe maintenant** (question 168). Elle se règle dans les
réglages du compte : l'adresse `/obs/<jeton>` s'ajoute comme source navigateur
dans le logiciel de diffusion et montre la dette en direct, sans session. Le
jeton se régénère, ce qui est la seule façon de couper un lien déjà collé
quelque part. Ce message peut donc partir.

## L'ordre

1. La clé Riot de production.
2. r/summonerschool. Attendre les retours, corriger ce qui remonte.
3. r/fitness30plus, quelques jours plus tard.
4. Discord, en demandant d'abord.
5. r/leagueoflegends, en dernier.
6. Les streamers.

Rien de tout cela ne se rattrape : un message supprimé, un serveur qui vous
bannit ou un streamer déçu ne se rejouent pas. C'est la seule raison pour
laquelle cet ordre compte.
