import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

export interface PortfolioHistoryPoint {
  time: string;
  value: number;
}

function generateDemoPoints(initialBalance: number, seed: number): PortfolioHistoryPoint[] {
  const now = Date.now();
  const points: PortfolioHistoryPoint[] = [];
  let val = initialBalance;
  // Deterministic pseudo-random based on seed to avoid re-renders changing values
  let r = seed;
  const rand = () => { r = (r * 1664525 + 1013904223) & 0xffffffff; return (r >>> 0) / 0xffffffff; };
  for (let i = 0; i <= 40; i++) {
    const t = now - (40 - i) * 8 * 60 * 1000;
    val = val + (rand() - 0.42) * 18000 + 800;
    points.push({ time: new Date(t).toISOString(), value: Math.max(val, initialBalance * 0.85) });
  }
  return points;
}

export function usePortfolioHistory({
  investorId,
  initialBalance,
}: {
  investorId?: string;
  initialBalance?: number;
}) {
  const [points, setPoints] = useState<PortfolioHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const demoPoints = useMemo(
    () => generateDemoPoints(initialBalance ?? 1000000, 42),
    [initialBalance]
  );

  useEffect(() => {
    if (!investorId || !initialBalance) {
      setPoints(demoPoints);
      setIsLoading(false);
      return;
    }

    const fetch = async () => {
      const { data: trades } = await supabase
        .from("trades")
        .select("created_at, amount, shares, type, founder_id, price_per_share")
        .eq("investor_id", investorId)
        .order("created_at", { ascending: true });

      if (!trades || trades.length === 0) {
        setPoints([
          { time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), value: initialBalance },
          { time: new Date().toISOString(), value: initialBalance },
        ]);
        setIsLoading(false);
        return;
      }

      let cash = initialBalance;
      const sharesHeld: Record<string, number> = {};
      const lastPrice: Record<string, number> = {};

      const result: PortfolioHistoryPoint[] = [
        { time: trades[0].created_at, value: initialBalance },
      ];

      for (const t of trades) {
        if (t.type === "buy") {
          cash -= Number(t.amount);
          sharesHeld[t.founder_id] = (sharesHeld[t.founder_id] || 0) + Number(t.shares);
        } else {
          cash += Number(t.amount);
          sharesHeld[t.founder_id] = Math.max(0, (sharesHeld[t.founder_id] || 0) - Number(t.shares));
        }
        lastPrice[t.founder_id] = Number(t.price_per_share);

        const holdingsValue = Object.entries(sharesHeld).reduce(
          (sum, [fid, shares]) => sum + shares * (lastPrice[fid] || 0),
          0
        );

        result.push({ time: t.created_at, value: Math.max(0, cash + holdingsValue) });
      }

      // Add current moment as final point
      result.push({ time: new Date().toISOString(), value: result[result.length - 1].value });

      setPoints(result);
      setIsLoading(false);
    };

    fetch();
  }, [investorId, initialBalance, demoPoints]);

  return { points, isLoading };
}
