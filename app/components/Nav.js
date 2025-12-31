"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function BtnLink({ href, label, active }) {
  return (
    <Link
      href={href}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        textDecoration: "none",
        color: "#111",
        background: active ? "#f2f2f2" : "#fff",
        fontWeight: active ? 800 : 600,
      }}
    >
      {label}
    </Link>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isGm, setIsGm] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data: s } = await supabase.auth.getSession();
      const ok = !!s?.session;

      if (!mounted) return;
      setHasSession(ok);

      if (!ok) {
        setIsGm(false);
        setLoading(false);
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (!user) {
        setIsGm(false);
        setLoading(false);
        return;
      }

      const { data: p } = await supabase
        .from("players")
        .select("is_gm")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setIsGm(!!p?.is_gm);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Menú siempre visible (aunque estés en /login)
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: 12,
        borderBottom: "1px solid #eee",
        position: "sticky",
        top: 0,
        background: "#fff",
        zIndex: 10,
      }}
    >
      <div style={{ fontWeight: 900, marginRight: 10 }}>Battle Royale</div>

      <BtnLink href="/board" label="Tablero" active={pathname === "/board"} />
      <BtnLink href="/join" label="Unirse" active={pathname === "/join"} />
      <BtnLink href="/me" label="Mi cuenta" active={pathname === "/me"} />

      {/* GM link siempre visible (por si quieres crear partida desde otra cuenta) */}
      <BtnLink href="/gm" label="GM" active={pathname === "/gm"} />

      {/* Setup solo si realmente es GM */}
      {!loading && isGm && (
        <BtnLink href="/setup" label="Setup" active={pathname === "/setup"} />
      )}

      <div style={{ flex: 1 }} />

      {hasSession ? (
        <button
          onClick={logout}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Salir
        </button>
      ) : (
        <BtnLink href="/login" label="Login" active={pathname === "/login"} />
      )}
    </div>
  );
}
