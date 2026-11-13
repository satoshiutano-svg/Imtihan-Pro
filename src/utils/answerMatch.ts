import type { QuestionType } from '../types/cms';

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

const NUMERIC_PREFIX_RE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(.*)$/i;

export function isAnswerMatch(
  userRaw: string,
  expectedRaw: string,
  questionType: QuestionType,
): boolean {
  const user = normalizeText(userRaw);
  const expected = normalizeText(expectedRaw);
  if (!user || !expected) return false;
  if (user === expected) return true;

  if (questionType !== 'numerical') {
    return false;
  }

  const userMatch = NUMERIC_PREFIX_RE.exec(user);
  const expectedMatch = NUMERIC_PREFIX_RE.exec(expected);
  if (!userMatch || !expectedMatch) {
    return false;
  }

  const userNum = Number(userMatch[1]);
  const expectedNum = Number(expectedMatch[1]);
  if (!Number.isFinite(userNum) || !Number.isFinite(expectedNum)) {
    return false;
  }

  const tolerance = Math.max(1e-6, Math.abs(expectedNum) * 1e-4);
  if (Math.abs(userNum - expectedNum) > tolerance) {
    return false;
  }

  const userUnit = userMatch[2].trim();
  const expectedUnit = expectedMatch[2].trim();
  // Allow numeric-only entry (e.g. "54" for "54 m"), while rejecting mismatched units ("54 km").
  return userUnit === '' || userUnit === expectedUnit;
}
