throw new Error(
  "RedwoodSDK: 'react-server' import condition needs to be used in this environment. This code should only run in React Server Components (RSC) context. Check that you're not importing server-only code in client components.",
);
