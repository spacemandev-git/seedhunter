# Player Webapp Architecture

> Svelte 5 + SvelteKit SPA hosted at `seedhunter.seedplex.io`

## Module Overview

```
packages/player-webapp/
├── src/
│   ├── lib/
│   │   ├── api/           # M1: API client
│   │   ├── stores/        # M2: State management
│   │   ├── components/    # M3-M7: UI components
│   │   └── utils/         # Shared utilities
│   ├── routes/
│   │   ├── +page.svelte          # Landing/Leaderboard
│   │   ├── card/+page.svelte     # Card view & trade
│   │   ├── profile/+page.svelte  # Profile QR
│   │   └── map/+page.svelte      # Admin locations
│   └── app.html
├── static/
├── svelte.config.js
└── package.json
```

---

## M1: API Client

**File:** `src/lib/api/client.ts`

**Purpose:** Type-safe HTTP client for backend communication.

**Functions to implement:**
```typescript
// Auth
async function loginWithX(): Promise<void>  // Redirect to X OAuth
async function handleCallback(code: string): Promise<Player>
async function logout(): Promise<void>

// Player
async function getPlayer(handle: string): Promise<Player>
async function getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>

// Trading
async function initTrade(): Promise<{ qrPayload: string; expiresAt: number }>
async function confirmTrade(payload: string): Promise<TradeResult>

// Map
async function getAdminLocations(): Promise<AdminLocation[]>

// Optional: Nearby players
async function updateMyLocation(lat: number, lng: number): Promise<void>
async function getNearbyPlayers(radiusMeters: number): Promise<NearbyPlayer[]>
```

**Dependencies:** None (uses fetch)

**Tests:** Mock fetch, verify request/response shapes

---

## M2: State Management

**File:** `src/lib/stores/index.ts`

**Purpose:** Svelte 5 runes-based global state.

**Stores to implement:**
```typescript
// Auth state
const auth = $state<{ player: Player | null; loading: boolean }>

// Leaderboard cache
const leaderboard = $state<LeaderboardEntry[]>([])

// Current player's card
const myCard = $state<Card | null>(null)

// Trade history
const trades = $state<Trade[]>([])

// Admin locations for map
const adminLocations = $state<AdminLocation[]>([])

// Optional: Chat messages
const chatMessages = $state<ChatMessage[]>([])
```

**Dependencies:** M1 (API Client)

**Tests:** Verify reactive updates, persistence to localStorage

---

## M3: Auth Flow Component

**File:** `src/lib/components/AuthButton.svelte`

**Purpose:** X OAuth login/logout button with loading states.

**Props:**
```typescript
interface Props {
  onLogin?: () => void
  onLogout?: () => void
}
```

**Behavior:**
1. Shows "Connect with X" when logged out
2. Shows player handle + logout when logged in
3. Handles OAuth redirect flow
4. Stores JWT in localStorage

**Dependencies:** M1, M2

---

## M4: Leaderboard Component

**File:** `src/lib/components/Leaderboard.svelte`

**Purpose:** Display ranked list of players by verified points.

**Props:**
```typescript
interface Props {
  limit?: number  // default 50
  highlightHandle?: string  // highlight current user
}
```

**Features:**
- Rank, X handle, points, trade count columns
- Pull-to-refresh on mobile
- Click row to view player's card
- Highlight current user's row

**Dependencies:** M1, M2

---

## M5: Card Display Component

**File:** `src/lib/components/FounderCard.svelte`

**Purpose:** Render a founder card with trade button.

**Props:**
```typescript
interface Props {
  card: Card
  ownerHandle: string
  isOwn: boolean  // show trade button if true
  tradeCount: number
  points: number
}
```

**Features:**
- Display card image (SVG from server)
- Show founder name, company, owner handle
- Trade button opens QR modal (M6)
- Flip animation to show stats on back

**Dependencies:** M6

---

## M6: Trade QR Modal

**File:** `src/lib/components/TradeModal.svelte`

**Purpose:** Generate and display trade QR code, handle scanning.

**Props:**
```typescript
interface Props {
  open: boolean
  onClose: () => void
  onTradeComplete: (result: TradeResult) => void
}
```

**States:**
1. **Initiating** - "Generate QR" button
2. **Showing QR** - Display QR with 60s countdown
3. **Scanning** - Camera view to scan other's QR
4. **Confirming** - Loading state during trade
5. **Complete** - Success/failure message

**Dependencies:** M1, `qrcode` library, browser camera API

---

## M7: Profile QR Component

**File:** `src/lib/components/ProfileQR.svelte`

**Purpose:** Display player's X handle as QR for admin verification.

**Props:**
```typescript
interface Props {
  handle: string
}
```

**Features:**
- Large QR code encoding just the X handle
- "Show to admin to get verified" instruction
- Brightness boost for scanning

**Dependencies:** `qrcode` library

---

## M8: Admin Map Component

**File:** `src/lib/components/AdminMap.svelte`

**Purpose:** Leaflet map showing admin locations.

**Props:**
```typescript
interface Props {
  adminLocations: AdminLocation[]
  onRefresh: () => void
}
```

**Features:**
- Leaflet.js map centered on venue
- Admin pins with handle labels
- "<encrypted>" shown for hidden admins
- Auto-refresh every 30s
- Distance from user (if location enabled)

**Dependencies:** M1, `leaflet` library

---

## M9: (Optional) Nearby Players Component

**File:** `src/lib/components/NearbyPlayers.svelte`

**Purpose:** Show players within selected radius.

**Props:**
```typescript
interface Props {
  radiusMeters: number  // 5, 25, 50
}
```

**Features:**
- Radius selector (5m/16ft, 25m/82ft, 50m/164ft)
- List of nearby handles (active in last 15min)
- Optional: Show on map overlay

**Dependencies:** M1, Geolocation API

---

## M10: (Optional) Chat Component

**File:** `src/lib/components/Chat.svelte`

**Purpose:** Realtime broadcast chat via WebSocket.

**Features:**
- Message list (last 100 visible)
- Input field with send button
- Admin messages bolded
- Auto-scroll to bottom
- Reconnect on disconnect

**Dependencies:** WebSocket, M2

---

## Implementation Order

```
M1 (API) → M2 (Stores) → M3 (Auth) → M4 (Leaderboard)
                                          ↓
                      M5 (Card) → M6 (Trade Modal)
                                          ↓
                      M7 (Profile QR) → M8 (Map)
                                          ↓
                      M9 (Nearby) → M10 (Chat) [Optional]
```

## Route Structure

| Route | Components Used | Auth Required |
|-------|-----------------|---------------|
| `/` | M3, M4 | No (view only) |
| `/card` | M3, M5, M6 | Yes |
| `/profile` | M3, M7 | Yes |
| `/map` | M3, M8 | No |
| `/chat` | M3, M10 | Yes |
