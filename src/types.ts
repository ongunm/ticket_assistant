/** Shared type definitions used across main + renderer */

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

/** IPC channel names */
export const IPC = {
  CREATE_TICKET: "ticket:create",
  GET_TICKETS: "ticket:getAll",
  GET_TICKET: "ticket:get",
  TOGGLE_DONE: "ticket:toggleDone",
  DELETE_TICKET: "ticket:delete",
  SEND_MESSAGE: "ticket:sendMessage",
  GET_CHAT: "ticket:getChat",
  EXPAND_TICKET: "ticket:expand",
} as const;
