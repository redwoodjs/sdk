import { AuthLayout } from "app/layouts/AuthLayout";
import { link } from "app/shared/links";

export function SignupPage() {
  return (
    <AuthLayout>
      <div className="relative h-full min-h-[calc(100vh_-_96px)] w-full center">
        <div className="absolute top-0 right-0 p-10">
          <a href={link('/login')} className="font-display font-bold text-black text-sm border-b-1 border-black hover:border-primary">
            Login
          </a>
        </div>

        <div className="w-[400px]">
          <h2 className="page-title text-center">Create an Account</h2>
          {/* <p className="text-center text-zinc-500 text-sm py-6">Enter your details below to create an account.</p> */}
          <form action="" className="login-form">
            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input type="text" id="name" placeholder="Full Name" />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input type="text" id="username" placeholder="Username" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input type="text" id="email" placeholder="Email" />
            </div>
            <div className="field">
              <button className="primary">
                Register with Passkey
              </button>

            </div>
            <div className="field">
              <p>By clicking continue, you agree to our <a href={link('/terms')}>Terms of Service</a> and <a href={link('/privacy')}>Privacy Policy</a>.</p>
            </div>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}
