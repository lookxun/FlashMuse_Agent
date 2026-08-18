-- 用户中心「设置」新增默认偏好：登录默认面板 + 新建对话默认生成参数（图片/视频两组）
ALTER TABLE "User" ADD COLUMN "defaultWorkspacePanel" TEXT NOT NULL DEFAULT 'chat';
ALTER TABLE "User" ADD COLUMN "defaultImageModel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultImageRatio" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultImageResolution" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultVideoModel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultVideoRatio" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultVideoResolution" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultVideoDuration" TEXT NOT NULL DEFAULT '';
