import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOBBYMP Portal | Hon. Kwabena Okyere Darko-Mensah",
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
      <body className="antialiased bg-[#fbf9f5] text-stone-800 min-h-screen selection:bg-amber-100 selection:text-stone-900">
        {children}
      </body>
    </html>
  );
}
