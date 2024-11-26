export default function CreateUser() {
    return (
        <form action="/api/create-user" method="POST">
            <input type="text" name="name" placeholder="Full Name" />
            <input type="text" name="cell" placeholder="Cell Number" />
            <button type="submit">Create User</button>
        </form>
    );
}