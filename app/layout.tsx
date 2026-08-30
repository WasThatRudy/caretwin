import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareTwin — Live Elderly Digital Twin",
  description: "Generative-AI digital twin for real-time elderly health monitoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
