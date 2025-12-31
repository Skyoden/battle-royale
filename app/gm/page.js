"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function makeCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function GMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

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

      const { data: p } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!p) {
        setError("No existe tu perfil en players.");
        setLoading(false);
        return;
      }

      setPlayer(p);
      setLoading(false);
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function createGame() {
    setError("");
    setMsg("Creando partida...");

    // 1) crear game
    const code = makeCode(5);

    const { data: g, error: gErr } = await supabase
      .from("games")
      .insert({ code, size: 8, phase: "setup" })
      .select("*")
      .single();

    if (gErr) {
      setError(gErr.message);
      setMsg("");
      return;
    }

    // 2) asignar este player como GM y unirlo al game
    const { error: pErr } = await supabase
      .from("players")
      .update({
        game_id: g.id,
        is_gm: true,
        alive: true,
        lives: 2,
        row: 1,
        col: 1,
      })
      .eq("id", player.id);

    if (pErr) {
      setError(pErr.message);
      setMsg("");
      return;
    }

    setMsg(`✅ Partida creada.\nCódigo: ${g.code}\nAhora comparte este código a tus amigos.`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>GM</h1>

      {loading && <p>Cargando…</p>}

      {!!error && <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>}
      {!!msg && <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>}

      {!loading && player && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={createGame}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #bbb",
              cursor: "pointer",
            }}
          >
            Crear nueva partida (GM)
          </button>

          <div style={{ marginTop: 16, color: "#666" }}>
            <p>Luego tus amigos van a /join y ponen el código.</p>
            <p>Tú como GM vas a /board para ver tu tablero.</p>
          </div>
        </div>
      )}
    </main>
  );
}
