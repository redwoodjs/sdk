"use server";

export let COUNT = 0;

// const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function increment() {
  //   await wait(5000);
  console.log("it increments", COUNT);
  COUNT++;
  return COUNT;
}
