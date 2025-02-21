const AuthLayout = ({ children }: { children: React.ReactNode}) => {
  return (
    <div>
      Auth
      <div>{children}</div>
    </div>
  )
}

export { AuthLayout }
