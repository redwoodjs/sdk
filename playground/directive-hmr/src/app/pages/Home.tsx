import { ClientToggleAdd } from "../components/ClientToggleAdd.mjs";
import { ClientToggleRemove } from "../components/ClientToggleRemove.mjs";
import { ServerActionForm } from "../components/ServerActionForm.mjs";

export function Home() {
  return (
    <div>
      <h1>Directive HMR</h1>
      <ClientToggleAdd />
      <ClientToggleRemove />
      <ServerActionForm />
    </div>
  );
}
