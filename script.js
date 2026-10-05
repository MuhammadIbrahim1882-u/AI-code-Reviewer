const $ = id => document.getElementById(id);
const codeEl = $("code"), gutter = $("gutter"), reviewBtn = $("review");
let currentFilter = "all";

const SAMPLE = `def average(numbers):
    total = 0
    for n in numbers:
        total += n
    return total / len(numbers)

def get_user(db, user_id):
    query = "SELECT * FROM users WHERE id = " + user_id
    return db.execute(query).fetchone()

print(average([]))
`;

/* Theme */
const root = document.documentElement;
try { const t = localStorage.getItem("theme"); if (t) root.dataset.theme = t; } catch {}
if (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";
$("theme").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch {}
});

/* Helpers */
let show = function (which) { ["empty", "loading", "error", "output"].forEach(id => { $(id).hidden = id !== which; }); $("filters").hidden = which !== "output"; };
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 1800); }

function setStatus(text, kind) { $("status").textContent = text; $("dot").className = "dot" + (kind ? " " + kind : ""); }

/* History (saved in this browser) */
let history = [];
let activeId = null;
try { history = JSON.parse(localStorage.getItem("reviews") || "[]"); } catch {}
function saveHistory() { try { localStorage.setItem("reviews", JSON.stringify(history.slice(0, 15))); } catch {} }
function scoreColor(s) { return s >= 80 ? "var(--suggestion)" : s >= 50 ? "var(--warning)" : "var(--bug)"; }
function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago";
}
function renderHistory() {
  const box = $("history"); box.innerHTML = "";
  if (!history.length) { box.appendChild(el("p", "h-empty", "Your reviews will appear here.")); return; }
  history.forEach(h => {
    const b = el("button", "h-item" + (h.id === activeId ? " active" : "")); b.type = "button";
    const sc = el("span", "h-score", String(h.score)); sc.style.background = scoreColor(h.score);
    const meta = el("span", "h-meta");
    meta.appendChild(el("b", "", h.title)); meta.appendChild(el("span", "", `${h.issues} issue${h.issues === 1 ? "" : "s"} · ${timeAgo(h.time)}`));
    b.appendChild(sc); b.appendChild(meta);
    b.addEventListener("click", () => {
      activeId = h.id; setCode(h.code); $("language").value = h.language || "auto";
      show("output"); render(h.data); setStatus("Loaded saved review"); renderHistory();
    });
    box.appendChild(b);
  });
}
$("newReview").addEventListener("click", () => { activeId = null; setCode(""); show("empty"); setStatus("Ready"); renderHistory(); codeEl.focus(); });
$("clearHistory").addEventListener("click", () => { history = []; saveHistory(); renderHistory(); toast("History cleared"); });

/* Editor */
function updateEditor() {
  const lines = codeEl.value.split("\n").length;
  gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  $("count").textContent = `${lines} line${lines === 1 ? "" : "s"} · ${codeEl.value.length.toLocaleString()} characters`;
}
codeEl.addEventListener("input", updateEditor);
codeEl.addEventListener("scroll", () => { gutter.scrollTop = codeEl.scrollTop; });
codeEl.addEventListener("keydown", e => {
  if (e.key === "Tab") { e.preventDefault(); codeEl.setRangeText("  ", codeEl.selectionStart, codeEl.selectionEnd, "end"); updateEditor(); }
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) review();
});
function setCode(text) { codeEl.value = text; updateEditor(); }
$("sample").addEventListener("click", () => setCode(SAMPLE));
$("clear").addEventListener("click", () => { setCode(""); show("empty"); setStatus("Ready"); codeEl.focus(); });
$("upload").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", e => readFile(e.target.files[0]));
function readFile(f) {
  if (!f) return;
  if (f.size > 200000) return toast("File is too large");
  const r = new FileReader();
  r.onload = () => { setCode(String(r.result)); toast("Loaded " + f.name); };
  r.readAsText(f);
}
const dz = $("dropzone");
["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("dragging"); }));
["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("dragging"); }));
dz.addEventListener("drop", e => readFile(e.dataTransfer.files[0]));

function jumpToLine(n) {
  const lines = codeEl.value.split("\n");
  if (n < 1 || n > lines.length) return;
  const start = lines.slice(0, n - 1).join("\n").length + (n > 1 ? 1 : 0);
  codeEl.focus();
  codeEl.setSelectionRange(start, start + lines[n - 1].length);
  codeEl.scrollTop = Math.max(0, (n - 4) * parseFloat(getComputedStyle(codeEl).lineHeight));
}

/* Results */
function scoreOf(issues) {
  const w = { bug: 15, warning: 6, suggestion: 2 };
  return Math.max(0, 100 - issues.reduce((s, i) => s + (w[i.severity] ?? 2), 0));
}
function setScore(score) {
  $("scoreNum").textContent = score;
  const ring = $("ring");
  ring.style.stroke = score >= 80 ? "var(--suggestion)" : score >= 50 ? "var(--warning)" : "var(--bug)";
  requestAnimationFrame(() => { ring.style.strokeDashoffset = 213.6 * (1 - score / 100); });
}
function applyFilter() {
  document.querySelectorAll(".issue").forEach(c => { c.hidden = currentFilter !== "all" && !c.classList.contains(currentFilter); });
}
document.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
  currentFilter = b.dataset.f;
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === b));
  applyFilter();
}));

function render(data) {
  const list = $("issues"), tally = $("tally");
  list.innerHTML = ""; tally.innerHTML = "";
  currentFilter = "all";
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.f === "all"));
  $("summary").textContent = data.summary || "";
  const score = scoreOf(data.issues);
  $("ring").style.strokeDashoffset = 213.6;
  setScore(score);

  if (!data.issues.length) { list.appendChild(el("p", "clean", "No issues found. This code looks good.")); return; }

  const counts = { bug: 0, warning: 0, suggestion: 0 };
  data.issues.forEach(i => {
    const sev = counts[i.severity] !== undefined ? i.severity : "suggestion";
    counts[sev]++;
    const card = el("article", "issue " + sev);
    const h = el("h3");
    h.appendChild(el("span", "sev", sev === "bug" ? "Bug" : sev === "warning" ? "Warning" : "Suggestion"));
    h.appendChild(el("span", "", i.title || "Issue"));
    if (i.line) {
      const b = el("button", "line", "line " + i.line);
      b.type = "button"; b.title = "Jump to this line";
      b.addEventListener("click", () => jumpToLine(Number(i.line)));
      h.appendChild(b);
    }
    card.appendChild(h);
    card.appendChild(el("p", "", i.explanation || ""));
    if (i.fix) {
      const head = el("div", "fix-head"); head.appendChild(el("span", "", "Suggested fix"));
      const c = el("button", "copy", "Copy"); c.type = "button";
      c.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(i.fix); toast("Fix copied"); } catch { toast("Copy failed"); }
      });
      head.appendChild(c);
      card.appendChild(head); card.appendChild(el("pre", "", i.fix));
    }
    list.appendChild(card);
  });
  [["bug", "bugs"], ["warning", "warnings"], ["suggestion", "suggestions"]].forEach(([k, label]) => {
    if (counts[k]) tally.appendChild(el("span", "pill " + k, counts[k] + " " + label));
  });
}

async function review() {
  if (!codeEl.value.trim()) { $("error").textContent = "Paste some code to review."; setStatus("Nothing to review", "err"); return show("error"); }
  reviewBtn.disabled = true; reviewBtn.textContent = "Reviewing...";
  show("loading"); setStatus("Reviewing...", "busy");
  try {
    const res = await fetch("/api/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeEl.value, language: $("language").value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    show("output"); render(data);
    const first = codeEl.value.trim().split("\n")[0].slice(0, 28) || "Untitled";
    const entry = { id: Date.now(), time: Date.now(), title: first, language: $("language").value, code: codeEl.value, data, score: scoreOf(data.issues), issues: data.issues.length };
    activeId = entry.id; history.unshift(entry); saveHistory(); renderHistory();
    setStatus(`Review complete · ${data.issues.length} issue${data.issues.length === 1 ? "" : "s"} found`);
  } catch (err) {
    $("error").textContent = err.message; show("error"); setStatus("Review failed", "err");
  } finally {
    reviewBtn.disabled = false; reviewBtn.textContent = "Review code";
  }
}
reviewBtn.addEventListener("click", review);
updateEditor();
renderHistory();

/* App behaviour: tabs, install, offline shell, splash */
function setTab(t) {
  document.body.dataset.tab = t;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === t));
}
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
const _show = show;
show = function (which) { _show(which); if (which !== "empty" && matchMedia("(max-width: 1000px)").matches) setTab("review"); };
$("newReview").addEventListener("click", () => setTab("code"));

let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; $("install").hidden = false; });
$("install").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice;
  deferredInstall = null; $("install").hidden = true;
});
window.addEventListener("appinstalled", () => toast("App installed"));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
window.addEventListener("load", () => setTimeout(() => $("splash").classList.add("hide"), 450));

/* Warn early if the server has no API key */
fetch("/api/health").then(r => r.json()).then(h => {
  if (!h.hasKey) { setStatus("API key missing. Add it to .env and restart the server.", "err"); toast("Add your API key to .env first"); }
  else setStatus("Ready · model " + h.model);
}).catch(() => setStatus("Server not reachable. Run npm start.", "err"));
