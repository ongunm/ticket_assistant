import { useState } from "react";
import type { Ticket } from "../types";

interface Props {
  tickets: Ticket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
}

export default function DoneSection({ tickets, selectedId, onSelect, onToggleDone }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (tickets.length === 0) return null;

  return (
    <div className="done-section">
      <button className="done-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="done-header-left">
          <span className={`done-chevron ${isOpen ? "open" : ""}`}>&#9654;</span>
          <span>Done</span>
        </div>
        <span className="done-count">{tickets.length}</span>
      </button>

      {isOpen && (
        <div className="done-list">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`ticket-item ${selectedId === ticket.id ? "active" : ""}`}
              onClick={() => onSelect(ticket.id)}
              onMouseEnter={() => onSelect(ticket.id)}
            >
              <button
                className="ticket-checkbox done"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDone(ticket.id, false);
                }}
                title="Mark as open"
              />
              <div className="ticket-info">
                <div className="ticket-title">
                  {ticket.title || ticket.rawTicket.slice(0, 80)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
