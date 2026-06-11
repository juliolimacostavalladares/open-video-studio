export function getServerApiUrl() {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  );
}

export function getClientApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export async function readApiError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  return body.message ?? `A API respondeu com HTTP ${response.status}`;
}
