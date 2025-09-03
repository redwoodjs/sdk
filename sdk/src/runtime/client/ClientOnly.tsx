import { useEffect, useState } from "react";

export const ClientOnly = ({ children }: { children: React.ReactNode }) => {
  const [didUpdate, setDidUpdate] = useState(false);

  useEffect(() => {
    setDidUpdate(true);
  }, []);

  return didUpdate ? children : null;
};
