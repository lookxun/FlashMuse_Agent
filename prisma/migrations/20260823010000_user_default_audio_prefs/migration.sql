-- 用户中心「设置」新增新建对话默认语音参数
ALTER TABLE "User" ADD COLUMN "defaultAudioModel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultAudioVoice" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "defaultAudioEmotion" TEXT NOT NULL DEFAULT '';
