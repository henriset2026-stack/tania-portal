"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";

/**
 * Entry route. Static export cannot redirect at the edge (no middleware,
 * no redirects config), so the decision is made in the browser.
 */
export default function Home() {
  const router = useRouter();
  const { loading, userId } = useSession();

  useEffect(() => {
    if (loading) return;
    router.replace(userId ? "/dashboard/" : "/login/");
  }, [loading, userId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">
      Memuat…
    </div>
  );
}
