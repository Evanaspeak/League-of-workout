export const visite = {
  fr: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Suivant",
    precedent: "Précédent",
    terminer: "C'est parti",
    passer: "Passer la visite",

    // Chaque étape pointe un élément réel de l'écran. Les textes disent ce que
    // la chose FAIT et pourquoi elle existe — pas ce qu'elle est. « Ouvre le
    // suivi » plutôt que « bouton de session ».

    // ── Tableau de bord ──
    railTitre: "Tout part d'ici",
    railTexte: "Ce rail te suit sur toutes les pages, même quand tu descends. Il porte les trois choses que tu fais tous les soirs : lancer une session, ajouter une partie, et payer ce que tu dois. Sur téléphone il se replie derrière ce bouton.",

    sessionTitre: "Lance ta soirée",
    sessionTexte: "Tu choisis le jeu, et l'application enregistre tes parties toute seule jusqu'à ce que tu l'arrêtes. Sur League elle lit le score directement dans la partie. Sur un jeu sans victoire ni défaite (Minecraft, un RPG), elle compte le temps passé à la place.",

    ajoutTitre: "Ou saisis à la main",
    ajoutTexte: "Une partie oubliée, un jeu qu'on ne sait pas lire, une soirée entière rattrapée le lendemain : tu entres le score ici et le coût se calcule exactement pareil. Le montant s'affiche avant que tu valides, jamais après.",

    detteTitre: "Ce que tu dois",
    detteTexte: "Ta dette s'accumule ici, partie après partie. Dès que tu dois quelque chose, une pastille te suit partout dans l'application : clique dessus quand tu es prêt. Un décompte t'accompagne pendant l'effort, et si tu t'arrêtes en route, seule la part réellement faite est déduite.",

    statsTitre: "Où tu en es",
    statsTexte: "Ton nombre de parties, ton taux de victoire et le total accumulé depuis le début. Ces trois chiffres ne se filtrent jamais : ils décrivent tout, pour que tu aies toujours un point de repère fixe.",

    graphiqueTitre: "Le chiffre qui compte vraiment",
    graphiqueTexte: "Le total ne peut que monter : il ne dit donc rien de tes progrès. Le coût MOYEN d'une partie, lui, baisse quand tu joues mieux : c'est le seul indicateur de l'application qui peut descendre. Il apparaît ici, avec les autres, dès tes premières parties.",

    // ── Historique ──
    navHistoriqueTitre: "Le détail de tout",
    navHistoriqueTexte: "On y va. L'historique garde chaque partie que tu as jouée, avec son coût et le calcul qui l'explique.",

    historiqueTitre: "Chaque partie, son coût",
    historiqueTexte: "Une ligne par partie : la date, le jeu, ton score, et ce que ça t'a coûté, avec le nom de l'exercice, pour ne pas confondre des pompes et des secondes de boxe. La flèche à droite déplie le calcul complet, et la croix supprime la ligne si elle est fausse.",

    // ── Réglages ──
    navReglagesTitre: "Règle-la à ta mesure",
    navReglagesTexte: "Dernière étape. Les réglages sont rangés par rubrique, comme sur un téléphone : tu ouvres celle que tu cherches et tu reviens.",

    reglagesEffortTitre: "Commence par ici",
    reglagesEffortTexte: "Le test de force est dans cette rubrique, et c'est par lui qu'il faut commencer : le nombre de pompes que tu enchaînes fixe le multiplicateur appliqué à TOUTE ta dette. Tant qu'il n'est pas fait, tu restes au niveau le plus bas. Tu y choisis aussi tes exercices : pompes, squats ou boxe.",

    reglagesJeuxTitre: "Un réglage par jeu",
    reglagesJeuxTexte: "Chaque jeu a son bloc : le compte à suivre pour League, et l'endroit où la pastille se pose à l'écran pendant la partie. Si tu as l'application Windows, c'est ici que tu la règles jeu par jeu.",

    finTitre: "À toi de jouer",
    finTexte: "Fais le test de force, lance une session, et joue. Le reste se remplit tout seul. Tu peux revoir cette visite depuis les réglages.",
  },
  en: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Next",
    precedent: "Back",
    terminer: "Let's go",
    passer: "Skip the tour",

    railTitre: "It all starts here",
    railTexte: "This rail follows you on every page, even as you scroll. It holds the three things you do every night: start a session, add a match, and pay what you owe. On a phone it folds behind this button.",

    sessionTitre: "Start your night",
    sessionTexte: "You pick the game and the app logs your matches on its own until you stop it. On League it reads the score straight from the match. On a game with no win or loss (Minecraft, an RPG), it counts the time you spend instead.",

    ajoutTitre: "Or enter it by hand",
    ajoutTexte: "A forgotten match, a game we can't read, a whole evening caught up the next day: type the score here and the cost is worked out exactly the same. The amount shows before you confirm, never after.",

    detteTitre: "What you owe",
    detteTexte: "Your debt piles up here, match after match. As soon as you owe something a badge follows you everywhere in the app: tap it when you're ready. A countdown walks you through the effort, and if you stop halfway only the part you actually did is taken off.",

    statsTitre: "Where you stand",
    statsTexte: "Your game count, your win rate and the total built up since day one. These three never get filtered: they describe everything, so you always have a fixed reference point.",

    graphiqueTitre: "The number that really counts",
    graphiqueTexte: "The total can only go up, so it says nothing about your progress. The AVERAGE cost per match does drop when you play better: it's the only figure in the app that can go down. It shows up here, with the others, from your first matches on.",

    navHistoriqueTitre: "The detail of everything",
    navHistoriqueTexte: "Let's go there. History keeps every match you've played, with its cost and the maths behind it.",

    historiqueTitre: "Every match, its cost",
    historiqueTexte: "One row per game: date, game, your score, and what it cost you, with the exercise named, so push-ups and seconds of boxing never get confused. The arrow on the right unfolds the full calculation, and the cross deletes a row that's wrong.",

    navReglagesTitre: "Set it to your size",
    navReglagesTexte: "Last stop. Settings are filed by section, like on a phone: you open the one you want and come back.",

    reglagesEffortTitre: "Start here",
    reglagesEffortTexte: "The strength test lives in this section, and it's where to begin: how many push-ups you do in a row sets the multiplier applied to ALL your debt. Until you take it, you stay at the lowest level. This is also where you pick your exercises: push-ups, squats or boxing.",

    reglagesJeuxTitre: "One setting per game",
    reglagesJeuxTexte: "Each game gets its own block: the account to follow for League, and where the panel sits on screen during a match. If you have the Windows app, this is where you tune it game by game.",

    finTitre: "Over to you",
    finTexte: "Take the strength test, start a session, and play. The rest fills itself in. You can replay this tour from the settings.",
  },
  es: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Siguiente",
    precedent: "Atrás",
    terminer: "Vamos allá",
    passer: "Saltar la visita",

    railTitre: "Todo empieza aquí",
    railTexte: "Esta barra te acompaña en todas las páginas, incluso al bajar. Lleva las tres cosas que haces cada noche: empezar una sesión, añadir una partida y pagar lo que debes. En el móvil se pliega detrás de este botón.",

    sessionTitre: "Arranca tu noche",
    sessionTexte: "Eliges el juego y la aplicación registra tus partidas sola hasta que la pares. En League lee el marcador directamente de la partida. En un juego sin victoria ni derrota (Minecraft, un RPG), cuenta el tiempo que pasas en su lugar.",

    ajoutTitre: "O apúntalo a mano",
    ajoutTexte: "Una partida olvidada, un juego que no sabemos leer, una noche entera recuperada al día siguiente: escribes el marcador aquí y el coste se calcula exactamente igual. El importe aparece antes de que confirmes, nunca después.",

    detteTitre: "Lo que debes",
    detteTexte: "Tu deuda se acumula aquí, partida tras partida. En cuanto debes algo, una insignia te sigue por toda la aplicación: púlsala cuando estés listo. Una cuenta atrás te acompaña durante el esfuerzo, y si te paras a medias solo se descuenta la parte que realmente hiciste.",

    statsTitre: "Por dónde vas",
    statsTexte: "Tu número de actividades, tu porcentaje de victorias y el total acumulado desde el principio. Estas tres cifras nunca se filtran: lo describen todo, para que siempre tengas un punto de referencia fijo.",

    graphiqueTitre: "La cifra que de verdad cuenta",
    graphiqueTexte: "El total solo puede subir, así que no dice nada de tu progreso. El coste MEDIO de una partida, en cambio, baja cuando juegas mejor: es el único indicador de la aplicación que puede descender. Aparece aquí, junto a los demás, desde tus primeras partidas.",

    navHistoriqueTitre: "El detalle de todo",
    navHistoriqueTexte: "Vamos allá. El historial guarda cada partida que has jugado, con su coste y el cálculo que lo explica.",

    historiqueTitre: "Cada partida, su coste",
    historiqueTexte: "Una fila por actividad: la fecha, el juego, tu marcador y lo que te ha costado, con el nombre del ejercicio, para no confundir flexiones con segundos de boxeo. La flecha de la derecha despliega el cálculo completo, y la cruz borra la fila si está mal.",

    navReglagesTitre: "Ajústala a tu medida",
    navReglagesTexte: "Última parada. Los ajustes están ordenados por apartados, como en un móvil: abres el que buscas y vuelves.",

    reglagesEffortTitre: "Empieza por aquí",
    reglagesEffortTexte: "La prueba de fuerza está en este apartado, y es por donde hay que empezar: el número de flexiones que encadenas fija el multiplicador que se aplica a TODA tu deuda. Mientras no la hagas, te quedas en el nivel más bajo. Aquí también eliges tus ejercicios: flexiones, sentadillas o boxeo.",

    reglagesJeuxTitre: "Un ajuste por juego",
    reglagesJeuxTexte: "Cada juego tiene su bloque: la cuenta que hay que seguir en League y el lugar donde se coloca el recuadro en pantalla durante la partida. Si tienes la aplicación de Windows, es aquí donde la ajustas juego por juego.",

    finTitre: "Te toca",
    finTexte: "Haz la prueba de fuerza, arranca una sesión y juega. El resto se rellena solo. Puedes volver a ver esta visita desde los ajustes.",
  },
  de: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Weiter",
    precedent: "Zurück",
    terminer: "Los geht's",
    passer: "Tour überspringen",

    railTitre: "Hier fängt alles an",
    railTexte: "Diese Leiste begleitet dich auf jeder Seite, auch beim Scrollen. Sie trägt die drei Dinge, die du jeden Abend tust: eine Sitzung starten, eine Partie eintragen und zahlen, was du schuldest. Auf dem Handy klappt sie hinter diesem Knopf zusammen.",

    sessionTitre: "Starte deinen Abend",
    sessionTexte: "Du wählst das Spiel, und die App trägt deine Partien von allein ein, bis du sie stoppst. Bei League liest sie das Ergebnis direkt aus der Partie. Bei einem Spiel ohne Sieg oder Niederlage (Minecraft, ein RPG) zählt sie stattdessen die verbrachte Zeit.",

    ajoutTitre: "Oder trag es von Hand ein",
    ajoutTexte: "Eine vergessene Partie, ein Spiel, das wir nicht auslesen können, ein ganzer Abend, der am nächsten Tag nachgeholt wird: du tippst das Ergebnis hier ein, und der Preis wird genauso berechnet. Der Betrag steht da, bevor du bestätigst, nie danach.",

    detteTitre: "Was du schuldest",
    detteTexte: "Deine Schuld sammelt sich hier, Partie für Partie. Sobald du etwas schuldest, folgt dir ein Abzeichen durch die ganze App: tipp darauf, wenn du so weit bist. Ein Countdown begleitet dich durch die Anstrengung, und wenn du unterwegs aufhörst, wird nur der wirklich geleistete Teil abgezogen.",

    statsTitre: "Wo du stehst",
    statsTexte: "Deine Zahl an Aktivitäten, deine Siegquote und die Gesamtsumme seit dem ersten Tag. Diese drei Zahlen werden nie gefiltert: sie beschreiben alles, damit du immer einen festen Bezugspunkt hast.",

    graphiqueTitre: "Die Zahl, auf die es wirklich ankommt",
    graphiqueTexte: "Die Summe kann nur steigen und sagt daher nichts über deinen Fortschritt. Der DURCHSCHNITTSPREIS einer Partie dagegen sinkt, wenn du besser spielst: er ist der einzige Wert der App, der nach unten gehen kann. Er erscheint hier, neben den anderen, ab deinen ersten Partien.",

    navHistoriqueTitre: "Alles im Detail",
    navHistoriqueTexte: "Auf geht's. Der Verlauf bewahrt jede Partie auf, die du gespielt hast, mit ihrem Preis und der Rechnung dahinter.",

    historiqueTitre: "Jede Partie, ihr Preis",
    historiqueTexte: "Eine Zeile pro Aktivität: Datum, Spiel, dein Ergebnis und was es gekostet hat, mit dem Namen der Übung, damit Liegestütze und Sekunden Boxen nie durcheinandergeraten. Der Pfeil rechts klappt die vollständige Rechnung auf, das Kreuz löscht eine Zeile, wenn sie falsch ist.",

    navReglagesTitre: "Stell sie auf dich ein",
    navReglagesTexte: "Letzte Station. Die Einstellungen sind nach Rubriken sortiert, wie auf einem Handy: du öffnest die, die du suchst, und gehst zurück.",

    reglagesEffortTitre: "Fang hier an",
    reglagesEffortTexte: "Der Krafttest steckt in dieser Rubrik, und mit ihm sollte man anfangen: wie viele Liegestütze du am Stück schaffst, setzt den Faktor, der auf deine GANZE Schuld angewendet wird. Solange er nicht gemacht ist, bleibst du auf der niedrigsten Stufe. Hier wählst du auch deine Übungen: Liegestütze, Kniebeugen oder Boxen.",

    reglagesJeuxTitre: "Eine Einstellung pro Spiel",
    reglagesJeuxTexte: "Jedes Spiel hat seinen Block: das Konto, dem bei League gefolgt wird, und die Stelle, an der das Feld während der Partie auf dem Bildschirm sitzt. Wenn du die Windows-App hast, stellst du sie hier Spiel für Spiel ein.",

    finTitre: "Jetzt du",
    finTexte: "Mach den Krafttest, starte eine Sitzung und spiel. Der Rest füllt sich von selbst. Diese Tour kannst du in den Einstellungen erneut ansehen.",
  },
  zh: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "下一步",
    precedent: "上一步",
    terminer: "开始吧",
    passer: "跳过导览",

    railTitre: "一切从这里开始",
    railTexte: "这条侧栏会跟着你出现在每个页面，往下滚也在。它装着你每晚都要做的三件事：开始一个时段、补录一局、还清欠账。手机上它会收进这个按钮里。",

    sessionTitre: "开启今晚",
    sessionTexte: "选好游戏，应用就会自己记录你的每一局，直到你叫停。在 League 里它直接读取对局的结算。遇上没有输赢的游戏（Minecraft、RPG），它改为计算你花掉的时间。",

    ajoutTitre: "也可以手动填",
    ajoutTexte: "漏记的一局、我们读不到的游戏、第二天才补上的整整一晚：在这里填进比分，代价的算法完全一样。金额在你确认之前就显示出来，绝不在之后。",

    detteTitre: "你欠下的",
    detteTexte: "欠账在这里一局一局累积。只要你欠着，一个小标记就会跟着你走遍整个应用：准备好了就点它。做的过程中有倒计时陪着你，中途停下也没关系，只扣掉真正做完的那部分。",

    statsTitre: "你的现状",
    statsTexte: "你的活动次数、胜率，以及从第一天累积到现在的总数。这三个数字从不被筛选：它们描述全部，好让你始终有一个不动的参照点。",

    graphiqueTitre: "真正要看的那个数",
    graphiqueTexte: "总数只会往上走，所以它说明不了你的进步。而每局的平均代价会在你打得更好时下降：这是整个应用里唯一能往下走的指标。从你的头几局起，它就和其他数字一起出现在这里。",

    navHistoriqueTitre: "全部细节",
    navHistoriqueTexte: "我们过去看看。历史记录保留你打过的每一局，连同它的代价和背后的算法。",

    historiqueTitre: "每一局，各自的代价",
    historiqueTexte: "一次活动一行：日期、游戏、你的比分，以及它花了你多少，并写明是哪个动作，免得把俯卧撑和拳击的秒数搞混。右边的箭头展开完整算式，叉号可以删掉记错的那一行。",

    navReglagesTitre: "调成你的尺寸",
    navReglagesTexte: "最后一站。设置按板块归类，跟手机一样：打开你要找的那个，然后退回来。",

    reglagesEffortTitre: "从这里开始",
    reglagesEffortTexte: "力量测试就在这个板块，而且应该从它开始：你一口气能做的俯卧撑数量，决定了施加在你全部欠账上的倍数。没做之前，你一直停在最低的等级。你的动作也在这里选：俯卧撑、深蹲或拳击。",

    reglagesJeuxTitre: "每款游戏各自设置",
    reglagesJeuxTexte: "每款游戏都有自己的一块：League 要追踪哪个账号，以及对局中那个小窗停在屏幕的哪个角。如果你装了 Windows 应用，就在这里逐个游戏调。",

    finTitre: "轮到你了",
    finTexte: "做个力量测试，开一个时段，然后去打。剩下的会自己填满。这个导览随时可以从设置里再看一遍。",
  },
  ja: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "次へ",
    precedent: "戻る",
    terminer: "はじめる",
    passer: "ツアーをスキップ",

    railTitre: "すべてはここから",
    railTexte: "このレールはどのページでも、スクロールしてもついてきます。毎晩やることが三つ載っています。セッションを始める、試合を記録する、そして払う。スマートフォンではこのボタンの奥にたたまれます。",

    sessionTitre: "今夜を始める",
    sessionTexte: "ゲームを選べば、止めるまでアプリが自動で試合を記録します。League なら試合から直接スコアを読みます。勝敗のないゲーム（Minecraft や RPG）では、代わりに過ごした時間を数えます。",

    ajoutTitre: "手で入力してもいい",
    ajoutTexte: "記録し忘れた試合、読み取れないゲーム、翌日にまとめて入れる一晩ぶん。ここにスコアを入れれば、計算はまったく同じです。金額は確定の前に出ます。あとからではありません。",

    detteTitre: "あなたの負債",
    detteTexte: "負債は試合ごとにここへ積み上がります。何か残っているあいだ、バッジがアプリ中どこまでもついてきます。準備ができたら押してください。運動中はカウントダウンが付き添い、途中でやめても、実際にやった分だけが差し引かれます。",

    statsTitre: "いまの位置",
    statsTexte: "アクティビティの数、勝率、そして最初の日からの累計。この三つだけは決して絞り込まれません。全体を表す数字であり、いつでも動かない目印になるからです。",

    graphiqueTitre: "本当に見るべき数字",
    graphiqueTexte: "累計は増える一方なので、上達については何も語りません。一試合あたりの平均費用は、うまくなると下がります。このアプリで唯一、下がりうる数字です。最初の数試合から、ほかの数字と並んでここに出ます。",

    navHistoriqueTitre: "すべての内訳",
    navHistoriqueTexte: "行ってみましょう。履歴には、遊んだ試合が費用と計算の根拠つきで残ります。",

    historiqueTitre: "試合ごとの費用",
    historiqueTexte: "アクティビティ一件につき一行。日付、タイトル、スコア、そしていくらかかったか。種目名も添えてあるので、腕立ての回数とボクシングの秒数を取り違えることはありません。右の矢印で計算全体が開き、バツ印で間違った行を消せます。",

    navReglagesTitre: "自分に合わせる",
    navReglagesTexte: "最後です。設定はスマートフォンと同じように項目ごとにまとまっています。探しているものを開いて、また戻ってください。",

    reglagesEffortTitre: "まずここから",
    reglagesEffortTexte: "筋力テストはこの項目にあり、ここから始めるのが正解です。続けて何回腕立てができるかが、あなたの負債すべてにかかる倍率を決めます。やらないうちは、いちばん下のレベルのままです。種目もここで選びます。腕立て、スクワット、ボクシング。",

    reglagesJeuxTitre: "タイトルごとの設定",
    reglagesJeuxTexte: "タイトルごとにブロックがあります。League で追いかけるアカウント、そして試合中に画面のどの隅へパネルを置くか。Windows アプリをお使いなら、ここでタイトルごとに調整します。",

    finTitre: "あとはあなた次第",
    finTexte: "筋力テストをして、セッションを始めて、遊んでください。あとは勝手に埋まっていきます。このツアーは設定からいつでも見直せます。",
  },
};
