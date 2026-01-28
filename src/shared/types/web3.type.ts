export type HexString = `0x${string}`;

export interface ISignKeyInfo {
  walletAddress: HexString;
  signature: HexString;
  message: string;
}

export interface NonceInfo {
  walletAddress: string;
  nonce: string;
  expiresAt: Date;
}
