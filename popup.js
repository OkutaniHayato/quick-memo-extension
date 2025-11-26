// ===== ここがあなたのGASのURL =====
const API_URL = "https://script.google.com/macros/s/AKfycbwc5xif9jmcMor8L-sA6y1YuQ68U8Rsh8AyfqFJkjGPlAiajCdDgkEV8lYIAUb2OcTwRQ/exec";
// ===================================

const MAX_PAGES = 30;
const MIN_PAGES = 1;

const tabsContainer = document.getElementById("tabs");
const titleInput = document.getElementById("title");
const memoArea = document.getElementById("memo");
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");
const tabAddBtn = document.getElementById("tabAdd");
const tabRemoveBtn = document.getElementById("tabRemove");

let pages = [];
let currentPage = 0;
let autosaveTimer = null;

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

// ---------- GAS と通信 ----------
async function loadRemoteMemo() {
  status.textContent = "オンラインから読み込み中…";
  try {
    const res = await fetch(API_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`GET failed: ${res.status}`);
    const json = await res.json();

    const remotePages = json.pages;
    const remoteIndex = json.currentPage;

    pages = ensurePagesValid(remotePages);
    if (
      typeof remoteIndex === "number" &&
      remoteIndex >= 0 &&
      remoteIndex < pages.length
    ) {
      currentPage = remoteIndex;
    } else {
      currentPage = 0;
    }

    status.textContent = "同期データ取得完了";
    setTimeout(() => (status.textContent = ""), 800);
  } catch (e) {
    console.error(e);
    pages = [createEmptyPage()];
    currentPage = 0;
    status.textContent = "読み込み失敗。空データで開始します。";
    setTimeout(() => (status.textContent = ""), 1500);
  }
}

async function saveRemoteMemo(showMessage = false) {
  saveCurrentPageToMemory();

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
    console.error(e);
    status.textContent = "保存失敗（ネットワークエラー）";
    setTimeout(() => (status.textContent = ""), 1500);
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

  tabRemoveBtn.disabled = pages.length <= MIN_PAGES;
  tabRemoveBtn.style.opacity = pages.length <= MIN_PAGES ? 0.5 : 1;
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
  if (newIndex === currentPage) return;
  if (newIndex < 0 || newIndex >= pages.length) return;

  saveCurrentPageToMemory();
  currentPage = newIndex;
  renderTabs();
  loadPageToUI(currentPage);
  saveRemoteMemo(false);
}

function addPage() {
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
  saveRemoteMemo(false);
}

function removeCurrentPage() {
  if (pages.length <= MIN_PAGES) return;

  pages.splice(currentPage, 1);
  if (currentPage >= pages.length) {
    currentPage = pages.length - 1;
  }
  renderTabs();
  loadPageToUI(currentPage);
  saveRemoteMemo(false);
}

// ---------- イベント ----------
saveBtn.addEventListener("click", () => {
  saveRemoteMemo(true);
});

function scheduleAutosave() {
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
(async () => {
  await loadRemoteMemo();
  renderTabs();
  loadPageToUI(currentPage);
})();
