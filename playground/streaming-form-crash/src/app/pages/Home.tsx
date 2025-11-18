import { serverAction } from "./serverAction";

export const Home = () => {
  return <form action={serverAction}><button name="submit-button">Submit</button></form>
};
