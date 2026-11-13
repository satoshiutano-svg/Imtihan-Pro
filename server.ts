import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

interface GenerateQuestionsBody {
  grade?: number;
  subjectName?: string;
  chapterTitle?: string;
  extractText?: string;
  mcqCount?: number;
  numericalCount?: number;
  writtenCount?: number;
  difficultyMin?: number;
  difficultyMax?: number;
}

interface GeminiOptionMisconception {
  option?: string;
  reason?: string;
}

interface GeminiGeneratedQuestion {
  questionType?: string;
  difficulty?: number;
  statement?: string;
  options?: string[];
  optionMisconceptions?: GeminiOptionMisconception[];
  hints?: string[];
  numericalSteps?: {
    given?: string[];
    required?: string;
    formula?: string;
    substitution?: string;
    calculation?: string;
    answerWithUnit?: string;
  };
  markingPoints?: string[];
  correctAnswer?: string;
  explanation?: string;
  marks?: number;
  sourcePageRef?: string;
}

interface GeminiResponsePayload {
  summaryNote?: string;
  questions?: GeminiGeneratedQuestion[];
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isNonRetryable =
        msg.includes('400') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('404') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED');
      if (isNonRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

function buildErrorResponse(err: unknown): { status: number; message: string; code: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      code: 'GEMINI_AUTH_ERROR',
      message:
        'Gemini API access was denied or the configured key is invalid. Please check your API key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      code: 'GEMINI_QUOTA_EXCEEDED',
      message:
        'Gemini API rate limit reached. Please wait a moment and try again, or verify your API tier in Settings > Secrets.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 502,
      code: 'GEMINI_MODEL_UNAVAILABLE',
      message: 'Configured Gemini model was unavailable. Please retry shortly.',
    };
  }
  return {
    status: 500,
    code: 'GEMINI_GENERATION_FAILED',
    message: 'Could not generate questions from this extract. Please refine the textbook text and try again.',
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        code: 'INVALID_JSON',
        message: 'Invalid JSON request body.',
      });
      return;
    }
    next(err);
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, model: MODEL_NAME, aiReady: Boolean(ai) });
  });

  app.post('/api/admin/generate-questions', async (req: Request, res: Response) => {
    if (!ai) {
      res.status(500).json({
        code: 'API_KEY_MISSING',
        message:
          'GEMINI_API_KEY is not configured in the server environment. Configure it in Settings > Secrets to use the Smart Question Generator.',
      });
      return;
    }

    const body = (req.body ?? {}) as GenerateQuestionsBody;
    const grade = clampInt(body.grade, 9, 9, 12);
    const subjectName = String(body.subjectName ?? '').trim();
    const chapterTitle = String(body.chapterTitle ?? '').trim();
    const extractText = String(body.extractText ?? '').trim();
    const mcqCount = clampInt(body.mcqCount, 3, 0, 8);
    const numericalCount = clampInt(body.numericalCount, 1, 0, 5);
    const writtenCount = clampInt(body.writtenCount, 1, 0, 5);
    const difficultyMin = clampInt(body.difficultyMin, 2, 1, 7);
    const difficultyMax = clampInt(body.difficultyMax, 6, difficultyMin, 7);

    if (!subjectName || !chapterTitle) {
      res.status(400).json({
        code: 'INVALID_CHAPTER_METADATA',
        message: 'Subject name and chapter title are required.',
      });
      return;
    }

    if (extractText.length < 40) {
      res.status(400).json({
        code: 'EXTRACT_TOO_SHORT',
        message: 'Please paste at least 40 characters of textbook content so questions stay faithful to the lesson.',
      });
      return;
    }

    if (extractText.length > 15000) {
      res.status(400).json({
        code: 'EXTRACT_TOO_LONG',
        message: 'Textbook extract is too large (max 15,000 characters). Split long chapters by topic.',
      });
      return;
    }

    const totalRequested = mcqCount + numericalCount + writtenCount;
    if (totalRequested < 1 || totalRequested > 12) {
      res.status(400).json({
        code: 'INVALID_QUESTION_COUNTS',
        message: 'Request between 1 and 12 total questions per generation run.',
      });
      return;
    }

    const examTier = grade <= 10 ? `SSC (Grade ${grade})` : `HSSC (Grade ${grade})`;
    const systemInstruction = [
      'You are an experienced KPK BISE (Peshawar, Mardan, Swat, Malakand, Abbottabad, Kohat, Bannu, D.I. Khan) board paper setter and KPECTB English-medium subject specialist.',
      `Target ONLY KPK BISE ${examTier} board examination pattern (SLO-based Section A MCQs, Section B Short Answers / Numericals, Section C Long Questions). Do NOT generate MDCAT, ETEA, or university entrance items.`,
      'Use clear, accurate English appropriate for Pakistani Grades 9-12 English-medium students, with strict SI units and mathematical notation.',
      'Rules per question type:',
      '1) For questionType "mcq": provide exactly 4 distinct options, set marks = 1, set correctAnswer verbatim to one of the 4 options, provide 1-2 progressive hints, and provide optionMisconceptions explaining why each of the 3 wrong distractors is incorrect.',
      '2) For questionType "numerical": provide ALL 6 required numericalSteps fields: given (non-empty array of values with units), required (what to find), formula (symbolic equation), substitution (numbers plugged into formula), calculation (clean arithmetic result), answerWithUnit (final value + SI unit). Set correctAnswer equal to answerWithUnit, marks between 3 and 5, and 2 progressive hints.',
      '3) For questionType "short_answer" or "long_answer": provide a markingPoints array where each item explicitly includes its mark weight (e.g., "State the formula F = ma (1 mark)"), marks = 3 for short_answer or 6-8 for long_answer, 1-2 hints, and a clear model correctAnswer.',
      'Never claim an AI-generated draft is an official past paper; all outputs are practice drafts anchored to the supplied textbook extract.',
    ].join('\n');

    const prompt = [
      `Course Context: KPK BISE ${examTier} | Subject: ${subjectName} | Chapter: ${chapterTitle}`,
      `Difficulty Range: Levels ${difficultyMin} to ${difficultyMax} (out of 7).`,
      `Generate exactly:`,
      `- ${mcqCount} MCQ question(s) ("mcq")`,
      `- ${numericalCount} 6-step Numerical problem(s) ("numerical") — if the topic is non-numerical (e.g. descriptive biology/history), create realistic quantitative data/unit conversion or ratio problems grounded in the extract if requested, or keep calculation clear and elementary.`,
      `- ${writtenCount} Board Marking-Scheme question(s) ("short_answer" or "long_answer")`,
      '',
      'TEXTBOOK EXTRACT:',
      extractText,
    ].join('\n');

    try {
      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryNote: {
                  type: Type.STRING,
                  description: 'One short sentence summarizing the key SLO concepts covered in this generated draft set.',
                },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      questionType: {
                        type: Type.STRING,
                        description: 'One of: mcq, numerical, short_answer, long_answer',
                      },
                      difficulty: {
                        type: Type.INTEGER,
                        description: 'Difficulty level between 1 and 7.',
                      },
                      statement: {
                        type: Type.STRING,
                        description: 'Complete question statement.',
                      },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: '4 options for mcq; empty array for numerical, short_answer, or long_answer.',
                      },
                      optionMisconceptions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            option: { type: Type.STRING },
                            reason: { type: Type.STRING },
                          },
                          required: ['option', 'reason'],
                        },
                        description: 'Misconception explanation for each wrong MCQ distractor.',
                      },
                      hints: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: '1 to 2 progressive hints that guide the student without giving away the answer.',
                      },
                      numericalSteps: {
                        type: Type.OBJECT,
                        properties: {
                          given: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          required: { type: Type.STRING },
                          formula: { type: Type.STRING },
                          substitution: { type: Type.STRING },
                          calculation: { type: Type.STRING },
                          answerWithUnit: { type: Type.STRING },
                        },
                        required: [
                          'given',
                          'required',
                          'formula',
                          'substitution',
                          'calculation',
                          'answerWithUnit',
                        ],
                        description: 'Populate for numerical questions; omit or leave empty for non-numericals.',
                      },
                      markingPoints: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'KPK board mark-allocated scoring bullets for short_answer and long_answer.',
                      },
                      correctAnswer: {
                        type: Type.STRING,
                        description: 'Exact correct option text (for MCQ), answerWithUnit (for numerical), or model answer.',
                      },
                      explanation: {
                        type: Type.STRING,
                        description: 'Concise pedagogical explanation of why the answer is correct.',
                      },
                      marks: {
                        type: Type.INTEGER,
                        description: 'Marks allocated in KPK BISE pattern (1 for MCQ, 3-5 for numerical/short, 6-8 for long).',
                      },
                      sourcePageRef: {
                        type: Type.STRING,
                        description: 'Short reference label pointing back to section/topic in extract.',
                      },
                    },
                    required: [
                      'questionType',
                      'difficulty',
                      'statement',
                      'options',
                      'hints',
                      'markingPoints',
                      'correctAnswer',
                      'explanation',
                      'marks',
                    ],
                  },
                },
              },
              required: ['summaryNote', 'questions'],
            },
          },
        }),
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as GeminiResponsePayload;
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

      const normalized = rawQuestions
        .map((q) => {
          const allowedTypes = new Set(['mcq', 'numerical', 'short_answer', 'long_answer']);
          const qType = allowedTypes.has(String(q.questionType))
            ? (q.questionType as 'mcq' | 'numerical' | 'short_answer' | 'long_answer')
            : (q.options && q.options.length >= 2 ? 'mcq' : 'short_answer');

          const options = qType === 'mcq' ? (q.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 4) : [];
          let correctAnswer = String(q.correctAnswer ?? '').trim();
          if (qType === 'mcq' && options.length > 0) {
            const matchedCorrect = options.find(
              (o) => o.toLowerCase() === correctAnswer.toLowerCase(),
            );
            correctAnswer = matchedCorrect ?? options[0];
          }

          const optionLookup = new Map(options.map((o) => [o.toLowerCase(), o]));
          const misconceptions: Record<string, string> = {};
          for (const item of q.optionMisconceptions ?? []) {
            const rawOpt = String(item?.option ?? '').trim();
            const rawReason = String(item?.reason ?? '').trim();
            if (!rawOpt || !rawReason) continue;
            const canonicalOpt = optionLookup.get(rawOpt.toLowerCase()) ?? rawOpt;
            if (canonicalOpt.toLowerCase() !== correctAnswer.toLowerCase()) {
              misconceptions[canonicalOpt] = rawReason;
            }
          }

          const steps = q.numericalSteps;
          const hasValidNumerical =
            qType === 'numerical' &&
            steps &&
            Array.isArray(steps.given) &&
            steps.given.length > 0 &&
            String(steps.formula ?? '').trim().length > 0 &&
            String(steps.answerWithUnit ?? '').trim().length > 0;

          const numericalSteps =
            qType === 'numerical'
              ? {
                  given: hasValidNumerical ? steps!.given!.map((g) => String(g).trim()).filter(Boolean) : ['Verify values from problem statement'],
                  required: String(steps?.required ?? 'Required physical/mathematical quantity').trim(),
                  formula: String(steps?.formula ?? 'Formula from chapter').trim(),
                  substitution: String(steps?.substitution ?? 'Substitute given values').trim(),
                  calculation: String(steps?.calculation ?? 'Simplify step by step').trim(),
                  answerWithUnit: String(steps?.answerWithUnit ?? correctAnswer).trim() || correctAnswer,
                }
              : undefined;

          if (qType === 'numerical' && numericalSteps?.answerWithUnit) {
            correctAnswer = numericalSteps.answerWithUnit;
          }

          const markingPoints =
            qType === 'short_answer' || qType === 'long_answer'
              ? (q.markingPoints ?? []).map((m) => String(m).trim()).filter(Boolean)
              : [];

          return {
            questionType: qType,
            difficulty: clampInt(q.difficulty, difficultyMin, 1, 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            statement: String(q.statement ?? '').trim(),
            options,
            optionMisconceptions: misconceptions,
            hints: (q.hints ?? []).map((h) => String(h).trim()).filter(Boolean),
            numericalSteps,
            markingPoints,
            correctAnswer: correctAnswer || 'Verify answer against textbook',
            explanation: String(q.explanation ?? '').trim() || 'Review textbook explanation and verify units.',
            marks: clampInt(
              q.marks,
              qType === 'mcq' ? 1 : qType === 'numerical' ? 4 : qType === 'long_answer' ? 7 : 3,
              1,
              15,
            ),
            sourcePageRef: String(q.sourcePageRef ?? chapterTitle).trim(),
          };
        })
        .filter((q) => q.statement.length >= 8 && (q.questionType !== 'mcq' || q.options.length >= 2));

      if (normalized.length === 0) {
        res.status(502).json({
          code: 'EMPTY_GENERATION',
          message: 'Model returned no usable questions for that extract. Add a bit more detail and try again.',
        });
        return;
      }

      res.json({
        model: MODEL_NAME,
        summaryNote: String(parsed.summaryNote ?? `Generated ${normalized.length} KPK BISE draft questions.`).trim(),
        questions: normalized,
      });
    } catch (err: unknown) {
      const mapped = buildErrorResponse(err);
      res.status(mapped.status).json({
        code: mapped.code,
        message: mapped.message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Roshan Study server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Roshan Study server:', err);
  process.exit(1);
});
