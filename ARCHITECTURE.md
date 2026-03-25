# MarketMood AI Architecture

## 1. System Overview
MarketMood AI is an Expo + React Native TypeScript app with two runtime modes:
- Demo mode: deterministic safe data from local mocks
- Live mode: real market/news/AI APIs with fallback and caching

## 2. Layered Architecture
- Presentation: screens and reusable components
- State and app mode: context providers
- Service layer: API orchestration and data adapters
- Utilities: cache and error handling
- Constants and config: environment and theme
- Types: shared contracts

## 3. Project Structure
- src/components: reusable UI building blocks
- src/screens: feature-level screens
- src/navigation: tab/stack routing
- src/services: API and business services
- src/hooks: reusable hooks
- src/utils: cache and error helpers
- src/context: app mode and session state
- src/constants: theme, config, mock data
- src/types: TypeScript models

## 4. Data Flow
1. Screen requests data from service facade (newsService, stockService, aiService)
2. Service checks app mode (demo/live)
3. Demo mode returns preloaded mock data
4. Live mode executes provider calls with fallback order and safe parsing
5. Service writes/reads cache where applicable
6. Service returns typed models to UI

## 5. API Integration
- Finnhub: symbol search and quote
- Yahoo Finance: quote fallback
- Stooq: quote fallback of last resort
- GNews/Google RSS: news feed fallback chain
- Groq: AI summaries/chat/outlook
- Supabase: auth and profile persistence

## 6. Error Handling
- All services use safe defaults and non-throw fallback returns where possible
- utils/errorHandler centralizes logging and fallback wrappers
- UI renders friendly empty/retry states instead of crashing

## 7. Caching Strategy
- Search and quote caching in service layer
- Generic cache utility in src/utils/cache.ts for TTL-based caching
- Typical TTL: 2-5 minutes for API response resilience

## 8. Decision Engine
- AI layer receives normalized market/news context
- Output constrained to non-advisory actions and confidence/factors
- Explainability factors rendered across dashboard, stock detail, radar, and chat

## 9. Demo Readiness
- AppModeContext controls demo/live behavior globally
- Demo mode ships with best-case stable dataset
- Hackathon demo is resilient even without network/API quota
