import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { CopilotProvider } from "@/components/copilot";

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
          {/* Wraps the tree so any page can open the Copilot, not just its
              own launcher button. Renders nothing when signed out. */}
          <CopilotProvider>{children}</CopilotProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
