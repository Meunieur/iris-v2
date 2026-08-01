const ATTACHED_ENDPOINT_PATTERN = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):([0-9]{1,5})\/?$/i;

export function parseAttachedEndpoint(input: string): URL {
  const match = ATTACHED_ENDPOINT_PATTERN.exec(input);
  const port = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  if (match === null || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Invalid attached Jarvis endpoint");
  }

  const endpoint = new URL(input);
  endpoint.pathname = "/";
  return endpoint;
}
