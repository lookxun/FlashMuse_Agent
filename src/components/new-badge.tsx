/**
 * 「NEW」小徽标的唯一权威（2026-08-03 收敛）。
 *
 * ⛔ 原来有两份各不相同的写法：模型下拉里是 `rounded-[3px]` + 青绿 `#14b8a6`，
 *    侧边栏「工作流模式」是 `rounded-full` + 绿色 `#2fbf4f` —— 同一个东西两种长相。
 *    🗣️ 2026-08-03 用户拍板统一成模型下拉那款（青绿小圆角）。
 *
 * ⭐ 文字必须写在 `<span>` 上（本组件就是 span）：tldraw 的 `ui.css` 有一条**无 layer** 的
 *    `button { font-size: inherit }`，会把写在 `<button>` 上的 Tailwind 字号整条吃掉 ——
 *    工作流画布里的模型菜单是 button，徽标当 span 放进去才不会被吃（详见 AGENTS.md 那条铁律）。
 */
export function NewBadge({ className = "" }: { className?: string }) {
  return <span className={`shrink-0 rounded-[3px] bg-[#14b8a6] px-1 py-0.5 text-[10px] font-semibold leading-none text-white ${className}`}>NEW</span>;
}
