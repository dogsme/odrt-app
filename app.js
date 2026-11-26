const RPC = "https://hadrian.testnet.romeprotocol.xyz/";
const TOKEN = "0xfD3D52d07C74c5e623d9aEc3E27F8f221ACaE030";
const CHAIN_ID_HEX = "0x30d42"; // 200010
const EXPLORER = "https://via-hadrian.testnet.romeprotocol.xyz/address/" + TOKEN;

const $ = (id) => document.getElementById(id);
$("tAddr").textContent = TOKEN;
$("tAddr").href = EXPLORER;

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}
const call = (data, to = TOKEN) => rpc("eth_call", [{ to, data }, "latest"]);
function decodeString(hex) {
  const b = hex.slice(2);
  const len = parseInt(b.slice(64, 128), 16);
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(parseInt(b.slice(128 + i * 2, 130 + i * 2), 16));
  return s;
}
const fmt = (wei) => (Number(BigInt(wei)) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 4 });

async function loadToken() {
  try {
    const [name, symbol, supply] = await Promise.all([
      call("0x06fdde03"), call("0x95d89b41"), call("0x18160ddd")]);
    $("tName").textContent = decodeString(name);
    $("tSymbol").textContent = decodeString(symbol);
    $("tSupply").textContent = fmt(supply) + " ODRT";
    $("liveNote").textContent = "Live state read from Hadrian RPC at " + new Date().toLocaleTimeString() + ".";
  } catch (e) { $("liveNote").textContent = "Could not reach the Hadrian RPC: " + e.message; }
}
loadToken();

let account = null;
async function refreshBalance() {
  if (!account) return;
  const data = "0x70a08231" + account.slice(2).padStart(64, "0");
  const bal = await call(data);
  $("wBal").textContent = "Balance: " + fmt(bal) + " ODRT";
  $("btnSend").disabled = false;
}
$("btnConnect").onclick = async () => {
  if (!window.ethereum) { alert("No EVM wallet found in this browser."); return; }
  const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
  account = accs[0];
  try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] }); }
  catch (e) { $("txNote").textContent = "Please switch your wallet to Rome Hadrian (chain 200010)."; }
  $("wAddr").textContent = account;
  $("btnConnect").textContent = "Connected";
  await refreshBalance();
};
$("btnSend").onclick = async () => {
  const to = $("txTo").value.trim();
  const amt = $("txAmt").value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) { $("txNote").textContent = "Recipient address looks invalid."; return; }
  const wei = BigInt(Math.round(parseFloat(amt) * 1e6)) * 10n ** 12n;
  const data = "0xa9059cbb" + to.slice(2).padStart(64, "0") + wei.toString(16).padStart(64, "0");
  try {
    const tx = await window.ethereum.request({ method: "eth_sendTransaction",
      params: [{ from: account, to: TOKEN, data }] });
    $("txNote").innerHTML = "Transfer sent: <a target='_blank' rel='noopener' href='https://via-hadrian.testnet.romeprotocol.xyz/tx/" + tx + "'>" + tx.slice(0, 18) + "…</a>";
    setTimeout(refreshBalance, 4000);
  } catch (e) { $("txNote").textContent = "Transfer not sent: " + (e.message || e); }
};
