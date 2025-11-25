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
    btn.dataset.index = String(index);
    btn.addEventListener("click", () => switchPage(index));
    tabsContainer.appendChild(btn);
  });

  // −ボタン制御
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

// ---------- 永続化（chrome.storage.sync） ----------
function saveAllToStorage(showMessage = false) {
  saveCurrentPageToMemory();

  chrome.storage.sync.set(
    { memoPages: pages, currentPage: currentPage },
    () => {
      if (showMessage) {
        status.textContent = "保存しました（同期されます）";
        saveBtn.textContent = "保存済み";
        setTimeout(() => {
          status.textContent = "";
          saveBtn.textContent = "保存";
        }, 1000);
      }
      // タイトル変更があったときのため再描画
      renderTabs();
    }
  );
}

// ---------- ページ操作 ----------
function switchPage(newIndex) {
  if (newIndex === currentPage) return;
  if (newIndex < 0 || newIndex >= pages.length) return;

  saveCurrentPageToMemory();
  currentPage = newIndex;

  renderTabs();
  loadPageToUI(currentPage);

  chrome.storage.sync.set({ memoPages: pages, currentPage: currentPage });
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
  saveAllToStorage(false);
}

function removeCurrentPage() {
  if (pages.length <= MIN_PAGES) return;

  pages.splice(currentPage, 1);

  if (currentPage >= pages.length) {
    currentPage = pages.length - 1;
  }

  renderTabs();
  loadPageToUI(currentPage);
  saveAllToStorage(false);
}

// ---------- イベント ----------
saveBtn.addEventListener("click", () => {
  saveAllToStorage(true);
});

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveAllToStorage(false);
  }, 800);
}

titleInput.addEventListener("input", scheduleAutosave);
memoArea.addEventListener("input", scheduleAutosave);

tabAddBtn.addEventListener("click", addPage);
tabRemoveBtn.addEventListener("click", removeCurrentPage);

// ---------- 初期化 ----------
chrome.storage.sync.get(["memoPages", "currentPage"], (result) => {
  pages = ensurePagesValid(result.memoPages);

  if (
    typeof result.currentPage === "number" &&
    result.currentPage >= 0 &&
    result.currentPage < pages.length
  ) {
    currentPage = result.currentPage;
  } else {
    currentPage = 0;
  }

  renderTabs();
  loadPageToUI(currentPage);
  status.textContent = "読み込み完了";
  setTimeout(() => (status.textContent = ""), 800);
});
