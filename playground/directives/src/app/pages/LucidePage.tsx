import { LucideTest } from "~/components/LucideTest";
import { RequestInfo } from "rwsdk/worker";

export function LucidePage({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Lucide Test Page</h1>
      <LucideTest />
    </div>
  );
}
