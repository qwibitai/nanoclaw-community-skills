---
name: add-instacart
description: Add Instacart grocery cart automation to a NanoClaw agent group. The agent adds items to retailer carts (Walmart, Wegmans, etc.) via direct GraphQL API calls — no browser needed. Handles session cookie auth, product search with caching, and multi-store cart management.
---

> Contributed by [@abarbaccia](https://github.com/abarbaccia) — [PR #1382](https://github.com/qwibitai/nanoclaw/pull/1382)

# Add Instacart Grocery Cart Automation

Adds an Instacart GraphQL API client to an agent group so the agent can add items to grocery carts automatically.

**How it works:** Instacart's login page blocks headless browsers (Incapsula bot detection). This skill sidesteps that entirely — the user authenticates once in their real browser and copies the session cookie. All subsequent API calls (search, add to cart) go directly to Instacart's GraphQL endpoint without touching the login flow.

## Phase 1: Pre-flight

### Identify the target group

Ask: **Which group folder should get Instacart support?** (e.g. `meal-planning`)

```bash
ls groups/
```

### Check if already installed

```bash
ls groups/<group-name>/instacart_api.mjs 2>/dev/null && echo "already installed"
```

If already installed, skip to Phase 3 (Session Setup).

### Ask about retailers

Ask: **Which stores do you want to order from?** Common options: Walmart, Wegmans, Whole Foods, Kroger, Costco, etc.

Find each retailer's slug from the Instacart URL: `instacart.com/store/<slug>/storefront`

## Phase 2: Install Files

### Copy the API client

```bash
cp "${CLAUDE_SKILL_DIR}/scripts/instacart_api.mjs" "groups/<group-name>/instacart_api.mjs"
```

### Create empty item cache

Write `groups/<group-name>/instacart_item_cache.json`:

```json
{"items": {}, "names": {}, "lastUpdated": null}
```

## Phase 3: Session Setup

The user needs to be logged into Instacart in their real browser.

### Get the session cookie

Tell the user:

> I need your Instacart session cookie. This is a one-time step — the cookie lasts for months.
>
> 1. Open **instacart.com** in Chrome and log in
> 2. Open **DevTools** (F12) → **Application** → **Cookies** → `https://www.instacart.com`
> 3. Find `__Host-instacart_sid` and copy its **Value**

Wait for the cookie value.

### Get address details

Ask for their delivery zip code and address.

Then tell them:

> Run this in the DevTools **Console** on instacart.com:
> ```javascript
> JSON.stringify({
>   addressId: window.__redux_store__?.getState()?.addressContext?.selectedAddressId
>     ?? document.querySelector('[data-address-id]')?.dataset?.addressId
>     ?? 'not found'
> })
> ```
>
> If that doesn't work, open DevTools → **Network**, refresh, click any `/graphql` request, and look for `addressId` in the request payload.

For coordinates: use the approximate lat/lng for their zip code (e.g., via a quick web lookup). Exact coordinates aren't critical — the API uses them for store proximity.

For zone ID: defaults to `190` (works for most US locations). To find the exact one, run in DevTools Console: `document.cookie.match(/zone_id=(\d+)/)?.[1]`

### Get cart IDs

For each retailer, tell the user:

> Open `https://www.instacart.com/store/<slug>/storefront` and run in DevTools Console:
> ```javascript
> const c=window.__APOLLO_CLIENT__?.cache?.extract()?.CartItemCount;
> console.log(c?.[Object.keys(c)[0]]?.userCart?.id)
> ```

Wait for each cart ID.

### Create the session file

Write `groups/<group-name>/instacart_session.json`:

```json
{
  "email": "<user-email>",
  "cookies": {
    "__Host-instacart_sid": "<cookie-value>"
  },
  "addressId": "<address-id>",
  "coordinates": { "latitude": 0.0, "longitude": 0.0 },
  "postalCode": "<zip>",
  "zoneId": "190",
  "cartIds": {
    "<retailer1>": "<cart-id-1>"
  },
  "retailers": {
    "<retailer1>": { "slug": "<retailer1>", "use_for": "..." }
  },
  "saved_at": "<ISO-timestamp>",
  "notes": "Refresh __Host-instacart_sid if requests return 401. Run: node instacart_api.mjs cartid <retailer> to refresh cartIds."
}
```

**Important:** Restrict file permissions since this file contains session credentials:

```bash
chmod 600 groups/<group-name>/instacart_session.json
```

## Phase 4: Update Group CLAUDE.md

Add an **Instacart Cart Automation** section to `groups/<group-name>/CLAUDE.md`. Tailor for the user's specific retailers and store selection rules. Template:

```markdown
## Instacart Cart Automation

Use `instacart_api.mjs` — direct GraphQL API, no browser needed.

### Adding items to cart

```bash
node /workspace/group/instacart_api.mjs search "chicken thighs" <retailer>
node /workspace/group/instacart_api.mjs add <retailer> "chicken thighs:1,bell peppers:1"
```

### Session expired (401 errors)

Do NOT try to automate login — Instacart blocks headless browsers.

To refresh: open instacart.com in Chrome, copy `__Host-instacart_sid` from
DevTools → Application → Cookies, and update `instacart_session.json`.

### Missing cartId

```bash
node /workspace/group/instacart_api.mjs cartid <retailer>
```
```

Ask the user what their store selection rules are (what goes to which retailer) and fill that in.

## Phase 5: Verify

```bash
cd groups/<group-name>
node instacart_api.mjs search "organic eggs" <retailer>
```

Expected: JSON with `results` containing product names, sizes, prices.

- **401/auth error:** Cookie expired or incorrect — recollect from Phase 3
- **`No shops found`:** Wrong retailer slug — check the URL at `instacart.com/store/<slug>/storefront`
- **`No items found`:** Try a broader query (`"eggs"` instead of `"cage-free large eggs"`)

## How It Works

The API client (`instacart_api.mjs`) uses four GraphQL operations:

1. **`ShopCollectionScoped`** — resolves the retailer to a specific store location
2. **`SearchResultsPlacements`** — searches for products, returns item IDs
3. **`Items`** — fetches name, size, and price for item IDs
4. **`UpdateCartItemsMutation`** — adds an item to the cart

Items are cached by `shopId:query` in `instacart_item_cache.json` — repeat orders skip the search step entirely.

## Known Limitations

- **Bot detection on login:** Instacart uses Incapsula on the login page. Automated login is not possible. The session cookie must be refreshed manually when it expires (typically every few months).
- **APQ hashes may drift:** The GraphQL query hashes are extracted from Instacart's client bundle. If Instacart deploys a new client version, requests may fail with `PersistedQueryNotFound`. Update the hashes in `instacart_api.mjs` by inspecting network requests in the browser.
- **Cart IDs can go stale:** If Instacart creates a new cart, re-run `cartid <retailer>` to refresh.
- **No checkout:** The client intentionally stops at "add to cart." Checkout is always done manually.
- **US only:** Untested outside the US.
