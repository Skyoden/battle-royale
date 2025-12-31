"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let ignore = false;

    async function go() {
      const { data, error } = await supabase.auth.getSession();

      // si algo falla, igual mandamos a login
      if (ignore) return;

      const hasSession = !!data?.session;
      router.replace(hasSession ? "/board" : "/login");
    }

    go();

    return () => {
      ignore = true;
    };
  }, [router]);

  // “pantalla de carga” breve mientras decide
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ margin: 0 }}>Battle Royale</h1>
      <p style={{ opacity: 0.7 }}>Redirigiendo…</p>
    </main>
  );
}
