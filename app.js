const configKey = "wallet-denylist-config";
const localListKey = "wallet-denylist-local";

const state = {
  passwords: new Set(),
  pending: new Set(),
  duplicates: 0,
  remoteSha: null,
};

const els = {
  owner: document.querySelector("#owner"),
  repo: document.querySelector("#repo"),
  branch: document.querySelector("#branch"),
  path: document.querySelector("#path"),
  token: document.querySelector("#token"),
  status: document.querySelector("#status"),
  totalCount: document.querySelector("#totalCount"),
  pendingCount: document.querySelector("#pendingCount"),
  duplicateCount: document.querySelector("#duplicateCount"),
  passwordInput: document.querySelector("#passwordInput"),
  checkInput: document.querySelector("#checkInput"),
  checkResult: document.querySelector("#checkResult"),
  preview: document.querySelector("#preview"),
  saveConfig: document.querySelector("#saveConfig"),
  loadRemote: document.querySelector("#loadRemote"),
  clearLocal: document.querySelector("#clearLocal"),
  addLocal: document.querySelector("#addLocal"),
  saveRemote: document.querySelector("#saveRemote"),
  downloadTxt: document.querySelector("#downloadTxt"),
  copyAll: document.querySelector("#copyAll"),
};

function setStatus(message, type = "") {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
}

function getConfig() {
  return {
    owner: els.owner.value.trim(),
    repo: els.repo.value.trim(),
    branch: els.branch.value.trim() || "main",
    path: els.path.value.trim() || "tested-passwords.txt",
    token: els.token.value.trim(),
  };
}

function saveConfig() {
  localStorage.setItem(configKey, JSON.stringify(getConfig()));
  setStatus("Config saved", "ok");
}

function loadConfig() {
  const raw = localStorage.getItem(configKey);
  if (!raw) return;

  try {
    const config = JSON.parse(raw);
    els.owner.value = config.owner || "";
    els.repo.value = config.repo || "";
    els.branch.value = config.branch || "main";
    els.path.value = config.path || "tested-passwords.txt";
    els.token.value = config.token || "";
  } catch {
    localStorage.removeItem(configKey);
  }
}

function parseLines(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.length > 0);
}

function serializeList() {
  return Array.from(state.passwords).sort().join("\n") + "\n";
}

function saveLocalList() {
  localStorage.setItem(localListKey, serializeList());
}

function loadLocalList() {
  const raw = localStorage.getItem(localListKey);
  if (!raw) return;
  for (const password of parseLines(raw)) {
    state.passwords.add(password);
  }
}

function render() {
  els.totalCount.textContent = state.passwords.size.toLocaleString();
  els.pendingCount.textContent = state.pending.size.toLocaleString();
  els.duplicateCount.textContent = state.duplicates.toLocaleString();

  const recent = Array.from(state.passwords).slice(-80).join("\n");
  els.preview.textContent = recent || "No passwords loaded yet.";
}

function addPasswords(lines, markPending = true) {
  let added = 0;
  let dupes = 0;

  for (const password of lines) {
    if (state.passwords.has(password)) {
      dupes += 1;
      continue;
    }

    state.passwords.add(password);
    if (markPending) state.pending.add(password);
    added += 1;
  }

  state.duplicates += dupes;
  saveLocalList();
  render();
  return { added, dupes };
}

function apiUrl(config) {
  const path = encodeURIComponent(config.path).replace(/%2F/g, "/");
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`;
}

function assertRemoteConfig(config, needsToken = false) {
  if (!config.owner || !config.repo || !config.path) {
    throw new Error("Owner, repository, and data file are required.");
  }

  if (needsToken && !config.token) {
    throw new Error("A GitHub token is required to save changes.");
  }
}

function authHeaders(config) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  return headers;
}

function decodeBase64Content(content) {
  const binary = atob(content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Content(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function loadRemoteList() {
  const config = getConfig();
  assertRemoteConfig(config);
  setStatus("Loading", "warn");

  const response = await fetch(apiUrl(config), {
    headers: authHeaders(config),
  });

  if (response.status === 404) {
    state.remoteSha = null;
    setStatus("No remote file", "warn");
    render();
    return;
  }

  if (!response.ok) {
    throw new Error(`GitHub load failed: ${response.status}`);
  }

  const data = await response.json();
  state.remoteSha = data.sha;
  const text = decodeBase64Content(data.content || "");
  addPasswords(parseLines(text), false);
  state.pending.clear();
  saveLocalList();
  render();
  setStatus("Remote loaded", "ok");
}

async function saveRemoteList(retry = true) {
  const config = getConfig();
  assertRemoteConfig(config, true);
  setStatus("Saving", "warn");

  const body = {
    message: `Update tested passwords (${new Date().toISOString()})`,
    content: encodeBase64Content(serializeList()),
    branch: config.branch,
  };

  if (state.remoteSha) body.sha = state.remoteSha;

  const response = await fetch(apiUrl(config).replace(/\?ref=.*/, ""), {
    method: "PUT",
    headers: {
      ...authHeaders(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 409 && retry) {
    await loadRemoteList();
    return saveRemoteList(false);
  }

  if (!response.ok) {
    throw new Error(`GitHub save failed: ${response.status}`);
  }

  const data = await response.json();
  state.remoteSha = data.content?.sha || null;
  state.pending.clear();
  saveLocalList();
  render();
  setStatus("Saved", "ok");
}

function downloadTxt() {
  const blob = new Blob([serializeList()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tested-passwords.txt";
  link.click();
  URL.revokeObjectURL(url);
}

async function copyAll() {
  await navigator.clipboard.writeText(serializeList());
  setStatus("Copied", "ok");
}

function checkCandidate() {
  const candidate = els.checkInput.value.replace(/\r$/, "");
  if (!candidate) {
    els.checkResult.textContent = "No candidate checked.";
    els.checkResult.className = "checkResult";
    return;
  }

  if (state.passwords.has(candidate)) {
    els.checkResult.textContent = "Already tested and marked as not working.";
    els.checkResult.className = "checkResult hit";
  } else {
    els.checkResult.textContent = "Not found in the current list.";
    els.checkResult.className = "checkResult miss";
  }
}

els.saveConfig.addEventListener("click", saveConfig);

els.loadRemote.addEventListener("click", async () => {
  try {
    saveConfig();
    await loadRemoteList();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.clearLocal.addEventListener("click", () => {
  state.passwords.clear();
  state.pending.clear();
  state.duplicates = 0;
  state.remoteSha = null;
  localStorage.removeItem(localListKey);
  render();
  setStatus("Local cleared", "warn");
});

els.addLocal.addEventListener("click", () => {
  const lines = parseLines(els.passwordInput.value);
  const result = addPasswords(lines);
  els.passwordInput.value = "";
  setStatus(`${result.added} added`, result.added ? "ok" : "warn");
});

els.saveRemote.addEventListener("click", async () => {
  try {
    await saveRemoteList();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.downloadTxt.addEventListener("click", downloadTxt);
els.copyAll.addEventListener("click", copyAll);
els.checkInput.addEventListener("input", checkCandidate);

loadConfig();
loadLocalList();
render();
