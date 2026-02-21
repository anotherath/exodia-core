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
