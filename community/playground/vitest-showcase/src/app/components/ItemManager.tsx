// @ts-ignore
import { env } from "cloudflare:workers";
import { trackAndSaveItem } from "../actions";

/**
 * An RSC that displays items from the database and provides a form to add more.
 */
export async function ItemManager() {
  const DB = (env as any).DB;
  if (!DB) return <div>Database not connected</div>;

  // Fetch items directly from D1 inside the component
  const { results: items } = await DB.prepare("SELECT * FROM items ORDER BY id DESC").all();

  return (
    <div id="item-manager">
      <h1>Item Manager</h1>
      
      <form action={(formData) => { void trackAndSaveItem(formData) }}>
        <input type="text" name="name" placeholder="Item name" required />
        <button type="submit">Add Item</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id} className="item-row">
              <td>{item.id}</td>
              <td className="item-name">{item.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
