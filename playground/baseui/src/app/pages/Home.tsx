import { RequestInfo } from "rwsdk/worker";
import { SimpleShowcase } from "../components/SimpleShowcase";

export function Home({ ctx }: RequestInfo) {
  return <SimpleShowcase ctx={ctx} />;
}
