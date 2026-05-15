export async function DelayedMessage() {
  // Artificial delay to simulate a slow RSC data fetch
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return (
    <p data-testid="about-delayed-message">
      Delayed RSC content loaded
    </p>
  );
}


