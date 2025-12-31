"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
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

      // asegura que exista players row
      await supabase.rpc("ensure_player");

      if (mounted) setLoading(false);
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleJoin() {
    setError("");
    setMsg("Uniéndote a la partida...");

    const clean = code.trim().toUpperCase();
    if (!clean) {
      setMsg("");
      setError("Ingresa un código.");
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("join_game_by_code", {
      p_code: clean,
    });

    if (rpcErr) {
      setMsg("");
      setError(rpcErr.message);
      return;
    }

    const out = Array.isArray(data) ? data[0] : data;

    if (!out?.game_id) {
      setMsg("");
      setError("No se pudo unir: el RPC no devolvió game_id.");
      return;
    }

    setMsg(`✅ Unido a la partida.\nGame ID: ${out.game_id}\nRedirigiendo al tablero...`);
    setTimeout(() => router.replace("/board"), 700);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Unirse a partida</h1>

      {loading && <p>Cargando…</p>}

      {!!error && (
        <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>
      )}
      {!!msg && (
        <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>
      )}

      {!loading && (
        <div style={{ marginTop: 14 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código (ej: ABC12)"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #bbb",
              width: 220,
              textTransform: "uppercase",
              letterSpacing: 2,
              marginRight: 10,
            }}
          />

          <button
            onClick={handleJoin}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #bbb",
              cursor: "pointer",
            }}
          >
            Unirme
          </button>

          <div style={{ marginTop: 16, color: "#666" }}>
            <p>El GM crea una partida en /gm y te comparte el código.</p>
            <p>Luego vuelves a /board para ver tu posición y tu mapa.</p>
          </div>
        </div>
      )}
    </main>
  );
}
