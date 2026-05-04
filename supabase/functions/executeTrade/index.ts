const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function executeBuyTrade(pitch, shares) {
  const x = Number(pitch.shares_in_pool);
  const y = Number(pitch.cash_in_pool);
  const k = Number(pitch.k_constant);
  const minReserve = Number(pitch.min_reserve_shares || 1000);
  const newX = x - shares;
  if (newX <= minReserve) throw new Error(`Cannot buy ${shares} shares: would go below minimum reserve of ${minReserve}`);
  const newY = k / newX;
  return { cost: newY - y, newPrice: Math.min(newY / newX, 100), newShares: newX, newCash: newY };
}

function executeSellTrade(pitch, shares) {
  const x = Number(pitch.shares_in_pool);
  const y = Number(pitch.cash_in_pool);
  const k = Number(pitch.k_constant);
  const newX = x + shares;
  const newY = k / newX;
  return { payout: y - newY, newPrice: Math.min(newY / newX, 100), newShares: newX, newCash: newY };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const h = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  try {
    const { investor_id, pitch_id, shares, type, event_id, note } = await req.json();

    if (!investor_id || !pitch_id || !shares || !type || !event_id) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pitchRes = await fetch(`${SUPABASE_URL}/rest/v1/pitches?id=eq.${pitch_id}&select=*`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const pitches = await pitchRes.json();
    if (!pitchRes.ok || !pitches.length) return new Response(JSON.stringify({ error: 'Pitch not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    const pitch = pitches[0];

    const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=*`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const investors = await invRes.json();
    if (!invRes.ok || !investors.length) return new Response(JSON.stringify({ error: 'Investor not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    const investor = investors[0];

    let result;
    try {
      result = type === 'buy' ? executeBuyTrade(pitch, Number(shares)) : executeSellTrade(pitch, Number(shares));
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { newShares, newCash, newPrice } = result;
    const tradeAmount = type === 'buy' ? result.cost : -result.payout;

    const r1 = await fetch(`${SUPABASE_URL}/rest/v1/pitches?id=eq.${pitch_id}`, {
      method: 'PATCH', headers: h,
      body: JSON.stringify({ shares_in_pool: newShares, cash_in_pool: newCash }),
    });
    if (!r1.ok) throw new Error('Failed to update pitch: ' + await r1.text());

    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, {
      method: 'PATCH', headers: h,
      body: JSON.stringify({ current_balance: Number(investor.current_balance) - tradeAmount }),
    });
    if (!r2.ok) throw new Error('Failed to update investor: ' + await r2.text());

    const r3 = await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
      method: 'POST', headers: h,
      body: JSON.stringify({
        investor_id, pitch_id, event_id, shares, amount: tradeAmount,
        type, price_per_share: newPrice,
        note: typeof note === 'string' ? note.trim() : null,
      }),
    });
    if (!r3.ok) throw new Error('Failed to insert trade: ' + await r3.text());

    const holdingRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_holdings?investor_id=eq.${investor_id}&pitch_id=eq.${pitch_id}&select=*`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const holdingsArr = await holdingRes.json();
    const holding = holdingsArr[0] ?? null;

    if (holding) {
      const cur = Number(holding.shares), basis = Number(holding.cost_basis);
      let newHoldingShares, newCostBasis;
      if (type === 'buy') {
        newHoldingShares = cur + Number(shares);
        newCostBasis = (cur * basis + result.cost) / newHoldingShares;
      } else {
        newHoldingShares = Math.max(0, cur - Number(shares));
        newCostBasis = newHoldingShares === 0 ? 0 : basis;
      }
      const r4 = await fetch(`${SUPABASE_URL}/rest/v1/investor_holdings?id=eq.${holding.id}`, {
        method: 'PATCH', headers: h,
        body: JSON.stringify({ shares: newHoldingShares, cost_basis: newCostBasis }),
      });
      if (!r4.ok) throw new Error('Failed to update holding: ' + await r4.text());
    } else if (type === 'buy') {
      const r4 = await fetch(`${SUPABASE_URL}/rest/v1/investor_holdings`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ investor_id, pitch_id, shares, cost_basis: result.cost / Number(shares) }),
      });
      if (!r4.ok) throw new Error('Failed to insert holding: ' + await r4.text());
    }

    const r5 = await fetch(`${SUPABASE_URL}/rest/v1/price_history`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ event_id, pitch_id, price: newPrice, shares_in_pool: newShares, cash_in_pool: newCash, source: 'trade' }),
    });
    if (!r5.ok) throw new Error('Failed to insert price history: ' + await r5.text());

    await fetch(`${SUPABASE_URL}/rest/v1/rpc/prune_price_history`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ pitch_uuid: pitch_id }),
    });

    return new Response(JSON.stringify({ success: true, result: { newPrice, tradeAmount, shares } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
