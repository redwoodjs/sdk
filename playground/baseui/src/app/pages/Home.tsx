import { RequestInfo } from "rwsdk/worker";
import ExampleAccordion from "../components/ExampleAccordion";
import ExampleDialog from "../components/ExampleDialog";
import ExampleSwitch from "../components/ExampleSwitch";

export function Home({ ctx }: RequestInfo) {
  return (
    <div className="container mx-auto p-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2" data-testid="main-title">
          Base UI Playground
        </h1>
        <p className="text-lg text-gray-600" data-testid="subtitle">
          A simple component showcase for RedwoodSDK
        </p>
      </header>

      <main className="space-y-12">
        <section data-testid="accordion-section">
          <h2 className="text-2xl font-semibold mb-4">Accordion</h2>
          <div className="flex justify-center">
            <ExampleAccordion />
          </div>
        </section>

        <section data-testid="dialog-section">
          <h2 className="text-2xl font-semibold mb-4">Dialog</h2>
          <div className="flex justify-center">
            <ExampleDialog />
          </div>
        </section>

        <section data-testid="switch-section">
          <h2 className="text-2xl font-semibold mb-4">Switch</h2>
          <div className="flex justify-center">
            <ExampleSwitch />
          </div>
        </section>
      </main>
    </div>
  );
}
