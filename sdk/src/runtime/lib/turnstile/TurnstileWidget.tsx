export const TurnstileWidget = ({ siteKey }: { siteKey: string }) => (
  <div
    className="cf-turnstile"
    data-sitekey={siteKey}
    data-callback="__onTurnstileSuccess"
  />
);
