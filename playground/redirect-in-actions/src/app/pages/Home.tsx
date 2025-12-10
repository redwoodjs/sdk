import { RequestInfo } from "rwsdk/worker";
import { RedirectDemo } from "../components/RedirectDemo";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Redirect in Actions</h1>
      <RedirectDemo />
    </div>
  );
}
