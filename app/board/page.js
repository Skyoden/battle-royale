"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// Mapea el estado a lo que se ve en el tablero
const SYMBOL = {
  unknown: "?",
  empty: "X",
  corpse: "†",
  blocked: "⛔",
};

function Cell({ isMe, value, label, onSet }) {
  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        if (e.shiftKey) onSet("blocked");
        else onSet("empty");
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onSet("corpse");
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        onSet("unknown");
      }}
      style={{
        width: 42,
        height: 42,
        border: "1px solid #333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        background: isMe ? "#2d6a4f" : "#111",
        color: isMe ? "#fff" : "#ddd",
        borderRadius: 6,
        cursor: "pointer",
        userSelect: "none",
      }}
      title={label}
    >
      {value}
    </div>
  );
}

export default function BoardPage() {
  const [player, setPlayer] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const size = 8;

  // Diccionario rápido para lookup de casillas
  const tilesByRC = useMemo(() => {
    const m = new Map();
    for (const t of tiles) m.set(`${t.row}-${t.col}`, t);
    return m;
  }, [tiles]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      setMsg("");

      // 1) Usuario autenticado
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        if (mounted) {
          setError(authErr.message || "Error al obtener usuario");
          setLoading(false);
        }
        return;
      }

      const user = authData?.user;
      if (!user) {
        if (mounted) {
          setError("No estás logueado");
          setLoading(false);
        }
        return;
      }

      // 2) Player row (debe existir ya en tu app)
      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr) {
        if (mounted) {
          setError(pErr.message);
          setLoading(false);
        }
        return;
      }

      if (!p) {
        if (mounted) {
          setError(
            "No existe registro en 'players' para este usuario. (Tu /me suele crearlo automáticamente.)"
          );
          setLoading(false);
        }
        return;
      }

      if (mounted) setPlayer(p);

      // 3) Si aún no hay game_id, mostramos mensaje
      if (!p.game_id) {
        if (mounted) {
          setTiles([]);
          setLoading(false);
        }
        return;
      }

      // 4) Cargar tiles del mapa personal
      const { data: t, error: tErr } = await supabase
