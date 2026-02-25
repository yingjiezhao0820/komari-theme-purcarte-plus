import { useState, useEffect, useCallback, useRef } from "react";

export interface ExchangeRates {
  CNY: number;
  USD: number;
  HKD: number;
  EUR: number;
  GBP: number;
  JPY: number;
  [key: string]: number;
}

const FALLBACK_RATES: ExchangeRates = {
  CNY: 1,
  USD: 0.142536,
  HKD: 1.108377,
  EUR: 0.12102,
  GBP: 0.105581,
  JPY: 22.231552,
};

let cachedRates: ExchangeRates | null = null;
let cachedLastUpdated: string | null = null;
let fetchPromise: Promise<{ rates: ExchangeRates; lastUpdated: string }> | null =
  null;

const apis = [
  {
    url: "https://open.er-api.com/v6/latest/CNY",
    parse: (data: any): Record<string, number> | null => data.rates || null,
  },
  {
    url: "https://api.frankfurter.app/latest?from=CNY",
    parse: (data: any): Record<string, number> | null => data.rates || null,
  },
];

const REQUIRED_CURRENCIES = ["USD", "HKD", "EUR", "GBP", "JPY"];

async function fetchRatesFromAPIs(): Promise<{
  rates: ExchangeRates;
  lastUpdated: string;
}> {
  if (cachedRates && cachedLastUpdated) {
    return { rates: cachedRates, lastUpdated: cachedLastUpdated };
  }
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    for (const api of apis) {
      try {
        const res = await fetch(api.url, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          const rates = api.parse(data);
          if (rates) {
            const hasAll = REQUIRED_CURRENCIES.every((cur) => rates[cur]);
            if (hasAll) {
              const result: ExchangeRates = { CNY: 1, ...rates } as ExchangeRates;
              const lastUpdated = new Date().toLocaleTimeString();
              cachedRates = result;
              cachedLastUpdated = lastUpdated;
              return { rates: result, lastUpdated };
            }
          }
        }
      } catch (e) {
        console.warn(`从 ${api.url} 获取汇率失败:`, e);
      }
    }
    cachedRates = { ...FALLBACK_RATES };
    cachedLastUpdated = "使用默认汇率";
    return { rates: cachedRates, lastUpdated: cachedLastUpdated };
  })();

  return fetchPromise;
}

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates>(
    cachedRates || FALLBACK_RATES
  );
  const [lastUpdated, setLastUpdated] = useState<string>(
    cachedLastUpdated || ""
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetchRatesFromAPIs().then(({ rates: r, lastUpdated: t }) => {
      if (mounted.current) {
        setRates(r);
        setLastUpdated(t);
      }
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshRates = useCallback(() => {
    cachedRates = null;
    cachedLastUpdated = null;
    fetchPromise = null;
    fetchRatesFromAPIs().then(({ rates: r, lastUpdated: t }) => {
      if (mounted.current) {
        setRates(r);
        setLastUpdated(t);
      }
    });
  }, []);

  return { rates, lastUpdated, refreshRates };
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

export const CURRENCY_OPTIONS = [
  { value: "CNY", label: "CNY (¥)" },
  { value: "USD", label: "USD ($)" },
  { value: "HKD", label: "HKD (HK$)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "JPY", label: "JPY (¥)" },
];

export const CURRENCY_NAMES: Record<string, string> = {
  USD: "USD $",
  HKD: "HKD $",
  EUR: "EUR €",
  GBP: "GBP £",
  JPY: "JPY ¥",
  CNY: "CNY ¥",
};
