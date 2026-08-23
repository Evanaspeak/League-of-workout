# Messages de lancement

Brouillons. **Rien n'est envoyé** — c'est à vous de le faire, et il y a deux
choses à régler avant.

## Avant d'envoyer quoi que ce soit

**1. La clé Riot ne tient pas la charge.** Mesuré cette nuit, chiffre à
l'appui : une clé de développement autorise cent requêtes par deux minutes. Le
mode session en consomme deux par joueur toutes les deux minutes, et une
ouverture de l'historique en coûte vingt et une. **Cinquante joueurs
simultanés vident la clé**, sans que personne n'ait rien fait d'anormal. Un
garde-fou empêche désormais l'effondrement — les appels en trop sont refusés
proprement plutôt que de partir chercher des 429 en cascade — mais refuser
poliment reste refuser. La clé de production que vous avez demandée est ce
qui débloque, pas du code.

**2. Les deux secrets de sauvegarde.** `DATABASE_URL` et
`SAUVEGARDE_PASSPHRASE`, dans les réglages du dépôt. Tant qu'ils manquent, la
sauvegarde quotidienne refuse de tourner. Inviter cent personnes sur une base
sans sauvegarde, c'est jouer leur travail à pile ou face.

Un lancement réussi qui tombe en panne fait plus de mal que pas de lancement :
les gens n'y reviennent pas deux fois.

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

**Ce qui manque encore pour ça** : la source OBS n'existe pas (question 168,
répondue « oui, excellent », pas encore construite). N'envoyez ce message
qu'une fois qu'elle existe — promettre une fonctionnalité absente à cinq
personnes d'un coup, c'est cinq portes fermées.

## L'ordre

1. Les deux secrets de sauvegarde.
2. La clé Riot de production.
3. r/summonerschool. Attendre les retours, corriger ce qui remonte.
4. r/fitness30plus, quelques jours plus tard.
5. Discord, en demandant d'abord.
6. r/leagueoflegends, en dernier.
7. Les streamers, une fois la source OBS construite.

Rien de tout cela ne se rattrape : un message supprimé, un serveur qui vous
bannit ou un streamer déçu ne se rejouent pas. C'est la seule raison pour
laquelle cet ordre compte.
