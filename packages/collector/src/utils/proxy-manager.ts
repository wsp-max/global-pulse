const proxies: string[] = [];
let currentIndex = 0;

export function setProxies(items: string[]): void {
  proxies.length = 0;
  proxies.push(...items.filter(Boolean));
  currentIndex = 0;
}

export function getNextProxy(): string | null {
  if (proxies.length === 0) {
    return null;
  }

  const value = proxies[currentIndex % proxies.length] ?? null;
  currentIndex += 1;
  return value;
}

