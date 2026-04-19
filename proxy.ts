import { NextResponse, type NextRequest } from "next/server";

function normalizePath(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function normalizeBasePath(input?: string): string {
  const raw = input?.trim() ?? "";
  if (!raw) {
    return "";
  }

  return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
}

function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return "/";
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }

  return pathname;
}

function isDualMapPath(pathname: string): boolean {
  return (
    pathname === "/news" ||
    pathname.startsWith("/news/") ||
    pathname === "/compare" ||
    pathname.startsWith("/compare/")
  );
}

function buildPathCandidates(pathname: string, configuredBasePath: string): string[] {
  const candidates = new Set<string>([normalizePath(pathname)]);

  if (configuredBasePath) {
    candidates.add(normalizePath(stripBasePath(pathname, configuredBasePath)));
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    candidates.add(`/${segments.slice(1).join("/")}`);
  }

  return Array.from(candidates);
}

export default function proxy(request: NextRequest) {
  if (process.env.FEATURE_DUAL_MAP_UI === "true") {
    return NextResponse.next();
  }

  const normalizedPath = normalizePath(request.nextUrl.pathname);
  const configuredBasePath = normalizeBasePath(
    process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.NEXT_BASE_PATH,
  );

  const shouldBlock = buildPathCandidates(normalizedPath, configuredBasePath).some((path) =>
    isDualMapPath(path),
  );

  if (!shouldBlock) {
    return NextResponse.next();
  }

  return NextResponse.json(
    {
      error: "Not Found",
      message: "Dual-map routes are disabled",
    },
    {
      status: 404,
      headers: {
        "x-robots-tag": "noindex",
      },
    },
  );
}

export const config = {
  matcher: ["/:path*"],
};
