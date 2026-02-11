export interface EIP4361Message {
  domain: string; // "exodia.io"
  address: string; // wallet address
  statement: string; // "I accept the Exodia Terms of Service."
  uri: string; // "https://exodia.io"
  version: string; // "1"
  chainId: number; // 1
  nonce: string; // nonce từ server
  issuedAt: string; // ISO 8601
}
