import { createTradesman } from "../createTradesman";

const professions = ["Electrician", "Plumber", "Carpenter", "Painter"];

export default function CreateTradesman() {
  return (
    <div>
      <form action={createTradesman}>
        <input
          type="text"
          name="name"
          placeholder="Name"
          className="w-full p-2 rounded-md border-[1px] border-gray-300 mb-2"
        />
        <input
          type="text"
          name="cellnumber"
          placeholder="Cell Number"
          className="w-full p-2 rounded-md border-[1px] border-gray-300 mb-2"
        />
        <select name="profession" className="w-full p-2 rounded-md border-[1px] border-gray-300 mb-2">
          {professions.map((profession, index) => (
            <option key={index} value={profession}>
              {profession}
            </option>
          ))}
        </select>
        <button
          className="w-full p-2 rounded-md bg-blue-500 text-white"
          type="submit"
        >
          Create
        </button>
      </form>
    </div>
  );
}
