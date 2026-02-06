/// <reference types="vite/client" />

interface ElectronAPI {
  createTicket: (rawText: string) => Promise<import("./types").Ticket>;
  getTickets: () => Promise<import("./types").Ticket[]>;
  getTicket: (ticketId: string) => Promise<import("./types").Ticket | undefined>;
  toggleDone: (ticketId: string, done: boolean) => Promise<import("./types").Ticket>;
  deleteTicket: (ticketId: string) => Promise<boolean>;
  sendMessage: (ticketId: string, text: string) => Promise<{
    reply: string;
    updatedTicket: import("./types").Ticket;
    error?: boolean;
  }>;
  getChat: (ticketId: string) => Promise<import("./types").ChatMessage[]>;
  expandTicket: (ticketId: string) => Promise<import("./types").Ticket>;
  windowExpand: () => Promise<void>;
  windowCollapse: () => Promise<void>;
  quit: () => Promise<void>;
}

interface Window {
  electronAPI: ElectronAPI;
}
