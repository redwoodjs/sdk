"use client";

//import isNumber from "is-number";
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
      <p>Is 5 a number? {/* {isNumber(5) ? "Yes" : "No"} */}</p>
      <button onClick={handleClick}>Call Server Action</button>
      {serverActionResult && <p>Server action result: {serverActionResult}</p>}
    </div>
  );
};
