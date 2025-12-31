import "./globals.css";
import Nav from "./components/Nav";

export const metadata = {
  title: "Battle Royale",
  description: "Battle Royale",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        <div style={{ padding: 24 }}>{children}</div>
      </body>
    </html>
  );
}
