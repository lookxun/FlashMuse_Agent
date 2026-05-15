"use client";

import Link from "next/link";
import { useState } from "react";

const homeAssetVersion = "color-fluid-carousel-20260515";
const heroVideos = [
  "/home-assets/hero-background.mp4",
  "/home-assets/hero-dragon.mp4",
  "/home-assets/hero-great-wall.mp4",
  "/home-assets/hero-global-human.mp4",
  "/home-assets/hero-mecha-robot.mp4",
];

export default function Home() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  const activeVideo = heroVideos[activeVideoIndex];

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <video
        key={activeVideo}
        className="absolute inset-0 h-full w-full object-cover"
        src={`${activeVideo}?v=${homeAssetVersion}`}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setActiveVideoIndex((current) => (current + 1) % heroVideos.length)}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(88,130,255,0.28),transparent_26%),radial-gradient(circle_at_78%_20%,rgba(62,211,218,0.2),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.78),rgba(0,0,0,0.42)_46%,rgba(0,0,0,0.72))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34),transparent_34%,rgba(0,0,0,0.78))]" />
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {heroVideos.map((video, index) => (
          <button
            key={video}
            type="button"
            onClick={() => setActiveVideoIndex(index)}
            className={`h-1 rounded-full transition-all ${index === activeVideoIndex ? "w-8 bg-white/82" : "w-3 bg-white/28 hover:bg-white/46"}`}
            aria-label={`切换首页视频 ${index + 1}`}
          />
        ))}
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
        <div className="h-8 w-8 rounded-xl border border-white/18 bg-white/12 shadow-[0_0_32px_rgba(84,176,255,0.32)] backdrop-blur-md" />
        <nav className="hidden items-center gap-8 text-[13px] text-white/68 md:flex">
          <span>创作</span>
          <span>影像</span>
          <span>资产</span>
          <span>工作流</span>
        </nav>
        <button
          type="button"
          onClick={() => setIsLoginOpen(true)}
          className="rounded-full border border-white/18 bg-white/10 px-5 py-2 text-[13px] font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-md transition hover:bg-white/18"
        >
          登录
        </button>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-76px)] items-center px-6 pb-14 pt-10 sm:px-10 lg:px-14">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[12px] text-white/72 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#62e7ff] shadow-[0_0_18px_rgba(98,231,255,0.9)]" />
            AI film creation workspace
          </div>
          <h1 className="max-w-3xl text-balance text-[46px] font-semibold leading-[0.96] tracking-[-0.06em] text-white sm:text-[72px] lg:text-[96px]">
            把想法变成可看的影像。
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-[16px] leading-8 text-white/68 sm:text-[18px]">
            从一句话开始，生成角色、场景、分镜和视频。这里先作为首页占位，后续再接入真实登录、项目管理和公开展示能力。
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-[14px] font-semibold text-black transition hover:bg-white/88"
            >
              邮箱登录
            </button>
            <Link
              href="/workspace"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/16 bg-white/8 px-7 text-[14px] font-medium text-white backdrop-blur-md transition hover:bg-white/14"
            >
              先进入工作台
            </Link>
          </div>
        </div>
      </section>

      {isLoginOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/58 px-5 backdrop-blur-sm" onMouseDown={() => setIsLoginOpen(false)}>
          <div className="w-full max-w-[420px] rounded-[28px] border border-white/14 bg-[#101113]/88 p-6 text-white shadow-[0_36px_110px_rgba(0,0,0,0.58)] backdrop-blur-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[12px] uppercase tracking-[0.26em] text-white/38">Sign in</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">邮箱登录</h2>
                <p className="mt-2 text-[13px] leading-6 text-white/52">登录功能暂为占位，后续接入真实账号系统。</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-xl leading-none text-white/58 transition hover:bg-white/14 hover:text-white"
                aria-label="关闭登录框"
              >
                ×
              </button>
            </div>

            <form className="mt-8 space-y-4" onSubmit={(event) => event.preventDefault()}>
              <label className="block">
                <span className="mb-2 block text-[12px] text-white/48">邮箱</span>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-[14px] text-white outline-none transition placeholder:text-white/28 focus:border-white/26 focus:bg-white/[0.1]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[12px] text-white/48">验证码</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="输入验证码"
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-[14px] text-white outline-none transition placeholder:text-white/28 focus:border-white/26 focus:bg-white/[0.1]"
                  />
                  <button type="button" className="h-12 shrink-0 rounded-2xl bg-white/12 px-4 text-[13px] text-white/78 transition hover:bg-white/18">
                    获取验证码
                  </button>
                </div>
              </label>
              <Link href="/workspace" className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[14px] font-semibold text-black transition hover:bg-white/88">
                登录并进入
              </Link>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
