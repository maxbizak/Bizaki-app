const { app, BrowserWindow, BrowserView, session, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");

const TOPBAR_H = 48;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0b0f17",
    frame: false,
    // ✅ Иконка окна/таскбара во время работы
      icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    if (permission === "media" || permission === "microphone" || permission === "camera") {
      return callback(true);
    }
    callback(false);
  });

  const topView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload-topbar.js")
    }
  });

  win.setBrowserView(topView);
  topView.setAutoResize({ width: true });
  topView.webContents.loadFile(path.join(__dirname, "topbar.html"));

  const contentView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  win.addBrowserView(contentView);
  contentView.setAutoResize({ width: true, height: true });
  contentView.webContents.loadURL("https://bizaki.online");

  const layout = () => {
    if (win.isDestroyed()) return;
    const [w, h] = win.getContentSize();

    // Иногда при restore Windows на мгновение отдаёт 0/0 — игнорим этот тик
    if (w <= 0 || h <= 0) return;

    topView.setBounds({ x: 0, y: 0, width: w, height: TOPBAR_H });
    contentView.setBounds({ x: 0, y: TOPBAR_H, width: w, height: Math.max(0, h - TOPBAR_H) });
  };

  // ✅ Основные события изменения размеров
  win.on("resize", layout);

  // ✅ ФИКС: после minimize/restore BrowserView иногда “пропадает”
  const relayoutSoon = () => {
    // 2 тика — самый надёжный вариант на Windows
    setTimeout(layout, 50);
    setTimeout(layout, 150);

    // крайняя мера: переприкрепить view (иногда помогает, если view “отвалился”)
    try {
      win.removeBrowserView(topView);
      win.removeBrowserView(contentView);
    } catch {}
    try {
      win.setBrowserView(topView);
      win.addBrowserView(contentView);
    } catch {}

    setTimeout(layout, 200);
  };

  win.on("restore", relayoutSoon);
  win.on("show", relayoutSoon);
  win.on("focus", () => setTimeout(layout, 50));

  // Для корректной кнопки maximize в topbar
  win.on("maximize", () => topView.webContents.send("win:maximized", true));
  win.on("unmaximize", () => topView.webContents.send("win:maximized", false));

  ipcMain.on("win:min", () => win.minimize());
  ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  ipcMain.on("win:close", () => win.close());

  // ---------- AUTO UPDATE ----------
  log.transports.file.level = "info";
  autoUpdater.logger = log;

  const sendUpdate = (payload) => {
    try {
      topView.webContents.send("update:status", payload);
    } catch {}
  };

  autoUpdater.on("checking-for-update", () => sendUpdate({ state: "checking" }));
  autoUpdater.on("update-available", (info) => sendUpdate({ state: "available", info }));
  autoUpdater.on("update-not-available", (info) => sendUpdate({ state: "none", info }));
  autoUpdater.on("download-progress", (p) =>
    sendUpdate({
      state: "downloading",
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total
    })
  );
  autoUpdater.on("update-downloaded", (info) => sendUpdate({ state: "ready", info }));
  autoUpdater.on("error", (err) =>
    sendUpdate({ state: "error", message: err?.message || String(err) })
  );

  ipcMain.on("update:install", () => {
    autoUpdater.quitAndInstall();
  });

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 6 * 60 * 60 * 1000);
  } else {
    sendUpdate({ state: "dev", message: "Auto-update disabled (not packaged)" });
  }
  // -------------------------------

  layout();
}

app.setAppUserModelId("online.bizaki.app");

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
