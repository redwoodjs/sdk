import { Header } from "app/components/Header";

const InteriorLayout = ({ children }: { children: React.ReactNode}) => {
  return (
    <div className="page-wrapper">
      <main className="bg-white rounded-xl border-2 border-[#D6D5C5]">
        <Header />
        <div>{children}</div>
      </main>
    </div>
  )
}

export { InteriorLayout }
