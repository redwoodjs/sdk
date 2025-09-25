import { ClientToggleAdd } from "../components/ClientToggleAdd.js";
import { ClientToggleRemove } from "../components/ClientToggleRemove.js";
import { ServerActionForm } from "../components/ServerActionForm.js";

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
