import type { Point } from '@noble/secp256k1';
export function hashToCurve(secretMessage: Uint8Array): Promise<Point>;
export function step1Alice(
  secretMessage: Uint8Array,
  r_bytes?: Uint8Array | null
): Promise<{ B_: string; r: string }>;
export function step3Alice(C_: Point, r: Uint8Array, A: Point): Point;
