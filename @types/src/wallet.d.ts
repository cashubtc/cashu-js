import type { Point } from '@noble/secp256k1';
import type { PaymentRequestObject, TagsObject } from 'bolt11';

export type Proof = {
  amount: number;
  C: string;
  id: string;
  secret: string;
};

export type BlindedMessage = {
  amount: number;
  B_: Point;
};

export type Split = {
  proofs: Proof[];
  amount: number;
  outputs: BlindedMessage[];
};

export type MintKeys = { [k: number]: string };

export type MeltPayload = {
  pr: string;
  proofs: Array<Proof>;
};

export type MeltResponse = {
  paid: boolean;
  preimage: string;
};

export type SplitPayload = {
  proofs: Array<Proof>;
  amount: number;
  outputs: Array<SerializedBlindedMessage>;
};

export type SplitResponse = {
  fst: SerializedBlindedSignature[];
  snd: SerializedBlindedSignature[];
};

export type requestMintResponse = {
  pr: string;
  hash: string;
};

export type CheckSpendablePayload = {
  proofs: Array<{ secret: string }>;
};
export type CheckSpendableResponse = { spendable: Array<boolean> };

export type SerializedBlindedMessage = {
  amount: number;
  B_: string;
};

export type SerializedBlindedSignature = {
  id: string;
  amount: number;
  C_: string;
};

export type Token = {
  proofs: Array<Proof>;
  mints: Array<{ url: string; ids: Array<string> }>;
};

export type BlindedTransaction = {
  blindedMessages: SerializedBlindedMessage[];
  secrets: Uint8Array[];
  rs: bigint[];
  amounts: number[];
};

export class Wallet {
  proofs: Proof[];
  mintUrl: string;
  keys: string[];
  keysets: string[];
  mints: { url: string; keysets: string[] }[];

  constructor(mintUrl: string | null);
  loadMint(): Promise<undefined>;
  getKeysApi(): Promise<string[]>;
  getKeySetsApi(): Promise<{ keysets: string[] }>;
  mintApi(amounts: number[], paymentHash?: string): Promise<Proof[]>;
  mint(
    amount: number,
    hash: string
  ): Promise<
    { id: string; amount: number; C: string; secret: string }[] | undefined
  >;
  requestMintApi(amount: number): Promise<any>;
  requestMint(amount: number): Promise<any>;
  splitApi(
    proofs: Proof[],
    amount: number
  ): Promise<
    | {
        fristProofs: Proof[];
        scndProofs: Proof[];
      }
    | undefined
  >;
  split(
    proofs: any[],
    amount: number
  ): Promise<{
    fristProofs: Proof[];
    scndProofs: Proof[];
  }>;
  splitToSend(
    proofs: Proof[],
    amount: number,
    invlalidate: boolean
  ): Promise<
    | {
        fristProofs: Proof[];
        scndProofs: Proof[];
      }
    | undefined
  >;
  redeem(proofs: Proof[]): Promise<void>;
  melt(invoice: string): Promise<void>;
  checkSpendable(proofs: Proof[]): Promise<boolean | Error>;
  checkFees(invoice: string): Promise<number | Error>;
  generateSecrets(amounts: number[]): Uint8Array[];
  constructOutputs(
    amounts: number[],
    secrets: Uint8Array[]
  ): Promise<{
    outputs: {
      amount: number;
      B_: string;
    }[];
    rs: string[];
  }>;
  constructProofs(
    promises: SerializedBlindedSignature[],
    secrets: Uint8Array[],
    rs: string
  ): Proof[];
  promiseToProof(
    id: string,
    amount: number,
    C_hex: string,
    secret: string,
    r: string
  ): Proof;
  decodeInvoice(invoice: any): PaymentRequestObject & {
    tagsObject: TagsObject;
  };
  sumProofs(proofs: Proof[]): number;
  serializeProofs(proofs: Proof[]): string;
  lnurlPay(address: string, amount: number): Promise<any>;
  storeProofs(): void;
  deleteProofs(proofs: Proofs[]): Proofs[];
  assertMintError(resp: { data: { error?: any; code?: number } }): void;
}
