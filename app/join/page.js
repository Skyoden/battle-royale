"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s?.session) router.replace("/login");
    })();
  }, [router]);

  async function join() {
    setError("");
    setMsg("");
    setJoining(true);

    try {
      const clean = code.trim().toUpperCase();

      const { error: rpcErr } = await supabase.rpc("join_game", {
        p_code: clean,
      });

      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }

      setMsg("✅ Entraste a la partida. Te llevo al tablero…");
      setTimeout(() => router.push("/board"), 600);
    } finally {
      setJoining(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Join</h1>

      {!!error && <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>}
      {!!msg && <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>}

      <div style={{ marginTop: 12 }}>
        <p style={{ color: "#666" }}>Pega el código de la partida:</p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ej: ABC12"
          style={{
            display: "block",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #bbb",
            width: 220,
            marginTop: 8,
            textTransform: "uppercase",
          }}
        />

        <button
          onClick={join}
          disabled={joining || code.trim().length < 4}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #bbb",
            cursor: joining ? "not-allowed" : "pointer",
            opacity: joining ? 0.7 : 1,
          }}
        >
          {joining ? "Uniendo..." : "Unirme"}
        </button>
      </div>
    </main>
  );
}
