import { describe, expect, it } from "vitest";

import { evaluateAuditReport, type AuditPolicy, type AuditReport, type Lockfile } from "./audit-policy";

const allowedUrl = "https://github.com/advisories/GHSA-mh99-v99m-4gvg";

const policy: AuditPolicy = {
  schema_version: 1,
  review_by: "2026-08-14",
  owner: "Iris v2 product owner",
  allow_dev_only_advisories: [{
    url: allowedUrl,
    reason: "Pinned Electron packaging chain; trusted build inputs only.",
  }],
};

function report(advisoryUrl = allowedUrl): AuditReport {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      "brace-expansion": {
        name: "brace-expansion",
        severity: "high",
        isDirect: false,
        via: [{
          source: 1124334,
          name: "brace-expansion",
          dependency: "brace-expansion",
          title: "bounded expansion denial of service",
          url: advisoryUrl,
          severity: "high",
        }],
        effects: ["minimatch"],
        range: "<=5.0.7",
        nodes: ["node_modules/brace-expansion"],
        fixAvailable: false,
      },
      minimatch: {
        name: "minimatch",
        severity: "high",
        isDirect: false,
        via: ["brace-expansion"],
        effects: [],
        range: "<=10.0.2",
        nodes: ["node_modules/minimatch"],
        fixAvailable: false,
      },
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 2,
        critical: 0,
        total: 2,
      },
    },
  };
}

function lockfile(dev = true): Lockfile {
  return {
    lockfileVersion: 3,
    packages: {
      "node_modules/brace-expansion": { dev },
      "node_modules/minimatch": { dev },
    },
  };
}

describe("development dependency audit policy", () => {
  it("accepts only the reviewed advisory when every affected node is dev-only", () => {
    const result = evaluateAuditReport(report(), lockfile(), policy, new Date("2026-07-31T00:00:00Z"));

    expect(result).toEqual({
      ok: true,
      vulnerabilities: 2,
      advisories: [allowedUrl],
      errors: [],
    });
  });

  it("rejects an advisory that is not explicitly allowlisted", () => {
    const result = evaluateAuditReport(
      report("https://github.com/advisories/GHSA-unknown"),
      lockfile(),
      policy,
      new Date("2026-07-31T00:00:00Z"),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Unreviewed advisory: https://github.com/advisories/GHSA-unknown");
  });

  it("rejects an allowlisted advisory when any affected node is production-reachable", () => {
    const result = evaluateAuditReport(report(), lockfile(false), policy, new Date("2026-07-31T00:00:00Z"));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Audit node is not dev-only: node_modules/brace-expansion");
  });

  it("rejects critical findings even when their advisory is allowlisted", () => {
    const critical = report();
    critical.vulnerabilities["brace-expansion"].severity = "critical";
    critical.metadata.vulnerabilities.critical = 1;

    const result = evaluateAuditReport(critical, lockfile(), policy, new Date("2026-07-31T00:00:00Z"));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Critical audit findings are never allowlisted");
  });

  it("fails closed after the review deadline", () => {
    const result = evaluateAuditReport(report(), lockfile(), policy, new Date("2026-08-15T00:00:00Z"));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Audit exception review expired on 2026-08-14");
  });

  it("rejects missing and cyclic vulnerability provenance", () => {
    const missing = report();
    missing.vulnerabilities.minimatch.via = ["not-in-report"];
    const missingResult = evaluateAuditReport(missing, lockfile(), policy, new Date("2026-07-31T00:00:00Z"));
    expect(missingResult.errors).toContain("Missing vulnerability provenance: not-in-report");

    const cyclic = report();
    cyclic.vulnerabilities["brace-expansion"].via = ["minimatch"];
    const cyclicResult = evaluateAuditReport(cyclic, lockfile(), policy, new Date("2026-07-31T00:00:00Z"));
    expect(cyclicResult.errors).toContain("Cyclic vulnerability provenance: brace-expansion");
  });

  it("accepts a propagated package cycle when another branch reaches the reviewed advisory", () => {
    const propagated = report();
    propagated.vulnerabilities["app-builder-lib"] = {
      name: "app-builder-lib",
      severity: "high",
      isDirect: false,
      via: ["dmg-builder", "brace-expansion"],
      effects: [],
      range: ">=1",
      nodes: ["node_modules/app-builder-lib"],
      fixAvailable: false,
    };
    propagated.vulnerabilities["dmg-builder"] = {
      name: "dmg-builder",
      severity: "high",
      isDirect: false,
      via: ["app-builder-lib"],
      effects: [],
      range: ">=1",
      nodes: ["node_modules/dmg-builder"],
      fixAvailable: false,
    };
    const propagatedLock = lockfile();
    propagatedLock.packages["node_modules/app-builder-lib"] = { dev: true };
    propagatedLock.packages["node_modules/dmg-builder"] = { dev: true };

    const result = evaluateAuditReport(
      propagated,
      propagatedLock,
      policy,
      new Date("2026-07-31T00:00:00Z"),
    );

    expect(result.ok).toBe(true);
  });
});
