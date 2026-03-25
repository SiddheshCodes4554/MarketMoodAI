# MarketMood AI

MarketMood AI is a React Native (Expo) app for market intelligence that combines live market feeds, sentiment analytics, and AI explainability.

## Project Overview

The app is designed for hackathon demos and production-readiness, with a robust dual-mode architecture:
- Live mode for real API-backed insights
- Demo mode for stable preloaded outputs

## Features

- Dashboard sentiment intelligence
- Stock Explorer and Stock Detail analysis
- Opportunity Radar signal engine
- Market Story mode
- AI Market Chat
- Confidence and explainability factors
- Multi-source fallback for quotes and news
- Cache-backed resilience with safe UI fallbacks

## Tech Stack

- Expo + React Native + TypeScript
- React Navigation
- Supabase Auth/Profile
- AsyncStorage
- Groq API
- Finnhub, Yahoo, Stooq
- GNews + RSS fallbacks

## Setup Instructions

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
copy .env.example .env
```

3. Run app:

```bash
npm start
```

## Environment Variables

Use the following keys in .env:
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_GROQ_API_KEY
- EXPO_PUBLIC_FINNHUB_API_KEY
- EXPO_PUBLIC_GNEWS_API_KEY

## Demo Instructions

1. Launch app and select Demo mode in onboarding.
2. Use the Demo Mode toggle for stable best-case outputs.
3. Switch to Live mode to use real APIs.

## Architecture Overview

The app follows a layered architecture:
- Screens call standardized service facades (newsService, stockService, aiService)
- Context controls app session and app mode
- Utilities provide cache and error handling
- Constants provide central config and theme

Detailed architecture document: ARCHITECTURE.md

## Repository Structure

- src/components
- src/screens
- src/navigation
- src/services
- src/hooks
- src/utils
- src/context
- src/constants
- src/types
- assets
- supabase
- README.md
- ARCHITECTURE.md

## Scripts

```json
{
	"start": "expo start",
	"android": "expo start --android",
	"ios": "expo start --ios",
	"lint": "eslint ."
}
```
