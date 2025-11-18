/**
 * NSE India API integration for fetching real-time stock quotes
 * Ported from stock-performance project
 */

// Simple in-memory cache to reduce request frequency and avoid NSE rate-limits
const quoteCache = new Map();
const QUOTE_TTL_MS = (() => {
  const sec = Number(process.env.NSE_QUOTE_CACHE_SECONDS);
  if (Number.isFinite(sec) && sec > 0 && sec < 3600) return sec * 1000;
  return 15 * 1000; // Default 15 seconds
})();

let cookieCache = { value: null, ts: 0 };
const COOKIE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Extract cookie pairs from response headers
 */
async function extractCookiePairs(resp) {
  let pairs = null;
  const anyHeaders = resp.headers;
  
  try {
    if (typeof anyHeaders.getSetCookie === 'function') {
      const arr = anyHeaders.getSetCookie();
      pairs = arr.map((c) => c.split(';')[0]).filter(Boolean);
    } else if (typeof anyHeaders.raw === 'function') {
      const raw = anyHeaders.raw();
      const arr = Array.isArray(raw?.['set-cookie']) ? raw['set-cookie'] : [];
      if (arr.length > 0) pairs = arr.map((c) => c.split(';')[0]).filter(Boolean);
    }
  } catch {}
  
  if (!pairs) {
    const single = resp.headers.get('set-cookie');
    if (single) pairs = [single.split(';')[0]];
  }
  
  return pairs;
}

/**
 * Bootstrap cookies by visiting NSE website
 */
async function bootstrapCookies(symbol) {
  const now = Date.now();
  if (cookieCache.value && now - cookieCache.ts < COOKIE_TTL_MS) {
    return cookieCache.value;
  }
  
  // If user supplied a cookie manually (e.g., from browser devtools), prefer it
  if (process.env.NSE_COOKIE && process.env.NSE_COOKIE.trim() !== '') {
    cookieCache = { value: process.env.NSE_COOKIE.trim(), ts: now };
    return cookieCache.value;
  }
  
  // Try symbol page first (often sets akamai cookies), then homepage
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
  const symbolUrl = symbol
    ? `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`
    : 'https://www.nseindia.com/';
    
  const symResp = await fetch(symbolUrl, {
    cache: 'no-store',
    headers: {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      Connection: 'keep-alive',
    },
  });
  
  let cookiePairs = await extractCookiePairs(symResp);
  
  // Also hit homepage to collect any additional cookies if needed
  const home = await fetch('https://www.nseindia.com/', {
    cache: 'no-store',
    headers: {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      Connection: 'keep-alive',
    },
  });
  
  const morePairs = await extractCookiePairs(home);
  const set = new Set([...(cookiePairs || []), ...(morePairs || [])]);
  cookiePairs = Array.from(set);
  
  if (cookiePairs && cookiePairs.length > 0) {
    const cookie = cookiePairs.join('; ');
    cookieCache = { value: cookie, ts: now };
    return cookie;
  }
  
  // If not available, still proceed without cookies
  cookieCache = { value: null, ts: now };
  return null;
}

/**
 * Fetch NSE quote for a given symbol
 * @param {string} symbol - NSE stock symbol (e.g., 'RELIANCE', 'TCS')
 * @returns {Promise<{symbol: string, price: number|null, high: number|null, low: number|null, change: number|null, percentChange: number|null}>}
 */
export async function fetchNseQuote(symbol) {
  const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/i, '');
  const cacheKey = cleanSymbol;
  const now = Date.now();
  const cached = quoteCache.get(cacheKey);
  
  if (cached && now - cached.ts < QUOTE_TTL_MS) {
    return cached.data;
  }

  const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(cleanSymbol)}`;

  let cookie = await bootstrapCookies(cleanSymbol);

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
    'Accept-Language': 'en-IN,en;q=0.9',
    Connection: 'keep-alive',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Origin: 'https://www.nseindia.com',
    Host: 'www.nseindia.com',
    'sec-ch-ua': '"Chromium";v="120", "Not=A?Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };
  
  const makeReq = async () => {
    const headers = { ...baseHeaders };
    if (cookie) headers['Cookie'] = cookie;
    const resp = await fetch(url, { cache: 'no-store', headers });
    return resp;
  };

  let resp = await makeReq();
  
  if (resp.status === 401) {
    // Retry #1: refresh cookies
    cookieCache = { value: null, ts: 0 };
    cookie = await bootstrapCookies();
    await new Promise((r) => setTimeout(r, 400));
    resp = await makeReq();
  }
  
  if (resp.status === 401) {
    // Retry #2: change Referer to base homepage and try again once
    const headers = { ...baseHeaders, Referer: 'https://www.nseindia.com/' };
    if (cookie) headers['Cookie'] = cookie;
    await new Promise((r) => setTimeout(r, 300));
    resp = await fetch(url, { cache: 'no-store', headers });
  }

  if (!resp.ok) {
    throw new Error(`NSE API error: ${resp.status}`);
  }

  const data = await resp.json();
  const result = {
    symbol: cleanSymbol,
    price: data?.priceInfo?.lastPrice ?? null,
    high: data?.priceInfo?.intraDayHighLow?.max ?? null,
    low: data?.priceInfo?.intraDayHighLow?.min ?? null,
    change: data?.priceInfo?.change ?? null,
    percentChange: data?.priceInfo?.pChange ?? null,
  };
  
  quoteCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

/**
 * Resolve an NSE trading symbol from a free-text company query using NSE autocomplete
 * @param {string} query - Company name or partial symbol
 * @returns {Promise<string|null>} - NSE symbol or null if not found
 */
export async function fetchNseSearch(query) {
  const clean = query.trim();
  if (!clean) return null;

  let cookie = await bootstrapCookies(clean);

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(clean)}`,
    'Accept-Language': 'en-IN,en;q=0.9',
    Connection: 'keep-alive',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: 'https://www.nseindia.com',
    Host: 'www.nseindia.com',
  };

  const makeReq = async () => {
    const headers = { ...baseHeaders };
    if (cookie) headers['Cookie'] = cookie;
    const url = `https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(clean)}`;
    return fetch(url, { cache: 'no-store', headers });
  };

  let resp = await makeReq();
  
  if (resp.status === 401) {
    cookieCache = { value: null, ts: 0 };
    cookie = await bootstrapCookies(clean);
    await new Promise((r) => setTimeout(r, 300));
    resp = await makeReq();
  }
  
  if (!resp.ok) return null;

  const data = await resp.json().catch(() => null);
  if (!data) return null;

  const list =
    (Array.isArray(data.symbols) && data.symbols) ||
    (Array.isArray(data.quotes) && data.quotes) ||
    (Array.isArray(data.data) && data.data) ||
    [];
    
  const first = list.find((it) => typeof it?.symbol === 'string');
  return first ? String(first.symbol).toUpperCase().replace(/\.NS$/i, '') : null;
}

export default {
  fetchNseQuote,
  fetchNseSearch,
};
