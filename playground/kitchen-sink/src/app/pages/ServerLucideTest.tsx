// No 'use client' directive - this is a server component
import { Icon } from 'lucide-react'

export function ServerLucideTest() {
  // This would try to execute Icon (a 'use client' component) during SSR
  // which should trigger the error
  return (
    <div>
      <h2>Server Lucide Test</h2>
      <Icon name="test" size={24} />
    </div>
  )
}
