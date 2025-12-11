import { RequestInfo } from "rwsdk/worker";
import { handleForm } from "@/app/actions";

export function Home({ ctx }: RequestInfo) {
  ctx;
  return (
    <div>
      <h1>Form Action Redirect Response</h1>
      <p id="home-marker">Home page</p>
      <form action={handleForm}>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
