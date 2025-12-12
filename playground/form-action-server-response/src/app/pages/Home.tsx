import { submitForm } from "@/app/actions";

export function Home() {
  
  return (
    <div>
      <h1>Form Action: Server Response</h1>
      <form action={submitForm as any}>
        <label htmlFor="name">Name</label>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

