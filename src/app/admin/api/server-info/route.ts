import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";

type ServerKey = "ali" | "malaysia";

type ServerInfo = {
  ok: boolean;
  error?: string;
  values: Record<string, string>;
};

const MALAYSIA_HOST = process.env.FLASHMUSE_MALAYSIA_SSH_HOST || "root@101.47.19.109";
const ALI_HOST = process.env.FLASHMUSE_ALI_SSH_HOST || "root@101.37.129.164";
const MALAYSIA_KEY = process.env.FLASHMUSE_MALAYSIA_SSH_KEY || "E:\\project\\【2】server\\马来西亚服务器\\ByteplusVPS.pem";
const ALI_KEY_ON_MALAYSIA = process.env.FLASHMUSE_ALI_SSH_KEY_ON_MALAYSIA || "/root/.ssh/flashmuse_to_ali_ed25519";
const isWindows = process.platform === "win32";
const infoScript = [
  "kv() { printf '%s|%s' \"$1\" \"$2\"; echo; }",
  "gb() { awk -v value=\"$1\" 'BEGIN { printf \"%.3f\", value / 1024 / 1024 / 1024 }'; }",
  "app_path=\"/var/www/flashmuse\"",
  "if [ ! -d \"$app_path\" ]; then app_path=\"/var/www/flashmuse-static\"; fi",
  "hostname_value=$(hostname 2>/dev/null || printf '-')",
  "public_ip=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')",
  "uptime_value=$(uptime -p 2>/dev/null | sed 's/^up //' || printf '-')",
  "load_value=$(awk '{print $1\" / \"$2\" / \"$3}' /proc/loadavg 2>/dev/null || printf '-')",
  "cpu_cores=$(nproc 2>/dev/null || printf '-')",
  "mem_total_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || printf 0)",
  "mem_available_kb=$(awk '/MemAvailable/ {print $2}' /proc/meminfo 2>/dev/null || printf 0)",
  "mem_total_gb=$(awk -v value=\"$mem_total_kb\" 'BEGIN { printf \"%.3f\", value / 1024 / 1024 }')",
  "mem_available_gb=$(awk -v value=\"$mem_available_kb\" 'BEGIN { printf \"%.3f\", value / 1024 / 1024 }')",
  "read root_total root_available root_percent <<EOF",
  "$(df -B1 / 2>/dev/null | awk 'NR==2 {print $2, $4, $5}')",
  "EOF",
  "read app_total app_available app_percent <<EOF",
  "$(df -B1 \"$app_path\" 2>/dev/null | awk 'NR==2 {print $2, $4, $5}')",
  "EOF",
  "iface=$(ip route get 8.8.8.8 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i==\"dev\") {print $(i+1); exit}}')",
  "if [ -z \"${iface:-}\" ]; then iface=$(ip route 2>/dev/null | awk '/default/ {print $5; exit}'); fi",
  "rx_speed=\"-\"",
  "tx_speed=\"-\"",
  "iface_speed=\"-\"",
  "if [ -n \"${iface:-}\" ] && [ -r \"/sys/class/net/$iface/statistics/rx_bytes\" ]; then",
  "  rx1=$(cat \"/sys/class/net/$iface/statistics/rx_bytes\" 2>/dev/null || printf 0)",
  "  tx1=$(cat \"/sys/class/net/$iface/statistics/tx_bytes\" 2>/dev/null || printf 0)",
  "  sleep 1",
  "  rx2=$(cat \"/sys/class/net/$iface/statistics/rx_bytes\" 2>/dev/null || printf 0)",
  "  tx2=$(cat \"/sys/class/net/$iface/statistics/tx_bytes\" 2>/dev/null || printf 0)",
  "  rx_speed=$(awk -v diff=\"$((rx2 - rx1))\" 'BEGIN { printf \"%.3f\", diff / 1024 / 1024 }')",
  "  tx_speed=$(awk -v diff=\"$((tx2 - tx1))\" 'BEGIN { printf \"%.3f\", diff / 1024 / 1024 }')",
  "  if [ -r \"/sys/class/net/$iface/speed\" ]; then iface_speed=$(cat \"/sys/class/net/$iface/speed\" 2>/dev/null || printf '-'); fi",
  "fi",
  "kv hostname \"$hostname_value\"",
  "kv publicIp \"${public_ip:-'-'}\"",
  "kv uptime \"$uptime_value\"",
  "kv cpuCores \"$cpu_cores\"",
  "kv cpuLoad \"$load_value\"",
  "kv memory \"总量 ${mem_total_gb} G / 剩余 ${mem_available_gb} G\"",
  "kv diskRoot \"总量 $(gb \"${root_total:-0}\") G / 剩余 $(gb \"${root_available:-0}\") G / 已用 ${root_percent:-'-'}\"",
  "kv diskApp \"${app_path}：总量 $(gb \"${app_total:-0}\") G / 剩余 $(gb \"${app_available:-0}\") G / 已用 ${app_percent:-'-'}\"",
  "kv networkInterface \"${iface:-'-'}\"",
  "kv networkSpeed \"下行 ${rx_speed} MB/s / 上行 ${tx_speed} MB/s\"",
  "kv bandwidth \"${iface_speed} Mbps\"",
  "kv serverTime \"$(date '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null || printf '-')\"",
].join("\n");

function runSshScript(args: string[], script: string): Promise<ServerInfo> {
  return new Promise((resolve) => {
    const child = spawn("ssh", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: "服务器信息读取超时", values: {} });
    }, 20_000);

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, values: {} });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, error: stderr.trim() || `ssh exited with code ${code}`, values: {} });
        return;
      }
      const values: Record<string, string> = {};
      for (const line of stdout.split(/\r?\n/)) {
        const separatorIndex = line.indexOf("|");
        if (separatorIndex <= 0) continue;
        values[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1).trim();
      }
      resolve({ ok: true, values });
    });

    child.stdin.end(`${script}\n`);
  });
}

function parseServerValues(output: string) {
  const result: Record<ServerKey, ServerInfo> = {
    ali: { ok: false, error: "未读取到服务器信息", values: {} },
    malaysia: { ok: false, error: "未读取到服务器信息", values: {} },
  };
  let current: ServerKey | undefined;

  for (const line of output.split(/\r?\n/)) {
    if (line === "__SERVER__|ali" || line === "__SERVER__|malaysia") {
      current = line.endsWith("ali") ? "ali" : "malaysia";
      result[current] = { ok: true, values: {} };
      continue;
    }
    if (line.startsWith("__SERVER_ERROR__|")) {
      const [, server, error] = line.split("|");
      if (server === "ali" || server === "malaysia") result[server] = { ok: false, error: error || "读取失败", values: {} };
      continue;
    }
    if (!current) continue;
    const separatorIndex = line.indexOf("|");
    if (separatorIndex <= 0) continue;
    result[current].values[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1).trim();
  }

  return result;
}

function runCombinedServerInfo(): Promise<Record<ServerKey, ServerInfo>> {
  const combinedScript = [
    "echo '__SERVER__|malaysia'",
    infoScript,
    "echo '__SERVER__|ali'",
    `ssh -T -i ${ALI_KEY_ON_MALAYSIA} -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new ${ALI_HOST} bash -s <<'__FLASHMUSE_ALI_INFO__'`,
    infoScript,
    "__FLASHMUSE_ALI_INFO__",
    "if [ $? -ne 0 ]; then echo '__SERVER_ERROR__|ali|阿里服务器读取失败'; fi",
  ].join("\n");

  return new Promise((resolve) => {
    const commonArgs = ["-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "StrictHostKeyChecking=accept-new"];
    const sshArgs = ["-i", MALAYSIA_KEY, ...commonArgs, MALAYSIA_HOST, "bash", "-s"];
    const child = isWindows
      ? spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$input | & ssh @args", ...sshArgs], { stdio: ["pipe", "pipe", "pipe"] })
      : spawn("bash", ["-s"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        ali: { ok: false, error: "服务器信息读取超时", values: {} },
        malaysia: { ok: false, error: "服务器信息读取超时", values: {} },
      });
    }, 45_000);

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ali: { ok: false, error: error.message, values: {} },
        malaysia: { ok: false, error: error.message, values: {} },
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = stderr.trim() || `ssh exited with code ${code}`;
        resolve({
          ali: { ok: false, error, values: {} },
          malaysia: { ok: false, error, values: {} },
        });
        return;
      }
      resolve(parseServerValues(stdout));
    });
    child.stdin.end(`${combinedScript}\n`);
  });
}

function valueOf(server: ServerInfo, key: string) {
  if (!server.ok) return server.error ? `读取失败：${server.error}` : "读取失败";
  return server.values[key] || "-";
}

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const { ali, malaysia } = await runCombinedServerInfo();

  const rows: Array<{ title: string; ali: string; malaysia: string }> = [
    { title: "服务器", ali: `${valueOf(ali, "hostname")} / ${valueOf(ali, "publicIp")}`, malaysia: `${valueOf(malaysia, "hostname")} / ${valueOf(malaysia, "publicIp")}` },
    { title: "硬盘（系统盘 /）", ali: valueOf(ali, "diskRoot"), malaysia: valueOf(malaysia, "diskRoot") },
    { title: "硬盘（应用目录）", ali: valueOf(ali, "diskApp"), malaysia: valueOf(malaysia, "diskApp") },
    { title: "当前网速", ali: valueOf(ali, "networkSpeed"), malaysia: valueOf(malaysia, "networkSpeed") },
    { title: "带宽（网卡速率）", ali: valueOf(ali, "bandwidth"), malaysia: valueOf(malaysia, "bandwidth") },
    { title: "默认网卡", ali: valueOf(ali, "networkInterface"), malaysia: valueOf(malaysia, "networkInterface") },
    { title: "CPU 核心", ali: valueOf(ali, "cpuCores"), malaysia: valueOf(malaysia, "cpuCores") },
    { title: "CPU 负载（1/5/15分钟）", ali: valueOf(ali, "cpuLoad"), malaysia: valueOf(malaysia, "cpuLoad") },
    { title: "内存", ali: valueOf(ali, "memory"), malaysia: valueOf(malaysia, "memory") },
    { title: "运行时间", ali: valueOf(ali, "uptime"), malaysia: valueOf(malaysia, "uptime") },
    { title: "服务器时间", ali: valueOf(ali, "serverTime"), malaysia: valueOf(malaysia, "serverTime") },
  ];

  return NextResponse.json({ refreshedAt: new Date().toISOString(), rows, servers: { ali, malaysia } satisfies Record<ServerKey, ServerInfo> });
}
