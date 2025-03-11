import { useEffect, useRef, useState } from "react";

export const useTurnstile = ({
  siteKey,
  onSuccess,
}: {
  siteKey: string;
  onSuccess?: (token: string) => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || !(window as any).turnstile) return;

    const widgetId = (window as any).turnstile.render(ref.current, {
      sitekey: siteKey,
      callback: (newToken: string) => {
        setToken(newToken);
        onSuccess?.(newToken);
      },
    });

    return () => {
      if ((window as any).turnstile && widgetId) {
        (window as any).turnstile.remove(widgetId);
      }
    };
  }, [siteKey, onSuccess]);

  return { ref, token };
};
