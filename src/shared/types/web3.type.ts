export type HexString = `0x${string}`;

export interface NonceInfo {
  walletAddress: string;
  nonce: string;
  expiresAt: Date;
}
