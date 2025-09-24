import { RequestInfo } from "rwsdk/worker";
import { ClientComponentShowcase } from "@/app/components/ClientComponentShowcase";

// Server-rendered showcase with client component integration
export function SimpleShowcase({ ctx }: RequestInfo) {
  return (
    <div className="container">
      <header className="header">
        <h1>Base UI Component Showcase</h1>
        <p className="text-gray-600 text-lg">
          Comprehensive demonstration of Base UI components with RedwoodSDK
          server-side rendering
        </p>
      </header>

      <div className="space-y-8">
        {/* Static content that renders on server */}
        <section className="component-section" data-testid="static-content">
          <h2>Base UI Integration Status</h2>
          <div className="component-demo">
            <p>
              This page demonstrates the integration between RedwoodSDK and Base
              UI.
            </p>
            <p>
              Base UI components are client-side interactive components that
              require hydration.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <strong>Framework Status:</strong> ✅ RedwoodSDK SSR Working
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded mt-2">
              <strong>Base UI Status:</strong> 🔄 Client Components Loading...
            </div>
          </div>
        </section>

        {/* Placeholder sections for each component type */}
        <section className="component-section" data-testid="accordion-section">
          <h2>Accordion</h2>
          <div className="component-demo">
            <div className="p-4 bg-gray-100 rounded">
              Accordion component will be rendered here after client hydration.
            </div>
          </div>
        </section>

        <section className="component-section" data-testid="dialog-section">
          <h2>Dialog</h2>
          <div className="component-demo">
            <div className="p-4 bg-gray-100 rounded">
              Dialog component will be rendered here after client hydration.
            </div>
          </div>
        </section>

        <section className="component-section" data-testid="form-section">
          <h2>Form Components</h2>
          <div className="component-demo">
            <div className="p-4 bg-gray-100 rounded">
              Form components (Input, Checkbox, Switch, etc.) will be rendered
              here after client hydration.
            </div>
          </div>
        </section>

        {/* Client-side Base UI components */}
        <ClientComponentShowcase />
      </div>
    </div>
  );
}
