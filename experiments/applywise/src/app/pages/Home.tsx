import { db } from "../../db";

interface User {
  id: string;
  email: string;
}

export async function Home() {
  const getUsers = async (): Promise<User[]> => {
    const users =
      (await db.user.findMany({
        select: {
          id: true,
          email: true
        },
      })) ?? [];
    return users;
  }

  const users = await getUsers();

  return (
    <div>
      <h1>Hello World</h1>
      {users.map((user: User) => (
        <div key={user.id}>{user.email}</div>
      ))}
    </div>
  );
}
