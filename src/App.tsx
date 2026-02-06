import { useState, useEffect, useCallback } from "react";
import type { Ticket, ChatMessage } from "./types";
import TicketList from "./components/TicketList";
import TicketSidePanel from "./components/TicketSidePanel";
import DoneSection from "./components/DoneSection";
import AddTicket from "./components/AddTicket";

const api = window.electronAPI;

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [expandingIds, setExpandingIds] = useState<Set<string>>(new Set());

  const selectedTicket = tickets.find((t) => t.id === selectedId) || null;
  const showSidePanel = selectedTicket !== null;

  // Expand/collapse window when side panel opens/closes
  useEffect(() => {
    if (showSidePanel) {
      api.windowExpand();
    } else {
      api.windowCollapse();
    }
  }, [showSidePanel]);

  // ─── Clear selection when window is hidden (tray toggle / blur) ─
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden) {
        setSelectedId(null);
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  // ─── Load tickets ──────────────────────────────────────────────
  const loadTickets = useCallback(async () => {
    const all = await api.getTickets();
    setTickets(all);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const interval = setInterval(loadTickets, 3000);
    return () => clearInterval(interval);
  }, [loadTickets]);

  // ─── Load chat when ticket selected ────────────────────────────
  useEffect(() => {
    if (selectedId) {
      api.getChat(selectedId).then(setChatMessages);
    } else {
      setChatMessages([]);
    }
  }, [selectedId]);

  // ─── Handlers ──────────────────────────────────────────────────
  const handleCreateTicket = async (rawText: string) => {
    const ticket = await api.createTicket(rawText);
    setExpandingIds((prev) => new Set(prev).add(ticket.id));
    await loadTickets();
    setSelectedId(ticket.id);

    const pollExpansion = setInterval(async () => {
      const updated = await api.getTicket(ticket.id);
      if (updated && updated.clarifications.length > 0) {
        clearInterval(pollExpansion);
        setExpandingIds((prev) => {
          const next = new Set(prev);
          next.delete(ticket.id);
          return next;
        });
        await loadTickets();
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(pollExpansion);
      setExpandingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }, 60000);
  };

  const handleToggleDone = async (ticketId: string, done: boolean) => {
    await api.toggleDone(ticketId, done);
    await loadTickets();
    if (done && selectedId === ticketId) {
      setSelectedId(null);
    }
  };

  const handleDelete = async (ticketId: string) => {
    await api.deleteTicket(ticketId);
    if (selectedId === ticketId) setSelectedId(null);
    await loadTickets();
  };

  const handleRetryExpand = async (ticketId: string) => {
    setExpandingIds((prev) => new Set(prev).add(ticketId));
    try {
      await api.expandTicket(ticketId);
    } finally {
      setExpandingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
      await loadTickets();
    }
  };

  const handleSendMessage = async (ticketId: string, text: string) => {
    const result = await api.sendMessage(ticketId, text);
    await loadTickets();
    const chat = await api.getChat(ticketId);
    setChatMessages(chat);
    return result;
  };

  const handleCloseSidePanel = () => {
    setSelectedId(null);
  };

  // ─── Derived state ────────────────────────────────────────────
  const openTickets = tickets.filter((t) => t.status === "open");
  const doneTickets = tickets.filter((t) => t.status === "done");

  return (
    <div className={`app-container ${showSidePanel ? "expanded" : ""}`}>
      {/* Ticket List — always visible */}
      <div className="left-panel">
        <div className="titlebar">
          <span className="titlebar-title">Tickets</span>
          <button
            className="quit-btn"
            onClick={() => api.quit()}
            title="Quit"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        </div>

        <div className="ticket-list-header">
          <h2>Open Tickets</h2>
          <span className="ticket-count">{openTickets.length}</span>
        </div>

        <div className="ticket-list-scroll">
          <TicketList
            tickets={openTickets}
            selectedId={selectedId}
            expandingIds={expandingIds}
            onSelect={setSelectedId}
            onToggleDone={handleToggleDone}
          />
        </div>

        <DoneSection
          tickets={doneTickets}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleDone={handleToggleDone}
        />

        <AddTicket onAdd={handleCreateTicket} />
      </div>

      {/* Side Panel — only when a ticket is clicked */}
      {showSidePanel && selectedTicket && (
        <div className="right-panel">
          <TicketSidePanel
            ticket={selectedTicket}
            chatMessages={chatMessages}
            isExpanding={expandingIds.has(selectedTicket.id)}
            onSendMessage={handleSendMessage}
            onRetryExpand={handleRetryExpand}
            onDelete={handleDelete}
            onToggleDone={handleToggleDone}
            onClose={handleCloseSidePanel}
          />
        </div>
      )}
    </div>
  );
}
