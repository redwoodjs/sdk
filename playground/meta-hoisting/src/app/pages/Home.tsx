import { RequestInfo } from "rwsdk/worker";
import { ComponentA } from "../components/ComponentA.js";

const maskedPhoneNumbers = Array.from(
  { length: 100 },
  (_, index) => `Customer ${index + 1}: ••• 1234`,
);

export function Home({ ctx }: RequestInfo) {
  return (
    <>
      <div>Hello World</div>
      <ComponentA />
      <table>
        <tbody>
          {maskedPhoneNumbers.map((phoneNumber) => (
            <tr key={phoneNumber}>
              <td>{phoneNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
