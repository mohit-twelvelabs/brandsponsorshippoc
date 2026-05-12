# Account / Index / Brand Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the running app point at any TwelveLabs account + index a viewer enters in the UI, save multiple such accounts per browser, and make brand selection faster for demo prep — without breaking the existing env-based default.

**Architecture:** Backend goes from a module-global `TwelveLabs` client + `INDEX_ID` to a per-request helper that reads `X-TL-Api-Key` and `X-TL-Index-Id` headers (env vars become defaults). New `GET /api/indexes` lists indexes for a key. Frontend adds a Connect step before the brand picker, an axios interceptor that injects the active account's headers, and a localStorage-backed account list. BrandSearch gets recent-set / paste-list / clear-all affordances. Background analysis threads capture credentials at request time and build their own SDK clients so they never depend on Flask request context.

**Tech Stack:** Flask, twelvelabs-py SDK, React 18 + TypeScript, axios, TailwindCSS, lucide-react. No automated test harness — each task ends with a manual smoke step.

**Spec:** [`docs/superpowers/specs/2026-05-12-account-index-brand-switching-design.md`](../specs/2026-05-12-account-index-brand-switching-design.md)

**Conventions for this plan:**
- File line refs match the working tree at the start of execution. After edits the line numbers shift — open the file and search for the surrounding context before editing later tasks if numbers don't match.
- Frontend `services/api.ts` points at `https://brc.up.railway.app/api` by default. For local verification, set `REACT_APP_API_BASE` via an `.env.local` in `frontend/` or temporarily edit `baseURL` to `http://localhost:5000/api`. Revert before the final commit.
- Every commit message uses the conventional-commit style already in this repo's history (`feat:`, `refactor:`, `fix:`, `docs:`).

---

## Phase 1 — Backend refactor (env → per-request)

### Task 1: Add `get_tl_context` helper, extend `/api/health`, drop globals

**Files:**
- Modify: `backend/app.py` (lines 30-47, 1159-1162)

- [ ] **Step 1: Replace module-level TwelveLabs setup**

In `backend/app.py`, find lines 30-47 (starts with `app = Flask(...)`, contains `API_KEY = os.getenv(...)`, `INDEX_ID = os.getenv(...)`, ends with `client = TwelveLabs(api_key=API_KEY)`).

Replace with:

```python
app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*", "supports_credentials": True}})

UPLOAD_FOLDER = '../uploads'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'}

# OpenAI API configuration (stays server-side; not exposed to users)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size


def get_tl_context(req, require_index=True):
    """Resolve TwelveLabs credentials for the current request.

    Reads X-TL-Api-Key and X-TL-Index-Id headers, falling back to env vars
    so the deployment's default account continues to work when no headers
    are sent. Aborts with 401/400 if a required field is missing.
    """
    api_key = req.headers.get("X-TL-Api-Key") or os.getenv("TWELVELABS_API_KEY", "")
    index_id = req.headers.get("X-TL-Index-Id") or os.getenv("TWELVELABS_INDEX_ID", "")
    if not api_key:
        abort(401, description="Missing TwelveLabs API key")
    if require_index and not index_id:
        abort(400, description="Missing TwelveLabs index ID")
    return TwelveLabs(api_key=api_key), index_id


def has_default_tl_account():
    return bool(os.environ.get("TWELVELABS_API_KEY"))
```

Also add `abort` to the Flask import line near the top of the file:

```python
from flask import Flask, request, jsonify, send_from_directory, abort
```

- [ ] **Step 2: Replace `/api/health` so the frontend can detect a default account**

Find lines 1159-1162 (`@app.route('/api/health')` + `def health_check`). Replace with:

```python
@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'has_default_account': has_default_tl_account(),
    })
```

- [ ] **Step 3: Verify the server still imports cleanly**

Run from the repo root:

```bash
cd backend && python -c "import app; print('import ok')"
```

Expected output: `import ok`. Fix any NameError before continuing — the rest of the file still references global `client` and `INDEX_ID`, which is fine until subsequent tasks rewrite them. The import itself must succeed because nothing executes those refs at import time.

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "refactor(backend): add get_tl_context helper, expose has_default_account in /api/health"
```

---

### Task 2: Switch read-only routes to `get_tl_context`

**Files:**
- Modify: `backend/app.py` — `list_videos` (1959+), `get_video_details_with_thumbnail` (2044+), `get_video_details` (2069+), `get_video_thumbnail` (2107+), `search_brands` (2582+)

- [ ] **Step 1: Update `list_videos`**

Find `def list_videos():` around line 1960. The body currently uses `client` and `INDEX_ID`. At the top of the `try:` block (right after `try:`), insert:

```python
        tl_client, index_id = get_tl_context(request)
```

Then in the same function, replace every occurrence of `client.` with `tl_client.` and every occurrence of `INDEX_ID` with `index_id`. Spot-check the lines that grep flagged: 1963, 1966-1967, 2026, 2039.

- [ ] **Step 2: Update `get_video_details_with_thumbnail`**

This is a helper, not a route — it doesn't have access to `request`. Change its signature from:

```python
def get_video_details_with_thumbnail(video_id: str):
```

to:

```python
def get_video_details_with_thumbnail(video_id: str, tl_client, index_id: str):
```

And inside the function, replace `client.` → `tl_client.` and `INDEX_ID` → `index_id`. Spot-check around line 2048-2049.

- [ ] **Step 3: Update `get_video_details` route**

At line 2070-ish, in `def get_video_details(video_id):`, immediately inside the `try:` block add:

```python
        tl_client, index_id = get_tl_context(request)
```

Update the call to the helper from `get_video_details_with_thumbnail(video_id)` to `get_video_details_with_thumbnail(video_id, tl_client, index_id)`.

- [ ] **Step 4: Update `get_video_thumbnail` route**

Same pattern at line 2108. Add `tl_client, index_id = get_tl_context(request)` inside `try:` and pass the new args if it also calls `get_video_details_with_thumbnail` (open and read the function body to confirm; if it uses `client`/`INDEX_ID` directly, swap those refs too).

- [ ] **Step 5: Update `search_brands`**

At line 2583, inside the `try:` block, add `tl_client, index_id = get_tl_context(request)`. Replace `client.search.query(index_id=INDEX_ID, ...)` (line 2591-2592) with `tl_client.search.query(index_id=index_id, ...)`.

- [ ] **Step 6: Confirm no stale `client.` or `INDEX_ID` remain in these routes**

Run:

```bash
grep -n "INDEX_ID\| client\." backend/app.py | grep -vE "openai_client|tl_client|# "
```

The only matches should be in the analysis routes (Tasks 3-5) — `analyze_video_with_progress`, `analyze_video`, `analyze_multiple_videos_with_progress`. Anything in `list_videos`, `get_video_details*`, `get_video_thumbnail`, `search_brands` means you missed a reference.

- [ ] **Step 7: Smoke-test the dev server**

```bash
cd backend && python app.py &
sleep 2
curl -s http://localhost:5000/api/health
curl -s http://localhost:5000/api/videos | head -c 400
kill %1
```

Both calls should succeed (env vars are still doing the work). If you get a 401 on `/api/videos`, your `.env` lacks `TWELVELABS_API_KEY` — set it before continuing.

- [ ] **Step 8: Commit**

```bash
git add backend/app.py
git commit -m "refactor(backend): route TL client/index through get_tl_context for list/details/search"
```

---

### Task 3: Switch `/api/analyze/<video_id>` (sync analyze) to `get_tl_context`

**Files:**
- Modify: `backend/app.py` — `analyze_video` (2126+)

- [ ] **Step 1: Add the helper call**

Open `def analyze_video(video_id):` at line 2127. Inside the outermost `try:`, before the first `client.` call, add:

```python
        tl_client, index_id = get_tl_context(request)
```

- [ ] **Step 2: Replace all `client.` and `INDEX_ID` references in this function**

This function is long and uses `client.analyze(...)` at lines 2161 and 2255, and `client.indexes.videos.retrieve(index_id=INDEX_ID, ...)` at lines 2493-2494. Replace:
- `client.` → `tl_client.`
- `INDEX_ID` → `index_id`

Search within the function body to make sure you got them all:

```bash
awk 'NR==2127,/^@app.route|^def / {print NR": "$0}' backend/app.py | grep -E "client\.|INDEX_ID"
```

(The `awk` slice reads the function body. After the change, only `openai_client.` references should remain.)

- [ ] **Step 3: Smoke-test**

```bash
cd backend && python app.py &
sleep 2
curl -s -X POST "http://localhost:5000/api/analyze/dummy-id" | head -c 200
kill %1
```

This will fail (dummy id doesn't exist) but the failure should be a TwelveLabs SDK error, not a Python `NameError`. A `NameError` means a `client`/`INDEX_ID` reference was missed.

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "refactor(backend): thread per-request TL context into sync /api/analyze"
```

---

### Task 4: Thread credentials through background single-video analysis

**Files:**
- Modify: `backend/app.py` — `start_analysis` (1164+), `analyze_video_with_progress` (1211+)

The background worker can't call `get_tl_context(request)` because Flask's request context doesn't exist inside the spawned thread. The fix is to pass `(api_key, index_id)` as worker arguments and construct a local `TwelveLabs` client inside the thread.

- [ ] **Step 1: Capture creds in `start_analysis` and forward to the thread**

Find `def start_analysis(video_id):` at line 1165. Inside the `try:` block, after `data = request.get_json() or {}` and `selected_brands = data.get(...)`, add:

```python
        api_key = request.headers.get("X-TL-Api-Key") or os.getenv("TWELVELABS_API_KEY", "")
        index_id = request.headers.get("X-TL-Index-Id") or os.getenv("TWELVELABS_INDEX_ID", "")
        if not api_key:
            return jsonify({'error': 'Missing TwelveLabs API key'}), 401
        if not index_id:
            return jsonify({'error': 'Missing TwelveLabs index ID'}), 400
```

Then change the thread spawn at line 1181-1184 from:

```python
        analysis_thread = threading.Thread(
            target=analyze_video_with_progress,
            args=(video_id, job_id, selected_brands)
        )
```

to:

```python
        analysis_thread = threading.Thread(
            target=analyze_video_with_progress,
            args=(video_id, job_id, selected_brands, api_key, index_id)
        )
```

- [ ] **Step 2: Update `analyze_video_with_progress` signature and body**

Find `def analyze_video_with_progress(video_id: str, job_id: str, selected_brands: list = None):` at line 1211. Replace its signature with:

```python
def analyze_video_with_progress(video_id: str, job_id: str, selected_brands: list = None, api_key: str = None, index_id: str = None):
```

Right after the docstring/log line at the top of the function body, add:

```python
        # Build a per-job TL client so background threads don't share request state.
        if not api_key:
            api_key = os.getenv("TWELVELABS_API_KEY", "")
        if not index_id:
            index_id = os.getenv("TWELVELABS_INDEX_ID", "")
        tl_client = TwelveLabs(api_key=api_key)
```

Then within this function, replace every `client.` with `tl_client.` and every `INDEX_ID` with `index_id`. The grep hits inside this function are at lines 1326 (`client.analyze`), 1370-1371 (`client.indexes.videos.retrieve(index_id=INDEX_ID, ...)`).

Verify by re-running the awk slice from Task 3, Step 2 against this function range.

- [ ] **Step 3: Smoke-test**

```bash
cd backend && python app.py &
sleep 2
# Use a real video id from your env-default index if known; otherwise this 404s, which is fine.
curl -s -X POST "http://localhost:5000/api/analyze/REPLACE-WITH-REAL-VIDEO-ID/start" \
  -H "Content-Type: application/json" \
  -d '{"brands":["Nike"]}'
kill %1
```

Expected: a JSON response with a `job_id`. The job will run in the background using env defaults. A `NameError` mentioning `client` or `INDEX_ID` means a reference was missed inside `analyze_video_with_progress`.

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "refactor(backend): pass TL credentials into single-video analysis worker"
```

---

### Task 5: Thread credentials through multi-video analysis

**Files:**
- Modify: `backend/app.py` — `start_multi_video_analysis` (1585+), `analyze_single_video_parallel` (1627+), `analyze_multiple_videos_with_progress` (1652+)

- [ ] **Step 1: Capture creds in `start_multi_video_analysis`**

Inside the `try:` block of `def start_multi_video_analysis():` (line 1586), after `selected_brands = data.get('brands', [])`, add the same credential-capture block from Task 4 Step 1:

```python
        api_key = request.headers.get("X-TL-Api-Key") or os.getenv("TWELVELABS_API_KEY", "")
        index_id = request.headers.get("X-TL-Index-Id") or os.getenv("TWELVELABS_INDEX_ID", "")
        if not api_key:
            return jsonify({'error': 'Missing TwelveLabs API key'}), 401
        if not index_id:
            return jsonify({'error': 'Missing TwelveLabs index ID'}), 400
```

Update the thread spawn at line 1606-1609 from:

```python
        analysis_thread = threading.Thread(
            target=analyze_multiple_videos_with_progress,
            args=(video_ids, job_id, selected_brands)
        )
```

to:

```python
        analysis_thread = threading.Thread(
            target=analyze_multiple_videos_with_progress,
            args=(video_ids, job_id, selected_brands, api_key, index_id)
        )
```

- [ ] **Step 2: Update `analyze_multiple_videos_with_progress`**

Find `def analyze_multiple_videos_with_progress(video_ids: list, job_id: str, selected_brands: list = None):` at line 1652. Replace its signature:

```python
def analyze_multiple_videos_with_progress(video_ids: list, job_id: str, selected_brands: list = None, api_key: str = None, index_id: str = None):
```

Inside the function body, find every call to `analyze_single_video_parallel(...)` and add the new args. The function passes video IDs through a `ThreadPoolExecutor` (read the body to locate the `executor.submit` or similar call) — wherever `analyze_single_video_parallel(video_id, selected_brands)` is called, change to `analyze_single_video_parallel(video_id, selected_brands, api_key, index_id)`.

- [ ] **Step 3: Update `analyze_single_video_parallel`**

Find `def analyze_single_video_parallel(video_id: str, selected_brands: list = None):` at line 1627. Replace signature:

```python
def analyze_single_video_parallel(video_id: str, selected_brands: list = None, api_key: str = None, index_id: str = None):
```

In the body (line 1635), change:

```python
        analyze_video_with_progress(video_id, temp_job_id, selected_brands)
```

to:

```python
        analyze_video_with_progress(video_id, temp_job_id, selected_brands, api_key, index_id)
```

- [ ] **Step 4: Smoke-test**

```bash
cd backend && python app.py &
sleep 2
curl -s -X POST "http://localhost:5000/api/analyze/multi/start" \
  -H "Content-Type: application/json" \
  -d '{"video_ids":["fake-1","fake-2"],"brands":["Nike"]}'
kill %1
```

Expected: JSON with a `job_id`. The background jobs will fail individually but the orchestration shouldn't crash with `NameError`.

- [ ] **Step 5: Commit**

```bash
git add backend/app.py
git commit -m "refactor(backend): pass TL credentials into multi-video analysis worker"
```

---

### Task 6: Add `GET /api/indexes` endpoint

**Files:**
- Modify: `backend/app.py` — insert a new route below `/api/health` (around line 1163)

- [ ] **Step 1: Add the route**

After the `health_check` function (after line 1162 once Task 1 is applied), insert:

```python
@app.route('/api/indexes')
def list_indexes():
    """List TwelveLabs indexes for the supplied API key."""
    try:
        tl_client, _ = get_tl_context(request, require_index=False)
        indexes_pager = tl_client.indexes.list()
        results = []
        for idx in indexes_pager:
            results.append({
                'id': getattr(idx, 'id', None) or getattr(idx, '_id', None),
                'name': getattr(idx, 'index_name', None) or getattr(idx, 'name', None),
                'video_count': getattr(idx, 'video_count', None),
                'created_at': getattr(idx, 'created_at', None),
            })
        return jsonify({'indexes': results})
    except Exception as e:
        logger.error(f"Error listing indexes: {str(e)}")
        return jsonify({'error': str(e)}), 500
```

**Why the `getattr` chain:** the twelvelabs-py SDK has shifted property names across minor versions (`id` vs `_id`, `index_name` vs `name`). Reading defensively avoids breaking when the SDK is upgraded.

- [ ] **Step 2: Smoke-test against env default**

```bash
cd backend && python app.py &
sleep 2
curl -s http://localhost:5000/api/indexes
kill %1
```

Expected: `{"indexes":[{"id":"…","name":"…","video_count":…,"created_at":"…"}, …]}`. If `id` or `name` is `null`, the SDK uses a different attribute name — open a Python REPL with `from twelvelabs import TwelveLabs; client = TwelveLabs(api_key="...")` and inspect `list(client.indexes.list())[0].__dict__` to find the actual field, then update the `getattr` chain.

- [ ] **Step 3: Smoke-test with explicit headers**

```bash
cd backend && python app.py &
sleep 2
curl -s http://localhost:5000/api/indexes \
  -H "X-TL-Api-Key: $TWELVELABS_API_KEY"
kill %1
```

Should return the same payload as Step 2. Try with an obviously wrong key (`-H "X-TL-Api-Key: tlk_bad"`) — expect a 500 with the SDK auth error in the body (the SDK raises before our 401 check would help; that's fine, the frontend will read the error response).

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "feat(backend): add GET /api/indexes for in-app account+index switching"
```

---

### Task 7: Update `env.example`

**Files:**
- Modify: `env.example`

- [ ] **Step 1: Document that env keys are now optional defaults**

Replace the entire file contents with:

```
# TwelveLabs API Configuration (OPTIONAL — these now act as a default account.
# When set, the in-app "Use default demo account" button appears. Users can
# also paste their own API key + pick an index inside the app.)
TWELVELABS_API_KEY=your_twelvelabs_api_key_here
TWELVELABS_INDEX_ID=your_index_id_here

# OpenAI API Configuration (server-side only; not exposed to users)
OPENAI_API_KEY=your_openai_api_key_here

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
```

- [ ] **Step 2: Commit**

```bash
git add env.example
git commit -m "docs: env keys are optional defaults after account-switching feature"
```

---

## Phase 2 — Frontend foundations

### Task 8: Extend frontend types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add types and extend `AppStep`**

Find the existing `AppStep` type (search the file). Replace the existing union with:

```ts
export type AppStep = 'connect' | 'brand-search' | 'video-selection' | 'analysis' | 'results';
```

Add at the bottom of the file:

```ts
export interface TLAccount {
  id: string;
  nickname: string;
  apiKey: string;
  indexId: string;
  indexName: string;
  createdAt: string;
}

export interface TLIndex {
  id: string;
  name: string;
  videoCount: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  has_default_account: boolean;
}

export interface IndexesResponse {
  indexes: Array<{
    id: string;
    name: string;
    video_count: number;
    created_at: string;
  }>;
}
```

- [ ] **Step 2: Verify the TS compiler still resolves the module**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. (There will be warnings about App.tsx referencing the old AppStep values, but those only show as errors if the union is *narrower* than before — adding `'connect'` keeps existing values valid.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(frontend): add TLAccount, TLIndex, HealthResponse types and 'connect' step"
```

---

### Task 9: Create `accountStorage.ts`

**Files:**
- Create: `frontend/src/lib/accountStorage.ts`

- [ ] **Step 1: Write the module**

Create `frontend/src/lib/accountStorage.ts` with:

```ts
// Stores TwelveLabs API keys + index selections in browser localStorage.
// Demo posture: keys are visible to anything with DOM access on this origin.
// Don't reuse this pattern for production multi-tenant code.
import { TLAccount } from '../types';

const ACCOUNTS_KEY = 'tl-brc-accounts';
const ACTIVE_KEY = 'tl-brc-active-account';
const RECENT_BRANDS_PREFIX = 'tl-brc-recent-brands:';

function readAccountsRaw(): TLAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listAccounts(): TLAccount[] {
  return readAccountsRaw();
}

export function saveAccount(account: TLAccount): void {
  const accounts = readAccountsRaw().filter(a => a.id !== account.id);
  accounts.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function removeAccount(id: string): void {
  const accounts = readAccountsRaw().filter(a => a.id !== id);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  if (getActiveAccountId() === id) {
    setActiveAccountId(null);
  }
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveAccountId(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    localStorage.setItem(ACTIVE_KEY, id);
  }
}

export function getActiveAccount(): TLAccount | null {
  const id = getActiveAccountId();
  if (!id) return null;
  return readAccountsRaw().find(a => a.id === id) || null;
}

export function getRecentBrands(accountId: string | null): string[] {
  if (!accountId) return [];
  try {
    const raw = localStorage.getItem(RECENT_BRANDS_PREFIX + accountId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(b => typeof b === 'string') : [];
  } catch {
    return [];
  }
}

export function setRecentBrands(accountId: string | null, brands: string[]): void {
  if (!accountId) return;
  localStorage.setItem(RECENT_BRANDS_PREFIX + accountId, JSON.stringify(brands));
}

export function generateAccountId(): string {
  // crypto.randomUUID is available in all modern browsers we target
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  }
  return 'acc-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/accountStorage.ts
git commit -m "feat(frontend): add accountStorage module for TL account persistence"
```

---

### Task 10: Create `AccountContext.tsx`

**Files:**
- Create: `frontend/src/lib/AccountContext.tsx`

- [ ] **Step 1: Write the context**

Create `frontend/src/lib/AccountContext.tsx` with:

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TLAccount } from '../types';
import {
  getActiveAccount,
  listAccounts,
  removeAccount as storageRemove,
  saveAccount as storageSave,
  setActiveAccountId as storageSetActive,
} from './accountStorage';

interface AccountContextValue {
  accounts: TLAccount[];
  activeAccount: TLAccount | null;
  refresh: () => void;
  addAccount: (a: TLAccount) => void;
  removeAccount: (id: string) => void;
  setActive: (id: string | null) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<TLAccount[]>(() => listAccounts());
  const [activeAccount, setActiveAccount] = useState<TLAccount | null>(() => getActiveAccount());

  const refresh = useCallback(() => {
    setAccounts(listAccounts());
    setActiveAccount(getActiveAccount());
  }, []);

  const addAccount = useCallback((a: TLAccount) => {
    storageSave(a);
    refresh();
  }, [refresh]);

  const removeAccount = useCallback((id: string) => {
    storageRemove(id);
    refresh();
  }, [refresh]);

  const setActive = useCallback((id: string | null) => {
    storageSetActive(id);
    refresh();
  }, [refresh]);

  // The api.ts response interceptor dispatches this event on 401.
  useEffect(() => {
    const handler = () => {
      storageSetActive(null);
      refresh();
    };
    window.addEventListener('tl-auth-required', handler);
    return () => window.removeEventListener('tl-auth-required', handler);
  }, [refresh]);

  const value = useMemo(
    () => ({ accounts, activeAccount, refresh, addAccount, removeAccount, setActive }),
    [accounts, activeAccount, refresh, addAccount, removeAccount, setActive],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export function useAccounts(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccounts must be used inside <AccountProvider>');
  return ctx;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/AccountContext.tsx
git commit -m "feat(frontend): add AccountContext + useAccounts hook"
```

---

### Task 11: Wire axios interceptors + add `listIndexes` / `getHealth`

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add the imports + interceptors**

At the top of `frontend/src/services/api.ts`, add to the import block (line 2-9):

```ts
import { HealthResponse, IndexesResponse } from '../types';
import { getActiveAccount } from '../lib/accountStorage';
```

After the `api.interceptors.response.use(...)` block at lines 21-27, replace the existing interceptors with:

```ts
api.interceptors.request.use((config) => {
  // Allow individual calls to opt out via { skipAuthHeaders: true } config.
  // listIndexes uses an explicit per-call key during the connect flow.
  if ((config as any).skipAuthHeaders) return config;
  const account = getActiveAccount();
  if (account) {
    config.headers = config.headers || {};
    (config.headers as any)['X-TL-Api-Key'] = account.apiKey;
    (config.headers as any)['X-TL-Index-Id'] = account.indexId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    const status = error?.response?.status;
    const skipRedirect = error?.config && (error.config as any).skipAuthRedirect;
    if (status === 401 && !skipRedirect) {
      window.dispatchEvent(new CustomEvent('tl-auth-required'));
    }
    return Promise.reject(error);
  }
);
```

(Delete the original response interceptor at lines 21-27 since the new block above replaces it.)

- [ ] **Step 2: Add `getHealth` and `listIndexes` to `ApiService`**

Inside the `ApiService` class, after the `healthCheck` method (line 36-ish), add:

```ts
  /**
   * Health check with default-account hint.
   */
  static async getHealth(): Promise<HealthResponse> {
    const response: AxiosResponse<HealthResponse> = await api.get('/health', {
      skipAuthHeaders: true,
      skipAuthRedirect: true,
    } as any);
    return response.data;
  }

  /**
   * List indexes available for an API key. Used during the Connect flow
   * before any account has been persisted, so the key is injected manually.
   */
  static async listIndexes(apiKey: string): Promise<IndexesResponse> {
    const response: AxiosResponse<IndexesResponse> = await api.get('/indexes', {
      headers: { 'X-TL-Api-Key': apiKey },
      skipAuthHeaders: true,
      skipAuthRedirect: true,
    } as any);
    return response.data;
  }
```

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. The `as any` casts on `skipAuthHeaders`/`skipAuthRedirect` are intentional — axios v0/v1 doesn't expose these on its config type, but it passes them through to the interceptors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(frontend): inject per-account TL headers via axios interceptor"
```

---

## Phase 3 — Connect step UI

### Task 12: Create `ConnectAccount.tsx`

**Files:**
- Create: `frontend/src/components/ConnectAccount.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/ConnectAccount.tsx` with:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plug, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Text } from './ui/Text';
import ApiService from '../services/api';
import { useAccounts } from '../lib/AccountContext';
import { generateAccountId } from '../lib/accountStorage';
import { TLAccount, TLIndex } from '../types';

interface ConnectAccountProps {
  onConnected: () => void;
}

const ConnectAccount: React.FC<ConnectAccountProps> = ({ onConnected }) => {
  const { accounts, addAccount, removeAccount, setActive } = useAccounts();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [indexes, setIndexes] = useState<TLIndex[] | null>(null);
  const [pickedIndexId, setPickedIndexId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');

  const [hasDefault, setHasDefault] = useState(false);

  useEffect(() => {
    ApiService.getHealth()
      .then(h => setHasDefault(!!h.has_default_account))
      .catch(() => setHasDefault(false));
  }, []);

  const pickedIndex = useMemo(
    () => indexes?.find(i => i.id === pickedIndexId) || null,
    [indexes, pickedIndexId],
  );

  useEffect(() => {
    if (pickedIndex && !nickname) {
      setNickname(pickedIndex.name);
    }
  }, [pickedIndex, nickname]);

  const handleConnect = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setError('Paste your TwelveLabs API key first.');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const { indexes: raw } = await ApiService.listIndexes(trimmed);
      const mapped: TLIndex[] = raw.map(i => ({
        id: i.id,
        name: i.name || '(unnamed index)',
        videoCount: i.video_count ?? 0,
      }));
      if (mapped.length === 0) {
        setError('This account has no indexes. Create one at twelvelabs.io first.');
      } else {
        setIndexes(mapped);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error;
      if (status === 401) {
        setError('Invalid API key. Check the tlk_ prefix and try again.');
      } else if (apiMsg) {
        setError(apiMsg);
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
      setIndexes(null);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = () => {
    if (!pickedIndex) return;
    const account: TLAccount = {
      id: generateAccountId(),
      nickname: nickname.trim() || pickedIndex.name,
      apiKey: apiKeyInput.trim(),
      indexId: pickedIndex.id,
      indexName: pickedIndex.name,
      createdAt: new Date().toISOString(),
    };
    addAccount(account);
    setActive(account.id);
    onConnected();
  };

  const handleUseDefault = () => {
    setActive(null);
    onConnected();
  };

  const handleSwitchTo = (accountId: string) => {
    setActive(accountId);
    onConnected();
  };

  return (
    <Card className="w-full p-6">
      <Card.Header className="p-0 mb-6">
        <Card.Title className="flex items-center">
          <Plug className="w-6 h-6 mr-2" />
          Connect TwelveLabs Account
        </Card.Title>
        <Text as="p" className="text-black mt-2">
          Paste an API key from your TwelveLabs dashboard, pick an index, and we'll remember it for this browser.
        </Text>
      </Card.Header>

      {accounts.length > 0 && (
        <div className="mb-6">
          <Text as="h3" className="text-sm font-medium mb-2">Saved accounts</Text>
          <div className="space-y-2">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Text as="p" className="font-medium">{a.nickname}</Text>
                  <Text as="p" className="text-xs text-black/70">{a.indexName}</Text>
                </div>
                <div className="flex space-x-2">
                  <Button variant="secondary" size="sm" onClick={() => handleSwitchTo(a.id)}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Switch
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removeAccount(a.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!indexes && (
        <>
          <div className="mb-3">
            <Text as="label" className="text-sm font-medium block mb-1">TwelveLabs API key</Text>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="tlk_..."
                disabled={validating}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 h-6 w-6"
                type="button"
              >
                {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          {error && (
            <Text as="p" className="text-sm text-red-600 mb-3">{error}</Text>
          )}

          <div className="flex items-center justify-between">
            <Button onClick={handleConnect} disabled={validating}>
              {validating ? 'Connecting…' : 'Connect'}
            </Button>
            {hasDefault && accounts.length === 0 && (
              <Button variant="secondary" onClick={handleUseDefault}>
                Use default demo account
              </Button>
            )}
          </div>
        </>
      )}

      {indexes && (
        <>
          <Text as="h3" className="text-sm font-medium mb-2">Pick an index</Text>
          <div className="space-y-2 mb-4">
            {indexes.map(i => (
              <label
                key={i.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                  pickedIndexId === i.id ? 'border-orange-500 bg-orange-50' : ''
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="tl-index"
                    className="mr-3"
                    checked={pickedIndexId === i.id}
                    onChange={() => setPickedIndexId(i.id)}
                  />
                  <Text as="p" className="font-medium">{i.name}</Text>
                </div>
                <Text as="p" className="text-xs text-black/70">{i.videoCount} videos</Text>
              </label>
            ))}
          </div>

          <div className="mb-3">
            <Text as="label" className="text-sm font-medium block mb-1">Nickname (so you can find it later)</Text>
            <Input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Prospect A"
            />
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setIndexes(null); setPickedIndexId(null); }}>
              Back
            </Button>
            <Button onClick={handleSave} disabled={!pickedIndexId}>
              Save & Continue
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default ConnectAccount;
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If `Eye`/`EyeOff`/`Plug`/`RotateCcw`/`Trash2` aren't in lucide-react, swap them for any installed icons (`Plug`, `RefreshCw`, `X` are universally present in lucide-react). If the existing `ui/Button`, `ui/Input`, `ui/Text`, `ui/Card` components don't accept these exact props, mimic the prop shapes used in `BrandSearch.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ConnectAccount.tsx
git commit -m "feat(frontend): add ConnectAccount component (key entry + index picker)"
```

---

### Task 13: Wire `AccountProvider` and the new step into `App.tsx`

**Files:**
- Modify: `frontend/src/index.tsx` (or `App.tsx`, whichever currently mounts the root) and `frontend/src/App.tsx`

- [ ] **Step 1: Wrap the tree in `AccountProvider`**

Open `frontend/src/index.tsx`. Find the `ReactDOM.createRoot(...).render(<App />)` call (or `ReactDOM.render(<App />, ...)`). Wrap `<App />` so it becomes:

```tsx
import { AccountProvider } from './lib/AccountContext';

// inside the render:
  <AccountProvider>
    <App />
  </AccountProvider>
```

Add the import at the top of the file.

- [ ] **Step 2: Update `App.tsx` to use the account context**

Open `frontend/src/App.tsx`. Add to the imports near the top:

```tsx
import { useAccounts } from './lib/AccountContext';
import ConnectAccount from './components/ConnectAccount';
import { Plug } from 'lucide-react';
```

Inside `function App()` (after the existing `useAnalysis()` destructure at lines 15-26), add:

```tsx
  const { activeAccount } = useAccounts();
```

Change the `currentStep` initial state at line 29 from:

```tsx
  const [currentStep, setCurrentStep] = useState<AppStep>('brand-search');
```

to:

```tsx
  const [currentStep, setCurrentStep] = useState<AppStep>(() =>
    activeAccount ? 'brand-search' : 'connect'
  );
```

- [ ] **Step 3: Update the step indicator (line 193)**

Find the array literal `['brand-search', 'video-selection', 'analysis', 'results']` (line 193 and again at 198, 206). Replace **every** occurrence in the file with:

```tsx
['connect', 'brand-search', 'video-selection', 'analysis', 'results']
```

Also change `{index < 3 && (` (line 204) to `{index < 4 && (` so the connector lines render correctly for the 5-step indicator.

- [ ] **Step 4: Add the Connect step render branch**

In the "Step Content" block (around line 217), insert a new branch above the `currentStep === 'brand-search'` branch:

```tsx
          {currentStep === 'connect' && (
            <div className="animate-fade-in">
              <ConnectAccount onConnected={() => setCurrentStep('brand-search')} />
            </div>
          )}
```

- [ ] **Step 5: Update `handleStartNew` to preserve account**

Find `handleStartNew` at line 136. Replace its body so it goes to `'brand-search'` (not `'connect'`):

```tsx
  const handleStartNew = () => {
    setCurrentStep('brand-search');
    setSelectedBrands([]);
    setSelectedVideoIds([]);
    setMultiVideoMode(false);
  };
```

(If it already does this, leave it alone.)

- [ ] **Step 6: Verify it compiles + runs locally**

```bash
cd frontend && npx tsc --noEmit
```

Then in two terminals:

```bash
# Terminal 1
cd backend && python app.py

# Terminal 2
cd frontend && npm start
```

Open http://localhost:3000 (or whatever port `npm start` reports). Expected:
- First load shows the Connect step.
- If `TWELVELABS_API_KEY` is set on the server, a "Use default demo account" button appears.
- Pasting a real key and clicking Connect populates the index list.
- Saving advances to the brand step.
- A reload while an account is active skips Connect and lands on the brand step.

If `npm start` reports `frontend/src/services/api.ts` pointing at the deployed Railway URL, temporarily change `baseURL` in `services/api.ts` to `http://localhost:5000/api` for testing (revert before the final commit).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/index.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add Connect step + AccountProvider to app shell"
```

---

### Task 14: Add the header switcher badge

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace the header right-hand cluster**

In `frontend/src/App.tsx`, locate the `<div className="flex items-center space-x-4">` block around line 157 (inside the header). Replace its current contents with:

```tsx
            <div className="flex items-center space-x-4">
              {activeAccount && currentStep !== 'connect' && (
                <button
                  type="button"
                  onClick={() => setCurrentStep('connect')}
                  className="flex items-center text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full"
                  title="Switch account or index"
                >
                  <Plug className="w-3 h-3 mr-1" />
                  <span className="font-medium mr-1">{activeAccount.nickname}</span>
                  <span className="opacity-80">· {activeAccount.indexName}</span>
                  <span className="ml-2 underline">switch</span>
                </button>
              )}

              {currentStep !== 'brand-search' && currentStep !== 'connect' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGoBack}
                  className="flex items-center bg-orange-500 text-white hover:bg-orange-600 border-orange-500 hover:border-orange-600"
                  disabled={analysisLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}

              {currentStep === 'results' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStartNew}
                  className="flex items-center"
                >
                  Start New Analysis
                </Button>
              )}
            </div>
```

Note the second `Back` button now requires `currentStep !== 'connect'` so Back doesn't appear on the Connect step.

- [ ] **Step 2: Update `handleGoBack`**

Find `handleGoBack` at line 126. Replace with:

```tsx
  const handleGoBack = () => {
    if (currentStep === 'brand-search') {
      setCurrentStep('connect');
    } else if (currentStep === 'video-selection') {
      setCurrentStep('brand-search');
    } else if (currentStep === 'analysis' || currentStep === 'results') {
      setCurrentStep('video-selection');
      setSelectedVideoIds([]);
    }
  };
```

- [ ] **Step 3: Re-verify in the browser**

Restart `npm start` if needed. Expected:
- When an account is active, header shows `Plug nickname · indexName switch`.
- Clicking it routes back to Connect, where you can pick a different saved account or add a new one.
- Switching preserves `selectedBrands` because we only change `currentStep`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): add header account switcher + Back wiring for new step"
```

---

## Phase 4 — Brand prep ergonomics

### Task 15: BrandSearch — Clear All + Paste List

**Files:**
- Modify: `frontend/src/components/BrandSearch.tsx`

- [ ] **Step 1: Replace the Selected Brands section so the toolbar is always visible**

Open `frontend/src/components/BrandSearch.tsx`. Find this block (around lines 260-286):

```tsx
      {/* Selected Brands */}
      {selectedBrands.length > 0 && (
        <div className="mb-6">
          <Text as="h3" className="text-sm font-medium mb-3">
            Selected Brands ({selectedBrands.length})
          </Text>
          <div className="flex flex-wrap gap-2">
            {selectedBrands.map((brand) => (
              <Badge
                key={brand}
                variant="default"
                className="px-3 py-1.5 text-sm flex items-center"
              >
                {brand}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBrandRemove(brand)}
                  className="ml-2 p-0 h-4 w-4 hover:bg-destructive/20"
                  disabled={isLoading}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
```

Replace it with:

```tsx
      {/* Selected Brands + toolbar (always visible — paste list works on empty state) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Text as="h3" className="text-sm font-medium">
            Selected Brands ({selectedBrands.length})
          </Text>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasteOpen(v => !v)}
              disabled={isLoading}
            >
              {pasteOpen ? 'Cancel' : 'Paste list'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelectedBrands([]); onBrandsSelect([]); }}
              disabled={isLoading || selectedBrands.length === 0}
            >
              Clear all
            </Button>
          </div>
        </div>

        {pasteOpen && (
          <div className="mb-3 p-3 border rounded-lg">
            <textarea
              className="w-full p-2 border rounded text-sm font-mono"
              rows={3}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Nike, Adidas&#10;Ford&#10;Coca-Cola"
            />
            <div className="flex justify-end mt-2 space-x-2">
              <Button variant="outline" size="sm" onClick={() => { setPasteText(''); setPasteOpen(false); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handlePasteAdd}>
                Add
              </Button>
            </div>
          </div>
        )}

        {selectedBrands.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedBrands.map((brand) => (
              <Badge
                key={brand}
                variant="default"
                className="px-3 py-1.5 text-sm flex items-center"
              >
                {brand}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBrandRemove(brand)}
                  className="ml-2 p-0 h-4 w-4 hover:bg-destructive/20"
                  disabled={isLoading}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 2: Add the React state and handler**

In the component body (after the existing `useState` hooks near the top of `BrandSearch`), add:

```tsx
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handlePasteAdd = useCallback(() => {
    const tokens = pasteText
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) {
      setPasteOpen(false);
      setPasteText('');
      return;
    }
    const existing = new Set(selectedBrands.map(b => b.toLowerCase()));
    const additions = tokens.filter(t => !existing.has(t.toLowerCase()));
    if (additions.length > 0) {
      const next = [...selectedBrands, ...additions];
      setSelectedBrands(next);
      onBrandsSelect(next);
    }
    setPasteText('');
    setPasteOpen(false);
  }, [pasteText, selectedBrands, onBrandsSelect]);
```

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Smoke test in the browser**

Reload, on the brand step:
- Click "Paste list" → textarea opens.
- Paste `Nike, Adidas\nFord\nCoca-Cola` → click Add → 4 chips appear.
- Paste duplicates → no duplicate chips, deduped case-insensitively.
- Click "Clear all" → chip row empties.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BrandSearch.tsx
git commit -m "feat(frontend): BrandSearch Clear All + Paste List for demo prep"
```

---

### Task 16: BrandSearch — Recent brand sets

**Files:**
- Modify: `frontend/src/components/BrandSearch.tsx`, `frontend/src/App.tsx`

- [ ] **Step 1: Read recent brands in BrandSearch**

At the top of `BrandSearch.tsx`, add to the imports:

```tsx
import { useAccounts } from '../lib/AccountContext';
import { getRecentBrands } from '../lib/accountStorage';
```

Inside the component body, near the other `useState` hooks, add:

```tsx
  const { activeAccount } = useAccounts();
  const recent = useMemo(
    () => getRecentBrands(activeAccount?.id ?? null),
    [activeAccount?.id],
  );
```

Make sure `useMemo` is in the React imports (top of the file currently imports `useCallback`, `useEffect`, `useRef`, `useState` — append `useMemo`).

- [ ] **Step 2: Render the recent set**

Just above the "Search Input" block (`<div className="relative mb-6">` at line 176), insert:

```tsx
      {recent.length > 0 && selectedBrands.length === 0 && (
        <div className="mb-4 p-3 border rounded-lg bg-accent/5">
          <div className="flex items-center justify-between mb-2">
            <Text as="p" className="text-xs font-medium text-black/70">
              Recently analyzed in this account
            </Text>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedBrands(recent);
                onBrandsSelect(recent);
              }}
            >
              Use this set ({recent.length})
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {recent.map(b => (
              <span key={b} className="text-xs px-2 py-0.5 bg-white border rounded">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Persist the recent set when analysis starts in App.tsx**

Open `frontend/src/App.tsx`. Add to the imports:

```tsx
import { setRecentBrands } from './lib/accountStorage';
```

Inside `handleStartSingleAnalysis` (line 74-93), right after the `setCurrentStep('analysis')` call (around line 81), add:

```tsx
    if (activeAccount && selectedBrands.length > 0) {
      setRecentBrands(activeAccount.id, selectedBrands);
    }
```

Do the same inside `handleStartMultiVideoAnalysis` (line 101-119), right after `setCurrentStep('analysis')`.

- [ ] **Step 4: Smoke test**

In the browser:
- Save an account.
- Pick "Nike, Ford, Adidas" → analyze (any video).
- Click "Start New Analysis" or reload.
- On the brand step (with no brands selected yet), expect to see the "Recently analyzed" panel with Nike/Ford/Adidas chips and a "Use this set (3)" button.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BrandSearch.tsx frontend/src/App.tsx
git commit -m "feat(frontend): remember most-recent brand set per account"
```

---

## Phase 5 — Docs + final verification

### Task 17: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite the Environment Setup and Usage sections**

Replace lines 61-71 (the "Environment Setup" block under section 2):

```markdown
### 2. Environment Setup (optional)

The app no longer requires environment variables at boot — users connect their own TwelveLabs account from inside the app. If you want a "default demo account" button to appear on the Connect screen, you can still set:

```bash
cp env.example .env

# Optional — these become the fallback default the Connect screen offers as a one-click button
TWELVELABS_API_KEY=your_twelvelabs_api_key
TWELVELABS_INDEX_ID=your_index_id

# Required for AI insights / executive summary / competitive analysis (server-side only)
OPENAI_API_KEY=your_openai_api_key
```
```

Then replace the "Usage" block at lines 109-117 with:

```markdown
## 📖 Usage

### Video Analysis Workflow
1. **Connect**: Paste your TwelveLabs API key, pick an index. The app remembers it per browser. Save multiple accounts and switch between them from the header chip mid-session.
2. **Brand Selection**: Pick brands to analyze. "Paste list" accepts a comma/newline-separated list; "Recently analyzed in this account" replays the last set you used.
3. **Video Selection**: Pick one or multiple videos from the connected index.
4. **Analysis**: Run analysis. Results dashboard renders inline.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for in-app account/index switching"
```

---

### Task 18: End-to-end manual verification

**Files:** none

Run through each scenario. Mark the checkbox as you confirm. If anything fails, fix and re-commit; don't proceed until each passes.

- [ ] **Step 1: First-visit Connect flow**

In a fresh browser (or after `localStorage.clear()` from the devtools console), reload. Expected: lands on the Connect step.

- [ ] **Step 2: Invalid key**

Paste `tlk_obviously_bad`. Click Connect. Expected: inline error "Invalid API key. Check the tlk_ prefix and try again." No account saved.

- [ ] **Step 3: Valid key + index pick + save**

Paste a real `tlk_…` key. Click Connect. Expect index list. Pick one. Click Save & Continue. Expect to land on the brand step with the header chip showing nickname + index name.

- [ ] **Step 4: Use default demo account**

`localStorage.clear()` again. Confirm Connect step shows the "Use default demo account" button (only when the server env has `TWELVELABS_API_KEY`). Click it. Expect to land on brand step with no header chip (since no account was persisted). Confirm video list still loads (server uses env defaults).

- [ ] **Step 5: Multiple accounts + mid-demo switch**

`localStorage.clear()`. Save two accounts (different prospects, real keys). On the brand step, click the header chip → goes to Connect → "Saved accounts" lists both → click Switch on the second → returns to brand step → header chip reflects the new account → brand selection from before is preserved → on the video step, the video list now reflects the second account's index.

- [ ] **Step 6: Paste list**

On the brand step, click Paste list. Paste `Nike, Adidas\nFord\nCoca-Cola`. Click Add. Expect 4 chips. Open Paste list again, paste `nike, microsoft`. Click Add. Expect Microsoft added, Nike deduped.

- [ ] **Step 7: Clear all**

With chips selected, click Clear all. Expect chip row empties. The "Continue to Video Selection" button disables.

- [ ] **Step 8: Recent set**

Pick Nike + Ford. Analyze any video to completion (or far enough that the analysis started). Reload. On the brand step (with nothing selected), expect "Recently analyzed in this account: Nike, Ford [Use this set (2)]". Click it → both chips re-appear.

- [ ] **Step 9: Auth expired flow**

In another browser tab, log into the TwelveLabs dashboard and revoke a saved key — or in devtools, manually corrupt the saved key (`localStorage` → edit `tl-brc-accounts` → bad key). Trigger any API call (refresh video list). Expect a toast or redirect back to Connect; active account cleared.

- [ ] **Step 10: Reload preserves state**

With an active account and a brand selection, reload. Expect to land on brand step (not Connect), with the brand chips preserved only via the recent-set replay (the in-memory chips are wiped by reload — this is fine because the spec explicitly puts persistence on the recent set, not the live selection).

- [ ] **Step 11: Single + multi analysis still work**

Pick a video → analyze → see results dashboard. Repeat in multi-video mode with 2+ videos. Confirm no `client`-related Python errors in the backend log.

- [ ] **Step 12: If any frontend baseURL was temporarily switched to localhost, revert it**

`git diff frontend/src/services/api.ts` should show only the interceptor + new method changes from Task 11 — no `baseURL` diff. If a local baseURL slipped in, revert before merging.

---

## Self-Review Notes

After writing this plan, re-checked against the spec:

- **Backend `get_tl_context`, header fallback, `/api/health` extension** → Task 1
- **All routes using `get_tl_context`** → Tasks 2-5
- **`/api/indexes`** → Task 6
- **Background thread credential threading** → Tasks 4-5
- **`env.example` update** → Task 7
- **Types (`TLAccount`, `TLIndex`, extended `AppStep`)** → Task 8
- **`accountStorage` module** → Task 9
- **`AccountContext`** → Task 10
- **Axios interceptors + `listIndexes` + `getHealth`** → Task 11
- **`ConnectAccount` component (key entry phase, index pick phase, "Use default", saved accounts list)** → Task 12
- **App.tsx new step + initial-step logic + step indicator 4→5 cells + handleStartNew preserves account** → Task 13
- **Header switcher badge + handleGoBack adjustments** → Task 14
- **BrandSearch Paste list + Clear all** → Task 15
- **BrandSearch recent set + persistence on analysis start** → Task 16
- **README** → Task 17
- **All test scenarios from the spec's Testing section** → Task 18

No spec requirement is unaccounted for. The deleted-index 404 flow (spec error table row 5) is handled implicitly by the global 401-redirect interceptor; a 404 from `/api/videos` won't auto-redirect, but the user sees the existing "Failed to fetch videos" error message and can click the header chip to switch indexes. If a sharper UX is desired here, file a follow-up — it's a tightening, not a gap.
