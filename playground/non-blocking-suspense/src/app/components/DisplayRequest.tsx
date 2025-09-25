import { use } from "react";

export function DisplayRequest({
  requestPromise,
}: {
  requestPromise: Promise<string>;
}) {
  const content = use(requestPromise);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-700 my-4">Remote Content</h2>
      <p>{content}</p>
    </div>
  );
}
