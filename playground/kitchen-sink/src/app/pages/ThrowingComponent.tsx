export function ThrowingComponent() {
  throw new Error(
    "This is a test error from the /debug/throw-component route",
  );
  return <div>This should never render</div>;
}
