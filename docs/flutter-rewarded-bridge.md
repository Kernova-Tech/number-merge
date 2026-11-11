# Flutter rewarded ads bridge — v1

This repository implements the web side. The Flutter host must implement this contract before native ads work. No ad SDK or production ad unit is included in the web game.

## Host setup

Register a `GameHost` JavaScript channel before loading the trusted game URL. Restrict navigation and bridge access to trusted game content. With `webview_flutter`, receive JSON through `addJavaScriptChannel('GameHost', onMessageReceived: ...)` and send JSON objects back with `runJavaScript` calling `window.NumberMergeHost.receive(...)`. Serialize response data as JSON; never concatenate unescaped content into JavaScript.

The web game sends:

```json
{"version":1,"type":"rewarded.request","requestId":"unique-uuid","createdAt":123456789,"placement":"milestone_double","milestone":512}
```

For `booster_refill`, the request includes `booster` (`hammer`, `swap`, or `undo`) instead of `milestone`.

For `daily_double`, the request includes `dailyId` (for example `daily:20768`) and `dailyIndex` (0–6). The base daily gift has already been collected when this request is sent. Only a successful earned result adds one additional copy of the gem reward; cancellation leaves the base gift intact. Only gem-only days offer doubling.

1. Validate protocol, placement and request ID. Never display duplicate requests twice. Permit only one fullscreen ad at a time.
2. Resolve consent/eligibility, load an ad, and show only after this explicit user request.
3. Record `onUserEarnedReward` durably. Closing the ad alone does not qualify.
4. After dismissal, return exactly one terminal result. If reward was earned, `earned` takes precedence. Otherwise return `cancelled`; return `failed` for loading/showing failure, or `unavailable` when no ad can be offered.

```js
window.NumberMergeHost.receive({requestId: "unique-uuid", status: "earned"});
```

`status` must be one of `earned`, `cancelled`, `failed`, `unavailable`. Unknown request IDs and repeated results are ignored. The web game determines the game reward from the stored placement; it does not accept an arbitrary amount from a message.

## Reloads and recovery

The game sends `rewarded.ready` with `pendingRequestId` when its listener mounts. Keep native terminal results until the game sends `rewarded.ack` with that ID; replay unacknowledged results on ready. Persist native state across process death, and reconcile incomplete requests rather than silently losing an earned result. If a completed ID was already acknowledged, retain enough native receipt history to resolve an interrupted acknowledgement.

After 90 seconds without a terminal response the web UI unlocks, retaining the issued request so a late earned response can still credit the player. Do not use this UI timeout to decide whether an ad earned a reward. If another request is active, a late result must not close the currently displayed ad.

The local wallet stores reward receipts alongside gem and booster balances. Both the free milestone reward and ad bonus have distinct receipts, so claiming the base reward during recovery will not double-credit it later. Browser storage is best effort: this is not a server-authoritative wallet, and data can be lost if the browser clears storage. For shared account points, implement authenticated backend balances, signed AdMob SSV validation and transaction deduplication before connecting this wallet to that balance.

## Implemented offers

- Milestone: free base gems or watch for double total gems. Cancellation leaves the base claim available.
- Empty booster: buy one with gems (Swap 20, Undo 35, Smash 50), or watch for one booster. Refill adds inventory; it does not automatically activate the booster.
- Without `GameHost`, ad buttons are disabled and normal claims/purchases remain usable.

Shop and Rewards navigation are implemented. The shop offers individual boosters and a 90-gem bundle containing one of each. Daily gifts progress through 20 gems, 25 gems, one Swap, 30 gems, one Undo, 40 gems, and 50 gems plus one Smash, then repeat. Missing days pauses the sequence. Claims reset at 00:00 UTC and use the device clock with backward-date duplicate prevention; this is not trusted server time or cross-device anti-cheat. Daily progress is stored alongside the wallet transaction, and other reward credits preserve that metadata.

Daily challenges are implemented in the Rewards screen: 10 merges for 10 gems, create 128 or higher for 15 gems, and three merges in one shot for 20 gems. Progress is recorded after completed normal-game moves, not tutorial animations or initial board generation. Booster merges count toward total merges and the created tile, but not a shot chain. Claims use dated receipts in the wallet; days reset at 00:00 UTC using the same device-clock limitations as daily gifts. Saved runs include a run ID and move counter to deduplicate replayed completion events.

Revive, standalone bonus offers and shared points remain follow-up work. Native consent, ad inventory/caps and SDK test ad units must be configured in Flutter. This repository does not yet contain the Flutter host implementation.

## Verification

Run `node scripts/test-game.cjs` and `npm run build`. `scripts/check-rewards.cjs` exercises the web flow in an isolated mobile Chrome context with a simulated native host (not a real ad). Pass the installed Playwright package path as argument 1 and local game URL as argument 2.
