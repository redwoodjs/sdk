import { Toaster } from "sonner";

export const Home = () => {
  return (
    <div>
      <h1>Issue #1259 Repro</h1>
      <p id="status">
        Dev server should boot even with an auxiliary worker + a node_modules
        &quot;use client&quot; dependency.
      </p>
      <Toaster />
    </div>
  );
};
