import { RequestInfo } from "rwsdk/worker";
import { Button } from "ui-lib";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <Button />
    </div>
  );
}
