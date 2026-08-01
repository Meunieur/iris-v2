import { execFile } from "node:child_process";

import type { ListenerInspection } from "./index";

const EXEC_FILE_TIMEOUT_MS = 4_000;
const INSPECTION_TIMEOUT_MS = 5_000;

export type PowerShellRunner = (
  executable: string,
  args: readonly string[],
) => Promise<{ stdout: string }>;

const defaultPowerShellRunner: PowerShellRunner = (executable, args) =>
  new Promise((resolve, reject) => {
    execFile(
      executable,
      [...args],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        timeout: EXEC_FILE_TIMEOUT_MS,
        killSignal: "SIGKILL",
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          reject(new Error("PowerShell listener query failed"));
          return;
        }
        resolve({ stdout });
      },
    );
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredPid(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function safeProcessName(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 1 || value.length > 255) return undefined;
  // oxlint-disable-next-line no-control-regex -- Windows process names must reject ASCII control characters.
  if (value === "." || value === ".." || /[<>:"|?*\\/\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value;
}

function parseLoopbackBinding(value: unknown): { localAddress: "127.0.0.1" | "::1"; pid: number } {
  if (!isRecord(value)) {
    throw new Error("Windows listener inspection returned invalid data");
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("localAddress") || !keys.includes("pid")) {
    throw new Error("Windows listener inspection returned invalid data");
  }
  const localAddress = value.localAddress;
  const pid = requiredPid(value.pid);
  if ((localAddress !== "127.0.0.1" && localAddress !== "::1") || pid === undefined) {
    throw new Error("Windows listener inspection returned invalid data");
  }
  return { localAddress, pid };
}

function parseInspection(stdout: string): ListenerInspection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Windows listener inspection returned invalid data");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.bindings) || !Array.isArray(parsed.processChain)) {
    throw new Error("Windows listener inspection returned invalid data");
  }

  const bindings = parsed.bindings.map(parseLoopbackBinding);
  const uniqueListenerPids = [...new Set(bindings.map((binding) => binding.pid))];
  if (uniqueListenerPids.length > 1) {
    throw new Error("Windows listener inspection returned invalid data");
  }

  const processChain = parsed.processChain.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Windows listener inspection returned invalid data");
    }
    const pid = requiredPid(entry.pid);
    const name = safeProcessName(entry.name);
    if (pid === undefined || name === undefined) {
      throw new Error("Windows listener inspection returned invalid data");
    }
    const process: ListenerInspection["processChain"][number] = { pid, name };
    const parentPid = requiredPid(entry.parentPid);
    if (parentPid !== undefined) process.parentPid = parentPid;
    return process;
  });

  const listenerPid = uniqueListenerPids[0];
  if (listenerPid === undefined) {
    if (processChain.length !== 0) {
      throw new Error("Windows listener inspection returned invalid data");
    }
    return { processChain: [] };
  }
  if (processChain.length === 0 || processChain[0]?.pid !== listenerPid) {
    throw new Error("Windows listener inspection returned invalid data");
  }

  const processPids = new Set<number>();
  for (let index = 0; index < processChain.length; index += 1) {
    const process = processChain[index]!;
    if (processPids.has(process.pid)) {
      throw new Error("Windows listener inspection returned invalid data");
    }
    processPids.add(process.pid);
    const parent = processChain[index + 1];
    if (parent !== undefined && process.parentPid !== parent.pid) {
      throw new Error("Windows listener inspection returned invalid data");
    }
  }
  const finalParentPid = processChain.at(-1)?.parentPid;
  if (finalParentPid !== undefined && processPids.has(finalParentPid)) {
    throw new Error("Windows listener inspection returned invalid data");
  }

  return { listenerPid, processChain };
}

function listenerInspectionScript(port: number): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$listeners = @(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue)`,
    "$bindings = @($listeners | ForEach-Object { [pscustomobject]@{ localAddress = [string]$_.LocalAddress; pid = [int]$_.OwningProcess } })",
    "$listenerPids = @($bindings | Select-Object -ExpandProperty pid | Sort-Object -Unique)",
    "if ($listenerPids.Count -ne 1) { [pscustomobject]@{ bindings = @($bindings); processChain = @() } | ConvertTo-Json -Compress -Depth 4; exit 0 }",
    "$listenerPid = [int]$listenerPids[0]",
    "$currentPid = $listenerPid",
    "$seen = @{}",
    "$chain = @()",
    "while ($currentPid -gt 0 -and -not $seen.ContainsKey($currentPid)) {",
    "  $seen[$currentPid] = $true",
    "  $process = Get-CimInstance Win32_Process -Filter (\"ProcessId = $currentPid\") -ErrorAction SilentlyContinue",
    "  if ($null -eq $process) { break }",
    "  $chain += [pscustomobject]@{ pid = [int]$process.ProcessId; parentPid = [int]$process.ParentProcessId; name = [string]$process.Name }",
    "  $currentPid = [int]$process.ParentProcessId",
    "}",
    "[pscustomobject]@{ bindings = @($bindings); processChain = @($chain) } | ConvertTo-Json -Compress -Depth 4",
  ].join("\n");
}

async function runWithTimeout(
  runnerPromise: Promise<{ stdout: string }>,
  timeoutMs: number,
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Windows listener inspection timed out"));
    }, timeoutMs);
    runnerPromise.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        reject(new Error("Windows listener inspection failed"));
      },
    );
  });
}

export async function inspectWindowsListener(
  port: number,
  runner: PowerShellRunner = defaultPowerShellRunner,
  timeoutMs = INSPECTION_TIMEOUT_MS,
): Promise<ListenerInspection> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Port must be a valid TCP port");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Inspection timeout must be positive");
  }

  const result = await runWithTimeout(
    runner("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      listenerInspectionScript(port),
    ]),
    timeoutMs,
  );
  return parseInspection(result.stdout);
}
