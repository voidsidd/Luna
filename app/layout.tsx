import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { TaskProvider } from "@/components/TaskProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Priority Manager",
  description: "An adaptive task and deadline manager built around what to do next."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TaskProvider>
          {children}
        </TaskProvider>
        <Analytics />
      </body>
    </html>
  );
}
