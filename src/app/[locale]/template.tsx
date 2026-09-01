/**
 * Template racine : contrairement au layout, il se remonte à CHAQUE
 * navigation — l'animation .page-enter rejoue donc à chaque changement
 * de page (Dashboard → Historique → Réglages…).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
