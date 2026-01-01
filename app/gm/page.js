"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const SIZE = 8;

function initials(name) {
  const n = (name || "Player").trim();
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("");
}

function lootEmoji(type, qty) {
  if (!type) return "";
  if (type === "ammo") return qty >= 3 ? "🔫🔫🔫" : qty === 2 ? "🔫🔫" : "🔫";
  if (type === "binoculars") return "🔭";
  if (type === "vest") return "🦺";
  if (type === "gas") return "⛽";
  if (type === "moto") return "🏍️";
  if (type === "trap") return "🪤";
  return "🎁";
}

export default function GMPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [tiles, setTiles] = useState([]);

  const playersByCell = useMemo(() => {
    const m = new Map();
    for (const p of players) {
      if (!p.row || !p.col) continue;
      const key = `${p.row}-${p.col}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(p);
    }
    return m;
  }, [players]);

  const tileByCell = useMemo(() => {
    const m = new Map();
    for (const t of tiles) m.set(`${t.row}-${t.col}`, t);
    return m;
  }, [tiles]);

  async function boot() {
    setLoading(true);
    setError("");
    setMsg("");

    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) {
      router.replace("/login");
      return;
    }

    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) {
      router.replace("/login");
      return;
    }

    const { data: p, error: pErr } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }

    if (!p) {
      setError("No existe tu perfil en players.");
      setLoading(false);
      return;
    }

    if (!p.is_gm) {
      setError("No tienes permisos de GM.");
      setLoading(false);
      return;
    }

    if (!p.game_id) {
      setError("No tienes una partida activa.");
      setLoading(false);
      return;
    }

    setMe(p);
    await refreshAll(p.game_id);

    setLoading(false);
  }

  async function refreshAll(gameId) {
    setError("");

    // Players
    const { data: ps, error: psErr } = await supabase
      .from("players")
      .select("id,user_id,name,is_gm,alive,lives,ammo,row,col,inventory,game_id")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true });

    if (psErr) {
      setError(psErr.message);
      return;
    }
    setPlayers(ps || []);

    // Tiles (objetos)
    const { data: ts, error: tsErr } = await supabase
      .from("game_tiles")
      .select("row,col,loot_type,loot_qty,is_collected")
      .eq("game_id", gameId);

    if (tsErr) {
      setError(
        `No pude leer objetos desde tabla "game_tiles".\nDetalle: ${tsErr.message}`
      );
      return;
    }
    setTiles(ts || []);
  }

  async function movePlayer(playerId, toRow, toCol) {
    if (!me?.game_id) return;

    setBusy(true);
    setError("");
    setMsg("");
    try {
      const { error: uErr } = await supabase
        .from("players")
        .update({ row: toRow, col: toCol })
        .eq("id", playerId)
        .eq("game_id", me.game_id);

      if (uErr) {
        setError(uErr.message);
        return;
      }

      await refreshAll(me.game_id);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system" }}>
      <h1 style={{ marginTop: 0, marginBottom: 10 }}>GM</h1>

      {loading && <p>Cargando…</p>}

      {!!error && (
        <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>
      )}
      {!!msg && (
        <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>
      )}

      {!loading && me && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
          {/* Lista jugadores */}
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 14,
              padding: 14,
              background: "#fff",
              height: "fit-content",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Jugadores ({players.length})</div>

              <button
                onClick={() => refreshAll(me.game_id)}
                disabled={busy}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #bbb",
                  cursor: busy ? "not-allowed" : "pointer",
                  background: "#fff",
                }}
              >
                Refrescar
              </button>
            </div>

            <p style={{ marginTop: 10, color: "#666", marginBottom: 10 }}>
              Arrastra un jugador y suéltalo en una casilla.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              {players.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(p.id));
                  }}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 10,
                    background: "#fff",
                    display: "grid",
                    gridTemplateColumns: "40px 1fr",
                    gap: 10,
                    alignItems: "center",
                    cursor: "grab",
                    opacity: busy ? 0.6 : 1,
                  }}
                  title="Arrastra al tablero"
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: "#2d6a4f",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                    }}
                  >
                    {initials(p.is_gm ? `GM ${p.name || ""}` : p.name)}
                  </div>

                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {p.is_gm ? `GM ${p.name || "Player"}` : p.name || "Player"}
                    </div>
                    <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                      ({p.row ?? "?"},{p.col ?? "?"}) ·{" "}
                      {p.alive ? "Vivo" : "Muerto"} · vidas {p.lives ?? 0} · balas{" "}
                      {p.ammo ?? 0}
                    </div>
                    <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                      inventario: {p.inventory ? JSON.stringify(p.inventory) : "[]"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tablero GM */}
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 14,
              padding: 14,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Tablero completo (GM)
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${SIZE}, 60px)`,
                gap: 8,
                padding: 14,
                background: "#000",
                borderRadius: 16,
                width: "fit-content",
              }}
            >
              {Array.from({ length: SIZE }).map((_, r0) =>
                Array.from({ length: SIZE }).map((__, c0) => {
                  const row = r0 + 1;
                  const col = c0 + 1;

                  const cellPlayers = playersByCell.get(`${row}-${col}`) || [];
                  const t = tileByCell.get(`${row}-${col}`);
                  const loot = t && !t.is_collected ? lootEmoji(t.loot_type, t.loot_qty) : "";

                  return (
                    <div
                      key={`${row}-${col}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const pid = e.dataTransfer.getData("text/plain");
                        if (!pid) return;
                        movePlayer(pid, row, col);
                      }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        border: "1px solid #222",
                        background: "#111",
                        color: "#bbb",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        userSelect: "none",
                      }}
                      title={`(${row},${col})`}
                    >
                      <div style={{ position: "absolute", top: 6, left: 8, fontSize: 11, color: "#666" }}>
                        {row},{col}
                      </div>

                      {loot && (
                        <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 16 }}>
                          {loot}
                        </div>
                      )}

                      {cellPlayers.length > 0 && (
                        <div
                          style={{
                            padding: "6px 8px",
                            borderRadius: 10,
                            background: "#2d6a4f",
                            color: "#fff",
                            fontWeight: 900,
                            fontSize: 12,
                          }}
                        >
                          {cellPlayers.slice(0, 3).map((p) => initials(p.is_gm ? `GM ${p.name || ""}` : p.name)).join("")}
                          {cellPlayers.length > 3 ? "+" : ""}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <p style={{ marginTop: 10, color: "#666" }}>
              Leyenda objetos: 🔫(1/2/3) balas · 🔭 binoculares · 🦺 chaleco · ⛽ bencina · 🏍️ moto · 🪤 trampa
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
