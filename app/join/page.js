"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: s } = await supabase.auth.getSession();
      if (!s?.session) {
        router.replace("/login");
        return;
      }
      setLoading(false);
    }
    check();
  }, [router]);

  async function joinGame() {
    setError("");
    setMsg("Uniéndome a la partida...");

    const c = code.trim().toUpperCase();
    if (!c) {
      setError("Escribe el código.");
      setMsg("");
      return;
    }

    // usamos RPC join_game que ya tienes (la función en Supabase)
    const { data, error: rErr } = await supabase.rpc("join_game", {
      p_code: c,
      p_size: 8,
    });

    if (rErr) {
      setError(rErr.message);
      setMsg("");
      return;
    }

    setMsg("✅ Unido. Abriendo tablero...");
    router.replace("/board");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Unirse a partida</h1>

      {loading && <p>Cargando…</p>}

      {!loading && (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código (ej: A7K3Q)"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
          />
          <button
            onClick={joinGame}
            style={{
              marginLeft: 10,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #bbb",
              cursor: "pointer",
            }}
          >
            Entrar
          </button>

          {!!error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
          {!!msg && <p style={{ color: "#1b4332", marginTop: 12 }}>{msg}</p>}

          <p style={{ marginTop: 16, color: "#666" }}>
            Si no tienes cuenta, ve a /login primero.
          </p>
        </>
      )}
    </main>
  );
}
