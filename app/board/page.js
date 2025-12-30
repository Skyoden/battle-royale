"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function Cell({ isMe, label }) {
  return (
    <div
      style={{
        width: 42,
        height: 42,
        border: "1px solid #333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        background: isMe ? "#2d6a4f" : "#111",
        color: isMe ? "#fff" : "#ddd",
        borderRadius: 6,
        userSelect: "none",
      }}
      title={label}
    >
      {isMe ? "ME" : ""}
    </div>
  );
}

export default function BoardPage() {
  const [player, setPlayer] = useState(null);
  const [msg, setMsg] = useState("Cargando...");

  useEffect(() => {
    async function run() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setMsg("No estás logueado. Ve a /login");
        return;
      }

      const { data, error } = await supabase
        .from("players")
        .select("id, name, row, col, game_id, alive, lives, is_gm")
        .maybeSingle();

      if (error) {
        setMsg(error.message);
        return;
      }
      if (!data) {
        setMsg("No hay jugador creado. Ve a /me y crea tu player.");
        return;
      }
      if (!data.game_id) {
        setMsg("Tu jugador no tiene game_id. Asócialo a una partida en Supabase.");
        setPlayer(data);
        return;
      }
      if (data.row == null || data.col == null) {
        setMsg("Tu jugador no tiene posición (row/col). Asigna row/col en Supabase.");
        setPlayer(data);
        return;
      }

      setPlayer(data);
      setMsg("");
    }
    run();
  }, []);

  const size = 8;

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
            return (
              <Cell
                key={`${row}-${col}`}
                isMe={isMe}
                label={`(${row}, ${col})`}
              />
            );
          })
        )}
      </div>

      <p style={{ marginTop: 16, color: "#666" }}>
        Nota: por ahora solo mostramos tu posición. Después agregamos objetos, cadáveres y niebla.
      </p>
    </main>
  );
}
