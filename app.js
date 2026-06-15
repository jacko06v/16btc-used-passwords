const localListKey = "wallet-denylist-local";
const repoConfig = {
  owner: "jacko06v",
  repo: "16btc-used-passwords",
  branch: "main",
  path: "tested-passwords.txt",
};

const state = {
  passwords: new Set(),
  pending: new Set(),
  duplicates: 0,
  remoteSha: null,
};

const els = {
  status: document.querySelector("#status"),
  totalCount: document.querySelector("#totalCount"),
  pendingCount: document.querySelector("#pendingCount"),
  duplicateCount: document.querySelector("#duplicateCount"),
  passwordInput: document.querySelector("#passwordInput"),
  checkInput: document.querySelector("#checkInput"),
  checkResult: document.querySelector("#checkResult"),
  preview: document.querySelector("#preview"),
  loadRemote: document.querySelector("#loadRemote"),
  clearLocal: document.querySelector("#clearLocal"),
  addLocal: document.querySelector("#addLocal"),
  submitPublic: document.querySelector("#submitPublic"),
  downloadTxt: document.querySelector("#downloadTxt"),
  copyAll: document.querySelector("#copyAll"),
};

function setStatus(message, type = "") {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
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

function assertRemoteConfig(config) {
  if (!config.owner || !config.repo || !config.path) {
    throw new Error("Owner, repository, and data file are required.");
  }
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
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
  const config = repoConfig;
  assertRemoteConfig(config);
  setStatus("Loading", "warn");

  const response = await fetch(apiUrl(config), {
    headers: githubHeaders(),
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

function downloadTxt() {
  const blob = new Blob([serializeList()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tested-passwords.txt";
  link.click();
  URL.revokeObjectURL(url);
}

function buildPublicSubmissionBody(lines) {
  const unique = Array.from(new Set(lines));
  return [
    "### Tested passwords",
    "",
    "```text",
    ...unique,
    "```",
    "",
    "Submitted from the public GitHub Pages app.",
  ].join("\n");
}

function submitPublicly() {
  const config = repoConfig;
  assertRemoteConfig(config);

  const lines = parseLines(els.passwordInput.value);
  if (!lines.length) {
    setStatus("Nothing to submit", "warn");
    return;
  }

  const body = buildPublicSubmissionBody(lines);
  const title = `Password denylist submission (${new Date().toISOString()})`;
  const issueUrl = new URL(`https://github.com/${config.owner}/${config.repo}/issues/new`);
  issueUrl.searchParams.set("title", title);
  issueUrl.searchParams.set("body", body);
  issueUrl.searchParams.set("labels", "password-submission");

  if (issueUrl.toString().length > 7500) {
    navigator.clipboard.writeText(body);
    window.open(`https://github.com/${config.owner}/${config.repo}/issues/new?title=${encodeURIComponent(title)}`, "_blank", "noopener");
    setStatus("Submission copied", "warn");
    return;
  }

  window.open(issueUrl.toString(), "_blank", "noopener");
  setStatus("Issue opened", "ok");
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

els.loadRemote.addEventListener("click", async () => {
  try {
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

els.submitPublic.addEventListener("click", () => {
  try {
    submitPublicly();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.downloadTxt.addEventListener("click", downloadTxt);
els.copyAll.addEventListener("click", copyAll);
els.checkInput.addEventListener("input", checkCandidate);

loadLocalList();
render();
