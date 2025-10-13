import { ServerGreeting } from "ui-lib";

export const PlainComponent = () => {
  return (
    <div>
      <h2>Plain Component</h2>
      <p>{ServerGreeting()}</p>
    </div>
  );
};
