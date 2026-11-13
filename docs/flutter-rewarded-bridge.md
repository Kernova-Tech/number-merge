# Flutter game ads bridge — v1

This repository implements the web side. The companion LinkSkool Flutter checkout implements the native host in `game_reward_bridge.dart`, registered by `GamePlayerScreen` and connected to `GameAdManager`. Both the updated web game and a rebuilt app must be deployed. No ad SDK or production ad unit is included in the web game.

## Host setup

Register a `GameHost` JavaScript channel before loading the trusted game URL. Restrict navigation and bridge access to trusted game content. With `webview_flutter`, receive JSON through `addJavaScriptChannel('GameHost', onMessageReceived: ...)` and send JSON objects back with `runJavaScript` calling `window.NumberMergeHost.receive(...)`. Serialize response data as JSON; never concatenate unescaped content into JavaScript.

Before enabling offers or score breaks, the game sends `rewarded.ready`. The native host responds with capabilities:

```json
{"version":1,"type":"rewarded.capabilities","enabled":true,"bridgeToken":"per-page-nonce","placements":["milestone_double","booster_refill","daily_double"],"interstitialBreaks":true}
```

Requests and acknowledgements must include that `bridgeToken`. The host rotates it on page navigation, validates the current main-page origin, and registers its channel before loading the game. Production access is restricted to `https://merge.linkskool.com`. A channel alone does not enable offers; a configured native host must confirm readiness. The game retries readiness when channel injection is delayed.

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

## Score-checkpoint breaks

After a completed move (including its merge and shooter-promotion animations), the web game can pause at the latest score checkpoint crossed: 1,000, 5,000, 10,000, 50,000, 100,000, and the same 1/5 × powers-of-ten pattern thereafter. The game shows a brief, localized breather screen and a three-second countdown before requesting an interstitial. A milestone reward screen takes precedence; the checkpoint break waits until the player collects or closes that reward.

The web host sends this only when `interstitialBreaks` is true:

```json
{"version":1,"type":"interstitial.break.request","requestId":"unique-uuid","checkpointScore":5000,"createdAt":123456789,"bridgeToken":"per-page-nonce"}
```

The native host validates the token, trusted origin, request ID, and checkpoint pattern, then responds after the existing fullscreen coordinator returns:

```json
{"version":1,"type":"interstitial.break.result","requestId":"unique-uuid","status":"shown"}
```

`status` is one of `shown`, `cooldown`, `busy`, `failed`, or `unavailable`. A cooldown, unavailable ad, or failure resumes the game without granting a reward. Score-break interstitials share a three-minute in-memory cooldown with fullscreen game ads (including rewarded and existing game entry/exit/app-open ads). Existing ad placements and rewarded offers are unchanged. A pending web checkpoint is saved with the run so a refresh can recover or safely dismiss the break without resetting gameplay.

This placement is deliberately a post-move pause rather than an ad during a tile animation or immediately after a tap. Google Play disallows unexpected interstitials during gameplay and identifies a score-screen pause as a non-interruptive context; AdMob likewise recommends natural transition points and warns against showing an interstitial after the user has tapped Continue. Keep the pause timing and frequency conservative.

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

Revive, standalone bonus offers and shared points remain follow-up work. The Flutter host uses the existing `GAME_REWARD_AD_KEY` configuration and fullscreen-ad coordinator. Existing banner, app-open, and interstitial placements are preserved. Cancellation or unavailable inventory grants no bonus. Native rewarded receipts are persisted in SharedPreferences and acknowledged by the web wallet; this is local recovery, not server-side reward verification. Score-break results are session-scoped and never award gems or boosters.

For debug builds only, `GAME_REWARD_TEST_ADS=true` selects Google's official rewarded test unit. `GAME_REWARD_PREVIEW_ORIGIN` optionally permits an exact local preview origin in debug builds; it is ignored in release builds. Keep build definitions and logs private. A successful build or simulated host test does not establish real device ad delivery or consent compliance.

## Verification

Run `node scripts/test-game.cjs` and `npm run build`. `scripts/check-rewards.cjs` exercises the web flow in an isolated mobile Chrome context with a simulated native host (not a real ad). Pass the installed Playwright package path as argument 1 and local game URL as argument 2.
