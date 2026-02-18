import type { Context } from "@mariozechner/pi-ai";
import { completeSimple } from "@mariozechner/pi-ai";
import type { LlmTokenUsage } from "../types.js";
import { normalizeTokenUsage } from "../usage.js";
import { resolveQwenModel } from "./models.js";
import { extractText } from "./shared.js";

export async function completeQwenText({
  modelId,
  accessToken,
  context,
  temperature,
  maxOutputTokens,
  signal,
  qwenBaseUrlOverride,
}: {
  modelId: string;
  accessToken: string;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  qwenBaseUrlOverride?: string | null;
}): Promise<{ text: string; usage: LlmTokenUsage | null }> {
  const model = resolveQwenModel({
    modelId,
    context,
    qwenBaseUrlOverride,
  });
  const result = await completeSimple(model, context, {
    ...(typeof temperature === "number" ? { temperature } : {}),
    ...(typeof maxOutputTokens === "number" ? { maxTokens: maxOutputTokens } : {}),
    apiKey: accessToken,
    signal,
  });
  const text = extractText(result);
  if (!text) throw new Error(`LLM returned an empty summary (model qwen/${modelId}).`);
  return { text, usage: normalizeTokenUsage(result.usage) };
}
