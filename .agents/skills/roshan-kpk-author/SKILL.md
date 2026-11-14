---
name: roshan-kpk-author
description: Autonomous KPK BISE (Grades 9-12 English Medium) 30-role, 18-skill educational content producer & independent verifier skill for Freebuff, OpenCode, Cursor, and Claude Code using Roshan Study MCP Gateway or REST API at $0 paid API cost.
---

# Roshan Study — Freebuff & OpenCode Autonomous Agent Guide

You are a specialist inside **Roshan Study**'s Three-System Zero-Cost Educational Ecosystem for **KPK BISE Grades 9–12 (English Medium)** across all 8 boards (`peshawar`, `mardan`, `swat`, `malakand`, `abbottabad`, `kohat`, `bannu`, `dikhan`).

## 1. Connection Configs

### Freebuff CLI (`.agents/mcp.json`)
```json
{
  "mcpServers": {
    "roshan-study": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_AGENT_ACCESS_TOKEN>"
      }
    }
  }
}
```

### OpenCode (`opencode.json`)
```json
{
  "mcp": {
    "roshan-study": {
      "type": "remote",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_AGENT_ACCESS_TOKEN>"
      },
      "enabled": true
    }
  }
}
```

## 2. Non-Negotiable Architecture & Quality Rules

1. **Zero-Cost Default:** External agents execute all authoring and verification using their own environments (`$0` server AI cost). Never require paid OpenAI/Gemini/Anthropic APIs.
2. **Strict Independent Verification (Author != Verifier):**
   - The same `workerId` / `workerName` that authored a chapter draft **cannot** claim or submit Phase-6 verification tasks for that chapter. Use distinct worker identities (e.g., `freebuff-author-1` for authoring, `opencode-verifier-1` with Verifier token for QA).
3. **Human Publish Gate:** Agents may only save drafts, fetch book sources, renew leases, submit verifications, and report retries/errors. Only human Admin approval in the **Approval Inbox** publishes live chapters or rolls back versions.
4. **SSC/HSSC Track Isolation:** Never assign `groupId: "admission"` to `ssc_hssc` chapters or mix `mdcat`/`etea_eng`/`uni_entrance` questions into board exams.
5. **All 8 Question Formats:**
   - `mcq`: 4 distinct options + verbatim `correctAnswer` + `optionMisconceptions`
   - `multi_select`: 3+ options + `multiSelectAnswers` subset
   - `true_false`: `options: ["True", "False"]` + `correctAnswer`
   - `fill_in`: exact short answer string in `correctAnswer`
   - `matching`: >= 2 `{ left, right }` pairs inside `matchingPairs`
   - `numerical`: **6-Step KPK Board Method** (`given[]`, `required`, `formula`, `substitution`, `calculation`, `answerWithUnit`)
   - `short_answer` & `long_answer`: explicit weighted `markingPoints[]`
6. **Interactive Offline Visuals ($0 Runtime):** Include balanced KaTeX `$...$`, `MotionGraphicSpec` (coordinates `0..100`, `formulaLatex`), and `GraphSpec` (`xMax > xMin`, `yMax > yMin`).

## 3. Exact Agent Worker Lifecycle Loop

1. **Register & Discover Skills:**
   - Call `register_agent` (`POST /api/agent/register`) with `workerId`, `name`, `toolKind`, `roles`, `capabilities`.
   - Call `get_agent_skills` (`GET /api/agent/skills`) to inspect all **18 reusable Skill Specs** across the **30 specialist roles**.
2. **Fetch Textbook Sources:**
   - Call `list_books` / `get_book_source` (`GET /api/agent/books/:bookId/source`) to read extracted PDF pages or download raw PDF bytes.
3. **Claim & Maintain Lease:**
   - Call `claim_next_task` (`POST /api/agent/tasks/claim-next`).
   - Send `renew_task_lease` (`POST /api/agent/tasks/:taskId/heartbeat`) on long tasks to renew the 15-minute lease.
4. **Validate, Submit, or Report Retry (Max 2):**
   - Run `validate_chapter_pack` (`POST /api/agent/validate`) locally before submission.
   - Submit completed JSON or independent validator checks via `submit_task_result` (`POST /api/agent/tasks/:taskId/submit` or `POST /api/verifier/submit`).
   - Check `get_chapter_feedback` (`GET /api/agent/chapters/:chapterId/feedback`) when revisions are requested.
   - Report errors cleanly via `POST /api/agent/tasks/:taskId/error` (max 2 auto-retries before human escalation).
