import { AuthLayout } from "app/layouts/AuthLayout";
import { link } from "app/shared/links";

export function LoginPage() {
  return (
    <AuthLayout>
      <div className="relative h-full min-h-[calc(100vh_-_96px)] w-full center">
        <div className="absolute top-0 right-0 p-10">
          <a href={link('/signup')} className="font-display font-bold text-black text-sm border-b-1 border-black hover:border-primary">
            Register
          </a>
        </div>

        <div>
          <form className="max-w-[400px] login-form">
            <h1 className="page-title text-center">Login</h1>
            <p className="text-center text-zinc-500 text-sm py-6">Enter your username below to sign-in.</p>

            <input type="text" placeholder="Username" />
            <button className="primary mb-6">
              Login with Passkey
            </button>

            <p>By clicking continue, you agree to our <a href={link('/terms')}>Terms of Service</a> and <a href={link('/privacy')}>Privacy Policy</a>.</p>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}
