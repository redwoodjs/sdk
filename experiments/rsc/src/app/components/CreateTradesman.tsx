import { createTradesman } from "../createTradesman";

export default function CreateTradesman() {
  return (
    <div className="bg-blue-500">
      <h2>Create Tradesman</h2>
      <form action={createTradesman}>
        <input type="text" name="name" placeholder="Name" />
        <input type="text" name="cellnumber" placeholder="Cell Number" />
        <input type="text" name="profession" placeholder="Profession" />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
