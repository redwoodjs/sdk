"use client";

import { useRef, useCallback } from "react";
import { IS_DEV } from "../../constants";

export function useTurnstile(siteKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resolverRef = useRef(Promise.withResolvers<string>());
  const widgetIdRef = useRef<string | null>(null);

  const challenge = useCallback(async () => {
    if (
      !widgetIdRef.current &&
      containerRef.current &&
      (window as any).turnstile
    ) {
      widgetIdRef.current = (window as any).turnstile.render(
        containerRef.current,
        {
          sitekey: IS_DEV ? "1x00000000000000000000AA" : siteKey,
          callback: (token: string) => resolverRef.current.resolve(token),
        },
      );
    }

    return resolverRef.current.promise;
  }, [siteKey]);

  return {
    ref: containerRef,
    challenge,
  };
}
