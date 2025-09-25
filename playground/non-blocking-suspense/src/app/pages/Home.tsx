import { Suspense } from "react";
import { ExampleButton } from "../components/ExampleButton";
import { DisplayRequest } from "../components/DisplayRequest";
import { fetchExampleRemoteRequest } from "../lib/exampleRemoteRequest";

export function Home() {
  const requestPromise = fetchExampleRemoteRequest();

  return (
    <div>
      <h1 className="text-4xl font-bold text-green-800 mb-8">
        Non-blocking Suspense
      </h1>
      <Suspense fallback={<div>Loading...</div>}>
        <DisplayRequest requestPromise={requestPromise} />
      </Suspense>
      <ExampleButton message="Hello from the interactive button!" />
    </div>
  );
}
