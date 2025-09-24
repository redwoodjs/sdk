import type { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Portal Freeze Test Cases</h1>
      <nav>
        <ul>
          <li>
            <a href="/direct-react-portal">1. Direct React Portal</a>
          </li>
          <li>
            <a href="/radix-portal">2. Radix Portal</a>
          </li>
          <li>
            <a href="/dropdown">3. Radix Dropdown Menu</a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
