# Admin App Architecture

> Svelte 5 + Capacitor Android app for event admins

## Module Overview

```
packages/admin-app/
├── src/
│   ├── lib/
│   │   ├── api/           # M1: API client
│   │   ├── stores/        # M2: State management
│   │   ├── components/    # M3-M6: UI components
│   │   ├── services/      # M7: Background location
│   │   └── utils/
│   ├── routes/
│   │   ├── +page.svelte        # Login screen
│   │   └── dashboard/+page.svelte  # Main admin view
│   └── app.html
├── android/               # Capacitor Android project
├── capacitor.config.ts
├── svelte.config.js
└── package.json
```

---

## M1: API Client

**File:** `src/lib/api/client.ts`

**Purpose:** Type-safe HTTP client for admin endpoints.

**Functions to implement:**
```typescript
// Auth
async function login(username: string, password: string): Promise<AdminSession>
async function logout(): Promise<void>
async function refreshToken(): Promise<AdminSession>

// Location
async function updateLocation(lat: number, lng: number): Promise<void>
async function setVisibility(visible: boolean): Promise<void>

// Verification
async function verifyPlayer(handle: string): Promise<VerifyResult>
async function getPlayerByHandle(handle: string): Promise<Player | null>

// Chat moderation (optional)
async function deleteMessage(msgId: string): Promise<void>
async function getChatMessages(limit?: number): Promise<ChatMessage[]>
```

**Dependencies:** Capacitor HTTP plugin (for native requests), secure storage

**Tests:** Mock responses, verify auth header injection

---

## M2: State Management

**File:** `src/lib/stores/index.ts`

**Purpose:** Svelte 5 runes-based app state.

**Stores to implement:**
```typescript
// Auth state
const auth = $state<{ admin: Admin | null; token: string | null }>

// Location broadcasting state
const locationState = $state<{
  broadcasting: boolean
  visible: boolean
  lastUpdate: number | null
  error: string | null
}>

// Verification history (local cache)
const verifications = $state<Verification[]>([])

// Optional: Chat messages for moderation
const chatMessages = $state<ChatMessage[]>([])
```

**Dependencies:** M1, Capacitor Preferences (secure storage)

**Tests:** Verify persistence across app restarts

---

## M3: Login Screen

**File:** `src/routes/+page.svelte`

**Purpose:** Username/password authentication.

**Features:**
- Username input
- Password input (secure)
- "Login" button with loading state
- Error message display
- Auto-redirect to dashboard if already logged in
- Biometric unlock option (stretch goal)

**Dependencies:** M1, M2

---

## M4: Dashboard Layout

**File:** `src/routes/dashboard/+page.svelte`

**Purpose:** Main admin interface after login.

**Layout:**
```
┌────────────────────────────┐
│  [Logout]    Seedhunter    │  Header
├────────────────────────────┤
│                            │
│   [Location Toggle - M5]   │
│                            │
│   [Verify Button - M6]     │
│                            │
│   [Recent Verifications]   │
│                            │
├────────────────────────────┤
│  [Chat Mod] (optional)     │  Footer
└────────────────────────────┘
```

**Dependencies:** M2, M5, M6

---

## M5: Location Toggle Component

**File:** `src/lib/components/LocationToggle.svelte`

**Purpose:** Control background location broadcasting.

**Props:**
```typescript
interface Props {
  onStatusChange?: (broadcasting: boolean) => void
}
```

**UI Elements:**
- Main toggle: "Broadcasting Location" ON/OFF
- Secondary toggle: "Visible to Players" ON/OFF
- Status indicator (last update time, GPS accuracy)
- Error display (permissions denied, etc.)

**States:**
1. **Off** - Not broadcasting
2. **On + Visible** - Location shared publicly
3. **On + Hidden** - Broadcasting but shown as "<encrypted>"
4. **Error** - Permission denied or GPS unavailable

**Dependencies:** M1, M2, M7 (Background Service)

---

## M6: Verify Player Component

**File:** `src/lib/components/VerifyPlayer.svelte`

**Purpose:** Scan or enter player handle to verify.

**Features:**
1. **Scan Mode** - Camera viewfinder for QR scanning
2. **Manual Mode** - Text input for X handle
3. **Preview** - Show player info before confirming
4. **Confirm** - Execute verification
5. **Result** - Success/already verified/not found

**Flow:**
```
[Scan QR] or [Enter Handle]
         ↓
   [Player Preview]
   - Handle: @example
   - Trades: 15
   - Already verified: No
         ↓
   [Confirm Verify]
         ↓
   [Success Animation]
```

**Dependencies:** M1, `@capawesome/barcode-scanning`

---

## M7: Background Location Service

**File:** `src/lib/services/locationService.ts`

**Purpose:** Manage Capacitor background geolocation.

**Functions to implement:**
```typescript
// Initialize the background location watcher
async function startLocationBroadcast(): Promise<void>

// Stop broadcasting
async function stopLocationBroadcast(): Promise<void>

// Check current status
function isRunning(): boolean

// Get last known position
function getLastPosition(): Position | null

// Request permissions
async function requestPermissions(): Promise<PermissionStatus>

// Handle visibility toggle
async function setVisibility(visible: boolean): Promise<void>
```

**Capacitor Plugins Required:**
- `@capacitor/geolocation` - Foreground location
- `@capacitor-community/background-geolocation` - Background updates

**Configuration:**
```typescript
const config = {
  backgroundMessage: "Seedhunter is sharing your location",
  backgroundTitle: "Location Active",
  requestPermissions: true,
  stale: false,
  distanceFilter: 10,  // meters
  interval: 30000,     // 30 seconds
}
```

**Android Permissions:**
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

**Dependencies:** Capacitor plugins, M1 (to send updates)

---

## M8: (Optional) Chat Moderation Component

**File:** `src/lib/components/ChatMod.svelte`

**Purpose:** View and moderate chat messages.

**Features:**
- Scrollable message list
- Swipe-to-delete or delete button per message
- Admin messages highlighted
- Pull-to-refresh
- Filter by handle

**Dependencies:** M1, M2

---

## Implementation Order

```
M1 (API) → M2 (Stores) → M3 (Login)
                              ↓
                         M4 (Dashboard)
                        /           \
               M5 (Location)    M6 (Verify)
                    ↓
               M7 (Background Service)
                    ↓
               M8 (Chat Mod) [Optional]
```

---

## Capacitor Setup Checklist

### Initial Setup
```bash
# In packages/admin-app
bun add @capacitor/core @capacitor/cli @capacitor/android
bunx cap init "Seedhunter Admin" "io.seedplex.seedhunter.admin"
bunx cap add android
```

### Required Plugins
```bash
bun add @capacitor/geolocation
bun add @capacitor-community/background-geolocation
bun add @capawesome/capacitor-barcode-scanning
bun add @capacitor/preferences  # Secure storage
```

### capacitor.config.ts
```typescript
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.seedplex.seedhunter.admin',
  appName: 'Seedhunter Admin',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    BackgroundGeolocation: {
      // Plugin-specific config
    },
    BarcodeScanning: {
      // Camera permissions handled automatically
    }
  }
}

export default config
```

### Build & Deploy
```bash
bun run build              # Build Svelte app
bunx cap sync android      # Sync to Android project
bunx cap open android      # Open in Android Studio
```

---

## Android-Specific Notes

1. **Minimum SDK**: 24 (Android 7.0) for background location
2. **Target SDK**: 34 (latest)
3. **Foreground Service**: Required for reliable background location
4. **Battery Optimization**: App should request exemption
5. **Location Permission Flow**: Must handle "Allow all the time" for background
