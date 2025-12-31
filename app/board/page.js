"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// Mapea el estado a lo que se ve en el tablero
const SYMBOL = {
  unknown: "?",
  empty: "X",
  corpse: "†",
  blocked: "⛔",
  loot: "★",
};

function Cell({ isMe, value, label, onSet }) {
  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        if (e.shiftKey) onSet("blocked");
        else onSet("empty");
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onSet("corpse");
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        onSet("unknown");
      }}
      style={{
        width: 42,
        height: 42,
        border: "1px solid #333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        background: isMe ? "#2d6a4f" : "#111",
        color: isMe ? "#fff" : "#ddd",
        borderRadius: 6,
        cursor: "pointer",
        userSelect: "none",
      }}
      title={label}
    >
      {isMe ? "ME" : value}
    </div>
  );
}

export default function BoardPage() {
  const router = useRouter();

  const [player, setPlayer] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [myMove, setMyMove] = useState(null); // ✅ solicitud pendiente del jugador
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const size = 8;

  // Diccionario rápido para lookup de casillas
  const tilesByRC = useMemo(() => {
    const m = new Map();
    for (const t of tiles) m.set(`${t.row}-${t.col}`, t);
    return m;
  }, [tiles]);

  async function loadMyMove() {
    const { data, error } = await supabase.rpc("player_get_my_move");
    if (error) return; // si falla no bloqueamos el tablero
    const out = Array.isArray(data) ? data[0] : data;
    setMyMove(out || null);
  }

  async function requestMove(toRow, toCol) {
    setError("");
    setMsg("");

    const { error } = await supabase.rpc("player_request_move", {
      p_to_row: toRow,
      p_to_col: toCol,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setMsg(`✅ Movimiento solicitado a (${toRow}, ${toCol}). El GM debe aprobarlo.`);
    await loadMyMove();
  }

  async function refreshTiles(p) {
    const pl = p || player;
    if (!pl?.game_id) return;

    const { data: t, error: tErr } = await supabase
      .from("player_map_tiles")
      .select("*")
      .eq("player_id", pl.id)
      .eq("game_id", pl.game_id)
      .order("row", { ascending: true })
      .order("col", { ascending: true });

    if (tErr) {
      setError(tErr.message);
      return;
    }
    setTiles(t || []);
  }

  async function ensureMyMapExists(p) {
    // Crea las 64 casillas SOLO si aún no existen
    if (!p?.game_id) return;

    const { count, error: cErr } = await supabase
      .from("player_map_tiles")
      .select("id", { count: "exact", head: true })
      .eq("player_id", p.id)
      .eq("game_id", p.game_id);

    if (cErr) {
      setError(cErr.message);
      return;
    }

    // Si ya hay tiles (ej: 64) no hacemos nada
    if ((count || 0) > 0) return;

    const rows = [];
    for (let r = 1; r <= size; r++) {
      for (let c = 1; c <= size; c++) {
        rows.push({
          game_id: p.game_id,
          player_id: p.id,
          row: r,
          col: c,
          tile_state: "unknown",
        });
      }
    }

    // Insert normal (solo ocurre una vez)
    const { error: insErr } = await supabase.from("player_map_tiles").insert(rows);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    setMsg("Mapa personal creado automáticamente.");
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      setMsg("");

      // 1) Si no hay sesión, a /login
      const { data: s } = await supabase.auth.getSession();
      const hasSession = !!s?.session;
      if (!hasSession) {
        if (mounted) router.replace("/login");
        return;
      }

      // 2) Obtener user
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        if (mounted) {
          setError(authErr.message || "Error al obtener usuario");
          setLoading(false);
        }
        return;
      }

      const user = authData?.user;
      if (!user) {
        if (mounted) router.replace("/login");
        return;
      }

      // 3) Player row
      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr) {
        if (mounted) {
          setError(pErr.message);
          setLoading(false);
        }
        return;
      }

      if (!p) {
        if (mounted) {
          setError(
            "No existe registro en 'players' para este usuario. (Debería crearse automáticamente al registrarte.)"
          );
          setLoading(false);
        }
        return;
      }

      if (!mounted) return;
      setPlayer(p);

      // ✅ cargar solicitud pendiente (si existe)
      await loadMyMove();

      // 4) Si aún no estás en una partida, lo mostramos claramente (sin “anda a Supabase”)
      if (!p.game_id) {
        setTiles([]);
        setLoading(false);
        return;
      }

      // 5) A: autocrear mapa si no existe
      await ensureMyMapExists(p);

      // 6) cargar tiles
      await refreshTiles(p);

      if (mounted) setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function setTileState(row, col, state) {
    setError("");
    setMsg("");

    if (!player?.game_id) return;

    // ✅ Jugador: pedir movimiento (no revela info, solo manda coordenadas)
    if (!player?.is_gm) {
      await requestMove(row, col);
      return;
    }

    // ✅ GM: puede marcar su propio mapa personal (como antes)
    const { error: uErr } = await supabase
      .from("player_map_tiles")
      .update({ tile_state: state })
      .eq("player_id", player.id)
      .eq("game_id", player.game_id)
      .eq("row", row)
      .eq("col", col);

    if (uErr) {
      setError(uErr.message);
      return;
    }

    setTiles((prev) =>
      prev.map((t) =>
        t.row === row && t.col === col ? { ...t, tile_state: state } : t
      )
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system" }}>
      <h1 style={{ marginBottom: 8 }}>{player?.is_gm ? "GM" : "Tablero"}</h1>

      {loading && <p>Cargando…</p>}

      {!!error && (
        <p style={{ color: "crimson", marginTop: 12, whiteSpace: "pre-wrap" }}>
          Error: {error}
        </p>
      )}

      {!!msg && (
        <p style={{ color: "#1b4332", marginTop: 12, whiteSpace: "pre-wrap" }}>
          {msg}
        </p>
      )}

      {!loading && player && !player.game_id && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#444" }}>Aún no estás unido a una partida.</p>
          <p style={{ color: "#666" }}>
            Próximo paso: te voy a dejar una pantalla “Unirse a partida” con un
            código para que esto sea 100% automático (sin Supabase).
          </p>
        </div>
      )}

      {!loading && player?.game_id && (
        <div style={{ marginTop: 18 }}>
          {!player?.is_gm && (
            <div style={{ marginBottom: 12, color: "#444" }}>
              <p style={{ marginBottom: 6 }}>
                <b>Tu solicitud pendiente:</b>{" "}
                {myMove ? `(${myMove.to_row}, ${myMove.to_col})` : "ninguna"}
              </p>
              <p style={{ marginTop: 0, color: "#666" }}>
                Para pedir movimiento: haz click en una casilla del tablero.
                (El movimiento no se aplica hasta que el GM lo apruebe en /setup)
              </p>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${size}, 42px)`,
              gap: 6,
              padding: 12,
              background: "#000",
              borderRadius: 12,
              width: "fit-content",
            }}
          >
            {Array.from({ length: size }).map((_, r0) =>
              Array.from({ length: size }).map((__, c0) => {
                const row = r0 + 1;
                const col = c0 + 1;
                const t = tilesByRC.get(`${row}-${col}`);
                const state = t?.tile_state || "unknown";
                const value = SYMBOL[state] || "?";

                const isMe =
                  player?.row === row &&
                  player?.col === col &&
                  player?.alive === true;

                return (
                  <Cell
                    key={`${row}-${col}`}
                    isMe={isMe}
                    value={value}
                    label={`(${row}, ${col}) state=${state}`}
                    onSet={(newState) => setTileState(row, col, newState)}
                  />
                );
              })
            )}
          </div>

          <p style={{ marginTop: 12, color: "#666" }}>
            Controles (GM mapa personal): click = X, click derecho = †,
            Shift+click = ⛔, doble click = ?
            <br />
            Controles (Jugador): click en casilla = solicitar movimiento.
          </p>
        </div>
      )}
    </main>
  );
}
