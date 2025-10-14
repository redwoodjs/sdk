import { plainDep } from "plain-lib";

export const PlainComponent = () => {
  return (
    <div>
      <h2>Plain Component</h2>
      <p>{plainDep()}</p>
    </div>
  );
};
