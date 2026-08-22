# XOwl production reliability, call monitoring, and real trading

## Goal
Make XOwl behave consistently on Lovable and Vercel, publish a fresh call batch every five hours, retain and monitor every historical call, announce verified milestones, render cleanly on phones/laptops, expand the radar to as many as 100 qualified X Layer tokens, and replace the simulated trade record with real wallet-authorized swaps and tracked P/L.

## Implementation

### 1. Repair production data loading
- Make public Calls, snapshots, and statistics use the public backend client with the build-time publishable configuration available on both Lovable and Vercel; remove the current dependency on server-only variables for public reads.
- Keep privileged scan writes server-only and return explicit configuration/provider errors from the scan endpoint instead of a generic failure.
- Add resilient query retry/error copy and verify the Calls page against the shared production database.
- Keep all credentials on the server; no OKX secret, passphrase, project ID, or backend privileged credential will enter the browser bundle.

### 2. Five-hour call batches and permanent monitoring
- Change the publication schedule to `0 */5 * * *` and add a database-backed scan lock/checkpoint so retries or two deployments cannot publish duplicate batches.
- Separate discovery/publication from monitoring: publish only a new ranked batch when five hours have elapsed, while refreshing every open call’s current price, market cap, multiplier, ATH, and snapshot on each monitor pass.
- Keep every prior call permanently visible. Prevent the same token from being called repeatedly inside the configured cooldown, while allowing future re-calls as distinct records after that window.
- Persist milestone events once per call and threshold (2X/5X/10X). A 2X event will read like “XLIFE did 2X from XOwl’s call” and include called market cap and current market cap.
- Add a notification feed/bell for verified public XOwl milestones so visitors can see achievements without requiring the removed sign-in navigation.

### 3. Fix Calls UI and responsive layout
- Correct the Calls table header/body mismatch and show Entry market cap, Peak market cap, ATH multiplier, Current market cap, and Current multiplier in the right columns.
- Replace wide desktop-only tables with responsive mobile call rows/cards while retaining the compact table on larger screens.
- Rebuild the home hero with a stable responsive height, locally controlled video framing, semantic overlay tokens, and mobile/desktop object positioning so the video cannot stretch or displace content.
- Stabilize the header, hero grid, radar card sizes, typography, and tablet breakpoints; remove raw button styling where design-system controls exist.

### 4. Expand the live X Layer radar to 100 qualified tokens
- Return and render up to 100 candidates rather than 50/12.
- Keep OKX Onchain OS as primary; merge its swap-flow discovery with DexScreener token/search results and paginated GeckoTerminal X Layer pools as fallbacks.
- Deduplicate by contract address, preserve the strongest-liquidity pair, enrich missing market/holder fields from OKX, and apply the existing stablecoin/wrapped/LP/infrastructure filters before ranking.
- Add progressive rendering/pagination so 100 cards remain fast and usable on mobile.

### 5. Real wallet permission and swap execution
- Stop eager wallet reconnection. Only `eth_requestAccounts` after the user taps Connect; persist Disconnect so reloads do not silently reconnect. Continue requiring explicit network-switch approval.
- Add server-only OKX Aggregator quote/swap transaction builders for X Layer chain index 196. The browser receives only prepared transaction fields; API credentials stay server-side.
- For a buy, validate live balance, request a fresh quote, show minimum received/price impact/slippage, then request the wallet’s explicit transaction confirmation through `eth_sendTransaction`.
- Record a trade only after a transaction hash is returned; track receipt state, confirmed token amount, entry value, current value, unrealized P/L amount/percentage, and failure reason. Insufficient OKB or a reverted/rejected transaction must show as failed rather than “armed.”
- Update Portfolio to show pending/confirmed/failed positions and live profit/loss from backend market prices.

### 6. Fully automated exits — safe boundary
- A normal connected browser wallet cannot sign a later sell while the user is offline. Implement the app-side automation workflow around a non-custodial executor contract: user creates the position, approves only the purchased token/position amount, and registers target/slippage/expiry; a keeper may execute only that bounded sell when the target is reached.
- Include contract interface/configuration, approval and registration UI, revocation/cancel flow, monitoring state, and transaction audit trail. The automatic-exit control remains unavailable until an audited executor contract address is deployed on X Layer; XOwl will never ask for or store a private key.
- Until the executor is configured, real buys and tracked P/L remain functional, and exits use an explicit wallet confirmation rather than pretending to be automated.

## Database changes
- Add scan-run/checkpoint records and unique constraints for idempotent five-hour batches.
- Add durable public call-milestone events with a unique `(call_id, milestone)` constraint and public read policy.
- Extend trades with buy/sell transaction hashes, receipt status, token amount, entry/current values, P/L, target registration, and failure details; keep user-owned RLS and explicit grants.

## Verification
- Test public Calls and Radar from both the Lovable URL and a Vercel-compatible production build path.
- Run a scan twice to prove the five-hour lock and milestone deduplication.
- Verify 2X event text and both market-cap values against saved snapshots.
- Exercise wallet connect/reject/disconnect/reload/network-switch, insufficient-balance failure, rejected transaction, and successful transaction-hash persistence.
- Visually test home, Calls, token detail, and Portfolio at 390px mobile and 1280px laptop widths with no horizontal page overflow or displaced video.

## Deployment note
Vercel must have the same server-side OKX credentials and scan secret configured in its project environment. The app will no longer require privileged backend credentials for public reads, but privileged scheduled writes cannot safely run on Vercel without server-side secrets.
