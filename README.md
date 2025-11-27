# Seedhunter

Seedhunter is a game to activate the Seedplex community at Breakpoint Conference. It's a webapp for players + mobile app for admins that creates a fun social game where players are incentivized to get others to check out the webapp in return for prizes.

## Quick Start

```bash
# Install dependencies for all packages
bun install

# Start development servers
bun run dev:backend   # Backend on :3000
bun run dev:player    # Player webapp on :5173
bun run dev:admin     # Admin app on :5174

# Generate founder cards
bun run cards:all

# Build for production
bun run build
```

## Project Structure

```
seedhunter/
├── packages/
│   ├── shared/           # Shared TypeScript types & constants
│   ├── backend/          # Bun + Hono API server
│   ├── player-webapp/    # Svelte 5 + SvelteKit player frontend
│   ├── admin-app/        # Svelte 5 + Capacitor Android app
│   └── card-assembler/   # CLI tool for generating founder cards
├── docs/                 # Architecture documentation
│   ├── arch.md          # High-level overview
│   ├── player.md        # Player webapp modules
│   ├── admin.md         # Admin app modules
│   ├── backend.md       # Backend server modules
│   └── cards.md         # Card assembler pipeline
└── package.json         # Bun workspace root
```

## Tech Stack

| Package | Framework | Key Dependencies |
|---------|-----------|------------------|
| shared | TypeScript | - |
| backend | Hono + Bun | better-sqlite3, jose |
| player-webapp | Svelte 5 + SvelteKit | leaflet, qrcode |
| admin-app | Svelte 5 + Capacitor | @capacitor/geolocation, barcode-scanner |
| card-assembler | Bun CLI | sharp, openai |

## Documentation

See the [docs/](./docs/) folder for detailed architecture documentation:
- [Architecture Overview](./docs/arch.md)
- [Player Webapp Modules](./docs/player.md)
- [Admin App Modules](./docs/admin.md)
- [Backend Server Modules](./docs/backend.md)
- [Card Assembler Pipeline](./docs/cards.md)

--- 

The way it works is any player can go to the seedhunter webapp (seedhunter.seedplex.io) and connect with their X login. Doing so mints them a unique "Founder Card". They also have 0 trades and 0 points to start with. 

Every time a player goes to another player and uses the "Trade" function on their card, it pops up a QR code. Anyone else can scan it and confirm, and that swaps their two cards. Every trade adds a ledger entry ups their trade value by one.

For every unique *verified* trade (a trade with a verified user), their points go up by 1. Users can get verified by checking in physically with one of the admins who can scan their profile code to "verify" them. Whenever a user is verified, all their previous trades become verified. 

When fetching points, players always query the latest verified trades, so if a user they previous traded with becomes verified sometime after their trade, that'll show up as a new point for them when they refresh the webapp.

To help users get verified, they also have a map with pins of last known location of admins. Admins have a mobile app on their Android phones that in the background sends their location to the server, which then can be fetched by any player. Admins have a privacy toggle on their app as well, which will then show their location as "<encrypted>". 

The project then has four main components:

1. Player Webapp
    - A Svelte 5 based Webapp that allows users to see the LEADERBOARD, register with their X handle, and see / trade their FOUNDER CARD, and see their Profile QR Code (just their x handle as a QR code)
    - The webapp will also have a MAP that shows admin's current location
    - (Optional Stretch Goal) Has a toggle that if the app is currently open, it'll show people (via their X handle) nearby (selected geographic range 5 meters, 25, 50, etc. Show as both ft and meters) that also had the app open within the last 15 minutes on the map. 
    - (Optional Stretch Goal) Has a chatbox that broadcasts messages to anyone that has the app open.

2. Admin Android App
    - The admin android app should allow login to the server via username / password.
    - When logged in, the admin can enable or disable broadcasting their location in the background to the server.
    - The admin will have a "Verify" button that lets them scan a user's profile (or manually enter their X handle) that verifies their trades
    - If the chatbox is implemented, admins will be able to delete any chat message as well.

3. Backend Server
    - Bun based typescript backend server will track registered players, their current card, their trade history
    - Backend server will optionally have a geolocation for players stored if they enable permissions. This will be used to power nearby pins on map for the Player Webapp.
    - Has a temp chat buffer for last 1000 messages, with a simple local profanity filter that moderates the chat. Shows admin messages as bolded and allows admins to delete any message. 


4. Founder Card Assembler
    - Founder Cards are trading card like images that are SVG assembled via a script with a cool border and a picture of a famous company founder in any industry. 
    - To make these cards, we'll first have a script that AI generates a list of 100-500 famous founders and their companies and X handles, and grabs their twitter profile picture. Then we want to run a pass on all the profile pictures to make them the same aesthic style (maybe same color scheme or overlay). If a founder has founded multiple companies, they'll have a different card per company they founded.
    - We should store these pregenerated cards on the server as assets, then when someone registers, give them a card in their profile. 
