import { useState, useRef, useEffect } from "react";
import type { Ticket, ChatMessage } from "../types";

interface Props {
  ticket: Ticket;
  chatMessages: ChatMessage[];
  isExpanding: boolean;
  onSendMessage: (ticketId: string, text: string) => Promise<unknown>;
  onRetryExpand: (ticketId: string) => Promise<void>;
  onDelete: (ticketId: string) => Promise<void>;
  onToggleDone: (ticketId: string, done: boolean) => Promise<void>;
  onClose: () => void;
}

export default function TicketSidePanel({
  ticket,
  chatMessages,
  isExpanding,
  onSendMessage,
  onRetryExpand,
  onDelete,
  onToggleDone,
  onClose,
}: Props) {
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setChatInput("");
    try {
      await onSendMessage(ticket.id, trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = ticket.clarifications.length > 0 || ticket.roadblocks.length > 0 || ticket.details.length > 0;

  return (
    <div className="side-panel">
      {/* Header */}
      <div className="side-panel-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <h3 style={{ flex: 1 }}>{ticket.title || "Untitled Ticket"}</h3>
          <button className="close-btn" onClick={onClose} title="Close panel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="11" y2="11" />
              <line x1="11" y1="3" x2="3" y2="11" />
            </svg>
          </button>
        </div>
        {ticket.rawTicket !== ticket.title && (
          <div className="raw-ticket">{ticket.rawTicket}</div>
        )}
        <div className="side-panel-actions">
          <button
            className="action-btn accent"
            onClick={() => onRetryExpand(ticket.id)}
            disabled={isExpanding}
          >
            {isExpanding ? "Expanding..." : "Re-expand"}
          </button>
          <button
            className="action-btn"
            onClick={() => onToggleDone(ticket.id, ticket.status !== "done")}
          >
            {ticket.status === "done" ? "Reopen" : "Mark Done"}
          </button>
          <button className="action-btn danger" onClick={() => onDelete(ticket.id)}>
            Delete
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="side-panel-scroll">
        {isExpanding && !hasContent && (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <div className="loading-dots" style={{ justifyContent: "center", display: "flex" }}>
              <span></span><span></span><span></span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "12px" }}>
              Analyzing ticket...
            </p>
          </div>
        )}

        {/* Clarifications */}
        <div className="section clarifications">
          <div className="section-title">
            <span className="section-icon">&#10067;</span>
            Clarifications
          </div>
          {ticket.clarifications.length > 0 ? (
            <ul className="section-list">
              {ticket.clarifications.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            !isExpanding && <div className="section-empty">No clarifications yet</div>
          )}
        </div>

        {/* Roadblocks */}
        <div className="section roadblocks">
          <div className="section-title">
            <span className="section-icon">&#9888;</span>
            Potential Roadblocks
          </div>
          {ticket.roadblocks.length > 0 ? (
            <ul className="section-list">
              {ticket.roadblocks.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            !isExpanding && <div className="section-empty">No roadblocks identified</div>
          )}
        </div>

        {/* Details */}
        <div className="section details">
          <div className="section-title">
            <span className="section-icon">&#128221;</span>
            Details &amp; Steps
          </div>
          {ticket.details.length > 0 ? (
            <ol className="section-list">
              {ticket.details.map((item, i) => (
                <li key={i}>
                  <strong>{i + 1}.</strong> {item}
                </li>
              ))}
            </ol>
          ) : (
            !isExpanding && <div className="section-empty">No details yet</div>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="chat-section">
        <div className="chat-header">Chat</div>
        <div className="chat-messages">
          {chatMessages.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "12px", textAlign: "center", padding: "16px 12px" }}>
              Ask questions or discuss this ticket...
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {isSending && (
            <div className="chat-msg assistant" style={{ opacity: 0.6 }}>
              <div className="loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            rows={1}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!chatInput.trim() || isSending}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
