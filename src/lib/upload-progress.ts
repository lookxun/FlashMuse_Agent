// 上传进度追踪器：让进度条更真实地反映"客户端→Ali(边缘)→马来(源站)"两段链路。
//
// 背景：xhr.upload.onprogress 只能测"浏览器→最近一跳"发出去了多少字节，
// 测不到 Ali 转发到马来 + 服务端落盘 + 响应回来这后半段。以前直接把字节进度
// 映射到 0~95% 并封顶，导致要么秒到 95% 干等、要么进度条很"假"。
//
// 现在：
//   1) 字节上传阶段映射到 0 ~ cap，cap 是每次上传随机 60~70(所以每次不一样)。
//   2) 字节发完后，用定时器"慢慢爬"从 cap 到 ~99(反映后半段 Ali→马来+服务端处理，
//      这段没有原生进度事件)，越接近 99 爬得越慢。
//   3) 收到服务端响应(finish)才跳 100；出错/取消(cancel)停掉定时器。
// 进度只增不减(单调)。

export interface UploadProgressTracker {
  onUploadProgress: (event: ProgressEvent) => void;
  onBytesComplete: () => void;
  finish: () => void;
  cancel: () => void;
}

/**
 * 进度回调节流（2026-08-04 加）。
 *
 * ⛔⛔ 为什么需要它：**工作流**的进度回调是 `updateNode(nodeId, { uploadProgress })`，
 *   而 `updateState` 每调一次要做：从 tldraw 导出整张画布 + `JSON.stringify(整张画布)`
 *   （重度用户实测 655KB）+ 对**所有**节点 `updateShape` + O(边×节点) 的连线同步 +
 *   整个画布 React 重渲染，父级还要再算 3 个快照 ×新旧两份 = 6 次全画布遍历。
 *   而进度事件一次上传约 **70~100 次**（字节阶段按整数变化 + 每 450ms 爬一格的定时器）
 *   → 上传期间主线程被自己刷爆，表现为"工作流上传比对话流慢/一顿一顿的"，
 *   且**工作流节点越多越卡**（O(进度次数 × 节点数 × 画布大小)）。
 *
 * ⭐ 只在"贵"的调用方用它（工作流画布）。对话流的进度只更新一个小对象，保持原来的顺滑。
 * ⭐ 100 一定放行（它是收尾值）；其余要么涨够 5%、要么隔了 300ms 才放行。
 */
export function throttleUploadProgress(emit: (progress: number) => void, minStep = 5, minIntervalMs = 300) {
  let lastValue = -1;
  let lastAt = 0;
  return (progress: number) => {
    const now = Date.now();
    if (progress < 100 && progress - lastValue < minStep && now - lastAt < minIntervalMs) return;
    lastValue = progress;
    lastAt = now;
    emit(progress);
  };
}

export function createUploadProgressTracker(onProgress?: (progress: number) => void): UploadProgressTracker {
  // 客户端→Ali 这一段的封顶，每次随机 60~70，让每次上传观感不同。
  const cap = 60 + Math.floor(Math.random() * 11);
  let current = 0;
  let bytesDone = false;
  let creepTimer: ReturnType<typeof setInterval> | null = null;

  const emit = (value: number) => {
    const next = Math.max(current, Math.min(99, Math.round(value)));
    if (next !== current) {
      current = next;
      onProgress?.(current);
    }
  };

  const stopCreep = () => {
    if (creepTimer) {
      clearInterval(creepTimer);
      creepTimer = null;
    }
  };

  const onBytesComplete = () => {
    if (bytesDone) return;
    bytesDone = true;
    emit(cap);
    stopCreep();
    creepTimer = setInterval(() => {
      const remaining = 99 - current;
      if (remaining <= 0) {
        stopCreep();
        return;
      }
      // 衰减步进：越接近 99 每步越小，营造"慢慢爬、越到后面越慢"的真实感。
      emit(current + Math.max(0.4, remaining * 0.06));
    }, 450);
  };

  const onUploadProgress = (event: ProgressEvent) => {
    if (bytesDone) return;
    if (!event.lengthComputable) return;
    const frac = event.total > 0 ? event.loaded / event.total : 0;
    emit(Math.max(2, frac * cap));
    if (frac >= 1) onBytesComplete();
  };

  const finish = () => {
    stopCreep();
    current = 100;
    onProgress?.(100);
  };

  const cancel = () => {
    stopCreep();
  };

  return { onUploadProgress, onBytesComplete, finish, cancel };
}
