"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SetupPage() {
  const [msg, setMsg] = useState("");
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    async function run() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setMsg("No estás logueado. Ve a /login");
        return;
      }

      const { data: p, error } = await supabase
        .from("players")
        .select("id, game_id, is_gm")
        .maybeSingle();

      if (error) return setMsg(error.message);
      if (!p) return setMsg("No hay player. Ve a /me");
      if (!p.game_id) return setMsg("Tu player no tiene game_id (asócialo a una partida).");
      if (!p.is_gm) return setMsg("Solo GM puede usar /setup por ahora.");

      setPlayer(p);
      setMsg("");
    }
    run();
  }, []);

  async function initMyMap() {
    if (!player) return;

    setMsg("Creando 64 casillas en tu mapa personal...");

    const rows = [];
    for (let r = 1; r <= 8; r++) {
      for (let c = 1; c <= 8; c++) {
        rows.push({
          player_id: player.id,
          game_id: player.game_id,
          row: r,
          col: c,
          tile_state: "unknown", // unknown | empty | corpse | blocked
        });
      }
    }

    const { error } = await supabase.from("player_map_tiles").insert(rows);

    if (error) setMsg("Error: " + error.message);
    else setMsg("Listo ✅ Tu mapa personal fue inicializado (64 casillas).");
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Setup (GM)</h1>
      {msg && <p>{msg}</p>}

      {player && (
        <>
          <p>
            Esto crea tu mapa personal en <code>player_map_tiles</code> con 64 casillas
            en estado <b>unknown</b>.
          </p>
          <button onClick={initMyMap}>Inicializar mi mapa</button>
        </>
      )}
    </main>
  );
}
