"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function MePage() {
  const [email, setEmail] = useState("");
  const [player, setPlayer] = useState(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setMsg("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        if (mounted) setMsg("No estás logueado.");
        return;
      }

      if (mounted) setEmail(user.email || "");

      await supabase.rpc("ensure_player");

      const { data, error } = await supabase
        .from("players")
        .select("id,name,is_gm,alive,lives,game_id,row,col")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setMsg(error.message);
        return;
      }

      if (!data) {
        setMsg("No existe tu jugador en players.");
        return;
      }

      setPlayer(data);
      setName(data.name || "");
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveName() {
    setMsg("");
    setSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setMsg("No estás logueado.");
        return;
      }

      // 🔒 Si ya tiene nombre, no permitir cambiarlo
      if (player?.name && player.name.trim().length > 0) {
        setMsg("Tu nombre ya está definido y no se puede cambiar.");
        return;
      }

      const clean = name.trim();
      if (clean.length < 2) {
        setMsg("El nombre debe tener al menos 2 caracteres.");
        return;
      }
      if (clean.length > 24) {
        setMsg("El nombre debe tener máximo 24 caracteres.");
        return;
      }

      const { error } = await supabase
        .from("players")
        .update({ name: clean })
        .eq("user_id", user.id)
        .is("name", null); // 🔒 Solo actualiza si name aún es NULL

      if (error) {
        setMsg(error.message);
        return;
      }

      setPlayer((p) => (p ? { ...p, name: clean } : p));
      setMsg("✅ Nombre guardado (ya no podrás cambiarlo).");
    } finally {
      setSaving(false);
    }
  }

  const nameLocked = !!(player?.name && player.name.trim().length > 0);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Mi cuenta</h1>

      <div style={{ marginTop: 10, color: "#444" }}>
        <p>
          <b>Email:</b> {email || "(no logueado)"}
        </p>
      </div>

      {!!msg && (
        <p style={{ marginTop: 12, color: msg.includes("✅") ? "#1b4332" : "crimson" }}>
          {msg}
        </p>
      )}

      {player && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            background: "#fff",
            maxWidth: 520,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>
            Perfil de jugador
          </h2>

          <label style={{ display: "block", marginBottom: 8, color: "#444" }}>
            Nombre visible {nameLocked ? "(bloqueado)" : "(elige una vez)"}
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              disabled={nameLocked}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #bbb",
                width: 260,
                opacity: nameLocked ? 0.7 : 1,
              }}
            />

            <button
              onClick={saveName}
              disabled={saving || nameLocked}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #bbb",
                cursor: saving || nameLocked ? "not-allowed" : "pointer",
                opacity: saving || nameLocked ? 0.7 : 1,
              }}
            >
              {nameLocked ? "Bloqueado" : saving ? "Guardando..." : "Guardar"}
            </button>
          </div>

          <div style={{ marginTop: 14, color: "#444", lineHeight: 1.6 }}>
            <p>
              <b>Rol:</b> {player.is_gm ? "GM" : "Jugador"}
            </p>
            <p>
              <b>Estado:</b> {player.alive ? "Vivo" : "Muerto"}
            </p>
            <p>
              <b>En partida:</b> {player.game_id ? "Sí" : "No"}
            </p>
          </div>

          {player.game_id && (
            <div style={{ marginTop: 8, color: "#666" }}>
              <p style={{ marginBottom: 0 }}>
                <b>Posición actual:</b> ({player.row}, {player.col})
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
