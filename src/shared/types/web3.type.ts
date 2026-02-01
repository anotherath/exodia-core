export type HexString = `0x${string}`;

export class ISignKeyInfo {
  walletAddress: HexString;
  signature: HexString;
  message: string;
}

export interface NonceInfo {
  walletAddress: string;
  nonce: string;
  expiresAt: Date;
}
