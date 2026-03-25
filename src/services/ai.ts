import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';
import { NewsItem, OpportunitySignalInput, OpportunitySignalType, UserType } from '../types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const ACTION_WORDS = ['Watch', 'Avoid', 'Monitor', 'Consider'];
const USER_TYPE_KEY = 'marketMoodUserType';

type DecisionLayerOutput = {
  analysis: string;
  suggestedAction: string;
  confidence: number;
  factors: string[];
};

type ExplainabilityContext = {
  sentimentConsistency: number;
  sourceCount: number;
  trendStrength: number;
};

type ChatReplyOutput = {
  insight: string;
  suggestedAction: string;
  confidence: number;
  factors: string[];
};

async function resolveUserType(explicitUserType?: UserType): Promise<UserType> {
  if (explicitUserType) {
    return explicitUserType;
  }

  try {
    const raw = await AsyncStorage.getItem(USER_TYPE_KEY);
    if (raw === 'Beginner' || raw === 'Intermediate' || raw === 'Trader') {
      return raw;
    }
  } catch {
    // ignore storage read failures
  }

  return 'Intermediate';
}

function getGroqKey(): string {
  return CONFIG.API.GROQ;
}

function sanitizeAiText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*\*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\s)(.*?)(?<!\s)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function replaceRestrictedActionWords(text: string): string {
  return text
    .replace(/\bbuying\b/gi, 'considering')
    .replace(/\bbuy\b/gi, 'consider')
    .replace(/\bselling\b/gi, 'reducing exposure')
    .replace(/\bsell\b/gi, 'avoid fresh entries');
}

function normalizeSuggestedAction(text: string, fallback: string): string {
  const cleaned = sanitizeAiText(replaceRestrictedActionWords(text || '')).trim();
  const safe = cleaned || fallback;
  const hasAllowedPrefix = ACTION_WORDS.some((word) =>
    new RegExp(`^${word}\\b`, 'i').test(safe),
  );

  return hasAllowedPrefix ? safe : `Consider ${safe.charAt(0).toLowerCase()}${safe.slice(1)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deriveConfidenceFromContext(context?: ExplainabilityContext): number {
  if (!context) {
    return 68;
  }

  const sourceScore = clamp(context.sourceCount * 8, 20, 100);
  const composite = context.sentimentConsistency * 0.45 + sourceScore * 0.3 + context.trendStrength * 0.25;
  return clamp(Math.round(composite), 35, 95);
}

function deriveFactorsFromContext(context?: ExplainabilityContext): string[] {
  if (!context) {
    return [
      'Sentiment consistency: moderate',
      'Source count: limited live context',
      'Trend strength: moderate',
    ];
  }

  return [
    `Sentiment consistency: ${context.sentimentConsistency}%`,
    `${context.sourceCount} sources analyzed`,
    `Trend strength: ${context.trendStrength}%`,
  ];
}

function normalizeConfidence(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(Math.round(parsed), 0, 100);
}

function normalizeFactors(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const factors = value
    .map((item) => sanitizeAiText(String(item ?? '')).trim())
    .filter(Boolean)
    .slice(0, 4);

  return factors.length ? factors : fallback;
}

function parseDecisionLayer(aiResponse: string): DecisionLayerOutput | null {
  const text = sanitizeAiText(aiResponse);
  if (!text) {
    return null;
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      const analysis = sanitizeAiText(String(parsed?.insight ?? parsed?.analysis ?? '')).trim();
      const suggestedAction = sanitizeAiText(String(parsed?.suggestedAction ?? '')).trim();
      const confidence = normalizeConfidence(parsed?.confidence, 68);
      const factors = normalizeFactors(parsed?.factors, deriveFactorsFromContext());

      if (analysis) {
        return {
          analysis,
          suggestedAction,
          confidence,
          factors,
        };
      }
    } catch {
      // Fall through to plain-text parser.
    }
  }

  const lines = text.split('\n').map((line) => line.trim());
  const actionLineIndex = lines.findIndex((line) => /^suggested action\s*:/i.test(line));

  if (actionLineIndex < 0) {
    return null;
  }

  const actionValue = lines[actionLineIndex].replace(/^suggested action\s*:/i, '').trim();
  const analysisLines = lines.filter((_, idx) => idx !== actionLineIndex).filter(Boolean);

  return {
    analysis: analysisLines.join('\n').trim(),
    suggestedAction: actionValue,
    confidence: 68,
    factors: deriveFactorsFromContext(),
  };
}

async function callGroq(prompt: string): Promise<string | null> {
  const apiKey = getGroqKey();

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are a financial assistant for Indian retail investors. Keep responses practical, clear, and avoid making guaranteed-return claims. Output plain text only. Do not use markdown symbols such as **, *, #, or code blocks.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    return raw ? sanitizeAiText(raw) : null;
  } catch {
    return null;
  }
}

export async function generateMarketSummary(
  newsData: NewsItem[],
  context?: ExplainabilityContext,
  userType?: UserType,
): Promise<DecisionLayerOutput> {
  const compactNews = newsData
    .slice(0, 8)
    .map((item, idx) => `${idx + 1}. ${item.title}`)
    .join('\n');

  const profile = await resolveUserType(userType);

  const prompt = [
    'Analyze the following financial news and explain why the market moved today in simple terms for an Indian retail investor.',
    'Return ONLY valid JSON with keys: insight, suggestedAction, confidence, factors.',
    'insight should be 3-5 bullet points with key events, sector impact, and overall sentiment.',
    'Based on the analysis, provide a clear and simple suggested action for a retail investor. Keep it non-advisory and educational.',
    'confidence must be an integer from 0 to 100.',
    'factors must be an array of 3 concise strings based on sentiment consistency, number of sources, and trend strength.',
    `User profile: ${profile}`,
    'Avoid direct buy/sell wording. Use words like Watch, Avoid, Monitor, or Consider.',
    'Keep it educational, not investment advice.',
    'No markdown. No extra keys. No surrounding text.',
    '',
    compactNews,
  ].join('\n');

  const aiResponse = await callGroq(prompt);
  const fallbackConfidence = deriveConfidenceFromContext(context);
  const fallbackFactors = deriveFactorsFromContext(context);

  if (aiResponse) {
    const parsed = parseDecisionLayer(aiResponse);
    if (parsed) {
      return {
        analysis: parsed.analysis,
        suggestedAction: normalizeSuggestedAction(
          parsed.suggestedAction,
          'Monitor broader market cues and wait for stronger sector confirmation.',
        ),
        confidence: normalizeConfidence(parsed.confidence, fallbackConfidence),
        factors: normalizeFactors(parsed.factors, fallbackFactors),
      };
    }

    return {
      analysis: aiResponse,
      suggestedAction: 'Monitor broader market cues and wait for stronger sector confirmation.',
      confidence: fallbackConfidence,
      factors: fallbackFactors,
    };
  }

  return {
    analysis: [
      '- RBI policy stability and lower inflation expectations supported large-cap participation.',
      '- Banking and IT led upside momentum after favorable commentary and deal wins.',
      '- Rising crude prices limited gains in auto and logistics-linked counters.',
      '- Overall mood stayed cautiously bullish, with selective risk-taking over broad euphoria.',
    ].join('\n'),
    suggestedAction: 'Watch sector rotation closely and consider staggered decisions instead of aggressive positioning.',
    confidence: fallbackConfidence,
    factors: fallbackFactors,
  };
}

export async function generateWhyMovedExplanation(newsData: NewsItem[], userType?: UserType): Promise<string> {
  const compactNews = newsData
    .slice(0, 8)
    .map((item, idx) => `${idx + 1}. ${item.title}`)
    .join('\n');

  const profile = await resolveUserType(userType);

  const prompt = [
    'Analyze why the Indian market moved today from these headlines.',
    'Return exactly in this format:',
    'Summary: one simple sentence.',
    'Key Reasons:',
    '- reason 1',
    '- reason 2',
    '- reason 3 (optional)',
    'Sector Impact:',
    '- One bullet explaining which sectors were up/down and why.',
    '',
    'Rules:',
    '- Keep language simple for retail investors.',
    '- Include only 2 or 3 key reasons.',
    '- Do not add investment advice.',
    `- User profile: ${profile}`,
    '',
    compactNews,
  ].join('\n');

  const aiResponse = await callGroq(prompt);
  if (aiResponse) {
    return aiResponse;
  }

  return [
    'Summary: Market pressure came from higher oil prices and cautious global risk sentiment.',
    'Key Reasons:',
    '- Crude oil moved higher, increasing cost concerns for oil-sensitive businesses.',
    '- Global markets stayed weak, reducing risk appetite in local equities.',
    '- Profit booking emerged after recent gains in select heavyweight stocks.',
    'Sector Impact:',
    '- Auto and logistics were relatively weak due to cost pressure, while defensives like pharma remained comparatively stable.',
  ].join('\n');
}

export async function generateMarketStory(newsData: NewsItem[], userType?: UserType): Promise<string> {
  const compactNews = newsData
    .slice(0, 10)
    .map((item, idx) => `${idx + 1}. ${item.title}`)
    .join('\n');

  const profile = await resolveUserType(userType);

  const prompt = [
    'Create a demo-friendly Market Story Mode 2.0 script using these Indian market headlines.',
    'Write like a mini news anchor: engaging, clear, and energetic but factual.',
    'Output format exactly:',
    'Headline: Today\'s Market Story',
    'What happened: 2-3 concise sentences summarizing today\'s market move.',
    'Why it happened: 2-3 concise sentences connecting key drivers and sector impact.',
    'What to watch next: 2 bullet points.',
    '',
    'Rules:',
    '- Write for a retail investor audience.',
    '- Keep it narrative, simple, and easy to follow.',
    '- No investment advice or guaranteed returns.',
    `- User profile: ${profile}`,
    '- Avoid markdown symbols and avoid extra sections.',
    '',
    compactNews,
  ].join('\n');

  const aiResponse = await callGroq(prompt);
  if (aiResponse) {
    return aiResponse;
  }

  return [
    'Headline: Today\'s Market Story',
    'What happened: Today the market closed under pressure after weak global cues and broad selling in IT-heavy counters. Late-session defensive buying reduced deeper losses, but the benchmark tone stayed cautious.',
    'Why it happened: Global risk-off sentiment and rising commodity concerns pulled confidence lower, while IT and export-linked names faced valuation pressure. Banking remained relatively resilient, but not strong enough to fully offset index drag.',
    'What to watch next:',
    '- Whether IT majors stabilize after management commentary and fresh demand signals.',
    '- Global market direction, crude movement, and foreign fund flows in the next session.',
  ].join('\n');
}

export async function generateStockOutlook(
  symbol: string,
  sentimentScore: number,
  context?: ExplainabilityContext,
  userType?: UserType,
): Promise<DecisionLayerOutput> {
  const profile = await resolveUserType(userType);

  const prompt = [
    `Provide a short outlook for ${symbol}.`,
    `Current sentiment score is ${sentimentScore}/100.`,
    'Return ONLY valid JSON with keys: insight, suggestedAction, confidence, factors.',
    'insight should be 3 concise bullet points: momentum view, key risk, and what to track next.',
    'Based on the analysis, provide a clear and simple suggested action for a retail investor. Keep it non-advisory and educational.',
    'confidence must be an integer from 0 to 100.',
    'factors must be an array of 3 concise strings based on sentiment consistency, number of sources, and trend strength.',
    `User profile: ${profile}`,
    'Avoid direct buy/sell wording. Use words like Watch, Avoid, Monitor, or Consider.',
    'Do not provide definitive buy/sell calls.',
    'No markdown. No extra keys. No surrounding text.',
  ].join('\n');

  const aiResponse = await callGroq(prompt);
  const fallbackConfidence = deriveConfidenceFromContext(context);
  const fallbackFactors = deriveFactorsFromContext(context);

  if (aiResponse) {
    const parsed = parseDecisionLayer(aiResponse);
    if (parsed) {
      return {
        analysis: parsed.analysis,
        suggestedAction: normalizeSuggestedAction(
          parsed.suggestedAction,
          'Monitor price behavior and wait for stronger confirmation from sentiment trend.',
        ),
        confidence: normalizeConfidence(parsed.confidence, fallbackConfidence),
        factors: normalizeFactors(parsed.factors, fallbackFactors),
      };
    }

    return {
      analysis: aiResponse,
      suggestedAction: 'Monitor price behavior and wait for stronger confirmation from sentiment trend.',
      confidence: fallbackConfidence,
      factors: fallbackFactors,
    };
  }

  return {
    analysis: [
      '- Momentum looks moderate with sentiment not yet in extreme territory.',
      '- Key risk is broad market volatility if global cues weaken.',
      '- Track upcoming earnings commentary and sector-wide flow for confirmation.',
    ].join('\n'),
    suggestedAction: 'Watch for trend consistency and consider waiting for stronger confirmation before changing exposure.',
    confidence: fallbackConfidence,
    factors: fallbackFactors,
  };
}

export async function generateChatReply(
  question: string,
  context?: ExplainabilityContext,
  userType?: UserType,
): Promise<ChatReplyOutput> {
  const profile = await resolveUserType(userType);
  const fallbackConfidence = deriveConfidenceFromContext(context);
  const fallbackFactors = deriveFactorsFromContext(context);

  if (!getGroqKey()) {
    return {
      insight:
        'Live AI chat is unavailable because EXPO_PUBLIC_GROQ_API_KEY is missing. Add the key in your .env and restart Expo.',
      suggestedAction: 'Monitor live market sections in the app until AI chat is configured.',
      confidence: 28,
      factors: ['Sentiment consistency: unavailable', '0 sources analyzed', 'Trend strength: unavailable'],
    };
  }

  const prompt = [
    'User question:',
    question,
    '',
    'Return ONLY valid JSON with keys: insight, suggestedAction, confidence, factors.',
    'insight should be a simple answer for an Indian retail investor with 4-6 bullet points.',
    'Keep it educational, concise, and avoid guaranteed-return claims.',
    'Include one risk reminder at the end.',
    'Based on the analysis, provide a clear and simple suggested action for a retail investor. Keep it non-advisory and educational.',
    'confidence must be an integer from 0 to 100.',
    'factors must be an array of 3 concise strings based on sentiment consistency, number of sources, and trend strength.',
    `User profile: ${profile}`,
    'Avoid direct buy/sell wording. Use words like Watch, Avoid, Monitor, or Consider.',
    'No markdown. No extra keys. No surrounding text.',
  ].join('\n');

  const aiResponse = await callGroq(prompt);

  if (aiResponse) {
    const parsed = parseDecisionLayer(aiResponse);
    if (parsed) {
      return {
        insight: sanitizeAiText(parsed.analysis),
        suggestedAction: normalizeSuggestedAction(
          parsed.suggestedAction,
          'Monitor confirmation signals and consider staged decisions while risk remains elevated.',
        ),
        confidence: normalizeConfidence(parsed.confidence, fallbackConfidence),
        factors: normalizeFactors(parsed.factors, fallbackFactors),
      };
    }

    const sanitized = sanitizeAiText(replaceRestrictedActionWords(aiResponse));
    return {
      insight: sanitized,
      suggestedAction: 'Monitor confirmation signals and consider small, staged decisions while risk remains elevated.',
      confidence: fallbackConfidence,
      factors: fallbackFactors,
    };
  }

  return {
    insight: 'I could not reach the live Groq model right now. Please retry in a moment.',
    suggestedAction: 'Monitor the dashboard and retry chat when connectivity stabilizes.',
    confidence: 32,
    factors: fallbackFactors,
  };
}

function computeFallbackOpportunity(input: OpportunitySignalInput): {
  signalType: OpportunitySignalType;
  confidence: number;
  explanation: string;
  suggestedAction: string;
  factors: string[];
} {
  const sentimentShift = input.sentimentAvg - 50;
  const trendBoost = input.sentimentTrend === 'rising' ? 6 : input.sentimentTrend === 'falling' ? -6 : 0;
  const priceBoost = input.changePercent * 2.4;
  const buzzBoost = Math.min(8, input.buzz * 1.5);

  const composite = sentimentShift + trendBoost + priceBoost + buzzBoost;
  const confidence = Math.max(45, Math.min(95, Math.round(55 + Math.abs(composite))));

  let signalType: OpportunitySignalType = 'Watchlist';
  if (composite >= 12) {
    signalType = 'Bullish';
  } else if (composite <= -12) {
    signalType = 'Bearish';
  }

  const explanation =
    signalType === 'Bullish'
      ? `Positive sentiment (${input.sentimentAvg}) with ${input.sentimentTrend} trend and rising price momentum is supporting upside interest.`
      : signalType === 'Bearish'
        ? `Weak sentiment (${input.sentimentAvg}) with ${input.sentimentTrend} signal and soft price momentum indicates downside pressure.`
        : `Signals are mixed: sentiment ${input.sentimentAvg}, trend ${input.sentimentTrend}, and moderate buzz (${input.buzz} mentions).`;

  const suggestedAction =
    signalType === 'Bullish'
      ? 'Watch for breakout confirmation with sustained volume before taking fresh exposure.'
      : signalType === 'Bearish'
        ? 'Avoid aggressive positioning and monitor for stabilization until risk pressure cools.'
        : 'Keep on watchlist and wait for clearer sentiment and momentum alignment.';

  const factors = [
    `Sentiment consistency: ${Math.max(35, Math.min(95, Math.round(100 - Math.abs(input.sentimentAvg - 50) * 1.2)))}%`,
    `${Math.max(1, input.buzz)} sources analyzed`,
    `Trend strength: ${Math.max(25, Math.min(95, Math.round(Math.abs(input.changePercent) * 16 + (input.sentimentTrend === 'flat' ? 30 : 45))))}%`,
  ];

  return {
    signalType,
    confidence,
    explanation,
    suggestedAction,
    factors,
  };
}

export async function generateOpportunityInsight(stockData: OpportunitySignalInput): Promise<{
  signalType: OpportunitySignalType;
  confidence: number;
  explanation: string;
  suggestedAction: string;
  factors: string[];
}>
{
  const profile = await resolveUserType();

  const prompt = [
    'Analyze the sentiment, trend, and market signals for this stock and generate opportunity output for a retail investor.',
    'Return ONLY valid JSON with keys: signalType, confidence, explanation, suggestedAction, factors.',
    'signalType must be one of: Bullish, Bearish, Watchlist.',
    'confidence must be an integer from 0 to 100.',
    'Based on the analysis, provide a clear and simple suggested action for a retail investor. Keep it non-advisory and educational.',
    'factors must be an array of 3 concise strings based on sentiment consistency, number of sources, and trend strength.',
    `User profile: ${profile}`,
    'Avoid direct buy/sell wording. Use words like Watch, Avoid, Monitor, or Consider.',
    'No markdown. No extra keys. No surrounding text.',
    '',
    `symbol: ${stockData.symbol}`,
    `sentimentAvg: ${stockData.sentimentAvg}`,
    `sentimentTrend: ${stockData.sentimentTrend}`,
    `buzz: ${stockData.buzz}`,
    `changePercent: ${stockData.changePercent}`,
    `priceTrend: ${stockData.priceTrend}`,
  ].join('\n');

  const aiText = await callGroq(prompt);
  if (aiText) {
    try {
      const start = aiText.indexOf('{');
      const end = aiText.lastIndexOf('}');
      const raw = start >= 0 && end > start ? aiText.slice(start, end + 1) : aiText;
      const parsed = JSON.parse(raw);

      const signalType: OpportunitySignalType =
        parsed?.signalType === 'Bullish' || parsed?.signalType === 'Bearish' || parsed?.signalType === 'Watchlist'
          ? parsed.signalType
          : 'Watchlist';

      const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed?.confidence ?? 55))));
      const explanation = sanitizeAiText(String(parsed?.explanation ?? 'Opportunity signals are mixed.'));
      const suggestedAction = normalizeSuggestedAction(
        String(parsed?.suggestedAction ?? 'Track the stock for clearer confirmation.'),
        'Monitor the stock for clearer confirmation before taking fresh exposure.',
      );
      const fallback = computeFallbackOpportunity(stockData);
      const factors = normalizeFactors(parsed?.factors, fallback.factors);

      return {
        signalType,
        confidence,
        explanation,
        suggestedAction,
        factors,
      };
    } catch {
      return computeFallbackOpportunity(stockData);
    }
  }

  return computeFallbackOpportunity(stockData);
}
