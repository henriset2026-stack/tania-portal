import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { Copilot } from "@/components/copilot";

export const metadata: Metadata = {
  title: "TANIA — Portal Digital Product & Solution",
  description:
    "Portal internal Chapter Product & Solution (DPS), Digital Product, Telkom Indonesia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full">
        <SessionProvider>
          {children}
          {/* Present on every signed-in page; renders nothing when signed out. */}
          <Copilot />
        </SessionProvider>
      </body>
    </html>
  );
}
