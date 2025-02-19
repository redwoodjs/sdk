import { User } from "@prisma/client";
import { Header } from "app/components/Header";
import { Icon } from "app/components/Icon";
import { db } from "@/db";

export async function HomePage() {

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
    },
  });

  return (
    <div>
      <Header />
      <h1 className="text-4xl text-red-500">Hello World</h1>
      {users.map((user: User) => (
        <div key={user.id}>{user.email}</div>
      ))}
      <Icon id="github" />
      <img src="/images/bg.png" />
    </div>
  );
}
