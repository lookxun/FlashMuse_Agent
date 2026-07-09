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
