export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

/** Thin fetch wrapper: JSON in/out, cookie auth, consistent errors. */
export async function api<T>(path: string, { body, headers, ...init }: Options = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
