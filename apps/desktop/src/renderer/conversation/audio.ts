function assertSampleRate(value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > 192_000) throw new Error("Invalid conversation sample rate");
}

function clampSample(value: number): number {
  return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
}

function writeInt16LittleEndian(target: Uint8Array, offset: number, value: number): void {
  const integer = value < 0 ? Math.round(value * 32_768) : Math.round(value * 32_767);
  const normalized = integer < 0 ? integer + 65_536 : integer;
  target[offset] = normalized & 0xff;
  target[offset + 1] = (normalized >>> 8) & 0xff;
}

export function resampleFloat32ToPcm16(
  samples: Float32Array<ArrayBufferLike>,
  inputSampleRate: number,
  outputSampleRate = 16_000,
): Uint8Array {
  assertSampleRate(inputSampleRate);
  assertSampleRate(outputSampleRate);
  if (samples.length === 0) return new Uint8Array();
  const outputLength = Math.max(1, Math.ceil(samples.length * outputSampleRate / inputSampleRate));
  const output = new Uint8Array(outputLength * 2);
  const ratio = inputSampleRate / outputSampleRate;
  for (let index = 0; index < outputLength; index += 1) {
    const start = index * ratio;
    const end = Math.min(samples.length, Math.max(start + 1, (index + 1) * ratio));
    const first = Math.floor(start);
    const last = Math.min(samples.length, Math.ceil(end));
    let sum = 0;
    let count = 0;
    for (let sourceIndex = first; sourceIndex < last; sourceIndex += 1) {
      sum += clampSample(samples[sourceIndex] ?? 0);
      count += 1;
    }
    writeInt16LittleEndian(output, index * 2, clampSample(count === 0 ? 0 : sum / count));
  }
  return output;
}

export function pcm16BytesToFloat32(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 2 !== 0) throw new Error("Invalid PCM16 buffer");
  const result = new Float32Array(bytes.byteLength / 2);
  for (let index = 0; index < result.length; index += 1) {
    const offset = index * 2;
    const unsigned = (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
    const signed = unsigned >= 32_768 ? unsigned - 65_536 : unsigned;
    result[index] = signed / 32_768;
  }
  return result;
}
