import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry<T = unknown>(
  url: string,
  config: AxiosRequestConfig = {},
  retries = DEFAULT_RETRIES,
): Promise<AxiosResponse<T>> {
  const headers = {
    "User-Agent": getRandomUserAgent(),
    Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    ...config.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await axios.request<T>({
        method: "GET",
        timeout: DEFAULT_TIMEOUT_MS,
        ...config,
        headers,
        url,
      });
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      await sleep(500 * attempt);
    }
  }

  throw new Error("fetchWithRetry reached an invalid state.");
}

