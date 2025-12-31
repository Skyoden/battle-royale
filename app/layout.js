import "./globals.css";

export const metadata = {
  title: "Battle Royale",
  description: "Game",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
