/**
 * POST /api/audit — run the audit engine on the server.
 *
 * The engine itself is deterministic and pure; the only reason this route exists
 * is layer 3, which needs a model. Cloudflare Workers AI is reached through the
 * `AI` binding declared in wrangler.jsonc, so no API key is involved.
 *
 * When the binding is unavailable — local `next dev`, a preview without the
 * binding, a provider outage — the route does NOT fail and does NOT silently
 * pass: it falls back to the declared-gap provider, so the verdict states that
 * the semantic layer did not run. An absent layer must never look like a passed
 * layer.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildConstraintBank,
  declaredGapProvider,
  modelProvider,
  runAudit,
  sha256Hex,
  buildSemanticPrompt,
  type SemanticProvider,
} from "@/lib/audit";
import type { AuditInput, ContentLevel, WorkType } from "@/lib/audit/types";

export const dynamic = "force-dynamic";

/**
 * The model chain, tried in order.
 *
 * The order is measured, not assumed. Every candidate was run against this
 * project's own layer-3 prompt and scored on whether it returns the strict JSON
 * the parser accepts and whether its quotes survive literal verification — the
 * parser rejects an invented quote, so a model that fabricates them scores
 * badly by construction.
 *
 * The three OpenRouter entries are the free tier's cleanest: valid JSON, no
 * rejected quotation, and the ruling change found. They lead on quality. The
 * Workers AI models stay at the tail because they cost nothing, need no external
 * service and answer in-process — they are what a rate-limited or hung first
 * choice falls back to.
 *
 * A bigger model is not a better one here. The largest candidate measured
 * (nemotron-3-ultra, 550B) came last: invalid JSON, three rejected quotes, and
 * forty-seven seconds. Layer 3 asks for facts in a fixed shape, not for
 * reasoning.
 */
const CHAIN: readonly {
  provider: "workers-ai" | "openrouter";
  model: string;
  attempts: number;
  timeoutMs: number;
}[] = [
  { provider: "openrouter", model: "inclusionai/ling-3.0-flash-sante:free", attempts: 1, timeoutMs: 45_000 },
  { provider: "openrouter", model: "poolside/laguna-s-2.1:free", attempts: 1, timeoutMs: 45_000 },
  {
    provider: "openrouter",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    attempts: 1,
    timeoutMs: 60_000,
  },
  { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", attempts: 2, timeoutMs: 0 },
  { provider: "workers-ai", model: "@cf/google/gemma-4-26b-a4b-it", attempts: 2, timeoutMs: 0 },
];

/** Backoff between two attempts at the same model. */
const BACKOFF_MS = [1500];

interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reach the Workers AI binding without letting a missing binding throw. */
async function getAiBinding(): Promise<WorkersAiBinding | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx.env as unknown as { AI?: WorkersAiBinding };
    return env.AI ?? null;
  } catch {
    return null;
  }
}

/** The OpenRouter key, when the operator has deployed one. */
async function getOpenRouterKey(): Promise<string | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx.env as unknown as { OPENROUTER_API_KEY?: string };
    return env.OPENROUTER_API_KEY ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask OpenRouter for a completion, giving up after `timeoutMs`.
 *
 * A free tier can hang rather than refuse. Without a deadline one slow candidate
 * would spend the whole request and the fallbacks behind it would never be
 * reached, which is the opposite of what a chain is for.
 */
async function callOpenRouter(
  model: string,
  prompt: string,
  key: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "أجب بـ JSON فقط دون أي نص إضافي." },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
      }),
    });
    const body = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(body).slice(0, 140)}`);
    }
    return extractText(body);
  } finally {
    clearTimeout(timer);
  }
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "الطلب ليس JSON صالحًا." }, { status: 400 });
  }

  const sourceText = readString(body.sourceText).trim();
  const derivedText = readString(body.derivedText).trim();

  // The derived text is optional: a source-only run is allowed, and the engine
  // reports the absent transmission honestly instead of refusing the request.
  // The source, by contrast, is required — there is no audit without it — and a
  // missing source is named on its own, not as one of two missing texts.
  if (!sourceText) {
    return NextResponse.json(
      { ok: false, error: "النص الأصلي مطلوب." },
      { status: 400 },
    );
  }

  const input: AuditInput = {
    sourceText,
    derivedText,
    workType: (readString(body.workType, "translate") as WorkType) ?? "translate",
    contentLevel: (readString(body.contentLevel, "B") as ContentLevel) ?? "B",
    targetLanguage: readString(body.targetLanguage, "en"),
    bank: buildConstraintBank(),
    reviewerDecision: readString(body.reviewerDecision) || null,
  };

  const binding = await getAiBinding();
  const openRouterKey = await getOpenRouterKey();
  let semantic: SemanticProvider;

  if (binding || openRouterKey) {
    semantic = modelProvider(async (prompt) => {
      const promptHash = await sha256Hex(prompt);
      const attempts: string[] = [];
      let lastError: unknown = null;

      for (const entry of CHAIN) {
        // A candidate whose provider is not configured in this environment is
        // skipped rather than attempted, so a chain richer than the deployment
        // still runs on what the deployment has.
        if (entry.provider === "workers-ai" && !binding) continue;
        if (entry.provider === "openrouter" && !openRouterKey) continue;

        for (let attempt = 0; attempt < entry.attempts; attempt++) {
          try {
            const raw =
              entry.provider === "openrouter"
                ? await callOpenRouter(entry.model, prompt, openRouterKey as string, entry.timeoutMs)
                : extractText(
                    await (binding as WorkersAiBinding).run(entry.model, {
                      messages: [
                        { role: "system", content: "أجب بـ JSON فقط دون أي نص إضافي." },
                        { role: "user", content: prompt },
                      ],
                      // A reasoning model bills its thinking against this
                      // ceiling, so a tight budget returns finish_reason
                      // "length" with empty content.
                      max_tokens: 2048,
                    }),
                  );

            // HTTP-level success with empty content is a failure, not a result:
            // routing it on would make the operator think the model answered.
            if (raw.trim().length === 0) {
              attempts.push(`${entry.model}: رد فارغ`);
              lastError = new Error(`${entry.model} أعاد ردًا فارغًا`);
              continue;
            }

            attempts.push(`${entry.model}: نجح في المحاولة ${attempt + 1}`);
            console.log(
              `audit L3 answered by ${entry.model} (${entry.provider}) — ${attempts.join(" | ")}`,
            );
            return { raw, model: entry.model, promptHash };
          } catch (error) {
            lastError = error;
            const detail = error instanceof Error ? error.message : String(error);
            attempts.push(`${entry.model}: ${detail.slice(0, 80)}`);
            if (attempt < entry.attempts - 1) await sleep(BACKOFF_MS[attempt] ?? 1500);
          }
        }
      }

      // Every candidate and every attempt failed. The engine turns this into a
      // declared gap, so the verdict states that the semantic layer did not run
      // rather than presenting a deterministic-only result as complete.
      const detail = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `كل النماذج المرشحة فشلت (${CHAIN.map((entry) => entry.model).join(", ")}): ${detail}. المحاولات: ${attempts.join(" | ")}`,
      );
    });
  } else {
    semantic = declaredGapProvider(
      "الطبقة الدلالية لم تُشغَّل: لا ربط النموذج (AI binding) ولا مفتاح مزوّد خارجي متاح في هذه البيئة. ما كان يمكن كشفه بالاستدلال الدلالي غير مفحوص.",
    );
  }

  try {
    // The prompt hash is computed even on the declared-gap path, so the record
    // always names the prompt that would have been used.
    void buildSemanticPrompt({
      source: input.sourceText,
      derived: input.derivedText,
      language: input.targetLanguage,
      level: input.contentLevel,
      bank: input.bank,
    });

    const { result, record, rejected, alignment } = await runAudit(input, { semantic });
    return NextResponse.json({ ok: true, result, record, rejected, alignment });
  } catch (error) {
    console.error("audit route failed", error);
    return NextResponse.json({ ok: false, error: "فشل تنفيذ الفحص على الخادم." }, { status: 500 });
  }
}

/**
 * Read the answer out of a Workers AI reply.
 *
 * The shape differs by model family: `response` for the text-generation models,
 * and an OpenAI-style `choices[0].message.content` for the chat ones. The
 * reasoning stream is ignored on purpose — it is not the answer.
 */
function extractText(response: unknown): string {
  if (typeof response === "string") return response;
  if (response && typeof response === "object") {
    const r = response as {
      response?: unknown;
      result?: unknown;
      choices?: { message?: { content?: unknown } }[];
    };
    if (typeof r.response === "string") return r.response;
    if (typeof r.result === "string") return r.result;

    const content = r.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
  }
  return "";
}
