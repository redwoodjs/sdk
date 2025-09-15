export const verifyTurnstileToken = async ({
  token,
  secretKey,
  fetchFn = fetch,
}: {
  token: string;
  secretKey: string;
  fetchFn?: typeof fetch;
}) => {
  try {
    const response = await fetchFn(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: secretKey, response: token }),
      },
    );
    const data = (await response.json()) as { success?: boolean } | null;
    return data?.success === true;
  } catch (error) {
    console.error("Error verifying Turnstile token", error);
    return false;
  }
};
