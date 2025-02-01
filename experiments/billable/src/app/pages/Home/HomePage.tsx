import { Layout } from "../Layout";
import { RouteContext } from "../../../lib/router";
import { link } from "../../../shared/links";

export default function HomePage({ ctx}: RouteContext) {
  return (
    <Layout ctx={ctx}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="space-y-12">
          <div className="border-b border-gray-900/10 pb-12">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Welcome to Billable
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Billable is your all-in-one solution for managing invoices and streamlining your billing process. Create, track, and manage invoices with ease.
            </p>
            <div className="mt-10">
              <h2 className="text-2xl font-semibold leading-7 text-gray-900">
                Key Features
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">Invoice Management</h3>
                  <p className="mt-2 text-gray-600">Create and manage professional invoices with customizable templates</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">Logo Upload</h3>
                  <p className="mt-2 text-gray-600">Add your company branding by uploading logos to your invoices</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900">Secure Access</h3>
                  <p className="mt-2 text-gray-600">Passwordless authentication keeps your billing data safe and accessible</p>
                </div>
              </div>
              <div className="mt-10 flex justify-center">
                <a
                  href={link('/user/login')}
                  className="rounded-md bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Login to get started
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
