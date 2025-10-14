"use client";
import { clientDep } from "client-lib";

export const ClientComponent = () => {
  return (
    <div>
      <h2>Client Component</h2>
      <p>{clientDep()}</p>
    </div>
  );
};
