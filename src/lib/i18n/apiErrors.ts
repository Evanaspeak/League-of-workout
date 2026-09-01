import type { Locale } from "./LocaleContext";

/**
 * Les routes API renvoient leurs messages d'erreur en français en dur.
 * Cette table les traduit côté client au moment de l'affichage plutôt que
 * de dupliquer la logique de langue dans chaque route.
 *
 * La clé est le message français tel qu'il sort de la route : c'est lui qui
 * circule sur le réseau, et le changer casserait la correspondance sans que
 * rien ne le signale. Une langue absente retombe sur l'anglais, comme partout
 * ailleurs dans l'application.
 */
type Traductions = { en: string } & Partial<Record<Locale, string>>;

const ERROR_MAP: Record<string, Traductions> = {
  "Unauthorized": {
    en: "Unauthorized", es: "No autorizado", de: "Nicht autorisiert",
    zh: "未授权", ja: "認証されていません",
  },
  "Accès refusé": {
    en: "Access denied", es: "Acceso denegado", de: "Zugriff verweigert",
    zh: "拒绝访问", ja: "アクセスできません",
  },
  "Erreur serveur": {
    en: "Server error", es: "Error del servidor", de: "Serverfehler",
    zh: "服务器错误", ja: "サーバーエラー",
  },
  "Erreur base de données": {
    en: "Database error", es: "Error de la base de datos", de: "Datenbankfehler",
    zh: "数据库错误", ja: "データベースエラー",
  },
  "Champs manquants": {
    en: "Missing fields", es: "Faltan campos", de: "Fehlende Felder",
    zh: "有必填项没填", ja: "未入力の項目があります",
  },
  "La récupération par courriel n'est pas disponible pour le moment.": {
    en: "Email recovery is unavailable right now.",
    es: "La recuperación por correo no está disponible por ahora.",
    de: "Die Wiederherstellung per E-Mail ist gerade nicht verfügbar.",
    zh: "邮件找回功能暂时不可用。",
    ja: "メールでの復旧は現在ご利用いただけません。",
  },
  "Email invalide": {
    en: "Invalid email", es: "Correo no válido", de: "Ungültige E-Mail",
    zh: "邮箱格式不对", ja: "メールアドレスが正しくありません",
  },
  "Mot de passe trop court (min 8 caractères)": {
    en: "Password too short (min 8 characters)",
    es: "Contraseña demasiado corta (mínimo 8 caracteres)",
    de: "Passwort zu kurz (mindestens 8 Zeichen)",
    zh: "密码太短（至少 8 位）",
    ja: "パスワードが短すぎます（8 文字以上）",
  },
  "Pseudo trop court (min 2 caractères)": {
    en: "Username too short (min 2 characters)",
    es: "Nick demasiado corto (mínimo 2 caracteres)",
    de: "Nickname zu kurz (mindestens 2 Zeichen)",
    zh: "昵称太短（至少 2 个字符）",
    ja: "ニックネームが短すぎます（2 文字以上）",
  },
  "Un compte existe déjà avec cet email": {
    en: "An account with this email already exists",
    es: "Ya existe una cuenta con este correo",
    de: "Mit dieser E-Mail existiert bereits ein Konto",
    zh: "这个邮箱已经注册过账号了",
    ja: "このメールアドレスのアカウントはすでにあります",
  },
  "Utilisateur introuvable": {
    en: "User not found", es: "Usuario no encontrado", de: "Nutzer nicht gefunden",
    zh: "找不到这个用户", ja: "ユーザーが見つかりません",
  },
  "Ce compte utilise Google ou Discord : pas de mot de passe à réinitialiser": {
    en: "This account uses Google or Discord: no password to reset",
    es: "Esta cuenta usa Google o Discord: no hay contraseña que restablecer",
    de: "Dieses Konto nutzt Google oder Discord: es gibt kein Passwort zurückzusetzen",
    zh: "这个账号用的是 Google 或 Discord，没有密码可以重置",
    ja: "このアカウントは Google または Discord を使っています。再設定するパスワードはありません",
  },
  "Statut invalide": {
    en: "Invalid status", es: "Estado no válido", de: "Ungültiger Status",
    zh: "状态无效", ja: "ステータスが不正です",
  },
  "Champion invalide": {
    en: "Invalid champion", es: "Campeón no válido", de: "Ungültiger Champion",
    zh: "英雄无效", ja: "チャンピオンが不正です",
  },
  "Rôle invalide": {
    en: "Invalid role", es: "Rol no válido", de: "Ungültige Rolle",
    zh: "位置无效", ja: "ロールが不正です",
  },
  "PUUID manquant. Configure ton Riot ID dans Réglages.": {
    en: "Missing PUUID. Set up your Riot ID in Settings.",
    es: "Falta el PUUID. Configura tu Riot ID en Ajustes.",
    de: "PUUID fehlt. Richte deine Riot ID in den Einstellungen ein.",
    zh: "缺少 PUUID。请在设置里填好你的 Riot ID。",
    ja: "PUUID がありません。設定で Riot ID を登録してください。",
  },
  "Le suivi Riot est indisponible pour le moment. Le reste de l'application fonctionne : tes parties s'enregistrent à la main.": {
    en: "Riot tracking is unavailable right now. The rest of the app works: you can log your matches by hand.",
    es: "El seguimiento de Riot no está disponible ahora mismo. El resto de la aplicación funciona: puedes registrar tus partidas a mano.",
    de: "Die Riot-Anbindung ist gerade nicht verfügbar. Der Rest der App funktioniert: Du kannst deine Partien von Hand eintragen.",
    zh: "Riot 数据同步暂时不可用。其他功能正常，你可以手动记录对局。",
    ja: "Riot との連携は現在利用できません。ほかの機能は使えます — 試合は手動で記録できます。",
  },
  "Riot ID manquant": {
    en: "Missing Riot ID", es: "Falta el Riot ID", de: "Riot ID fehlt",
    zh: "缺少 Riot ID", ja: "Riot ID がありません",
  },
  "Partie introuvable": {
    en: "Game not found", es: "Partida no encontrada", de: "Partie nicht gefunden",
    zh: "找不到这一局", ja: "試合が見つかりません",
  },
  "Date invalide": {
    en: "Invalid date", es: "Fecha no válida", de: "Ungültiges Datum",
    zh: "日期无效", ja: "日付が不正です",
  },
  "Identifiants invalides": {
    en: "Invalid credentials", es: "Credenciales no válidas", de: "Ungültige Zugangsdaten",
    zh: "账号或码不对", ja: "ログイン情報が正しくありません",
  },
  "Trop de tentatives. Réessaie plus tard.": {
    en: "Too many attempts. Try again later.",
    es: "Demasiados intentos. Inténtalo más tarde.",
    de: "Zu viele Versuche. Versuch es später erneut.",
    zh: "尝试次数太多，请稍后再试。",
    ja: "試行が多すぎます。しばらくしてからお試しください。",
  },
  "Non authentifié": {
    en: "Not signed in", es: "No has iniciado sesión", de: "Nicht angemeldet",
    zh: "未登录", ja: "ログインしていません",
  },
  "Ce pseudo est déjà pris. Choisis-en un autre.": {
    en: "That username is taken. Pick another one.", es: "Ese nombre ya está cogido. Elige otro.", de: "Dieser Name ist vergeben. Nimm einen anderen.",
    zh: "这个昵称已经有人用了，换一个吧。", ja: "そのユーザー名は使われています。別の名前にしてください。",
  },
  "Format invalide": {
    en: "Invalid format", es: "Formato no válido", de: "Ungültiges Format",
    zh: "格式不正确", ja: "形式が正しくありません",
  },
  "Format invalide. Utilise pseudo#tag": {
    en: "Invalid format. Use name#tag", es: "Formato no válido. Usa nombre#tag", de: "Ungültiges Format. Nutze Name#Tag",
    zh: "格式不对，请用 名称#标签", ja: "形式が違います。名前#タグ で入力してください",
  },
  "Riot ID invalide": {
    en: "Invalid Riot ID", es: "Riot ID no válido", de: "Ungültige Riot ID",
    zh: "Riot ID 无效", ja: "Riot ID が正しくありません",
  },
  "PUUID invalide": {
    en: "Invalid PUUID", es: "PUUID no válido", de: "Ungültige PUUID",
    zh: "PUUID 无效", ja: "PUUID が正しくありません",
  },
  "Région inconnue": {
    en: "Unknown region", es: "Región desconocida", de: "Unbekannte Region",
    zh: "未知的区服", ja: "不明なリージョンです",
  },
  "Le suivi Riot est momentanément coupé : notre clé n'est plus acceptée. Tes parties s'enregistrent à la main en attendant.": {
    en: "Riot tracking is briefly down: our key is no longer accepted. Add your matches by hand in the meantime.",
    es: "El seguimiento de Riot está cortado un momento: nuestra clave ya no se acepta. Añade tus partidas a mano mientras tanto.",
    de: "Die Riot-Anbindung ist kurz unterbrochen: unser Schlüssel wird nicht mehr akzeptiert. Trag deine Partien so lange von Hand ein.",
    zh: "Riot 同步暂时中断：我们的密钥不再被接受。这段时间请手动添加对局。",
    ja: "Riot 連携が一時的に止まっています。こちらのキーが受け付けられません。その間は手動で試合を追加してください。",
  },
  "Riot limite les requêtes en ce moment. Réessaie dans une minute.": {
    en: "Riot is rate-limiting us right now. Try again in a minute.",
    es: "Riot nos está limitando ahora mismo. Vuelve a intentarlo en un minuto.",
    de: "Riot drosselt uns gerade. Versuch es in einer Minute noch einmal.",
    zh: "Riot 正在限流。过一分钟再试。",
    ja: "現在 Riot にリクエストを制限されています。1 分ほどおいて再試行してください。",
  },
  "Riot ne répond pas correctement pour le moment.": {
    en: "Riot is not answering properly right now.",
    es: "Riot no responde correctamente en este momento.",
    de: "Riot antwortet gerade nicht richtig.",
    zh: "Riot 目前的响应不正常。",
    ja: "現在 Riot が正しく応答していません。",
  },
  "Joueur introuvable. Vérifie le pseudo, le tag et la région.": {
    en: "Player not found. Check the name, the tag and the region.",
    es: "No se ha encontrado al jugador. Revisa el nombre, la etiqueta y la región.",
    de: "Spieler nicht gefunden. Prüfe Namen, Tag und Region.",
    zh: "没有找到这个玩家。检查一下名称、标签和区服。",
    ja: "プレイヤーが見つかりません。名前・タグ・リージョンを確認してください。",
  },
  "Aucune partie trouvée chez Riot.": {
    en: "Riot has no match on record.",
    es: "Riot no tiene ninguna partida registrada.",
    de: "Riot hat keine Partie verzeichnet.",
    zh: "Riot 那边没有对局记录。",
    ja: "Riot 側に試合の記録がありません。",
  },
  "Cette partie n'est plus disponible chez Riot.": {
    en: "That match is no longer available from Riot.",
    es: "Esa partida ya no está disponible en Riot.",
    de: "Diese Partie ist bei Riot nicht mehr verfügbar.",
    zh: "这局在 Riot 那边已经查不到了。",
    ja: "この試合は Riot 側でもう取得できません。",
  },
  "Aucune game trouvée.": {
    en: "No match found.", es: "No se ha encontrado ninguna partida.", de: "Keine Partie gefunden.",
    zh: "没有找到对局。", ja: "試合が見つかりませんでした。",
  },
  "Cette game est déjà loggée.": {
    en: "That match is already logged.", es: "Esa partida ya está registrada.", de: "Diese Partie ist schon eingetragen.",
    zh: "这局已经记录过了。", ja: "この試合はすでに記録されています。",
  },
  "Participant non trouvé dans le match.": {
    en: "You were not found in that match.", es: "No te hemos encontrado en esa partida.", de: "Du wurdest in dieser Partie nicht gefunden.",
    zh: "在这局里没有找到你。", ja: "この試合にあなたが見つかりませんでした。",
  },
  "Config manquante": {
    en: "Scoring configuration is missing", es: "Falta la configuración de puntuación", de: "Die Berechnungskonfiguration fehlt",
    zh: "缺少计算配置", ja: "採点の設定がありません",
  },
  "Classement invalide": {
    en: "Invalid placement", es: "Puesto no válido", de: "Ungültige Platzierung",
    zh: "名次不正确", ja: "順位が正しくありません",
  },
  "Résultat de la partie illisible": {
    en: "The result of this game could not be read",
    es: "No se ha podido leer el resultado de esta partida",
    de: "Das Ergebnis dieser Partie ließ sich nicht lesen",
    zh: "无法读取这局对局的结果", ja: "この試合の結果を読み取れませんでした",
  },
  "Rôle inconnu": {
    en: "Unknown role", es: "Rol desconocido", de: "Unbekannte Rolle",
    zh: "位置不正确", ja: "不明なロールです",
  },
  "Résultat invalide": {
    en: "Invalid result", es: "Resultado no válido", de: "Ungültiges Ergebnis",
    zh: "结果不正确", ja: "結果が正しくありません",
  },
  "Cette activité n'a pas de résultat": {
    en: "This activity has no result", es: "Esta actividad no tiene resultado",
    de: "Diese Aktivität hat kein Ergebnis",
    zh: "该活动没有胜负", ja: "このアクティビティに勝敗はありません",
  },
  "Le résultat se déduit du classement": {
    en: "The result comes from your placement",
    es: "El resultado se deduce de tu posición",
    de: "Das Ergebnis ergibt sich aus der Platzierung",
    zh: "结果由名次决定", ja: "結果は順位から決まります",
  },
  "Durée invalide": {
    en: "Invalid duration", es: "Duración no válida", de: "Ungültige Dauer",
    zh: "时长不正确", ja: "時間が正しくありません",
  },
  "Date manquante": {
    en: "Missing date", es: "Falta la fecha", de: "Datum fehlt",
    zh: "缺少日期", ja: "日付がありません",
  },
  "Game introuvable": {
    en: "Match not found", es: "Partida no encontrada", de: "Partie nicht gefunden",
    zh: "找不到这局", ja: "試合が見つかりません",
  },
  "Aucune partie choisie": {
    en: "No match selected", es: "No has elegido ninguna partida", de: "Keine Partie ausgewählt",
    zh: "没有选择对局", ja: "試合が選ばれていません",
  },
  "Choisissez un décalage ou une date": {
    en: "Choose a shift or a date", es: "Elige un desplazamiento o una fecha", de: "Wähle eine Verschiebung oder ein Datum",
    zh: "请选择偏移量或日期", ja: "ずらす量か日付を選んでください",
  },
  "Décalage invalide": {
    en: "Invalid shift", es: "Desplazamiento no válido", de: "Ungültige Verschiebung",
    zh: "偏移量不正确", ja: "ずらす量が正しくありません",
  },
  "Trop de parties d'un coup": {
    en: "Too many matches at once", es: "Demasiadas partidas a la vez", de: "Zu viele Partien auf einmal",
    zh: "一次选了太多对局", ja: "一度に選べる試合が多すぎます",
  },
  "Aucun exercice au temps sélectionné": {
    en: "No time-based exercise selected", es: "No hay ningún ejercicio por tiempo seleccionado", de: "Keine zeitbasierte Übung ausgewählt",
    zh: "没有选择按时间计的运动", ja: "時間で数える種目が選ばれていません",
  },
  "Exercice inconnu": {
    en: "Unknown exercise", es: "Ejercicio desconocido", de: "Unbekannte Übung",
    zh: "未知的运动", ja: "不明な種目です",
  },
  "Cet exercice n'est pas actif": {
    en: "That exercise is not active", es: "Ese ejercicio no está activo", de: "Diese Übung ist nicht aktiv",
    zh: "这个运动没有启用", ja: "その種目は有効ではありません",
  },
  "Gardez au moins un exercice : sinon la dette n'a plus aucune façon d'être payée.": {
    en: "Keep at least one exercise: otherwise there is no way left to pay the debt.", es: "Deja al menos un ejercicio: si no, la deuda no tiene forma de pagarse.", de: "Behalte mindestens eine Übung: sonst lässt sich die Schuld nicht mehr abarbeiten.",
    zh: "至少保留一个运动，否则欠的训练就没法完成了。", ja: "種目は最低ひとつ残してください。でないと借りを返す方法がなくなります。",
  },
  "Variante inconnue": {
    en: "Unknown variant", es: "Variante desconocida", de: "Unbekannte Variante",
    zh: "未知的动作变体", ja: "不明なバリエーションです",
  },
  "Test de pompes invalide": {
    en: "Invalid push-up test", es: "Prueba de flexiones no válida", de: "Ungültiger Liegestütz-Test",
    zh: "俯卧撑测试数值不正确", ja: "腕立ての記録が正しくありません",
  },
  "Seuil de rappel invalide": {
    en: "Invalid reminder threshold", es: "Umbral de aviso no válido", de: "Ungültige Erinnerungsschwelle",
    zh: "提醒阈值不正确", ja: "リマインドのしきい値が正しくありません",
  },
  "Plafond quotidien invalide": {
    en: "Invalid daily cap", es: "Límite diario no válido", de: "Ungültiges Tageslimit",
    zh: "每日上限不正确", ja: "1日の上限が正しくありません",
  },
  "Objectif invalide": {
    en: "Invalid goal", es: "Objetivo no válido", de: "Ungültiges Ziel",
    zh: "目标不正确", ja: "目標が正しくありません",
  },
  "Mesure physique hors bornes": {
    en: "Body measurement out of range", es: "Medida corporal fuera de rango", de: "Körpermaß außerhalb des zulässigen Bereichs",
    zh: "身体数据超出范围", ja: "身体データが範囲外です",
  },
  "Valeur hors bornes": {
    en: "Value out of range", es: "Valor fuera de rango", de: "Wert außerhalb des zulässigen Bereichs",
    zh: "数值超出范围", ja: "値が範囲外です",
  },
  "Valeur invalide": {
    en: "Invalid value", es: "Valor no válido", de: "Ungültiger Wert",
    zh: "数值不正确", ja: "値が正しくありません",
  },
  "Langue inconnue": {
    en: "Unknown language", es: "Idioma desconocido", de: "Unbekannte Sprache",
    zh: "未知的语言", ja: "不明な言語です",
  },
  "Fuseau inconnu": {
    en: "Unknown time zone", es: "Zona horaria desconocida", de: "Unbekannte Zeitzone",
    zh: "未知的时区", ja: "不明なタイムゾーンです",
  },
  "Consentement aux données de santé requis": {
    en: "Consent for health data is required", es: "Hace falta tu consentimiento para los datos de salud", de: "Für Gesundheitsdaten ist deine Einwilligung nötig",
    zh: "需要你同意处理健康数据", ja: "健康データの利用に同意が必要です",
  },
  "Réponse manquante": {
    en: "Missing answer", es: "Falta la respuesta", de: "Antwort fehlt",
    zh: "缺少回答", ja: "回答がありません",
  },
  "Corps illisible": {
    en: "Could not read the request", es: "No se ha podido leer la petición", de: "Die Anfrage war nicht lesbar",
    zh: "无法读取请求内容", ja: "リクエストを読み取れませんでした",
  },
  "Lien invalide ou expiré": {
    en: "Invalid or expired link", es: "Enlace no válido o caducado", de: "Ungültiger oder abgelaufener Link",
    zh: "链接无效或已过期", ja: "リンクが無効か期限切れです",
  },
  "Abonnement invalide": {
    en: "Invalid subscription", es: "Suscripción no válida", de: "Ungültiges Abonnement",
    zh: "订阅信息无效", ja: "購読情報が正しくありません",
  },
  "Notifications non configurées": {
    en: "Notifications are not set up", es: "Las notificaciones no están configuradas", de: "Benachrichtigungen sind nicht eingerichtet",
    zh: "通知还没有配置好", ja: "通知が設定されていません",
  },
  "Décrivez le problème en quelques mots.": {
    en: "Describe the problem in a few words.", es: "Describe el problema en unas pocas palabras.", de: "Beschreib das Problem in ein paar Worten.",
    zh: "用几句话描述一下问题。", ja: "問題を数語で書いてください。",
  },
  "Trop d'essais. Réessaie dans quelques minutes.": {
    en: "Too many attempts. Try again in a few minutes.", es: "Demasiados intentos. Inténtalo dentro de unos minutos.", de: "Zu viele Versuche. Versuch es in ein paar Minuten erneut.",
    zh: "尝试太频繁，请过几分钟再试。", ja: "回数が多すぎます。数分後にお試しください。",
  },
  "Trop de parties enregistrées d'affilée. Réessaie dans quelques minutes.": {
    en: "Too many matches logged in a row. Try again in a few minutes.", es: "Has registrado demasiadas partidas seguidas. Inténtalo dentro de unos minutos.", de: "Zu viele Partien hintereinander eingetragen. Versuch es in ein paar Minuten erneut.",
    zh: "连续记录了太多对局，请过几分钟再试。", ja: "続けて記録しすぎです。数分後にお試しください。",
  },
  "Trop de recherches d'affilée. Réessaie dans quelques minutes.": {
    en: "Too many lookups in a row. Try again in a few minutes.", es: "Demasiadas búsquedas seguidas. Inténtalo dentro de unos minutos.", de: "Zu viele Abfragen hintereinander. Versuch es in ein paar Minuten erneut.",
    zh: "查询太频繁，请过几分钟再试。", ja: "検索が続きすぎです。数分後にお試しください。",
  },
  "Trop de signalements envoyés. Réessayez dans quelques minutes.": {
    en: "Too many reports sent. Try again in a few minutes.", es: "Has enviado demasiados informes. Inténtalo dentro de unos minutos.", de: "Zu viele Meldungen gesendet. Versuch es in ein paar Minuten erneut.",
    zh: "提交的反馈太多了，请过几分钟再试。", ja: "報告が多すぎます。数分後にお試しください。",
  },
  "Token de session introuvable": {
    en: "Session token not found", es: "No se ha encontrado el token de sesión", de: "Sitzungstoken nicht gefunden",
    zh: "找不到会话凭证", ja: "セッショントークンが見つかりません",
  },
  "Tour de connexion absent": {
    en: "Login round is missing", es: "Falta la ronda de conexión", de: "Die Anmelderunde fehlt",
    zh: "缺少登录轮次", ja: "ログインの手順が見つかりません",
  },
  "Session antérieure à la demande": {
    en: "This session predates the request", es: "Esta sesión es anterior a la petición", de: "Diese Sitzung ist älter als die Anfrage",
    zh: "该会话早于本次请求", ja: "このセッションは要求より前のものです",
  },
};

/**
 * Ce message a-t-il une entrée dans la table ?
 *
 * Distinct de « la traduction diffère du message » : « Unauthorized » s'écrit
 * pareil en anglais, et le déduire du résultat rangerait ce message parmi les
 * oubliés. Le test qui garde la complétude de la table a besoin de la question
 * posée dans ce sens-là.
 */
export function aUneTraduction(message: string): boolean {
  return Object.prototype.hasOwnProperty.call(ERROR_MAP, message);
}

export function translateApiError(message: string | undefined | null, locale: Locale): string {
  if (!message) return "";
  if (locale === "fr") return message;
  const traductions = ERROR_MAP[message];
  if (!traductions) return message;
  return traductions[locale] ?? traductions.en;
}
