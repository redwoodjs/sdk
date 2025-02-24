import { defineApp } from "@redwoodjs/sdk/worker";
import { index, layout, route } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";

function Home() {
  return (
    <div>
      <b>Hello, world!</b>
    </div>
  );
}

export default defineApp<Context>([
  route("/", [() => new Response("1"), () => new Response("2")]),
  route("/r/:id/:slug", ({ request, params }) => {
    return <div>Hello, world!</div>;
  }),
  route("/primes", () => {
    function generatePrimes(limit = 100) {
      const primes: number[] = [];
      for (let num = 2; num <= limit; num++) {
        let isPrime = true;
        for (let i = 2; i <= Math.sqrt(num); i++) {
          if (num % i === 0) {
            isPrime = false;
            break;
          }
        }
        if (isPrime) primes.push(num);
      }
      return primes;
    }

    const primeNumbers = generatePrimes();
    return (
      <div>
        <h2>First 100 Prime Numbers</h2>
        <pre>{JSON.stringify(primeNumbers, null, 2)}</pre>
      </div>
    );
  }),
  // layout(Document, [
  //   index([
  //     Home,
  //   ]),
  // ]),
]);
