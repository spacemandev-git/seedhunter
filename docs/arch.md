# Seedhunter Architecture

## Overview

Seedhunter is a monorepo containing four TypeScript packages, all managed by Bun workspaces.

```
seedhunter/
├── packages/
│   ├── player-webapp/    # Svelte 5 SPA for players
│   ├── admin-app/        # Svelte + Capacitor Android app
│   ├── backend/          # Bun HTTP server + WebSocket
│   └── card-assembler/   # CLI tool for card generation
├── docs/                 # Architecture documentation
├── bun.lockb
├── package.json          # Workspace root
└── README.md
```

## Tech Stack

| Package | Framework | Runtime | Key Dependencies |
|---------|-----------|---------|------------------|
| player-webapp | Svelte 5 + SvelteKit | Browser | `qrcode`, `leaflet` |
| admin-app | Svelte 5 + Capacitor | Android | `@capacitor/geolocation`, `@capawesome/barcode-scanning` |
| backend | Hono | Bun | `prisma`, `jose` |
| card-assembler | CLI scripts | Bun | `sharp`, `openai` |

## Database

- **Development**: SQLite (via Prisma) - fast local development
- **Production**: PostgreSQL (via Prisma) - scalable production database

Prisma provides type-safe database access and handles migrations for both environments.

## Shared Types

A `packages/shared/` package contains TypeScript types shared across packages:

```typescript
// packages/shared/types.ts
interface Player { id: string; xHandle: string; verified: boolean; cardId: string; }
interface Card { id: string; founderName: string; company: string; imageUrl: string; }
interface Trade { id: string; fromPlayer: string; toPlayer: string; timestamp: number; }
interface Admin { id: string; username: string; lat?: number; lng?: number; visible: boolean; }
```

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐
│  Player Webapp  │────▶│                 │
└─────────────────┘     │                 │
                        │  Backend Server │──▶ SQLite DB
┌─────────────────┐     │                 │
│   Admin App     │────▶│                 │
└─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │  Static Assets  │
                        │  (Card Images)  │
                        └─────────────────┘
                              ▲
                              │
                        ┌─────────────────┐
                        │ Card Assembler  │ (offline CLI)
                        └─────────────────┘
```

## API Surface

### REST Endpoints (Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/x/callback` | X OAuth callback |
| GET | `/players/:handle` | Get player profile |
| GET | `/leaderboard` | Top players by points |
| POST | `/trade/init` | Generate trade QR payload |
| POST | `/trade/confirm` | Execute card swap |
| GET | `/admins/locations` | Public admin locations |
| POST | `/admin/verify/:handle` | Verify a player (admin) |
| WS | `/ws` | Chat + realtime updates |

### Admin-Only Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/login` | Username/password auth |
| POST | `/admin/location` | Update admin location |
| DELETE | `/chat/:msgId` | Delete chat message |

## Package Documentation

- [Player Webapp](./player.md) - Svelte 5 SPA modules
- [Admin App](./admin.md) - Capacitor Android app modules
- [Backend Server](./backend.md) - Bun server modules
- [Card Assembler](./cards.md) - Card generation pipeline
