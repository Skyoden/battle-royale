"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";


// Mapea el estado a lo que se ve en el tablero
const SYMBOL = {
  unknown: "?",
  empty: "X",
  corpse: "†",
  blocked: "⛔",
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
      {value}
    </div>
  );
}

export default function BoardPage() {
  const [player, setPlayer] = useState(null);
  const [tiles, setTiles] = useState([]);
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

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      setMsg("");

      // 1) Usuario autenticado
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
        if (mounted) {
          setError("No estás logueado");
          setLoading(false);
        }
        return;
      }

      // 2) Player row (debe existir ya en tu app)
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
            "No existe registro en 'players' para este usuario. (Tu /me suele crearlo automáticamente.)"
          );
          setLoading(false);
        }
        return;
      }

      if (mounted) setPlayer(p);

      // 3) Si aún no hay game_id, mostramos mensaje
      if (!p.game_id) {
        if (mounted) {
          setTiles([]);
          setLoading(false);
        }
        return;
      }

      // 4) Cargar tiles del mapa personal
      const { data: t, error: tErr } = await supabase
        .from("player_map_tiles")
        .select("*")
        .eq("player_id", p.id)
        .eq("game_id", p.game_id)
        .order("row", { ascending: true })
        .order("col", { ascending: true });

      if (tErr) {
        if (mounted) {
          setError(tErr.message);
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setTiles(t || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function refreshTiles() {
    if (!player?.game_id) return;
    const { data: t, error: tErr } = await supabase
      .from("player_map_tiles")
      .select("*")
      .eq("player_id", player.id)
      .eq("game_id", player.game_id)
      .order("row", { ascending: true })
      .order("col", { ascending: true });

    if (tErr) {
      setError(tErr.message);
      return;
    }
    setTiles(t || []);
  }

  async function initMyMap() {
    setError("");
    setMsg("");

    if (!player?.game_id) {
      setError(
        "Tu player aún no tiene game_id. Asigna game_id en la tabla players (para este jugador) y recarga."
      );
      return;
    }

    // inserta 64 casillas unknown (si no existen)
    const rows = [];
    for (let r = 1; r <= size; r++) {
      for (let c = 1; c <= size; c++) {
        rows.push({
          game_id: player.game_id,
          player_id: player.id,
          row: r,
          col: c,
          tile_state: "unknown",
        });
      }
    }

    // upsert para que puedas apretar varias veces sin romper
    const { error: upErr } = await supabase
      .from("player_map_tiles")
      .upsert(rows, { onConflict: "game_id,player_id,row,col" });

    if (upErr) {
      setError(upErr.message);
      return;
    }

    setMsg("Listo tu mapa personal fue inicializado (64 casillas)");
    await refreshTiles();
  }

  async function setTileState(row, col, state) {
    setError("");
    setMsg("");

    // Por ahora: solo GM edita el mapa (si quieres que todos editen su mapa, borra este if)
    if (!player?.is_gm) return;

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
      <h1 style={{ marginBottom: 8 }}>
        {player?.is_gm ? "Setup (GM)" : "Tablero"}
      </h1>

      {loading && <p>Cargando…</p>}

      {!loading && !player && (
        <p style={{ color: "crimson" }}>
          No se pudo cargar tu perfil de jugador.
        </p>
      )}

      {!loading && player && !player.game_id && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#444" }}>
            Tu jugador no tiene <b>game_id</b> asignado todavía.
          </p>
          <p style={{ color: "#444" }}>
            Solución rápida: en Supabase → tabla <b>players</b> → edita tu fila y
            pega el <b>id</b> de la partida (tabla <b>games</b>) en <b>game_id</b>.
            Luego recarga esta página.
          </p>
        </div>
      )}

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

      {!loading && player?.game_id && (
        <div style={{ marginTop: 12 }}>
          <p style={{ marginBottom: 8, color: "#444" }}>
            Esto crea tu mapa personal en <b>player_map_tiles</b> con 64 casillas en
            estado <b>unknown</b>.
          </p>
          <button
            onClick={initMyMap}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #bbb",
              cursor: "pointer",
            }}
          >
            Inicializar mi mapa
          </button>

          <div style={{ marginTop: 18 }}>
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

                  // Por ahora solo resaltamos tu posición si existe
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
              Controles: click = X, click derecho = †, Shift+click = ⛔, doble click = ?
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
