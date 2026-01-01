"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function SetupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  const [requests, setRequests] = useState([]);
  const [dash, setDash] = useState(null);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ---- boot ----
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

      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (pErr) {
        setError(pErr.message);
        setLoading(false);
        return;
      }

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

      await refreshAll();
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function refreshRequests() {
    const { data, error: e } = await supabase.rpc("gm_list_move_requests");
    if (e) throw new Error(e.message);
    setRequests(data || []);
  }

  async function refreshDashboard() {
    const { data, error: e } = await supabase.rpc("gm_dashboard");
    if (e) throw new Error(e.message);
    // data ya viene como jsonb objeto
    setDash(data || null);
  }

  async function refreshAll() {
    setError("");
    try {
      await refreshRequests();
      await refreshDashboard();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function resolve(requestId, action) {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const { error: e } = await supabase.rpc("gm_resolve_move_request", {
        p_request_id: requestId,
        p_action: action, // 'approved' | 'rejected'
      });
      if (e) {
        setError(e.message);
        return;
      }
      await refreshAll();
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
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  // Inicia partida random + objetos (tu RPC ya existe)
  async function startGameWithObjects(itemsCount) {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const { data, error: e } = await supabase.rpc("gm_start_game", {
        p_items: Number(itemsCount || 12),
      });
      if (e) {
        setError(e.message);
        return;
      }
      // data puede venir como objeto o array
      const out = Array.isArray(data) ? data[0] : data;

      const playersCount = out?.players ?? out?.players_count ?? "?";
      const objectsCount = out?.objects ?? out?.objects_count ?? "?";

      setMsg(
        `✅ Partida iniciada.\nJugadores: ${playersCount}\nObjetos: ${objectsCount}\n(Se randomizaron posiciones y se repartieron objetos.)`
      );

      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  const players = dash?.players || [];
  const inventories = dash?.inventories || [];
  const objects = dash?.objects || [];

  function invForPlayer(playerId) {
    const rows = inventories.filter((x) => x.player_id === playerId && x.qty > 0);
    if (rows.length === 0) return "—";
    return rows.map((r) => `${r.object_type} x${r.qty}`).join(", ");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>Setup (GM)</h1>

      {loading && <p>Cargando…</p>}

      {!!error && (
        <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>Error: {error}</p>
      )}
      {!!msg && (
        <p style={{ color: "#1b4332", whiteSpace: "pre-wrap" }}>{msg}</p>
      )}

      {!loading && me && (
        <div style={{ marginTop: 12 }}>
          {/* CONTROLES */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={refreshAll}
              disabled={busy}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #bbb",
                cursor: busy ? "not-allowed" : "pointer",
                background: "#fff",
              }}
            >
              Refrescar
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

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#444" }}>
                Objetos:
              </span>
              <input
                type="number"
                min={0}
                defaultValue={12}
                id="itemsCount"
                style={{
                  width: 80,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #bbb",
                }}
              />
              <button
                onClick={() => {
                  const el = document.getElementById("itemsCount");
                  startGameWithObjects(el?.value || 12);
                }}
                disabled={busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #bbb",
                  cursor: busy ? "not-allowed" : "pointer",
                  background: "#fff",
                }}
              >
                Iniciar partida (random + objetos)
              </button>
            </div>
          </div>

          {/* SOLICITUDES */}
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
                  <div style={{ fontWeight: 800 }}>{r.player_name || "Player"}</div>
                  <div style={{ color: "#666", marginTop: 6 }}>
                    ({r.from_row ?? "?"},{r.from_col ?? "?"}) → ({r.to_row},{r.to_col})
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

          {/* DASHBOARD GM */}
          <h2 style={{ marginTop: 24, fontSize: 16 }}>Estado de jugadores</h2>

          <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
              <thead>
                <tr>
                  {["Nombre", "Vivo", "Vidas", "Balas", "Posición", "Inventario"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: 10,
                        borderBottom: "1px solid #eee",
                        fontSize: 13,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      <b>{p.name || "Player"}</b>
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {p.alive ? "Sí" : "No"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {p.lives ?? 0}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {p.bullets ?? 0}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      ({p.row ?? "?"},{p.col ?? "?"})
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {invForPlayer(p.id)}
                    </td>
                  </tr>
                ))}
                {players.length === 0 && (
                  <tr>
                    <td style={{ padding: 10, color: "#666" }} colSpan={6}>
                      No hay jugadores en esta partida.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: 24, fontSize: 16 }}>Objetos en el mapa</h2>

          <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
              <thead>
                <tr>
                  {["Fila", "Col", "Objeto", "Recogido por", "Recogido en"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: 10,
                        borderBottom: "1px solid #eee",
                        fontSize: 13,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {objects.map((o) => (
                  <tr key={o.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {o.row}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {o.col}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      <b>{o.object_type}</b>
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {o.claimed_by_name || "—"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                      {o.claimed_at ? new Date(o.claimed_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
                {objects.length === 0 && (
                  <tr>
                    <td style={{ padding: 10, color: "#666" }} colSpan={5}>
                      Aún no hay objetos creados para esta partida.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
