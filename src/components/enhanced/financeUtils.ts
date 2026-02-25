import type { NodeData } from "@/types/node.d";
import type { ExchangeRates } from "./useExchangeRates";

// 到期时间超过多少年视为无限期（按原价计算）
const LONG_TERM_YEARS = 100;

/**
 * 将节点价格解析为人民币（CNY）
 * 返回 { price: CNY金额, isSpecialFree: 是否为免费鸡(price=-1) }
 */
export function parsePriceToCNY(
  node: NodeData,
  rates: ExchangeRates
): { price: number; isSpecialFree: boolean } {
  let price = parseFloat(String(node.price));
  let isSpecialFree = false;

  if (price === -1) {
    price = 0;
    isSpecialFree = true;
  } else if (isNaN(price)) {
    price = 0;
  }

  let cur = node.currency || "¥";
  if (cur === "CNY") cur = "¥";

  let finalPrice = 0;
  if (cur === "¥") finalPrice = price;
  else if (cur === "HK$") finalPrice = price / (rates.HKD || 1.08);
  else if (cur === "$" || cur === "USD") finalPrice = price / (rates.USD || 0.14);
  else if (cur === "€" || cur === "EUR") finalPrice = price / (rates.EUR || 0.13);
  else if (cur === "£" || cur === "GBP") finalPrice = price / (rates.GBP || 0.11);
  else finalPrice = price;

  return { price: finalPrice, isSpecialFree };
}

/**
 * 计算节点剩余价值（CNY）
 * - 超过100年视为长期鸡，按原价计算
 * - 已过期返回0
 */
export function calculateRemainingValue(
  node: NodeData,
  rates: ExchangeRates,
  date: Date = new Date()
): { remainingValue: number; isLongTerm: boolean } {
  if (!node.expired_at) return { remainingValue: 0, isLongTerm: false };

  const { price: priceCNY } = parsePriceToCNY(node, rates);
  const exp = new Date(node.expired_at);
  const nowUTC = new Date(date.toISOString());
  const diffMs = exp.getTime() - nowUTC.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365);

  if (diffYears > LONG_TERM_YEARS) {
    return { remainingValue: priceCNY, isLongTerm: true };
  }

  const billingCycleMs = node.billing_cycle * 24 * 60 * 60 * 1000;
  if (diffMs > 0 && billingCycleMs > 0) {
    return { remainingValue: priceCNY * (diffMs / billingCycleMs), isLongTerm: false };
  }

  return { remainingValue: 0, isLongTerm: false };
}

/**
 * 计算月均支出（CNY）
 */
export function calculateMonthlyExpense(
  priceCNY: number,
  billingCycleDays: number
): number {
  let cycleMonths = 1;
  if (billingCycleDays === 365) cycleMonths = 12;
  else if (billingCycleDays === 30) cycleMonths = 1;
  else if (billingCycleDays > 0) cycleMonths = billingCycleDays / 30;

  return cycleMonths > 0 ? priceCNY / cycleMonths : 0;
}

/**
 * 货币转换：将 CNY 金额转换为目标货币
 */
export function convertCurrency(
  valueCNY: number,
  targetCurrency: string,
  rates: ExchangeRates
): number {
  const targetRate = rates[targetCurrency] || 1;
  return valueCNY * targetRate;
}

/**
 * 根据选择的日期计算剩余价值（CNY）
 * 如果选择的是今天，使用当前精确时间
 * 否则使用该天的 00:00:00 (+08:00)
 */
export function calculateRemainValueForDate(
  node: NodeData,
  rates: ExchangeRates,
  selectedDateStr: string
): number {
  const now = new Date();
  const todayStr = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" })
  )
    .toISOString()
    .split("T")[0];

  let calculationTime: Date;
  if (selectedDateStr === todayStr) {
    calculationTime = now;
  } else {
    calculationTime = new Date(selectedDateStr + "T00:00:00+08:00");
  }

  if (!node.expired_at) return 0;

  const { price: priceCNY } = parsePriceToCNY(node, rates);
  const exp = new Date(node.expired_at);
  const nowUTC = new Date(calculationTime.toISOString());
  const diffMs = exp.getTime() - nowUTC.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365);

  if (diffYears > LONG_TERM_YEARS) {
    return priceCNY;
  }

  const billingCycleMs = node.billing_cycle * 24 * 60 * 60 * 1000;
  if (diffMs > 0 && billingCycleMs > 0) {
    return priceCNY * (diffMs / billingCycleMs);
  }

  return 0;
}

/**
 * 格式化字节
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 格式化流量
 */
export function formatTraffic(bytes: number): string {
  if (bytes === 362838837166080) return "∞TB/月";
  if (bytes === 0) return "无限制";
  return formatBytes(bytes) + "/月";
}

/**
 * 计费周期文本
 */
export function getBillingCycleText(days: number): string {
  const cycleMap: Record<string, string> = {
    "30": "月付",
    "92": "季付",
    "365": "年付",
    "730": "两年付",
    "-1": "一次性",
  };
  return cycleMap[String(days)] || `${days}天`;
}
