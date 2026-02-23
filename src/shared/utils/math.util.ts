/**
 * Rounds a number to a specified number of decimal places.
 *
 * @param value - The number to round.
 * @param decimals - The number of decimal places.
 * @param isRoundUp - If true, rounds up (Math.ceil); if false, rounds down (Math.floor).
 * @returns The rounded number.
 */
export const roundWithPrecision = (
  value: number,
  decimals: number,
  isRoundUp: boolean,
): number => {
  const factor = Math.pow(10, decimals);
  return isRoundUp
    ? Math.ceil(value * factor) / factor
    : Math.floor(value * factor) / factor;
};

/**
 * Tính PnL (Profit and Loss) của một vị thế.
 *
 * @param side - Hướng vế thế ('long' hoặc 'short')
 * @param qty - Khối lượng
 * @param entryPrice - Giá vào lệnh
 * @param exitPrice - Giá đóng lệnh
 * @returns PnL
 */
export const calculatePnL = (
  side: 'long' | 'short',
  qty: number,
  entryPrice: number,
  exitPrice: number,
): number => {
  return side === 'long'
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;
};

/**
 * Tính số tiền thực nhận sau khi đóng lệnh và trả nợ đòn bẩy.
 * Công thức: Số tiền nhận = (Vốn ban đầu + PnL)
 * Trong đó Vốn ban đầu = (Khối lượng * Giá vào lệnh) / Đòn bẩy
 *
 * @param qty - Khối lượng
 * @param entryPrice - Giá vào lệnh
 * @param leverage - Đòn bẩy
 * @param pnl - Lợi nhuận/Thua lỗ đã tính
 * @returns Số tiền thực nhận
 */
export const calculateReceivedAmount = (
  qty: number,
  entryPrice: number,
  leverage: number,
  pnl: number,
): number => {
  const initialMargin = (qty * entryPrice) / leverage;
  return initialMargin + pnl;
};

/**
 * Tính phí giao dịch dựa trên giá trị vị thế (Notional Value).
 * Phí = Qty * Price * FeeRate
 *
 * @param qty - Khối lượng
 * @param price - Giá (entryPrice hoặc exitPrice)
 * @param feeRate - Tỷ lệ phí (e.g., 0.0001 = 0.01%)
 * @returns Phí giao dịch (USDT)
 */
export const calculateFee = (
  qty: number,
  price: number,
  feeRate: number,
): number => {
  return qty * price * feeRate;
};

/**
 * Tính Initial Margin (tiền ký quỹ cần có để mở lệnh).
 * Công thức: IM = (Qty * Price) / Leverage
 *
 * @param qty - Khối lượng
 * @param price - Giá vào lệnh
 * @param leverage - Đòn bẩy
 * @returns Tiền ký quỹ (USDT)
 */
export const calculateInitialMargin = (
  qty: number,
  price: number,
  leverage: number,
): number => {
  return (qty * price) / leverage;
};

/**
 * Tính tổng chi phí để mở lệnh (Margin + Phí).
 * Dùng để kiểm tra số dư trước khi cho phép mở lệnh.
 *
 * @param qty - Khối lượng
 * @param price - Giá vào lệnh
 * @param leverage - Đòn bẩy
 * @param feeRate - Tỷ lệ phí mở lệnh
 * @returns Tổng chi phí (USDT)
 */
export const calculateOrderCost = (
  qty: number,
  price: number,
  leverage: number,
  feeRate: number,
): number => {
  const margin = calculateInitialMargin(qty, price, leverage);
  const fee = calculateFee(qty, price, feeRate);
  return margin + fee;
};
