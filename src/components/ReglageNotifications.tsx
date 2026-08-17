"use client";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { notifications as dict } from "@/lib/i18n/dictionaries/notifications";

/**
 * Convertit la clé publique VAPID (base64 URL) en tampon binaire, seul format
 * accepté par `pushManager.subscribe`.
 */
function versTampon(base64: string): ArrayBuffer {
  const rembourrage = "=".repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + rembourrage).replace(/-/g, "+").replace(/_/g, "/"));
  const tampon = new ArrayBuffer(brut.length);
  const vue = new Uint8Array(tampon);
  for (let i = 0; i < brut.length; i++) vue[i] = brut.charCodeAt(i);
  return tampon;
}

type Etat = "chargement" | "indisponible" | "refuse" | "inactif" | "actif";

/**
 * Autorisation des notifications. Elles visent le moment décrit par les
 * testeurs : sortir de partie, recevoir « tu dois 6 pompes », les faire dans
 * la file d'attente suivante. Sans elles, il faut penser à ouvrir l'app.
 */
export function ReglageNotifications() {
  const t = useT(dict);
  const [etat, setEtat] = useState<Etat>("chargement");
  const [appareils, setAppareils] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");

  const relire = useCallback(async () => {
    // L'appel réseau vient en premier : rien ne doit s'exécuter de façon
    // synchrone ici, sinon l'appel depuis l'effet déclenche un rendu en
    // cascade — et le serveur seul sait si les notifications sont configurées.
    const res = await fetch("/api/push").catch(() => null);
    const data = await res?.json().catch(() => null);

    const supporte =
      typeof window !== "undefined"
      && "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window;

    if (!supporte || !data?.disponible) { setEtat("indisponible"); return; }
    setAppareils(data.appareils ?? 0);

    if (Notification.permission === "denied") { setEtat("refuse"); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const abo = await reg?.pushManager.getSubscription();
      setEtat(abo ? "actif" : "inactif");
    } catch {
      setEtat("indisponible");
    }
  }, []);

  // L'état initial se lit dans un rappel de promesse, jamais dans le corps de
  // l'effet : c'est le motif que React recommande pour synchroniser depuis un
  // système extérieur sans provoquer de rendu en cascade.
  useEffect(() => {
    let vivant = true;
    Promise.resolve()
      .then(relire)
      .catch(() => { if (vivant) setEtat("indisponible"); });
    return () => { vivant = false; };
  }, [relire]);

  const activer = async () => {
    setOccupe(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "inactif");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!cle) { setEtat("indisponible"); return; }

      const abo = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: versTampon(cle),
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(abo.toJSON()),
      });
      if (!res.ok) { setMessage(t.erreur); return; }
      await relire();
    } catch {
      setMessage(t.erreur);
    } finally {
      setOccupe(false);
    }
  };

  const desactiver = async () => {
    setOccupe(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const abo = await reg?.pushManager.getSubscription();
      if (abo) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: abo.endpoint }),
        });
        await abo.unsubscribe();
      }
      await relire();
    } catch {
      setMessage(t.erreur);
    } finally {
      setOccupe(false);
    }
  };

  const tester = async () => {
    setOccupe(true);
    setMessage("");
    const res = await fetch("/api/push", { method: "PUT" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setMessage(data?.envoyees > 0 ? t.testEnvoye : t.testEchoue);
    setOccupe(false);
  };

  if (etat === "chargement") return null;

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
      <h2 style={{
        fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
        fontSize: "0.72rem", color: "#ECEFF4",
        letterSpacing: "0.16em", textTransform: "uppercase",
      }}>
        {t.titre}
      </h2>
      <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
        {t.aide}
      </p>

      {etat === "indisponible" && (
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>{t.indisponible}</p>
      )}

      {etat === "refuse" && (
        <p className="text-xs" style={{ color: "var(--amber)" }}>{t.refuse}</p>
      )}

      {etat === "inactif" && (
        <button className="lol-btn text-sm" onClick={activer} disabled={occupe}>
          {occupe ? t.enCours : t.activer}
        </button>
      )}

      {etat === "actif" && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--victory)" }}>
            {t.actives(appareils)}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="text-xs px-3 py-1.5 rounded"
              style={{ background: "rgba(152,162,176,0.1)", border: "1px solid var(--line-strong)", color: "rgba(236,239,244,0.7)", cursor: "pointer" }}
              onClick={tester}
              disabled={occupe}
            >
              {t.tester}
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded"
              style={{ background: "rgba(255,77,46,0.08)", border: "1px solid rgba(255,77,46,0.3)", color: "var(--ember)", cursor: "pointer" }}
              onClick={desactiver}
              disabled={occupe}
            >
              {t.desactiver}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.6)" }}>{message}</p>
      )}
    </div>
  );
}
