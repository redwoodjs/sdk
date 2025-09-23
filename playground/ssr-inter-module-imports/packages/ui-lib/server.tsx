import { packageClientUtil } from "./client.mjs";

export function PackageServerComponent() {
  const message = packageClientUtil.format("Package Server Component");

  return (
    <div>
      <p>A server component from ui-lib.</p>
      <p>It used a client util to generate this message:</p>
      <p id="message-from-package-server-component">{message}</p>
    </div>
  );
}
