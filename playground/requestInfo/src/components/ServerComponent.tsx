"use server";
import { serverDep } from "server-lib";

export const ServerComponent = () => {
  return (
    <div>
      <h2>Server Component</h2>
      <p>{serverDep()}</p>
    </div>
  );
};
