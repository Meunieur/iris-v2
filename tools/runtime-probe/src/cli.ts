import {
  compareRuntimeIdentity,
  probeAttachedRuntime,
  type RuntimeProbeSnapshot,
} from "./index";
import { pathToFileURL } from "node:url";

type ProbeFunction = typeof probeAttachedRuntime;

type CliDependencies = {
  probe?: ProbeFunction;
  writeOutput?: (output: string) => void;
};

function parseArgs(args: readonly string[]): { endpoint: URL; repeat: 1 | 2 } {
  let endpoint = "http://127.0.0.1:7777";
  let repeat: 1 | 2 = 1;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--endpoint" && value !== undefined) {
      endpoint = value;
      index += 1;
      continue;
    }
    if (argument === "--repeat" && (value === "1" || value === "2")) {
      repeat = Number(value) as 1 | 2;
      index += 1;
      continue;
    }
    throw new Error("Invalid runtime probe arguments");
  }

  const endpointMatch = /^http:\/\/(127\.0\.0\.1|localhost):([0-9]{1,5})$/.exec(endpoint);
  const port = endpointMatch === null ? Number.NaN : Number(endpointMatch[2]);
  if (endpointMatch === null || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Invalid runtime probe endpoint");
  }

  return { endpoint: new URL(endpoint), repeat };
}

function sanitizeSnapshot(snapshot: RuntimeProbeSnapshot): RuntimeProbeSnapshot {
  const sanitized: RuntimeProbeSnapshot = {
    endpoint: snapshot.endpoint,
    capturedAt: snapshot.capturedAt,
    processChain: snapshot.processChain,
    health: snapshot.health,
    privateIdentity: {},
  };
  if (snapshot.listenerPid !== undefined) sanitized.listenerPid = snapshot.listenerPid;
  if (snapshot.privateIdentity.cwdFingerprint !== undefined) {
    sanitized.privateIdentity.cwdFingerprint = snapshot.privateIdentity.cwdFingerprint;
  }
  return sanitized;
}

function hasHealthyListener(snapshot: RuntimeProbeSnapshot): boolean {
  return snapshot.health.status === "ok"
    && snapshot.listenerPid !== undefined
    && snapshot.privateIdentity.cwdFingerprint !== undefined;
}

export async function runCli(
  args: readonly string[],
  dependencies: CliDependencies = {},
): Promise<number> {
  const writeOutput = dependencies.writeOutput ?? ((output) => process.stdout.write(`${output}\n`));
  const probe = dependencies.probe ?? probeAttachedRuntime;

  try {
    const options = parseArgs(args);
    const samples: RuntimeProbeSnapshot[] = [];
    for (let sample = 0; sample < options.repeat; sample += 1) {
      samples.push(await probe({ endpoint: options.endpoint }));
    }

    const comparison = samples.length === 2
      ? compareRuntimeIdentity(samples[0]!, samples[1]!)
      : undefined;
    const output: {
      samples: RuntimeProbeSnapshot[];
      comparison?: ReturnType<typeof compareRuntimeIdentity>;
    } = {
      samples: samples.map(sanitizeSnapshot),
    };
    if (comparison !== undefined) output.comparison = comparison;
    writeOutput(JSON.stringify(output, null, 2));

    const healthy = samples.every(hasHealthyListener);
    return healthy && (comparison?.sameRuntime ?? true) ? 0 : 1;
  } catch {
    writeOutput(JSON.stringify({ error: "runtime_probe_failed" }));
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
