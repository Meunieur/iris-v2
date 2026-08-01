import {
  JarvisReadClient,
  JarvisReadController,
  JarvisTaskClient,
  JarvisTaskController,
  type JarvisTransport,
  type Scheduler,
} from "@iris/jarvis-adapter";

type AttachedRuntimeInput = {
  endpoint: URL;
  transport: JarvisTransport;
  scheduler: Scheduler;
};

export function createAttachedRuntime(input: AttachedRuntimeInput) {
  const client = new JarvisReadClient({
    endpoint: input.endpoint,
    transport: input.transport,
  });
  const controller = new JarvisReadController({
    client,
    scheduler: input.scheduler,
  });
  const taskClient = new JarvisTaskClient({
    endpoint: input.endpoint,
    transport: input.transport,
  });
  const taskController = new JarvisTaskController({
    client: taskClient,
    scheduler: input.scheduler,
  });
  return Object.freeze({ client, controller, taskClient, taskController });
}
