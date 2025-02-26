import { Context } from '@/worker'

export const Layout = ({ children, ctx }: { children: React.ReactNode, ctx: Context }) => {
  return (
    <div>
      <p>
        {ctx.user?.username 
          ? `You are logged in as user ${ctx.user.username}`
          : "You are not logged in"}
      </p>
      {children}
    </div>
  )
}