"use client";

let resolver = Promise.withResolvers<string>();

if (typeof window !== "undefined") {
  (window as any).__onTurnstileSuccess = (token: string) => {
    resolver.resolve(token);
  };
}

export const getTurnstileToken = (): Promise<string> => resolver.promise;
