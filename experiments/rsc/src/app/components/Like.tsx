import { increment } from "../counter";

// todo(peterp, 2024-11-27): Add interactivity.
export function Like() {
  return (
    <form action={increment}>
      <button type="submit">+</button>
    </form>
  );
}
