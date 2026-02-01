const { app, BrowserWindow, BrowserView, session, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

// + добавляем логирование
const log = require("electron-log");

const TOPBAR_H = 48;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#0b0f17",
        frame: false,
        webPreferences: {
            contextIsolation: true,
            sandbox: true,
        },
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
            preload: path.join(__dirname, "preload-topbar.js"),
        },
    });

    win.setBrowserView(topView);
    topView.setAutoResize({ width: true });
    topView.webContents.loadFile(path.join(__dirname, "topbar.html"));

    const contentView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            sandbox: true,
        },
    });

    win.addBrowserView(contentView);
    contentView.setAutoResize({ width: true, height: true });
    contentView.webContents.loadURL("https://bizaki.online");

    const layout = () => {
        const [w, h] = win.getContentSize();
        topView.setBounds({ x: 0, y: 0, width: w, height: TOPBAR_H });
        contentView.setBounds({ x: 0, y: TOPBAR_H, width: w, height: h - TOPBAR_H });
    };

    win.on("resize", layout);
    win.on("maximize", () => topView.webContents.send("win:maximized", true));
    win.on("unmaximize", () => topView.webContents.send("win:maximized", false));

    ipcMain.on("win:min", () => win.minimize());
    ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
    ipcMain.on("win:close", () => win.close());

    // ---------- AUTO UPDATE (prod-ready) ----------
    // Логи автоапдейта в файл: %APPDATA%/<app name>/logs/...
    log.transports.file.level = "info";
    autoUpdater.logger = log;

    // Чтобы UI мог показывать статус обновлений:
    const sendUpdate = (payload) => {
        try {
            topView.webContents.send("update:status", payload);
        } catch { }
    };

    autoUpdater.on("checking-for-update", () => sendUpdate({ state: "checking" }));
    autoUpdater.on("update-available", (info) => sendUpdate({ state: "available", info }));
    autoUpdater.on("update-not-available", (info) => sendUpdate({ state: "none", info }));
    autoUpdater.on("error", (err) =>
        sendUpdate({ state: "error", message: err?.message || String(err) })
    );

    // В некоторых окружениях download-progress может вести себя нестабильно,
    // но мы всё равно слушаем и используем, где доступно.
    autoUpdater.on("download-progress", (p) =>
        sendUpdate({
            state: "downloading",
            percent: p.percent,
            bytesPerSecond: p.bytesPerSecond,
            transferred: p.transferred,
            total: p.total,
        })
    );

    autoUpdater.on("update-downloaded", (info) => sendUpdate({ state: "ready", info }));

    // Команда из UI: “Установить и перезапустить”
    ipcMain.on("update:install", () => {
        // quitAndInstall — стандартный финальный шаг для electron-updater
        autoUpdater.quitAndInstall();
    });

    // Важно: чекать обновления только в packaged (в dev это ожидаемо не работает)
    // checkForUpdatesAndNotify в dev обычно скипается — это норм. :contentReference[oaicite:1]{index=1}
    if (app.isPackaged) {
        // 1) при старте
        autoUpdater.checkForUpdatesAndNotify().catch(() => { });

        // 2) периодически, чтобы юзер не ждал рестарта
        setInterval(() => {
            autoUpdater.checkForUpdates().catch(() => { });
        }, 6 * 60 * 60 * 1000); // 6 часов
    } else {
        sendUpdate({ state: "dev", message: "Auto-update disabled (not packaged)" });
    }
    // --------------------------------------------

    layout();
}

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
