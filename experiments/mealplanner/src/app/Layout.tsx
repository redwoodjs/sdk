import { Context } from '@/worker'
import { Header } from './components/Header'
export const Layout = ({ children, ctx }: { children: React.ReactNode, ctx: Context }) => {
  return (
    <div>
      <Header user={ctx.user} />
      {children}
    </div>
  )
}