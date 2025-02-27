import logo from "app/assets/logo.svg";

const AuthLayout = ({ children }: { children: React.ReactNode}) => {
  return (
    <div className="page-wrapper">
      <div className="grid grid-cols-2 rounded-xl border-2 border-[#D6D5C5]">
        <div className="center min-h-[calc(100vh_-_96px)] bg-[url('/images/bg.png')] bg-repeat rounded-l-xl relative">
          <div className="text-center relative -top-[100px]">
            <img src={logo} alt="Apply Wize" className="mx-auto" />
            <div className="text-5xl text-white font-bold">
              Apply Wize
            </div>
          </div>
          <div className="text-white absolute bottom-0 left-0 right-0 p-10 text-sm">
            “Transform the job hunt from a maze into a map.”
          </div>
        </div>
        <div className="bg-white rounded-r-xl">{children}</div>
      </div>
    </div>
  )
}

export { AuthLayout }
