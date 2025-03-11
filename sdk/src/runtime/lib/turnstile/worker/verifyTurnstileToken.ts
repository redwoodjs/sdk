export const verifyTurnstileToken = async ({
  token,
  secretKey,
}: {
  token: string;
  secretKey: string;
}) => {
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    },
  );

  try {
    const data = (await response.json()) as { success?: boolean } | null;
    return data?.success === true;
  } catch (error) {
    console.error("Error verifying Turnstile token", error);
    return false;
  }
};
