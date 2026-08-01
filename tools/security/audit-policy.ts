import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AuditPolicy = {
  schema_version: number;
  review_by: string;
  owner: string;
  allow_dev_only_advisories: Array<{
    url: string;
    reason: string;
  }>;
};

type AuditAdvisory = {
  source?: number;
  name?: string;
  dependency?: string;
  title?: string;
  url?: string;
  severity?: string;
};

type AuditVulnerability = {
  name: string;
  severity: string;
  isDirect: boolean;
  via: Array<string | AuditAdvisory>;
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: unknown;
};

export type AuditReport = {
  auditReportVersion: number;
  vulnerabilities: Record<string, AuditVulnerability>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
  };
};

export type Lockfile = {
  lockfileVersion: number;
  packages: Record<string, {
    dev?: boolean;
    devOptional?: boolean;
  }>;
};

export type AuditPolicyResult = {
  ok: boolean;
  vulnerabilities: number;
  advisories: string[];
  errors: string[];
};

function validatePolicy(policy: AuditPolicy, errors: Set<string>) {
  if (policy.schema_version !== 1) errors.add(`Unsupported audit policy schema: ${policy.schema_version}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(policy.review_by)) {
    errors.add(`Invalid audit policy review date: ${policy.review_by}`);
  }
  if (typeof policy.owner !== "string" || policy.owner.trim().length === 0) {
    errors.add("Audit policy owner is required");
  }
  if (!Array.isArray(policy.allow_dev_only_advisories)) {
    errors.add("Audit policy advisory allowlist is required");
    return;
  }
  for (const exception of policy.allow_dev_only_advisories) {
    if (typeof exception.url !== "string" || !exception.url.startsWith("https://github.com/advisories/GHSA-")) {
      errors.add(`Invalid audit advisory URL: ${String(exception.url)}`);
    }
    if (typeof exception.reason !== "string" || exception.reason.trim().length < 20) {
      errors.add(`Audit advisory reason is too short: ${String(exception.url)}`);
    }
  }
}

export function evaluateAuditReport(
  report: AuditReport,
  lockfile: Lockfile,
  policy: AuditPolicy,
  now = new Date(),
): AuditPolicyResult {
  const errors = new Set<string>();
  const advisories = new Set<string>();
  const vulnerabilityNames = Object.keys(report.vulnerabilities);

  validatePolicy(policy, errors);

  if (report.auditReportVersion !== 2) {
    errors.add(`Unsupported npm audit report version: ${report.auditReportVersion}`);
  }
  if (lockfile.lockfileVersion !== 3) {
    errors.add(`Unsupported npm lockfile version: ${lockfile.lockfileVersion}`);
  }

  const hasCritical = report.metadata.vulnerabilities.critical > 0
    || Object.values(report.vulnerabilities).some((vulnerability) => vulnerability.severity === "critical");
  if (hasCritical) errors.add("Critical audit findings are never allowlisted");

  if (vulnerabilityNames.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(policy.review_by)) {
    const reviewDeadline = new Date(`${policy.review_by}T23:59:59.999Z`);
    if (Number.isNaN(reviewDeadline.getTime()) || now > reviewDeadline) {
      errors.add(`Audit exception review expired on ${policy.review_by}`);
    }
  }

  const collectAdvisories = (
    name: string,
    stack: Set<string>,
    discovered: Set<string>,
    cycles: Set<string>,
  ) => {
    if (stack.has(name)) {
      cycles.add(name);
      return;
    }
    const vulnerability = report.vulnerabilities[name];
    if (!vulnerability) {
      errors.add(`Missing vulnerability provenance: ${name}`);
      return;
    }

    const nextStack = new Set(stack);
    nextStack.add(name);
    if (!Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      errors.add(`Vulnerability has no advisory provenance: ${name}`);
      return;
    }

    for (const via of vulnerability.via) {
      if (typeof via === "string") {
        collectAdvisories(via, nextStack, discovered, cycles);
        continue;
      }
      if (typeof via?.url !== "string" || via.url.length === 0) {
        errors.add(`Vulnerability has malformed advisory provenance: ${name}`);
        continue;
      }
      discovered.add(via.url);
    }
  };

  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    const discovered = new Set<string>();
    const cycles = new Set<string>();
    collectAdvisories(name, new Set(), discovered, cycles);
    for (const advisory of discovered) advisories.add(advisory);
    if (discovered.size === 0 && cycles.size > 0) {
      errors.add(`Cyclic vulnerability provenance: ${[...cycles].sort()[0]}`);
    }
    if (!Array.isArray(vulnerability.nodes) || vulnerability.nodes.length === 0) {
      errors.add(`Vulnerability has no package-lock nodes: ${name}`);
      continue;
    }
    for (const node of vulnerability.nodes) {
      if (lockfile.packages[node]?.dev !== true) {
        errors.add(`Audit node is not dev-only: ${node}`);
      }
    }
  }

  const allowedAdvisories = new Set(policy.allow_dev_only_advisories?.map((entry) => entry.url) ?? []);
  for (const advisory of advisories) {
    if (!allowedAdvisories.has(advisory)) errors.add(`Unreviewed advisory: ${advisory}`);
  }

  return {
    ok: errors.size === 0,
    vulnerabilities: vulnerabilityNames.length,
    advisories: [...advisories].sort(),
    errors: [...errors].sort(),
  };
}

function parseJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function runNpmAudit(): AuditReport {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) throw new Error("npm_execpath is unavailable; run through npm run audit:policy");

  const result = spawnSync(process.execPath, [npmExecPath, "audit", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`npm audit failed before producing a policy result (exit ${String(result.status)})`);
  }
  if (result.stdout.trim().length === 0) throw new Error("npm audit returned no JSON report");
  return JSON.parse(result.stdout) as AuditReport;
}

function main() {
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const policy = parseJsonFile<AuditPolicy>(path.join(workspaceRoot, "tools", "security", "audit-policy.json"));
  const lockfile = parseJsonFile<Lockfile>(path.join(workspaceRoot, "package-lock.json"));
  const result = evaluateAuditReport(runNpmAudit(), lockfile, policy);

  if (!result.ok) {
    for (const error of result.errors) console.error(`[iris] audit_policy_error ${error}`);
    process.exitCode = 1;
    return;
  }

  console.info(
    `[iris] audit_policy_ok vulnerabilities=${result.vulnerabilities} advisories=${result.advisories.join(",") || "none"} review_by=${policy.review_by}`,
  );
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) main();
