const STORAGE_KEY = "game-backlog-planner:v2";
const DATA_FILE_NAME = "game-backlog-planner.json";
const DROPBOX_APP_KEY = "86fbjrljz7vkqqa";
const DROPBOX_TOKEN_KEY = "game-backlog-planner:dropbox-token";
const DROPBOX_REMOTE_KEY = "game-backlog-planner:dropbox-remote";
const DROPBOX_DATA_PATH = `/${DATA_FILE_NAME}`;
const DROPBOX_OAUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_DOWNLOAD_URL = "https://content.dropboxapi.com/2/files/download";
const DROPBOX_METADATA_URL = "https://api.dropboxapi.com/2/files/get_metadata";
const DROPBOX_SCOPES = "files.content.read files.content.write files.metadata.read";
const DROPBOX_AUTO_SAVE_DELAY = 900;
const CATALOG_FILE_NAME = "name_id_hltb.tsv";
const STEAM_HEADER_BASE_URL = "https://cdn.akamai.steamstatic.com/steam/apps";
const PLATFORM_COVER_URLS = {
  epic: "assets/epic.jpg",
  gog: "assets/gog.jpg",
  drmfree: "assets/drmfree.jpg",
  "두기런처": "assets/dugi.jpg",
  "폰겜": "assets/phone.jpg",
  "에뮬": "assets/emul.jpg"
};
const MAX_SIMULATION_DAYS = 365 * 200;
const DEFAULT_TIME_MODE = "mainExtra";
const TIME_MODES = [
  { key: "mainStory", shortLabel: "M", label: "Main story" },
  { key: "mainExtra", shortLabel: "ME", label: "Main + extra" },
  { key: "completionist", shortLabel: "C", label: "Completionist" }
];

const elements = {
  headerDropboxSaveButton: document.querySelector("#headerDropboxSaveButton"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
  startDate: document.querySelector("#startDate"),
  gameForm: document.querySelector("#gameForm"),
  gameFormTitle: document.querySelector("#gameFormTitle"),
  gameOrder: document.querySelector("#gameOrder"),
  gameTitle: document.querySelector("#gameTitle"),
  gamePlatform: document.querySelector("#gamePlatform"),
  gameCoverUrl: document.querySelector("#gameCoverUrl"),
  gameNote: document.querySelector("#gameNote"),
  gameMainStoryHours: document.querySelector("#gameMainStoryHours"),
  gameMainStoryMinutes: document.querySelector("#gameMainStoryMinutes"),
  gameMainExtraHours: document.querySelector("#gameMainExtraHours"),
  gameMainExtraMinutes: document.querySelector("#gameMainExtraMinutes"),
  gameCompletionistHours: document.querySelector("#gameCompletionistHours"),
  gameCompletionistMinutes: document.querySelector("#gameCompletionistMinutes"),
  saveGameButton: document.querySelector("#saveGameButton"),
  cancelGameEditButton: document.querySelector("#cancelGameEditButton"),
  catalogSearch: document.querySelector("#catalogSearch"),
  catalogResults: document.querySelector("#catalogResults"),
  catalogCount: document.querySelector("#catalogCount"),
  ruleForm: document.querySelector("#ruleForm"),
  ruleFormTitle: document.querySelector("#ruleFormTitle"),
  ruleFrom: document.querySelector("#ruleFrom"),
  ruleTo: document.querySelector("#ruleTo"),
  ruleType: document.querySelector("#ruleType"),
  ruleHours: document.querySelector("#ruleHours"),
  ruleMinutes: document.querySelector("#ruleMinutes"),
  saveRuleButton: document.querySelector("#saveRuleButton"),
  cancelRuleEditButton: document.querySelector("#cancelRuleEditButton"),
  ruleList: document.querySelector("#ruleList"),
  blockedPeriodForm: document.querySelector("#blockedPeriodForm"),
  blockedPeriodFormTitle: document.querySelector("#blockedPeriodFormTitle"),
  blockedFrom: document.querySelector("#blockedFrom"),
  blockedTo: document.querySelector("#blockedTo"),
  blockedNote: document.querySelector("#blockedNote"),
  saveBlockedPeriodButton: document.querySelector("#saveBlockedPeriodButton"),
  cancelBlockedPeriodEditButton: document.querySelector("#cancelBlockedPeriodEditButton"),
  blockedPeriodList: document.querySelector("#blockedPeriodList"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  importJsonInput: document.querySelector("#importJsonInput"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  importCsvInput: document.querySelector("#importCsvInput"),
  dropboxConnectButton: document.querySelector("#dropboxConnectButton"),
  dropboxReloadButton: document.querySelector("#dropboxReloadButton"),
  dropboxSaveButton: document.querySelector("#dropboxSaveButton"),
  dropboxDisconnectButton: document.querySelector("#dropboxDisconnectButton"),
  dropboxStatus: document.querySelector("#dropboxStatus"),
  gameCount: document.querySelector("#gameCount"),
  totalTime: document.querySelector("#totalTime"),
  finishDate: document.querySelector("#finishDate"),
  totalPeriod: document.querySelector("#totalPeriod"),
  clearGamesButton: document.querySelector("#clearGamesButton"),
  gamesTableBody: document.querySelector("#gamesTableBody"),
  monthsTableBody: document.querySelector("#monthsTableBody"),
  emptyGames: document.querySelector("#emptyGames"),
  emptyMonths: document.querySelector("#emptyMonths")
};

let state = loadState();
let editingGameId = null;
let editingRuleId = null;
let editingBlockedPeriodId = null;
let formCatalogGameId = "";
let gameCatalog = [];
let catalogLoadState = "loading";
let catalogLoadMessage = "";
const dropboxConfig = { appKey: DROPBOX_APP_KEY };
let dropboxToken = loadDropboxToken();
let dropboxRemote = loadDropboxRemote();
let dropboxSaveTimer = null;
let dropboxSaveInFlight = false;
let dropboxSaveAgain = false;
let dropboxStatusMessage = "";

initialize();

async function initialize() {
  applyTheme();
  bindEvents();
  setupDropboxControls();
  render();
  loadGameCatalog();
  await completeDropboxOAuth();
  renderDropboxControls();
  if (isDropboxConnected()) {
    await openDropboxStorage();
  }
  renderDropboxControls();
  render();
}

function createDefaultState() {
  const today = todayISO();

  return {
    settings: {
      startDate: today,
      theme: "light"
    },
    games: [],
    blockedPeriods: [],
    rules: [
      {
        id: createId(),
        from: today,
        to: "",
        type: "daily",
        minutes: 60
      }
    ]
  };
}

function loadState() {
  const fallback = createDefaultState();
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    const saved = JSON.parse(raw);
    return normalizeState(saved, fallback);
  } catch {
    return fallback;
  }
}

function normalizeState(value, fallback = createDefaultState()) {
  const settings = value && value.settings ? value.settings : {};
  const games = Array.isArray(value && value.games) ? value.games : [];
  const rules = Array.isArray(value && value.rules) ? value.rules : [];
  const blockedPeriods = Array.isArray(value && value.blockedPeriods) ? value.blockedPeriods : [];

  return {
    settings: {
      startDate: isDateString(settings.startDate) ? settings.startDate : fallback.settings.startDate,
      theme: settings.theme === "dark" ? "dark" : "light"
    },
    games: games
      .map((game) => {
        const times = normalizeGameTimes(game);
        const platform = String(game.platform || "").trim();
        const gameId = String(game.gameId || game.game_id || game.sourceId || "").trim();
        return {
          id: game.id || createId(),
          title: String(game.title || "").trim(),
          platform,
          gameId,
          coverUrl: normalizeUrl(game.coverUrl || game.cover_url || game.imageUrl || game.image_url) || createCoverUrl(platform, gameId),
          note: String(game.note || "").trim(),
          times,
          timeMode: normalizeTimeMode(game.timeMode)
        };
      })
      .filter((game) => game.title && getGameMinutes(game) > 0),
    blockedPeriods: blockedPeriods
      .map((period) => {
        const from = isDateString(period.from) ? period.from : fallback.settings.startDate;
        const to = isDateString(period.to) ? period.to : from;
        return {
          id: period.id || createId(),
          from,
          to,
          note: String(period.note || "").trim()
        };
      })
      .filter((period) => period.from && period.to && period.to >= period.from),
    rules: rules.length
      ? rules
          .map((rule) => ({
            id: rule.id || createId(),
            from: isDateString(rule.from) ? rule.from : fallback.settings.startDate,
            to: isDateString(rule.to) ? rule.to : "",
            type: rule.type === "weekly" ? "weekly" : "daily",
            minutes: normalizeRuleMinutes(rule)
          }))
          .filter((rule) => rule.from && rule.minutes > 0)
      : fallback.rules
  };
}

function saveState(message = "저장됨") {
  persistLocalState();
  queueDropboxSave();
  setSaveStateMessage(message);
}

function persistLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setSaveStateMessage(message = "저장됨") {
  document.title = message === "저장됨" ? "게임 완주 계획표" : `게임 완주 계획표 - ${message}`;
  window.clearTimeout(saveState.timer);
  saveState.timer = window.setTimeout(() => {
    document.title = "게임 완주 계획표";
  }, 1800);
}

function applyTheme() {
  const isDark = state.settings.theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  elements.themeToggleButton.textContent = isDark ? "라이트모드" : "다크모드";
  elements.themeToggleButton.setAttribute("aria-pressed", String(isDark));
}

function bindEvents() {
  elements.themeToggleButton.addEventListener("click", () => {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme();
    saveState("테마 저장");
  });

  elements.startDate.addEventListener("change", () => {
    state.settings.startDate = elements.startDate.value || todayISO();
    saveState("시작일 저장");
    render();
  });

  elements.gameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveGameFromForm();
  });

  elements.cancelGameEditButton.addEventListener("click", clearGameForm);

  elements.catalogSearch.addEventListener("input", renderCatalogSearch);

  elements.ruleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRuleFromForm();
  });

  elements.cancelRuleEditButton.addEventListener("click", clearRuleForm);
  elements.blockedPeriodForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveBlockedPeriodFromForm();
  });
  elements.cancelBlockedPeriodEditButton.addEventListener("click", clearBlockedPeriodForm);
  elements.exportJsonButton.addEventListener("click", exportJson);
  elements.importJsonInput.addEventListener("change", importJson);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.importCsvInput.addEventListener("change", importCsv);
  elements.dropboxConnectButton.addEventListener("click", connectDropbox);
  elements.dropboxReloadButton.addEventListener("click", reloadFromDropbox);
  elements.dropboxSaveButton.addEventListener("click", saveDropboxNow);
  elements.headerDropboxSaveButton.addEventListener("click", saveDropboxNow);
  elements.dropboxDisconnectButton.addEventListener("click", disconnectDropbox);
  elements.clearGamesButton.addEventListener("click", clearAllGames);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "move-up") {
      moveGame(id, -1);
    } else if (action === "move-down") {
      moveGame(id, 1);
    } else if (action === "set-time-mode") {
      setGameTimeMode(id, button.dataset.mode);
    } else if (action === "edit-game") {
      editGame(id);
    } else if (action === "delete-game") {
      deleteGame(id);
    } else if (action === "add-catalog-game") {
      addCatalogGame(button.dataset.catalogIndex);
    } else if (action === "fill-catalog-game") {
      fillGameFormFromCatalog(button.dataset.catalogIndex);
    } else if (action === "edit-rule") {
      editRule(id);
    } else if (action === "delete-rule") {
      deleteRule(id);
    } else if (action === "edit-blocked-period") {
      editBlockedPeriod(id);
    } else if (action === "delete-blocked-period") {
      deleteBlockedPeriod(id);
    }
  });
}

function render() {
  applyTheme();
  elements.startDate.value = state.settings.startDate;
  elements.clearGamesButton.disabled = state.games.length === 0;

  if (!editingRuleId && !elements.ruleFrom.value) {
    elements.ruleFrom.value = state.settings.startDate;
    elements.ruleHours.value = "1";
    elements.ruleMinutes.value = "";
  }

  if (!editingBlockedPeriodId && !elements.blockedFrom.value) {
    elements.blockedFrom.value = state.settings.startDate;
    elements.blockedTo.value = state.settings.startDate;
  }

  renderRules();
  renderBlockedPeriods();
  const schedule = calculateSchedule();
  renderSummary(schedule);
  renderGames(schedule);
  renderMonths(schedule);
  renderCatalogSearch();
  renderDropboxControls();
}

function saveGameFromForm() {
  const order = readGameOrderInput();
  const title = elements.gameTitle.value.trim();
  const platform = elements.gamePlatform.value.trim();
  const rawCoverUrl = normalizeUrl(elements.gameCoverUrl.value);
  const note = elements.gameNote.value.trim();
  const times = readGameTimesFromForm();
  const wasEditing = Boolean(editingGameId);

  if (!title || !hasAllGameTimes(times)) {
    window.alert("게임명과 세 가지 시간을 입력해 주세요.");
    return;
  }

  if (editingGameId) {
    const game = state.games.find((item) => item.id === editingGameId);
    if (game) {
      game.title = title;
      game.platform = platform;
      game.coverUrl = rawCoverUrl || createCoverUrl(platform, game.gameId);
      game.note = note;
      game.times = times;
      game.timeMode = normalizeTimeMode(game.timeMode);
      moveGameToOrder(game.id, order);
    }
  } else {
    insertGameAtOrder({
      id: createId(),
      title,
      platform,
      gameId: formCatalogGameId,
      coverUrl: rawCoverUrl || createCoverUrl(platform, formCatalogGameId),
      note,
      times,
      timeMode: DEFAULT_TIME_MODE
    }, order);
  }

  clearGameForm();
  saveState(wasEditing ? "게임 수정" : "게임 추가");
  render();
}

function clearGameForm() {
  editingGameId = null;
  formCatalogGameId = "";
  elements.gameForm.reset();
  elements.gameOrder.value = "";
  setGameTimeFormValues({
    mainStory: 0,
    mainExtra: 0,
    completionist: 0
  });
  elements.gameFormTitle.textContent = "게임 추가";
  elements.saveGameButton.textContent = "추가";
  elements.cancelGameEditButton.hidden = true;
}

function editGame(id) {
  const game = state.games.find((item) => item.id === id);
  if (!game) {
    return;
  }

  editingGameId = id;
  formCatalogGameId = game.gameId || "";
  elements.gameOrder.value = String(state.games.findIndex((item) => item.id === id) + 1);
  elements.gameTitle.value = game.title;
  elements.gamePlatform.value = game.platform;
  elements.gameCoverUrl.value = game.coverUrl || "";
  elements.gameNote.value = game.note || "";
  setGameTimeFormValues(game.times);
  elements.gameFormTitle.textContent = "게임 수정";
  elements.saveGameButton.textContent = "저장";
  elements.cancelGameEditButton.hidden = false;
  elements.gameTitle.focus();
}

function readGameOrderInput() {
  const raw = elements.gameOrder.value.trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : null;
}

function insertGameAtOrder(game, order) {
  if (order === null) {
    state.games.push(game);
    return;
  }

  state.games.splice(clampOrderIndex(order, state.games.length), 0, game);
}

function moveGameToOrder(id, order) {
  if (order === null) {
    return;
  }

  const currentIndex = state.games.findIndex((item) => item.id === id);
  if (currentIndex < 0) {
    return;
  }

  const [game] = state.games.splice(currentIndex, 1);
  state.games.splice(clampOrderIndex(order, state.games.length), 0, game);
}

function clampOrderIndex(order, length) {
  return Math.min(Math.max(order - 1, 0), length);
}

function deleteGame(id) {
  const game = state.games.find((item) => item.id === id);
  if (!game) {
    return;
  }

  if (!window.confirm(`"${game.title}"을(를) 삭제할까요?`)) {
    return;
  }

  state.games = state.games.filter((item) => item.id !== id);
  if (editingGameId === id) {
    clearGameForm();
  }
  saveState("게임 삭제");
  render();
}

function clearAllGames() {
  if (!state.games.length) {
    return;
  }

  if (!window.confirm(`게임 목록 ${state.games.length}개를 전부 삭제할까요?`)) {
    return;
  }

  state.games = [];
  clearGameForm();
  saveState("전체 삭제");
  render();
}

function moveGame(id, direction) {
  const index = state.games.findIndex((item) => item.id === id);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= state.games.length) {
    return;
  }

  const [game] = state.games.splice(index, 1);
  state.games.splice(nextIndex, 0, game);
  saveState("순서 변경");
  render();
}

function setGameTimeMode(id, mode) {
  const game = state.games.find((item) => item.id === id);
  if (!game) {
    return;
  }

  const nextMode = normalizeTimeMode(mode);
  if (game.timeMode === nextMode) {
    return;
  }

  game.timeMode = nextMode;
  saveState("시간 기준 변경");
  render();
}

function saveRuleFromForm() {
  const from = elements.ruleFrom.value;
  const to = elements.ruleTo.value;
  const type = elements.ruleType.value === "weekly" ? "weekly" : "daily";
  const minutes = readTimeInputs(elements.ruleHours, elements.ruleMinutes);
  const wasEditing = Boolean(editingRuleId);

  if (!from || minutes <= 0) {
    window.alert("규칙의 시작일과 시간을 입력해 주세요.");
    return;
  }

  if (to && to < from) {
    window.alert("종료일은 시작일보다 빠를 수 없습니다.");
    return;
  }

  if (editingRuleId) {
    const rule = state.rules.find((item) => item.id === editingRuleId);
    if (rule) {
      rule.from = from;
      rule.to = to;
      rule.type = type;
      rule.minutes = minutes;
    }
  } else {
    state.rules.push({
      id: createId(),
      from,
      to,
      type,
      minutes
    });
  }

  clearRuleForm();
  saveState(wasEditing ? "규칙 수정" : "규칙 추가");
  render();
}

function clearRuleForm() {
  editingRuleId = null;
  elements.ruleForm.reset();
  elements.ruleFrom.value = state.settings.startDate;
  elements.ruleHours.value = "1";
  elements.ruleMinutes.value = "";
  elements.ruleType.value = "daily";
  elements.ruleFormTitle.textContent = "플레이 시간 규칙";
  elements.saveRuleButton.textContent = "규칙 추가";
  elements.cancelRuleEditButton.hidden = true;
}

function editRule(id) {
  const rule = state.rules.find((item) => item.id === id);
  if (!rule) {
    return;
  }

  editingRuleId = id;
  elements.ruleFrom.value = rule.from;
  elements.ruleTo.value = rule.to || "";
  elements.ruleType.value = rule.type;
  setDurationInputs(elements.ruleHours, elements.ruleMinutes, rule.minutes);
  elements.ruleFormTitle.textContent = "규칙 수정";
  elements.saveRuleButton.textContent = "저장";
  elements.cancelRuleEditButton.hidden = false;
  elements.ruleFrom.focus();
}

function deleteRule(id) {
  const rule = state.rules.find((item) => item.id === id);
  if (!rule) {
    return;
  }

  if (!window.confirm("이 플레이 시간 규칙을 삭제할까요?")) {
    return;
  }

  state.rules = state.rules.filter((item) => item.id !== id);
  if (editingRuleId === id) {
    clearRuleForm();
  }
  saveState("규칙 삭제");
  render();
}

function renderRules() {
  if (!state.rules.length) {
    elements.ruleList.innerHTML = `<div class="empty-state" style="display:block">규칙이 없습니다.</div>`;
    return;
  }

  elements.ruleList.innerHTML = state.rules
    .map((rule, index) => {
      const range = `${rule.from} - ${rule.to || "계속"}`;
      const typeLabel = rule.type === "weekly" ? "매주" : "매일";

      return `
        <div class="rule-item">
          <div class="rule-main">
            <strong>${escapeHtml(range)}</strong>
            <span>${index + 1}. ${typeLabel} ${formatDuration(rule.minutes)}</span>
          </div>
          <div class="action-buttons">
            <button class="icon-button" type="button" data-action="edit-rule" data-id="${rule.id}" title="수정" aria-label="규칙 수정">✎</button>
            <button class="icon-button danger" type="button" data-action="delete-rule" data-id="${rule.id}" title="삭제" aria-label="규칙 삭제">×</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function saveBlockedPeriodFromForm() {
  const from = elements.blockedFrom.value;
  const to = elements.blockedTo.value;
  const note = elements.blockedNote.value.trim();
  const wasEditing = Boolean(editingBlockedPeriodId);

  if (!from || !to) {
    window.alert("플레이 불가 기간의 시작일과 종료일을 입력해 주세요.");
    return;
  }

  if (to < from) {
    window.alert("종료일은 시작일보다 빠를 수 없습니다.");
    return;
  }

  if (editingBlockedPeriodId) {
    const period = state.blockedPeriods.find((item) => item.id === editingBlockedPeriodId);
    if (period) {
      period.from = from;
      period.to = to;
      period.note = note;
    }
  } else {
    state.blockedPeriods.push({
      id: createId(),
      from,
      to,
      note
    });
  }

  clearBlockedPeriodForm();
  saveState(wasEditing ? "불가 기간 수정" : "불가 기간 추가");
  render();
}

function clearBlockedPeriodForm() {
  editingBlockedPeriodId = null;
  elements.blockedPeriodForm.reset();
  elements.blockedFrom.value = state.settings.startDate;
  elements.blockedTo.value = state.settings.startDate;
  elements.blockedPeriodFormTitle.textContent = "플레이 불가 기간";
  elements.saveBlockedPeriodButton.textContent = "기간 추가";
  elements.cancelBlockedPeriodEditButton.hidden = true;
}

function editBlockedPeriod(id) {
  const period = state.blockedPeriods.find((item) => item.id === id);
  if (!period) {
    return;
  }

  editingBlockedPeriodId = id;
  elements.blockedFrom.value = period.from;
  elements.blockedTo.value = period.to;
  elements.blockedNote.value = period.note || "";
  elements.blockedPeriodFormTitle.textContent = "불가 기간 수정";
  elements.saveBlockedPeriodButton.textContent = "저장";
  elements.cancelBlockedPeriodEditButton.hidden = false;
  elements.blockedFrom.focus();
}

function deleteBlockedPeriod(id) {
  const period = state.blockedPeriods.find((item) => item.id === id);
  if (!period) {
    return;
  }

  if (!window.confirm("이 플레이 불가 기간을 삭제할까요?")) {
    return;
  }

  state.blockedPeriods = state.blockedPeriods.filter((item) => item.id !== id);
  if (editingBlockedPeriodId === id) {
    clearBlockedPeriodForm();
  }
  saveState("불가 기간 삭제");
  render();
}

function renderBlockedPeriods() {
  if (!state.blockedPeriods.length) {
    elements.blockedPeriodList.innerHTML = `<div class="empty-state" style="display:block">플레이 불가 기간이 없습니다.</div>`;
    return;
  }

  elements.blockedPeriodList.innerHTML = state.blockedPeriods
    .map((period, index) => {
      const range = `${period.from} - ${period.to}`;
      const note = period.note ? `<span>${escapeHtml(period.note)}</span>` : `<span>메모 없음</span>`;

      return `
        <div class="rule-item">
          <div class="rule-main">
            <strong>${escapeHtml(range)}</strong>
            <span>${index + 1}. 플레이 0시간</span>
            ${note}
          </div>
          <div class="action-buttons">
            <button class="icon-button" type="button" data-action="edit-blocked-period" data-id="${period.id}" title="수정" aria-label="불가 기간 수정">✎</button>
            <button class="icon-button danger" type="button" data-action="delete-blocked-period" data-id="${period.id}" title="삭제" aria-label="불가 기간 삭제">×</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function calculateSchedule() {
  const totalMinutes = state.games.reduce((sum, game) => sum + getGameMinutes(game), 0);

  if (!state.games.length) {
    return {
      totalMinutes,
      gamePlans: [],
      monthPlans: [],
      finishDate: "",
      periodDays: 0,
      error: ""
    };
  }

  if (!state.rules.length) {
    return {
      totalMinutes,
      gamePlans: [],
      monthPlans: [],
      finishDate: "",
      periodDays: 0,
      error: "플레이 시간 규칙이 없습니다."
    };
  }

  let date = parseDate(state.settings.startDate);
  let dayCapacity = capacityForDate(date);
  let guard = 0;
  const monthMap = new Map();
  const gamePlans = [];

  for (const game of state.games) {
    while (dayCapacity <= 0 && guard < MAX_SIMULATION_DAYS) {
      date = addDays(date, 1);
      dayCapacity = capacityForDate(date);
      guard += 1;
    }

    if (guard >= MAX_SIMULATION_DAYS) {
      return buildSimulationError(totalMinutes, gamePlans, monthMap);
    }

    const start = formatDate(date);
    const gameMinutes = getGameMinutes(game);
    let remaining = gameMinutes;
    let end = start;

    while (remaining > 0 && guard < MAX_SIMULATION_DAYS) {
      if (dayCapacity <= 0) {
        date = addDays(date, 1);
        dayCapacity = capacityForDate(date);
        guard += 1;
        continue;
      }

      const used = Math.min(remaining, dayCapacity);
      addMonthUsage(monthMap, date, game, used);
      remaining -= used;
      dayCapacity -= used;
      end = formatDate(date);

      if (remaining > 0 && dayCapacity <= 0) {
        date = addDays(date, 1);
        dayCapacity = capacityForDate(date);
        guard += 1;
      }
    }

    if (guard >= MAX_SIMULATION_DAYS) {
      return buildSimulationError(totalMinutes, gamePlans, monthMap);
    }

    gamePlans.push({
      game,
      start,
      end,
      minutes: gameMinutes
    });
  }

  const monthPlans = Array.from(monthMap.entries()).map(([month, usage]) => ({
    month,
    games: Array.from(usage.values())
  }));

  const finishDate = gamePlans.length ? gamePlans[gamePlans.length - 1].end : "";
  const periodDays = finishDate ? daysBetween(state.settings.startDate, finishDate) + 1 : 0;

  return {
    totalMinutes,
    gamePlans,
    monthPlans,
    finishDate,
    periodDays,
    error: ""
  };
}

function buildSimulationError(totalMinutes, gamePlans, monthMap) {
  return {
    totalMinutes,
    gamePlans,
    monthPlans: Array.from(monthMap.entries()).map(([month, usage]) => ({
      month,
      games: Array.from(usage.values())
    })),
    finishDate: "",
    periodDays: 0,
    error: "200년 안에 완료되지 않습니다."
  };
}

function capacityForDate(date) {
  const iso = formatDate(date);
  let active = null;

  if (isBlockedDate(iso)) {
    return 0;
  }

  for (const rule of state.rules) {
    if (rule.from <= iso && (!rule.to || iso <= rule.to)) {
      active = rule;
    }
  }

  if (!active) {
    return 0;
  }

  return active.type === "weekly" ? active.minutes / 7 : active.minutes;
}

function isBlockedDate(isoDate) {
  return state.blockedPeriods.some((period) => period.from <= isoDate && isoDate <= period.to);
}

function addMonthUsage(monthMap, date, game, minutes) {
  const key = monthKey(date);

  if (!monthMap.has(key)) {
    monthMap.set(key, new Map());
  }

  const games = monthMap.get(key);
  const current = games.get(game.id) || {
    id: game.id,
    title: game.title,
    platform: game.platform,
    minutes: 0
  };

  current.minutes += minutes;
  games.set(game.id, current);
}

function renderSummary(schedule) {
  elements.gameCount.textContent = `${state.games.length}개`;
  elements.totalTime.textContent = formatDuration(schedule.totalMinutes);
  elements.finishDate.textContent = schedule.error ? "계산 불가" : schedule.finishDate || "-";
  elements.totalPeriod.textContent = schedule.error ? schedule.error : formatPeriod(schedule.periodDays);
}

function shouldShowPlatform(platform) {
  const text = String(platform || "").trim();
  return Boolean(text) && !isSteamPlatform(text);
}

function renderGames(schedule) {
  const planById = new Map(schedule.gamePlans.map((plan) => [plan.game.id, plan]));
  elements.emptyGames.style.display = state.games.length ? "none" : "block";

  elements.gamesTableBody.innerHTML = state.games
    .map((game, index) => {
      const plan = planById.get(game.id);
      const scheduleText = plan ? `${plan.start} - ${plan.end}` : "-";
      const platform = shouldShowPlatform(game.platform) ? `<div class="game-sub">${escapeHtml(game.platform)}</div>` : "";
      const note = game.note ? `<div class="game-note">${escapeHtml(game.note)}</div>` : "";
      const cover = renderGameCover(game);
      const selectedMinutes = getGameMinutes(game);
      const timeButtons = TIME_MODES
        .map((mode) => {
          const active = game.timeMode === mode.key ? " is-active" : "";
          const pressed = game.timeMode === mode.key ? "true" : "false";
          return `<button class="time-mode-button${active}" type="button" data-action="set-time-mode" data-id="${game.id}" data-mode="${mode.key}" title="${mode.label}" aria-label="${escapeHtml(mode.label)} 시간 기준 선택" aria-pressed="${pressed}">${mode.shortLabel}</button>`;
        })
        .join("");

      return `
        <tr>
          <td><span class="badge">${index + 1}</span></td>
          <td>
            <div class="game-cell">
              ${cover}
              <div class="game-info">
                <div class="game-title">${escapeHtml(game.title)}</div>
                ${platform}
                ${note}
              </div>
            </div>
          </td>
          <td>
            <div class="time-cell">
              <div class="time-mode-buttons" role="group" aria-label="${escapeHtml(game.title)} 시간 기준">
                ${timeButtons}
              </div>
              <span class="time-value">${formatDuration(selectedMinutes)}</span>
            </div>
          </td>
          <td><span>${escapeHtml(scheduleText)}</span></td>
          <td>
            <div class="action-buttons">
              <button class="icon-button" type="button" data-action="move-up" data-id="${game.id}" title="위로" aria-label="위로 이동" ${index === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-button" type="button" data-action="move-down" data-id="${game.id}" title="아래로" aria-label="아래로 이동" ${index === state.games.length - 1 ? "disabled" : ""}>↓</button>
              <button class="icon-button" type="button" data-action="edit-game" data-id="${game.id}" title="수정" aria-label="게임 수정">✎</button>
              <button class="icon-button danger" type="button" data-action="delete-game" data-id="${game.id}" title="삭제" aria-label="게임 삭제">×</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderGameCover(game) {
  const title = String(game.title || "").trim();
  const fallback = escapeHtml(title.slice(0, 1) || "?");
  const coverUrl = normalizeUrl(game.coverUrl) || createCoverUrl(game.platform, game.gameId);

  if (!coverUrl) {
    return `<div class="game-cover fallback" aria-hidden="true">${fallback}</div>`;
  }

  return `<img class="game-cover" src="${escapeHtml(coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${fallback}" onerror="const next=document.createElement('div');next.className='game-cover fallback';next.textContent=this.dataset.fallback||'?';this.replaceWith(next)">`;
}

function renderMonths(schedule) {
  elements.emptyMonths.style.display = schedule.monthPlans.length ? "none" : "block";

  elements.monthsTableBody.innerHTML = schedule.monthPlans
    .map((plan) => {
      const monthTotal = plan.games.reduce((sum, game) => sum + game.minutes, 0);
      const gameLines = plan.games
        .map((game) => `
          <div class="month-game-title">${escapeHtml(game.title)}</div>
        `)
        .join("");
      const timeLines = plan.games
        .map((game) => `
          <div class="month-game-time">${formatDuration(game.minutes)}</div>
        `)
        .join("");

      return `
        <tr>
          <td><strong>${escapeHtml(formatMonthLabel(plan.month))}</strong></td>
          <td><div class="month-games">${gameLines}</div></td>
          <td><div class="month-times">${timeLines}</div></td>
          <td>${formatDuration(monthTotal)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadGameCatalog() {
  catalogLoadState = "loading";
  catalogLoadMessage = "";
  renderCatalogSearch();

  try {
    const response = await fetch(CATALOG_FILE_NAME, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    gameCatalog = parseCatalogTsv(text);
    catalogLoadState = gameCatalog.length ? "ready" : "error";
    catalogLoadMessage = gameCatalog.length ? "" : "게임 목록이 비어 있습니다.";
  } catch {
    gameCatalog = [];
    catalogLoadState = "error";
    catalogLoadMessage = "게임 목록을 읽지 못했습니다. 로컬 서버나 GitHub Pages 주소에서 열어 주세요.";
  }

  renderCatalogSearch();
}

function parseCatalogTsv(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((row) => row.some((cell) => String(cell || "").trim()));

  return rows
    .slice(1)
    .map((row, index) => {
      const title = String(row[0] || "").trim();
      const gameId = String(row[1] || "").trim();
      const platform = String(row[2] || "").trim();
      const times = {
        mainStory: parseKoreanDuration(row[3]),
        mainExtra: parseKoreanDuration(row[4]),
        completionist: parseKoreanDuration(row[5])
      };

      return {
        catalogIndex: index,
        title,
        normalizedTitle: normalizeSearchText(title),
        gameId,
        platform,
        coverUrl: createCoverUrl(platform, gameId),
        times
      };
    })
    .filter((game) => game.title && game.platform);
}

function renderCatalogSearch() {
  if (!elements.catalogResults || !elements.catalogCount) {
    return;
  }

  if (catalogLoadState === "loading") {
    elements.catalogCount.textContent = "불러오는 중";
    elements.catalogResults.textContent = "게임 목록을 불러오고 있습니다.";
    return;
  }

  if (catalogLoadState === "error") {
    elements.catalogCount.textContent = "오류";
    elements.catalogResults.innerHTML = `<span class="warning">${escapeHtml(catalogLoadMessage)}</span>`;
    return;
  }

  elements.catalogCount.textContent = `${gameCatalog.length.toLocaleString("ko-KR")}개`;
  const query = elements.catalogSearch.value.trim();

  if (!query) {
    elements.catalogResults.textContent = "검색어를 입력하면 결과가 표시됩니다.";
    return;
  }

  const matches = findCatalogMatches(query);
  if (!matches.length) {
    elements.catalogResults.textContent = "일치하는 게임이 없습니다.";
    return;
  }

  elements.catalogResults.innerHTML = `
    <div class="catalog-list">
      ${matches.map(renderCatalogResult).join("")}
    </div>
  `;
}

function findCatalogMatches(query) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  if (!normalizedQuery) {
    return [];
  }

  return gameCatalog
    .map((game) => {
      const title = game.normalizedTitle;
      let score = Number.POSITIVE_INFINITY;

      if (title === normalizedQuery) {
        score = 0;
      } else if (title.startsWith(normalizedQuery)) {
        score = 1;
      } else if (title.includes(` ${normalizedQuery}`)) {
        score = 2;
      } else if (title.includes(normalizedQuery)) {
        score = 3;
      } else if (tokens.length > 1 && tokens.every((token) => title.includes(token))) {
        score = 4;
      }

      return { game, score };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score || left.game.title.localeCompare(right.game.title))
    .slice(0, 12)
    .map((item) => item.game);
}

function renderCatalogResult(game) {
  const complete = hasAllGameTimes(game.times);
  const action = complete ? "add-catalog-game" : "fill-catalog-game";
  const label = complete ? "추가" : "채우기";
  const timeText = complete ? formatDuration(game.times.mainExtra) : "시간 입력 필요";
  const cover = renderCatalogCover(game);

  return `
    <div class="catalog-item">
      ${cover}
      <div class="catalog-item-main">
        <strong>${escapeHtml(game.title)}</strong>
        <span>${escapeHtml(game.platform)} · ${escapeHtml(timeText)}</span>
      </div>
      <button class="secondary-button compact-button" type="button" data-action="${action}" data-catalog-index="${game.catalogIndex}">${label}</button>
    </div>
  `;
}

function renderCatalogCover(game) {
  const fallback = escapeHtml(String(game.title || "?").slice(0, 1));
  const coverUrl = normalizeUrl(game.coverUrl);

  if (!coverUrl) {
    return `<div class="game-cover fallback" aria-hidden="true">${fallback}</div>`;
  }

  return `<img class="game-cover" src="${escapeHtml(coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${fallback}" onerror="const next=document.createElement('div');next.className='game-cover fallback';next.textContent=this.dataset.fallback||'?';this.replaceWith(next)">`;
}

function addCatalogGame(catalogIndex) {
  const game = createGameFromCatalog(catalogIndex);
  if (!game) {
    return;
  }

  if (!hasAllGameTimes(game.times)) {
    fillGameFormFromCatalog(catalogIndex);
    return;
  }

  insertGameAtOrder(game, readGameOrderInput());
  elements.catalogSearch.value = "";
  clearGameForm();
  saveState("카탈로그 게임 추가");
  render();
}

function fillGameFormFromCatalog(catalogIndex) {
  const catalogGame = getCatalogGame(catalogIndex);
  if (!catalogGame) {
    return;
  }

  editingGameId = null;
  formCatalogGameId = catalogGame.gameId;
  elements.gameTitle.value = catalogGame.title;
  elements.gamePlatform.value = catalogGame.platform;
  elements.gameCoverUrl.value = catalogGame.coverUrl || "";
  elements.gameNote.value = "";
  setGameTimeFormValues(catalogGame.times);
  elements.gameFormTitle.textContent = hasAllGameTimes(catalogGame.times) ? "게임 추가" : "게임 추가";
  elements.saveGameButton.textContent = "추가";
  elements.cancelGameEditButton.hidden = false;
  elements.gameMainStoryHours.focus();
}

function createGameFromCatalog(catalogIndex) {
  const catalogGame = getCatalogGame(catalogIndex);
  if (!catalogGame) {
    return null;
  }

  return {
    id: createId(),
    title: catalogGame.title,
    platform: catalogGame.platform,
    gameId: catalogGame.gameId,
    coverUrl: catalogGame.coverUrl,
    note: "",
    times: { ...catalogGame.times },
    timeMode: DEFAULT_TIME_MODE
  };
}

function getCatalogGame(catalogIndex) {
  const index = Number(catalogIndex);
  return Number.isInteger(index) ? gameCatalog.find((game) => game.catalogIndex === index) : null;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseKoreanDuration(value) {
  const text = String(value || "").trim();
  const hourMatch = text.match(/(\d+(?:[.,]\d+)?)\s*시간/);
  const minuteMatch = text.match(/(\d+)\s*분/);
  const hours = hourMatch ? Number(hourMatch[1].replace(",", ".")) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  if (!hourMatch && !minuteMatch) {
    return 0;
  }

  return normalizeMinutes(hours * 60 + minutes);
}

function emptyGameTimes() {
  return {
    mainStory: 0,
    mainExtra: 0,
    completionist: 0
  };
}

function normalizeGameTimes(game = {}) {
  const source = game.times && typeof game.times === "object" ? game.times : {};
  const fallback = normalizeMinutes(game.totalMinutes ?? Number(game.hours || 0) * 60 + Number(game.minutes || 0));

  return {
    mainStory: normalizeMinutes(source.mainStory ?? game.mainStoryMinutes ?? game.main_story ?? fallback),
    mainExtra: normalizeMinutes(source.mainExtra ?? game.mainExtraMinutes ?? game.main_extra ?? fallback),
    completionist: normalizeMinutes(source.completionist ?? game.completionistMinutes ?? fallback)
  };
}

function hasAllGameTimes(times) {
  return TIME_MODES.every((mode) => normalizeMinutes(times && times[mode.key]) > 0);
}

function normalizeTimeMode(value) {
  const compact = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_+\-]/g, "");

  if (compact === "m" || compact === "mainstory") {
    return "mainStory";
  }

  if (compact === "me" || compact === "mainextra") {
    return "mainExtra";
  }

  if (compact === "c" || compact === "completionist") {
    return "completionist";
  }

  return DEFAULT_TIME_MODE;
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^\.?\/?assets\/[a-z0-9._-]+$/i.test(text)) {
    return text.replace(/^\.?\//, "");
  }

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function createCoverUrl(platform, gameId) {
  const id = String(gameId || "").trim();

  if (isSteamPlatform(platform) && /^\d+$/.test(id)) {
    return `${STEAM_HEADER_BASE_URL}/${id}/header.jpg`;
  }

  return getPlatformCoverUrl(platform);
}

function getPlatformCoverUrl(platform) {
  const key = normalizePlatformKey(platform);
  return PLATFORM_COVER_URLS[key] || "";
}

function isSteamPlatform(platform) {
  return normalizePlatformKey(platform).startsWith("steam");
}

function normalizePlatformKey(platform) {
  return String(platform || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function getGameMinutes(game) {
  const times = game && game.times ? game.times : emptyGameTimes();
  const mode = normalizeTimeMode(game && game.timeMode);
  return normalizeMinutes(times[mode] ?? times[DEFAULT_TIME_MODE]);
}

function readGameTimesFromForm() {
  return {
    mainStory: readTimeInputs(elements.gameMainStoryHours, elements.gameMainStoryMinutes),
    mainExtra: readTimeInputs(elements.gameMainExtraHours, elements.gameMainExtraMinutes),
    completionist: readTimeInputs(elements.gameCompletionistHours, elements.gameCompletionistMinutes)
  };
}

function setGameTimeFormValues(times) {
  setDurationInputs(elements.gameMainStoryHours, elements.gameMainStoryMinutes, times.mainStory);
  setDurationInputs(elements.gameMainExtraHours, elements.gameMainExtraMinutes, times.mainExtra);
  setDurationInputs(elements.gameCompletionistHours, elements.gameCompletionistMinutes, times.completionist);
}

function setDurationInputs(hoursInput, minutesInput, totalMinutes) {
  const minutes = normalizeMinutes(totalMinutes);
  hoursInput.value = minutes ? String(Math.floor(minutes / 60)) : "";
  minutesInput.value = minutes % 60 ? String(minutes % 60) : "";
}

function readTimeInputs(hoursInput, minutesInput) {
  const hours = Math.max(0, Number(hoursInput.value || 0));
  const minutes = Math.max(0, Number(minutesInput.value || 0));
  return normalizeMinutes(hours * 60 + minutes);
}

function normalizeMinutes(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeRuleMinutes(rule = {}) {
  if (rule.minutes !== undefined) {
    return normalizeMinutes(rule.minutes);
  }

  return normalizeMinutes(Number(rule.hours || 0) * 60);
}

function exportJson() {
  downloadFile(DATA_FILE_NAME, JSON.stringify(state, null, 2), "application/json");
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    state = normalizeState(JSON.parse(text));
    clearGameForm();
    clearRuleForm();
    clearBlockedPeriodForm();
    saveState("JSON 가져옴");
    render();
  } catch {
    window.alert("JSON 파일을 읽을 수 없습니다.");
  } finally {
    event.target.value = "";
  }
}

function exportCsv() {
  const rows = [["title", "game_id", "platform", "cover_url", "main_story", "main_extra", "completionist", "time_mode", "note"]];

  for (const game of state.games) {
    rows.push([
      game.title,
      game.gameId || "",
      game.platform,
      game.coverUrl || "",
      formatDuration(game.times.mainStory),
      formatDuration(game.times.mainExtra),
      formatDuration(game.times.completionist),
      game.timeMode,
      game.note || ""
    ]);
  }

  downloadFile("game-backlog-games.csv", rows.map((row) => row.map(csvEscape).join(",")).join("\n"), "text/csv");
}

async function importCsv(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const games = parseCsvGames(text);
    if (!games.length) {
      window.alert("CSV에서 게임을 찾지 못했습니다.");
      return;
    }
    state.games.push(...games);
    saveState("CSV 가져옴");
    render();
  } catch {
    window.alert("CSV 파일을 읽을 수 없습니다.");
  } finally {
    event.target.value = "";
  }
}

function loadDropboxToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(DROPBOX_TOKEN_KEY) || "{}");
    return saved.accessToken || saved.refreshToken ? saved : null;
  } catch {
    return null;
  }
}

function loadDropboxRemote() {
  try {
    const saved = JSON.parse(localStorage.getItem(DROPBOX_REMOTE_KEY) || "{}");
    return saved.rev ? { path: DROPBOX_DATA_PATH, rev: saved.rev, contentHash: saved.contentHash || "" } : null;
  } catch {
    return null;
  }
}

function setupDropboxControls() {
  renderDropboxControls();
}

async function connectDropbox() {
  if (window.location.protocol === "file:") {
    window.alert("Dropbox 연결은 GitHub Pages나 로컬 서버 주소에서 사용할 수 있습니다.");
    return;
  }

  if (!dropboxConfig.appKey) {
    window.alert("Dropbox 앱 키가 코드에 설정되어 있지 않습니다.");
    return;
  }

  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const csrfState = createId();
  sessionStorage.setItem("dropbox_code_verifier", verifier);
  sessionStorage.setItem("dropbox_oauth_state", csrfState);

  const params = new URLSearchParams({
    client_id: dropboxConfig.appKey,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
    redirect_uri: getRedirectUri(),
    scope: DROPBOX_SCOPES,
    state: csrfState
  });

  window.location.href = `${DROPBOX_OAUTH_URL}?${params.toString()}`;
}

async function completeDropboxOAuth() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (!code && !oauthError) {
    return;
  }

  cleanDropboxOAuthUrl(url);

  if (oauthError) {
    setDropboxStatus(`Dropbox 연결 취소: ${oauthError}`);
    return;
  }

  const expectedState = sessionStorage.getItem("dropbox_oauth_state");
  const verifier = sessionStorage.getItem("dropbox_code_verifier");

  if (!verifier || returnedState !== expectedState) {
    setDropboxStatus("Dropbox 연결을 확인하지 못했습니다.");
    return;
  }

  try {
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: dropboxConfig.appKey,
      code_verifier: verifier,
      redirect_uri: getRedirectUri()
    });
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await readDropboxJsonResponse(response, "Dropbox 연결에 실패했습니다.");
    if (!token.access_token) {
      throw new Error("Dropbox 연결에 실패했습니다.\n응답에 접근 토큰이 없습니다.");
    }

    dropboxToken = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || "",
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : 0
    };
    localStorage.setItem(DROPBOX_TOKEN_KEY, JSON.stringify(dropboxToken));
    setDropboxStatus("Dropbox 연결됨");
  } catch (error) {
    setDropboxStatus("Dropbox 연결 실패");
    window.alert(error.message);
  } finally {
    sessionStorage.removeItem("dropbox_code_verifier");
    sessionStorage.removeItem("dropbox_oauth_state");
  }
}

function cleanDropboxOAuthUrl(url) {
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("uid");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, url.toString());
}

async function openDropboxStorage() {
  const token = await getDropboxAccessToken({ silent: true });
  if (!token) {
    return;
  }

  try {
    setDropboxStatus("Dropbox에서 불러오는 중...");
    const remote = await downloadDropboxState(token);
    state = normalizeState(remote.value);
    saveDropboxRemote(remote.metadata);
    persistLocalState();
    clearGameForm();
    clearRuleForm();
    clearBlockedPeriodForm();
    setSaveStateMessage("Dropbox 불러옴");
    setDropboxStatus(`Dropbox 사용 중: ${DATA_FILE_NAME}`);
  } catch (error) {
    if (isDropboxNotFound(error)) {
      await createDropboxStorageFile(token);
      return;
    }

    setDropboxStatus("Dropbox 불러오기 실패");
    window.alert(error.message);
  }
}

async function createDropboxStorageFile(token) {
  try {
    let initialState = await loadTemplateState();
    if (hasUserContent(state) && window.confirm("현재 브라우저에 저장된 목록을 Dropbox에 저장할까요?\n취소하면 빈 계획표를 만듭니다.")) {
      initialState = normalizeState(state);
    }

    state = normalizeState(initialState);
    const metadata = await uploadDropboxState(token, state, "add");
    saveDropboxRemote(metadata);
    persistLocalState();
    clearGameForm();
    clearRuleForm();
    clearBlockedPeriodForm();
    setSaveStateMessage("Dropbox 파일 생성");
    setDropboxStatus(`Dropbox에 새 파일 생성: ${DATA_FILE_NAME}`);
  } catch (error) {
    setDropboxStatus("Dropbox 파일 생성 실패");
    window.alert(error.message);
  }
}

async function reloadFromDropbox() {
  if (!isDropboxConnected()) {
    window.alert("Dropbox를 먼저 연결해 주세요.");
    return;
  }

  if (!window.confirm("Dropbox의 데이터로 현재 화면을 다시 불러올까요?")) {
    return;
  }

  await openDropboxStorage();
  render();
}

function disconnectDropbox() {
  dropboxToken = null;
  dropboxRemote = null;
  window.clearTimeout(dropboxSaveTimer);
  localStorage.removeItem(DROPBOX_TOKEN_KEY);
  localStorage.removeItem(DROPBOX_REMOTE_KEY);
  setDropboxStatus("Dropbox 연결 해제됨");
  renderDropboxControls();
}

function queueDropboxSave() {
  if (!isDropboxReady()) {
    return;
  }

  window.clearTimeout(dropboxSaveTimer);
  setDropboxStatus("Dropbox 저장 대기 중...");
  dropboxSaveTimer = window.setTimeout(() => {
    saveDropboxNow();
  }, DROPBOX_AUTO_SAVE_DELAY);
}

async function saveDropboxNow() {
  if (!isDropboxConnected()) {
    window.alert("Dropbox를 먼저 연결해 주세요.");
    return;
  }

  if (!isDropboxReady()) {
    await openDropboxStorage();
    if (!isDropboxReady()) {
      return;
    }
  }

  if (dropboxSaveInFlight) {
    dropboxSaveAgain = true;
    return;
  }

  const token = await getDropboxAccessToken();
  if (!token) {
    return;
  }

  window.clearTimeout(dropboxSaveTimer);
  dropboxSaveInFlight = true;
  dropboxSaveAgain = false;

  try {
    setDropboxStatus("Dropbox에 저장 중...");
    const mode = dropboxRemote && dropboxRemote.rev
      ? { ".tag": "update", update: dropboxRemote.rev }
      : "add";
    const metadata = await uploadDropboxState(token, state, mode);
    saveDropboxRemote(metadata);
    setDropboxStatus(`Dropbox 저장됨: ${DATA_FILE_NAME}`);
    setSaveStateMessage("저장됨");
  } catch (error) {
    if (isDropboxConflict(error)) {
      setDropboxStatus("Dropbox 파일이 다른 곳에서 바뀜");
      window.alert("Dropbox 파일이 다른 곳에서 먼저 바뀌었습니다.\nDropbox에서 다시 불러온 뒤 수정해 주세요.");
    } else {
      setDropboxStatus("Dropbox 저장 실패");
      window.alert(error.message);
    }
  } finally {
    dropboxSaveInFlight = false;
    if (dropboxSaveAgain) {
      saveDropboxNow();
    }
  }
}

async function downloadDropboxState(token) {
  const response = await fetch(DROPBOX_DOWNLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: DROPBOX_DATA_PATH })
    }
  });

  if (!response.ok) {
    throw await createDropboxError(response, "Dropbox에서 불러오지 못했습니다.");
  }

  const text = await response.text();
  const metadata = readDropboxMetadataHeader(response) || await getDropboxMetadata(token);
  return {
    value: JSON.parse(text),
    metadata
  };
}

async function uploadDropboxState(token, value, mode) {
  const response = await fetch(DROPBOX_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: DROPBOX_DATA_PATH,
        mode,
        autorename: false,
        mute: true,
        strict_conflict: true
      })
    },
    body: JSON.stringify(value, null, 2)
  });

  return readDropboxJsonResponse(response, "Dropbox에 저장하지 못했습니다.");
}

async function getDropboxMetadata(token) {
  const response = await fetch(DROPBOX_METADATA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: DROPBOX_DATA_PATH,
      include_deleted: false,
      include_has_explicit_shared_members: false
    })
  });

  if (!response.ok) {
    throw await createDropboxError(response, "Dropbox 파일 정보를 읽지 못했습니다.");
  }

  return response.json();
}

async function getDropboxAccessToken(options = {}) {
  if (!dropboxToken || (!dropboxToken.accessToken && !dropboxToken.refreshToken)) {
    if (!options.silent) {
      window.alert("Dropbox를 먼저 연결해 주세요.");
    }
    renderDropboxControls();
    return "";
  }

  if (dropboxToken.accessToken && (!dropboxToken.expiresAt || Date.now() < dropboxToken.expiresAt - 60000)) {
    return dropboxToken.accessToken;
  }

  if (!dropboxToken.refreshToken) {
    disconnectDropbox();
    if (!options.silent) {
      window.alert("Dropbox 연결이 만료되었습니다. 다시 연결해 주세요.");
    }
    return "";
  }

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: dropboxToken.refreshToken,
      client_id: dropboxConfig.appKey
    });
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await readDropboxJsonResponse(response, "Dropbox 연결 갱신에 실패했습니다.");
    if (!token.access_token) {
      throw new Error("Dropbox 연결 갱신에 실패했습니다.\n응답에 접근 토큰이 없습니다.");
    }
    dropboxToken = {
      ...dropboxToken,
      accessToken: token.access_token,
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : 0
    };
    localStorage.setItem(DROPBOX_TOKEN_KEY, JSON.stringify(dropboxToken));
    return dropboxToken.accessToken;
  } catch (error) {
    disconnectDropbox();
    if (!options.silent) {
      window.alert(error.message);
    }
    return "";
  }
}

async function loadTemplateState() {
  try {
    const response = await fetch(DATA_FILE_NAME, { cache: "no-store" });
    if (response.ok) {
      return normalizeState(await response.json());
    }
  } catch {
    // If the app is opened directly from disk, use the built-in default state.
  }

  return createDefaultState();
}

function hasUserContent(value) {
  return Boolean(
    value.games.length ||
      value.blockedPeriods.length ||
      value.rules.length > 1 ||
      value.rules.some((rule) => rule.type !== "daily" || rule.minutes !== 60 || rule.to)
  );
}

function saveDropboxRemote(metadata) {
  dropboxRemote = metadata && metadata.rev
    ? {
        path: DROPBOX_DATA_PATH,
        rev: metadata.rev,
        contentHash: metadata.content_hash || ""
      }
    : null;

  if (dropboxRemote) {
    localStorage.setItem(DROPBOX_REMOTE_KEY, JSON.stringify(dropboxRemote));
  } else {
    localStorage.removeItem(DROPBOX_REMOTE_KEY);
  }
}

function isDropboxConnected() {
  return Boolean(dropboxToken && (dropboxToken.accessToken || dropboxToken.refreshToken));
}

function isDropboxReady() {
  return Boolean(isDropboxConnected() && dropboxRemote && dropboxRemote.rev);
}

function renderDropboxControls() {
  const connected = isDropboxConnected();
  const ready = isDropboxReady();

  elements.dropboxConnectButton.textContent = connected ? "Dropbox 다시 연결" : "Dropbox 연결";
  elements.dropboxReloadButton.disabled = !connected;
  elements.dropboxSaveButton.disabled = !ready;
  elements.headerDropboxSaveButton.disabled = !ready;
  elements.dropboxDisconnectButton.hidden = !connected;

  if (!dropboxStatusMessage) {
    setDropboxStatus(connected ? `Dropbox 연결됨: ${DATA_FILE_NAME}` : "Dropbox 미연결");
  } else {
    elements.dropboxStatus.textContent = dropboxStatusMessage;
  }
}

function setDropboxStatus(message) {
  dropboxStatusMessage = message;
  elements.dropboxStatus.textContent = message;
}

async function readDropboxJsonResponse(response, message) {
  if (response.ok) {
    return response.json();
  }

  throw await createDropboxError(response, message);
}

async function createDropboxError(response, message) {
  let detail = "";
  let summary = "";

  try {
    detail = await response.text();
    const parsed = JSON.parse(detail);
    summary = parsed.error_summary || parsed.error_description || parsed.error || "";
  } catch {
    summary = detail || response.statusText;
  }

  const error = new Error(`${message}\n${summary || response.statusText}`);
  error.status = response.status;
  error.dropboxSummary = summary;
  return error;
}

function readDropboxMetadataHeader(response) {
  const raw = response.headers.get("Dropbox-API-Result");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isDropboxNotFound(error) {
  return error.status === 409 && /not_found/.test(error.dropboxSummary || "");
}

function isDropboxConflict(error) {
  return error.status === 409 && /conflict|malformed_path|path/.test(error.dropboxSummary || "");
}

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function createCodeVerifier() {
  const bytes = new Uint8Array(64);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseCsvGames(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  if (!rows.length) {
    return [];
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = header.includes("title") || header.includes("main_story") || header.includes("main_extra");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const titleIndex = hasHeader ? header.indexOf("title") : 0;
  const gameIdIndex = hasHeader ? findHeaderIndex(header, ["game_id", "game id", "source_id", "source id", "steam_id", "steam id", "appid", "app_id"]) : -1;
  const platformIndex = hasHeader ? header.indexOf("platform") : 1;
  const coverUrlIndex = hasHeader ? findHeaderIndex(header, ["cover_url", "cover url", "cover", "image_url", "image url", "thumbnail", "thumbnail_url"]) : -1;
  const mainStoryIndex = hasHeader ? findHeaderIndex(header, ["main_story", "main story", "mainstory"]) : 2;
  const mainExtraIndex = hasHeader ? findHeaderIndex(header, ["main_extra", "main + extra", "main+extra", "mainextra"]) : 3;
  const completionistIndex = hasHeader ? findHeaderIndex(header, ["completionist"]) : 4;
  const timeModeIndex = hasHeader ? findHeaderIndex(header, ["time_mode", "selected_time", "selected"]) : -1;
  const noteIndex = hasHeader ? header.indexOf("note") : 5;

  return dataRows
    .map((row) => {
      const title = String(row[titleIndex] || "").trim();
      const gameId = gameIdIndex >= 0 ? String(row[gameIdIndex] || "").trim() : "";
      const platform = platformIndex >= 0 ? String(row[platformIndex] || "").trim() : "";
      const coverUrl = coverUrlIndex >= 0 ? normalizeUrl(row[coverUrlIndex]) : "";
      const note = noteIndex >= 0 ? String(row[noteIndex] || "").trim() : "";
      const times = {
        mainStory: parseDurationCell(row[mainStoryIndex]),
        mainExtra: parseDurationCell(row[mainExtraIndex]),
        completionist: parseDurationCell(row[completionistIndex])
      };

      return {
        id: createId(),
        title,
        platform,
        gameId,
        coverUrl: coverUrl || createCoverUrl(platform, gameId),
        note,
        times,
        timeMode: normalizeTimeMode(timeModeIndex >= 0 ? row[timeModeIndex] : DEFAULT_TIME_MODE)
      };
    })
    .filter((game) => game.title && hasAllGameTimes(game.times));
}

function findHeaderIndex(header, aliases) {
  return header.findIndex((cell) => aliases.includes(cell));
}

function parseDurationCell(value) {
  const parsed = parseKoreanDuration(value);
  if (parsed > 0) {
    return parsed;
  }

  const numericHours = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(numericHours) && numericHours > 0 ? normalizeMinutes(numericHours * 60) : 0;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function todayISO() {
  return formatDate(new Date());
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(value) {
  const [year, month] = String(value || "").split("-");
  const monthNumber = Number(month);

  if (!year || !monthNumber) {
    return value;
  }

  return `${year}년 ${monthNumber}월`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / dayMs);
}

function formatDuration(minutes) {
  const rounded = normalizeMinutes(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  if (hours && mins) {
    return `${hours}시간 ${mins}분`;
  }

  if (hours) {
    return `${hours}시간`;
  }

  return mins ? `${mins}분` : "0시간";
}

function formatPeriod(days) {
  if (!days) {
    return "-";
  }

  if (days < 60) {
    return `${days}일`;
  }

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);

  if (years <= 0) {
    return `약 ${months}개월`;
  }

  return months ? `약 ${years}년 ${months}개월` : `약 ${years}년`;
}

function formatNumber(value) {
  return Number(value).toLocaleString("ko-KR", {
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
