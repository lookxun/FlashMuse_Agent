/**
 * 支付 / 积分充值的纯函数回归（2026-09-09 第一百一十八次会话审计时新增）。
 *
 * 跑法：`npx tsx scripts/verify-payment-rules.ts`（几秒、零副作用、不碰数据库、不打支付宝）。
 *
 * ⭐ 改了下面这些东西，**必须先跑通它再部署**：
 *   `payment-orders.ts` 的订单号格式 / `isPaidAmountEnough` / `getCreditOrderPayStatus`、
 *   `membership.ts` 的 `sanitizeCreditPacks` / `isCreditPackIndex`、
 *   `alipay.ts` 的 `parseAlipayNotifyBody`。
 * ⭐ 用例里**一半是反向用例**（少付/脏数据/越界档位/垃圾报文）——
 *   只测"正常能过"证明不了钱是安全的。
 */
import { createPaymentOrderNo, PAYMENT_ORDER_NO_PATTERN, getCreditOrderPayStatus, PAYMENT_ORDER_EXPIRE_MS, isPaidAmountEnough } from "../src/lib/payment-orders";
import { parseAlipayNotifyBody } from "../src/lib/alipay";
import { isCreditPackIndex, sanitizeCreditPacks, DEFAULT_CREDIT_PACKS } from "../src/lib/membership";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, extra = "") {
  if (ok) { pass += 1; console.log(`OK   ${name}`); }
  else { fail += 1; console.log(`FAIL ${name} ${extra}`); }
}

// ── 订单号正则：新格式必须过；**老格式（4 位随机）也必须过**（库里已有老单要能查） ──
for (let i = 0; i < 200; i += 1) {
  const no = createPaymentOrderNo();
  if (!PAYMENT_ORDER_NO_PATTERN.test(no)) { check(`new order no ${no}`, false); break; }
}
check("新订单号 200 个全部匹配正则", true);
check("新订单号长度 = C+20 位", createPaymentOrderNo().length === 21, createPaymentOrderNo());
check("老订单号（C+18 位）仍匹配", PAYMENT_ORDER_NO_PATTERN.test("C202609080434362029"));
check("反向：空", !PAYMENT_ORDER_NO_PATTERN.test(""));
check("反向：非 C 开头", !PAYMENT_ORDER_NO_PATTERN.test("X202609080434362029"));
check("反向：SQL 注入样", !PAYMENT_ORDER_NO_PATTERN.test("C20260908' OR 1=1--"));
check("反向：太短", !PAYMENT_ORDER_NO_PATTERN.test("C123"));
check("反向：超长", !PAYMENT_ORDER_NO_PATTERN.test(`C${"1".repeat(30)}`));

// ── 档位下标校验 ──
check("packIndex 0 合法", isCreditPackIndex(0));
check("packIndex 7 合法", isCreditPackIndex(7));
check("反向：8", !isCreditPackIndex(8));
check("反向：-1", !isCreditPackIndex(-1));
check("反向：0.5", !isCreditPackIndex(0.5));
check("反向：NaN", !isCreditPackIndex(Number.NaN));
check("反向：字符串 '0'", !isCreditPackIndex("0"));
check("反向：null", !isCreditPackIndex(null));
check("反向：Infinity", !isCreditPackIndex(Number.POSITIVE_INFINITY));

// ── 档位清洗：永远 8 档、越界值回落默认、绝不出现 0 元/0 积分 ──
const cleaned = sanitizeCreditPacks([{ payCny: 0, credits: 0 }, { payCny: -5, credits: -100 }, { payCny: 1e9, credits: 1e9 }]);
check("清洗后恒 8 档", cleaned.length === 8, String(cleaned.length));
check("0 元被拒 → 回落默认 50", cleaned[0].payCny === DEFAULT_CREDIT_PACKS[0].payCny, String(cleaned[0].payCny));
check("0 积分被拒 → 回落默认", cleaned[0].credits === DEFAULT_CREDIT_PACKS[0].credits, String(cleaned[0].credits));
check("负数被拒", cleaned[1].payCny === DEFAULT_CREDIT_PACKS[1].payCny && cleaned[1].credits === DEFAULT_CREDIT_PACKS[1].credits);
check("超大值被拒", cleaned[2].payCny === DEFAULT_CREDIT_PACKS[2].payCny && cleaned[2].credits === DEFAULT_CREDIT_PACKS[2].credits);
check("每档金额 > 0", cleaned.every((item) => item.payCny > 0));
check("每档积分 >= 1", cleaned.every((item) => item.credits >= 1));
const fromGarbage = sanitizeCreditPacks("not-an-array");
check("非数组 → 默认 8 档", fromGarbage.length === 8 && fromGarbage[0].payCny === 50);
const oneCent = sanitizeCreditPacks([{ payCny: 0.01, credits: 250, locked: false }]);
check("1 分钱档位允许（测试用）", oneCent[0].payCny === 0.01 && oneCent[0].credits === 250);

// ── 付款状态映射 ──
const now = Date.now();
check("已付 → paid", getCreditOrderPayStatus({ status: "paid", createdAt: new Date(now - 99 * 60_000) }, now) === "paid");
check("15 分钟内未付 → pending", getCreditOrderPayStatus({ status: "pending", createdAt: new Date(now - 60_000) }, now) === "pending");
check("超 15 分钟 → unpaid", getCreditOrderPayStatus({ status: "pending", createdAt: new Date(now - PAYMENT_ORDER_EXPIRE_MS - 1000) }, now) === "unpaid");
check("closed → unpaid", getCreditOrderPayStatus({ status: "closed", createdAt: new Date(now) }, now) === "unpaid");

// ── 实付金额：少付必须拒、足额/多付放行、脏数据必须拒 ──
check("足额 50 == 50", isPaidAmountEnough(50, "50.00"));
check("多付 60 > 50 放行", isPaidAmountEnough(50, "60.00"));
check("1 分钱档足额", isPaidAmountEnough(0.01, "0.01"));
check("反向：少付 49.99 < 50", !isPaidAmountEnough(50, "49.99"));
check("反向：少付 0.01 vs 50", !isPaidAmountEnough(50, "0.01"));
check("反向：空字符串", !isPaidAmountEnough(50, ""));
check("反向：非数字", !isPaidAmountEnough(50, "abc"));
check("反向：NaN 串", !isPaidAmountEnough(50, "NaN"));
check("反向：Infinity 串", !isPaidAmountEnough(50, "Infinity"));
check("浮点容差：0.03 三档相加不误判", isPaidAmountEnough(0.03, "0.03"));

// ── 通知报文解析：form / JSON 都要认，垃圾不许崩 ──
const form = parseAlipayNotifyBody("trade_status=TRADE_SUCCESS&out_trade_no=C202609080434362029&total_amount=50.00&sign=abc", "application/x-www-form-urlencoded");
check("form 解析出 out_trade_no", form.out_trade_no === "C202609080434362029");
check("form 解析出 total_amount", form.total_amount === "50.00");
const formEncoded = parseAlipayNotifyBody("out_trade_no=C202609080434362029&subject=%E9%97%AA%E5%BF%B5%E7%A7%AF%E5%88%86", "");
check("form 只 decode 一次（中文正确）", formEncoded.subject === "闪念积分");
const json = parseAlipayNotifyBody(JSON.stringify({ out_trade_no: "C202609080434362029", total_amount: 50, trade_status: "TRADE_SUCCESS" }), "application/json");
check("JSON 解析出 out_trade_no", json.out_trade_no === "C202609080434362029");
check("JSON 数字转字符串", json.total_amount === "50");
check("反向：垃圾串不崩、拿不到订单号", !parseAlipayNotifyBody("!!!!", "").out_trade_no);
check("反向：空 body 不崩", Object.keys(parseAlipayNotifyBody("", "")).length === 0);
check("反向：JSON 数组不被当对象", !parseAlipayNotifyBody("[1,2,3]", "application/json").out_trade_no);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
