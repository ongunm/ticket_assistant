import { app, BrowserWindow, Tray, ipcMain, nativeImage, screen } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { v4 as uuidv4 } from "uuid";
import * as storage from "./storage";
import * as ai from "./openai-client";
import { createTrayIconPNG, createTrayIconPNG16 } from "./icon";

// ─── Globals ───────────────────────────────────────────────────────
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

const DIST = path.join(__dirname, "../dist");
const PRELOAD = path.join(__dirname, "preload.js");
const isDev = !app.isPackaged;

// ─── Window creation ───────────────────────────────────────────────
const DRAWER_WIDTH = 340;
const EXPANDED_WIDTH = 860;
const WINDOW_HEIGHT = 620;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: DRAWER_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Use VITE_DEV_SERVER_URL if available (set by some setups), else try common ports
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  if (isDev) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(DIST, "index.html"));
  }

  // Hide when clicking anywhere else on the screen.
  // The 300ms grace period prevents GNOME's tray-click focus-steal
  // from immediately hiding the window on the same click that opened it.
  let showTime = 0;
  const origShow = win.show.bind(win);
  win.show = (...args: Parameters<typeof win.show>) => {
    showTime = Date.now();
    return origShow(...args);
  };
  win.on("blur", () => {
    if (Date.now() - showTime > 300) {
      win.hide();
    }
  });

  return win;
}

// ─── Position window near tray icon ────────────────────────────────
function positionWindow(win: BrowserWindow, clickBounds?: Electron.Rectangle): void {
  const trayBounds = clickBounds ?? tray?.getBounds() ?? { x: 0, y: 0, width: 0, height: 0 };
  const winBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });

  let x: number;
  let y: number;

  if (process.platform === "darwin") {
    // macOS: center under tray icon
    x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
    y = Math.round(trayBounds.y + trayBounds.height + 4);
  } else {
    // Linux: position near top-right, accounting for panel position
    const workArea = display.workArea;
    // If tray is at top (y near 0), place below
    if (trayBounds.y < workArea.height / 2) {
      x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
      y = Math.round(trayBounds.y + trayBounds.height + 4);
    } else {
      // tray at bottom
      x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
      y = Math.round(trayBounds.y - winBounds.height - 4);
    }

    // Fallback: if bounds are all zeros (common on some Linux DEs)
    if (trayBounds.x === 0 && trayBounds.y === 0 && trayBounds.width === 0) {
      x = workArea.x + workArea.width - winBounds.width - 8;
      y = workArea.y + 8;
    }
  }

  // Clamp to screen
  const area = display.workArea;
  x = Math.max(area.x, Math.min(x!, area.x + area.width - winBounds.width));
  y = Math.max(area.y, Math.min(y!, area.y + area.height - winBounds.height));

  win.setPosition(x, y, false);
}

// ─── Toggle drawer visibility ──────────────────────────────────────
function toggleWindow(trayBounds?: Electron.Rectangle): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    positionWindow(mainWindow, trayBounds);
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─── Create tray icon ──────────────────────────────────────────────

function getTrayIconPath(): string {
  const appDir = process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support", "TrayTicketAssistant")
    : path.join(os.homedir(), ".config", "TrayTicketAssistant");
  fs.mkdirSync(appDir, { recursive: true });

  const isMac = process.platform === "darwin";
  const iconFileName = isMac ? "trayIconTemplate.png" : "trayIcon.png";
  const iconPath = path.join(appDir, iconFileName);

  // Generate the PNG and write to disk
  const pngData = isMac ? createTrayIconPNG16(true) : createTrayIconPNG(false);
  fs.writeFileSync(iconPath, pngData);
  console.log("[tray] wrote icon to", iconPath, "size:", pngData.length, "bytes");

  // Also write @2x for macOS retina
  if (isMac) {
    const icon2xPath = path.join(appDir, "trayIconTemplate@2x.png");
    const png2x = createTrayIconPNG(true);
    fs.writeFileSync(icon2xPath, png2x);
  }

  return iconPath;
}

function findSystemIcon(): string | null {
  // Try well-known icon paths on Linux
  const candidates = [
    "/usr/share/icons/hicolor/32x32/apps/fedora-logo-icon.png",
    "/usr/share/icons/hicolor/48x48/apps/fedora-logo-icon.png",
    "/usr/share/icons/hicolor/32x32/apps/firefox.png",
    "/usr/share/icons/hicolor/scalable/apps/utilities-terminal-symbolic.svg",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function createTray(): void {
  console.log("[tray] creating tray icon...");

  let iconPath: string;
  let icon: Electron.NativeImage;

  // First: try our custom icon
  try {
    iconPath = getTrayIconPath();
    icon = nativeImage.createFromPath(iconPath);
    console.log("[tray] loaded custom icon — empty?", icon.isEmpty(), "size:", icon.getSize());

    // If our custom icon is empty/broken, fall back to a system icon
    if (icon.isEmpty()) {
      console.log("[tray] custom icon is empty, trying system icon...");
      const sysIcon = findSystemIcon();
      if (sysIcon) {
        icon = nativeImage.createFromPath(sysIcon);
        iconPath = sysIcon;
        console.log("[tray] using system icon:", sysIcon, "empty?", icon.isEmpty());
      }
    }
  } catch (err) {
    console.error("[tray] error creating icon:", err);
    const sysIcon = findSystemIcon();
    if (sysIcon) {
      icon = nativeImage.createFromPath(sysIcon);
      iconPath = sysIcon;
    } else {
      throw new Error("No usable icon found for tray");
    }
  }

  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  // On Linux, pass the file PATH to Tray (not nativeImage).
  // AppIndicator uses D-Bus and needs a file reference, not pixel data.
  if (process.platform === "linux") {
    console.log("[tray] linux: passing icon PATH to Tray:", iconPath!);
    tray = new Tray(iconPath!);
  } else {
    console.log("[tray] non-linux: passing nativeImage to Tray");
    tray = new Tray(icon);
  }
  tray.setToolTip("Tray Ticket Assistant");
  console.log("[tray] Tray created successfully");

  // DO NOT use setContextMenu — on GNOME AppIndicator, it hijacks
  // left-click so BOTH left and right click open the menu.
  // Instead: left-click = toggle window.  Quit lives in the window titlebar.
  tray.on("click", (_event, bounds) => {
    console.log("[tray] click, toggling window");
    toggleWindow(bounds);
  });

  console.log("[tray] tray is ready");
}

// ─── IPC handlers ──────────────────────────────────────────────────

// Window resizing: expand/collapse when side panel opens/closes
ipcMain.handle("window:expand", async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, width: EXPANDED_WIDTH }, true);
  }
});

ipcMain.handle("window:collapse", async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, width: DRAWER_WIDTH }, true);
  }
});

ipcMain.handle("app:quit", async () => {
  app.quit();
});

ipcMain.handle("ticket:create", async (_event, rawText: string) => {
  const now = new Date().toISOString();
  const ticket: storage.Ticket = {
    id: uuidv4(),
    title: rawText.slice(0, 80).replace(/\n/g, " "),
    rawTicket: rawText,
    clarifications: [],
    roadblocks: [],
    details: [],
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  storage.createTicket(ticket);

  // Auto-expand via GPT in background (don't block creation)
  expandTicketAsync(ticket.id, rawText);

  return ticket;
});

ipcMain.handle("ticket:getAll", async () => {
  const index = storage.readIndex();
  return index.tickets;
});

ipcMain.handle("ticket:get", async (_event, ticketId: string) => {
  return storage.getTicket(ticketId);
});

ipcMain.handle("ticket:toggleDone", async (_event, ticketId: string, done: boolean) => {
  return storage.toggleDone(ticketId, done);
});

ipcMain.handle("ticket:delete", async (_event, ticketId: string) => {
  return storage.deleteTicket(ticketId);
});

ipcMain.handle("ticket:getChat", async (_event, ticketId: string) => {
  return storage.readChat(ticketId);
});

ipcMain.handle("ticket:sendMessage", async (_event, ticketId: string, text: string) => {
  const ticket = storage.getTicket(ticketId);
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  // Save user message
  const userMsg: storage.ChatMessage = {
    role: "user",
    content: text,
    timestamp: new Date().toISOString(),
  };
  storage.appendChat(ticketId, userMsg);

  // Get chat history
  const history = storage.readChat(ticketId);

  try {
    // Log prompt
    storage.appendPromptLog(ticketId, {
      type: "chat",
      userMessage: text,
      historyLength: history.length,
    });

    const result = await ai.chatWithTicket(
      ticket.rawTicket,
      ticket.clarifications,
      ticket.roadblocks,
      ticket.details,
      history,
      text
    );

    // Save assistant reply
    const assistantMsg: storage.ChatMessage = {
      role: "assistant",
      content: result.reply,
      timestamp: new Date().toISOString(),
    };
    storage.appendChat(ticketId, assistantMsg);
    storage.appendResponseLog(ticketId, result);

    // Update ticket fields if model returned them
    const updates: Partial<storage.Ticket> = {};
    if (result.clarifications) updates.clarifications = result.clarifications;
    if (result.roadblocks) updates.roadblocks = result.roadblocks;
    if (result.details) updates.details = result.details;
    if (Object.keys(updates).length > 0) {
      storage.updateTicket(ticketId, updates);
    }

    return {
      reply: result.reply,
      updatedTicket: storage.getTicket(ticketId),
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    storage.appendResponseLog(ticketId, { error: errMsg });

    // Save error as system message in chat
    const errorMsg: storage.ChatMessage = {
      role: "system",
      content: `Error: ${errMsg}`,
      timestamp: new Date().toISOString(),
    };
    storage.appendChat(ticketId, errorMsg);

    return {
      reply: `Could not get a response: ${errMsg}`,
      updatedTicket: storage.getTicket(ticketId),
      error: true,
    };
  }
});

ipcMain.handle("ticket:expand", async (_event, ticketId: string) => {
  const ticket = storage.getTicket(ticketId);
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
  return expandTicketAsync(ticketId, ticket.rawTicket);
});

// ─── Background GPT expansion ──────────────────────────────────────

async function expandTicketAsync(ticketId: string, rawText: string): Promise<storage.Ticket | undefined> {
  try {
    storage.appendPromptLog(ticketId, { type: "expand", rawText });
    const result = await ai.expandTicket(rawText);
    storage.appendResponseLog(ticketId, result);

    const updated = storage.updateTicket(ticketId, {
      clarifications: result.clarifications,
      roadblocks: result.roadblocks,
      details: result.details,
    });

    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("ticket:updated", updated);
    }

    return updated;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to expand ticket:", errMsg);
    storage.appendResponseLog(ticketId, { error: errMsg });

    // Notify renderer of error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("ticket:expandError", { ticketId, error: errMsg });
    }
    return undefined;
  }
}

// ─── App lifecycle ─────────────────────────────────────────────────

// Hide from dock on macOS — this is a tray-only app
if (process.platform === "darwin") {
  app.dock?.hide();
}

// Prevent the app from quitting when all windows close
app.on("window-all-closed", () => {
  // Don't quit — this is a tray app, keep running
});

console.log("[app] starting, platform:", process.platform, "electron:", process.versions.electron);

app.whenReady().then(() => {
  console.log("[app] ready");
  try {
    createTray();
  } catch (err) {
    console.error("[app] FATAL: failed to create tray:", err);
  }

  // Pre-create the window (hidden) so first tray click is instant
  mainWindow = createWindow();
  console.log("[app] window created (hidden)");
});

app.on("before-quit", () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
