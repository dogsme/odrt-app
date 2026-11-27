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


/* ---- v3 presentation extras: rain backdrop, live block, session price sparkline.
   Additive only: reads the same RPC through the helpers above; never sends transactions. ---- */
(function () {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Rain backdrop
  const cv = document.getElementById("rain");
  if (cv && !reduced) {
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, drops = [], running = true;
    function size() {
      W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
      const n = Math.min(130, Math.floor(W / 11));
      drops = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        l: 9 + Math.random() * 16, s: 9 + Math.random() * 13, o: 0.05 + Math.random() * 0.16
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
  }

  // Live block height + session price history sparkline
  const hist = [];
  function drawSpark() {
    const c = document.getElementById("spark");
    if (!c || hist.length < 2) return;
    const g = c.getContext("2d"), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const min = Math.min.apply(null, hist), max = Math.max.apply(null, hist), span = (max - min) || 1;
    const px = (i) => (i / (hist.length - 1)) * (w - 6) + 3;
    const py = (v) => h - 5 - ((v - min) / span) * (h - 12);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#7c5cff"); grad.addColorStop(0.6, "#3ae2ff"); grad.addColorStop(1, "#ff5ca8");
    g.beginPath();
    hist.forEach((v, i) => { i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v)); });
    g.strokeStyle = grad; g.lineWidth = 2; g.lineJoin = "round"; g.stroke();
    g.lineTo(px(hist.length - 1), h); g.lineTo(px(0), h); g.closePath();
    const fill = g.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, "rgba(58,226,255,.20)"); fill.addColorStop(1, "rgba(58,226,255,0)");
    g.fillStyle = fill; g.fill();
  }
  async function extras() {
    try {
      const blk = await rpc("eth_blockNumber", []);
      const el = document.getElementById("sBlock");
      if (el) el.textContent = Number(BigInt(blk)).toLocaleString("en-US");
    } catch (e) { /* skip this tick */ }
    try {
      const [rA, rB] = await Promise.all([call(AMM, S.resA), call(AMM, S.resB)]);
      const ra = Number(BigInt(rA)), rb = Number(BigInt(rB));
      if (ra > 0) { hist.push(rb / ra); if (hist.length > 48) hist.shift(); drawSpark(); }
    } catch (e) { /* skip this tick */ }
  }
  extras();
  setInterval(extras, 15000);
})();
