"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function GMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

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

      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u?.user) {
        router.replace("/login");
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (pErr) {
        setError(pErr.message);
        setLoading(false);
        return;
      }

      if (!p) {
        setError("No existe tu perfil en 'players'. Ve a /me para crearlo.");
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

  async function refreshPlayer() {
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return;

    const { data: p } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (p) setPlayer(p);
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
      const gameId = out?.game_id || out?.id;

      if (!code || !gameId) {
        setError("El RPC no devolvió { game_id, code }.");
        return;
      }

      setMsg(`✅ Partida creada.\nCódigo: ${code}\nComparte este código a tus amigos.`);
      await refreshPlayer();
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>GM</h1>

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
          <button
            onClick={() => router.push("/join")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #bbb",
              cursor: "pointer",
            }}
          >
            Ir a Unirse a partida
          </button>
        </div>
      )}

      {!loading && player && player.is_gm && (
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
            }}
          >
            {creating ? "Creando..." : "Crear nueva partida (GM)"}
          </button>

          <div style={{ marginTop: 16, color: "#666" }}>
            <p>Luego tus amigos van a /join y ponen el código.</p>
            <p>Tú como GM vas a /setup y /board.</p>
            {!!player?.game_id && (
              <p>
                Tu game_id actual: <b>{player.game_id}</b>
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
