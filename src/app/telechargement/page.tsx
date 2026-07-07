import { TelechargementClient } from "./TelechargementClient";

export const metadata = { title: "Téléchargement — Win or Workout" };

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? null;

export default function TelechargementPage() {
  return <TelechargementClient downloadUrl={DOWNLOAD_URL} />;
}
