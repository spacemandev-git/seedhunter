# Backend Server Architecture

> Bun + Hono HTTP server with WebSocket support

## Module Overview

```
packages/backend/
├── src/
│   ├── index.ts           # Entry point
│   ├── routes/
│   │   ├── auth.ts        # M1: X OAuth + Admin auth
│   │   ├── players.ts     # M2: Player endpoints
│   │   ├── trades.ts      # M3: Trading system
│   │   ├── admin.ts       # M4: Admin endpoints
│   │   └── chat.ts        # M5: Chat endpoints
│   ├── services/
│   │   ├── auth.ts        # M6: Auth service
│   │   ├── player.ts      # M7: Player service
│   │   ├── trade.ts       # M8: Trade service
│   │   ├── location.ts    # M9: Location service
│   │   └── chat.ts        # M10: Chat service
│   ├── db/
│   │   ├── schema.ts      # M11: Database schema
│   │   ├── migrations/    # SQL migrations
│   │   └── index.ts       # DB connection
│   ├── ws/
│   │   └── handler.ts     # M12: WebSocket handler
│   ├── middleware/
│   │   ├── auth.ts        # JWT verification
│   │   └── rateLimit.ts   # Rate limiting
│   └── utils/
│       └── profanity.ts   # M13: Profanity filter
├── static/
│   └── cards/             # Generated card images
├── test/
└── package.json
```

---

## M1: Auth Routes

**File:** `src/routes/auth.ts`

**Purpose:** Handle X OAuth flow and admin login.

**Endpoints:**
```typescript
// X OAuth for players
GET  /auth/x          → Redirect to X OAuth
GET  /auth/x/callback → Handle OAuth callback, return JWT
POST /auth/logout     → Invalidate session

// Admin auth
POST /auth/admin/login  → Username/password, return JWT
POST /auth/admin/refresh → Refresh admin token
```

**Request/Response Examples:**
```typescript
// POST /auth/admin/login
Request:  { username: string, password: string }
Response: { token: string, admin: Admin }

// GET /auth/x/callback?code=xxx
Response: { token: string, player: Player, isNew: boolean }
```

**Dependencies:** M6 (Auth Service), M11 (DB)

---

## M2: Player Routes

**File:** `src/routes/players.ts`

**Purpose:** Player profile and leaderboard endpoints.

**Endpoints:**
```typescript
GET /players/:handle      → Get player profile
GET /players/:handle/card → Get player's current card
GET /leaderboard          → Top players by points
GET /leaderboard/trades   → Top players by trade count
```

**Query Parameters:**
```typescript
// GET /leaderboard
?limit=50      // Max results (default 50, max 100)
&offset=0      // Pagination offset
```

**Response Examples:**
```typescript
// GET /players/:handle
{
  handle: "@example",
  verified: true,
  card: { id: "...", founderName: "...", ... },
  stats: { trades: 15, points: 8, rank: 42 }
}

// GET /leaderboard
{
  entries: [
    { rank: 1, handle: "@top", points: 25, trades: 30 },
    ...
  ],
  total: 500
}
```

**Dependencies:** M7 (Player Service), M11 (DB)

---

## M3: Trade Routes

**File:** `src/routes/trades.ts`

**Purpose:** Card trading system endpoints.

**Endpoints:**
```typescript
POST /trades/init    → Generate trade QR payload (auth required)
POST /trades/confirm → Execute trade (auth required)
GET  /trades/history → Player's trade history (auth required)
```

**Trade Flow:**
```
Player A: POST /trades/init
          → Returns { payload: "encrypted_data", expiresAt: timestamp }

Player B: Scans QR, POST /trades/confirm { payload: "encrypted_data" }
          → Server swaps cards, returns result

Both:     Cards swapped, trade logged, points recalculated
```

**Payload Structure (encrypted):**
```typescript
{
  initiator: string,    // Player A's handle
  cardId: string,       // Player A's current card
  nonce: string,        // Unique per trade
  expiresAt: number,    // Unix timestamp
  signature: string     // HMAC signature
}
```

**Dependencies:** M8 (Trade Service), M6 (Auth), M11 (DB)

---

## M4: Admin Routes

**File:** `src/routes/admin.ts`

**Purpose:** Admin-only endpoints.

**Endpoints:**
```typescript
POST   /admin/location        → Update admin location
PATCH  /admin/visibility      → Toggle location visibility
POST   /admin/verify/:handle  → Verify a player
GET    /admin/locations       → Get all admin locations (public)
DELETE /admin/chat/:msgId     → Delete chat message
```

**Request Examples:**
```typescript
// POST /admin/location
{ lat: 37.7749, lng: -122.4194 }

// PATCH /admin/visibility
{ visible: false }

// POST /admin/verify/:handle
Response: { 
  success: true, 
  player: Player,
  tradesVerified: 12  // Trades that became verified
}
```

**Dependencies:** M9 (Location Service), M7 (Player Service), M10 (Chat)

---

## M5: Chat Routes

**File:** `src/routes/chat.ts`

**Purpose:** REST endpoints for chat (WebSocket in M12).

**Endpoints:**
```typescript
GET  /chat/messages   → Get recent messages
POST /chat/messages   → Send message (also via WS)
```

**Query Parameters:**
```typescript
// GET /chat/messages
?limit=100     // Max messages (default 100, max 1000)
&before=msgId  // Pagination cursor
```

**Dependencies:** M10 (Chat Service), M13 (Profanity Filter)

---

## M6: Auth Service

**File:** `src/services/auth.ts`

**Purpose:** Authentication logic and JWT management.

**Functions:**
```typescript
// X OAuth
async function getXAuthUrl(): Promise<string>
async function handleXCallback(code: string): Promise<{ player: Player, token: string }>

// Admin auth
async function loginAdmin(username: string, password: string): Promise<AdminSession>
async function hashPassword(password: string): Promise<string>
async function verifyPassword(password: string, hash: string): Promise<boolean>

// JWT
function generateToken(payload: TokenPayload, expiresIn: string): string
function verifyToken(token: string): TokenPayload | null
function refreshToken(token: string): string | null
```

**Dependencies:** `jose` (JWT), X API credentials, M11 (DB)

---

## M7: Player Service

**File:** `src/services/player.ts`

**Purpose:** Player CRUD and stats calculation.

**Functions:**
```typescript
// CRUD
async function createPlayer(xHandle: string, xData: XProfile): Promise<Player>
async function getPlayer(handle: string): Promise<Player | null>
async function assignCard(playerId: string, cardId: string): Promise<void>

// Stats
async function getPlayerStats(handle: string): Promise<PlayerStats>
async function calculatePoints(handle: string): Promise<number>
async function getLeaderboard(limit: number, offset: number): Promise<LeaderboardEntry[]>

// Verification
async function verifyPlayer(handle: string): Promise<{ tradesVerified: number }>
async function recalculatePointsForTraders(handle: string): Promise<void>
```

**Points Calculation:**
```typescript
// Points = count of unique verified trades
// A trade is verified if BOTH parties are verified
function calculatePoints(handle: string): number {
  return db.query(`
    SELECT COUNT(DISTINCT other_player) FROM trades
    WHERE player = ? 
    AND other_player IN (SELECT handle FROM players WHERE verified = true)
    AND player IN (SELECT handle FROM players WHERE verified = true)
  `, [handle])
}
```

**Dependencies:** M11 (DB)

---

## M8: Trade Service

**File:** `src/services/trade.ts`

**Purpose:** Trade execution logic.

**Functions:**
```typescript
// Trade initiation
async function createTradePayload(initiatorHandle: string): Promise<TradePayload>
function encryptPayload(payload: TradePayload): string
function decryptPayload(encrypted: string): TradePayload | null

// Trade execution
async function executeTrade(payload: TradePayload, confirmingHandle: string): Promise<TradeResult>
async function validateTrade(payload: TradePayload, confirmingHandle: string): TradeValidation

// History
async function getTradeHistory(handle: string): Promise<Trade[]>
```

**Trade Validation Rules:**
1. Payload not expired (60s TTL)
2. Initiator and confirmer are different players
3. Payload signature is valid
4. Neither player is currently in another trade
5. Nonce hasn't been used before

**Dependencies:** M7 (Player Service), M11 (DB)

---

## M9: Location Service

**File:** `src/services/location.ts`

**Purpose:** Admin location tracking.

**Functions:**
```typescript
// Update
async function updateAdminLocation(adminId: string, lat: number, lng: number): Promise<void>
async function setAdminVisibility(adminId: string, visible: boolean): Promise<void>

// Query
async function getAdminLocations(): Promise<AdminLocation[]>
async function getAdminLocation(adminId: string): Promise<AdminLocation | null>

// Optional: Player locations
async function updatePlayerLocation(handle: string, lat: number, lng: number): Promise<void>
async function getNearbyPlayers(lat: number, lng: number, radiusMeters: number, maxAge: number): Promise<NearbyPlayer[]>
```

**Location Privacy:**
```typescript
// When visible = false, return encrypted placeholder
function formatLocation(admin: Admin): AdminLocation {
  if (!admin.visible) {
    return { handle: admin.username, location: "<encrypted>" }
  }
  return { handle: admin.username, lat: admin.lat, lng: admin.lng }
}
```

**Dependencies:** M11 (DB)

---

## M10: Chat Service

**File:** `src/services/chat.ts`

**Purpose:** Chat message management.

**Functions:**
```typescript
// Messages
async function addMessage(handle: string, content: string, isAdmin: boolean): Promise<ChatMessage>
async function getMessages(limit: number, before?: string): Promise<ChatMessage[]>
async function deleteMessage(msgId: string): Promise<boolean>

// Buffer management
async function pruneOldMessages(): Promise<number>  // Keep last 1000

// Moderation
function filterProfanity(content: string): string
function isSpam(handle: string, content: string): boolean
```

**Buffer Strategy:**
- Keep last 1000 messages in SQLite
- Prune on insert when count > 1100
- Index on timestamp for efficient queries

**Dependencies:** M11 (DB), M13 (Profanity Filter)

---

## M11: Database Schema (Prisma)

**File:** `prisma/schema.prisma`

**Purpose:** Prisma schema for SQLite (dev) and PostgreSQL (prod).

**Models:**
```prisma
model Player {
  id            String   @id @default(uuid())
  xHandle       String   @unique
  xProfilePic   String?
  cardId        String?
  card          Card?    @relation(fields: [cardId], references: [id])
  verified      Boolean  @default(false)
  verifiedAt    DateTime?
  createdAt     DateTime @default(now())
  
  tradesAsPlayerA Trade[] @relation("PlayerA")
  tradesAsPlayerB Trade[] @relation("PlayerB")
  chatMessages    ChatMessage[]
}

model Admin {
  id              String   @id @default(uuid())
  username        String   @unique
  passwordHash    String
  locationLat     Float?
  locationLng     Float?
  locationVisible Boolean  @default(true)
  createdAt       DateTime @default(now())
}

model Card {
  id          String   @id @default(uuid())
  founderName String
  company     String
  category    String
  imagePath   String
  createdAt   DateTime @default(now())
  
  currentOwner  Player?
  tradesAsCardA Trade[] @relation("CardA")
  tradesAsCardB Trade[] @relation("CardB")
}

model Trade {
  id        String   @id @default(uuid())
  playerA   Player   @relation("PlayerA", ...)
  playerB   Player   @relation("PlayerB", ...)
  cardA     Card     @relation("CardA", ...)
  cardB     Card     @relation("CardB", ...)
  tradedAt  DateTime @default(now())
}

model ChatMessage {
  id        String   @id @default(uuid())
  sender    Player   @relation(...)
  content   String
  isAdmin   Boolean  @default(false)
  createdAt DateTime @default(now())
}

model TradeNonce {
  nonce     String   @id
  expiresAt DateTime
}
```

**Database Commands:**
```bash
bun run db:generate  # Generate Prisma client
bun run db:push      # Push schema to dev DB (no migration)
bun run db:migrate   # Create migration (dev)
bun run db:studio    # Open Prisma Studio GUI
bun run db:seed      # Seed database with cards
```

**Dependencies:** `@prisma/client`, `prisma`

---

## M12: WebSocket Handler

**File:** `src/ws/handler.ts`

**Purpose:** Realtime chat and updates.

**Message Types:**
```typescript
// Client → Server
{ type: "chat", content: string }
{ type: "subscribe", channels: string[] }

// Server → Client
{ type: "chat", message: ChatMessage }
{ type: "chat_deleted", msgId: string }
{ type: "trade_complete", trade: Trade }
{ type: "player_verified", handle: string }
```

**Connection Management:**
```typescript
interface Connection {
  socket: WebSocket
  playerHandle: string | null
  isAdmin: boolean
  channels: Set<string>
}

const connections = new Map<string, Connection>()
```

**Dependencies:** Bun WebSocket API, M10 (Chat Service)

---

## M13: Profanity Filter

**File:** `src/utils/profanity.ts`

**Purpose:** Basic local profanity filtering.

**Functions:**
```typescript
// Load word list
function loadWordList(): Set<string>

// Check content
function containsProfanity(text: string): boolean
function filterProfanity(text: string): string  // Replace with ***

// Admin bypass
function filterForDisplay(text: string, viewerIsAdmin: boolean): string
```

**Implementation:**
- Use bundled word list (~500 common profanities)
- Simple substring matching with word boundaries
- Replace matches with asterisks
- No external API calls

---

## Implementation Order

```
M11 (DB Schema) → M6 (Auth Service) → M1 (Auth Routes)
                        ↓
              M7 (Player Service) → M2 (Player Routes)
                        ↓
              M8 (Trade Service) → M3 (Trade Routes)
                        ↓
              M9 (Location Service) → M4 (Admin Routes)
                        ↓
              M10 (Chat) + M13 (Profanity) → M5 (Chat Routes)
                        ↓
                   M12 (WebSocket)
```

---

## Environment Variables

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Database - Development (SQLite)
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./data/seedhunter.db"

# Database - Production (PostgreSQL)
# DATABASE_PROVIDER=postgresql
# DATABASE_URL="postgresql://user:password@localhost:5432/seedhunter?schema=public"

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
ADMIN_JWT_EXPIRES_IN=24h

# X OAuth
X_CLIENT_ID=your-client-id
X_CLIENT_SECRET=your-client-secret
X_CALLBACK_URL=https://seedhunter.seedplex.io/auth/x/callback

# Optional
ENABLE_CHAT=true
ENABLE_PLAYER_LOCATION=false
```

---

## API Rate Limits

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/auth/*` | 10 | 1 min |
| `/trades/*` | 30 | 1 min |
| `/chat/*` | 60 | 1 min |
| `/admin/*` | 100 | 1 min |
| Default | 120 | 1 min |
