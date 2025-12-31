"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Cargando...");

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const { data: s } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!s?.session) {
        setStatus("No estás logueado.");
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (!user) {
        setStatus("No estás logueado.");
        return;
      }

      const { data: p, error } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setStatus("Error cargando perfil.");
        return;
      }

      if (!p) {
        setStatus("Creando tu perfil...");
        router.replace("/me");
        return;
      }

      if (p.is_gm) {
        setStatus("Eres GM. Te llevo a GM.");
        router.replace("/gm");
        return;
      }

      if (!p.game_id) {
        setStatus("Aún no estás en partida. Te llevo a Unirse.");
        router.replace("/join");
        return;
      }

      setStatus("Ya estás en partida. Te llevo al tablero.");
      router.replace("/board");
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Battle Royale</h1>
      <p style={{ color: "#666" }}>{status}</p>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => router.push("/login")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #bbb",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          Login
        </button>
        <button
          onClick={() => router.push("/join")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #bbb",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          Unirse a partida
        </button>
        <button
          onClick={() => router.push("/gm")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #bbb",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          Soy GM
        </button>
        <button
          onClick={() => router.push("/board")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #bbb",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          Ir al tablero
        </button>
      </div>
    </main>
  );
}
