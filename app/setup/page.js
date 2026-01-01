"use client";

import Nav from "../components/Nav";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [itemCount, setItemCount] = useState(12);

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

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        router.replace("/login");
        return;
      }

      const { data: p } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!p) {
        setError("No existe tu perfil en players.");
        setLoading(false);
        return;
      }

      if (!p.is_gm) {
        setError("No tienes permisos de GM.");
        setLoading(false);
        return;
      }

      if (!p.game_id) {
        setError("No tienes una partida activa.");
        setLoading(false);
        return;
      }

      setMe(p);
      setLoading(false);
      await refresh();
    }

    boot();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refresh() {
    setError("");
    const { data, error: e } = await supabase.rpc("gm_list_move_requests");
    if (e) {
      setError(e.message);
      return;
    }
    setRequests(data || []);
  }

  async function resolve(requestId, action) {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const { error: e } = await supabase.rpc("gm_resolve_move_request", {
        p_request_id: requestId,
        p_action: action,
      });
      if (e) {
        setError(e.message);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function applyAll() {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const { data, error: e } = await supabase.rpc("gm_apply_approved_moves");
      if (e) {
        setError(e.message);
        return;
      }
      setMsg(`✅ Movimientos aplicados: ${data ?? 0}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const { data, error: e } = await supabase.rpc("gm_start_game", {
        p_item_count: Number(itemCount) || 12,
      });
      if (e) {
        setError(e.message);
        return;
      }
      setMsg(
        `✅ Partida iniciada.\nJugadores: ${data?.players ?? "?"}\nObjetos: ${data?.items ?? "?"}\n(Se randomizaron posiciones y se repartieron objetos.)`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav isGm={true} />

      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ marginTop: 0 }}>Setup (GM)</h1>

        {loading && <p>Cargando…</p>}

        {!!error && (
          <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>
            Error: {error}
          </p>
        )}
        {!!msg && (
          <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>
        )}

        {!loading && me && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                onClick={refresh}
                disabled={busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #bbb",
                  cursor: busy ? "not-allowed" : "pointer",
                  background: "#fff",
                }}
              >
                Refrescar solicitudes
              </button>

              <button
                onClick={applyAll}
                disabled={busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #bbb",
                  cursor: busy ? "not-allowed" : "pointer",
                  background: "#fff",
                }}
              >
                Aplicar movimientos aprobados
              </button>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#666" }}>Objetos:</span>
                <input
                  value={itemCount}
                  onChange={(e) => setItemCount(e.target.value)}
                  style={{
                    width: 70,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #bbb",
                  }}
                />
                <button
                  onClick={startGame}
                  disabled={busy}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #bbb",
                    cursor: busy ? "not-allowed" : "pointer",
                    background: "#fff",
                    fontWeight: 700,
                  }}
                >
                  Iniciar partida (random + objetos)
                </button>
              </div>
            </div>

            <h2 style={{ marginTop: 18, fontSize: 16 }}>
              Solicitudes pendientes: {requests.length}
            </h2>

            {requests.length === 0 ? (
              <p style={{ color: "#666" }}>No hay solicitudes pendientes.</p>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {requests.map((r) => (
                  <div
                    key={r.request_id}
                    style={{
                      border: "1px solid #e5e5e5",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {r.player_name || "Player"}
                    </div>
                    <div style={{ color: "#666", marginTop: 6 }}>
                      ({r.from_row ?? "?"},{r.from_col ?? "?"}) → ({r.to_row},
                      {r.to_col})
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <button
                        onClick={() => resolve(r.request_id, "approved")}
                        disabled={busy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #bbb",
                          cursor: busy ? "not-allowed" : "pointer",
                          background: "#fff",
                        }}
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => resolve(r.request_id, "rejected")}
                        disabled={busy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #bbb",
                          cursor: busy ? "not-allowed" : "pointer",
                          background: "#fff",
                        }}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
