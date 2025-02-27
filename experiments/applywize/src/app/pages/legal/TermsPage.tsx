import { AuthLayout } from 'app/layouts/AuthLayout'

export async function TermsPage() {
  return (
    <AuthLayout>
      <div className="bg-white p-12">
        <h1 className="page-title">Terms of Service</h1>
      </div>
    </AuthLayout>
  )
}
