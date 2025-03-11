export const TurnstileWidget = ({ siteKey }: { siteKey: string }) => {
  return (
    <div data-turnstile="widget" data-sitekey={siteKey} data-theme="light" />
  );
};
