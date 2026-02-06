# Tray Ticket Assistant

A cross-platform tray app that helps you break down and manage work tickets using GPT-5.2.

Click the system tray icon to open a ticket drawer. Paste a ticket description, and the AI automatically expands it into clarifications, potential roadblocks, and actionable steps. Each ticket has its own chat thread for follow-up questions.

## Features

- **Tray icon** — lives in your system tray / menu bar, one click to open
- **AI ticket expansion** — GPT-5.2 analyzes tickets into clarifications, roadblocks, and detailed steps
- **Per-ticket chat** — ask follow-up questions scoped to each ticket
- **Persistent memory** — all ticket data, chat history, prompts, and responses saved to disk
- **Done tracking** — mark tickets complete, reopen anytime
- **Hover preview** — hover over a ticket to see its details panel

## Tech Stack

- **Electron** — desktop app framework (macOS, Linux, Windows)
- **React 19** — UI renderer
- **TypeScript** — type safety across main and renderer processes
- **Vite** — fast dev server and bundler
- **OpenAI Node SDK** — GPT-5.2 API calls with Zod schema validation
- **File-based storage** — JSON/JSONL files in `~/.tray-ticket-assistant/`

## Setup

```bash
npm install
```

Place your OpenAI API key at `~/keys/openaikey.json`:

```json
{ "key": "sk-..." }
```

## Development

```bash
npm run dev
```

This runs Vite (React), TypeScript watcher (Electron), and the Electron app concurrently.

## Build

```bash
npm run package
```

Produces a distributable app via electron-builder.

## Data Storage

All ticket data is stored outside the project in `~/.tray-ticket-assistant/`:

```
~/.tray-ticket-assistant/
├── tickets.json          # ticket index
└── tickets/
    └── <ticket-id>/
        ├── state.json    # title, clarifications, roadblocks, details, status
        ├── chat.jsonl    # chat message history
        ├── prompts.jsonl # all prompts sent to the AI
        └── responses.jsonl # all AI responses
```
