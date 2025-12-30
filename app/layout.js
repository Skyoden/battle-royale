export const metadata = {
  title: "Battle Royale",
  description: "Juego estilo Mafia"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
