import sample from "../data/sample.json?raw";

export const RawHome = () => {
  return (
    <div>
      <h1>JSON ?raw Import Reproduction</h1>
      <pre id="raw-json">{sample}</pre>
    </div>
  );
};
