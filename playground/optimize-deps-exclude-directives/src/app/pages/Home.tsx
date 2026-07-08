import { MyButton } from "my-ui-lib/button";

export const Home = () => {
  return (
    <div>
      <h1>Vendor Barrel Source Repro</h1>
      <p>
        This page imports a client component from a package in node_modules.
      </p>
      <p>
        If the host's Vite transform ran, you should see a log in the browser
        console and the button below should have a red background.
      </p>
      <MyButton />
    </div>
  );
};
