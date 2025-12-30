"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const SYMBOL = {
  unknown: "?",
  empty: "X",
  corpse: "†",
  blocked: "⛔",
};

function Cell({ isMe, value, label }) {
  return (
    <div
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
  const [msg, setMsg] = useState("Cargando...");

  useEffect(() => {
    async function run() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setMsg("No estás logueado. Ve a /login");
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("id, name, row, col, game_id, alive, lives, is_gm")
        .maybeSingle();

      if (pErr) return setMsg(pErr.message);
      if (!p) return setMsg("No hay jugador creado. Ve a /me");
      if (!p.game_id) {
        setPlayer(p);
        return setMsg("Tu jugador no tiene game_id. Asócialo a una partida en Supabase.");
      }

      setPlayer(p);

      const { data: t, error: tErr } = await supabase
        .from("player_map_tiles")
        .select("row, col, tile_state")
        .eq("player_id", p.id)
        .eq("game_id", p.game_id);

      if (tErr) return setMsg(tErr.message);
      setTiles(t || []);
      setMsg("");
    }

    run();
  }, []);

  const size = 8;
  const key = (r, c) => `${r}-${c}`;
  const tileMap = new Map(tiles.map((t) => [key(t.row, t.col), t.tile_state]));

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Tablero 8×8</h1>

      {msg && (
        <p style={{ padding: 12, background: "#fff3cd", borderRadius: 8 }}>
          {msg}
        </p>
      )}

      {player && (
        <div style={{ marginBottom: 16 }}>
          <div><b>Jugador:</b> {player.name}</div>
          <div><b>Posición:</b> row {player.row}, col {player.col}</div>
          <div><b>Vidas:</b> {player.lives} — <b>Vivo:</b> {String(player.alive)}</div>
          <div><b>GM:</b> {String(player.is_gm)}</div>
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
        {Array.from({ length: size }).map((_, r) =>
          Array.from({ length: size }).map((__, c) => {
            const row = r + 1;
            const col = c + 1;
            const isMe = player && player.row === row && player.col === col;

            const state = tileMap.get(key(row, col)) || "unknown";
            const value = isMe ? "ME" : (SYMBOL[state] || "?");

            return (
              <Cell
                key={`${row}-${col}`}
                isMe={isMe}
                value={value}
                label={`(${row}, ${col}) state=${state}`}
              />
            );
          })
        )}
      </div>

      <div style={{ marginTop: 16, color: "#666" }}>
        <div><b>Leyenda:</b></div>
        <div>? = desconocido</div>
        <div>X = vacío</div>
        <div>† = cadáver</div>
        <div>⛔ = bloqueado (cataclismo)</div>
        <div style={{ marginTop: 8 }}>
          Nota: todavía no editamos estados desde la web. Eso es el paso siguiente.
        </div>
      </div>
    </main>
  );
}
