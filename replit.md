# replit.md

## Overview

This is a Telegram-based ad-watching application called "LightingSats" that allows users to earn money by watching advertisements. Users can create accounts using their Telegram credentials, watch ads to earn points, claim earnings, refer friends for bonuses, and withdraw funds. The application features a mobile-first design optimized for Telegram's WebApp environment with real-time TON cryptocurrency price tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Mobile-First Design**: Optimized for Telegram WebApp with responsive layout

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API endpoints with JSON responses
- **Storage Layer**: Abstracted storage interface with in-memory implementation (ready for database integration)
- **Development Setup**: Vite middleware integration for development with HMR support
- **Error Handling**: Centralized error handling with structured JSON responses

### Data Storage Solutions
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Database**: PostgreSQL (configured but not yet connected)
- **Schema Design**: 
  - Users table with Telegram integration, earnings tracking, and referral system
  - Withdrawal requests with multiple payment methods
  - Referrals table for tracking commission structure
  - Bot statistics for admin dashboard metrics
- **Migrations**: Drizzle Kit for database schema migrations

### Authentication and Authorization
- **Telegram Integration**: Uses Telegram WebApp authentication with user validation
- **Session Management**: No traditional sessions - relies on Telegram's secure user context
- **User Identification**: Telegram user ID as primary identifier with username fallback
- **Security**: Built-in Telegram security model with WebApp validation

### Key Features
- **Ad Watching System**: Simulated ad viewing with cooldown periods and daily limits
- **Earnings Management**: Real-time balance tracking with withdrawal functionality
- **Referral Program**: Multi-level referral system with commission tracking
- **TON Price Integration**: Real-time cryptocurrency price feeds from CoinGecko API
- **Mobile Optimization**: Touch-friendly interface designed for mobile devices

## External Dependencies

### Third-Party Services
- **Telegram Bot API**: Core authentication and user management through Telegram WebApp
- **CoinGecko API**: Real-time TON cryptocurrency price data with 24h change tracking
- **Neon Database**: PostgreSQL database hosting service (configured via DATABASE_URL)

### Key Libraries
- **UI Framework**: React 18 with TypeScript support
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **HTTP Client**: Native fetch API for external service integration
- **Form Handling**: React Hook Form with Zod validation
- **Component Library**: Radix UI primitives with Shadcn/ui styling
- **Build Tools**: Vite with ESBuild for production builds
- **Development Tools**: TSX for TypeScript execution, Replit integration plugins

### API Integrations
- **TON Price Feed**: CoinGecko API endpoint for The Open Network price data
- **Telegram WebApp**: Integration with Telegram's WebApp platform for user authentication
- **Database Connection**: PostgreSQL via connection string with SSL support