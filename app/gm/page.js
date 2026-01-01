"use client";

import Nav from "../components/Nav";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const SIZE = 8;

const LOOT_EMOJI = {
  life: "❤️",
  bullet: "🔫",
  binoculars: "🔭",
  vest: "🦺",
  gas: "⛽",
  bike: "🏍️",
  trap: "🪤",
};

function initials(name) {
  const s = (name || "Player").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "P").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function GMCell({ playersHere, lootEmoji, row, col, onDropPlayer }) {
  const hasPlayers = playersHere?.length > 0;

  let content = "";
  if (hasPlayers) {
    content =
      playersHere.length === 1 ? initials(playersHere[0].name) : String(playersHere.length);
  } else if (lootEmoji) {
    content = lootEmoji;
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const playerId = e.dataTransfer.getData("text/player_id");
        if (playerId) onDropPlayer(playerId, row, col);
      }}
      style={{
        width: 54,
        height: 54,
        borderRadius: 10,
        background: "#111",
        border: "1px solid #222",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        color: "#eee",
        fontWeight: 800,
        userSelect: "none",
      }}
      title={`(${row}, ${col})`}
    >
      <div style={{ position: "absolute", top: 6, left: 8, fontSize: 10, color: "#666" }}>
        {row},{col}
      </div>

      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: hasPlayers ? "#2d6a4f" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: lootEmoji && !hasPlayers ? 18 : 14,
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default function GMPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [tiles, setTiles] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const playersByRC = useMemo(() => {
    const m = new Map();
    for (const p of players) {
      if (!p?.row || !p?.col) continue;
      const key = `${p.row}-${p.col}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(p);
    }
    return m;
  }, [players]);

  const lootByRC = useMemo(() => {
    const m = new Map();
    for (const t of tiles) {
      if (t?.is_collected) continue;
      const key = `${t.row}-${t.col}`;
      const type = t?.loot_type;
      if (!type) continue;
      m.set(key, LOOT_EMOJI[type] || "🎁");
    }
    return m;
  }, [tiles]);

  async function refreshAll(gameId) {
    setError("");

    const { data: ps, error: psErr } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true });

    if (psErr) {
      setError(psErr.message);
      return;
    }
    setPlayers(ps || []);

    const { data: ts, error: tsErr } = await supabase
      .from("game_tiles")
      .select("*")
      .eq("game_id", gameId);

    if (tsErr) {
      setError(tsErr.message);
      return;
    }
    setTiles(ts || []);
  }

  async function startNewGame() {
    setBusy(true);
    setError("");
    setMsg("");

    // ✅ ESTO crea un game NUEVO y mueve a todos los jugadores al nuevo game_id
    const { data, error } = await supabase.rpc("gm_start_game", { p_items: 12 });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    const out = Array.isArray(data) ? data[0] : data;

    if (!out?.game_id || !out?.code) {
      setError("El RPC se ejecutó pero no devolvió {game_id, code}.");
      return;
    }

    setMsg(`✅ Partida NUEVA creada.\nCódigo: ${out.game_code}`);
    await refreshAll(out.game_uuid);
  }

  async function movePlayerTo(playerId, row, col) {
    if (!me?.game_id) return;

    setError("");
    setMsg("");

    const { error: e } = await supabase.rpc("gm_force_move_player", {
      p_player_id: playerId,
      p_row: row,
      p_col: col,
    });

    if (e) {
      setError(e.message);
      return;
    }

    setMsg("✅ Jugador movido.");
    await refreshAll(me.game_id);
  }

  useEffect(() => {
    (async () => {
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

      if (pErr || !p) {
        setError(pErr?.message || "No existe tu perfil en players.");
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
    })();
  }, [router]);

  return (
    <>
      <Nav isGm={true} />
      <main style={{ padding: 24, fontFamily: "system-ui, -apple-system" }}>
        <h1 style={{ marginTop: 0 }}>GM</h1>

        {loading && <p>Cargando…</p>}

        {!!error && (
          <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>
        )}
        {!!msg && (
          <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>
        )}

        {!loading && me && (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={startNewGame}
              disabled={busy}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #bbb",
                cursor: busy ? "not-allowed" : "pointer",
                background: "#fff",
              }}
            >
              {busy ? "Creando..." : "Iniciar partida (NUEVA) + random"}
            </button>
          </div>
        )}

        {!loading && me && (
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Jugadores ({players.length})</h2>
                <button
                  onClick={() => refreshAll(me.game_id)}
                  style={{
                    marginLeft: "auto",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #bbb",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Refrescar
                </button>
              </div>

              <p style={{ marginTop: 10, color: "#666" }}>Arrastra un jugador y suéltalo en una casilla.</p>

              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {players.map((p) => {
                  const bullets = p?.bullets ?? 0;
                  const inv = Array.isArray(p?.inventory) ? p.inventory : [];
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/player_id", p.id)}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        border: "1px solid #e5e5e5",
                        borderRadius: 12,
                        padding: 10,
                        background: "#fff",
                        cursor: "grab",
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: "#2d6a4f",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                        }}
                      >
                        {initials(p.name)}
                      </div>

                      <div style={{ lineHeight: 1.2 }}>
                        <div style={{ fontWeight: 800 }}>{p.is_gm ? "GM " : ""}{p.name || "Player"}</div>
                        <div style={{ color: "#666", fontSize: 13 }}>
                          ({p.row ?? "?"},{p.col ?? "?"}) · {p.alive ? "Vivo" : "Muerto"} · vidas {p.lives ?? 0} · balas {bullets}
                        </div>
                        <div style={{ color: "#666", fontSize: 12 }}>
                          inventario: {inv.length ? inv.join(", ") : "[]"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, background: "#fff" }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Tablero completo (GM)</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${SIZE}, 54px)`,
                  gap: 8,
                  padding: 14,
                  background: "#000",
                  borderRadius: 14,
                  width: "fit-content",
                  marginTop: 10,
                }}
              >
                {Array.from({ length: SIZE }).map((_, r0) =>
                  Array.from({ length: SIZE }).map((__, c0) => {
                    const row = r0 + 1;
                    const col = c0 + 1;
                    const key = `${row}-${col}`;
                    const playersHere = playersByRC.get(key) || [];
                    const lootEmoji = lootByRC.get(key) || "";
                    return (
                      <GMCell
                        key={key}
                        row={row}
                        col={col}
                        playersHere={playersHere}
                        lootEmoji={lootEmoji}
                        onDropPlayer={movePlayerTo}
                      />
                    );
                  })
                )}
              </div>

              <p style={{ marginTop: 10, color: "#666" }}>
                Leyenda objetos: ❤️ vida · 🔫 balas · 🔭 binoculares · 🦺 chaleco · ⛽ bencina · 🏍️ moto · 🪤 trampa
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
