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
  "Beta complète : les 100 places sont prises.": {
    en: "Beta full: all 100 spots are taken.",
    es: "Beta completa: las 100 plazas están ocupadas.",
    de: "Beta voll: alle 100 Plätze sind vergeben.",
    zh: "内测已满：100 个名额都占完了。",
    ja: "ベータは満員です。100 枠すべて埋まりました。",
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
};

export function translateApiError(message: string | undefined | null, locale: Locale): string {
  if (!message) return "";
  if (locale === "fr") return message;
  const traductions = ERROR_MAP[message];
  if (!traductions) return message;
  return traductions[locale] ?? traductions.en;
}
