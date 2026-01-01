"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

/**
 * EMOJIS según tus reglas:
 * - Bala 1/2/3
 * - Binoculares
 * - Chaleco antibalas
 * - Tarro de bencina y fósforos
 * - Moto
 * - Trampa
 */
function lootEmoji(lootType, lootQty) {
  const t = (lootType || "").toLowerCase();

  if (t.includes("bala")) {
    const n = Number(lootQty || 1);
    if (n === 1) return "🔫①";
    if (n === 2) return "🔫②";
    if (n === 3) return "🔫③";
    return "🔫";
  }
  if (t.includes("binoc")) return "🔭";
  if (t.includes("chaleco")) return "🦺";
  if (t.includes("bencina") || t.includes("fósforos") || t.includes("fosfor")) return "⛽🔥";
  if (t.includes("moto")) return "🏍️";
  if (t.includes("trampa")) return "🪤";

  // fallback
  if (lootType) return "★";
  return "";
}

function initials(name) {
  const s = (name || "Player").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "P").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

export default function GMPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  const [players, setPlayers] = useState([]);
  const [tiles, setTiles] = useState([]); // objetos por casilla (game_tiles)
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const size = 8;

  async function loadAll(pMe) {
    setError("");
    setMsg("");

    // players del game
    const { data: ps, error: psErr } = await supabase
      .from("players")
      .select("id,name,is_gm,alive,lives,row,col,ammo,inventory")
      .eq("game_id", pMe.game_id)
      .order("created_at", { ascending: true });

    if (psErr) {
      setError(psErr.message);
      return;
    }
    setPlayers(ps || []);

    // objetos del game (tabla asumida: game_tiles)
    // Columnas esperadas:
    // game_id, row, col, loot_type, loot_qty, picked_by_player_id (opcional)
    const { data: ts, error: tsErr } = await supabase
      .from("game_tiles")
      .select("row,col,loot_type,loot_qty,picked_by_player_id")
      .eq("game_id", pMe.game_id);

    if (tsErr) {
      // si aún no existe la tabla o columnas, lo mostramos claro
      setError(
        `No pude leer objetos desde tabla "game_tiles".\n` +
          `Asegúrate que exista y tenga columnas: row, col, loot_type, loot_qty.\n\n` +
          `Detalle: ${tsErr.message}`
      );
      return;
    }
    setTiles(ts || []);
  }

  useEffect(() => {
    let mounted = true;

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
      const user = u?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

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
        setError("No tienes una partida activa. Crea una en /gm y vuelve.");
        setLoading(false);
        return;
      }

      setMe(p);
      await loadAll(p);

      if (mounted) setLoading(false);
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  const tilesByRC = useMemo(() => {
    const m = new Map();
    for (const t of tiles) m.set(`${t.row}-${t.col}`, t);
    return m;
  }, [tiles]);

  const playersByRC = useMemo(() => {
    const m = new Map();
    for (const p of players) {
      const key = `${p.row}-${p.col}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(p);
    }
    return m;
  }, [players]);

  async function refresh() {
    if (!me?.game_id) return;
    setMsg("");
    await loadAll(me);
    setMsg("✅ Refrescado.");
  }

  async function movePlayer(playerId, toRow, toCol) {
    setError("");
    setMsg("");

    // mover directo en players (si tu RLS lo permite para GM)
    const { error: uErr } = await supabase
      .from("players")
      .update({ row: toRow, col: toCol })
      .eq("id", playerId)
      .eq("game_id", me.game_id);

    if (uErr) {
      setError(uErr.message);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, row: toRow, col: toCol } : p))
    );
  }

  return (
    <>
      

      <main style={{ padding: 24, fontFamily: "system-ui, -apple-system" }}>
        <h1 style={{ marginTop: 0 }}>GM</h1>

        {loading && <p>Cargando…</p>}

        {!!error && (
          <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>
        )}
        {!!msg && <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>}

        {!loading && me && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "360px 1fr",
              gap: 18,
              alignItems: "start",
              marginTop: 10,
            }}
          >
            {/* Panel jugadores */}
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 14,
                padding: 14,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>Jugadores ({players.length})</div>
                <button
                  onClick={refresh}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #bbb",
                    cursor: "pointer",
                    background: "#fff",
                  }}
                >
                  Refrescar
                </button>
              </div>

              <p style={{ color: "#666", marginTop: 10, marginBottom: 10 }}>
                Arrastra un jugador y suéltalo en una casilla.
              </p>

              <div style={{ display: "grid", gap: 10 }}>
                {players.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/playerId", p.id);
                    }}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #e5e5e5",
                      background: "#fff",
                      cursor: "grab",
                    }}
                    title="Arrastra para mover"
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: p.is_gm ? "#2d6a4f" : "#111",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                      }}
                    >
                      {p.is_gm ? `G${initials(p.name)}` : initials(p.name)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900 }}>
                        {p.is_gm ? `GM ${p.name || "Player"}` : p.name || "Player"}
                      </div>
                      <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                        ({p.row ?? "?"},{p.col ?? "?"}) · {p.alive ? "Vivo" : "Muerto"} · vidas{" "}
                        {p.lives ?? "?"} · balas {p.ammo ?? 0}
                      </div>
                      <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>
                        inventario: {p.inventory ? String(p.inventory) : "—"}
                      </div>
                    </div>

                    <div style={{ color: "#999", fontSize: 18 }}>⋮</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tablero GM completo */}
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 14,
                padding: 14,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Tablero completo (GM)</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${size}, 58px)`,
                  gap: 8,
                  padding: 14,
                  background: "#000",
                  borderRadius: 14,
                  width: "fit-content",
                }}
              >
                {Array.from({ length: size }).map((_, r0) =>
                  Array.from({ length: size }).map((__, c0) => {
                    const row = r0 + 1;
                    const col = c0 + 1;

                    const tile = tilesByRC.get(`${row}-${col}`);
                    const emoji = lootEmoji(tile?.loot_type, tile?.loot_qty);

                    const occupants = playersByRC.get(`${row}-${col}`) || [];

                    const picked = !!tile?.picked_by_player_id; // si existe esta col

                    return (
                      <div
                        key={`${row}-${col}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const playerId = e.dataTransfer.getData("text/playerId");
                          if (playerId) movePlayer(playerId, row, col);
                        }}
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 12,
                          border: "1px solid #222",
                          background: "#111",
                          color: "#ddd",
                          position: "relative",
                          overflow: "hidden",
                        }}
                        title={`(${row},${col}) ${tile?.loot_type ? `· ${tile.loot_type}` : ""}`}
                      >
                        {/* coord */}
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            fontSize: 11,
                            color: "#777",
                            fontWeight: 700,
                          }}
                        >
                          {row},{col}
                        </div>

                        {/* objeto */}
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            fontSize: 16,
                            opacity: picked ? 0.35 : 1,
                          }}
                          title={
                            tile?.loot_type
                              ? picked
                                ? `Objeto ya recogido: ${tile.loot_type}`
                                : `Objeto: ${tile.loot_type}`
                              : ""
                          }
                        >
                          {emoji}
                        </div>

                        {/* jugadores en la casilla (pueden ser varios) */}
                        <div
                          style={{
                            position: "absolute",
                            left: 6,
                            right: 6,
                            bottom: 6,
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          {occupants.slice(0, 3).map((p) => (
                            <div
                              key={p.id}
                              style={{
                                padding: "4px 6px",
                                borderRadius: 10,
                                background: p.is_gm ? "#2d6a4f" : "#222",
                                color: "#fff",
                                fontWeight: 900,
                                fontSize: 12,
                                lineHeight: 1,
                              }}
                              title={`${p.name || "Player"} · vidas ${p.lives ?? "?"} · balas ${
                                p.ammo ?? 0
                              }`}
                            >
                              {p.is_gm ? "G" : ""}
                              {initials(p.name)}
                            </div>
                          ))}
                          {occupants.length > 3 && (
                            <div
                              style={{
                                padding: "4px 6px",
                                borderRadius: 10,
                                background: "#333",
                                color: "#fff",
                                fontWeight: 900,
                                fontSize: 12,
                                lineHeight: 1,
                              }}
                              title={`${occupants.length} jugadores aquí`}
                            >
                              +{occupants.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
                Leyenda objetos: 🔫①/②/③ balas · 🔭 binoculares · 🦺 chaleco · ⛽🔥 bencina · 🏍️
                moto · 🪤 trampa
                <br />
                (Si un objeto fue recogido, se verá “apagado”.)
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
