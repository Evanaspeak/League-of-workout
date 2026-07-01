"use client";
import { useEffect, useRef, useState } from "react";
import { CHAMPIONS } from "@/lib/champions";
import { useT } from "@/lib/i18n/LocaleContext";
import { championInput as championInputDict } from "@/lib/i18n/dictionaries/championInput";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onReset?: () => void;
}

export function ChampionInput({ value, onChange, onReset }: Props) {
  const t = useT(championInputDict);
  const [champList, setChampList] = useState<string[]>(CHAMPIONS);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/champions")
      .then((r) => r.json())
      .then((list) => { if (Array.isArray(list) && list.length > 0) setChampList(list); })
      .catch(() => {});
  }, []);

  const suggest = (q: string, limit = 8) => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return champList.filter((c) => c.toLowerCase().includes(lower)).slice(0, limit);
  };

  const isKnown = (name: string) =>
    !name || champList.some((c) => c.toLowerCase() === name.trim().toLowerCase());

  const isValid = isKnown(value);

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
        className="lol-input"
        placeholder={t.placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
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
        <div style={{ fontSize: "0.7rem", color: "#e05555", marginTop: 2 }}>{t.championNonReconnu}</div>
      )}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "#0d1117", border: "1px solid rgba(200,170,110,0.35)",
          borderRadius: 6, marginTop: 2, overflow: "hidden",
        }}>
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => select(s)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "7px 12px", border: "none", cursor: "pointer", fontSize: "0.85rem",
                background: i === activeIndex ? "rgba(200,170,110,0.15)" : "transparent",
                color: i === activeIndex ? "#C8AA6E" : "rgba(240,230,211,0.8)",
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
