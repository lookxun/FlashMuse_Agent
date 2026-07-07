import { claimImageJobs, claimVideoJobs, runImageJob, runVideoJob } from "@/lib/generation-jobs";

/**
 * 常驻生成 worker：定时认领并执行图片任务（视频后续接入）。
 * - 单进程内 setInterval 驱动；认领用 DB lease + FOR UPDATE SKIP LOCKED 防并发重复。
 * - 服务重启后靠"lease 过期回收"自愈：卡在 running 且 lease 超过 10 分钟的任务会被重新认领。
 * - 前端断开/退出/刷新都不影响：任务状态、扣费、存盘全在后端完成。
 */

const TICK_INTERVAL_MS = 2500;
const IMAGE_BATCH = 3;
const VIDEO_BATCH = 4;
const MAX_CONCURRENT_IMAGE = 6;
const MAX_CONCURRENT_VIDEO = 8;
let started = false;
let running = false;
let nudgeTimer: ReturnType<typeof setTimeout> | undefined;
const inFlight = new Set<string>();
const inFlightVideo = new Set<string>();

async function tick() {
  if (running) return;
  running = true;
  try {
    const capacity = Math.max(0, MAX_CONCURRENT_IMAGE - inFlight.size);
    if (capacity > 0) {
      const jobs = await claimImageJobs(Math.min(IMAGE_BATCH, capacity));
      for (const job of jobs) {
        if (inFlight.has(job.id)) continue;
        inFlight.add(job.id);
        // 不 await：让多张图并发在后台跑，tick 继续认领其它任务。
        void runImageJob(job).finally(() => inFlight.delete(job.id));
      }
    }

    const videoCapacity = Math.max(0, MAX_CONCURRENT_VIDEO - inFlightVideo.size);
    if (videoCapacity > 0) {
      const videoJobs = await claimVideoJobs(Math.min(VIDEO_BATCH, videoCapacity));
      for (const job of videoJobs) {
        if (inFlightVideo.has(job.id)) continue;
        inFlightVideo.add(job.id);
        void runVideoJob(job).finally(() => inFlightVideo.delete(job.id));
      }
    }
  } catch (error) {
    console.warn("[generation-worker] tick failed", { error: error instanceof Error ? error.message : String(error) });
  } finally {
    running = false;
  }
}

/** 提交任务后可立即调用，缩短首次开始的等待（有 lease 防重复）。 */
export function nudgeGenerationWorker() {
  if (!started) return;
  if (nudgeTimer) return;
  nudgeTimer = setTimeout(() => {
    nudgeTimer = undefined;
    void tick();
  }, 100);
}

export function startGenerationWorker() {
  if (started) return;
  started = true;
  console.log("[generation-worker] started");
  const loop = () => {
    void tick().finally(() => {
      setTimeout(loop, TICK_INTERVAL_MS);
    });
  };
  // 启动稍作延迟，等 DB/连接就绪；首轮 tick 即会回收重启前遗留的 running 任务。
  setTimeout(loop, 3000);
}
