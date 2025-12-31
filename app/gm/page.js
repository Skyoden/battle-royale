"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function initials(name) {
  const s = (name || "Player").trim();
  if (!s) return "P";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "P";
}

export default function GMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const size = 8;

  const playersByCell = useMemo(() => {
    const m = new Map();
    for (const p of players) {
      if (p.row && p.col) {
        const key = `${p.row}-${p.col}`;
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(p);
      }
    }
    return m;
  }, [players]);

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

      setPlayer(p);
      setLoading(false);

      if (p.is_gm && p.game_id) {
        await loadPlayers();
      }
    }

    boot();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadPlayers() {
    setError("");
    const { data, error: rpcErr } = await supabase.rpc("gm_get_players");
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setPlayers(data || []);
  }

  async function createGame() {
    setError("");
    setMsg("");
    setCreating(true);

    try {
      const { data, error: rpcErr } = await supabase.rpc("create_game", {
        p_name: "Partida 1",
      });

      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }

      const out = Array.isArray(data) ? data[0] : data;
      const code = out?.code;
      const gameId = out?.game_id;

      if (!code || !gameId) {
        setError("El RPC no devolvió { game_id, code }.");
        return;
      }

      setMsg(`✅ Partida creada.\nCódigo: ${code}\nComparte este código a tus amigos.`);

      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (user) {
        const { data: p2 } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (p2) setPlayer(p2);
      }

      await loadPlayers();
    } finally {
      setCreating(false);
    }
  }

  async function setPlayerPos(playerId, row, col) {
    setError("");
    setMsg("");

    const { error: rpcErr } = await supabase.rpc("gm_set_player_pos", {
      p_player_id: playerId,
      p_row: row,
      p_col: col,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, row, col } : p))
    );
  }

  function onDragStart(e, p) {
    e.dataTransfer.setData("text/playerId", p.id);
  }

  function onDropCell(e, row, col) {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/playerId");
    if (!playerId) return;
    setPlayerPos(playerId, row, col);
  }

  function allowDrop(e) {
    e.preventDefault();
  }

  return (
    <main style={{ padding: 0, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>GM</h1>

      {loading && <p>Cargando…</p>}

      {!!error && (
        <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>
      )}
      {!!msg && (
        <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>
      )}

      {!loading && player && !player.is_gm && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "crimson" }}>No tienes permisos de GM en esta cuenta.</p>
        </div>
      )}

      {!loading && player && player.is_gm && !player.game_id && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={createGame}
            disabled={creating}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #bbb",
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.7 : 1,
              background: "#fff",
            }}
          >
            {creating ? "Creando..." : "Crear nueva partida (GM)"}
          </button>
        </div>
      )}

      {!loading && player && player.is_gm && player.game_id && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            gap: 16,
            marginTop: 14,
          }}
        >
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Jugadores ({players.length})</h2>
              <button
                onClick={loadPlayers}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #bbb",
                  cursor: "pointer",
                  background: "#fff",
                  fontSize: 12,
                }}
              >
                Refrescar
              </button>
            </div>

            <p style={{ marginTop: 10, marginBottom: 10, color: "#666", fontSize: 13 }}>
              Arrastra un jugador y suéltalo en una casilla.
            </p>

            <div style={{ display: "grid", gap: 8 }}>
              {players.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, p)}
                  style={{
                    padding: "10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    cursor: "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        background: "#fff",
                      }}
                    >
                      {initials(p.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name || "Player"}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        ({p.row ?? "?"},{p.col ?? "?"}) · {p.alive ? "Vivo" : "Muerto"} · vidas {p.lives ?? 0}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: "#999" }}>⠿</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
              overflowX: "auto",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Tablero completo (GM)</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${size}, 56px)`,
                gap: 8,
                padding: 8,
                background: "#111",
                borderRadius: 12,
                width: "fit-content",
              }}
            >
              {Array.from({ length: size }).map((_, r0) =>
                Array.from({ length: size }).map((__, c0) => {
                  const row = r0 + 1;
                  const col = c0 + 1;
                  const key = `${row}-${col}`;
                  const here = playersByCell.get(key) || [];

                  return (
                    <div
                      key={key}
                      onDragOver={allowDrop}
                      onDrop={(e) => onDropCell(e, row, col)}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        border: "1px solid #333",
                        background: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        color: "#fff",
                        userSelect: "none",
                      }}
                      title={`(${row},${col})`}
                    >
                      <div style={{ position: "absolute", top: 6, left: 8, fontSize: 11, color: "#777" }}>
                        {row},{col}
                      </div>

                      {here.length === 0 ? (
                        <div style={{ color: "#333", fontWeight: 800 }}>·</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                          {here.slice(0, 3).map((p) => (
                            <div
                              key={p.id}
                              style={{
                                padding: "4px 6px",
                                borderRadius: 8,
                                background: p.alive ? "#2d6a4f" : "#6c757d",
                                fontSize: 12,
                                fontWeight: 800,
                                border: "1px solid #333",
                              }}
                              title={p.name || "Player"}
                            >
                              {initials(p.name)}
                            </div>
                          ))}
                          {here.length > 3 && (
                            <div style={{ fontSize: 12, color: "#bbb", fontWeight: 800 }}>
                              +{here.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
