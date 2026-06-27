import type { Metadata } from "next";
import "./globals.css";
import AppNavbar from "@/components/AppNavbar";

export const metadata: Metadata = {
  title: "Tattoo Ticket Panel",
  description: "Tattoo studio ticket and appointment management panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}