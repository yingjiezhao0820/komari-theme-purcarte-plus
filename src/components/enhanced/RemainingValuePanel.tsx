import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/config/hooks";
import type { NodeData } from "@/types/node.d";
import { Check, Copy, X } from "lucide-react";
import { CURRENCY_OPTIONS, CURRENCY_SYMBOLS, useExchangeRates } from "./useExchangeRates";
import {
  calculateOriginalRemainValueForDate,
  getBillingCycleText,
  normalizeCurrencyToCode,
} from "./financeUtils";

type RemainingValueNode = Pick<
  NodeData,
  "price" | "currency" | "billing_cycle" | "expired_at"
>;

interface RemainingValuePanelProps {
  node: RemainingValueNode;
  initialCurrency?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getTodayInShanghai() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" })
  )
    .toISOString()
    .slice(0, 10);
}

function formatDate(value: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function calculateRemainingDays(expiredAt: string | null, tradeDate: string) {
  if (!expiredAt || !tradeDate) return 0;
  const expiryDateStr = formatDate(expiredAt);
  if (expiryDateStr === "-") return 0;
  const expiryTime = new Date(`${expiryDateStr}T00:00:00+08:00`).getTime();
  const tradeTime = new Date(`${tradeDate}T00:00:00+08:00`).getTime();
  const raw = Math.floor((expiryTime - tradeTime) / MS_PER_DAY);
  return Math.max(0, raw);
}

function formatRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return "1";
  return String(Number(rate.toFixed(6)));
}

function formatStamp(date: Date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(
    date.getHours()
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
    date.getSeconds()
  ).padStart(2, "0")}`;
}

export function RemainingValuePanel({
  node,
  initialCurrency,
}: RemainingValuePanelProps) {
  const { t } = useLocale();
  const sourceCurrencyCode = useMemo(
    () => normalizeCurrencyToCode(node.currency || "¥"),
    [node.currency]
  );
  const sourceCurrencySymbol =
    CURRENCY_SYMBOLS[sourceCurrencyCode] || node.currency || sourceCurrencyCode;
  const todayStr = useMemo(() => getTodayInShanghai(), []);
  const [selectedCurrency, setSelectedCurrency] = useState(
    initialCurrency || sourceCurrencyCode
  );
  useEffect(() => {
    setSelectedCurrency(initialCurrency || sourceCurrencyCode);
  }, [initialCurrency, sourceCurrencyCode]);

  const { rates } = useExchangeRates(selectedCurrency);
  const targetCurrencySymbol =
    CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency;
  const referenceRate = useMemo(() => {
    if (sourceCurrencyCode === selectedCurrency) return 1;
    const rate = rates[sourceCurrencyCode];
    if (Number.isFinite(rate) && rate > 0) {
      return 1 / rate;
    }
    return 1;
  }, [rates, selectedCurrency, sourceCurrencyCode]);

  const [tradeDate, setTradeDate] = useState(todayStr);
  const [customRateInput, setCustomRateInput] = useState(formatRate(referenceRate));
  const [isCustomRateDirty, setIsCustomRateDirty] = useState(false);

  useEffect(() => {
    if (!isCustomRateDirty) {
      setCustomRateInput(formatRate(referenceRate));
    }
  }, [referenceRate, isCustomRateDirty]);

  const currencyOptions = useMemo(() => {
    const base = [...CURRENCY_OPTIONS];
    const seen = new Set(base.map((option) => option.value));

    if (!seen.has(sourceCurrencyCode)) {
      base.unshift({
        value: sourceCurrencyCode,
        label: `${sourceCurrencyCode} (${sourceCurrencySymbol})`,
      });
    }

    if (!seen.has(selectedCurrency) && selectedCurrency !== sourceCurrencyCode) {
      base.unshift({
        value: selectedCurrency,
        label: `${selectedCurrency} (${CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency})`,
      });
    }

    return base;
  }, [selectedCurrency, sourceCurrencyCode, sourceCurrencySymbol]);

  const parsedCustomRate = parseFloat(customRateInput);
  const appliedRate =
    Number.isFinite(parsedCustomRate) && parsedCustomRate > 0
      ? parsedCustomRate
      : referenceRate;
  const originalRemainValue = useMemo(
    () => calculateOriginalRemainValueForDate(node, tradeDate),
    [node, tradeDate]
  );
  const remainingValue = originalRemainValue * appliedRate;
  const remainingDays = useMemo(
    () => calculateRemainingDays(node.expired_at, tradeDate),
    [node.expired_at, tradeDate]
  );
  const exportText = useMemo(
    () => `\`\`\`markdown
## ${t("enhanced.trade.panelTitle")}

### Input
- ${t("enhanced.trade.referenceRate")}: ${referenceRate.toFixed(6)}
- ${t("enhanced.trade.appliedRate")}: ${appliedRate.toFixed(6)}
- ${t("enhanced.trade.originalPrice")}: ${sourceCurrencySymbol}${node.price === -1 ? t("enhanced.trade.free") : Number(node.price).toFixed(2)}
- ${t("enhanced.trade.currency")}: ${selectedCurrency}
- ${t("enhanced.trade.cycle")}: ${getBillingCycleText(node.billing_cycle, t)}
- ${t("enhanced.trade.expiryTime")}: ${formatDate(node.expired_at)}
- ${t("enhanced.trade.tradeDate")}: ${tradeDate}

### Result
- ${t("enhanced.trade.remainingDaysLabel")}: ${remainingDays}
- ${t("enhanced.trade.remainValue")}: ${targetCurrencySymbol}${remainingValue.toFixed(2)}

*${formatStamp(new Date())}*
\`\`\``,
    [
      appliedRate,
      node.billing_cycle,
      node.expired_at,
      node.price,
      referenceRate,
      remainingDays,
      remainingValue,
      selectedCurrency,
      sourceCurrencySymbol,
      t,
      targetCurrencySymbol,
      tradeDate,
    ]
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  const handleResetRate = () => {
    setIsCustomRateDirty(false);
    setCustomRateInput(formatRate(referenceRate));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus("success");
    } catch {
      try {
        const item = new ClipboardItem({
          "text/plain": new Blob([exportText], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
        setCopyStatus("success");
      } catch {
        setCopyStatus("error");
      }
    }

    window.setTimeout(() => setCopyStatus("idle"), 2000);
  };

  return (
    <div className="flex w-[20rem] max-w-[80vw] flex-col gap-2 text-sm select-text">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold">{t("enhanced.trade.panelTitle")}</div>
        <Button size="sm" variant="secondary" onClick={handleCopy} title={t("copy")}>
          {copyStatus === "success" ? (
            <Check className="size-4 text-green-600" />
          ) : copyStatus === "error" ? (
            <X className="size-4 text-red-600" />
          ) : (
            <Copy className="size-4" />
          )}
          {t("copy")}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-3">
          <span>{t("enhanced.trade.tradeDate")}</span>
          <span>{tradeDate}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{t("enhanced.trade.expiryTime")}</span>
          <span>{formatDate(node.expired_at)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{t("enhanced.trade.originalPrice")}</span>
          <span>
            {sourceCurrencySymbol} {node.price === -1 ? t("enhanced.trade.free") : Number(node.price).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{t("enhanced.trade.cycle")}</span>
          <span>{getBillingCycleText(node.billing_cycle, t)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{t("enhanced.trade.remainingDaysLabel")}</span>
          <span>{remainingDays}</span>
        </div>
        <div className="flex justify-between gap-3 font-semibold">
          <span>{t("enhanced.trade.remainValue")}</span>
          <span className="text-(--accent-11)">
            {targetCurrencySymbol} {remainingValue.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-1 rounded-lg border border-(--accent-a4) p-2 theme-card-style flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("enhanced.trade.customRate")}</span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            className="h-8 w-28"
            value={customRateInput}
            onChange={(e) => {
              setIsCustomRateDirty(true);
              setCustomRateInput(e.target.value);
            }}
            onBlur={() => {
              const next = parseFloat(customRateInput);
              if (!Number.isFinite(next) || next <= 0) {
                setIsCustomRateDirty(false);
                setCustomRateInput(formatRate(referenceRate));
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("enhanced.trade.currency")}</span>
          <select
            className="h-8 w-40 rounded-md border border-(--accent-a4) bg-background px-2"
            value={selectedCurrency}
            onChange={(e) => {
              setSelectedCurrency(e.target.value);
              setIsCustomRateDirty(false);
            }}>
            {currencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("enhanced.trade.tradeDate")}</span>
          <Input
            type="date"
            className="h-8 w-40"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value || todayStr)}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          {t("enhanced.trade.referenceRate")}: 1 {sourceCurrencySymbol} ≈ {referenceRate.toFixed(6)} {targetCurrencySymbol}
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={handleResetRate}>
            {t("enhanced.trade.resetRate")}
          </Button>
        </div>
      </div>
    </div>
  );
}
