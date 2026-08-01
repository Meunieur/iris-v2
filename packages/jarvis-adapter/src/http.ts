export const MAX_JSON_BYTES = 64 * 1024;
export const REQUEST_TIMEOUT_MS = 5_000;

export type JarvisReadErrorCode =
  | "unreachable"
  | "unauthorized"
  | "invalid_response"
  | "oversized_response"
  | "timeout"
  | "conflict";

export type JarvisTransport = {
  fetch(url: URL, init: RequestInit): Promise<Response>;
};

const MAX_REQUEST_JSON_BYTES = 16 * 1024;

type Parser<T> = {
  parse(value: unknown): T;
};

export class JarvisReadError extends Error {
  readonly code: JarvisReadErrorCode;

  constructor(code: JarvisReadErrorCode) {
    super(`Jarvis read failed: ${code}`);
    this.name = "JarvisReadError";
    this.code = code;
  }
}

function timeoutLike(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function readBody(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      throw new JarvisReadError("invalid_response");
    }
    if (parsedLength > maxBytes) throw new JarvisReadError("oversized_response");
  }

  if (response.body === null) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel();
        throw new JarvisReadError("oversized_response");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } catch (error) {
    if (error instanceof JarvisReadError) throw error;
    throw new JarvisReadError("invalid_response");
  } finally {
    reader.releaseLock();
  }
}

async function requestBoundedJson<T>(input: {
  transport: JarvisTransport;
  url: URL;
  schema: Parser<T>;
  maxBytes?: number;
  method: "GET" | "POST";
  body?: unknown;
}): Promise<T> {
  const maxBytes = input.maxBytes ?? MAX_JSON_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new JarvisReadError("invalid_response");
  }
  let response: Response;
  try {
    const request: RequestInit = {
      method: input.method,
      headers: input.body === undefined
        ? { accept: "application/json" }
        : { accept: "application/json", "content-type": "application/json" },
      redirect: "error",
      cache: "no-store",
      credentials: "include",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };
    if (input.body !== undefined) {
      const body = JSON.stringify(input.body);
      if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_JSON_BYTES) {
        throw new JarvisReadError("oversized_response");
      }
      request.body = body;
    }
    response = await input.transport.fetch(input.url, request);
  } catch (error) {
    if (error instanceof JarvisReadError) throw error;
    if (timeoutLike(error)) throw new JarvisReadError("timeout");
    throw new JarvisReadError("unreachable");
  }

  if (response.status === 401 || response.status === 403) {
    throw new JarvisReadError("unauthorized");
  }
  if (response.status === 409) throw new JarvisReadError("conflict");
  if (!response.ok || response.redirected || response.type === "opaqueredirect") {
    throw new JarvisReadError("invalid_response");
  }

  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") throw new JarvisReadError("invalid_response");

  try {
    const body = await readBody(response, maxBytes);
    return input.schema.parse(JSON.parse(body));
  } catch (error) {
    if (error instanceof JarvisReadError) throw error;
    throw new JarvisReadError("invalid_response");
  }
}

export async function getBoundedJson<T>(input: {
  transport: JarvisTransport;
  url: URL;
  schema: Parser<T>;
  maxBytes?: number;
}): Promise<T> {
  return requestBoundedJson({ ...input, method: "GET" });
}

export async function postBoundedJson<T>(input: {
  transport: JarvisTransport;
  url: URL;
  schema: Parser<T>;
  body?: unknown;
  maxBytes?: number;
}): Promise<T> {
  return requestBoundedJson({ ...input, method: "POST" });
}
