// ===== あなたのGAS WebアプリURL =====
const API_URL =
  "https://script.google.com/macros/s/AKfycbwc5xif9jmcMor8L-sA6y1YuQ68U8Rsh8AyfqFJkjGPlAiajCdDgkEV8lYIAUb2OcTwRQ/exec";
// ===================================

const MAX_PAGES = 30;
const MIN_PAGES = 1;

// ローカルキャッシュ用キー
const CACHE_PAGES_KEY = "quickMemoCache";
const CACHE_INDEX_KEY = "quickMemoCurrentPageCache";

// DOM取得
const tabsContainer = document.getElementById("tabs");
const titleInput = document.getElementById("title");
const memoArea = document.getElementById("memo");
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");
const tabAddBtn = document.getElementById("tabAdd");
const tabRemoveBtn = document.getElementById("tabRemove");

// 状態
let pages = [];
let currentPage = 0;
let autosaveTimer = null;
let isSyncing = false; // ★ 初回同期中かどうか

// ---------- モデル ----------
function createEmptyPage() {
  return { title: "", body: "" };
}

function ensurePagesValid(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return [createEmptyPage()];
  }
  return arr.map((p) => ({
    title: typeof p.title === "string" ? p.title : "",
    body: typeof p.body === "string" ? p.body : "",
  }));
}

// ---------- ローカルキャッシュ ----------
function updateLocalCache() {
  try {
    localStorage.setItem(CACHE_PAGES_KEY, JSON.stringify(pages));
    localStorage.setItem(CACHE_INDEX_KEY, String(currentPage));
  } catch (e) {
    console.warn("localStorage への保存に失敗:", e);
  }
}

function loadFromLocalCache() {
  let cachePages = null;
  try {
    cachePages = JSON.parse(localStorage.getItem(CACHE_PAGES_KEY) || "null");
  } catch {
    cachePages = null;
  }

  pages = ensurePagesValid(cachePages);

  const cacheIndexRaw = localStorage.getItem(CACHE_INDEX_KEY);
  const cacheIndex = cacheIndexRaw != null ? parseInt(cacheIndexRaw, 10) : 0;

  if (!Number.isNaN(cacheIndex) && cacheIndex >= 0 && cacheIndex < pages.length) {
    currentPage = cacheIndex;
  } else {
    currentPage = 0;
  }
}

// ---------- 同期中ロック制御（初回のみ使う） ----------
function setSyncing(syncing, message) {
  isSyncing = syncing;

  titleInput.disabled = syncing;
  memoArea.disabled = syncing;
  saveBtn.disabled = syncing;
  tabAddBtn.disabled = syncing;
  tabRemoveBtn.disabled = syncing;

  if (syncing) {
    status.textContent = message || "同期中…";
  } else {
    status.textContent = "";
    saveBtn.textContent = "保存";
  }
}

// ---------- GAS から読み込み（起動時のみ呼ぶ） ----------
async function loadRemoteMemoOnce() {
  try {
    const res = await fetch(API_URL, { cache: "no-cache" });
    const text = await res.text(); // まずテキストで受ける

    let remote;
    try {
      remote = JSON.parse(text);
    } catch (parseErr) {
      console.warn(
        "GASからJSON以外のレスポンスが返っています:",
        text.slice(0, 80)
      );
      status.textContent =
        "オンラインデータ形式エラー。ローカルキャッシュを使用します。";
      setTimeout(() => (status.textContent = ""), 1500);
      return;
    }

    const remotePages = ensurePagesValid(remote.pages);
    let remoteIndex =
      typeof remote.currentPage === "number" ? remote.currentPage : 0;
    if (remoteIndex < 0 || remoteIndex >= remotePages.length) {
      remoteIndex = 0;
    }

    // ローカルと同じなら UI 更新なし
    const localJson = JSON.stringify({ pages, currentPage });
    const remoteJson = JSON.stringify({
      pages: remotePages,
      currentPage: remoteIndex,
    });

    if (localJson === remoteJson) {
      status.textContent = "オンラインとローカルは同じ状態です。";
      setTimeout(() => (status.textContent = ""), 800);
      return;
    }

    // オンラインを採用
    pages = remotePages;
    currentPage = remoteIndex;
    updateLocalCache();

    renderTabs();
    loadPageToUI(currentPage);

    status.textContent = "オンラインデータ同期完了";
    setTimeout(() => (status.textContent = ""), 800);
  } catch (e) {
    console.warn("オンライン読み込みエラー:", e);
    status.textContent =
      "オンライン読み込みに失敗。ローカルキャッシュを使用します。";
    setTimeout(() => (status.textContent = ""), 1500);
  }
}

// ---------- GAS へ保存（常に非ブロッキング） ----------
async function saveRemoteMemo(showMessage = false) {
  // 初回同期中でも保存は飛ばさない（POSTは軽いので許容）
  saveCurrentPageToMemory();
  updateLocalCache();

  const payload = {
    pages,
    currentPage,
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (showMessage) {
      status.textContent = "保存しました（全PC同期）";
      saveBtn.textContent = "保存済み";
      setTimeout(() => {
        status.textContent = "";
        saveBtn.textContent = "保存";
      }, 800);
    }
  } catch (e) {
    console.warn("オンライン保存エラー:", e);
    if (showMessage) {
      status.textContent = "保存失敗（ネットワークエラー）";
      setTimeout(() => (status.textContent = ""), 1500);
    }
  }
}

// ---------- UI ----------
function renderTabs() {
  tabsContainer.innerHTML = "";

  pages.forEach((page, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (index === currentPage ? " active" : "");
    const label =
      page.title && page.title.trim().length > 0
        ? page.title.trim()
        : `ページ ${index + 1}`;
    btn.textContent = label;
    btn.title = label;
    btn.addEventListener("click", () => switchPage(index));
    tabsContainer.appendChild(btn);
  });

  tabRemoveBtn.disabled = pages.length <= MIN_PAGES || isSyncing;
  tabRemoveBtn.style.opacity = tabRemoveBtn.disabled ? 0.5 : 1;
  tabAddBtn.disabled = pages.length >= MAX_PAGES || isSyncing;
}

function loadPageToUI(index) {
  const page = pages[index] || createEmptyPage();
  titleInput.value = page.title || "";
  memoArea.value = page.body || "";
}

function saveCurrentPageToMemory() {
  if (!pages[currentPage]) {
    pages[currentPage] = createEmptyPage();
  }
  pages[currentPage].title = titleInput.value || "";
  pages[currentPage].body = memoArea.value || "";
}

// ---------- ページ操作 ----------
function switchPage(newIndex) {
  if (isSyncing) return; // 初回同期中は触らせない
  if (newIndex === currentPage) return;
  if (newIndex < 0 || newIndex >= pages.length) return;

  saveCurrentPageToMemory();
  currentPage = newIndex;
  renderTabs();
  loadPageToUI(currentPage);
  updateLocalCache();
  // 構造変化だけでも一応同期しておく（非ブロッキング）
  saveRemoteMemo(false);
}

function addPage() {
  if (isSyncing) return;
  if (pages.length >= MAX_PAGES) {
    status.textContent = `最大 ${MAX_PAGES} ページまでです。`;
    setTimeout(() => (status.textContent = ""), 1500);
    return;
  }

  saveCurrentPageToMemory();
  pages.push(createEmptyPage());
  currentPage = pages.length - 1;
  renderTabs();
  loadPageToUI(currentPage);
  updateLocalCache();
  saveRemoteMemo(false);
}

function removeCurrentPage() {
  if (isSyncing) return;
  if (pages.length <= MIN_PAGES) return;

  pages.splice(currentPage, 1);
  if (currentPage >= pages.length) {
    currentPage = pages.length - 1;
  }
  renderTabs();
  loadPageToUI(currentPage);
  updateLocalCache();
  saveRemoteMemo(false);
}

// ---------- イベント ----------
saveBtn.addEventListener("click", () => {
  if (isSyncing) return; // 初回同期中は押させない
  saveRemoteMemo(true);
});

function scheduleAutosave() {
  if (isSyncing) return; // 初回同期中の打鍵はそもそもできない想定だが保険
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveRemoteMemo(false);
  }, 800);
}

titleInput.addEventListener("input", scheduleAutosave);
memoArea.addEventListener("input", scheduleAutosave);

tabAddBtn.addEventListener("click", addPage);
tabRemoveBtn.addEventListener("click", removeCurrentPage);

// ---------- 初期化 ----------
async function init() {
  // 1. ローカルキャッシュを即表示
  loadFromLocalCache();
  renderTabs();
  loadPageToUI(currentPage);

  // 2. 初回同期が終わるまでロック
  setSyncing(true, "オンラインと同期中…");
  await loadRemoteMemoOnce();
  setSyncing(false);

  // ここから先はロック無しで運用（保存はすべてバックグラウンドPOST）
}

// 実行
init();
