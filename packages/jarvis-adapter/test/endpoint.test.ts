import { describe, expect, it } from "vitest";

import { parseAttachedEndpoint } from "../src/endpoint";

describe("parseAttachedEndpoint", () => {
  it.each([
    ["http://127.0.0.1:7777", "http://127.0.0.1:7777/"],
    ["http://localhost:7777/", "http://localhost:7777/"],
    ["http://[::1]:7777", "http://[::1]:7777/"],
    ["http://127.0.0.1:80", "http://127.0.0.1/"],
  ])("accepts exact loopback HTTP endpoint %s", (input, expected) => {
    expect(parseAttachedEndpoint(input).href).toBe(expected);
  });

  it.each([
    "https://127.0.0.1:7777",
    "http://127.0.0.1",
    "http://127.0.0.1:0",
    "http://127.0.0.1:65536",
    "http://0.0.0.0:7777",
    "http://*:7777",
    "http://192.168.1.10:7777",
    "http://example.com:7777",
    "http://user:pass@127.0.0.1:7777",
    "http://127.0.0.1:7777/health",
    "http://127.0.0.1:7777/?mode=managed",
    "http://127.0.0.1:7777/#fragment",
    " http://127.0.0.1:7777",
    "http://127.0.0.1:7777 ",
  ])("rejects endpoint outside the attached-only boundary: %s", (input) => {
    expect(() => parseAttachedEndpoint(input)).toThrow("Invalid attached Jarvis endpoint");
  });
});
