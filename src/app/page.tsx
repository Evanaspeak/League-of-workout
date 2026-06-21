"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";

type DashData = {
  totalGames: number;
  wins: number;
  winrate: number;
  totalPompes: number;
  recordPompes: number;
  pompesByRole: Record<string, number>;
  cumulByDate: { date: string; cumul: number }[];
  objectifTotalPompes: number;
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="lol-panel p-4 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(200,170,110,0.6)" }}>{label}</span>
      <span className="text-2xl font-bold gold-text">{value}</span>
      {sub && <span className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-20 gold-text">Chargement...</div>;

  const progress = data.objectifTotalPompes > 0
    ? Math.min(100, Math.round((data.totalPompes / data.objectifTotalPompes) * 100))
    : 0;
  const roleData = Object.entries(data.pompesByRole).map(([role, pompes]) => ({ role, pompes }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gold-text tracking-widest">DASHBOARD</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Games jouées" value={data.totalGames} />
        <StatCard label="Winrate" value={`${data.winrate}%`} sub={`${data.wins}V / ${data.totalGames - data.wins}D`} />
        <StatCard label="Total pompes" value={data.totalPompes} />
        <StatCard label="Record / game" value={data.recordPompes} sub="pompes" />
      </div>

      {data.objectifTotalPompes > 0 && (
        <div className="lol-panel p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="gold-text font-semibold">Objectif : {data.objectifTotalPompes} pompes</span>
            <span className="blue-text">{progress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(200,170,110,0.15)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "linear-gradient(to right, #0bc4e3, #c8aa6e)" }}
            />
          </div>
          <div className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>
            {data.totalPompes} / {data.objectifTotalPompes} pompes
            {data.objectifTotalPompes - data.totalPompes > 0
              ? ` · ${data.objectifTotalPompes - data.totalPompes} restantes`
              : " · Objectif atteint !"}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roleData.length > 0 && (
          <div className="lol-panel p-4">
            <h2 className="gold-text text-sm font-semibold uppercase tracking-widest mb-3">Pompes par rôle</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={roleData}>
                <XAxis dataKey="role" tick={{ fill: "#c8aa6e", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(240,230,211,0.5)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a2634", border: "1px solid #c8aa6e40", color: "#f0e6d3" }} />
                <Bar dataKey="pompes" fill="#c8aa6e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.cumulByDate.length > 0 && (
          <div className="lol-panel p-4">
            <h2 className="gold-text text-sm font-semibold uppercase tracking-widest mb-3">Progression cumulative</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.cumulByDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,170,110,0.1)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(240,230,211,0.4)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(240,230,211,0.5)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a2634", border: "1px solid #c8aa6e40", color: "#f0e6d3" }} />
                <Line dataKey="cumul" stroke="#0bc4e3" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data.totalGames === 0 && (
        <div className="lol-panel p-8 text-center space-y-2">
          <div className="text-4xl">⚔</div>
          <p className="gold-text font-semibold">Aucune game loggée</p>
          <p className="text-sm" style={{ color: "rgba(240,230,211,0.5)" }}>
            Va sur <strong>Dernière Game</strong> pour logger ta première partie.
          </p>
        </div>
      )}
    </div>
  );
}
