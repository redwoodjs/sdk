import { AppButton, appClientUtil } from "../lib/client-utils.mjs";
import { PackageButton, packageClientUtil } from "ui-lib/client";
import { PackageServerComponent } from "ui-lib/server";

export const Home = () => {
  const messageFromAppClientUtil = appClientUtil.format("Home Page");
  const messageFromPackageClientUtil = packageClientUtil.format("Home Page");

  return (
    <div>
      <h1>Home</h1>
      <h2>Message from App Client Util (Scenario 1)</h2>
      <p id="message-from-app-util">{messageFromAppClientUtil}</p>
      <AppButton />

      <hr />

      <h2>Message from Package Client Util (Scenario 2)</h2>
      <p id="message-from-package-util">{messageFromPackageClientUtil}</p>
      <PackageButton />

      <hr />

      <h2>Rendered Package Server Component (Scenario 3)</h2>
      <PackageServerComponent />
    </div>
  );
};
