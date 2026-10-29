import type { RequestInfo } from "rwsdk/worker";
import { answer } from "../answer";
import { readLastAnswer } from "../answerState";

export function Home({ request }: RequestInfo) {
  const lastAnswer = readLastAnswer();

  return (
    <main>
      <h1>Server function form action</h1>
      <p>
        This form uses a server function directly and does not load a client
        entry script.
      </p>

      {lastAnswer !== undefined ? (
        <p id="answer-result">The server function ran with: {lastAnswer}</p>
      ) : request.method === "POST" ? (
        <p id="answer-result">
          The form was submitted, but the server function did not run.
        </p>
      ) : null}

      <form action={answer}>
        <label htmlFor="text">Answer</label>
        <textarea id="text" name="text" required />
        <button type="submit">Send answer</button>
      </form>
    </main>
  );
}
