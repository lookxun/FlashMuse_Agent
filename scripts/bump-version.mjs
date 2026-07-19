#!/usr/bin/env node
// 版本号自增脚本（仅在“部署测试服”时运行；正式服部署绝不运行，只原样同步测试服代码）。
// 规则：四段 100 进制 vAA.BB.CC.DD，最右段 +1，满 100 向左进位，最大 v99.99.99.99。
// 把新号写回 src/lib/app-version.ts，随代码一起带到正式服，从而“版本号一样 = 代码一样”。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "src", "lib", "app-version.ts");

const src = readFileSync(file, "utf8");
const m = src.match(/APP_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)\.(\d+)"/);
if (!m) {
  console.error("[bump-version] 未找到 APP_VERSION = \"vA.B.C.D\" 形式，终止");
  process.exit(1);
}

let seg = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
// 最右段 +1，满 100 进位
for (let i = 3; i >= 0; i--) {
  seg[i] += 1;
  if (seg[i] < 100) break;
  seg[i] = 0;
  if (i === 0) {
    console.error("[bump-version] 版本号已达上限 v99.99.99.99");
    process.exit(1);
  }
}

const oldV = `v${m[1]}.${m[2]}.${m[3]}.${m[4]}`;
const newV = `v${seg[0]}.${seg[1]}.${seg[2]}.${seg[3]}`;
const out = src.replace(/APP_VERSION\s*=\s*"v\d+\.\d+\.\d+\.\d+"/, `APP_VERSION = "${newV}"`);
writeFileSync(file, out, "utf8");
console.log(`[bump-version] ${oldV} -> ${newV}`);
