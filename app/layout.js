import NavBar from "./components/NavBar";

export const metadata = {
  title: "Battle Royale",
  description: "Juego de tablero",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system" }}>
        <NavBar />
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
