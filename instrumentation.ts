export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // 延迟且隔离启动，任何失败都不能影响服务器启动 / 登录等请求。
  setTimeout(() => {
    void (async () => {
      try {
        const { startGenerationWorker } = await import("@/lib/generation-worker");
        startGenerationWorker();
      } catch (error) {
        console.warn("[instrumentation] startGenerationWorker failed", error instanceof Error ? error.message : String(error));
      }
    })();
  }, 4000);
}
