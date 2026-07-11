import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";

type ServerKey = "ali" | "tencent";

type ServerInfo = {
  ok: boolean;
  error?: string;
  values: Record<string, string>;
};

// 主服 = 腾讯云新加坡（app 容器所在机，本地读取）。镜像 = 阿里云杭州（容器内直连 SSH 读取）。
const ALI_HOST = process.env.FLASHMUSE_ALI_SSH_HOST || "root@101.37.129.164";
// 阿里私钥：app 容器把 /opt/flashmuse/data/runtime 挂到 /app/.runtime。
const ALI_KEY = process.env.FLASHMUSE_ALI_SSH_KEY || "/app/.runtime/flashmuse_to_ali_ed25519";

const infoScript = [
  "kv() { printf '%s|%s' \"$1\" \"$2\"; echo; }",
  "gb() { awk -v value=\"$1\" 'BEGIN { printf \"%.3f\", value / 1024 / 1024 / 1024 }'; }",
  // 应用/媒体目录：腾讯容器是 /app/public/generated，阿里镜像是 /var/www/flashmuse-static，老马来是 /var/www/flashmuse。
  "app_path=\"\"",
  "for candidate in /app/public/generated /var/www/flashmuse /var/www/flashmuse-static /app; do if [ -d \"$candidate\" ]; then app_path=\"$candidate\"; break; fi; done",
  "if [ -z \"$app_path\" ]; then app_path=\"/\"; fi",
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

function parseInfoOutput(stdout: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of stdout.split(/\r?\n/)) {
    const separatorIndex = line.indexOf("|");
    if (separatorIndex <= 0) continue;
    values[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1).trim();
  }
  return values;
}

function runScriptWith(command: string, args: string[], script: string, timeoutMs: number): Promise<ServerInfo> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : "启动进程失败", values: {} });
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: "服务器信息读取超时", values: {} });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, values: {} });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, error: stderr.trim() || `进程退出码 ${code}`, values: {} });
        return;
      }
      resolve({ ok: true, values: parseInfoOutput(stdout) });
    });

    child.stdin.end(`${script}\n`);
  });
}

// 腾讯主服：容器本机读取
function runTencentInfo(): Promise<ServerInfo> {
  return runScriptWith("bash", ["-s"], infoScript, 25_000);
}

// 阿里镜像：容器内 SSH 直连
function runAliInfo(): Promise<ServerInfo> {
  const args = ["-T", "-i", ALI_KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "StrictHostKeyChecking=accept-new", ALI_HOST, "bash", "-s"];
  return runScriptWith("ssh", args, infoScript, 30_000);
}

function valueOf(server: ServerInfo, key: string) {
  if (!server.ok) return server.error ? `读取失败：${server.error}` : "读取失败";
  return server.values[key] || "-";
}

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const [tencent, ali] = await Promise.all([runTencentInfo(), runAliInfo()]);

  const rows: Array<{ title: string; ali: string; tencent: string }> = [
    { title: "服务器", ali: `${valueOf(ali, "hostname")} / ${valueOf(ali, "publicIp")}`, tencent: `${valueOf(tencent, "hostname")} / ${valueOf(tencent, "publicIp")}` },
    { title: "硬盘（系统盘 /）", ali: valueOf(ali, "diskRoot"), tencent: valueOf(tencent, "diskRoot") },
    { title: "硬盘（应用目录）", ali: valueOf(ali, "diskApp"), tencent: valueOf(tencent, "diskApp") },
    { title: "当前网速", ali: valueOf(ali, "networkSpeed"), tencent: valueOf(tencent, "networkSpeed") },
    { title: "带宽（网卡速率）", ali: valueOf(ali, "bandwidth"), tencent: valueOf(tencent, "bandwidth") },
    { title: "默认网卡", ali: valueOf(ali, "networkInterface"), tencent: valueOf(tencent, "networkInterface") },
    { title: "CPU 核心", ali: valueOf(ali, "cpuCores"), tencent: valueOf(tencent, "cpuCores") },
    { title: "CPU 负载（1/5/15分钟）", ali: valueOf(ali, "cpuLoad"), tencent: valueOf(tencent, "cpuLoad") },
    { title: "内存", ali: valueOf(ali, "memory"), tencent: valueOf(tencent, "memory") },
    { title: "运行时间", ali: valueOf(ali, "uptime"), tencent: valueOf(tencent, "uptime") },
    { title: "服务器时间", ali: valueOf(ali, "serverTime"), tencent: valueOf(tencent, "serverTime") },
  ];

  return NextResponse.json({ refreshedAt: new Date().toISOString(), rows, servers: { ali, tencent } satisfies Record<ServerKey, ServerInfo> });
}
