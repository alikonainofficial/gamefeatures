# GameFeatures - Feature Request Platform

[![CI](https://github.com/alikonainofficial/gamefeatures/actions/workflows/ci.yml/badge.svg)](https://github.com/alikonainofficial/gamefeatures/actions/workflows/ci.yml)

A platform where gamers post feature requests for games, vote on ideas, and game development teams can view and act on community feedback.

## Tech Stack

- **Backend**: NestJS (TypeScript)
- **Frontend**: Next.js 14+ (React)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: BullMQ
- **ORM**: Prisma
- **Game API**: RAWG (350k+ games)
- **Real-time**: Socket.IO
- **Push Notifications**: Firebase Cloud Messaging

## Project Structure

```
game-review/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/modules/
│   │       ├── auth/           # JWT & OAuth authentication
│   │       ├── users/          # User profiles
│   │       ├── games/          # Game management & RAWG integration
│   │       ├── requests/       # Feature requests & voting
│   │       ├── comments/       # Threaded comments
│   │       ├── follows/        # User & game following
│   │       ├── notifications/  # Real-time & push notifications
│   │       └── admin/          # Admin controls
│   │
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # React components
│           ├── hooks/          # Custom hooks
│           └── lib/            # Utilities & stores
│
├── libs/
│   ├── shared/                 # Shared types, constants
│   ├── database/               # Prisma schema, migrations
│   └── redis/                  # Redis module
│
├── docker/                     # Docker configs
└── turbo.json                  # Turborepo config
```

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- (Optional) RAWG API Key for game data - free at https://rawg.io/apidocs

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd game-review
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp libs/database/.env.example libs/database/.env   # read by the Prisma CLI
```

Edit `.env` with your configuration:
- `JWT_SECRET` and `JWT_REFRESH_SECRET` - Use strong random strings in production
- `RAWG_API_KEY` - Optional, enables searching external game database
- OAuth credentials - Optional, for Google/Twitch login
- Firebase credentials - Optional, for push notifications

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis containers
docker-compose up -d
```

### 4. Setup Database

```bash
# Generate Prisma client
pnpm run db:generate

# Apply migrations to the database
pnpm run db:migrate

# Seed with sample games and users
pnpm run db:seed
```

Schema changes go through migrations: edit `libs/database/prisma/schema.prisma`, then run `pnpm run db:migrate` and give the migration a name when prompted. Production applies them with `prisma migrate deploy`. `pnpm run db:push` is only for throwaway prototyping; it changes the database without recording a migration.

If your local database was created with `db:push` before migrations existed, `db:migrate` will report drift and offer to reset it (this deletes local data; run `db:seed` afterwards).

### 5. Run Development Servers

```bash
# Start both API and Web (libs are built automatically)
pnpm run dev
```

**URLs:**
- **Web App**: http://localhost:3000
- **API**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3001/docs

## Default Users (after seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@gamereview.com | admin123 | Admin |
| user@example.com | password123 | User |

## Features

### For Gamers
- Browse games from RAWG database (350k+ games)
- Submit feature requests (add or remove features)
- Upvote requests (ProductHunt-style voting)
- Comment and discuss with threading
- Follow users and games for updates
- Real-time notifications

### For Developers
- Verified developer badge
- Update request status (Open → Under Review → In Progress → Implemented/Declined)
- Respond to feature requests
- View community priorities by votes

### Voting System
- Upvote-only (like ProductHunt)
- Hot/Top/New sorting algorithms
- Redis caching for performance

### Notifications
- Real-time via WebSocket
- Push notifications via FCM
- Events: followed user posts, status changes, comments, vote milestones

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Current user
- `GET /api/v1/auth/oauth/google` - Google OAuth
- `GET /api/v1/auth/oauth/twitch` - Twitch OAuth

### Games
- `GET /api/v1/games` - List games
- `GET /api/v1/games/:slug` - Game details
- `GET /api/v1/games/:slug/requests` - Game's feature requests
- `GET /api/v1/games/search/rawg` - Search RAWG API
- `POST /api/v1/games/import/:externalId` - Import from RAWG

### Feature Requests
- `POST /api/v1/requests` - Create request
- `GET /api/v1/requests/:id` - Get request
- `POST /api/v1/requests/:id/upvote` - Toggle upvote
- `PATCH /api/v1/requests/:id/status` - Update status (dev only)

### Comments
- `GET /api/v1/requests/:id/comments` - List comments
- `POST /api/v1/requests/:id/comments` - Add comment
- `POST /api/v1/comments/:id/like` - Toggle like

### Social
- `POST /api/v1/follows/users/:userId` - Follow/unfollow user
- `POST /api/v1/follows/games/:gameId` - Follow/unfollow game
- `GET /api/v1/users/:username` - User profile

### Notifications
- `GET /api/v1/me/notifications` - List notifications
- `POST /api/v1/me/device-tokens` - Register push token

### Admin
- `POST /api/v1/admin/games/:gameId/grant-access` - Grant dev access

## Development

```bash
# Run API only
pnpm --filter @game-review/api dev

# Run Web only
pnpm --filter @game-review/web dev

# Run tests
pnpm run test

# Lint
pnpm run lint

# Prisma Studio (database GUI)
pnpm run db:studio

# Build all packages
pnpm run build
```

## Deployment

### Build

```bash
pnpm run build
```

### Required Environment Variables (Production)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Strong random secret for access tokens |
| `JWT_REFRESH_SECRET` | Strong random secret for refresh tokens |
| `API_URL` | Public API URL |
| `WEB_URL` | Public web app URL |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `RAWG_API_KEY` | RAWG API key for game search |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `TWITCH_CLIENT_ID` | Twitch OAuth client ID |
| `TWITCH_CLIENT_SECRET` | Twitch OAuth client secret |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase client email |

## Troubleshooting

### Libraries not building
```bash
# Manually build workspace libraries
pnpm run build --filter=@game-review/shared --filter=@game-review/database --filter=@game-review/redis
```

### Database connection failed
```bash
# Check Docker containers are running
docker-compose ps

# Restart containers if needed
docker-compose down && docker-compose up -d
```

### Port already in use
```bash
# Find and kill process on port
lsof -i :3001  # or :3000
kill -9 <PID>
```

## License

MIT
