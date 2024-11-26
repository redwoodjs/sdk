import CreateUser from "./components/CreateUser";
import Login from "./components/Login";
import { db } from "../db";

export default async function AdminPage() {
    let users = await db.user.findMany();
    const isAuthenticated = true;
    return (
        <div>
            <h1>Admin Page</h1>
            {isAuthenticated ? (
                <>
                    <h2>Users</h2>
                    {users.map((user) => (
                        <div key={user.id}>{user.name} ({user.cellnumber})</div>
                    ))}
                    <hr />
                    <CreateUser />
                </>
            ) : (
                <Login />
            )}
        </div>
    );
}