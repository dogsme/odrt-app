const RPC = "https://hadrian.testnet.romeprotocol.xyz/";
const CHAIN_ID_HEX = "0x30d42"; // 200010
const ODRT = "0xfD3D52d07C74c5e623d9aEc3E27F8f221ACaE030";
const RUSD = "0x88a0ba76957c3c50228d03b1859a02cb0bf1bdc3";
const FAUCET = "0xfdD30D95692be5162A26d45225463E6f19364987";
const VAULT = "0xFC370192b182C301eeFfaa72E85Bb21DAC89B886";
const AMM = "0xB476f979a894B4a28765BD1600bB05Bd789c8806";
const EXPL = "https://via-hadrian.testnet.romeprotocol.xyz";

const S = {
  balOf: "0x70a08231", approve: "0x095ea7b3", allowance: "0xdd62ed3e", transfer: "0xa9059cbb",
  claim: "0x1e83409a", stake: "0xa694fc3a", unstake: "0x2e17de78", claimRewards: "0x372500ab",
  pending: "0x31d7a262", users: "0xa87430ba", totalStaked: "0x817b1cd2", surplus: "0x13888565",
  swapAB: "0x03102091", swapBA: "0xe619a498", addLiq: "0x9cd441da", remLiq: "0x9c8f9f23",
  getOut: "0x054d50d4", resA: "0xdc5fa6c5", resB: "0x19e36f3b", shares: "0xce7c2ac2", totalShares: "0x3a98ef39"
};
const $ = (id) => document.getElementById(id);
const pad = (hex) => hex.replace(/^0x/, "").padStart(64, "0");
const encAddr = (a) => pad(a.toLowerCase());
const encUint = (n) => n.toString(16).padStart(64, "0");
const toWei = (v) => { const [i, f = ""] = String(v).split("."); return BigInt(i) * 10n ** 18n + BigInt((f + "0".repeat(18)).slice(0, 18)); };
const fmt = (wei, digits = 4) => (Number(BigInt(wei)) / 1e18).toLocaleString("en-US", { maximumFractionDigits: digits });

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}
const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
let account = null;

async function sendTx(to, data, noteEl) {
  const tx = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from: account, to, data }] });
  if (noteEl) noteEl.innerHTML = "Sent: <a target='_blank' rel='noopener' href='" + EXPL + "/tx/" + tx + "'>" + tx.slice(0, 18) + "…</a> — waiting for confirmation…";
  for (let i = 0; i < 30; i++) {
    const rc = await rpc("eth_getTransactionReceipt", [tx]);
    if (rc) { if (noteEl) noteEl.innerHTML = "Confirmed: <a target='_blank' rel='noopener' href='" + EXPL + "/tx/" + tx + "'>" + tx.slice(0, 18) + "…</a>"; refresh(); return tx; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return tx;
}
async function ensureApprove(token, spender, amount, noteEl) {
  const allow = await call(token, S.allowance + encAddr(account) + encAddr(spender));
  if (BigInt(allow) >= amount) return;
  await sendTx(token, S.approve + encAddr(spender) + encUint(amount), noteEl);
}

async function refresh() {
  try {
    const [rA, rB, staked, surplus] = await Promise.all([
      call(AMM, S.resA), call(AMM, S.resB), call(VAULT, S.totalStaked), call(VAULT, S.surplus)]);
    const ra = BigInt(rA), rb = BigInt(rB);
    $("sReserves").textContent = ra === 0n ? "no liquidity yet" : fmt(rA) + " ODRT · " + fmt(rB) + " RUSD";
    $("sPrice").textContent = ra === 0n ? "—" : (Number(rb) / Number(ra)).toFixed(4) + " RUSD";
    $("sStaked").textContent = fmt(staked) + " ODRT";
    $("sRewards").textContent = fmt(surplus) + " ODRT";
    const [fO, fR] = await Promise.all([call(ODRT, S.balOf + encAddr(FAUCET)), call(RUSD, S.balOf + encAddr(FAUCET))]);
    $("faucetInfo").textContent = "Faucet balance: " + fmt(fO) + " ODRT · " + fmt(fR) + " RUSD";
    if (account) {
      const [bO, bR, sh, pend, usr] = await Promise.all([
        call(ODRT, S.balOf + encAddr(account)), call(RUSD, S.balOf + encAddr(account)),
        call(AMM, S.shares + encAddr(account)), call(VAULT, S.pending + encAddr(account)),
        call(VAULT, S.users + encAddr(account))]);
      $("wBal").textContent = "ODRT " + fmt(bO) + " · RUSD " + fmt(bR);
      $("lpShares").textContent = fmt(sh);
      const stakedUser = BigInt("0x" + usr.slice(2, 66));
      $("stakeInfo").textContent = "Your stake: " + fmt(stakedUser.toString()) + " ODRT · Pending rewards: " + fmt(pend) + " ODRT";
    }
    quote();
  } catch (e) { /* RPC hiccup; next tick retries */ }
}

async function quote() {
  const v = $("swIn").value;
  if (!v || Number(v) <= 0) { $("swOut").value = ""; return; }
  try {
    const [rA, rB] = await Promise.all([call(AMM, S.resA), call(AMM, S.resB)]);
    const fromA = $("swFrom").value === "A";
    const out = await call(AMM, S.getOut + encUint(toWei(v)) + encUint(BigInt(fromA ? rA : rB)) + encUint(BigInt(fromA ? rB : rA)));
    $("swOut").value = fmt(out) + (fromA ? " RUSD" : " ODRT");
  } catch (e) { $("swOut").value = "—"; }
}
$("swIn").addEventListener("input", quote);
$("swFrom").addEventListener("change", quote);

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
  t.classList.add("on");
  ["swap", "pool", "stake", "faucet", "contracts"].forEach((n) => $("tab-" + n).classList.toggle("hidden", n !== t.dataset.tab));
}));

function setEnabled(on) {
  ["btnSwap", "btnAddLp", "btnRemoveLp", "btnStake", "btnUnstake", "btnClaimRewards", "btnClaimO", "btnClaimR"].forEach((id) => $(id).disabled = !on);
}
$("btnConnect").onclick = async () => {
  if (!window.ethereum) { alert("No EVM wallet found in this browser."); return; }
  const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
  account = accs[0];
  try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] }); } catch (e) {}
  $("wAddr").textContent = account;
  $("btnConnect").textContent = "Connected";
  setEnabled(true);
  refresh();
};

$("btnSwap").onclick = async () => {
  const amt = toWei($("swIn").value || "0"); if (amt <= 0n) return;
  const fromA = $("swFrom").value === "A";
  try {
    await ensureApprove(fromA ? ODRT : RUSD, AMM, amt, $("swNote"));
    await sendTx(AMM, (fromA ? S.swapAB : S.swapBA) + encUint(amt), $("swNote"));
  } catch (e) { $("swNote").textContent = "Swap not sent: " + (e.message || e); }
};
$("btnAddLp").onclick = async () => {
  const a = toWei($("lpA").value || "0"), b = toWei($("lpB").value || "0"); if (a <= 0n || b <= 0n) return;
  try {
    await ensureApprove(ODRT, AMM, a, $("lpNote"));
    await ensureApprove(RUSD, AMM, b, $("lpNote"));
    await sendTx(AMM, S.addLiq + encUint(a) + encUint(b), $("lpNote"));
  } catch (e) { $("lpNote").textContent = "Not sent: " + (e.message || e); }
};
$("btnRemoveLp").onclick = async () => {
  const s = toWei($("lpOut").value || "0"); if (s <= 0n) return;
  try { await sendTx(AMM, S.remLiq + encUint(s), $("lpNote")); }
  catch (e) { $("lpNote").textContent = "Not sent: " + (e.message || e); }
};
$("btnStake").onclick = async () => {
  const a = toWei($("stAmt").value || "0"); if (a <= 0n) return;
  try {
    await ensureApprove(ODRT, VAULT, a, $("stNote"));
    await sendTx(VAULT, S.stake + encUint(a), $("stNote"));
  } catch (e) { $("stNote").textContent = "Not sent: " + (e.message || e); }
};
$("btnUnstake").onclick = async () => {
  const a = toWei($("unAmt").value || "0"); if (a <= 0n) return;
  try { await sendTx(VAULT, S.unstake + encUint(a), $("stNote")); }
  catch (e) { $("stNote").textContent = "Not sent: " + (e.message || e); }
};
$("btnClaimRewards").onclick = async () => {
  try { await sendTx(VAULT, S.claimRewards, $("stNote")); }
  catch (e) { $("stNote").textContent = "Not sent: " + (e.message || e); }
};
$("btnClaimO").onclick = async () => {
  try { await sendTx(FAUCET, S.claim + encAddr(ODRT), $("faNote")); }
  catch (e) { $("faNote").textContent = "Not sent: " + (e.message || e); }
};
$("btnClaimR").onclick = async () => {
  try { await sendTx(FAUCET, S.claim + encAddr(RUSD), $("faNote")); }
  catch (e) { $("faNote").textContent = "Not sent: " + (e.message || e); }
};

$("contractList").innerHTML = [
  ["ODRT token", ODRT], ["RUSD token", RUSD], ["Faucet", FAUCET], ["Staking vault", VAULT], ["AMM (ODRT/RUSD)", AMM]
].map(([n, a]) => n + ": <a target='_blank' rel='noopener' href='" + EXPL + "/address/" + a + "'>" + a + "</a>").join("<br>");

refresh();
setInterval(refresh, 15000);


/* ---- v4 presentation extras: rain + lightning backdrop, live chart, swap helpers,
   pool position, stake share, faucet cooldowns. Additive only: read-only RPC calls
   through the helpers above; never sends transactions. ---- */
(function () {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmtN = (n, d) => n.toLocaleString("en-US", { maximumFractionDigits: d == null ? 4 : d });
  const LASTCLAIM = "0x31ff6327"; // Faucet.lastClaim(address,address), token => user, from src/Faucet.sol
  const COOLDOWN = 86400; // Faucet.COOLDOWN = 24 hours, from src/Faucet.sol

  // Rain backdrop + occasional lightning
  const cv = document.getElementById("rain");
  if (cv && !reduced) {
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, drops = [], running = true;
    function size() {
      W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
      const n = Math.min(150, Math.floor(W / 10));
      drops = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        l: 9 + Math.random() * 17, s: 9 + Math.random() * 14, o: 0.05 + Math.random() * 0.17
      }));
    }
    size(); window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) requestAnimationFrame(tick); });
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1; ctx.lineCap = "round";
      for (const d of drops) {
        ctx.strokeStyle = "rgba(140,180,255," + d.o + ")";
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.5, d.y + d.l); ctx.stroke();
        d.y += d.s; d.x -= 0.6;
        if (d.y > H) { d.y = -20; d.x = Math.random() * W; }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    const fl = document.getElementById("flash");
    if (fl) {
      fl.style.transition = "opacity .1s";
      (function bolt() {
        setTimeout(() => {
          if (!document.hidden) {
            fl.style.opacity = ".15";
            setTimeout(() => { fl.style.opacity = "0"; }, 110);
            setTimeout(() => { fl.style.opacity = ".09"; }, 240);
            setTimeout(() => { fl.style.opacity = "0"; }, 360);
          }
          bolt();
        }, 7000 + Math.random() * 9000);
      })();
    }
  }

  // Price history, sampled every 5s from live reserves; drives the sparkline and the big chart
  const hist = [];
  function line(ctx, w, h, data, padL, padR, padT, padB, grid) {
    const min = Math.min.apply(null, data), max = Math.max.apply(null, data), span = (max - min) || 1;
    const iw = w - padL - padR, ih = h - padT - padB;
    const px = (i) => padL + (i / (data.length - 1)) * iw;
    const py = (v) => padT + (1 - (v - min) / span) * ih;
    if (grid) {
      ctx.strokeStyle = "rgba(148,163,255,.13)"; ctx.lineWidth = 1;
      for (let gLine = 0; gLine <= 4; gLine++) {
        const y = padT + (ih / 4) * gLine;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      }
    }
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#7c5cff"); grad.addColorStop(0.6, "#3ae2ff"); grad.addColorStop(1, "#ff5ca8");
    ctx.beginPath();
    data.forEach((v, i) => { i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)); });
    ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
    ctx.lineTo(px(data.length - 1), h - padB); ctx.lineTo(px(0), h - padB); ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, "rgba(58,226,255,.20)"); fill.addColorStop(1, "rgba(58,226,255,0)");
    ctx.fillStyle = fill; ctx.fill();
    const lx = px(data.length - 1), ly = py(data[data.length - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#3ae2ff"; ctx.shadowColor = "#3ae2ff"; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    return { min, max };
  }
  function drawCharts() {
    if (hist.length < 2) return;
    const spark = document.getElementById("spark");
    if (spark) {
      const g = spark.getContext("2d");
      g.clearRect(0, 0, spark.width, spark.height);
      line(g, spark.width, spark.height, hist.slice(-48), 3, 3, 5, 5, false);
    }
    const chart = document.getElementById("chart");
    if (chart) {
      const g = chart.getContext("2d");
      g.clearRect(0, 0, chart.width, chart.height);
      const mm = line(g, chart.width, chart.height, hist, 6, 10, 10, 8, true);
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set("chNow", hist[hist.length - 1].toFixed(4) + " RUSD");
      set("chMax", mm.max.toFixed(4));
      set("chMin", mm.min.toFixed(4));
    }
  }
  async function sample() {
    try {
      const [rA, rB] = await Promise.all([call(AMM, S.resA), call(AMM, S.resB)]);
      const ra = Number(BigInt(rA)), rb = Number(BigInt(rB));
      if (ra > 0) { hist.push(rb / ra); if (hist.length > 240) hist.shift(); drawCharts(); }
    } catch (e) { /* skip this tick */ }
  }
  sample();
  setInterval(sample, 5000);

  // Live block height
  async function blockTick() {
    try {
      const blk = await rpc("eth_blockNumber", []);
      const el = document.getElementById("sBlock");
      if (el) el.textContent = Number(BigInt(blk)).toLocaleString("en-US");
    } catch (e) { /* skip this tick */ }
  }
  blockTick();
  setInterval(blockTick, 15000);

  // Nav connect button mirrors the wallet card button
  const navBtn = document.getElementById("navConnect"), mainBtn = document.getElementById("btnConnect");
  if (navBtn && mainBtn) {
    navBtn.addEventListener("click", () => mainBtn.click());
    setInterval(() => { navBtn.textContent = mainBtn.textContent; }, 1000);
  }

  // Swap helpers: From-token balance label, percent buttons, flip
  async function fromBalance() {
    if (!account) return null;
    const tok = document.getElementById("swFrom").value === "A" ? ODRT : RUSD;
    const bal = await call(tok, S.balOf + encAddr(account));
    return { bal: BigInt(bal), sym: tok === ODRT ? "ODRT" : "RUSD" };
  }
  async function balLabel() {
    const el = document.getElementById("swBalFrom");
    if (!el) return;
    if (!account) { el.textContent = "Balance: —"; return; }
    try {
      const r = await fromBalance();
      if (r) el.textContent = "Balance: " + fmt(r.bal.toString()) + " " + r.sym;
    } catch (e) { /* skip */ }
  }
  document.querySelectorAll(".pctbtn").forEach((b) => b.addEventListener("click", async () => {
    if (!account) return;
    try {
      const r = await fromBalance();
      if (!r) return;
      const v = (Number(r.bal) / 1e18) * (Number(b.dataset.p) / 100);
      const inp = document.getElementById("swIn");
      inp.value = v > 0 ? String(parseFloat(v.toFixed(6))) : "";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) { /* skip */ }
  }));
  const flip = document.getElementById("btnFlip");
  if (flip) flip.addEventListener("click", () => {
    const sel = document.getElementById("swFrom"), inp = document.getElementById("swIn"), out = document.getElementById("swOut");
    const est = parseFloat(out.value);
    sel.value = sel.value === "A" ? "B" : "A";
    if (isFinite(est) && est > 0) inp.value = String(parseFloat(est.toFixed(6)));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    balLabel();
  });
  document.getElementById("swFrom").addEventListener("change", balLabel);

  // Pool position + stake share + faucet cooldown anchors, refreshed every 15s when connected
  let nextO = 0, nextR = 0;
  async function accountExtras() {
    if (!account) return;
    try {
      const [sh, tsh, rA, rB] = await Promise.all([
        call(AMM, S.shares + encAddr(account)), call(AMM, S.totalShares),
        call(AMM, S.resA), call(AMM, S.resB)]);
      const el = document.getElementById("lpPosInfo");
      if (el) {
        const tshN = Number(BigInt(tsh)), shN = Number(BigInt(sh));
        if (tshN > 0 && shN > 0) {
          const f = shN / tshN;
          el.textContent = "Pool share: " + (f * 100).toFixed(2) + "% · worth about " +
            fmtN(f * Number(BigInt(rA)) / 1e18) + " ODRT + " + fmtN(f * Number(BigInt(rB)) / 1e18) + " RUSD at current reserves";
        } else {
          el.textContent = "You hold no LP shares yet. Add liquidity to open a position.";
        }
      }
    } catch (e) { /* skip */ }
    try {
      const [usr, tot] = await Promise.all([call(VAULT, S.users + encAddr(account)), call(VAULT, S.totalStaked)]);
      const el = document.getElementById("stExtra");
      if (el) {
        const mine = Number(BigInt("0x" + usr.slice(2, 66))) / 1e18, totN = Number(BigInt(tot)) / 1e18;
        if (mine > 0 && totN > 0) {
          const share = mine / totN;
          el.textContent = "Vault share: " + (share * 100).toFixed(2) + "% · your reward stream at the current split is about " +
            fmtN(0.001 * share * 86400, 2) + " ODRT per day";
        } else { el.textContent = ""; }
      }
    } catch (e) { /* skip */ }
    try {
      const [lO, lR] = await Promise.all([
        call(FAUCET, LASTCLAIM + encAddr(ODRT) + encAddr(account)),
        call(FAUCET, LASTCLAIM + encAddr(RUSD) + encAddr(account))]);
      nextO = Number(BigInt(lO)) + COOLDOWN;
      nextR = Number(BigInt(lR)) + COOLDOWN;
    } catch (e) { /* skip */ }
    balLabel();
  }
  setInterval(accountExtras, 15000);

  // Faucet countdown text, ticking every second from the anchored read times
  function cdText(next) {
    const left = next - Math.floor(Date.now() / 1000);
    if (left <= 0) return "ready to claim";
    const h = String(Math.floor(left / 3600)).padStart(2, "0"),
      m = String(Math.floor((left % 3600) / 60)).padStart(2, "0"),
      s = String(left % 60).padStart(2, "0");
    return "next claim in " + h + ":" + m + ":" + s;
  }
  setInterval(() => {
    const el = document.getElementById("faCd");
    if (!el) return;
    if (!account) { el.textContent = "Connect a wallet to see your claim cooldowns."; return; }
    if (!nextO && !nextR) { el.textContent = "Reading your cooldowns…"; return; }
    el.textContent = "ODRT: " + cdText(nextO) + " · RUSD: " + cdText(nextR);
  }, 1000);
})();
