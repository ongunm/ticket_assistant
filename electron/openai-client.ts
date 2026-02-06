import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import type { ChatMessage } from "./storage";

// ─── Zod schemas for strict validation ─────────────────────────────

export const ExpandResultSchema = z.object({
  clarifications: z.array(z.string()),
  roadblocks: z.array(z.string()),
  details: z.array(z.string()),
});

export type ExpandResult = z.infer<typeof ExpandResultSchema>;

export const ChatResultSchema = z.object({
  clarifications: z.array(z.string()).optional(),
  roadblocks: z.array(z.string()).optional(),
  details: z.array(z.string()).optional(),
  reply: z.string(),
});

export type ChatResult = z.infer<typeof ChatResultSchema>;

// ─── Key loading ───────────────────────────────────────────────────

export function loadOpenAIKey(): string {
  const p = path.join(os.homedir(), "keys", "openaikey.json");
  if (!fs.existsSync(p)) {
    throw new Error(`OpenAI key file not found at ${p}`);
  }
  const raw = fs.readFileSync(p, "utf-8");
  const j = JSON.parse(raw);
  if (!j.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in ~/keys/openaikey.json");
  }
  return j.OPENAI_API_KEY as string;
}

// ─── Client singleton ──────────────────────────────────────────────

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI {
  if (!clientInstance) {
    const apiKey = loadOpenAIKey();
    clientInstance = new OpenAI({ apiKey });
  }
  return clientInstance;
}

// ─── Expand ticket (initial creation) ──────────────────────────────

const EXPAND_SYSTEM_PROMPT = `You are a ticket analysis assistant. Given a raw ticket description, analyze it and return ONLY valid JSON (no markdown, no code fences) with these exact keys:
- "clarifications": an array of clarifying questions that should be asked
- "roadblocks": an array of potential roadblocks or risks
- "details": an array of coarse implementation steps with necessary details

Be thorough but concise. Return 3-8 items per category.`;

export async function expandTicket(rawTicket: string): Promise<ExpandResult> {
  const client = getClient();

  const response = await client.responses.create({
    model: "gpt-5.2",
    input: [
      { role: "system", content: EXPAND_SYSTEM_PROMPT },
      { role: "user", content: rawTicket },
    ],
  });

  const text = response.output_text;

  // Try to parse and validate
  const parsed = JSON.parse(text);
  return ExpandResultSchema.parse(parsed);
}

// ─── Chat follow-up ───────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are a helpful ticket assistant. You are discussing a specific ticket with the user.
You have access to the ticket's current state (raw text, clarifications, roadblocks, details) and chat history.

When responding, return ONLY valid JSON (no markdown, no code fences) with these keys:
- "reply": your text response to the user
- "clarifications": (optional) updated array of clarifications if the conversation warrants changes
- "roadblocks": (optional) updated array of roadblocks if the conversation warrants changes
- "details": (optional) updated array of details/steps if the conversation warrants changes

Only include clarifications/roadblocks/details if they should be REPLACED with new values. Omit them to keep current values.`;

const MAX_CHAT_HISTORY = 40; // messages to include for context

export async function chatWithTicket(
  rawTicket: string,
  clarifications: string[],
  roadblocks: string[],
  details: string[],
  chatHistory: ChatMessage[],
  userMessage: string
): Promise<ChatResult> {
  const client = getClient();

  // Build context
  const ticketContext = `
## Current Ticket
${rawTicket}

## Current Clarifications
${clarifications.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## Current Roadblocks
${roadblocks.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## Current Details/Steps
${details.map((d, i) => `${i + 1}. ${d}`).join("\n")}
`.trim();

  // Trim chat history to last N messages
  const recentHistory = chatHistory.slice(-MAX_CHAT_HISTORY);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    { role: "user", content: `Here is the ticket context:\n\n${ticketContext}` },
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const response = await client.responses.create({
    model: "gpt-5.2",
    input: messages,
  });

  const text = response.output_text;
  const parsed = JSON.parse(text);
  return ChatResultSchema.parse(parsed);
}
