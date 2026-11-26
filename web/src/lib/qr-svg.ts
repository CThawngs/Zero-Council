/**
 * Zero-dependency ISO/IEC 18004 QR Code SVG encoder (Byte mode, ECC Level L, Versions 1–20).
 *
 * Used to render raw EMVCo / VietQR payment payloads locally in the browser without leaking
 * transaction codes, amounts, or account details to third-party QR image servers.
 */

// ECC Level L: format indicator bits = 01 (binary 1).
const EC_LEVEL_L_BITS = 0b01;

/**
 * ISO/IEC 18004 Table 9 — ECC Level L parameters for Versions 1..20 (index 1..20).
 * Each tuple is `[ecCodewordsPerBlock, numBlocks]`.
 * Total codewords are derived directly from the function-pattern matrix (and cross-checked).
 */
const VERSION_L_PARAMS: ReadonlyArray<readonly [ecPerBlock: number, blocks: number]> = [
  [0, 0], // placeholder for 1-based version indexing
  [7, 1], // V1
  [10, 1], // V2
  [15, 1], // V3
  [20, 1], // V4
  [26, 1], // V5
  [18, 2], // V6
  [20, 2], // V7
  [24, 2], // V8
  [30, 2], // V9
  [18, 4], // V10
  [20, 4], // V11
  [24, 4], // V12
  [26, 4], // V13
  [30, 4], // V14
  [22, 6], // V15
  [24, 6], // V16
  [28, 6], // V17
  [30, 6], // V18
  [28, 7], // V19
  [28, 8], // V20
];

/** ISO/IEC 18004 Annex E Table E.1 — alignment pattern center coordinates for Versions 1..20. */
const ALIGNMENT_COORDS: ReadonlyArray<readonly number[]> = [
  [],
  [], // V1
  [6, 18], // V2
  [6, 22], // V3
  [6, 26], // V4
  [6, 30], // V5
  [6, 34], // V6
  [6, 22, 38], // V7
  [6, 24, 42], // V8
  [6, 26, 46], // V9
  [6, 28, 50], // V10
  [6, 30, 54], // V11
  [6, 32, 58], // V12
  [6, 34, 62], // V13
  [6, 26, 46, 66], // V14
  [6, 26, 48, 70], // V15
  [6, 26, 50, 74], // V16
  [6, 30, 54, 78], // V17
  [6, 30, 56, 82], // V18
  [6, 30, 58, 86], // V19
  [6, 34, 62, 90], // V20
];

// Precompute GF(256) log/antilog tables with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d).
const GF_EXP = new Uint8Array(256);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  GF_EXP[255] = GF_EXP[0];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

function reedSolomonDivisor(degree: number): Uint8Array {
  // Stores coefficients AFTER the leading x^degree term (which is always 1).
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) {
        result[j] ^= result[j + 1];
      }
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let j = 0; j < divisor.length; j++) {
      result[j] ^= gfMul(divisor[j], factor);
    }
  }
  return result;
}

function getBit(val: number, index: number): boolean {
  return ((val >>> index) & 1) !== 0;
}

function createFunctionTemplate(version: number): {
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];
  freeModules: number;
} {
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFn = (row: number, col: number, dark: boolean) => {
    modules[row][col] = dark;
    isFunction[row][col] = true;
  };

  // Timing patterns
  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // 3 Finder patterns + white separators (9x9 area clipped to matrix bounds)
  const drawFinder = (centerRow: number, centerCol: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const r = centerRow + dy;
        const c = centerCol + dx;
        if (r >= 0 && r < size && c >= 0 && c < size) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFn(r, c, dist !== 2 && dist !== 4);
        }
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(3, size - 4);
  drawFinder(size - 4, 3);

  // Alignment patterns
  const coords = ALIGNMENT_COORDS[version];
  const lastIdx = coords.length - 1;
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === lastIdx) || (i === lastIdx && j === 0)) {
        continue;
      }
      const cr = coords[i];
      const cc = coords[j];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFn(cr + dy, cc + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Reserve format info slots & dark module
  for (let i = 0; i <= 5; i++) setFn(i, 8, false);
  setFn(7, 8, false);
  setFn(8, 8, false);
  setFn(8, 7, false);
  for (let i = 9; i < 15; i++) setFn(8, 14 - i, false);
  for (let i = 0; i < 8; i++) setFn(8, size - 1 - i, false);
  for (let i = 8; i < 15; i++) setFn(size - 15 + i, 8, false);
  setFn(size - 8, 8, true); // Dark module

  // Version info (V7+)
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ (((rem >>> 11) & 1) * 0x1f25);
    }
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  }

  let freeModules = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c]) freeModules++;
    }
  }

  return { size, modules, isFunction, freeModules };
}

function drawFormatBits(modules: boolean[][], size: number, mask: number): void {
  const data = (EC_LEVEL_L_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) modules[i][8] = getBit(bits, i);
  modules[7][8] = getBit(bits, 6);
  modules[8][8] = getBit(bits, 7);
  modules[8][7] = getBit(bits, 8);
  for (let i = 9; i < 15; i++) modules[8][14 - i] = getBit(bits, i);

  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = getBit(bits, i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = getBit(bits, i);
  modules[size - 8][8] = true;
}

function maskBit(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return ((((row * col) % 2) + ((row * col) % 3)) % 2) === 0;
    case 7:
      return ((((row + col) % 2) + ((row * col) % 3)) % 2) === 0;
    default:
      return false;
  }
}

function penaltyScore(modules: boolean[][], size: number): number {
  let score = 0;

  // N1: runs of >= 5 identical modules in rows and columns
  for (let r = 0; r < size; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) score += 3;
        else if (runLen > 5) score += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }

  // N2: 2x2 blocks of identical color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const color = modules[r][c];
      if (
        color === modules[r][c + 1] &&
        color === modules[r + 1][c] &&
        color === modules[r + 1][c + 1]
      ) {
        score += 3;
      }
    }
  }

  // N4: dark module balance
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) dark++;
    }
  }
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  if (k > 0) score += k * 10;

  return score;
}

/**
 * Encodes an arbitrary UTF-8 string into a QR matrix (`true` = dark module).
 */
export function encodeQrMatrix(text: string): boolean[][] {
  const payload = new TextEncoder().encode(text);
  if (payload.length === 0) {
    throw new Error('QR payload must not be empty');
  }

  let chosenVersion = 0;
  let template: ReturnType<typeof createFunctionTemplate> | null = null;
  let totalCodewords = 0;
  let dataCodewords = 0;

  for (let v = 1; v <= 20; v++) {
    const candidate = createFunctionTemplate(v);
    const totalCw = Math.floor(candidate.freeModules / 8);
    const [ecPerBlock, blocks] = VERSION_L_PARAMS[v];
    const dataCw = totalCw - ecPerBlock * blocks;
    const countBits = v <= 9 ? 8 : 16;
    const neededBits = 4 + countBits + payload.length * 8;
    if (neededBits <= dataCw * 8) {
      chosenVersion = v;
      template = candidate;
      totalCodewords = totalCw;
      dataCodewords = dataCw;
      break;
    }
  }

  if (!template || chosenVersion === 0) {
    throw new Error(`QR payload exceeds Version 20-L capacity (${payload.length} bytes)`);
  }

  const countBits = chosenVersion <= 9 ? 8 : 16;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode indicator 0100 (Byte mode) + byte count + UTF-8 bytes
  pushBits(0b0100, 4);
  pushBits(payload.length, countBits);
  for (let i = 0; i < payload.length; i++) {
    pushBits(payload[i], 8);
  }

  // Terminator (up to 4 zero bits) + byte alignment + 0xEC / 0x11 pad codewords
  const dataCapacityBits = dataCodewords * 8;
  const terminatorLen = Math.min(4, dataCapacityBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes = new Uint8Array(dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataBytes[i] = b;
  }
  for (let i = bits.length / 8, padIdx = 0; i < dataCodewords; i++, padIdx++) {
    dataBytes[i] = padIdx % 2 === 0 ? 0xec : 0x11;
  }

  // Split into blocks, compute Reed-Solomon EC codewords, and interleave
  const [ecPerBlock, numBlocks] = VERSION_L_PARAMS[chosenVersion];
  const shortBlockLen = Math.floor(dataCodewords / numBlocks);
  const numLongBlocks = dataCodewords % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;
  const divisor = reedSolomonDivisor(ecPerBlock);

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const blockLen = b < numShortBlocks ? shortBlockLen : shortBlockLen + 1;
    const blockData = dataBytes.subarray(offset, offset + blockLen);
    offset += blockLen;
    dataBlocks.push(blockData);
    ecBlocks.push(reedSolomonRemainder(blockData, divisor));
  }

  const interleaved = new Uint8Array(totalCodewords);
  let outIdx = 0;
  const maxDataLen = numLongBlocks > 0 ? shortBlockLen + 1 : shortBlockLen;
  for (let col = 0; col < maxDataLen; col++) {
    for (let b = 0; b < numBlocks; b++) {
      if (col < dataBlocks[b].length) {
        interleaved[outIdx++] = dataBlocks[b][col];
      }
    }
  }
  for (let col = 0; col < ecPerBlock; col++) {
    for (let b = 0; b < numBlocks; b++) {
      interleaved[outIdx++] = ecBlocks[b][col];
    }
  }

  const { size, modules: baseModules, isFunction } = template;

  // Zigzag module placement onto baseModules
  let bitIdx = 0;
  const totalBits = interleaved.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (!isFunction[row][col]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const byte = interleaved[bitIdx >>> 3];
            dark = ((byte >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          baseModules[row][col] = dark;
        }
      }
    }
  }

  // Choose lowest-penalty mask across 0..7
  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestMatrix = baseModules;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseModules.map((row, r) =>
      row.map((cell, c) => (!isFunction[r][c] && maskBit(mask, r, c) ? !cell : cell))
    );
    drawFormatBits(candidate, size, mask);
    const score = penaltyScore(candidate, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestMatrix = candidate;
    }
  }

  // Ensure format bits match bestMask
  drawFormatBits(bestMatrix, size, bestMask);
  return bestMatrix;
}

/**
 * Renders a crisp, scanner-friendly SVG string with a standard 4-module quiet zone.
 */
export function encodeQrSvg(text: string, border = 4): string {
  const matrix = encodeQrMatrix(text);
  const size = matrix.length;
  const viewSize = size + border * 2;
  const parts: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        parts.push(`M${c + border},${r + border}h1v1h-1z`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#FFFFFF"/><path d="${parts.join('')}" fill="#000000"/></svg>`;
}

/**
 * Returns a `data:image/svg+xml;utf8,...` URI suitable for `<img src={...} />` without network calls.
 */
export function encodeQrDataUri(text: string, border = 4): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(encodeQrSvg(text, border))}`;
}
