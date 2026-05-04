import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { Event } from "../types/Event";
import { Pitch, UserEmbed, PitchWithPriceAndUser } from "../types/Pitch";
import { Investor, InvestorHolding, InvestorHoldingWithValue, EventInvestorEntry } from "../types/Investor";
import { calculateCurrentPrice, calculateMarketCap } from "../lib/ammEngine";

export type { UserEmbed, PitchWithPriceAndUser, EventInvestorEntry };

// ─── Public types ────────────────────────────────────────────────────────────

export interface PricePoint {
  id: string;
  pitch_id: string;
  price: number;
  shares_in_pool: number;
  recorded_at: string;
}

// ─── Context interface ────────────────────────────────────────────────────────

interface EventDataContextValue {
  event: Event | null;
  pitches: PitchWithPriceAndUser[];
  investor: Investor | null;
  holdings: InvestorHoldingWithValue[];
  investorId: string | null;
  allInvestors: EventInvestorEntry[];
  portfolioValue: number;
  roiPercent: number;
  priceHistoryMap: Map<string, PricePoint[]>;
  isLoading: boolean;
  error: string | null;
  closingAt: string | null;
  tradingJustStarted: boolean;
  refetchInvestor: () => Promise<void>;
  registerForEvent: () => Promise<void>;
}

const EventDataContext = createContext<EventDataContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrichPitch(raw: any): PitchWithPriceAndUser {
  const pitch: Pitch = {
    id: raw.id,
    event_id: raw.event_id,
    profile_user_id: raw.profile_user_id,
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
    ...pitch,
    current_price: calculateCurrentPrice(pitch),
    market_cap: calculateMarketCap(pitch),
    user: raw.users ?? raw.user ?? null,
  };
}

function computePortfolioMetrics(
  investor: Investor | null,
  holdings: InvestorHolding[],
  pitches: PitchWithPriceAndUser[]
): { holdingsWithValue: InvestorHoldingWithValue[]; portfolioValue: number; roiPercent: number } {
  if (!investor) {
    return { holdingsWithValue: [], portfolioValue: 0, roiPercent: 0 };
  }

  const holdingsWithValue: InvestorHoldingWithValue[] = holdings.map((h) => {
    const pitch = pitches.find((p) => p.id === h.pitch_id);
    const currentPrice = pitch ? pitch.current_price : 0;
    const currentValue = Number(h.shares) * currentPrice;
    const costBasis = Number(h.cost_basis);
    const profitLoss = currentValue - Number(h.shares) * costBasis;
    const roiPercent = costBasis > 0 ? ((currentPrice / costBasis) - 1) * 100 : 0;
    return {
      ...h,
      pitch_name: pitch?.name ?? "Unknown",
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
  const [pitches, setPitches] = useState<PitchWithPriceAndUser[]>([]);
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [rawHoldings, setRawHoldings] = useState<InvestorHolding[]>([]);
  const [investorId, setInvestorId] = useState<string | null>(null);
  const [allInvestors, setAllInvestors] = useState<EventInvestorEntry[]>([]);
  const [priceHistoryMap, setPriceHistoryMap] = useState<Map<string, PricePoint[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingAt, setClosingAt] = useState<string | null>(null);
  const [tradingJustStarted, setTradingJustStarted] = useState(false);

  const pitchesRef = useRef<PitchWithPriceAndUser[]>([]);
  const prevEventRef = useRef<Event | null>(null);
  const tradingToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref for simpleMode used in realtime callbacks
  const simpleModeRef = useRef<boolean>(false);

  useEffect(() => { pitchesRef.current = pitches; }, [pitches]);
  useEffect(() => {
    simpleModeRef.current = event?.hide_leaderboard_and_prices ?? false;
  }, [event]);

  const { holdingsWithValue, portfolioValue, roiPercent } = computePortfolioMetrics(
    investor,
    rawHoldings,
    pitches
  );

  // ── Fetch allInvestors (leaderboard) ─────────────────────────────────────
  const fetchAllInvestors = async () => {
    const { data } = await supabase
      .from("investors")
      .select("id, name, initial_balance, current_balance, investor_holdings(pitch_id, shares)")
      .eq("event_id", eventId);

    if (data) {
      setAllInvestors(
        data.map((inv: any) => ({
          id: inv.id,
          name: inv.name,
          initial_balance: Number(inv.initial_balance),
          current_balance: Number(inv.current_balance),
          holdings: (inv.investor_holdings ?? []).map((h: any) => ({
            pitch_id: h.pitch_id,
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
      .select("id, investor_id, pitch_id, shares, cost_basis, created_at, updated_at")
      .eq("investor_id", invId);
    if (data) setRawHoldings(data as InvestorHolding[]);
  };

  // ── Fetch investor (current user) ────────────────────────────────────────
  const refetchInvestor = async () => {
    if (!investorId) return;
    const { data } = await supabase
      .from("investors")
      .select("id, event_id, profile_user_id, name, initial_balance, current_balance, created_at, updated_at")
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

        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("id, name, description, start_time, end_time, status, closing_at, schedule, snapshot_interval_seconds, max_price_history_points, hide_leaderboard_and_prices, registration_questions, created_at, updated_at")
          .eq("id", eventId)
          .maybeSingle();

        if (cancelled) return;
        if (eventError) throw eventError;
        if (!eventData) throw new Error("Event not found");

        const loadedEvent = eventData as Event;
        setEvent(loadedEvent);
        prevEventRef.current = loadedEvent;
        simpleModeRef.current = loadedEvent.hide_leaderboard_and_prices;
        if (loadedEvent.closing_at) setClosingAt(loadedEvent.closing_at);

        // Pitches
        const { data: pitchesData, error: pitchesError } = await supabase
          .from("pitches")
          .select(
            "id, event_id, profile_user_id, name, bio, logo_url, pitch_summary, pitch_url, shares_in_pool, cash_in_pool, k_constant, min_reserve_shares, created_at, updated_at, users!pitches_profile_user_id_fkey(id, first_name, last_name, profile_picture_url, bio)"
          )
          .eq("event_id", eventId);

        if (cancelled) return;
        if (pitchesError) throw pitchesError;

        const enriched: PitchWithPriceAndUser[] = (pitchesData ?? []).map(enrichPitch);
        const simpleMode = loadedEvent.hide_leaderboard_and_prices;
        if (!simpleMode) enriched.sort((a, b) => b.market_cap - a.market_cap);

        setPitches(enriched);
        pitchesRef.current = enriched;

        // Price history
        const pitchCount = enriched.length;
        if (pitchCount > 0) {
          const { data: historyData } = await supabase
            .from("price_history")
            .select("id, pitch_id, price, shares_in_pool, recorded_at")
            .eq("event_id", eventId)
            .order("recorded_at", { ascending: false })
            .limit(60 * pitchCount);

          if (!cancelled && historyData) {
            const map = new Map<string, PricePoint[]>();
            for (const pt of historyData) {
              const arr = map.get(pt.pitch_id) ?? [];
              if (arr.length < 60) arr.push(pt as PricePoint);
              map.set(pt.pitch_id, arr);
            }
            map.forEach((arr, k) => map.set(k, arr.reverse()));
            setPriceHistoryMap(map);
          }
        }

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
      // Look up investor via profile_user_id (users.id) — join through users table
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (cancelled || !userData) return;

      const { data } = await supabase
        .from("investors")
        .select("id, event_id, profile_user_id, name, initial_balance, current_balance, created_at, updated_at")
        .eq("profile_user_id", userData.id)
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

          if (updated.closing_at && !prev?.closing_at) setClosingAt(updated.closing_at);
          if (!updated.closing_at && prev?.closing_at) setClosingAt(null);

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

  // ── Channel B: pitch updates ──────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`pitches_${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pitches", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const updatedId: string = (payload.new as any).id;

          const { data } = await supabase
            .from("pitches")
            .select(
              "id, event_id, profile_user_id, name, bio, logo_url, pitch_summary, pitch_url, shares_in_pool, cash_in_pool, k_constant, min_reserve_shares, created_at, updated_at, users!pitches_profile_user_id_fkey(id, first_name, last_name, profile_picture_url, bio)"
            )
            .eq("id", updatedId)
            .maybeSingle();

          if (!data) return;

          const enriched = enrichPitch(data);
          const simpleMode = simpleModeRef.current;

          setPitches((prev) => {
            const updated = prev.map((p) => (p.id === enriched.id ? enriched : p));
            if (!simpleMode) updated.sort((a, b) => b.market_cap - a.market_cap);
            pitchesRef.current = updated;
            return updated;
          });

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
        (payload) => { setInvestor(payload.new as Investor); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "investor_holdings", filter: `investor_id=eq.${investorId}` },
        () => { fetchHoldings(investorId); }
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
            const existing = next.get(pt.pitch_id) ?? [];
            const updated = [...existing, pt];
            next.set(pt.pitch_id, updated.length > 60 ? updated.slice(-60) : updated);
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

    const currentPitches = pitchesRef.current;

    // Resolve users.id from auth UID
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const { data: newInvestor, error: investorError } = await supabase
      .from("investors")
      .insert({
        event_id: eventId,
        name: "Investor",
        profile_user_id: userData?.id ?? null,
        initial_balance: 1000000,
        current_balance: STARTING_CASH,
      })
      .select("id, event_id, profile_user_id, name, initial_balance, current_balance, created_at, updated_at")
      .single();

    if (investorError) throw investorError;

    if (newInvestor && currentPitches.length > 0) {
      const sharesPerPitch = Math.floor(
        SHARES_POOL_BUDGET / currentPitches.length / INITIAL_PRICE_PER_SHARE
      );
      const holdingsToInsert = currentPitches.map((p) => ({
        investor_id: newInvestor.id,
        pitch_id: p.id,
        shares: sharesPerPitch,
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
    pitches,
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
