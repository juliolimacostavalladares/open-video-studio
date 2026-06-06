export async function waitForUrl(url: string, timeoutMs = 90_000) {
  const timeoutAt = Date.now() + timeoutMs;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return response;
      }
    } catch {
      // Keep polling while the server boots.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}
