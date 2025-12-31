"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setMessage("Iniciando sesión...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    // ✅ Asegura que exista fila en players
    const { error: ensureErr } = await supabase.rpc("ensure_player");
    if (ensureErr) {
      setMessage(ensureErr.message);
      return;
    }

    router.replace("/board");
  }

  async function handleSignup() {
    setMessage("Creando usuario...");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    // ⚠️ Puede que no haya sesión inmediata si hay confirmación por email
    // Igual intentamos asegurar el player (si no hay sesión, no pasa nada grave)
    await supabase.rpc("ensure_player");

    router.replace("/board");
  }

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Login</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 10 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 10 }}
      />

      <button onClick={handleLogin}>Login</button>
      <button onClick={handleSignup} style={{ marginLeft: 10 }}>
        Sign up
      </button>

      {message && <p>{message}</p>}
    </main>
  );
}
