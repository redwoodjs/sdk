import {
    changeServerCounter,
    getServerCounter,
    resetServerCounter,
  } from "./action";
  
  export function ServerCounter() {
    return (
      <form action={changeServerCounter}>
        <input type="hidden" name="change" value="1" />
        <button>server-counter: {getServerCounter()}</button>
        <button formAction={resetServerCounter}>server-counter-reset</button>
      </form>
    );
  }