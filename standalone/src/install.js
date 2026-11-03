/* ================= install on the home screen ================= */
Object.assign(IC, { share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>', addsq: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>', phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>' });
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; schedule(); });
window.addEventListener("appinstalled", () => { installPrompt = null; setLocalPref("installed", "1"); toast("The app was added to your home screen"); schedule(); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
const isStandalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { return false; } };
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const showInstallCard = () => !isStandalone() && localPref("installHide") !== "1" && localPref("installed") !== "1";

function installCard() {
  if (!showInstallCard()) return "";
  return `<div class="card installcard"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><img src="/apple-touch-icon.png" alt="" class="appicon" onerror="this.style.display='none'"><div style="flex:1;min-width:0"><h3>Put the app on your home screen</h3><p class="small muted" style="margin-top:2px">Open it with one tap, full screen, like any other app.</p></div><button class="mini" data-act="install-hide" aria-label="Hide">${icon("x")}</button></div>
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="install">${icon("phone")}Install the app</button></div></div>`;
}
function installSheet() {
  const ios = isIOS();
  const step = (n, html) => `<div class="li" style="align-items:center"><span class="av sm" style="background:var(--brand);color:var(--on-brand)">${n}</span><div class="grow">${html}</div></div>`;
  return `<div class="hd"><h2>${icon("phone")} Install the app</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <div class="seg"><button data-act="install-os" data-os="ios" aria-pressed="${(S.sel.installOs || (ios ? "ios" : "android")) === "ios"}">iPhone</button><button data-act="install-os" data-os="android" aria-pressed="${(S.sel.installOs || (ios ? "ios" : "android")) === "android"}">Android</button></div>
  ${(S.sel.installOs || (ios ? "ios" : "android")) === "ios" ? `<div class="list">
    ${step(1, `Open this page in <b>Safari</b>.`)}
    ${step(2, `Tap the <b>Share</b> button <span class="inl">${icon("share")}</span> at the bottom of the screen (or at the top on iPad).`)}
    ${step(3, `Scroll down and tap <b>Add to Home Screen</b> <span class="inl">${icon("addsq")}</span>.`)}
    ${step(4, `Tap <b>Add</b>. The Performance360 icon appears on your home screen.`)}</div>
    <p class="notice">The first time you open the app from the home screen, enter your personal code once more. After that it stays signed in.</p>`
  : `<div class="list">${installPrompt ? step(1, `Tap the button below, then <b>Install</b>.`) : `${step(1, `Open this page in <b>Chrome</b>.`)}${step(2, `Tap the menu <b>⋮</b> at the top.`)}${step(3, `Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.`)}`}</div>
    ${installPrompt ? `<button class="btn primary big" data-act="install-now">${icon("phone")}Install now</button>` : ""}`}
  ${isStaff() ? `<p class="small muted">Tip: send athletes the app address with their code; they install it the same way.</p>` : ""}`;
}
ACTIONS["install"] = async () => { if (installPrompt && !isIOS()) return ACTIONS["install-now"](); S.modal = { kind: "install" }; render(); };
ACTIONS["install-now"] = async () => { if (!installPrompt) return; installPrompt.prompt(); try { const r = await installPrompt.userChoice; if (r && r.outcome === "accepted") { setLocalPref("installed", "1"); S.modal = null; } } catch {} installPrompt = null; render(); };
ACTIONS["install-os"] = (d) => { S.sel.installOs = d.os; render(); };
ACTIONS["install-hide"] = () => { setLocalPref("installHide", "1"); render(); };
const _modalHtml4 = modalHtml;
modalHtml = function () { if (S.modal && S.modal.kind === "install") return `<div class="modal" data-act="modal-bg" role="dialog" aria-modal="true"><div class="box">${installSheet()}</div></div>`; return _modalHtml4(); };
const _staffDash2 = staffDashboard, _athDash2 = athleteDashboard;
staffDashboard = function () { return installCard() + _staffDash2(); };
athleteDashboard = function () { return installCard() + _athDash2(); };
const _quick = quickActions;
quickActions = function () { const q = _quick(); if (!isStandalone()) q.push(["install-qa", "Install the app", "phone", {}]); return q; };
const _qa = ACTIONS["qa"];
ACTIONS["qa"] = (d) => { if (d.a === "install-qa") { S.modal = { kind: "install" }; return render(); } return _qa(d); };
// settings → preferences: always offer it there too
const _cfgPrefs = CFG.prefs;
CFG.prefs = () => _cfgPrefs() + (isStandalone() ? "" : `<div class="card"><div class="hd"><h2>${icon("phone")} Home screen</h2></div><p class="muted">Install the app on this phone or computer to open it with one tap.</p><div class="row" style="margin-top:10px"><button class="btn primary" data-act="install">Install the app</button></div></div>`);
// the app's own address, and a ready-to-send invitation message
const appUrl = () => (location.protocol === "https:" ? location.origin + location.pathname : APPCFG.siteUrl || "");
const inviteText = (name, code) => (LANG === "he"
  ? `היי ${name}! זו הכניסה שלך לאפליקציית האימונים של ${settings().name}:\n${appUrl()}\nהקוד האישי שלך: ${fmtCode(code)}\nטיפ: באייפון לוחצים שיתוף ← "הוספה למסך הבית", באנדרואיד ⋮ ← "התקנת אפליקציה".`
  : `Hi ${name}! Here's your sign-in for the ${settings().name} training app:\n${appUrl()}\nYour personal code: ${fmtCode(code)}\nTip: on iPhone tap Share → "Add to Home Screen"; on Android ⋮ → "Install app".`);
