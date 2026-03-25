import { SentimentLabel } from '../types';

const positiveWords = [
  'gain',
  'up',
  'surge',
  'strong',
  'beat',
  'bullish',
  'rally',
  'growth',
  'record',
  'improved',
  'easing',
  'win',
];

const negativeWords = [
  'fall',
  'down',
  'drop',
  'weak',
  'miss',
  'bearish',
  'selloff',
  'risk',
  'tension',
  'inflation',
  'loss',
  'pressure',
  'cautious',
];

export function scoreHeadlineSentiment(text: string): number {
  const normalized = text.toLowerCase();
  const posHits = positiveWords.reduce((acc, word) => (normalized.includes(word) ? acc + 1 : acc), 0);
  const negHits = negativeWords.reduce((acc, word) => (normalized.includes(word) ? acc + 1 : acc), 0);

  const raw = (posHits - negHits) * 18;
  const centerAdjusted = 50 + raw;
  return Math.max(0, Math.min(100, centerAdjusted));
}

export function sentimentLabelFromScore(score: number): SentimentLabel {
  if (score >= 60) {
    return 'Positive';
  }

  if (score <= 40) {
    return 'Negative';
  }

  return 'Neutral';
}
