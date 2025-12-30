"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function MePage() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || "");
    });
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Jugador</h1>
      {email ? <p>Conectado como: {email}</p> : <p>No estás logueado.</p>}
    </main>
  );
}
