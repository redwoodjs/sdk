import { RequestInfo } from "rwsdk/worker";
import { ClientShowcase } from "../components/ClientShowcase";

export function Home({ ctx }: RequestInfo) {
  return (
    <div className="container mx-auto p-8">
      <header className="text-center mb-12">
        <h1
          className="text-4xl font-bold mb-2"
          data-testid="main-title"
        >
          Base UI Playground
        </h1>
        <p className="text-lg text-gray-600" data-testid="subtitle">
          A simple component showcase for RedwoodSDK
        </p>
      </header>

      <main>
        <ClientShowcase />
      </main>
    </div>
  );
}
