import { useState, useCallback, useEffect, useRef } from "react";
import type { NodeData } from "@/types/node.d";
import type { ExchangeRates } from "./useExchangeRates";
import { CURRENCY_SYMBOLS } from "./useExchangeRates";
import { EMOJI_MAP } from "./emojiMap";
import {
  calculateRemainValueForDate,
  formatBytes,
  formatTraffic,
  getBillingCycleText,
} from "./financeUtils";
import { useLocale } from "@/config/hooks";

interface ServerTradeModalProps {
  node: NodeData;
  rates: ExchangeRates;
  userCurrency: string;
  onClose: () => void;
}

export function ServerTradeModal({
  node,
  rates,
  userCurrency,
  onClose,
}: ServerTradeModalProps) {
  const { t, i18n } = useLocale();
  const targetRate = rates[userCurrency] || 1;
  const sym = CURRENCY_SYMBOLS[userCurrency] || userCurrency;
  const regionCode = EMOJI_MAP[node.region] || node.region || "UN";

  // 日期和金额
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" })
  );
  const todayStr = today.toISOString().split("T")[0];
  const [tradeDate, setTradeDate] = useState(todayStr);
  const [tradeAmount, setTradeAmount] = useState("");

  // 计算剩余价值
  const remainValueCNY = calculateRemainValueForDate(node, rates, tradeDate);
  const displayRemainValue = parseFloat(
    (remainValueCNY * targetRate).toFixed(2)
  );

  // 溢价计算
  const amount = parseFloat(tradeAmount);
  const hasAmount = !isNaN(amount) && amount >= 0;
  const premium = hasAmount ? amount - displayRemainValue : NaN;
  const premiumRate =
    hasAmount && displayRemainValue > 0
      ? (premium / displayRemainValue) * 100
      : 0;

  // 到期时间处理
  let expiredText = "-";
  if (node.expired_at) {
    const expiryDate = new Date(node.expired_at);
    const dateOnlyString = expiryDate.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Shanghai",
    });
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) expiredText = `${dateOnlyString} ${t("enhanced.trade.remainingDays", { days: diffDays })}`;
    else if (diffDays === 0) expiredText = `${dateOnlyString} ${t("enhanced.trade.expiresToday")}`;
    else
      expiredText = `${dateOnlyString} ${t("enhanced.trade.expiredDays", { days: Math.abs(diffDays) })}`;
  }

  // tags & remarks
  const tags = node.tags
    ? node.tags
        .split(";")
        .filter((t) => t.trim())
        .map((t) => t.trim())
    : [];
  const remarks = node.public_remark
    ? node.public_remark
        .split(";")
        .filter((r) => r.trim())
        .map((r) => r.trim())
    : [];

  // 拖拽逻辑
  const modalRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragInitial = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if ((e.target as HTMLElement).closest(".bubble-close")) return;
      const modal = modalRef.current;
      if (!modal) return;

      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : e.clientY;

      dragInitial.current = {
        x: clientX - (modal.offsetLeft || 0),
        y: clientY - (modal.offsetTop || 0),
      };
      isDragging.current = true;
      modal.style.position = "absolute";
    },
    []
  );

  useEffect(() => {
    const handleDrag = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const modal = modalRef.current;
      if (!modal) return;

      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : e.clientY;

      modal.style.left = clientX - dragInitial.current.x + "px";
      modal.style.top = clientY - dragInitial.current.y + "px";
    };
    const handleDragEnd = () => {
      isDragging.current = false;
    };

    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDrag, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
    return () => {
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchmove", handleDrag);
      document.removeEventListener("touchend", handleDragEnd);
    };
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      id="server-trade-overlay"
      className="custom-alert-overlay"
      style={{
        display: "flex",
        opacity: 1,
        pointerEvents: "none",
        backgroundColor: "transparent",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
      onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        id="server-trade-modal"
        className="server-trade-modal"
        style={{ pointerEvents: "auto", transform: "scale(1)" }}>
        <div
          className="bubble-header server-trade-header"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}>
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
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            {t("enhanced.trade.title")}
            <span
              className="help-icon show-help"
              data-tooltip={t("enhanced.trade.calcRules")}
              onClick={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLElement).classList.toggle("active");
              }}>
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
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
          </h3>
          <button className="bubble-close" onClick={onClose}>
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

        <div className="bubble-content server-trade-content">
          {/* 服务器信息 */}
          <div className="trade-section">
            <div className="trade-section-title">
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
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              {t("enhanced.trade.serverInfo")}
            </div>
            <div className="server-info-grid">
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.region")}</span>
                <span className="info-value">
                  <img
                    src={`/assets/flags/${regionCode}.svg`}
                    style={{ width: 20, height: "auto" }}
                    alt={regionCode}
                  />
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.name")}</span>
                <span className="info-value">{node.name}</span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.cpu")}</span>
                <span className="info-value">
                  {node.cpu_name || t("enhanced.trade.unknown")}
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.cores")}</span>
                <span className="info-value">
                  {node.cpu_cores ? t("enhanced.trade.coresUnit", { count: node.cpu_cores }) : t("enhanced.trade.unknown")}
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.arch")}</span>
                <span className="info-value">{node.arch || t("enhanced.trade.unknown")}</span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.virtualization")}</span>
                <span className="info-value">
                  {node.virtualization || t("enhanced.trade.unknown")}
                </span>
              </div>
              {node.gpu_name && node.gpu_name !== "None" && (
                <div className="server-info-row">
                  <span className="info-label">{t("enhanced.trade.gpu")}</span>
                  <span className="info-value">{node.gpu_name}</span>
                </div>
              )}
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.memory")}</span>
                <span className="info-value">
                  {node.mem_total ? formatBytes(node.mem_total) : t("enhanced.trade.unknown")}
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.disk")}</span>
                <span className="info-value">
                  {node.disk_total ? formatBytes(node.disk_total) : t("enhanced.trade.unknown")}
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.traffic")}</span>
                <span className="info-value">
                  {node.traffic_limit
                    ? formatTraffic(node.traffic_limit, t)
                    : t("enhanced.trade.unknown")}
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.originalPrice")}</span>
                <span className="info-value">
                  {node.currency || "¥"}{" "}
                  {node.price === -1 ? t("enhanced.trade.free") : node.price}
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.cycle")}</span>
                <span className="info-value">
                  {getBillingCycleText(node.billing_cycle, t)}
                </span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{t("enhanced.trade.expiryTime")}</span>
                <span className="info-value">{expiredText}</span>
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="trade-tags-container">
                <span className="trade-tags-label">{t("enhanced.trade.tags")}</span>
                <div className="trade-tags-list">
                  {tags.map((tag, i) => (
                    <span key={i} className="trade-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Remarks */}
            {remarks.length > 0 && (
              <div className="trade-remark-container">
                <span className="trade-remark-label">{t("enhanced.trade.remarks")}</span>
                <div className="trade-remark-list">
                  {remarks.map((remark, i) => (
                    <span key={i} className="trade-remark-tag">
                      {remark}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="finance-separator" />

          {/* 交易计算 */}
          <div className="trade-section">
            <div className="trade-section-title">
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
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                <path d="M12 18V6" />
              </svg>
              {t("enhanced.trade.tradeCalc")}
            </div>

            <div className="trade-input-group">
              <label className="trade-label">{t("enhanced.trade.tradeDate")}</label>
              <input
                type="date"
                className="trade-input"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
              />
            </div>

            <div className="trade-input-group">
              <label className="trade-label">{t("enhanced.trade.tradeAmount")}</label>
              <input
                type="number"
                className="trade-input"
                placeholder={t("enhanced.trade.tradeAmountPlaceholder")}
                step="0.01"
                min="0"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
              />
            </div>

            <div className="trade-result-box">
              <div className="trade-result-row">
                <span>{t("enhanced.trade.remainValue")}</span>
                <span className="trade-result-value">
                  {sym} {displayRemainValue.toFixed(2)}
                </span>
              </div>
              <div className="trade-result-row">
                <span>{t("enhanced.trade.premiumAmount")}</span>
                <span
                  className={`trade-result-value premium${
                    hasAmount && premium <= 0 ? " positive" : ""
                  }`}>
                  {hasAmount
                    ? `${sym} ${premium.toFixed(2)}`
                    : "-"}
                </span>
              </div>
              <div className="trade-result-row">
                <span>{t("enhanced.trade.premiumRate")}</span>
                <span
                  className={`trade-result-value premium${
                    hasAmount && premium <= 0 ? " positive" : ""
                  }`}>
                  {hasAmount
                    ? `${premiumRate > 0 ? "+" : ""}${premiumRate.toFixed(2)}%`
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
