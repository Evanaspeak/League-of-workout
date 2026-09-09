"use client";
import { useEffect, useRef, useState } from "react";
import {
  championConnu,
  resoudreChampion,
  suggererChampions,
  useChampions,
} from "@/lib/useChampions";
import { useT } from "@/lib/i18n/LocaleContext";
import { championInput as championInputDict } from "@/lib/i18n/dictionaries/championInput";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onReset?: () => void;
  /** Pour qu'un <label htmlFor> de l'appelant désigne le champ lui-même. */
  id?: string;
}

export function ChampionInput({ value, onChange, onReset, id }: Props) {
  const t = useT(championInputDict);
  const champList = useChampions();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggest = (q: string, limit = 8) => suggererChampions(champList, q, limit);

  const isValid = !value || championConnu(champList, value);

  const handleChange = (raw: string) => {
    onChange(raw);
    onReset?.();
    const s = suggest(raw, 8);
    setSuggestions(s);
    setOpen(s.length > 0 && raw.length > 0);
    setActiveIndex(-1);
  };

  const select = (name: string) => {
    onChange(name);
    onReset?.();
    setSuggestions([]);
    setOpen(false);
  };

  /**
   * Ce qu'on a tapé se ramène à son nom canonique quand on quitte le champ.
   *
   * « Chogath », « Séraphine », « Maître Yi » désignent tous un champion sans
   * l'écrire comme la base l'attend. Sans cette étape, la liste PROPOSAIT ce
   * que le bouton d'enregistrement REFUSAIT : on tape, on voit la bonne
   * suggestion, on ne clique pas, et rien ne s'enregistre sans qu'un mot
   * l'explique.
   *
   * La correction se fait dans le CHAMP et pas au moment d'envoyer : ce qu'on
   * lit doit être ce qu'on enregistre, sinon l'écran et la base disent deux
   * choses. Une saisie qui ne désigne personne est laissée telle quelle —
   * c'est elle que le message d'erreur explique.
   */
  const resoudre = () => {
    if (!value) return;
    const canonique = resoudreChampion(champList, value);
    if (canonique && canonique !== value) {
      onChange(canonique);
      onReset?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === "Enter") {
      // Entrée sans avoir choisi dans la liste : on prend ce qui est tapé au
      // mot. C'est le geste le plus naturel, et sans lui il ne se passe rien —
      // le bouton d'enregistrement étant éteint tant que le nom n'est pas
      // reconnu, la touche ne soumet rien non plus.
      e.preventDefault();
      resoudre();
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        id={id}
        className="lol-input"
        placeholder={t.placeholder}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls="champion-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `champion-option-${activeIndex}` : undefined}
        aria-invalid={!!value && !isValid}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={resoudre}
        onFocus={() => {
          if (value) {
            const s = suggest(value, 8);
            if (s.length) { setSuggestions(s); setOpen(true); }
          }
        }}
        style={value && !isValid ? { borderColor: "rgba(220,80,80,0.7)" } : undefined}
        autoComplete="off"
      />
      {value && !isValid && (
        <div role="alert" style={{ fontSize: "0.7rem", color: "#e05555", marginTop: 2 }}>{t.championNonReconnu}</div>
      )}
      {open && (
        <div
          id="champion-suggestions"
          role="listbox"
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
            background: "var(--ink)", border: "1px solid color-mix(in srgb, var(--steel) 35%, transparent)",
            borderRadius: 6, marginTop: 2, overflow: "hidden",
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              id={`champion-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => select(s)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "7px 12px", border: "none", cursor: "pointer", fontSize: "0.85rem",
                background: i === activeIndex ? "color-mix(in srgb, var(--steel) 15%, transparent)" : "transparent",
                color: i === activeIndex ? "var(--bone)" : "color-mix(in srgb, var(--bone) 80%, transparent)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
