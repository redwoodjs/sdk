import type { RequestInfo } from "rwsdk/worker";
import { DirectReactPortal } from "../components/DirectReactPortal.js";

export function Home({ ctx }: RequestInfo) {
  return <DirectReactPortal />;
}
