const { app, BrowserWindow, BrowserView, session, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const TOPBAR_H = 48;
const START_URL = "https://bizaki.online";

// важно для Windows (уведомления/апдейтер)
app.setAppUserModelId("online.bizaki.app");

// (опционально) чтобы не спамить ошибками в консоль
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;

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

  mainWindow = win;

  // Разрешаем микрофон/камера
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    if (permission === "media" || permission === "microphone" || permission === "camera") {
      return callback(true);
    }
    callback(false);
  });

  // ----- Topbar view -----
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

  // ----- Content view -----
  const contentView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.addBrowserView(contentView);
  contentView.setAutoResize({ width: true, height: true });
  contentView.webContents.loadURL(START_URL);

  const layout = () => {
    const [w, h] = win.getContentSize();
    topView.setBounds({ x: 0, y: 0, width: w, height: TOPBAR_H });
    contentView.setBounds({ x: 0, y: TOPBAR_H, width: w, height: Math.max(0, h - TOPBAR_H) });
  };

  win.on("resize", layout);

  win.on("maximize", () => topView.webContents.send("win:maximized", true));
  win.on("unmaximize", () => topView.webContents.send("win:maximized", false));

  layout();

  // команды из topbar
  ipcMain.removeAllListeners("win:min");
  ipcMain.removeAllListeners("win:max");
  ipcMain.removeAllListeners("win:close");

  ipcMain.on("win:min", () => win.minimize());
  ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  ipcMain.on("win:close", () => win.close());
}

function setupAutoUpdate() {
  // Логи полезны, если что-то пойдет не так
  autoUpdater.on("error", (err) => {
    console.log("[updater] error:", err?.message || err);
  });

  autoUpdater.on("checking-for-update", () => console.log("[updater] checking..."));
  autoUpdater.on("update-available", () => console.log("[updater] update available"));
  autoUpdater.on("update-not-available", () => console.log("[updater] no updates"));

  autoUpdater.on("update-downloaded", async () => {
    // маленькое окно-подтверждение
    const res = await dialog.showMessageBox({
      type: "info",
      buttons: ["Перезапустить сейчас", "Позже"],
      defaultId: 0,
      cancelId: 1,
      message: "Обновление скачано. Перезапустить приложение, чтобы установить?",
    });

    if (res.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Проверка обновлений (после старта)
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
