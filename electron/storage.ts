import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── Types (duplicated to avoid import issues in Electron main) ────
export type TicketStatus = "open" | "done";

export interface Ticket {
  id: string;
  title: string;
  rawTicket: string;
  clarifications: string[];
  roadblocks: string[];
  details: string[];
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface TicketIndex {
  tickets: Ticket[];
}

// ─── Paths ─────────────────────────────────────────────────────────
function getAppDataDir(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "TrayTicketAssistant");
  }
  return path.join(os.homedir(), ".config", "TrayTicketAssistant");
}

const APP_DIR = getAppDataDir();
const TICKETS_INDEX = path.join(APP_DIR, "tickets.json");
const TICKETS_DIR = path.join(APP_DIR, "tickets");

// ─── Ensure dirs ───────────────────────────────────────────────────
function ensureDirs(): void {
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.mkdirSync(TICKETS_DIR, { recursive: true });
}

function ensureTicketDir(ticketId: string): string {
  const dir = path.join(TICKETS_DIR, ticketId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Ticket index ──────────────────────────────────────────────────
export function readIndex(): TicketIndex {
  ensureDirs();
  if (!fs.existsSync(TICKETS_INDEX)) {
    const empty: TicketIndex = { tickets: [] };
    fs.writeFileSync(TICKETS_INDEX, JSON.stringify(empty, null, 2), "utf-8");
    return empty;
  }
  const raw = fs.readFileSync(TICKETS_INDEX, "utf-8");
  return JSON.parse(raw) as TicketIndex;
}

function writeIndex(index: TicketIndex): void {
  ensureDirs();
  fs.writeFileSync(TICKETS_INDEX, JSON.stringify(index, null, 2), "utf-8");
}

// ─── CRUD ──────────────────────────────────────────────────────────
export function createTicket(ticket: Ticket): void {
  const index = readIndex();
  index.tickets.push(ticket);
  writeIndex(index);

  // Per-ticket state
  const dir = ensureTicketDir(ticket.id);
  const state = {
    rawTicket: ticket.rawTicket,
    clarifications: ticket.clarifications,
    roadblocks: ticket.roadblocks,
    details: ticket.details,
  };
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
}

export function getTicket(ticketId: string): Ticket | undefined {
  const index = readIndex();
  return index.tickets.find((t) => t.id === ticketId);
}

export function updateTicket(ticketId: string, updates: Partial<Ticket>): Ticket | undefined {
  const index = readIndex();
  const i = index.tickets.findIndex((t) => t.id === ticketId);
  if (i === -1) return undefined;

  index.tickets[i] = {
    ...index.tickets[i],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeIndex(index);

  // Also update per-ticket state.json
  const dir = ensureTicketDir(ticketId);
  const t = index.tickets[i];
  const state = {
    rawTicket: t.rawTicket,
    clarifications: t.clarifications,
    roadblocks: t.roadblocks,
    details: t.details,
  };
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2), "utf-8");

  return index.tickets[i];
}

export function deleteTicket(ticketId: string): boolean {
  const index = readIndex();
  const before = index.tickets.length;
  index.tickets = index.tickets.filter((t) => t.id !== ticketId);
  if (index.tickets.length === before) return false;
  writeIndex(index);

  // Remove ticket directory
  const dir = path.join(TICKETS_DIR, ticketId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return true;
}

export function toggleDone(ticketId: string, done: boolean): Ticket | undefined {
  return updateTicket(ticketId, { status: done ? "done" : "open" });
}

// ─── Chat (JSONL) ──────────────────────────────────────────────────
export function appendChat(ticketId: string, message: ChatMessage): void {
  const dir = ensureTicketDir(ticketId);
  const chatPath = path.join(dir, "chat.jsonl");
  fs.appendFileSync(chatPath, JSON.stringify(message) + "\n", "utf-8");
}

export function readChat(ticketId: string): ChatMessage[] {
  const chatPath = path.join(TICKETS_DIR, ticketId, "chat.jsonl");
  if (!fs.existsSync(chatPath)) return [];
  const raw = fs.readFileSync(chatPath, "utf-8").trim();
  if (!raw) return [];
  return raw.split("\n").map((line) => JSON.parse(line) as ChatMessage);
}

// ─── Prompt / Response logging (JSONL) ─────────────────────────────
export function appendPromptLog(ticketId: string, prompt: unknown): void {
  const dir = ensureTicketDir(ticketId);
  const p = path.join(dir, "prompts.jsonl");
  fs.appendFileSync(p, JSON.stringify({ timestamp: new Date().toISOString(), prompt }) + "\n", "utf-8");
}

export function appendResponseLog(ticketId: string, response: unknown): void {
  const dir = ensureTicketDir(ticketId);
  const p = path.join(dir, "responses.jsonl");
  fs.appendFileSync(p, JSON.stringify({ timestamp: new Date().toISOString(), response }) + "\n", "utf-8");
}
