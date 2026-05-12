# Account / Index / Brand Switching — Design

**Date:** 2026-05-12
**Author:** Mohit Varikuti
**Driver:** Jesse White (TwelveLabs sports GTM) is demoing this Brand Sponsorship ROI app to prospects next week and needs to be able to switch the TwelveLabs account, index, and brand set during a live demo without redeploying.

## Problem

The app today is bound to a single TwelveLabs account and index baked in at server-boot time via `TWELVELABS_API_KEY` and `TWELVELABS_INDEX_ID` env vars. There is no UI to change either. Brand selection per analysis already works (`BrandSearch.tsx`), but the popular-brand suggestions and the way brands are picked could be friendlier for demo prep.

Concretely:
- Backend `client = TwelveLabs(api_key=API_KEY)` is a module-level singleton in `backend/app.py`.
- `INDEX_ID` is referenced directly from module globals in every route that lists videos, retrieves metadata, analyzes, or searches.
- Frontend has no notion of credentials and no settings surface.

To demo to multiple prospects, Jesse needs to point the same deployed app at *their* TwelveLabs account and *their* index without code changes.

## Goals

1. Viewer can paste a TwelveLabs API key in the UI, and the app uses it for all subsequent calls.
2. Viewer can pick which index in that account to analyze, from a list the app fetches automatically.
3. Viewer can save multiple accounts (with nicknames) and switch between them mid-demo.
4. Existing env-based default still works — when the server has `TWELVELABS_API_KEY` set, the Connect step offers a one-click "Use default demo account" button.
5. Brand selection becomes faster for demo prep: paste a brand list and clear all in one click; remember the most recent brand set per account.

## Non-goals

- Encrypting localStorage (browser-local only; demo posture).
- Multi-user backend state, accounts persisted server-side, sign-in.
- Per-request OpenAI credentials. OpenAI key stays a server env var; features degrade gracefully when absent (already handled in `app.py`).
- Admin UI for editing the curated `popularBrands` seed list in `BrandSearch.tsx`.
- Index creation, video upload, or any TL dashboard functionality (out of scope — viewers use twelvelabs.io for that).

## Architecture

### Credential flow

User credentials reach the backend via **HTTP headers** on every API call:

- `X-TL-Api-Key`: TwelveLabs API key
- `X-TL-Index-Id`: TwelveLabs index ID

Backend reads headers first, falls back to `os.getenv(...)` if absent. Stateless server — no sessions, no server-side credential store. Frontend axios interceptor injects headers from the active account in localStorage.

This is the same convention the Jockey MCP server uses (`x-tl-api-key`), keeping the pattern familiar to TL engineering.

### Backend changes (`backend/app.py`)

Module-level globals removed:
```python
# REMOVED:
# API_KEY = os.getenv("TWELVELABS_API_KEY", "")
# INDEX_ID = os.getenv("TWELVELABS_INDEX_ID", "")
# client = TwelveLabs(api_key=API_KEY)
```

Replaced by a per-request helper:
```python
def get_tl_context(req):
    api_key = req.headers.get("X-TL-Api-Key") or os.getenv("TWELVELABS_API_KEY", "")
    index_id = req.headers.get("X-TL-Index-Id") or os.getenv("TWELVELABS_INDEX_ID", "")
    if not api_key:
        abort(401, "Missing TwelveLabs API key")
    if not index_id:
        abort(400, "Missing TwelveLabs index ID")
    return TwelveLabs(api_key=api_key), index_id
```

Each existing route gets one line at the top: `tl_client, index_id = get_tl_context(request)`. References to global `client` and `INDEX_ID` are replaced with these locals.

**Background analysis threads:** `/api/analyze/*/start` endpoints capture `api_key` and `index_id` at request time (inside the request handler, before spawning the thread) and pass them as arguments to the worker. The worker builds its own `TwelveLabs(api_key=...)` instance inside the thread. Threads must not depend on Flask request context.

**New endpoints:**

- `GET /api/indexes` — requires `X-TL-Api-Key` header (no index header needed). Lists indexes for the account.

  Response shape:
  ```json
  { "indexes": [
      { "id": "65a7c2…", "name": "NFL Highlights 2024", "video_count": 42, "created_at": "2024-08-12T…" }
  ] }
  ```

- `GET /api/health` (existing, extended) — returns `{ status, timestamp, has_default_account: boolean }` so the Connect screen can conditionally render the "Use default demo account" button. `has_default_account` is `True` when `os.environ.get("TWELVELABS_API_KEY")` is non-empty.

**Error contract:** `401` for missing/invalid API key; `400` for missing index ID; `404` for index-not-found. Error bodies use the existing `{"error": "..."}` shape so the frontend interceptor can detect them uniformly.

### Frontend changes

**New types** (`frontend/src/types/index.ts`):
```ts
export interface TLAccount {
  id: string;          // uuid generated client-side
  nickname: string;    // user-supplied, e.g. "Prospect A"
  apiKey: string;      // tlk_…
  indexId: string;     // selected index in this account
  indexName: string;   // cached for display
  createdAt: string;   // ISO timestamp
}

export interface TLIndex {
  id: string;
  name: string;
  videoCount: number;
}

export type AppStep = 'connect' | 'brand-search' | 'video-selection' | 'analysis' | 'results';
```

**New module** — `frontend/src/lib/accountStorage.ts`:
- `listAccounts(): TLAccount[]` — read `localStorage["tl-brc-accounts"]`.
- `saveAccount(a: TLAccount): void` — upsert by id.
- `removeAccount(id: string): void`.
- `getActiveAccountId(): string | null` — read `localStorage["tl-brc-active-account"]`.
- `setActiveAccountId(id: string | null): void`.
- One inline comment on the file explaining: keys live in localStorage by design (demo posture, browser-local).

**New module** — `frontend/src/lib/AccountContext.tsx`:
- React context providing `{ activeAccount, accounts, setActive, addAccount, removeAccount }`.
- `App.tsx` wraps its tree with `<AccountProvider>`.

**Axios interceptor** (`frontend/src/services/api.ts`):
- Request interceptor reads active account from `accountStorage` and injects `X-TL-Api-Key` + `X-TL-Index-Id`. No active account → headers omitted (server falls back to env).
- Response interceptor on 401: clears active account, emits an `auth-required` event the context listens for, sends user to Connect step.

**New service methods:**
- `ApiService.listIndexes(apiKey: string)` → `GET /api/indexes` (injects the passed key directly, since it isn't persisted yet).
- `ApiService.getHealth()` → `GET /api/health` returns `{ has_default_account }`.

**New component** — `frontend/src/components/ConnectAccount.tsx`:

Two phases inside one card:

1. **Enter / pick account**
   - Masked text input for API key, "Connect" button.
   - Optional "Use default demo account" button — rendered only when `health.has_default_account === true` *and* no saved accounts exist.
   - List of saved accounts: `nickname · indexName` with [Switch] / [Remove] buttons.
2. **Pick index** (appears after key validates via `listIndexes`)
   - Radio list of indexes (`name • N videos`).
   - Nickname input prefilled with index name.
   - [Save & Continue] button.

Validation: clicking Connect calls `listIndexes(apiKey)`. 401 → inline "Invalid API key. Check the `tlk_` prefix." No account saved. Empty list → "This account has no indexes. Create one at twelvelabs.io first."

On save: persist via `accountStorage.saveAccount`, set active, advance to brand step.

**Wiring in `App.tsx`:**
- `AppStep` extended with `'connect'`.
- Initial `currentStep` = `'connect'` if no active account, else `'brand-search'`.
- Step indicator goes from 4 → 5 cells with "Connect" at position 0.
- Header gets a small badge: `Connected: {nickname} · {indexName} [switch]`. The switch button sets `currentStep = 'connect'` without clearing brand selection.
- `handleStartNew` resets to `'brand-search'` (not `'connect'`) — preserves the connected account.

**`BrandSearch.tsx` enhancements:**
- "Recently analyzed" row above popular brands. Reads from `localStorage["tl-brc-recent-brands:" + activeAccountId]`. One-click re-select.
- "Paste list" affordance — accepts comma/newline-separated brands, splits on `[,\n]`, trims, dedupes against current selection, adds.
- "Clear all" button next to the selected-brands chip row.
- On analysis start (handled in `App.tsx`), persist the current `selectedBrands` to the recent-brands localStorage key for the active account.

**Unchanged:**
- `useVideos.ts`, `useAnalysis.ts` — no logic changes; they pick up the new headers automatically via the axios interceptor.
- Hardcoded `popularBrands` array stays in `BrandSearch.tsx`. No backend brand registry, no admin UI.

## Data flow

```
First visit
  → no active account in localStorage
  → land on Connect step
  → user pastes API key
  → ApiService.listIndexes(key) [header X-TL-Api-Key only]
  → GET /api/indexes → 200 [{id, name, video_count}]
  → user picks index, names account
  → accountStorage.saveAccount + setActiveAccountId
  → step = 'brand-search'

Brand step
  → optional: click a "Recently analyzed" set → restore selection
  → BrandSearch as today + paste list / clear all

Video step
  → useVideos.fetchVideos() → GET /api/videos
    → axios interceptor injects X-TL-Api-Key + X-TL-Index-Id
    → backend get_tl_context(request) → TwelveLabs client + index_id
    → returns videos in the selected index

Analyze
  → POST /api/analyze/<videoId>/start with headers
  → backend captures (api_key, index_id) → spawns thread with own client
  → poll /api/analyze/status/<jobId>

Mid-demo switch
  → click [switch] in header → step = 'connect'
  → pick a different saved account → setActive → step = 'brand-search'
  → brand chip row preserved; video list re-fetched with new index

Return visit
  → localStorage has active account → land on 'brand-search'
  → header shows current account
```

## Error handling

| Failure                              | Where                          | UX                                                                                |
|--------------------------------------|--------------------------------|-----------------------------------------------------------------------------------|
| Wrong API key                        | `GET /api/indexes` → 401       | Inline error in Connect card: "Invalid API key. Check `tlk_` prefix."             |
| Network error on indexes             | `GET /api/indexes` → network   | Inline error with retry button                                                    |
| Account has no indexes               | `GET /api/indexes` → `[]`      | "This account has no indexes. Create one at twelvelabs.io first."                 |
| Saved key revoked since last visit   | Any `/api/*` → 401             | Toast: "Account credentials expired — reconnect." Active account cleared, redirect to Connect. |
| Index deleted since last visit       | `/api/videos` → 404 on index   | Same as above                                                                     |
| No env default + no user key + deep link | Any `/api/*` → 401         | Toast, redirect to Connect                                                        |
| Background analysis: API key invalid mid-job | Worker thread → SDK 401 | Job status set to `failed` with `error: "auth_expired"`; frontend polling surfaces toast + reconnect. |

The 401 response interceptor handles auth failures globally so individual hooks don't need to know.

## Testing

Manual (repo has no automated test harness today).

1. `unset TWELVELABS_API_KEY` on server → load app → Connect step is the entry point; "Use default demo account" button is hidden.
2. Set env key → reload → Connect step shows "Use default demo account"; clicking it skips index picker (uses env `TWELVELABS_INDEX_ID`).
3. Paste an obviously bad key (e.g., `tlk_xxx`) → inline 401 error, no account saved, can retry.
4. Save two accounts → switch via header [switch] → confirm video list and analysis use the second index.
5. Manually revoke a saved key at twelvelabs.io → next analysis attempt triggers reconnect flow.
6. Brand bulk-paste: paste `Nike, Adidas\nFord\nCoca-Cola` → 4 chips appear, deduped against existing.
7. "Start New Analysis" preserves active account, clears brands and video selection.
8. Browser localStorage cleared → app boots back into Connect step.

## Files added / changed

**Added:**
- `frontend/src/lib/accountStorage.ts`
- `frontend/src/lib/AccountContext.tsx`
- `frontend/src/components/ConnectAccount.tsx`

**Changed:**
- `backend/app.py` — remove globals, add `get_tl_context`, add `/api/indexes`, extend `/api/health`, thread analysis workers receive `(api_key, index_id)`.
- `frontend/src/services/api.ts` — axios interceptors, `listIndexes`, `getHealth`.
- `frontend/src/types/index.ts` — `TLAccount`, `TLIndex`, extended `AppStep`.
- `frontend/src/App.tsx` — provider, new step, header badge, initial-step logic.
- `frontend/src/components/BrandSearch.tsx` — recent set, paste list, clear all.
- `env.example` — note that env keys are now optional defaults.
- `README.md` — update Quick Start to describe the in-app connect flow.

**Unchanged (picks up new behavior via interceptor):**
- `frontend/src/hooks/useVideos.ts`
- `frontend/src/hooks/useAnalysis.ts`
- `frontend/src/hooks/useApi.ts`
- All analytics / dashboard components
