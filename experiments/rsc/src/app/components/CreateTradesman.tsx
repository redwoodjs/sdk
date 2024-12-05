import { createTradesman } from "../createTradesman";

const professions = ["Electrician", "Plumber", "Carpenter", "Painter"];

export default function CreateTradesman() {
  return (
    <div className="bg-blue-500">
      <h2>Create Tradesman</h2>
      <form action={createTradesman}>
        <input type="text" name="name" placeholder="Name" />
        <input type="text" name="cellnumber" placeholder="Cell Number" />
        <select name="profession">
          {professions.map((profession, index) => (
            <option key={index} value={profession}>
              {profession}
            </option>
          ))}
        </select>
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
