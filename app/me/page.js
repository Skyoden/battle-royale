"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function MePage() {
  const [email, setEmail] = useState("");
  const [player, setPlayer] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function run() {
      const { data: userData } = await supabase.auth.getUser();
      setEmail(userData?.user?.email || "");

      const { data, error } = await supabase
        .from("players")
        .select("*")
        .maybeSingle();

      if (error) setMsg(error.message);
      else if (!data) setMsg("No hay jugador creado aún en tabla players.");
      else setPlayer(data);
    }
    run();
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Mi cuenta</h1>
      <p>Email: {email || "(no logueado)"}</p>

      {msg && <p>{msg}</p>}

      {player && (
        <pre style={{ background: "#111", color: "#0f0", padding: 12 }}>
          {JSON.stringify(player, null, 2)}
        </pre>
      )}
    </main>
  );
}
