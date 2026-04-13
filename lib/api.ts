const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const normalizedBasePath = rawBasePath
  ? rawBasePath.startsWith("/")
    ? rawBasePath.replace(/\/+$/, "")
    : `/${rawBasePath.replace(/\/+$/, "")}`
  : "";
const API_BASE = `${normalizedBasePath}/api`;

export async function fetcher<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}


