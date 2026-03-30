#!/usr/bin/env node
/**
 * Instacart GraphQL API client — adds grocery items to retailer carts.
 *
 * Usage:
 *   node instacart_api.mjs search "<query>" <retailer>
 *   node instacart_api.mjs add <retailer> "<item:qty,item:qty,...>"
 *   node instacart_api.mjs cartid <retailer>
 *
 * Session file: instacart_session.json (same folder as this script)
 * Requires: __Host-instacart_sid cookie, addressId, coordinates, cartIds
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(DIR, 'instacart_session.json');
const CACHE_FILE = path.join(DIR, 'instacart_item_cache.json');

// ─── APQ Hashes (Automatic Persisted Queries) ───────────────────────────────
const HASHES = {
  ShopCollectionScoped:
    'c6a0fcb3d1a4a14e' + '5800cc6c38e736e8' + '5177f80f0c01a553' + '5646f83238e65bcb',
  SearchResultsPlacements:
    '521b48a91cb45d5c' + 'e14457b8548ae459' + '2e947136cebef056' + 'b8b350fe078d92ec',
  Items:
    '5116339819ff07f2' + '07fd38f949a8a7f5' + '8e52cc62223b5354' + '05b087e3076ebf2f',
  UpdateCartItemsMutation:
    '7c2c63093a07a61b' + '056c09be23eba6f5' + '790059dca8179f7a' + 'f7580c0456b1049f',
};

const GQL = 'https://www.instacart.com/graphql';

function loadSession() {
  const s = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  const sid = s.cookies?.['__Host-instacart_sid'];
  if (!sid) throw new Error('Missing __Host-instacart_sid in session file');
  return s;
}

function cookieHeader(session) {
  return Object.entries(session.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function gql(operationName, variables, session) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': cookieHeader(session),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Origin': 'https://www.instacart.com',
      'Referer': 'https://www.instacart.com/',
    },
    body: JSON.stringify({
      operationName,
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash: HASHES[operationName] } },
    }),
  });
  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(`GraphQL errors in ${operationName}: ${data.errors.map(e => e.message).join('; ')}`);
  }
  return data.data;
}

async function getShopInfo(retailerSlug, session) {
  const data = await gql('ShopCollectionScoped', {
    retailerSlug,
    postalCode: session.postalCode,
    coordinates: session.coordinates,
    addressId: session.addressId,
    allowCanonicalFallback: true,
  }, session);

  const shops = data?.shopCollection?.shops || [];
  if (!shops.length) throw new Error(`No shops found for retailer: ${retailerSlug}`);
  const shop = shops[0];
  return {
    shopId: shop.id,
    retailerLocationId: shop.retailerLocationId,
    retailerId: shop.retailerId,
    token: shop.retailerInventorySessionToken,
  };
}

async function searchItems(query, shopInfo, session) {
  let cache = { items: {}, names: {} };
  try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch {}
  const cacheKey = `${shopInfo.shopId}:${query.toLowerCase()}`;
  if (cache.items?.[cacheKey]) return cache.items[cacheKey];

  const data = await gql('SearchResultsPlacements', {
    query,
    shopId: shopInfo.shopId,
    postalCode: session.postalCode,
    zoneId: session.zoneId || '190',
    first: 10,
    action: null,
    searchSource: 'search',
    retailerInventorySessionToken: shopInfo.token,
    filters: [],
    pageViewId: crypto.randomUUID(),
    elevatedProductId: null,
    disableReformulation: false,
    disableLlm: false,
    forceInspiration: false,
    orderBy: null,
    autosuggestImpressionId: null,
    clusterId: null,
    includeDebugInfo: false,
    clusteringStrategy: null,
    contentManagementSearchParams: null,
  }, session);

  const responseStr = JSON.stringify(data);
  const pattern = new RegExp(`items_${shopInfo.retailerLocationId}-\\d+`, 'g');
  const allIds = [...new Set([...responseStr.matchAll(pattern)].map(m => m[0]))];
  if (!allIds.length) throw new Error(`No items found for query: "${query}"`);
  return allIds.slice(0, 8);
}

async function getItemDetails(itemIds, shopInfo, session) {
  const data = await gql('Items', {
    ids: itemIds,
    shopId: shopInfo.shopId,
    zoneId: session.zoneId || '190',
    postalCode: session.postalCode,
  }, session);

  return (data?.items || []).map(item => ({
    id: item.id,
    name: item.name,
    size: item.size,
    price: item.price?.unitPrice?.amount,
    currency: item.price?.unitPrice?.currencyCode,
  }));
}

async function addToCart(itemId, quantity, cartId, session) {
  const data = await gql('UpdateCartItemsMutation', {
    cartId,
    cartType: 'grocery',
    requestTimestamp: Date.now() / 1000,
    cartItemUpdates: [{ itemId, quantity, quantityType: 'each', trackingParams: null }],
  }, session);

  return {
    itemCount: data?.updateCartItems?.cart?.itemCount,
    updatedIds: data?.updateCartItems?.updatedItemIds,
  };
}

function updateCache(shopId, query, itemId, itemName) {
  let cache = { items: {}, names: {} };
  try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch {}
  if (!cache.items) cache.items = {};
  const cacheKey = `${shopId}:${query.toLowerCase()}`;
  cache.items[cacheKey] = [itemId];
  if (!cache.names) cache.names = {};
  cache.names[itemId] = itemName;
  cache.lastUpdated = new Date().toISOString();
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function cmdSearch(query, retailerSlug) {
  const session = loadSession();
  const shopInfo = await getShopInfo(retailerSlug, session);
  const itemIds = await searchItems(query, shopInfo, session);
  const details = await getItemDetails(itemIds.slice(0, 5), shopInfo, session);
  console.log(JSON.stringify({ query, retailer: retailerSlug, shopId: shopInfo.shopId, results: details }, null, 2));
}

async function cmdAdd(retailerSlug, itemsArg) {
  const session = loadSession();
  const cartId = (session.cartIds || {})[retailerSlug];
  if (!cartId) {
    throw new Error(
      `No cartId for ${retailerSlug} in session file. ` +
      `Run: node instacart_api.mjs cartid ${retailerSlug}`
    );
  }

  const shopInfo = await getShopInfo(retailerSlug, session);
  const items = itemsArg.split(',').map(part => {
    const colonIdx = part.lastIndexOf(':');
    const query = part.substring(0, colonIdx).trim();
    const qty = parseInt(part.substring(colonIdx + 1).trim(), 10) || 1;
    return { query, qty };
  });

  const results = [];
  for (const { query, qty } of items) {
    try {
      const itemIds = await searchItems(query, shopInfo, session);
      const details = await getItemDetails(itemIds.slice(0, 3), shopInfo, session);
      if (!details.length) { results.push({ query, status: 'not_found' }); continue; }
      const best = details[0];
      const cartResult = await addToCart(best.id, qty, cartId, session);
      updateCache(shopInfo.shopId, query, best.id, best.name);
      results.push({
        query, status: 'added',
        item: `${best.name} (${best.size})`,
        itemId: best.id,
        price: best.price ? `$${best.price}` : null,
        qty,
        cartItemCount: cartResult.itemCount,
      });
    } catch (err) {
      results.push({ query, status: 'error', error: err.message });
    }
  }
  console.log(JSON.stringify({ retailer: retailerSlug, added: results }, null, 2));
}

async function cmdCartId(retailerSlug) {
  console.log(`To get the cartId for ${retailerSlug}:\n`);
  console.log(`1. Open https://www.instacart.com/store/${retailerSlug}/storefront in your browser`);
  console.log(`2. Open DevTools console and run:`);
  console.log(`   const c=window.__APOLLO_CLIENT__?.cache?.extract()?.CartItemCount; console.log(c?.[Object.keys(c)[0]]?.userCart?.id)`);
  console.log(`3. Copy the number and add it to instacart_session.json under "cartIds"`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'search': await cmdSearch(args[0], args[1]); break;
    case 'add': await cmdAdd(args[0], args[1]); break;
    case 'cartid': await cmdCartId(args[0]); break;
    default:
      console.log(`Usage:
  node instacart_api.mjs search "<query>" <retailer>
  node instacart_api.mjs add <retailer> "<item:qty,item:qty,...>"
  node instacart_api.mjs cartid <retailer>

Examples:
  node instacart_api.mjs search "organic eggs" wegmans
  node instacart_api.mjs add walmart "chicken thighs:1,bell peppers:1"
  node instacart_api.mjs add wegmans "fresh basil:1"
`);
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
