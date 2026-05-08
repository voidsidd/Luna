import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Priority Manager",
  description: "An adaptive task and deadline manager built around what to do next."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
