function normalizeBasePath(input?: string): string {
  const raw = input?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

function detectRuntimeBasePath(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const pathname = window.location.pathname;
  if (pathname === "/pulse" || pathname.startsWith("/pulse/")) {
    return "/pulse";
  }

  return "";
}

function getApiBase(): string {
  const envBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  if (envBasePath) {
    return `${envBasePath}/api`;
  }

  return `${detectRuntimeBasePath()}/api`;
}

export async function fetcher<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}


