import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "付费服务协议 · 闪念 FlashMuse",
  description: "杭州亿阅科技有限公司 闪念 FlashMuse 付费服务协议",
};

export default function PaidTermsPage() {
  return (
    <main className="flex-1 bg-white text-[#1a1a1a]">
      <div className="mx-auto w-full max-w-[1000px] px-5 py-10 sm:px-8">
        <h1 className="text-center text-[24px] font-bold">「闪念 FlashMuse」付费服务协议</h1>
        <p className="mt-3 text-[13px] font-medium leading-[1.8] text-[#666]">
          发布日期：2026年9月5日<br />
          生效日期：2026年9月5日
        </p>

        <div className="mt-9 space-y-6 text-[15px] leading-[1.95] text-[#333]">
          <section>
            <p>
              欢迎您使用「闪念 FlashMuse」付费服务。请您在购买或使用付费服务前，仔细阅读、充分理解本协议全部内容，尤其是以加粗方式提示的条款。
            </p>
            <p className="mt-2">
              <strong>如您不同意本协议任一条款，请不要勾选同意、不要点击充值或支付。您勾选同意本协议并完成支付，即视为您已阅读并同意本协议，本协议对您与我们均具有约束力。</strong>
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">一、导言</h2>
            <p>
              1.1 本协议由<strong>杭州亿阅科技有限公司</strong>及其关联方（以下简称“我们”或“公司”）与您（以下简称“用户”）就您购买、使用「闪念 FlashMuse」（以下简称“本平台”）付费服务订立。<br />
              1.2 本协议是<a className="text-[#2ec7c0] underline underline-offset-2" href="/terms">《「闪念 FlashMuse」用户服务协议》</a>及<a className="text-[#2ec7c0] underline underline-offset-2" href="/privacy">《「闪念 FlashMuse」隐私政策》</a>的补充协议。本协议与前述文件不一致的，以本协议为准。<br />
              1.3 您应具备与您行为相适应的民事行为能力。如您是未成年人，请在监护人指导和陪同下阅读本协议，并在征得监护人同意后再购买付费服务。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">二、本协议适用范围</h2>
            <p>
              2.1 本协议目前覆盖本平台的<strong>积分充值服务</strong>。您开通或使用积分充值服务，均适用本协议。<br />
              2.2 我们后续如开通会员订阅、自动续费或其他付费产品，将另行公示对应规则。在该等规则生效前，本协议不视为我们已向您提供相关服务。<br />
              2.3 我们发布的购买须知、页面提示、公告及其他平台规则，均为本协议组成部分。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">三、名词定义</h2>
            <p>
              3.1 “本平台”：指我们合法拥有并运营的、名称为「闪念 FlashMuse」的网站及相关服务。<br />
              3.2 “积分”：指我们向您提供的、用于在本平台兑换图片生成、视频生成、语音生成等功能的虚拟工具。不同功能、模型消耗的积分数可能不同，以届时页面提示为准。<br />
              3.3 “充值积分”：指您通过本平台支付人民币购买并到账的积分。<br />
              3.4 “赠送积分”：指我们因注册、活动或其他方式向您发放的积分。<br />
              3.5 “服务费”：指您为购买积分实际支付的费用，以订单结算页为准。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">四、积分服务说明</h2>
            <p>
              4.1 积分仅可用于本平台内约定功能的消耗，<strong>不可转赠、不可提现、不可反向兑换为人民币或其他货币，亦不可兑换尚未开通的会员服务。</strong><br />
              4.2 <strong>充值积分永久有效。</strong>赠送积分的有效期以发放时页面说明为准；如未特别说明，赠送积分亦永久有效。<br />
              4.3 您可在用户中心查看积分余额、充值记录和消耗记录。前述记录将作为您使用积分的有效依据。如您对记录有异议，可通过本协议约定的方式与我们联系。<br />
              4.4 请您根据自身实际需求购买相应数量的积分，并谨慎确认账号、金额后再支付。<strong>因您输错账号、选错金额、操作不当造成的损失，由您自行承担。</strong><br />
              4.5 如因系统故障导致您实际到账积分少于应付数量，我们将在核实后补足差额；如实际到账多于应付数量，我们有权从您的账号中扣除差额。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">五、费用、购买与支付</h2>
            <p>
              5.1 积分充值采用预充值消耗模式。具体档位、价格、到账积分数以您购买时页面展示及订单结算页为准。<br />
              5.2 我们有权根据成本、模型更新及运营需要调整价格。您在调整生效前已购买的积分不受影响；再次购买时适用调整后的价格。<br />
              5.3 您应通过本平台指定的支付方式完成支付。支付渠道可能另行收取手续费，请以支付页面提示为准。<br />
              5.4 如页面价格显示异常，请立即停止支付并联系我们。实际成交价格以订单结算页为准。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">六、退款</h2>
            <p>
              <strong>6.1 积分属于网络虚拟商品，采用先收费后服务的方式。原则上不支持无理由退款。</strong><br />
              6.2 存在以下情形的，您可申请退款：因本服务存在重大瑕疵导致您完全无法使用；因系统故障导致重复扣款或积分未到账；无民事行为能力人或限制民事行为能力人未经监护人同意误操作付费；法律法规要求必须退款或我们同意退款的其他情形。<br />
              6.3 经核实符合退款条件的，我们有权在退款金额中扣除您已实际消耗积分对应的费用，并收回对应剩余权益。<br />
              <strong>6.4 付费完成后即时到账，积分不可转让、转借或以其他方式提供给第三方使用。</strong>
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">七、使用规范</h2>
            <p>
              7.1 积分仅限您本人通过您的账号使用。未经我们书面同意，禁止赠与、借用、出租、转让、售卖积分或账号。<br />
              7.2 您不得以盗窃、利用系统漏洞、非官方渠道购买、恶意刷取等方式获取积分。一经发现，我们有权取消相关积分且不予退款，并保留追究责任的权利。<br />
              7.3 您使用积分兑换生成服务时，仍应遵守用户服务协议关于合法使用、内容审核及不得侵害他人权益的约定。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">八、中止与终止</h2>
            <p>
              8.1 您可停止充值或停止使用本服务。如您注销账号，未消耗的充值积分原则上不予折现。<br />
              8.2 因您违约、违法，或应监管要求、不可抗力，我们有权中止或终止向您提供付费服务。<br />
              8.3 除法律法规另有规定或本协议另有约定外，服务中止或终止后，已收取的费用不予退还。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">九、免责与责任限制</h2>
            <p>
              9.1 因不可抗力、网络故障、系统维护、第三方支付异常等造成的服务中断或延迟，我们在法律允许范围内不承担责任，但会尽快恢复服务。<br />
              9.2 除法律法规另有明确规定外，我们对您承担的全部责任不超过您就相关争议订单实际支付的费用。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-[16px] font-bold text-[#1a1a1a]">十、法律适用与联系我们</h2>
            <p>
              10.1 本协议适用中华人民共和国法律。因本协议产生的争议，双方应友好协商；协商不成的，向杭州亿阅科技有限公司所在地有管辖权的人民法院提起诉讼。<br />
              10.2 运营主体：杭州亿阅科技有限公司。如您对本协议有疑问，可通过平台内官方联系方式与我们联系。
            </p>
          </section>

          <p className="pt-4 text-[13px] text-[#888]">
            同时请阅读 <Link href="/terms" className="text-[#2ec7c0] underline underline-offset-2">用户服务协议</Link> 与 <Link href="/privacy" className="text-[#2ec7c0] underline underline-offset-2">隐私政策</Link>。
          </p>
        </div>
      </div>
    </main>
  );
}
