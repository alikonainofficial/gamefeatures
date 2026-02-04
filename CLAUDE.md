# CLAUDE.md - Development Guide

This file contains development context and commands for working with this codebase.

## Project Overview

GameFeatures - a monorepo with NestJS API and Next.js frontend where gamers submit and vote on feature requests for games.

## Quick Commands

```bash
# Start development (builds libs first, then runs API + Web)
pnpm run dev

# Build all packages
pnpm run build

# Database commands
pnpm run db:generate   # Generate Prisma client
pnpm run db:push       # Push schema to database (use for initial setup)
pnpm run db:migrate    # Run migrations (use for production)
pnpm run db:seed       # Seed sample data
pnpm run db:studio     # Open Prisma Studio GUI

# Run individual apps
pnpm --filter @game-review/api dev
pnpm --filter @game-review/web dev

# Build individual libs
pnpm --filter @game-review/shared build
pnpm --filter @game-review/database build
pnpm --filter @game-review/redis build
```

## Architecture Notes

### Monorepo Structure
- **apps/api**: NestJS backend (port 3001)
- **apps/web**: Next.js 14 frontend (port 3000)
- **libs/shared**: Shared types, constants, enums
- **libs/database**: Prisma schema and client
- **libs/redis**: Redis module for caching

### Library Build Requirement
Workspace libraries (`@game-review/shared`, `@game-review/database`, `@game-review/redis`) must be built before running the API. This is handled automatically by Turborepo via `turbo.json`:
```json
"dev": {
  "dependsOn": ["^build"]
}
```

### Key Design Decisions

1. **CommonJS for libs**: Libraries compile to CommonJS (not ESM) for NestJS compatibility
2. **Upvote-only voting**: ProductHunt-style voting system (no downvotes)
3. **Denormalized counts**: Vote and like counts stored on entities for performance
4. **Redis caching**: Sorted sets for hot/top/new request lists
5. **JWT auth**: Access tokens (15min) + refresh tokens (7 days) with rotation

### Database
- PostgreSQL with Prisma ORM
- Schema in `libs/database/prisma/schema.prisma`
- Use `db:push` for development, `db:migrate` for production

### Authentication
- Local auth with bcrypt password hashing
- Google OAuth and Twitch OAuth support
- Access token in memory, refresh token in HTTP-only cookie

### Real-time
- Socket.IO via NestJS WebSockets
- Notifications gateway at `/notifications` namespace
- JWT verification on WebSocket connection

## Common Issues & Solutions

### "Cannot find module" errors for workspace packages
```bash
# Rebuild the libraries
pnpm run build --filter=@game-review/shared --filter=@game-review/database --filter=@game-review/redis
```

### Database connection issues
```bash
# Ensure Docker containers are running
docker-compose up -d

# Verify connection
docker-compose ps
```

### Type errors in seed.ts or other files
The project uses strict TypeScript. Ensure explicit types for:
- `response.json()` results (cast with `as` keyword)
- Loop variables that reference themselves
- Optional properties accessed from interfaces

## API Endpoints Summary

- **Auth**: `/api/v1/auth/*` - Register, login, OAuth, token refresh
- **Games**: `/api/v1/games/*` - CRUD, RAWG search/import
- **Requests**: `/api/v1/requests/*` - Feature requests, voting
- **Comments**: `/api/v1/comments/*` - Threaded comments, likes
- **Follows**: `/api/v1/follows/*` - User/game following
- **Notifications**: `/api/v1/me/notifications` - User notifications
- **Admin**: `/api/v1/admin/*` - Dev access management

## Swagger Docs

Available at http://localhost:3001/docs when API is running.
