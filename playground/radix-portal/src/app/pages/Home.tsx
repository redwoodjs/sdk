import type { RequestInfo } from "rwsdk/runtime";
import { PortalComponent } from "../components/PortalComponent.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello from the Home Page!</h1>
      <PortalComponent />
    </div>
  );
}
