export const REQUIRED_WASM_FILES: readonly string[];

export type CopyMediaPipeAssetsInput = Readonly<{
  wasmRoot: string;
  modelPath: string;
  outputRoot: string;
}>;

export function copyMediaPipeAssets(input: CopyMediaPipeAssetsInput): Promise<void>;
