import { NextResponse } from "next/server";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("api");

interface RequestLogOptions {
  metadata?: Record<string, unknown>;
}

function buildRequestId(request: Request): string {
  const headerId = request.headers.get("x-request-id") ?? request.headers.get("x-correlation-id");
  if (headerId) {
    return headerId.slice(0, 128);
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildQueryPayload(request: Request): Record<string, string> {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function withApiRequestLog(
  request: Request,
  route: string,
  handler: () => Promise<NextResponse> | NextResponse,
  options?: RequestLogOptions,
): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = buildRequestId(request);
  const method = request.method;
  const query = buildQueryPayload(request);
  const metadata = options?.metadata ?? {};

  logger.info(
    {
      route,
      method,
      requestId,
      query,
      ...metadata,
    },
    "api_request_start",
  );

  try {
    const response = await handler();
    const durationMs = Date.now() - startedAt;
    const status = response.status;
    const payload = {
      route,
      method,
      requestId,
      status,
      durationMs,
      ...metadata,
    };

    if (status >= 500) {
      logger.error(payload, "api_request_end");
    } else if (status >= 400) {
      logger.warn(payload, "api_request_end");
    } else {
      logger.info(payload, "api_request_end");
    }

    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        route,
        method,
        requestId,
        durationMs,
        error: message,
        ...metadata,
      },
      "api_request_exception",
    );

    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  }
}
