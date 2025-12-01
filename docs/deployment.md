# Seedhunter Deployment Guide

## Production URLs
- **Player Webapp:** https://seedhunter.seedplex.io
- **Backend API:** https://seedhunterapi.seedplex.io
- **Admin App:** Android APK (connects to backend API)

---

## Railway Deployment

### Backend Service (`packages/backend`)

**Domain:** `seedhunterapi.seedplex.io`

**Environment Variables (set in Railway):**
```env
# Server
PORT=3000
HOST=0.0.0.0

# Database (Railway PostgreSQL or external)
DATABASE_URL=postgresql://user:password@host:5432/seedhunter?schema=public

# JWT Secrets (generate secure random strings!)
JWT_SECRET=<generate-secure-random-string-64-chars>
JWT_EXPIRES_IN=7d
ADMIN_JWT_EXPIRES_IN=24h

# X OAuth (from Twitter Developer Portal)
X_CLIENT_ID=<your-x-client-id>
X_CLIENT_SECRET=<your-x-client-secret>
X_CALLBACK_URL=https://seedhunterapi.seedplex.io/auth/x/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=https://seedhunter.seedplex.io

# Features
ENABLE_CHAT=true
ENABLE_PLAYER_LOCATION=true

# Admin (change these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>
```

**Important:** Update your X (Twitter) Developer App settings:
- Add `https://seedhunterapi.seedplex.io/auth/x/callback` to the Callback URLs

---

### Player Webapp Service (`packages/player-webapp`)

**Domain:** `seedhunter.seedplex.io`

**Environment Variables (set in Railway):**
```env
VITE_API_URL=https://seedhunterapi.seedplex.io
VITE_BACKEND_URL=https://seedhunterapi.seedplex.io
```

---

### Database Setup

For production, switch from SQLite to PostgreSQL:

1. **Update Prisma schema** (`packages/backend/prisma/schema.prisma`):
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Run migrations on first deploy:**
   ```bash
   bun run db:migrate:prod
   bun run db:seed
   ```

---

## Admin App (Android)

The admin app is built separately and distributed as an APK.

### Building for Production

```bash
cd packages/admin-app

# Ensure production env is set
echo "VITE_API_URL=https://seedhunterapi.seedplex.io" > .env

# Build web assets
bun run build

# Sync to Android
bunx cap sync android

# Open Android Studio for release build
bunx cap open android
```

In Android Studio:
1. Build → Generate Signed Bundle / APK
2. Choose APK
3. Create/select signing key
4. Build release APK

---

## X (Twitter) OAuth Setup

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a project and app
3. Enable OAuth 2.0
4. Set callback URL: `https://seedhunterapi.seedplex.io/auth/x/callback`
5. Request scopes: `tweet.read`, `users.read`, `offline.access`
6. Copy Client ID and Client Secret to Railway env vars

---

## Post-Deployment Checklist

- [ ] Backend health check: `curl https://seedhunterapi.seedplex.io/health`
- [ ] Frontend loads: `https://seedhunter.seedplex.io`
- [ ] X OAuth flow works (login with X)
- [ ] Leaderboard loads
- [ ] Card images load from `/static/cards/`
- [ ] Admin app can login
- [ ] Admin app can verify players
- [ ] Admin location broadcast works
- [ ] WebSocket chat works (if enabled)

---

## Local Development

To switch back to local development:

```bash
# Backend
cd packages/backend
# Edit .env:
# X_CALLBACK_URL=http://localhost:3000/auth/x/callback
# FRONTEND_URL=http://localhost:5173

# Player webapp
cd packages/player-webapp
echo "VITE_API_URL=
VITE_BACKEND_URL=http://localhost:3000" > .env

# Admin app (for emulator)
cd packages/admin-app
echo "VITE_API_URL=http://10.0.2.2:3000" > .env
# Change capacitor.config.ts androidScheme to 'http'
```
