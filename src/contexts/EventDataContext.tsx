import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { Event, EventSettings } from "../types/Event";
import { Founder, FounderUserEmbed, FounderWithPriceAndUser } from "../types/Founder";
import { Investor, InvestorHolding, InvestorHoldingWithValue, EventInvestorEntry } from "../types/Investor";
import { calculateCurrentPrice, calculateMarketCap } from "../lib/ammEngine";

export type { FounderUserEmbed, FounderWithPriceAndUser, EventInvestorEntry };

// ─── Public types ────────────────────────────────────────────────────────────

export interface PricePoint {
  id: string;
  founder_id: string;
  price: number;
  shares_in_pool: number;
  recorded_at: string;
}

// ─── Context interface ────────────────────────────────────────────────────────

interface EventDataContextValue {
  event: Event | null;
  eventSettings: EventSettings | null;
  founders: FounderWithPriceAndUser[];
  investor: Investor | null;
  holdings: InvestorHoldingWithValue[];
  investorId: string | null;
  allInvestors: EventInvestorEntry[];
  portfolioValue: number;
  roiPercent: number;
  priceHistoryMap: Map<string, PricePoint[]>;
  isLoading: boolean;
  error: string | null;
  // Transition signals for event.tsx UI (countdown timer, toast)
  closingAt: string | null;
  tradingJustStarted: boolean;
  refetchInvestor: () => Promise<void>;
  registerForEvent: () => Promise<void>;
}

const EventDataContext = createContext<EventDataContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrichFounder(raw: any): FounderWithPriceAndUser {
  const founder: Founder = {
    id: raw.id,
    event_id: raw.event_id,
    founder_user_id: raw.founder_user_id,
    name: raw.name,
    bio: raw.bio ?? null,
    logo_url: raw.logo_url ?? null,
    pitch_summary: raw.pitch_summary ?? null,
    pitch_url: raw.pitch_url ?? null,
    shares_in_pool: Number(raw.shares_in_pool),
    cash_in_pool: Number(raw.cash_in_pool),
    k_constant: Number(raw.k_constant),
    min_reserve_shares: Number(raw.min_reserve_shares),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
  return {
    ...founder,
    current_price: calculateCurrentPrice(founder),
    market_cap: calculateMarketCap(founder),
    founder_user: raw.founder_users ?? raw.founder_user ?? null,
  };
}

function computePortfolioMetrics(
  investor: Investor | null,
  holdings: InvestorHolding[],
  founders: FounderWithPriceAndUser[]
): { holdingsWithValue: InvestorHoldingWithValue[]; portfolioValue: number; roiPercent: number } {
  if (!investor) {
    return { holdingsWithValue: [], portfolioValue: 0, roiPercent: 0 };
  }

  const holdingsWithValue: InvestorHoldingWithValue[] = holdings.map((h) => {
    const founder = founders.find((f) => f.id === h.founder_id);
    const currentPrice = founder ? founder.current_price : 0;
    const currentValue = Number(h.shares) * currentPrice;
    const costBasis = Number(h.cost_basis);
    const profitLoss = currentValue - Number(h.shares) * costBasis;
    const roiPercent = costBasis > 0 ? ((currentPrice / costBasis) - 1) * 100 : 0;
    return {
      ...h,
      founder_name: founder?.name ?? "Unknown",
      current_price: currentPrice,
      current_value: currentValue,
      profit_loss: profitLoss,
      roi_percent: roiPercent,
    };
  });

  const portfolioValue = holdingsWithValue.reduce((sum, h) => sum + h.current_value, 0);
  const totalValue = portfolioValue + Number(investor.current_balance);
  const roiPercent = ((totalValue / Number(investor.initial_balance)) - 1) * 100;

  return { holdingsWithValue, portfolioValue, roiPercent };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface EventDataProviderProps {
  eventId: string;
  userId: string | null;
  children: React.ReactNode;
}

export function EventDataProvider({ eventId, userId, children }: EventDataProviderProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [founders, setFounders] = useState<FounderWithPriceAndUser[]>([]);
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [rawHoldings, setRawHoldings] = useState<InvestorHolding[]>([]);
  const [investorId, setInvestorId] = useState<string | null>(null);
  const [allInvestors, setAllInvestors] = useState<EventInvestorEntry[]>([]);
  const [priceHistoryMap, setPriceHistoryMap] = useState<Map<string, PricePoint[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingAt, setClosingAt] = useState<string | null>(null);
  const [tradingJustStarted, setTradingJustStarted] = useState(false);

  // Refs for use inside realtime callbacks (avoid stale closure over state)
  const eventSettingsRef = useRef<EventSettings | null>(null);
  const foundersRef = useRef<FounderWithPriceAndUser[]>([]);
  const prevEventRef = useRef<Event | null>(null);
  const tradingToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { eventSettingsRef.current = eventSettings; }, [eventSettings]);
  useEffect(() => { foundersRef.current = founders; }, [founders]);

  // Derived portfolio metrics (recomputed whenever investor, rawHoldings, or founders change)
  const { holdingsWithValue, portfolioValue, roiPercent } = computePortfolioMetrics(
    investor,
    rawHoldings,
    founders
  );

  // ── Fetch allInvestors (leaderboard) ─────────────────────────────────────
  const fetchAllInvestors = async () => {
    const { data } = await supabase
      .from("investors")
      .select("id, name, initial_balance, current_balance, investor_holdings(founder_id, shares)")
      .eq("event_id", eventId);

    if (data) {
      setAllInvestors(
        data.map((inv: any) => ({
          id: inv.id,
          name: inv.name,
          initial_balance: Number(inv.initial_balance),
          current_balance: Number(inv.current_balance),
          holdings: (inv.investor_holdings ?? []).map((h: any) => ({
            founder_id: h.founder_id,
            shares: Number(h.shares),
          })),
        }))
      );
    }
  };

  // ── Fetch holdings for current investor ──────────────────────────────────
  const fetchHoldings = async (invId: string) => {
    const { data } = await supabase
      .from("investor_holdings")
      .select("id, investor_id, founder_id, shares, cost_basis, created_at, updated_at")
      .eq("investor_id", invId);
    if (data) setRawHoldings(data as InvestorHolding[]);
  };

  // ── Fetch investor (current user) ────────────────────────────────────────
  const refetchInvestor = async () => {
    if (!investorId) return;
    const { data } = await supabase
      .from("investors")
      .select("id, event_id, user_id, name, email, initial_balance, current_balance, created_at, updated_at")
      .eq("id", investorId)
      .maybeSingle();
    if (data) setInvestor(data as Investor);
  };

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Event + settings in parallel
        const [eventRes, settingsRes] = await Promise.all([
          supabase
            .from("events")
            .select("id, name, description, start_time, end_time, status, closing_at, schedule, created_at, updated_at")
            .eq("id", eventId)
            .maybeSingle(),
          supabase
            .from("event_settings")
            .select("event_id, snapshot_interval_seconds, max_price_history_points, hide_leaderboard_and_prices, created_at, updated_at")
            .eq("event_id", eventId)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        if (eventRes.error) throw eventRes.error;
        if (!eventRes.data) throw new Error("Event not found");

        const loadedEvent = eventRes.data as Event;
        setEvent(loadedEvent);
        prevEventRef.current = loadedEvent;
        if (loadedEvent.closing_at) setClosingAt(loadedEvent.closing_at);

        const loadedSettings = settingsRes.data as EventSettings | null;
        setEventSettings(loadedSettings);
        eventSettingsRef.current = loadedSettings;

        // Founders
        const { data: foundersData, error: foundersError } = await supabase
          .from("founders")
          .select(
            "id, event_id, founder_user_id, name, bio, logo_url, pitch_summary, pitch_url, shares_in_pool, cash_in_pool, k_constant, min_reserve_shares, created_at, updated_at, founder_users:founder_user_id(id, first_name, last_name, profile_picture_url, bio)"
          )
          .eq("event_id", eventId);

        if (cancelled) return;
        if (foundersError) throw foundersError;

        const enriched: FounderWithPriceAndUser[] = (foundersData ?? []).map(enrichFounder);
        const simpleMode = loadedSettings?.hide_leaderboard_and_prices ?? false;
        if (!simpleMode) enriched.sort((a, b) => b.market_cap - a.market_cap);

        setFounders(enriched);
        foundersRef.current = enriched;

        // Price history — one query for the whole event
        const founderCount = enriched.length;
        if (founderCount > 0) {
          const { data: historyData } = await supabase
            .from("price_history")
            .select("id, founder_id, price, shares_in_pool, recorded_at")
            .eq("event_id", eventId)
            .order("recorded_at", { ascending: false })
            .limit(60 * founderCount);

          if (!cancelled && historyData) {
            const map = new Map<string, PricePoint[]>();
            for (const pt of historyData) {
              const arr = map.get(pt.founder_id) ?? [];
              if (arr.length < 60) arr.push(pt as PricePoint);
              map.set(pt.founder_id, arr);
            }
            // Reverse each array so oldest is first (charts expect ascending time)
            map.forEach((arr, k) => map.set(k, arr.reverse()));
            setPriceHistoryMap(map);
          }
        }

        // All investors for leaderboard
        await fetchAllInvestors();

        if (!cancelled) setIsLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Failed to load event");
          setIsLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [eventId]);

  // ── Investor fetch (depends on userId) ───────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setInvestorId(null);
      setInvestor(null);
      setRawHoldings([]);
      return;
    }

    let cancelled = false;

    const fetchInvestor = async () => {
      const { data } = await supabase
        .from("investors")
        .select("id, event_id, user_id, name, email, initial_balance, current_balance, created_at, updated_at")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setInvestorId(data.id);
        setInvestor(data as Investor);
      } else {
        setInvestorId(null);
        setInvestor(null);
        setRawHoldings([]);
      }
    };

    fetchInvestor();
    return () => { cancelled = true; };
  }, [eventId, userId]);

  // ── Holdings fetch (depends on investorId) ────────────────────────────────
  useEffect(() => {
    if (!investorId) {
      setRawHoldings([]);
      return;
    }
    fetchHoldings(investorId);
  }, [investorId]);

  // ── Channel A: event updates ──────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`event_${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        (payload) => {
          const updated = payload.new as Event;
          const prev = prevEventRef.current;
          prevEventRef.current = updated;
          setEvent(updated);

          // Closing countdown: closing_at just appeared
          if (updated.closing_at && !prev?.closing_at) {
            setClosingAt(updated.closing_at);
          }
          // Closing countdown cancelled
          if (!updated.closing_at && prev?.closing_at) {
            setClosingAt(null);
          }

          // "Trading started" signal
          if (updated.status === "active" && prev?.status !== "active") {
            setTradingJustStarted(true);
            if (tradingToastTimer.current) clearTimeout(tradingToastTimer.current);
            tradingToastTimer.current = setTimeout(() => setTradingJustStarted(false), 4000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (tradingToastTimer.current) clearTimeout(tradingToastTimer.current);
    };
  }, [eventId]);

  // ── Channel B: founder updates ────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`founders_${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "founders", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const updatedId: string = (payload.new as any).id;

          // Fetch the single updated founder row
          const { data } = await supabase
            .from("founders")
            .select(
              "id, event_id, founder_user_id, name, bio, logo_url, pitch_summary, pitch_url, shares_in_pool, cash_in_pool, k_constant, min_reserve_shares, created_at, updated_at, founder_users:founder_user_id(id, first_name, last_name, profile_picture_url, bio)"
            )
            .eq("id", updatedId)
            .maybeSingle();

          if (!data) return;

          const enriched = enrichFounder(data);
          const simpleMode = eventSettingsRef.current?.hide_leaderboard_and_prices ?? false;

          setFounders((prev) => {
            const updated = prev.map((f) => (f.id === enriched.id ? enriched : f));
            if (!simpleMode) updated.sort((a, b) => b.market_cap - a.market_cap);
            foundersRef.current = updated;
            return updated;
          });

          // Keep leaderboard fresh after any trade
          fetchAllInvestors();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  // ── Channel C: investor + holdings updates ────────────────────────────────
  useEffect(() => {
    if (!investorId) return;

    const channel = supabase
      .channel(`investor_${investorId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "investors", filter: `id=eq.${investorId}` },
        (payload) => {
          setInvestor(payload.new as Investor);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "investor_holdings", filter: `investor_id=eq.${investorId}` },
        () => {
          fetchHoldings(investorId);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [investorId]);

  // ── Channel D: price history inserts ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`price_history_${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "price_history", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const pt = payload.new as PricePoint;
          setPriceHistoryMap((prev) => {
            const next = new Map(prev);
            const existing = next.get(pt.founder_id) ?? [];
            const updated = [...existing, pt];
            next.set(pt.founder_id, updated.length > 60 ? updated.slice(-60) : updated);
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  // ── registerForEvent ──────────────────────────────────────────────────────
  const registerForEvent = async () => {
    if (!userId || !eventId) return;

    const STARTING_CASH = 500000;
    const SHARES_POOL_BUDGET = 500000;
    const INITIAL_PRICE_PER_SHARE = 10;

    const currentFounders = foundersRef.current;

    const { data: newInvestor, error: investorError } = await supabase
      .from("investors")
      .insert({
        event_id: eventId,
        name: "Investor",
        email: "",
        user_id: userId,
        initial_balance: 1000000,
        current_balance: STARTING_CASH,
      })
      .select("id, event_id, user_id, name, email, initial_balance, current_balance, created_at, updated_at")
      .single();

    if (investorError) throw investorError;

    if (newInvestor && currentFounders.length > 0) {
      const sharesPerFounder = Math.floor(
        SHARES_POOL_BUDGET / currentFounders.length / INITIAL_PRICE_PER_SHARE
      );
      const holdingsToInsert = currentFounders.map((f) => ({
        investor_id: newInvestor.id,
        founder_id: f.id,
        shares: sharesPerFounder,
        cost_basis: INITIAL_PRICE_PER_SHARE,
      }));
      const { error: holdingsError } = await supabase
        .from("investor_holdings")
        .insert(holdingsToInsert);
      if (holdingsError) throw holdingsError;
    }

    setInvestorId(newInvestor.id);
    setInvestor(newInvestor as Investor);
    await fetchHoldings(newInvestor.id);
    await fetchAllInvestors();
  };

  const value: EventDataContextValue = {
    event,
    eventSettings,
    founders,
    investor,
    holdings: holdingsWithValue,
    investorId,
    allInvestors,
    portfolioValue,
    roiPercent,
    priceHistoryMap,
    isLoading,
    error,
    closingAt,
    tradingJustStarted,
    refetchInvestor,
    registerForEvent,
  };

  return (
    <EventDataContext.Provider value={value}>
      {children}
    </EventDataContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useEventData(): EventDataContextValue {
  const ctx = useContext(EventDataContext);
  if (!ctx) throw new Error("useEventData must be used inside EventDataProvider");
  return ctx;
}
