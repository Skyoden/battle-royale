"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ isGm = false }) {
  const path = usePathname();

  const Item = ({ href, label }) => (
    <Link
      href={href}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #ddd",
        textDecoration: "none",
        color: path === href ? "#111" : "#444",
        background: path === href ? "#fff" : "#fafafa",
        fontWeight: path === href ? 800 : 600,
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <Item href="/board" label="Tablero" />
      <Item href="/me" label="Mi cuenta" />
      {!isGm && <Item href="/join" label="Unirse" />}
      {isGm && <Item href="/gm" label="GM" />}
      {isGm && <Item href="/setup" label="Setup" />}
    </div>
  );
}
