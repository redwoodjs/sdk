"use server";
import { ServerGreeting } from "ui-lib";

export const ServerComponent = () => {
  return (
    <div>
      <h2>Server Component</h2>
      <p>{ServerGreeting()}</p>
    </div>
  );
};
