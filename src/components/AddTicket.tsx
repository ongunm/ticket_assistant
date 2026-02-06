import { useState } from "react";

interface Props {
  onAdd: (rawText: string) => Promise<void>;
}

export default function AddTicket({ onAdd }: Props) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAdd(trimmed);
      setText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="add-ticket-section">
      <textarea
        className="add-ticket-textarea"
        placeholder="Paste a ticket description..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
      />
      <button
        className="add-ticket-btn"
        onClick={handleSubmit}
        disabled={!text.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span className="loading-dots" style={{ marginRight: 6 }}>
              <span></span><span></span><span></span>
            </span>
            Adding...
          </>
        ) : (
          "Add Ticket"
        )}
      </button>
    </div>
  );
}
