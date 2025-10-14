import { plainDep } from "plain-lib";

export const ServerComponent = () => {
  return (
    <div>
      <h2>Server Component</h2>
      <p>{plainDep()}</p>
    </div>
  );
};
