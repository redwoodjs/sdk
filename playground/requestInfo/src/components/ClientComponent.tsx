"use client";

import { clientDep } from "client-lib";
import { useState } from "react";
import { doServerAction } from "../app/actions";

export const ClientComponent = () => {
  const [serverActionResult, setServerActionResult] = useState<string | null>(
    null,
  );

  const handleClick = async () => {
    const result = await doServerAction();
    setServerActionResult(result);
  };

  return (
    <div>
      <h2>Client Component</h2>
      <p>{clientDep()}</p>
      <button onClick={handleClick}>Call Server Action</button>
      {serverActionResult && <p>Server action result: {serverActionResult}</p>}
    </div>
  );
};
