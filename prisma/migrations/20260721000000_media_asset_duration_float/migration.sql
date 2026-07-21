-- MediaAsset.durationSeconds: 秒时长改为浮点，保留小数（精确到 0.1 秒），
-- 用于参考视频/音频总时长校验（BytePlus r2v 上限约 15 秒，之前存整数丢精度导致漏拦）。
ALTER TABLE "MediaAsset" ALTER COLUMN "durationSeconds" TYPE DOUBLE PRECISION;
