"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setEmail(data?.user?.email || "");
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const linkStyle = (href) => ({
    padding: "8px 10px",
    borderRadius: 10,
    textDecoration: "none",
    border: pathname === href ? "1px solid #999" : "1px solid transparent",
    color: "#111",
    background: pathname === href ? "#f2f2f2" : "transparent",
  });

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "#fff",
        borderBottom: "1px solid #e5e5e5",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/" style={{ ...linkStyle("/"), fontWeight: 800 }}>
            Battle Royale
          </Link>
          <Link href="/board" style={linkStyle("/board")}>
            Tablero
          </Link>
          <Link href="/join" style={linkStyle("/join")}>
            Unirse
          </Link>
          <Link href="/gm" style={linkStyle("/gm")}>
            GM
          </Link>
          <Link href="/me" style={linkStyle("/me")}>
            Mi cuenta
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {email ? (
            <>
              <span style={{ fontSize: 13, color: "#666" }}>{email}</span>
              <button
                onClick={logout}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #bbb",
                  cursor: "pointer",
                  background: "#fff",
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <Link href="/login" style={linkStyle("/login")}>
              Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
