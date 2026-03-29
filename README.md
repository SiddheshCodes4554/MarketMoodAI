# 🚀 MarketMood AI

### GenAI Stock & Economy Sentiment Engine

**From Market Noise → Actionable Intelligence**

---

## 🧠 Overview

MarketMood AI is a **GenAI-powered mobile application** that helps retail investors make smarter financial decisions by transforming fragmented market data into **clear, explainable, and actionable insights**.

Unlike traditional platforms that only provide charts and numbers, MarketMood AI focuses on **Decision Intelligence** — answering:

* What is happening?
* Why does it matter?
* What should I do next?

---

## 🎯 Problem Statement

India has over **14+ crore retail investors**, yet most face:

* 📉 Information overload (news, social media, data)
* ⚠️ Lack of real-time interpretation
* 😨 Emotion-driven decisions
* 💸 Missed opportunities

> The market has data — but lacks **clarity and decision support**.

---

## 💡 Solution

MarketMood AI combines:

* Real-time market data
* News sentiment analysis
* GenAI-powered reasoning

To deliver:

✅ Actionable insights
✅ AI-generated explanations
✅ Suggested actions (non-advisory)
✅ Confidence scoring & explainability

---

## 🧩 Key Features

### 📊 Dashboard Intelligence

* Market Sentiment Index (Bullish ↔ Bearish)
* Fear & Greed Score
* Sector Heatmap
* Risk Alerts (panic / hype detection)
* AI Market Summary + Suggested Action

---

### 🔍 Stock Explorer

* Real-time stock search (debounced)
* Popular stocks list (zero API load)
* Lazy loading (on-demand fetch)
* Global + Indian stock support

---

### 📈 Stock Detail Intelligence

* Live price + trend data
* News + sentiment analysis
* AI-generated outlook
* Suggested action + confidence score
* Explainability (“Why?” reasoning)

---

### 🚀 Opportunity Radar ⭐

* Detects bullish / bearish signals
* Highlights potential opportunities
* “Why this matters” reasoning
* Suggested action + signal strength

> 🔥 Core differentiator — moves from analysis → opportunity detection

---

### 📰 Market Story Mode

* AI-generated daily market narrative:

  * What happened
  * Why it happened
  * What to watch next

---

### 💬 AI Market Chat

* Ask: “Why is the market down?”
* Get structured, explainable responses

---

### 🚨 Risk Alert System

* Detects panic signals
* Flags hype-driven stocks
* Identifies volatility spikes

---

### 🔍 Explainability Layer

* “Why?” button on every insight
* Confidence scores + reasoning

---

## 🤖 GenAI Innovation

MarketMood AI uses AI beyond summarization:

* 🧠 Narrative Generation → Human-readable insights
* 🎯 Decision Engine → Context-aware suggestions
* 📊 Opportunity Detection → Multi-signal analysis
* 🔍 Explainability → Transparent reasoning

> We generate **financial intelligence**, not just content.

---

## 🏗️ System Architecture

```
Data APIs → Processing → AI Layer → Decision Engine → Mobile UI
```

### Layers:

* **Data Layer:** Finnhub, Yahoo Finance, Stooq, GNews, RSS
* **Processing Layer:** Sentiment + normalization
* **AI Layer:** Groq (LLaMA models)
* **Decision Layer:** Actions + confidence scoring
* **UI Layer:** React Native mobile app

---

## ⚙️ Tech Stack

### 📱 Frontend

* React Native (Expo)
* TypeScript
* React Navigation

### 🤖 AI

* Groq API (LLaMA models)

### 📊 Data Sources

* Finnhub (primary)
* Yahoo Finance + Stooq (fallback)
* GNews + RSS feeds

### 🗄️ Backend

* Supabase (Auth + DB)

### 💾 Storage

* AsyncStorage (caching)

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

---

### 2. Setup Environment Variables

Create `.env` from `.env.example`:

```bash
copy .env.example .env
```

Add:

* EXPO_PUBLIC_SUPABASE_URL
* EXPO_PUBLIC_SUPABASE_ANON_KEY
* EXPO_PUBLIC_GROQ_API_KEY
* EXPO_PUBLIC_FINNHUB_API_KEY
* EXPO_PUBLIC_GNEWS_API_KEY

---

## 🗄️ Supabase Setup (Required)

### 1. Create Supabase Project

* https://supabase.com
* Copy URL + Anon Key

---

### 2. Run SQL Schema

Navigate to:

```
/supabase/schema.sql
```

Then:

* Open Supabase → SQL Editor
* Paste schema
* Run query

---

### 3. Enable Authentication

* Go to Authentication → Settings
* Enable Email provider

---

### 🧪 Demo Mode (No Setup Required)

You can skip backend setup:

* Launch app
* Select **Demo Mode**
* Explore preloaded outputs

---

## ▶️ Run App

```bash
npm start
```

---

## 📁 Project Structure

```
src/
  components/
  screens/
  navigation/
  services/
  hooks/
  utils/
  context/
  constants/
  types/
assets/
supabase/
README.md
ARCHITECTURE.md
```

---

## 🔄 Architecture Principles

* Service-based API abstraction
* Multi-source fallback system
* Lazy loading + caching
* Error-safe UI
* Demo + Live mode separation

---

## 📈 Business Impact

MarketMood AI helps:

* Reduce information overload
* Improve investment decisions
* Prevent emotional trading
* Identify hidden opportunities

---

## 🔮 Future Scope

* Portfolio-based personalization
* Historical signal backtesting
* Broker integrations (Zerodha, Upstox)
* Voice-based AI assistant
* Predictive analytics

---

## 🏁 Final Positioning

> MarketMood AI doesn’t just analyze the market —
> it identifies opportunities, explains their significance,
> and guides investor decisions in real time.

---
