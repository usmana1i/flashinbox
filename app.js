const DOM = {
  year: document.getElementById("year"),
  emailInput: document.getElementById("emailInput"),
  newEmailBtn: document.getElementById("newEmailBtn"),
  copyBtn: document.getElementById("copyBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  refreshSelect: document.getElementById("refreshSelect"),
  searchInput: document.getElementById("searchInput"),
  messageList: document.getElementById("messageList"),
  messageMeta: document.getElementById("messageMeta"),
  messageBody: document.getElementById("messageBody"),
  downloadBtn: document.getElementById("downloadBtn"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  toggleTheme: document.getElementById("toggleTheme"),
  saveFavBtn: document.getElementById("saveFavBtn"),
  favList: document.getElementById("favList"),
  clearInboxBtn: document.getElementById("clearInboxBtn"),
  notifyBtn: document.getElementById("notifyBtn"),
  qrBtn: document.getElementById("qrBtn"),
  qrModal: document.getElementById("qrModal"),
  closeQr: document.getElementById("closeQr"),
  qrCanvas: document.getElementById("qrCanvas"),
};

DOM.year.textContent = new Date().getFullYear();

let state = {
  login: "",
  domain: "",
  messages: [],
  selected: null,
  timer: null,
  notifiedIds: new Set(),
  favs: loadJSON("flashinbox_favs", []),
};

function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function setStatus(text, live=false){
  DOM.statusText.textContent = text;
  DOM.statusDot.classList.toggle("live", live);
}

function randomString(len=10){
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function genEmail(){
  // 1secmail supports a few domains; you can add more later.
  const domains = ["1secmail.com","1secmail.org","1secmail.net","kzccv.com","qiott.com"];
  state.login = "fx" + randomString(9);
  state.domain = domains[Math.floor(Math.random()*domains.length)];
  const email = `${state.login}@${state.domain}`;
  DOM.emailInput.value = email;
  state.messages = [];
  state.selected = null;
  state.notifiedIds.clear();
  renderMessages();
  renderViewer(null);
  setStatus("New inbox created", true);
  await refreshInbox();
}

async function api(params){
  const base = "https://www.1secmail.com/api/v1/";
  const url = base + "?" + new URLSearchParams(params).toString();
  const res = await fetch(url);
  if(!res.ok) throw new Error("API error");
  return res.json();
}

function matchesSearch(msg, q){
  if(!q) return true;
  q = q.toLowerCase();
  return (
    (msg.from||"").toLowerCase().includes(q) ||
    (msg.subject||"").toLowerCase().includes(q) ||
    (msg.date||"").toLowerCase().includes(q)
  );
}

function renderMessages(){
  const q = DOM.searchInput.value.trim();
  const list = state.messages.filter(m => matchesSearch(m, q));

  if(list.length === 0){
    DOM.messageList.innerHTML = `<div class="muted">No messages yet. Use this email to sign up somewhere.</div>`;
    return;
  }

  DOM.messageList.innerHTML = list.map(m => `
    <div class="msg" data-id="${m.id}">
      <div class="msgTop">
        <div>
          <div><strong>${escapeHTML(m.subject || "(no subject)")}</strong></div>
          <div class="msgSub">From: ${escapeHTML(m.from || "unknown")}</div>
        </div>
        <div class="badge">${escapeHTML(m.date || "")}</div>
      </div>
    </div>
  `).join("");

  [...DOM.messageList.querySelectorAll(".msg")].forEach(el=>{
    el.addEventListener("click", ()=> openMessage(el.dataset.id));
  });
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function refreshInbox(){
  if(!state.login || !state.domain) return;

  try{
    setStatus("Refreshing…", true);
    const inbox = await api({ action:"getMessages", login:state.login, domain:state.domain });
    const prevIds = new Set(state.messages.map(m => m.id));
    state.messages = inbox || [];
    renderMessages();

    // Desktop notifications for new mail
    for(const m of state.messages){
      if(!prevIds.has(m.id) && Notification.permission === "granted"){
        if(!state.notifiedIds.has(m.id)){
          new Notification("New email received", { body: m.subject || "Open FlashInbox to view" });
          state.notifiedIds.add(m.id);
        }
      }
    }

    setStatus(`Inbox updated (${state.messages.length})`, true);
  }catch(e){
    setStatus("Refresh failed", false);
  }
}

async function openMessage(id){
  try{
    setStatus("Loading message…", true);
    const msg = await api({ action:"readMessage", login:state.login, domain:state.domain, id });
    state.selected = msg;
    renderViewer(msg);
    setStatus("Message loaded", true);
  }catch(e){
    setStatus("Failed to load message", false);
  }
}

function renderViewer(msg){
  if(!msg){
    DOM.messageMeta.textContent = "Select a message to view it.";
    DOM.messageBody.textContent = "";
    DOM.downloadBtn.disabled = true;
    return;
  }
  DOM.messageMeta.textContent = `From: ${msg.from} | Subject: ${msg.subject} | Date: ${msg.date}`;
  DOM.messageBody.textContent = (msg.textBody || msg.htmlBody || "(empty)") + "";
  DOM.downloadBtn.disabled = false;
}

function startAutoRefresh(){
  stopAutoRefresh();
  const sec = parseInt(DOM.refreshSelect.value, 10);
  if(!sec) return;
  state.timer = setInterval(refreshInbox, sec*1000);
}

function stopAutoRefresh(){
  if(state.timer) clearInterval(state.timer);
  state.timer = null;
}

function saveFavorite(){
  const email = DOM.emailInput.value.trim();
  if(!email) return;
  if(state.favs.includes(email)) return;
  state.favs.unshift(email);
  state.favs = state.favs.slice(0, 10);
  saveJSON("flashinbox_favs", state.favs);
  renderFavs();
}

function loadFavorite(email){
  const [login, domain] = email.split("@");
  if(!login || !domain) return;
  state.login = login;
  state.domain = domain;
  DOM.emailInput.value = email;
  state.messages = [];
  state.selected = null;
  state.notifiedIds.clear();
  renderMessages();
  renderViewer(null);
  refreshInbox();
}

function removeFavorite(email){
  state.favs = state.favs.filter(e => e !== email);
  saveJSON("flashinbox_favs", state.favs);
  renderFavs();
}

function renderFavs(){
  if(state.favs.length === 0){
    DOM.favList.innerHTML = `<div class="muted">No saved inboxes yet.</div>`;
    return;
  }
  DOM.favList.innerHTML = state.favs.map(e => `
    <div class="favItem">
      <div>
        <div><strong>${escapeHTML(e)}</strong></div>
        <div class="small">Tap to load</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn ghost" data-load="${escapeHTML(e)}">Load</button>
        <button class="btn danger ghost" data-del="${escapeHTML(e)}">Remove</button>
      </div>
    </div>
  `).join("");

  DOM.favList.querySelectorAll("[data-load]").forEach(b=>{
    b.addEventListener("click", ()=> loadFavorite(b.dataset.load));
  });
  DOM.favList.querySelectorAll("[data-del]").forEach(b=>{
    b.addEventListener("click", ()=> removeFavorite(b.dataset.del));
  });
}

function downloadSelected(){
  if(!state.selected) return;
  const text =
`From: ${state.selected.from}
Subject: ${state.selected.subject}
Date: ${state.selected.date}

${state.selected.textBody || state.selected.htmlBody || ""}`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `flashinbox-${state.selected.id}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function setTheme(theme){
  if(theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  localStorage.setItem("flashinbox_theme", theme);
}
function toggleTheme(){
  const cur = localStorage.getItem("flashinbox_theme") || "dark";
  setTheme(cur === "dark" ? "light" : "dark");
}

async function showQR(){
  const email = DOM.emailInput.value.trim();
  if(!email) return;
  DOM.qrModal.classList.remove("hidden");
  try{
    await window.renderQR(DOM.qrCanvas, email);
  }catch{
    // if QR fails, just show text in canvas
    const ctx = DOM.qrCanvas.getContext("2d");
    ctx.clearRect(0,0,240,240);
    ctx.fillText(email, 10, 120);
  }
}

async function askNotifications(){
  if(!("Notification" in window)) return alert("Notifications not supported.");
  const p = await Notification.requestPermission();
  alert("Notifications: " + p);
}

// Wire up UI
DOM.newEmailBtn.addEventListener("click", genEmail);
DOM.refreshBtn.addEventListener("click", refreshInbox);
DOM.refreshSelect.addEventListener("change", startAutoRefresh);
DOM.searchInput.addEventListener("input", renderMessages);
DOM.copyBtn.addEventListener("click", async ()=>{
  await navigator.clipboard.writeText(DOM.emailInput.value);
  DOM.copyBtn.textContent = "Copied!";
  setTimeout(()=> DOM.copyBtn.textContent="Copy", 900);
});
DOM.downloadBtn.addEventListener("click", downloadSelected);
DOM.toggleTheme.addEventListener("click", toggleTheme);
DOM.saveFavBtn.addEventListener("click", saveFavorite);
DOM.clearInboxBtn.addEventListener("click", ()=>{
  DOM.searchInput.value = "";
  state.messages = [];
  state.selected = null;
  renderMessages();
  renderViewer(null);
});
DOM.notifyBtn.addEventListener("click", askNotifications);
DOM.qrBtn.addEventListener("click", showQR);
DOM.closeQr.addEventListener("click", ()=> DOM.qrModal.classList.add("hidden"));
DOM.qrModal.addEventListener("click", (e)=>{ if(e.target === DOM.qrModal) DOM.qrModal.classList.add("hidden"); });

// Init
(function init(){
  const theme = localStorage.getItem("flashinbox_theme") || "dark";
  setTheme(theme);
  renderFavs();
  genEmail();
  startAutoRefresh();
})();
