import { useState, useCallback, useEffect, useMemo } from "react";
import { useNodeData } from "@/contexts/NodeDataContext";
import {
  useExchangeRates,
  CURRENCY_SYMBOLS,
  CURRENCY_OPTIONS,
  CURRENCY_NAMES,
} from "./useExchangeRates";
import type { ExchangeRates } from "./useExchangeRates";
import type { NodeData } from "@/types/node.d";
import {
  parsePriceToCNY,
  calculateRemainingValue,
  calculateMonthlyExpense,
} from "./financeUtils";
import { ServerTradeModal } from "./ServerTradeModal";

type SortBy = "weight_asc" | "weight_desc" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "weight_asc", label: "权重 正序" },
  { value: "weight_desc", label: "权重 倒序" },
  { value: "price_asc", label: "价格 正序" },
  { value: "price_desc", label: "价格 倒序" },
];

function sortNodes(nodes: NodeData[], sortBy: SortBy): NodeData[] {
  return nodes.slice().sort((a, b) => {
    switch (sortBy) {
      case "weight_asc":
        return a.weight - b.weight;
      case "weight_desc":
        return b.weight - a.weight;
      case "price_asc":
        return a.price - b.price;
      case "price_desc":
        return b.price - a.price;
      default:
        return 0;
    }
  });
}

interface FinanceData {
  totalNodes: number;
  totalPriceCNY: number;
  monthlyPriceCNY: number;
  totalRemainValCNY: number;
  specialCases: string[];
  items: {
    node: NodeData;
    displayVal: number;
    remainingValueCNY: number;
    tooltipText: string;
    isSpecialFree: boolean;
    isLongTerm: boolean;
    isFreeTag: boolean;
  }[];
}

function calculateFinanceData(
  nodes: NodeData[],
  rates: ExchangeRates,
  userCurrency: string,
  excludeFree: boolean,
  sortBy: SortBy
): FinanceData {
  const sorted = sortNodes(nodes, sortBy);
  const targetRate = rates[userCurrency] || 1;
  const now = new Date();

  let totalPriceCNY = 0;
  let monthlyPriceCNY = 0;
  let totalRemainValCNY = 0;
  const specialCases: string[] = [];

  const items = sorted.map((node) => {
    const isFreeTag = node.tags ? node.tags.includes("白嫖中") : false;
    const { price: priceCNY, isSpecialFree } = parsePriceToCNY(node, rates);
    const { remainingValue, isLongTerm } = calculateRemainingValue(
      node,
      rates,
      now
    );
    const monthly = calculateMonthlyExpense(priceCNY, node.billing_cycle);

    let tooltipText = "";
    if (isSpecialFree) {
      specialCases.push(`${node.name} (免费鸡)`);
      tooltipText = `${node.name} (免费鸡)`;
    } else if (isLongTerm) {
      specialCases.push(`${node.name} (长期鸡，按原价)`);
      tooltipText = `到期时间 > 100年，按原价计算`;
    } else if (isFreeTag && !(excludeFree && isFreeTag)) {
      specialCases.push(`${node.name} (白嫖中)`);
      tooltipText = `${node.name} (白嫖中)`;
    }

    const shouldExclude = excludeFree && isFreeTag;
    if (!shouldExclude) {
      totalPriceCNY += priceCNY;
      monthlyPriceCNY += monthly;
      totalRemainValCNY += remainingValue;
    }

    return {
      node,
      displayVal: remainingValue * targetRate,
      remainingValueCNY: remainingValue,
      tooltipText,
      isSpecialFree,
      isLongTerm,
      isFreeTag,
    };
  });

  return {
    totalNodes: nodes.length,
    totalPriceCNY,
    monthlyPriceCNY,
    totalRemainValCNY,
    specialCases,
    items,
  };
}

export function FinanceWidget() {
  const { nodes } = useNodeData();
  const { rates, lastUpdated, refreshRates } = useExchangeRates();
  const [isOpen, setIsOpen] = useState(false);
  const [ballVisible, setBallVisible] = useState(false);
  const [userCurrency, setUserCurrency] = useState<string>(
    () => localStorage.getItem("fin_currency") || "CNY"
  );
  const [sortBy, setSortBy] = useState<SortBy>(
    () => (localStorage.getItem("fin_sort") as SortBy) || "weight_asc"
  );
  const [excludeFree, setExcludeFree] = useState<boolean>(() => {
    const stored = localStorage.getItem("fin_exclude_free");
    if (stored === null) return true;
    return stored === "true";
  });
  const [tradeNode, setTradeNode] = useState<NodeData | null>(null);
  const [showRatesInfo, setShowRatesInfo] = useState(false);

  // 延迟显示悬浮球
  useEffect(() => {
    const timer = setTimeout(() => setBallVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const financeData = useMemo(
    () => calculateFinanceData(nodes, rates, userCurrency, excludeFree, sortBy),
    [nodes, rates, userCurrency, excludeFree, sortBy]
  );

  const sym = CURRENCY_SYMBOLS[userCurrency] || userCurrency;
  const targetRate = rates[userCurrency] || 1;

  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setUserCurrency(val);
      localStorage.setItem("fin_currency", val);
    },
    []
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value as SortBy;
      setSortBy(val);
      localStorage.setItem("fin_sort", val);
    },
    []
  );

  const handleToggleFree = useCallback(() => {
    setExcludeFree((prev) => {
      const next = !prev;
      localStorage.setItem("fin_exclude_free", String(next));
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    refreshRates();
  }, [refreshRates]);

  const handleBallClick = useCallback(() => {
    setBallVisible(false);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setBallVisible(true);
  }, []);

  // 汇率列表
  const ratesList = useMemo(() => {
    const all = ["USD", "HKD", "EUR", "GBP", "JPY", "CNY"].filter(
      (c) => c !== userCurrency
    );
    return all.map((c) => ({
      code: c,
      name: CURRENCY_NAMES[c] || c,
      rate: (rates[userCurrency] || 1) / (rates[c] || 1),
    }));
  }, [rates, userCurrency]);

  return (
    <>
      {/* 资产悬浮球 */}
      <div
        id="finance-ball"
        className={`finance-ball${ballVisible && !isOpen ? " show" : ""}`}
        onClick={handleBallClick}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 18V6" />
        </svg>
      </div>

      {/* 资产面板 */}
      <div
        id="finance-widget"
        className={`finance-widget${isOpen ? " show" : ""}`}>
        <div className="bubble-header">
          <h3 className="bubble-title">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
              <path d="M12 18V6" />
            </svg>
            资产统计
          </h3>
          <button className="bubble-close" onClick={handleClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
            </svg>
          </button>
        </div>
        <div className="bubble-content">
          {/* 汇总 */}
          <div className="finance-row">
            <span>服务器数量</span>
            <span className="finance-value">{financeData.totalNodes}</span>
          </div>
          <div className="finance-row">
            <span>总价值</span>
            <span className="finance-value">
              {sym} {(financeData.totalPriceCNY * targetRate).toFixed(2)}
            </span>
          </div>
          <div className="finance-row">
            <span>月均支出</span>
            <span className="finance-value">
              {sym} {(financeData.monthlyPriceCNY * targetRate).toFixed(2)}
            </span>
          </div>
          <div className="finance-row">
            <span>剩余总价值</span>
            <div className="item-right">
              <span className="finance-value">
                {sym}{" "}
                {(financeData.totalRemainValCNY * targetRate).toFixed(2)}
              </span>
              {financeData.specialCases.length > 0 && (
                <div
                  className="help-icon show-help"
                  data-tooltip={financeData.specialCases.join("\n")}
                  onClick={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).classList.toggle("active");
                  }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="finance-separator" />

          {/* 服务器列表 */}
          <div className="finance-list">
            {financeData.items.map((item) => (
              <div
                key={item.node.uuid}
                className="finance-list-item"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".help-icon")) return;
                  setTradeNode(item.node);
                }}>
                <span
                  className="item-name"
                  title={item.node.public_remark || item.node.name}>
                  {item.node.name}
                </span>
                <div className="item-right">
                  <span className="item-value">
                    {sym} {item.displayVal.toFixed(2)}
                  </span>
                  {item.tooltipText && (
                    <div
                      className="help-icon"
                      data-tooltip={item.tooltipText}
                      onClick={(e) => {
                        e.stopPropagation();
                        (e.currentTarget as HTMLElement).classList.toggle(
                          "active"
                        );
                      }}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 汇率信息 */}
          <div
            className="finance-tooltip"
            style={{ cursor: "pointer" }}
            onClick={() => setShowRatesInfo((p) => !p)}>
            {lastUpdated
              ? lastUpdated === "使用默认汇率"
                ? "使用默认汇率"
                : `汇率更新: ${lastUpdated}`
              : "汇率更新中..."}
          </div>

          {showRatesInfo && (
            <>
              <div className="finance-separator" />
              <div className="finance-exchange-rates">
                {ratesList.map((r) => (
                  <div key={r.code} className="finance-rate-item">
                    <span>1 {r.name}</span>
                    <span className="finance-rate-value">
                      {sym} {r.rate.toFixed(6)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 控制栏 */}
          <div className="finance-controls">
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className="finance-select"
                value={userCurrency}
                onChange={handleCurrencyChange}>
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="finance-select"
                value={sortBy}
                onChange={handleSortChange}>
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <button
                className={`finance-btn${excludeFree ? " active" : ""}`}
                title={
                  excludeFree
                    ? "当前：已排除白嫖中标签"
                    : "当前：包含白嫖中标签"
                }
                onClick={handleToggleFree}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M19 5c-1.5 0-2.8 0.6-3.8 1.6l-1.2 1.2-1.2-1.2C11.8 5.6 10.5 5 9 5 5.5 5 3 7.6 3 11c0 3.5 3 7.6 9 13 6-5.4 9-9.5 9-13 0-3.4-2.5-6-6-6z" />
                </svg>
              </button>
              <button
                className="finance-btn"
                title="刷新数据"
                onClick={handleRefresh}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 交易模态框 */}
      {tradeNode && (
        <ServerTradeModal
          node={tradeNode}
          rates={rates}
          userCurrency={userCurrency}
          onClose={() => setTradeNode(null)}
        />
      )}
    </>
  );
}
