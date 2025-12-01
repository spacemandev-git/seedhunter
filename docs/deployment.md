# Seedhunter Deployment Guide

## Production URLs
- **Player Webapp:** https://seedhunter.seedplex.io
- **Backend API:** https://seedhunterapi.seedplex.io
- **Admin App:** Android APK (connects to backend API)

---

## Railway Deployment (Monorepo)

This is a Bun monorepo. Railway services should be configured to build from the **repo root** using the Dockerfiles.

### Setup Steps

1. **Create a new Railway project**
2. **Add PostgreSQL service** - Railway will auto-generate `DATABASE_URL`
3. **Add Backend service:**
   - Connect to your GitHub repo
   - Set **Root Directory**: `/` (repo root)
   - Set **Dockerfile Path**: `Dockerfile.backend`
   - Add custom domain: `seedhunterapi.seedplex.io`
4. **Add Player Webapp service:**
   - Connect to your GitHub repo  
   - Set **Root Directory**: `/` (repo root)
   - Set **Dockerfile Path**: `Dockerfile.player`
   - Add custom domain: `seedhunter.seedplex.io`
5. **Link PostgreSQL to Backend** in Railway's service variables

---

### Backend Service

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

# Admin accounts (choose one option)
# Option 1: Single admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>

# Option 2: Multiple admins (comma-separated)
ADMIN_ACCOUNTS=admin:securepass1,moderator:securepass2

# Option 3: Multiple admins (JSON)
ADMIN_ACCOUNTS=[{"username":"admin","password":"pass1"},{"username":"mod","password":"pass2"}]
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

### Database Setup (PostgreSQL)

The backend is configured to use PostgreSQL.

**For Railway:**
1. Add a PostgreSQL service in your Railway project
2. Link it to your backend service
3. Railway will automatically set `DATABASE_URL`

**For local development:**
```bash
# Start PostgreSQL with Docker
docker run --name seedhunter-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=seedhunter \
  -p 5432:5432 -d postgres

# Run migrations and seed
cd packages/backend
bun run db:migrate
bun run db:seed
```

---

## Admin Account Management

### Via Environment Variables (at seed time)
Set `ADMIN_ACCOUNTS` in your environment before running `db:seed`.

### Via API (runtime)
Once deployed, admins can manage other admin accounts:

```bash
# List all admins
curl -H "Authorization: Bearer <token>" \
  https://seedhunterapi.seedplex.io/admin/accounts

# Create new admin
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"username":"newadmin","password":"securepass123"}' \
  https://seedhunterapi.seedplex.io/admin/accounts

# Update admin password
curl -X PATCH -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"password":"newpassword123"}' \
  https://seedhunterapi.seedplex.io/admin/accounts/<admin-id>

# Delete admin
curl -X DELETE -H "Authorization: Bearer <token>" \
  https://seedhunterapi.seedplex.io/admin/accounts/<admin-id>
```

**Constraints:**
- Username: 3-32 characters, alphanumeric with underscores/hyphens
- Password: minimum 8 characters
- Cannot delete your own account
- Cannot delete the last admin account

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
