"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ isGm }) {
  const pathname = usePathname();

  const links = [
    { href: "/board", label: "Tablero" },
    { href: "/join", label: "Unirse" },
    { href: "/gm", label: "GM" },
    ...(isGm ? [{ href: "/setup", label: "Setup" }] : []),
    { href: "/me", label: "Mi cuenta" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        borderBottom: "1px solid #eee",
        padding: "10px 16px",
      }}
    >
      <div style={{ fontWeight: 900, marginRight: 8 }}>Battle Royale</div>

      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              textDecoration: "none",
              color: "#111",
              padding: "6px 10px",
              borderRadius: 10,
              border: active ? "1px solid #bbb" : "1px solid transparent",
              background: active ? "#f7f7f7" : "transparent",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
