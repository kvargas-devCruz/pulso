import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulso · El estado de tu empresa, leído de tu correo",
  description:
    "Pulso lee el correo de tu pyme, te dice cómo está tu empresa y te avisa por WhatsApp cuando algo no cuadra.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
