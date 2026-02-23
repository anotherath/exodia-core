// Domain chung cho tất cả EIP-712 messages
export const EIP712_DOMAIN = {
  name: 'Exodia',
  version: '1',
  chainId: 1,
} as const;

// ===== OPEN ORDER =====
export const OpenOrderTypes = {
  OpenOrder: [
    { name: 'walletAddress', type: 'address' },
    { name: 'symbol', type: 'string' },
    { name: 'side', type: 'string' },
    { name: 'type', type: 'string' },
    { name: 'qty', type: 'uint256' },
    { name: 'entryPrice', type: 'uint256' },
    { name: 'leverage', type: 'uint256' },
    { name: 'sl', type: 'uint256' },
    { name: 'tp', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

// ===== UPDATE ORDER =====
export const UpdateOrderTypes = {
  UpdateOrder: [
    { name: 'walletAddress', type: 'address' },
    { name: 'orderId', type: 'string' },
    { name: 'qty', type: 'uint256' },
    { name: 'entryPrice', type: 'uint256' },
    { name: 'leverage', type: 'uint256' },
    { name: 'sl', type: 'uint256' },
    { name: 'tp', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

// ===== CANCEL ORDER =====
export const CancelOrderTypes = {
  CancelOrder: [
    { name: 'walletAddress', type: 'address' },
    { name: 'orderId', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

// ===== CLOSE POSITION =====
export const ClosePositionTypes = {
  ClosePosition: [
    { name: 'walletAddress', type: 'address' },
    { name: 'positionId', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

// ===== UPDATE POSITION (leverage, SL/TP) =====
export const UpdatePositionTypes = {
  UpdatePosition: [
    { name: 'walletAddress', type: 'address' },
    { name: 'positionId', type: 'string' },
    { name: 'leverage', type: 'uint256' },
    { name: 'qty', type: 'uint256' },
    { name: 'sl', type: 'uint256' },
    { name: 'tp', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

// Value interfaces
export interface OpenOrderValue {
  walletAddress: string;
  symbol: string;
  side: 'long' | 'short';
  type: 'market' | 'limit';
  qty: bigint;
  entryPrice: bigint;
  leverage: bigint;
  sl: bigint;
  tp: bigint;
  nonce: string;
}

export interface UpdateOrderValue {
  walletAddress: string;
  orderId: string;
  qty: bigint;
  entryPrice: bigint;
  leverage: bigint;
  sl: bigint;
  tp: bigint;
  nonce: string;
}

export interface CancelOrderValue {
  walletAddress: string;
  orderId: string;
  nonce: string;
}

export interface ClosePositionValue {
  walletAddress: string;
  positionId: string;
  nonce: string;
}

export interface UpdatePositionValue {
  walletAddress: string;
  positionId: string;
  leverage: bigint;
  qty: bigint;
  sl: bigint;
  tp: bigint;
  nonce: string;
}

// ===== ACTIVATE USER =====
export const ActivateUserTypes = {
  ActivateUser: [
    { name: 'walletAddress', type: 'address' },
    { name: 'nonce', type: 'string' },
    { name: 'timestamp', type: 'string' },
  ],
} as const;

export interface ActivateUserValue {
  walletAddress: string;
  nonce: string;
  timestamp: string;
}
