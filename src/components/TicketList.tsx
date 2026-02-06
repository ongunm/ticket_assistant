import type { Ticket } from "../types";

interface Props {
  tickets: Ticket[];
  selectedId: string | null;
  expandingIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TicketList({
  tickets,
  selectedId,
  expandingIds,
  onSelect,
  onToggleDone,
}: Props) {
  if (tickets.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <span className="empty-state-title">No open tickets</span>
        <span className="empty-state-sub">Add one below to get started</span>
      </div>
    );
  }

  return (
    <>
      {tickets.map((ticket) => {
        const isExpanding = expandingIds.has(ticket.id);
        const itemCount = ticket.clarifications.length + ticket.roadblocks.length + ticket.details.length;
        const hasContent = itemCount > 0;

        return (
          <div
            key={ticket.id}
            className={`ticket-item ${selectedId === ticket.id ? "active" : ""}`}
            onClick={() => onSelect(ticket.id)}
            onMouseEnter={() => onSelect(ticket.id)}
          >
            <button
              className="ticket-checkbox"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDone(ticket.id, true);
              }}
              title="Mark as done"
            />
            <div className="ticket-info">
              <div className="ticket-title">{ticket.title || ticket.rawTicket.slice(0, 80)}</div>
              <div className="ticket-meta">
                <span>{timeAgo(ticket.createdAt)}</span>
                {isExpanding && (
                  <span className="ticket-badge expanding">
                    <span className="loading-dots">
                      <span></span><span></span><span></span>
                    </span>
                    &nbsp;Expanding
                  </span>
                )}
                {!isExpanding && hasContent && (
                  <span className="ticket-badge">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
