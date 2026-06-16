import { ConnectionStatus } from "@/app/components/ConnectionStatus";

export function Home() {
  return (
    <div>
      <h1>WebSocket Disconnect Recovery</h1>
      <p data-testid="build-marker">Build A</p>
      <ConnectionStatus />
    </div>
  );
}
