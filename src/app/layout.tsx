import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOBBYMP SMS Portal | Hon. Kwabena Okyere Darko-Mensah",
  description: "Official Bulk SMS Messaging & Constituency Engagement System for Hon. Kwabena Okyere Darko-Mensah, MP for Takoradi.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-900 text-slate-100 min-h-screen selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
