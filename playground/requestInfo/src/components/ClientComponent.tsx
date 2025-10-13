"use client";
import { ClientGreeting } from "ui-lib";

export const ClientComponent = () => {
  return (
    <div>
      <h2>Client Component</h2>
      <p>{ClientGreeting()}</p>
    </div>
  );
};
