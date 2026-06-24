import { JsonBadge } from "../components/JsonBadge.js";
import sample from "../data/sample.json";

export const Home = () => {
  return (
    <div>
      <h1>JSON Import Reproduction</h1>
      <p id="server-json-message">
        server says: <strong>{sample.greeting}</strong>
      </p>
      <ul id="server-json-items">
        {sample.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <JsonBadge />
    </div>
  );
};
