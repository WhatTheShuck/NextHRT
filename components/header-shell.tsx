"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Client wrapper around the (server-rendered) header content. Hides the sticky
 * header when scrolling down and reveals it when scrolling up — mainly a mobile
 * / very-tall-page nicety. The header content is passed as children so the
 * server components inside (ProfileButton) keep rendering on the server.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      // Ignore tiny scrolls and always show near the top of the page.
      if (Math.abs(delta) > 6) {
        // Hide on downward scroll once past the header's own height; show on up.
        setHidden(delta > 0 && y > 64);
        lastY.current = y;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60",
        "transition-transform duration-300 ease-in-out",
        hidden && "-translate-y-full",
      )}
    >
      <div className="max-w-screen-2xl mx-auto px-4 flex h-16 items-center justify-between">
        {children}
      </div>
    </header>
  );
}
