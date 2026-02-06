import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  createTicket: (rawText: string) => Promise<unknown>;
  getTickets: () => Promise<unknown>;
  getTicket: (ticketId: string) => Promise<unknown>;
  toggleDone: (ticketId: string, done: boolean) => Promise<unknown>;
  deleteTicket: (ticketId: string) => Promise<unknown>;
  sendMessage: (ticketId: string, text: string) => Promise<unknown>;
  getChat: (ticketId: string) => Promise<unknown>;
  expandTicket: (ticketId: string) => Promise<unknown>;
  windowExpand: () => Promise<void>;
  windowCollapse: () => Promise<void>;
  quit: () => Promise<void>;
}

contextBridge.exposeInMainWorld("electronAPI", {
  createTicket: (rawText: string) => ipcRenderer.invoke("ticket:create", rawText),
  getTickets: () => ipcRenderer.invoke("ticket:getAll"),
  getTicket: (ticketId: string) => ipcRenderer.invoke("ticket:get", ticketId),
  toggleDone: (ticketId: string, done: boolean) => ipcRenderer.invoke("ticket:toggleDone", ticketId, done),
  deleteTicket: (ticketId: string) => ipcRenderer.invoke("ticket:delete", ticketId),
  sendMessage: (ticketId: string, text: string) => ipcRenderer.invoke("ticket:sendMessage", ticketId, text),
  getChat: (ticketId: string) => ipcRenderer.invoke("ticket:getChat", ticketId),
  expandTicket: (ticketId: string) => ipcRenderer.invoke("ticket:expand", ticketId),
  windowExpand: () => ipcRenderer.invoke("window:expand"),
  windowCollapse: () => ipcRenderer.invoke("window:collapse"),
  quit: () => ipcRenderer.invoke("app:quit"),
} satisfies ElectronAPI);
