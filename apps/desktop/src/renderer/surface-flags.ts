/**
 * The packaged product is deliberately small until each advanced boundary has
 * its own Jarvis-owned contract and live evidence. Local development can opt
 * into the preserved conversation/task panes without changing the default.
 */
export const EXPERIMENTAL_SURFACES_ENABLED = import.meta.env.VITE_IRIS_EXPERIMENTAL === "1";
