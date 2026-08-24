"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, CSSProperties, DragEvent, PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import { createPortal, flushSync } from "react-dom";
import { validateImageUploadFile } from "@/lib/image-upload-validation";
import { IS_TEST_SERVER, versionLabel } from "@/lib/app-version";
import { MEDIA_DURATION_EPSILON_SECONDS, validateMediaUploadFile, validateMediaUploadMetadata, validateReferenceMediaDurationRange as validateMediaDuration } from "@/lib/media-upload-validation";
import { getStaticMediaUrl } from "@/lib/static-media-url";
import { RiAddLine, RiArrowLeftSLine, RiArrowRightSLine, RiArrowDownSLine, RiArrowDownFill, RiArrowUpDownLine, RiArrowUpLine, RiArrowUpSLine, RiArrowDownWideLine, RiAtLine, RiCameraLine, RiCheckLine, RiChat3Line, RiChatSmileAiLine, RiChatDeleteLine, RiCheckboxMultipleBlankLine, RiCloseLine, RiDeleteBinLine, RiEmotionHappyLine, RiEmotionUnhappyLine, RiEmotionSadLine, RiEqualizerLine, RiErrorWarningLine,   RiFolderLine, RiFolderOpenLine, RiInboxArchiveLine, RiBellLine, RiFormatClear, RiLandscapeLine, RiImageLine, RiSidebarFoldLine, RiSidebarUnfoldLine, RiLeafLine, RiLoader4Line, RiLockPasswordLine, RiMoreLine, RiMusic2Line, RiMultiImageLine, RiMailLine, RiPhoneLine, RiEditBoxLine, RiPushpinLine, RiResetLeftLine, RiRefreshLine, RiShining2Line, RiStarSmileLine, RiStopFill, RiThumbDownLine, RiThumbDownFill, RiThumbUpLine, RiThumbUpFill, RiTimeLine, RiVipCrown2Line, RiVipDiamondLine, RiVideoLine, RiVideoOnLine, RiVoiceprintLine, RiQuillPenAiLine, RiAccountBoxLine, RiAccountCircleLine, RiFilmLine, RiFullscreenLine, RiInformationLine, RiGlobalLine, RiGitMergeLine, RiGitPullRequestLine, RiFilmAiLine, RiImageAddLine, RiImageAiLine, RiMicAiLine, RiDownloadLine, RiRobot2Line, RiZoomInLine, RiTBoxLine, RiTerminalWindowFill, RiLogoutBoxRLine, RiSettingsLine, RiSunLine, RiMoonLine, RiComputerLine, RiNotification2Line, RiShieldUserLine } from "react-icons/ri";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, DEFAULT_AUDIO_MODEL, audioGenerationModels, isAudioModel, DEFAULT_IMAGE_QUALITY, IMAGE_QUALITY_OPTIONS, IMAGE_QUALITY_LABELS, isGptImage2Model, getGenerationModelSelectHint, bytePlusVideoGenerationModels, frontendConversationModels, frontendImageGenerationModels, getImageQualityBadgeLabel, getImageResolutionLabel, getSupportedImageRatios, getSupportedImageResolutions, getSupportedVideoRatios, getSupportedVideoResolutions, imageGenerationModels, isNonStandardVideoSize, normalizeImageRatioForModel, normalizeImageResolutionForModel, normalizeVideoRatioForModel, normalizeVideoResolutionForModel, validateVideoDurationWithReferences, videoGenerationModels, ConversationModel, GenerationModel, ModelName, PROMPT_TOOL_MODEL_CHAIN } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";
import { handleSessionExpiredResponse } from "@/lib/session-expired-redirect";
import { removeMentionName } from "@/lib/mention-text";
import { useBodyScrollLock } from "@/components/use-body-scroll-lock";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { AudioWaveformPlayer } from "@/components/audio-waveform-player";
import { AudioVoicePicker } from "@/components/audio-voice-picker";
import { AssetMentionPicker } from "@/components/asset-mention-picker";
import { getAudioVoiceLabel, getAudioVoiceLang, getAudioVoiceLangsForModel, getAudioVoicesForModel, getDefaultAudioVoiceId, isAudioVoiceSelectable, normalizeAudioVoiceForModel, type AudioVoiceLang } from "@/lib/audio-voices";
import { AUDIO_EMOTION_DEFAULT_ID, getAudioEmotionLabel, getAudioEmotionsForModel, isAudioEmotionSelectable, normalizeAudioEmotionForModel } from "@/lib/audio-emotions";
import { VideoUploadThumbnail } from "@/components/video-upload-thumbnail";
import { VideoPlayBadge } from "@/components/video-play-badge";
import { NewBadge } from "@/components/new-badge";
import { validateVideoReferenceImagesBeforeSend, videoModelEnforcesReferenceImageSizeRules } from "@/lib/video-reference-image-rules";
import { WorkflowCanvas, WorkflowCanvasState, WorkflowNode } from "@/components/workflow-tldraw-canvas";
import { FISH_AUDIO_CLONE_MAX_SECONDS, FISH_AUDIO_CLONE_MIN_SECONDS, getEffectiveVideoReferenceItems, getSupportedUploadTypeLabel, getUploadAcceptValue, getUploadKindFromFileName, getUploadRule, getVideoAudioUploadDisabledMessage, getVideoReferenceLimitHint, normalizeAudioReferenceModeForModel, supportsAudioCloneMode, supportsVideoReferenceMode, validateReferenceTotalDuration, validateVideoReferenceCombination, UploadRuleOverrides } from "@/lib/upload-rules";
import { countPromptLength, getPromptCeilingTipText, getPromptLimitTooltipText, getPromptMaxLength, getPromptOverLimitTipText, isPromptOverLimit, PROMPT_MAX_LENGTH_CEILING, type PromptLengthOverrides } from "@/lib/prompt-length";
import { PromptLengthCounterRow } from "@/components/prompt-length-counter";
import {
  HISTORY_INITIAL_SESSION_COUNT,
  HISTORY_LOAD_MORE_COUNT,
  WORKFLOW_INITIAL_ITEM_COUNT,
  WORKFLOW_LOAD_MORE_COUNT,
  WORKFLOW_MODE_ENABLED,
  type Message,
  type PromptDetail,
  type ImageReference,
  type ImageDimensions,
  type ImageResultSlot,
  type CharacterGenerationResult,
  type AssetGenerateJob,
  type AssetTargetType,
  type SuggestionInput,
  type AssetItem,
  type WorkflowImportAsset,
  type AssetGenerationImageType,
  type AssetGenerateRatio,
  UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
  type AssetUploadSlot,
  type ReminderMessage,
  type AssetMediaUploadCard,
  type ChatPayloadMessage,
  type UploadedDocumentFile,
  type UploadedFileEntry,
  type MediaFileReference,
  type PendingGeneration,
  type VideoReferenceMode,
  type AudioReferenceMode,
  getVideoReferenceModeOptions,
  getAudioReferenceModeOptions,

  type WorkMode,
  type UploadedImage,
  type GenerationSettings,
  type ControlMenuName,
  type ModeMenuName,
  type ActivePanel,
  type UserDialogTab,
  type WorkspaceStorageMode,
  type WorkspaceLoadStatus,
  type UserLanguage,
  type AssetFilter,
  type WorkSession,
  type SessionMemorySummary,
  type WorkspaceStatePayload,
  type CurrentUserProfile,
  type UsageMeta,
  type CreditMeta,
  type UserCreditConversation,
  userCreditSourceIcons,
  userCreditSourceLabels,
  type WorkflowItem,
  type IntentMode,
  type ChatApiResponse,
  type AgentPlanResponse,
  type IntentMemoryRule,
  type FeedbackKind,
  type FeedbackLogEntry,
  type PreviewMediaMeta,
  type StoredInputSettings,
  type AgentModelTier,
  HOME_PROMPT_STORAGE_KEY,
  WORKSPACE_USER_DIALOG_STORAGE_KEY,
  WORKSPACE_THEME_STORAGE_KEY,
  type WorkspaceThemeMode,
  getStoredWorkspaceThemeMode,
  getSystemPrefersDark,
  ASSET_TRASH_RETENTION_MS,
  MAX_INTENT_MEMORY_RULES,
  MAX_FEEDBACK_LOGS,
  MAX_SESSION_PENDING_REQUESTS,
  GENERIC_MEDIA_ERROR_MESSAGE,
  legacyMediaUrlReplacements,
  MALAYSIA_WORKSPACE_URL,
  ALI_WORKSPACE_URL,
  videoPosterVersion,
  type WorkspaceSite,
  getCurrentWorkspaceSite,
  delay,
  fetchJsonWithRetry,
  getDownloadUrl,
  isGenericMediaReason,
  type MediaSaveStatusJob,
  preloadSavedMediaBeforeReplace,
  isRemoteMediaUrl,
  getVideoPlaybackUrl,
  collectRemoteMediaUrls,
  replaceSessionMediaUrls,
  replaceAssetMediaUrls,
  replaceAssetGenerateJobMediaUrls,
  replaceWorkflowItemMediaUrls,
  MAX_USER_NICKNAME_LENGTH,
  RETRY_IMAGE_SIDE,
  RETRY_IMAGE_QUALITY,
  FINAL_RETRY_IMAGE_SIDE,
  FINAL_RETRY_IMAGE_QUALITY,
  FAST_VIDEO_POLL_INTERVAL_MS,
  SLOW_VIDEO_POLL_INTERVAL_MS,
  FAST_VIDEO_POLL_ATTEMPTS,
  MIN_AGENT_THINKING_MS,
  DEFAULT_AGENT_SUGGESTIONS,
  assetTypeLabels,
  assetGenerationTypes,
  ASSET_UPLOAD_SLOT_COUNT,
  ASSET_RENDER_PAGE_SIZE,
  assetTypeIcons,
  ASSET_IMPORT_CATEGORIES,
  MENTION_CATEGORIES,
  MENTION_CATEGORY_FILTERS,
  CHARACTER_MENTION_CATEGORIES,
  isAssetGenerationAsset,
  isWorkflowAsset,
  isConversationAsset,
  getMediaThumbnailUrl,
  HoverImagePreview,
  assetToMentionPickerItem,
  initialMessages,
  getQuickActionRows,
  videoStatusLabels,
  imageStatusLabels,
  ratioOptions,
  imageResolutionOptions,
  videoResolutionOptions,
  imageCountOptions,
  styleOptions,
  durationOptions,
  userLanguageOptions,
  modeOptions,
  modeNoticeText,
  toolButtonClassName,
  toolButtonActiveClassName,
  DEFAULT_CHARACTER_IMAGE_MODEL,
  DEFAULT_CHARACTER_IMAGE_RESOLUTION,
  generationModelOptions,
  isGenerationModelOption,
  formatDimensionValue,
  getDefaultUserAvatar,
  getUserText,
  getLanguageDisplayName,
  applyDocumentLanguage,
  getVideoDurationOptions,
  getGenerationModelLabel,
  getConversationModelLabel,
  conversationModelSupportsImages,
  getActualTextModelLabel,
  getImageCountValue,
  getAgentGenerationModel,
  getAgentAutoChatModelChain,
  getAgentGenerationSettings,
  getAgentGenerationSettingsFromPlan,
  joinPromptDetail,
  getPromptSourceDetail,
  getAgentPromptDetailFromPlan,
  getAgentItemPromptDetailsFromPlan,
  getAgentVideoItemSettingsFromPlan,
  getAgentImageVariantPrompt,
  getAgentDisplayTextFromPlan,
  getAgentMediaDisplayText,
  isAgentGeneratedMedia,
  getMessageVideos,
  getSessionMediaCounts,
  isWorkflowItemRunning,
  getWorkflowMediaCounts,
  getWorkflowGeneratedMediaUrls,
  getLocalVideoPosterUrl,
  getVideoPosterForMessage,
  preloadUploadedMedia,
  isWorkMode,
  mergeValidModeSettings,
  getGenerationModelIcon,
 isGoldGenerationModel,
  isNewGenerationModel,

  isGoldConversationModel,
  ToolButtonLabel,
  IconRenderer,
  BlackHoverTooltip,
  UsageSummaryButton,
  RatioOptionIcon,
  ResolutionOptionIcon,
  getVideoResolutionLabel,
  CompactResolutionIcon,
  getCommonRatioLabel,
  getImageResolutionFromDimensions,
  getVideoResolutionFromDimensions,
  getRequestedImageDisplayCount,
  getDisplayImageItemsForMessage,
  getDisplayImagesForMessage,
  getDisplayImageResultSlotsForMessage,
  getImageVariantPages,
  getPreviewMetaWithDimensions,
  normalizeMediaUrlForMatch,
  getAssetIdentityKey,
  messageHasMediaUrl,
  getPreviewMediaMeta,
  getWorkflowNodeSourcePrompt,
  getWorkflowPreviewMeta,
  getPreviewMetaDimensions,
  isInvalidPersistedPrompt,
  getImageSourcePrompt,
  getAgentMediaPromptItems,
  AgentMediaPromptPanel,
  MediaPromptBlock,
  AiGenerate3dIcon,
  getDisplayDimensions,
  ThinkingIndicator,
  ThinkingProcessBlock,
  PromptOptimizingOverlay,
  LoadingSpinner,
  InlineLoadingDots,
  HaloPulseIndicator,
  FeedbackButton,
  ActiveMessageCircleXIcon,
  ActiveAngryIcon,
  getAssistantMessageIds,
  TypewriterFormattedMessage,
  createSession,
  addUsageSummary,
  nowTimestamp,
  createClientId,
  getNextWorkflowTitleFromNumber,
  getMaxWorkflowTitleNumber,
  createWorkflowItem,
  createNumberedWorkflowItem,
  isUntitledWorkflow,
  isDeletedWorkflow,
  isArchivedWorkflow,
  isVisibleWorkflow,
  hasWorkflowAction,
  getWorkflowTextSnapshot,
  getWorkflowMediaSnapshot,
  getWorkflowMeaningfulSnapshot,
  ensureWorkflowItems,
  getPersistableWorkflowItems,
  normalizeWorkflowCodesAndMediaNumbers,
  normalizeStoredWorkflowItems,
  isEmptySession,
  getSessionPendingRequests,
  isDeletedSession,
  isArchivedSession,
  isVisibleSession,
  sortByUpdatedAtDesc,
  getPersistableSessions,
  getSessionTitle,
  formatMessageTime,
  formatCreditLastActiveTime,
  formatElapsedTime,
  getVideoWaitProgress,
  isAssetFilter,
  type StoredWorkspaceUiState,
  getStoredWorkspaceUiState,
  setStoredWorkspaceUiState,
  normalizeSuggestionItem,
  getCorrectionMode,
  shouldPlanAgentTask,
  isExplicitImageGenerationRequest,
  isExplicitVideoGenerationRequest,
  suggestionRequestsGeneration,
  getLastUserMessage,
  upsertIntentMemoryRule,
  getImageOnlyPrompt,
  toChatPayloadMessages,
  estimateMessageTokens,
  shouldUpdateMemorySummary,
  getSummarySourceMessages,
  applyMemorySummaryToPayload,
  toGeneralPayloadMessages,
  toAgentPayloadMessages,
  toPromptPayloadMessages,
  normalizeMessageSuggestions,
  getAgentMediaSuggestions,
  getAssetTypeFromText,
  sanitizeAssetName,
  removeAllMentionNames,
  getWorkflowNumberFromTitle,
  getWorkflowCode,
  buildConversationMediaSystemName,
  getMediaSystemName,
  isUploadedAssetUrl,
  isUploadPromptPlaceholder,
  isUploadedAsset,
  isConversationUploadedAsset,
  isAssetInFilter,
  normalizeSessionCodesAndMediaNames,
  getConversationAssetName,
  getNextAssetGenerationName,
  getReferencedAssets,
  getMentionedAssets,
  getMentionNames,
  getAtQueryAtCursor,
  getUploadedImageReferenceName,
  getUploadedReferenceBaseName,
  makeUniqueReferenceName,
  createAssetUploadSlots,
  normalizeAssetUploadSlots,
  getDefaultAssetUploadType,
  readFileAsDataUrl,
  reportClientDiagnostic,
  uploadDocumentFileAsset,
  uploadTemporaryAssetImage,
  commitTemporaryAssetImage,
  uploadTemporaryAssetImageAndCommit,
  deleteTemporaryAssetImages,
  getDataUrlImageDimensions,
  toUploadedAssetReference,
  toUploadedFileAssetReference,
  getUniqueUploadedAssetName,
  getConversationImageReferences,
  getOrderedExplicitImageReferences,
  getReferenceHint,
  replaceMentionNamesForModelPrompt,
  enforceAssetGeneratePropStylePrompt,
  enforceAssetGenerateStylePrompt,
  getCharacterGenerationRuleText,
  getCharacterPromptOptimizationRuleText,
  getSceneGenerationRuleText,
  getScenePromptOptimizationRuleText,
  getShotGenerationRuleText,
  getShotPromptOptimizationRuleText,
  getPropGenerationRuleText,
  getPropPromptOptimizationRuleText,
  getProfessionalPromptOptimizationRuleText,
  getValidReferenceNames,
  getAssetReferencesText,
  isVideoAsset,
  isAudioAsset,
  isUploadedMediaAsset,
  isNonDisplayableFileAsset,
  isAssetTrashExpired,
  getRestoreAssetType,
  normalizeStoredAssets,
  getPersistableAssetGenerateJobs,
  normalizeStoredAssetGenerateJobs,
  applySessionMediaSystemNamesToAssets,
  reserveWorkflowMediaSystemNamesForItems,
  applyAssetGenerationSystemNames,
  extractAssetsFromSessions,
  BYTEPLUS_AUTO_REVIEW_NOTICE,
  isBytePlusAutoReviewNotice,
  isAgentActivationMessage,
  InlineAssistantIcon,
  SuggestionButtons,
  getSelectionTextOffset,
  getSelectionTextRange,
  setSelectionTextOffset,
  PlainMentionEditor,
  ReferencedTextContent,
  UserMessageContent,
  ReminderToast,
  SettingsSwitch,
  SettingsSelect,
  ReferenceThumbnailStrip,
  UploadedDocumentStrip,
  getDisplayImageReferences,
  AssetManagementPanel,
  readJson,
  isAbortLikeError,
  isTransientVideoPollStatus,
  getApiErrorMessageWithCode,
  resultErrorMessage,
  mediaFailureMessage,
  mediaFailureReasons,
  UploadProgressOverlay,
  normalizeMediaErrorText,
  persistUploadedImagesForSend,
  getMessageType,
  LazyMediaMount,
  InlineVideoResult,
  ImageResultStrip,
  ImageResultSlotStrip,
  VideoFailedCard,
  MediaWaitingCard,
  compressReferenceImagesForRetry,
  toPromptPreviewPayloadMessages,
  isRequestTooLargeError,
  readFileAsUploadedImage,
  readFileAsAssetUploadItem,
  getFileExtension,
  getMimeFileExtension,
  isReadableDocumentFile,
  getUploadedFileMediaKind,
  isUploadedMediaFile,
  getUploadedMediaFileUrl,
  getUploadedDocumentMeta,
  getUploadedFileKey,
  formatUploadedFileSize,
  getUploadedFileDisplayName,
  getUploadedFileMetaName,
  getUploadedFileStorageValue,
  getUploadedMediaDuration,
  validateReferenceVideoDimensions,
  getUploadedFilePreviewAsset,
  getUploadedMediaReferences,
  getDocumentOnlyUploadedFiles,
  DocumentPreviewPanel,
  createUploadedDocumentEntry,
  readMediaFileMetadata,
  readMediaMetadataFromUrl,
  readDocumentFileText,
  copyImageToClipboard,
  getDownloadName,
  MediaCardHoverActions,
} from "@/lib/chat/chat-workbench-core";
import { VideoDurationSlider } from "@/components/video-duration-slider";

export function ChatWorkbench() {
  const workspaceInstanceIdRef = useRef(createClientId());
  const workspaceInstanceClaimedRef = useRef(false);
  const initialWorkspaceUiStateRef = useRef<StoredWorkspaceUiState | null>(null);
  if (initialWorkspaceUiStateRef.current === null) initialWorkspaceUiStateRef.current = getStoredWorkspaceUiState();
  const [mode, setMode] = useState<WorkMode>("agent");
  const [agentModelTier, setAgentModelTier] = useState<AgentModelTier>("normal");
  const [activePanel, setActivePanel] = useState<ActivePanel>(() => initialWorkspaceUiStateRef.current?.activePanel ?? "chat");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>(() => initialWorkspaceUiStateRef.current?.assetFilter ?? "character_image");
  const [assetsLoadStatus, setAssetsLoadStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [assetLoadingReason, setAssetLoadingReason] = useState<"" | "initial" | "scroll" | "auto">("");
  const [loadedAssetFilters, setLoadedAssetFilters] = useState<Partial<Record<AssetFilter, boolean>>>({});
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({});
  const [assetImportOpen, setAssetImportOpen] = useState(false);
  const [assetImportFilter, setAssetImportFilter] = useState<AssetFilter>("character_image");
  const [assetImportItemsByFilter, setAssetImportItemsByFilter] = useState<Partial<Record<AssetFilter, AssetItem[]>>>({});
  const [assetImportPaging, setAssetImportPaging] = useState<Partial<Record<AssetFilter, { hasMore: boolean; nextOffset: number; loading: boolean }>>>({});
  const [assetImportCounts, setAssetImportCounts] = useState<Record<string, number>>({});
  const [assetImportSelected, setAssetImportSelected] = useState<Record<string, WorkflowImportAsset>>({});
  const [assetsToImport, setAssetsToImport] = useState<WorkflowImportAsset[]>([]);
  // 「@引用资产」弹窗按标签懒加载分页（和资产库右侧一致）：每标签独立 loading/hasMore/nextOffset。
  const [mentionFilterPaging, setMentionFilterPaging] = useState<Partial<Record<AssetFilter, { loading: boolean; hasMore: boolean; nextOffset: number }>>>({});
  const [assetsHasMore, setAssetsHasMore] = useState(false);
  const [assetsNextOffset, setAssetsNextOffset] = useState(0);
  const [assetScrollTopByFilter, setAssetScrollTopByFilter] = useState<Partial<Record<AssetFilter, number>>>(() => initialWorkspaceUiStateRef.current?.assetScrollTopByFilter ?? {});
  const assetScrollTopByFilterRef = useRef<Partial<Record<AssetFilter, number>>>({});
  const previousAssetFilterRef = useRef<AssetFilter>(assetFilter);

  const [selectedRatios, setSelectedRatios] = useState<Record<WorkMode, string>>({
    general: ratioOptions[0],
    agent: ratioOptions[0],
    image: ratioOptions[0],
    video: ratioOptions[0],
    audio: ratioOptions[0],
  });
  const [selectedResolutions, setSelectedResolutions] = useState<Record<WorkMode, string>>({
    general: imageResolutionOptions[0],
    agent: imageResolutionOptions[0],
    image: imageResolutionOptions[0],
    video: videoResolutionOptions[0],
    audio: imageResolutionOptions[0],
  });
  const [selectedStyle] = useState(styleOptions[0]);
  // gpt-5.4-image-2 专属画质档（新图片接口），默认自动。仅该模型显示/生效。
  const [selectedImageQuality, setSelectedImageQuality] = useState<string>(DEFAULT_IMAGE_QUALITY);
  const [selectedDurations, setSelectedDurations] = useState<Record<WorkMode, string>>({
    general: durationOptions[0],
    agent: durationOptions[0],
    image: durationOptions[0],
    video: durationOptions[0],
    audio: durationOptions[0],
  });
  const [selectedImageCounts, setSelectedImageCounts] = useState<Record<WorkMode, string>>({
    general: imageCountOptions[0],
    agent: imageCountOptions[0],
    image: imageCountOptions[0],
    video: imageCountOptions[0],
    audio: imageCountOptions[0],
  });
  const [selectedGenerationModels, setSelectedGenerationModels] = useState<Record<"image" | "video" | "audio", ModelName>>({
    image: DEFAULT_IMAGE_MODEL,
    video: DEFAULT_VIDEO_MODEL,
    audio: DEFAULT_AUDIO_MODEL,
  });
  const [selectedAudioVoice, setSelectedAudioVoice] = useState<string | undefined>(getDefaultAudioVoiceId(DEFAULT_AUDIO_MODEL));
  const [audioVoiceLang, setAudioVoiceLang] = useState<AudioVoiceLang>(getAudioVoiceLang(DEFAULT_AUDIO_MODEL, getDefaultAudioVoiceId(DEFAULT_AUDIO_MODEL)));
  const [selectedAudioEmotion, setSelectedAudioEmotion] = useState(AUDIO_EMOTION_DEFAULT_ID);
  const [selectedAudioReferenceMode, setSelectedAudioReferenceMode] = useState<AudioReferenceMode>("tts");
  const [selectedVideoReferenceMode, setSelectedVideoReferenceMode] = useState<VideoReferenceMode>("reference");
  const [selectedGeneralModels, setSelectedGeneralModels] = useState<Record<"chat" | "image" | "video", ModelName>>({
    chat: frontendConversationModels[0].id,
    image: DEFAULT_IMAGE_MODEL,
    video: DEFAULT_VIDEO_MODEL,
  });
  const [generalPreferenceAuto, setGeneralPreferenceAuto] = useState(true);
  const [generalPreferenceKind, setGeneralPreferenceKind] = useState<"image" | "video">("image");
  const [generalCustomSubMenu, setGeneralCustomSubMenu] = useState<"" | "model" | "resolution">("");
  const [generalImageRatio, setGeneralImageRatio] = useState("智能比例");
  const [generalImageResolution, setGeneralImageResolution] = useState(() => normalizeImageResolutionForModel(DEFAULT_IMAGE_MODEL, "2K"));
  const [generalVideoRatio, setGeneralVideoRatio] = useState("智能比例");
  const [generalVideoResolution, setGeneralVideoResolution] = useState(() => normalizeVideoResolutionForModel(DEFAULT_VIDEO_MODEL, "720p"));
  const [enabledGeneralChatModelIds, setEnabledGeneralChatModelIds] = useState<string[]>(frontendConversationModels.map((model) => model.id));
  const [lastAgentChatModel, setLastAgentChatModel] = useState<string>("");
  const selectedModel: ModelName = (getAgentAutoChatModelChain(enabledGeneralChatModelIds)[0] as ModelName | undefined) ?? DEFAULT_CHAT_MODEL;
  const [generalModelProviders, setGeneralModelProviders] = useState<Record<string, "openrouter" | "byteplus">>({});
  const [enabledAgentChatModelIds, setEnabledAgentChatModelIds] = useState<string[]>(["byteplus:chat.seed-2-0-pro", "openai/gpt-5.6-terra-pro"]);
  const [agentChatModelProviders, setAgentChatModelProviders] = useState<Record<string, "openrouter" | "byteplus">>({});
  const [enabledGenerationModelIds, setEnabledGenerationModelIds] = useState<Record<"image" | "video" | "audio", string[]>>({
    image: imageGenerationModels.map((model) => model.id),
    video: videoGenerationModels.map((model) => model.id),
    audio: audioGenerationModels.map((model) => model.id),
  });
  const [enabledAgentGenerationModelIds, setEnabledAgentGenerationModelIds] = useState<Record<"image" | "video", string[]>>({
    image: frontendImageGenerationModels.map((model) => model.id),
    video: [...videoGenerationModels, ...bytePlusVideoGenerationModels].map((model) => model.id),
  });
  const [enabledAssetImageModelIds, setEnabledAssetImageModelIds] = useState<string[]>([DEFAULT_CHARACTER_IMAGE_MODEL, ...imageGenerationModels.map((model) => model.id)]);
  const [uploadRuleOverrides, setUploadRuleOverrides] = useState<UploadRuleOverrides>({});
  const [promptLengthOverrides, setPromptLengthOverrides] = useState<PromptLengthOverrides>({});
  const [editModelToggles, setEditModelToggles] = useState<Record<string, boolean>>({});
  const [creditRate, setCreditRate] = useState<{ usdToCnyRate: number; creditsPerCny: number }>({ usdToCnyRate: 7.2, creditsPerCny: 10 });
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [nextConversationNumber, setNextConversationNumber] = useState(1);
  const sessionsRef = useRef<WorkSession[]>([]);
  const [historyVisibleSessionCount, setHistoryVisibleSessionCount] = useState(HISTORY_INITIAL_SESSION_COUNT);
  const [historyHasMoreSessions, setHistoryHasMoreSessions] = useState(false);
  const [historyNextOffset, setHistoryNextOffset] = useState(HISTORY_INITIAL_SESSION_COUNT);
  const [historyTotalSessionCount, setHistoryTotalSessionCount] = useState(0);
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
  const [nextWorkflowNumber, setNextWorkflowNumber] = useState(1);
  const [workspaceLoadStatus, setWorkspaceLoadStatus] = useState<WorkspaceLoadStatus>("loading");
  const [workspaceLoadRetryKey, setWorkspaceLoadRetryKey] = useState(0);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);
  // ⭐ workflowItems 的同步镜像：给"要先读到最新值、再在 setState 之外做副作用"的场景用
  //   （2026-08-02 审计 2.3：updateWorkflowCanvas 曾在 setState updater 里 setNextWorkflowNumber +
  //   发 fetch PUT，React 重跑 updater 会重复自增编号/重复发请求）。
  const workflowItemsRef = useRef<WorkflowItem[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");
  const [workflowVisibleItemCount, setWorkflowVisibleItemCount] = useState(WORKFLOW_INITIAL_ITEM_COUNT);
  // ⭐ 工作流画布按需加载：非活跃工作流下发的是骨架版（canvasTrimmed），切到它时补拉完整画布。
  //   这里只记"补拉失败的 id"，用来在画布位置显示重试按钮；正在补拉不用 state（看 canvasTrimmed 即可）。
  const [workflowCanvasLoadFailedIds, setWorkflowCanvasLoadFailedIds] = useState<string[]>([]);
  // ⭐ 「哪些工作流正在生成中」由服务端给（查 GenerationJob 表），前端只读。
  //   ⛔ 别再改回"扫所有工作流的 isRunning"：那会逼着接口下发全部工作流的画布（工作流一多就卡），
  //      而且 isRunning 是持久化标记、后台跑完不会清，反而不准。详见 generation-jobs.ts 的 getRunningWorkflowIds。
  const [runningWorkflowIds, setRunningWorkflowIds] = useState<string[]>([]);
  const hydratingWorkflowIdsRef = useRef<Set<string>>(new Set());
  const [activeSessionId, setActiveSessionId] = useState("");
  const [loadingSessionIds, setLoadingSessionIds] = useState<Set<string>>(() => new Set());
  const [loadingOlderMessageSessionIds, setLoadingOlderMessageSessionIds] = useState<Set<string>>(() => new Set());
  const [loadingSessionStartedAt, setLoadingSessionStartedAt] = useState<Record<string, number>>({});
  const [pendingHomePrompt, setPendingHomePrompt] = useState<{ sessionId: string; prompt: string } | null>(null);
  const [openWorkflowMenuId, setOpenWorkflowMenuId] = useState("");
  const [openSessionMenuId, setOpenSessionMenuId] = useState("");
  const [isCollapsedHistoryMenuOpen, setIsCollapsedHistoryMenuOpen] = useState(false);
  const [collapsedActionMenuPosition, setCollapsedActionMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<WorkspaceThemeMode>(getStoredWorkspaceThemeMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);
  const sendMessageRef = useRef<((suggestion?: SuggestionInput, forcedMode?: WorkMode) => void | Promise<void>) | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("user@example.com");
  const [currentUserNickname, setCurrentUserNickname] = useState("user@example.com");
  const [userNicknameInput, setUserNicknameInput] = useState("user@example.com");
  const [isEditingUserNickname, setIsEditingUserNickname] = useState(false);
  const [currentUserPhone, setCurrentUserPhone] = useState("");
  const [userPhoneInput, setUserPhoneInput] = useState("");
  const [isEditingUserPhone, setIsEditingUserPhone] = useState(false);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState("");
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [currentUserGeneralModeEnabled, setCurrentUserGeneralModeEnabled] = useState(false);
  const [isUploadingUserAvatar, setIsUploadingUserAvatar] = useState(false);
  const [userLanguage, setUserLanguage] = useState<UserLanguage>("简体中文");
  const [notifyOnGenerationComplete, setNotifyOnGenerationComplete] = useState(true);
  const [autoSaveHistory, setAutoSaveHistory] = useState(true);
  const [previewWheelZoom, setPreviewWheelZoom] = useState(true);
  const [previewWheelFlip, setPreviewWheelFlip] = useState(true);
  // 用户中心「设置」：登录后默认进入的面板 + 新建对话时套用的默认生成参数（图片/视频/语音）。
  const [defaultWorkspacePanel, setDefaultWorkspacePanel] = useState<ActivePanel>("chat");
  const defaultWorkspacePanelRef = useRef<ActivePanel>("chat");
  const [defaultImageModel, setDefaultImageModel] = useState<ModelName>(DEFAULT_IMAGE_MODEL);
  const [defaultImageRatio, setDefaultImageRatio] = useState<string>(ratioOptions[0]);
  const [defaultImageResolution, setDefaultImageResolution] = useState<string>(getSupportedImageResolutions(DEFAULT_IMAGE_MODEL)[0]);
  const [defaultVideoModel, setDefaultVideoModel] = useState<ModelName>(DEFAULT_VIDEO_MODEL);
  const [defaultVideoRatio, setDefaultVideoRatio] = useState<string>(ratioOptions[0]);
  const [defaultVideoResolution, setDefaultVideoResolution] = useState<string>(getSupportedVideoResolutions(DEFAULT_VIDEO_MODEL)[0]);
  const [defaultVideoDuration, setDefaultVideoDuration] = useState<string>(getVideoDurationOptions(DEFAULT_VIDEO_MODEL)[0]);
  const [defaultAudioModel, setDefaultAudioModel] = useState<ModelName>(DEFAULT_AUDIO_MODEL);
  const [defaultAudioVoice, setDefaultAudioVoice] = useState<string | undefined>(getDefaultAudioVoiceId(DEFAULT_AUDIO_MODEL));
  const [defaultAudioEmotion, setDefaultAudioEmotion] = useState(AUDIO_EMOTION_DEFAULT_ID);
  const [generatedImageCount, setGeneratedImageCount] = useState(0);
  const [generatedVideoCount, setGeneratedVideoCount] = useState(0);
  const [currentUserCredits, setCurrentUserCredits] = useState(1500);
  const [giftedUserCredits, setGiftedUserCredits] = useState(1500);
  const [userCreditConversations, setUserCreditConversations] = useState<UserCreditConversation[]>([]);
  const [userCreditPage, setUserCreditPage] = useState(1);
  const [currentUserHasPassword, setCurrentUserHasPassword] = useState(false);
  const defaultUserAvatar = useMemo(() => getDefaultUserAvatar(currentUserEmail), [currentUserEmail]);
  const [workspaceStorageMode, setWorkspaceStorageMode] = useState<WorkspaceStorageMode>("loading");
  const [userDialogTab, setUserDialogTab] = useState<UserDialogTab | "">("");
  const [archiveKind, setArchiveKind] = useState<"session" | "workflow">("session");
  const [archiveDeleteConfirm, setArchiveDeleteConfirm] = useState<{ kind: "session" | "workflow"; id: string; title: string } | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [, setPasswordActionMessage] = useState("");
  const [passwordActionError, setPasswordActionError] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [securityPasswordMode, setSecurityPasswordMode] = useState<"default" | "change" | "forgot-code" | "forgot-reset">("default");
  const [forgotPasswordCode, setForgotPasswordCode] = useState("");
  const [isForgotPasswordSending, setIsForgotPasswordSending] = useState(false);
  const [userDialogTip, setUserDialogTip] = useState<ReminderMessage | undefined>();
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState("");
  const [sessionMenuPlacement, setSessionMenuPlacement] = useState<"top" | "bottom">("bottom");
  const [renamingSessionId, setRenamingSessionId] = useState("");
  const [renameInput, setRenameInput] = useState("");
  const [renamingAssetId, setRenamingAssetId] = useState("");
  const [assetRenameInput, setAssetRenameInput] = useState("");
  const [openAssetActionMenuId, setOpenAssetActionMenuId] = useState("");
  const [atAssetFilter, setAtAssetFilter] = useState<AssetFilter>("character_image");
  const [isAtAssetMenuOpen, setIsAtAssetMenuOpen] = useState(false);
  const [openControlMenu, setOpenControlMenu] = useState<ControlMenuName | ModeMenuName | "">("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [workspaceSite, setWorkspaceSite] = useState<WorkspaceSite>("other");
  const [modelInfoSessionId, setModelInfoSessionId] = useState("");
  const [activeTypingMessageIds, setActiveTypingMessageIds] = useState<Set<string>>(() => new Set());
  const [completedTypingMessageIds, setCompletedTypingMessageIds] = useState<Set<string>>(() => new Set());
  const [intentMemoryRules, setIntentMemoryRules] = useState<IntentMemoryRule[]>([]);
  const [feedbackLogs, setFeedbackLogs] = useState<FeedbackLogEntry[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetRenderLimit, setAssetRenderLimit] = useState(ASSET_RENDER_PAGE_SIZE);
  const getAssetCountFilter = useCallback((asset: AssetItem): AssetFilter => {
    if (asset.type === "trash") return "trash";
    const filters: AssetFilter[] = ["character_image", "scene_image", "prop_image", "shot_image", "conversation_uploads", "upload_videos", "upload_audios", "conversation_images", "conversation_videos", "conversation_audios", "workflow_images", "workflow_videos"];
    return filters.find((filter) => isAssetInFilter(asset, filter)) ?? "conversation_images";
  }, []);
  const adjustAssetCounts = useCallback((changes: Array<{ filter: AssetFilter; delta: number }>) => {
    if (changes.length === 0) return;
    setAssetCounts((current) => {
      const next = { ...current };
      for (const { filter, delta } of changes) {
        if (!delta) continue;
        const fallback = assets.filter((asset) => getAssetCountFilter(asset) === filter).length;
        next[filter] = Math.max(0, Math.floor(Number(next[filter] ?? fallback)) + delta);
      }
      return next;
    });
  }, [assets, getAssetCountFilter]);
  const [isCharacterGenerateOpen, setIsCharacterGenerateOpen] = useState(false);
  const [assetGenerateType, setAssetGenerateType] = useState<AssetGenerationImageType>("character_image");
  const [characterGeneratePrompt, setCharacterGeneratePrompt] = useState("");
  const [assetGeneratePromptDrafts, setAssetGeneratePromptDrafts] = useState<Record<AssetGenerationImageType, string>>({ character_image: "", scene_image: "", prop_image: "", shot_image: "" });
  // 资产库生成的参考图作为独立状态（对齐对话流/工作流：缩略图独立于 @文件名 文本，删 @ 文本不删图、删图清净所有 @）。
  const [assetGenerateReferenceDrafts, setAssetGenerateReferenceDrafts] = useState<Record<AssetGenerationImageType, ImageReference[]>>({ character_image: [], scene_image: [], prop_image: [], shot_image: [] });
  const [assetGenerateRatioSelections, setAssetGenerateRatioSelections] = useState<Record<AssetGenerationImageType, AssetGenerateRatio>>({ character_image: "single", scene_image: "single", prop_image: "single", shot_image: "single" });
  const [characterGenerateRatio, setCharacterGenerateRatio] = useState<AssetGenerateRatio>("single");
  const [characterGenerateStyle, setCharacterGenerateStyle] = useState<"realistic" | "2d" | "3d">("realistic");
  const [characterGenerateModel, setCharacterGenerateModel] = useState<ModelName>(DEFAULT_CHARACTER_IMAGE_MODEL);
  const [characterGenerateResolution, setCharacterGenerateResolution] = useState(DEFAULT_CHARACTER_IMAGE_RESOLUTION);
  // 资产库生图 gpt-5.4-image-2 专属画质档，默认自动。仅该模型显示。
  const [characterGenerateQuality, setCharacterGenerateQuality] = useState<string>(DEFAULT_IMAGE_QUALITY);
  const [characterGenerateResult, setCharacterGenerateResult] = useState<CharacterGenerationResult>({ status: "idle" });
  const [assetGenerateJobs, setAssetGenerateJobs] = useState<AssetGenerateJob[]>([]);
  // 资产库生成失败卡：⭐ 产品口径（2026-08-06 用户拍板）= 每次生成彼此独立，失败卡只有用户点右上角 ✕ 才消失。
  // 因此"用户点 ✕ 删掉的 jobId"必须记住：持久化是 500ms 防抖的整体 PUT，删完若立刻发生一次资产库加载
  // （切分类/滚动分页/生成成功后刷新），服务端旧快照里还带着这条，合并时就会把它"复活"到界面上。
  const dismissedAssetGenerateJobIdsRef = useRef<Set<string>>(new Set());
  const [activeAssetGenerateJobId, setActiveAssetGenerateJobId] = useState("");
  const [characterImageScale, setCharacterImageScale] = useState(1);
  const [characterImageFitMode, setCharacterImageFitMode] = useState<"fit" | "actual">("fit");
  const [characterImagePan, setCharacterImagePan] = useState({ x: 0, y: 0 });
  const [characterImageNaturalSize, setCharacterImageNaturalSize] = useState({ width: 0, height: 0 });
  const [characterImageDisplayLoaded, setCharacterImageDisplayLoaded] = useState(false);
  const [characterImageDisplayTrackedUrl, setCharacterImageDisplayTrackedUrl] = useState("");
  {
    // 展示 url 保持原设计：先远程后本地替换（远程先显示→后台下载落盘/缩略图/压缩/封面→就绪才换本地）。
    // 这里只跟踪 url 变化以重置"加载中"转圈：url 一变(含远程→本地替换)就重新显示转圈，直到新图 onLoad。
    const currentCharacterImageUrl = characterGenerateResult.status === "succeeded" ? characterGenerateResult.url ?? "" : "";
    if (characterImageDisplayTrackedUrl !== currentCharacterImageUrl) {
      setCharacterImageDisplayTrackedUrl(currentCharacterImageUrl);
      setCharacterImageDisplayLoaded(false);
    }
  }
  const [characterImageFitScale, setCharacterImageFitScale] = useState(1);
  const [isCharacterImageDragging, setIsCharacterImageDragging] = useState(false);
  const [isInputPromptOptimizing, setIsInputPromptOptimizing] = useState(false);
  const [isCharacterPromptOptimizing, setIsCharacterPromptOptimizing] = useState(false);
  const [characterPromptCursorOffset, setCharacterPromptCursorOffset] = useState(0);
  const [characterAtAssetFilter, setCharacterAtAssetFilter] = useState<AssetFilter>("character_image");
  const [isCharacterAtAssetMenuOpen, setIsCharacterAtAssetMenuOpen] = useState(false);
  const [assetUploadSlots, setAssetUploadSlots] = useState<AssetUploadSlot[]>(() => createAssetUploadSlots("character_image"));
  const [assetMediaUploadCards, setAssetMediaUploadCards] = useState<AssetMediaUploadCard[]>([]);
  const [isAssetUploading, setIsAssetUploading] = useState(false);
  const [assetUploadTip, setAssetUploadTip] = useState<ReminderMessage | undefined>();
  const [generationCompleteReminder, setGenerationCompleteReminder] = useState<ReminderMessage | undefined>();
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  // 预览页参考素材：唯一权威从数据库(GenerationJob)按媒体 url 读，图/视频/音频统一。避免靠内存消息或 @名匹配（会因未加载/改名而丢）。
  const [previewJobReferences, setPreviewJobReferences] = useState<Array<{ url: string; name?: string; kind: "image" | "video" | "audio" }>>([]);
  const [previewDocumentFile, setPreviewDocumentFile] = useState<UploadedFileEntry | null>(null);
  const [previewDocumentWidth, setPreviewDocumentWidth] = useState(0);
  const [hasCustomPreviewDocumentWidth, setHasCustomPreviewDocumentWidth] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [isReversePromptingPreview, setIsReversePromptingPreview] = useState(false);
  const [previewPromptError, setPreviewPromptError] = useState<{ assetId: string; message: string } | null>(null);
  const [previewPromptCopyState, setPreviewPromptCopyState] = useState<"idle" | "success" | "error">("idle");
  const [previewFitMode, setPreviewFitMode] = useState<"fit" | "actual">("fit");
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [previewNaturalSize, setPreviewNaturalSize] = useState({ width: 0, height: 0 });
  const [previewFitScale, setPreviewFitScale] = useState(1);
  const [previewThumbPageStart, setPreviewThumbPageStart] = useState(0);
  const [previewThumbPageSize, setPreviewThumbPageSize] = useState(4);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ messageId: string; state: "success" | "error" } | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, "like" | "dislike">>({});
  const [messageIssueFeedback, setMessageIssueFeedback] = useState<Record<string, "wrong" | "wrong_mode">>({});
  const [inputReminder, setInputReminder] = useState<ReminderMessage | undefined>();
  const [draftCursorOffset, setDraftCursorOffset] = useState(0);
  const [sendingSessionIds, setSendingSessionIds] = useState<Set<string>>(() => new Set());
  const [resolvingSessionIds] = useState<Set<string>>(() => new Set());
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [imageVariantIndexes, setImageVariantIndexes] = useState<Record<string, number>>({});
  const [agentPromptExpandedIds, setAgentPromptExpandedIds] = useState<Record<string, boolean>>({});
  const [agentPromptPageIndexes, setAgentPromptPageIndexes] = useState<Record<string, number>>({});
  const [mediaErrorPageIndexes, setMediaErrorPageIndexes] = useState<Record<string, number>>({});
  const [isDragUploadActive, setIsDragUploadActive] = useState(false);
  const [, setCanScrollUploadedFiles] = useState({ left: false, right: false });
  const [, setCanScrollUploadedImages] = useState({ left: false, right: false });
  const [canScrollAssetGenerateReferences, setCanScrollAssetGenerateReferences] = useState({ left: false, right: false });
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingOlderMessagesScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const suppressChatScrollToBottomRef = useRef(false);
  const canLoadOlderByScrollRef = useRef(false);
  const wasThinkingRef = useRef(false);
  const uploadedFilesRowRef = useRef<HTMLDivElement | null>(null);
  const uploadedImagesRowRef = useRef<HTMLDivElement | null>(null);
  // 输入框底部工具栏「左侧按钮组」的自然宽度（用于让输入框跟随按钮加宽，发送按钮不被顶出框外）。
  const toolbarLeftGroupRef = useRef<HTMLDivElement | null>(null);
  const [measuredToolbarLeftWidth, setMeasuredToolbarLeftWidth] = useState(0);
  const assetGenerateReferencesRowRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const characterEditorRef = useRef<HTMLDivElement | null>(null);
  const characterViewportRef = useRef<HTMLDivElement | null>(null);
  const characterImageDragStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const previewThumbListRef = useRef<HTMLDivElement | null>(null);
  const previewAssetRef = useRef<AssetItem | null>(null);
  const preloadedPreviewThumbUrlsRef = useRef<Set<string>>(new Set());
  const preloadingSavedMediaUrlsRef = useRef<Set<string>>(new Set());
  const inputImageUploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const previewDragStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const activeAssetGenerateJobIdRef = useRef("");
  const assetGenerateJobPollersRef = useRef<Set<string>>(new Set());
  const retryingFailedMediaKeysRef = useRef<Set<string>>(new Set());
  const runningRequestIdsRef = useRef<Set<string>>(new Set());
  const sendingSessionIdsRef = useRef<Set<string>>(new Set());
  const requestAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const stoppedRequestIdsRef = useRef<Set<string>>(new Set());
  const completedNotificationRequestIdsRef = useRef<Set<string>>(new Set());
  const dragUploadDepthRef = useRef(0);
  const workspaceSaveTimerRef = useRef<number | null>(null);
  const flushNextWorkspaceSaveRef = useRef(false);
  const workflowTextSaveTimerRef = useRef<number | null>(null);
  const loadedWorkflowAssetIdsRef = useRef<Set<string>>(new Set());
  const userProfileSaveTimerRef = useRef<number | null>(null);
  const workspaceInstanceCheckFailuresRef = useRef(0);
  const authCheckFailuresRef = useRef(0);
  const authActivityPingRef = useRef(0);
  const typingScrollFrameRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const inputTipTimerRef = useRef<number | null>(null);
  const inputTipQueueRef = useRef<ReminderMessage[]>([]);
  const inputCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const showNextInputTipRef = useRef<(() => void) | null>(null);
  const assetUploadTipTimerRef = useRef<number | null>(null);
  const assetUploadTipQueueRef = useRef<ReminderMessage[]>([]);
  const assetUploadCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const assetUploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const showNextAssetUploadTipRef = useRef<(() => void) | null>(null);
  const generationCompleteTipTimerRef = useRef<number | null>(null);
  const generationCompleteTipQueueRef = useRef<ReminderMessage[]>([]);
  const generationCompleteCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const showNextGenerationCompleteTipRef = useRef<(() => void) | null>(null);
  const userDialogTipTimerRef = useRef<number | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useBodyScrollLock(Boolean(isCharacterGenerateOpen || userDialogTab || renamingSessionId || renamingAssetId || previewAsset));

  useEffect(() => {
    activeAssetGenerateJobIdRef.current = activeAssetGenerateJobId;
  }, [activeAssetGenerateJobId]);
  const selectedRatio = mode === "video" ? (selectedRatios.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedGenerationModels.video, selectedRatios.video, selectedResolutions.video)) : selectedRatios[mode];
  const selectedResolution = mode === "image" ? normalizeImageResolutionForModel(selectedGenerationModels.image, selectedRatios.image === "智能比例" ? "智能比例" : selectedResolutions.image) : mode === "video" ? (selectedRatios.video === "智能比例" ? "720p" : normalizeVideoResolutionForModel(selectedGenerationModels.video, selectedResolutions.video)) : selectedResolutions[mode];
  const selectedImageCount = selectedImageCounts[mode];
  const selectedGenerationModel = mode === "general" ? selectedGeneralModels.chat : mode === "agent" ? selectedModel : selectedGenerationModels[mode];
  const isSelectedVideoReferenceModeModel = mode === "video" && supportsVideoReferenceMode(selectedGenerationModels.video);
  const isSelectedAudioCloneModel = mode === "audio" && supportsAudioCloneMode(selectedGenerationModels.audio);
  const isAudioCloneMode = isSelectedAudioCloneModel && selectedAudioReferenceMode === "clone";
  const isVideoEditOrExtendMode = isSelectedVideoReferenceModeModel && (selectedVideoReferenceMode === "edit" || selectedVideoReferenceMode === "extend");
  const currentUploadRule = useMemo(() => getUploadRule({ mode, modelId: selectedGenerationModel, transportMode: "local-base64", videoReferenceMode: mode === "video" && isSelectedVideoReferenceModeModel ? selectedVideoReferenceMode : undefined, audioReferenceMode: mode === "audio" && isSelectedAudioCloneModel ? selectedAudioReferenceMode : undefined }, uploadRuleOverrides), [isSelectedAudioCloneModel, isSelectedVideoReferenceModeModel, mode, selectedAudioReferenceMode, selectedGenerationModel, selectedVideoReferenceMode, uploadRuleOverrides]);
  const currentMaxReferenceImages = currentUploadRule.image.maxCount;
  const uploadAcceptValue = useMemo(() => getUploadAcceptValue(currentUploadRule), [currentUploadRule]);
  const supportedUploadTypeLabel = useMemo(() => getSupportedUploadTypeLabel(currentUploadRule), [currentUploadRule]);
  const workflowUploadNodeTypeLabel = "图片 jpg/jpeg/png/webp（≤10MB）；视频 mp4/mov（≤200MB，2-15秒）；音频 mp3/wav（≤15MB，2-15秒）；文本 txt（≤2000字）";
  // 资产库拖拽上传：只在三个上传标签（上传图片/上传视频/上传音频）生效，遮罩文案只显示当前标签对应类型。
  const assetsUploadKind: "image" | "video" | "audio" | null = activePanel === "assets" ? (assetFilter === "conversation_uploads" ? "image" : assetFilter === "upload_videos" ? "video" : assetFilter === "upload_audios" ? "audio" : null) : null;
  const assetsUploadTypeLabel = assetsUploadKind === "image" ? "图片 jpg/jpeg/png/webp（≤10MB）" : assetsUploadKind === "video" ? "视频 mp4/mov（≤200MB，2-15秒）" : assetsUploadKind === "audio" ? "音频 mp3/wav（≤15MB，2-15秒）" : "";
  const selectedGenerationModelLabel = mode === "image" || mode === "video" || mode === "audio" ? getGenerationModelLabel(mode, selectedGenerationModel) : "";
  const currentDurationOptions = getVideoDurationOptions(selectedGenerationModels.video);
  const selectedVideoDuration = currentDurationOptions.includes(selectedDurations.video) ? selectedDurations.video : currentDurationOptions[0];
  const isSceneGeneration = assetGenerateType === "scene_image";
  const isPropGeneration = assetGenerateType === "prop_image";
  const isShotGeneration = assetGenerateType === "shot_image";
  const characterGenerateDisplayRatio = characterGenerateRatio === "single" ? "9:16" : characterGenerateRatio === "grid-square" ? "1:1" : "16:9";
  const characterGenerateDisplayResolution = normalizeImageResolutionForModel(characterGenerateModel, characterGenerateResolution);
  const assetGenerateUploadRule = useMemo(() => getUploadRule({ mode: "asset-image", modelId: characterGenerateModel, transportMode: "local-base64" }, uploadRuleOverrides), [characterGenerateModel, uploadRuleOverrides]);
  const assetGenerateMaxReferenceImages = assetGenerateUploadRule.image.maxCount;
  // ⭐ 提示词字数上限「按模型」（后台「上传规则」页的「文字」列，唯一权威 lib/prompt-length）。
  //    ⛔ 别再写死 2000（那个老常量 MAX_DRAFT_INPUT_LENGTH 已于 2026-08-09 删除）。
  //    键只看模型、不看参考模式：同一模型换融合/首帧不会让字数上限跳变。
  const currentPromptMaxLength = useMemo(() => getPromptMaxLength({ mode, modelId: selectedGenerationModel }, promptLengthOverrides), [mode, selectedGenerationModel, promptLengthOverrides]);
  const assetGeneratePromptMaxLength = useMemo(() => getPromptMaxLength({ mode: "asset-image", modelId: characterGenerateModel }, promptLengthOverrides), [characterGenerateModel, promptLengthOverrides]);
  const assetGeneratePromptLength = countPromptLength(characterGeneratePrompt);
  const isAssetGeneratePromptOverLimit = assetGeneratePromptLength > assetGeneratePromptMaxLength;
  const characterGenerateDisplayDimensions = getDisplayDimensions(characterGenerateDisplayRatio, characterGenerateDisplayResolution, "image", characterGenerateModel);
  const characterGenerateQualityBadgeLabel = getImageQualityBadgeLabel(characterGenerateDisplayResolution);
  const assetGenerateTitle = isShotGeneration ? "分镜生成" : isSceneGeneration ? "场景生成" : isPropGeneration ? "道具生成" : "角色生成";
  const assetGenerateAreaTitle = isShotGeneration ? "分镜图片生成区" : isSceneGeneration ? "场景图片生成区" : isPropGeneration ? "道具图片生成区" : "角色图片生成区";
  const assetGeneratePlaceholder = isShotGeneration ? "描述一个电影或电视剧截图感的镜头画面..." : isSceneGeneration ? "描述要生成的纯场景画面..." : isPropGeneration ? "描述要生成的道具/物品..." : "描述要生成的角色形象...";
  const AssetGenerateIcon = isShotGeneration ? RiMultiImageLine : isSceneGeneration ? RiLandscapeLine : isPropGeneration ? RiBellLine : RiAccountBoxLine;
  const assetGenerateRatioLabel = isShotGeneration
    ? characterGenerateRatio === "single" ? "竖屏分镜9:16" : "横屏分镜16:9"
    : isSceneGeneration
    ? characterGenerateRatio === "scene-grid" ? "四宫格16:9" : characterGenerateRatio === "single" ? "单场景9:16" : "单场景16:9"
    : isPropGeneration
    ? characterGenerateRatio === "grid-square" ? "四宫格1:1" : characterGenerateRatio === "single" ? "单道具9:16" : "多角度16:9"
    : characterGenerateRatio === "single" ? "单人9:16" : "三视图16:9";
  const setActiveAssetGeneratePrompt = useCallback((value: string) => {
    setCharacterGeneratePrompt(value);
    setAssetGeneratePromptDrafts((current) => ({ ...current, [assetGenerateType]: value }));
  }, [assetGenerateType]);
  const setActiveAssetGenerateReferences = useCallback((updater: (current: ImageReference[]) => ImageReference[]) => {
    setAssetGenerateReferenceDrafts((current) => ({ ...current, [assetGenerateType]: updater(current[assetGenerateType] ?? []) }));
  }, [assetGenerateType]);
  // 资产库生成引用以"提示词 @名"为唯一真源：@名从文字里删掉时，同步剪掉对应的参考图缩略图草稿
  // （贯彻"没@名=没缩略图"，与对话流一致），杜绝"草稿与@名脱钩"导致发出去的参考图与@的不是同一张。
  useEffect(() => {
    const names = new Set(getMentionNames(characterGeneratePrompt));
    setAssetGenerateReferenceDrafts((current) => {
      const drafts = current[assetGenerateType];
      if (!drafts || drafts.length === 0) return current;
      const pruned = drafts.filter((reference) => names.has(reference.name));
      return pruned.length === drafts.length ? current : { ...current, [assetGenerateType]: pruned };
    });
  }, [characterGeneratePrompt, assetGenerateType]);
  const setActiveAssetGenerateRatio = useCallback((value: AssetGenerateRatio) => {
    setCharacterGenerateRatio(value);
    setAssetGenerateRatioSelections((current) => ({ ...current, [assetGenerateType]: value }));
  }, [assetGenerateType]);
  const userText = useCallback((text: string) => getUserText(userLanguage, text), [userLanguage]);

  const applyCurrentUserProfile = useCallback((profile: CurrentUserProfile) => {
    const nickname = profile.nickname?.trim() || profile.email;
    const phone = profile.phone?.trim() || "";
    const avatarUrl = profile.avatarUrl?.trim() || "";

    setCurrentUserId(profile.id?.trim() || "");
    setCurrentUserEmail(profile.email);
    setCurrentUserIsAdmin(Boolean(profile.isAdmin));
    setCurrentUserGeneralModeEnabled(Boolean(profile.generalModeEnabled));
    setCurrentUserHasPassword(Boolean(profile.hasPassword));
    setCurrentUserNickname(nickname);
    setUserNicknameInput(nickname);
    setCurrentUserPhone(phone);
    setUserPhoneInput(phone);
    setCurrentUserAvatarUrl(avatarUrl);
    setUserLanguage(profile.language && userLanguageOptions.includes(profile.language) ? profile.language : "简体中文");
    setNotifyOnGenerationComplete(profile.notifyOnGenerationComplete ?? true);
    setAutoSaveHistory(profile.autoSaveHistory ?? true);
    setPreviewWheelZoom(profile.previewWheelZoom ?? true);
    setPreviewWheelFlip(profile.previewWheelFlip ?? true);

    // 默认偏好：空/非法一律回落到系统或该模型的自然默认值，落库时永远是合法值。
    const nextPanel: ActivePanel = profile.defaultWorkspacePanel === "workflow" || profile.defaultWorkspacePanel === "assets" ? profile.defaultWorkspacePanel : "chat";
    defaultWorkspacePanelRef.current = nextPanel;
    setDefaultWorkspacePanel(nextPanel);

    const nextImageModel = (profile.defaultImageModel && generationModelOptions.image.some((option) => option.id === profile.defaultImageModel) ? profile.defaultImageModel : DEFAULT_IMAGE_MODEL) as ModelName;
    const imageResolutionOptionsForModel = getSupportedImageResolutions(nextImageModel);
    setDefaultImageModel(nextImageModel);
    setDefaultImageRatio(normalizeImageRatioForModel(nextImageModel, profile.defaultImageRatio && ratioOptions.includes(profile.defaultImageRatio) ? profile.defaultImageRatio : ratioOptions[0]));
    setDefaultImageResolution(profile.defaultImageResolution && imageResolutionOptionsForModel.includes(profile.defaultImageResolution as never) ? profile.defaultImageResolution : imageResolutionOptionsForModel[0]);

    const nextVideoModel = (profile.defaultVideoModel && generationModelOptions.video.some((option) => option.id === profile.defaultVideoModel) ? profile.defaultVideoModel : DEFAULT_VIDEO_MODEL) as ModelName;
    const videoResolutionOptionsForModel = getSupportedVideoResolutions(nextVideoModel);
    const nextVideoResolution = profile.defaultVideoResolution && videoResolutionOptionsForModel.includes(profile.defaultVideoResolution as never) ? profile.defaultVideoResolution : videoResolutionOptionsForModel[0];
    const videoRatioOptionsForModel = ["智能比例", ...getSupportedVideoRatios(nextVideoModel, nextVideoResolution as never)];
    const videoDurationOptionsForModel = getVideoDurationOptions(nextVideoModel);
    setDefaultVideoModel(nextVideoModel);
    setDefaultVideoResolution(nextVideoResolution);
    setDefaultVideoRatio(profile.defaultVideoRatio && videoRatioOptionsForModel.includes(profile.defaultVideoRatio) ? profile.defaultVideoRatio : "智能比例");
    setDefaultVideoDuration(profile.defaultVideoDuration && videoDurationOptionsForModel.includes(profile.defaultVideoDuration) ? profile.defaultVideoDuration : videoDurationOptionsForModel[0]);

    const nextAudioModel = (profile.defaultAudioModel && generationModelOptions.audio.some((option) => option.id === profile.defaultAudioModel) ? profile.defaultAudioModel : DEFAULT_AUDIO_MODEL) as ModelName;
    setDefaultAudioModel(nextAudioModel);
    setDefaultAudioVoice(normalizeAudioVoiceForModel(nextAudioModel, profile.defaultAudioVoice));
    setDefaultAudioEmotion(normalizeAudioEmotionForModel(nextAudioModel, profile.defaultAudioEmotion));

    setGeneratedImageCount(profile.generatedImageCount ?? 0);
    setGeneratedVideoCount(profile.generatedVideoCount ?? 0);
    setCurrentUserCredits(profile.credits ?? 0);
  }, []);

  useEffect(() => {
    if (!currentUserGeneralModeEnabled && mode === "general") setMode("agent");
  }, [currentUserGeneralModeEnabled, mode]);

  // ⛔ 原来这里有「首次进工作流自动收起侧边栏」（applyWorkflowFirstSessionCollapse + sessionStorage 标记）。
  // 2026-08 用户拍板取消：进工作流不再改侧边栏状态，全项目只有左上角那个按钮能切侧边栏。
  const enterWorkflowPanel = useCallback(() => {
    if (!WORKFLOW_MODE_ENABLED) return;
    setStoredWorkspaceUiState({ activePanel: "workflow" });
    setActivePanel("workflow");
  }, []);

  const logoutUser = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  }, []);

  const openUserDialog = useCallback((tab: UserDialogTab) => {
    setIsUserMenuOpen(false);
    setUserDialogTab(tab);
    if (tab === "credits") {
      setUserCreditPage(1);
      void fetch("/api/credits/me", { cache: "no-store" })
        .then((response) => readJson<{ credits: number; giftedCredits?: number; conversations: UserCreditConversation[] }>(response))
        .then((data) => {
          setCurrentUserCredits(Math.max(0, Math.floor(data.credits ?? 0)));
          setGiftedUserCredits(Math.max(0, Math.floor(data.giftedCredits ?? data.credits ?? 0)));
          setUserCreditConversations(data.conversations ?? []);
        })
        .catch(() => undefined);
    }
    setSecurityPasswordMode("default");
    setForgotPasswordCode("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordActionMessage("");
    setPasswordActionError("");
  }, []);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;

    const requestedTab = window.sessionStorage.getItem(WORKSPACE_USER_DIALOG_STORAGE_KEY);
    if (requestedTab !== "profile" && requestedTab !== "credits" && requestedTab !== "security" && requestedTab !== "settings") return;

    window.sessionStorage.removeItem(WORKSPACE_USER_DIALOG_STORAGE_KEY);
    const timer = window.setTimeout(() => openUserDialog(requestedTab), 0);
    return () => window.clearTimeout(timer);
  }, [isLoaded, openUserDialog, workspaceStorageMode]);

  const submitPasswordSettings = useCallback(async () => {
    setPasswordActionMessage("");
    setPasswordActionError("");

    if (newPasswordInput.length < 8) {
      setPasswordActionError("密码至少需要8位");
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordActionError("两次输入的新密码不一致");
      return;
    }

    setIsPasswordSaving(true);
    try {
      const isForgotReset = securityPasswordMode === "forgot-reset";
      const response = await fetch(isForgotReset ? "/api/auth/reset-password" : currentUserHasPassword ? "/api/auth/change-password" : "/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isForgotReset ? { code: forgotPasswordCode, password: newPasswordInput } : currentUserHasPassword ? { currentPassword: currentPasswordInput, newPassword: newPasswordInput } : { password: newPasswordInput }),
      });
      await readJson<{ ok: boolean }>(response);

      setCurrentUserHasPassword(true);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setForgotPasswordCode("");
      setSecurityPasswordMode("default");
      setUserDialogTip({ message: currentUserHasPassword || isForgotReset ? "密码已修改" : "密码已设置", tone: "success" });
    } catch (error) {
      setPasswordActionError(toUserErrorMessage(error));
    } finally {
      setIsPasswordSaving(false);
    }
  }, [confirmPasswordInput, currentPasswordInput, currentUserHasPassword, forgotPasswordCode, newPasswordInput, securityPasswordMode]);

  const startForgotPasswordFlow = useCallback(async () => {
    setPasswordActionError("");
    setPasswordActionMessage("");
    setForgotPasswordCode("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setIsForgotPasswordSending(true);
    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUserEmail }),
      });
      await readJson<{ ok: boolean }>(response);
      setSecurityPasswordMode("forgot-code");
      setUserDialogTip({ message: "验证码已发送到您当前登录的邮箱中", tone: "default" });
    } catch (error) {
      setPasswordActionError(toUserErrorMessage(error));
    } finally {
      setIsForgotPasswordSending(false);
    }
  }, [currentUserEmail]);

  const verifyForgotPasswordCode = useCallback(async () => {
    setPasswordActionError("");
    setPasswordActionMessage("");

    if (!/^\d{6}$/.test(forgotPasswordCode)) {
      setPasswordActionError("请输入6位验证码");
      return;
    }

    setIsForgotPasswordSending(true);
    try {
      const response = await fetch("/api/auth/check-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUserEmail, code: forgotPasswordCode }),
      });
      await readJson<{ ok: boolean }>(response);
      setSecurityPasswordMode("forgot-reset");
      setUserDialogTip({ message: "邮箱验证成功", tone: "success" });
    } catch (error) {
      setPasswordActionError(toUserErrorMessage(error));
    } finally {
      setIsForgotPasswordSending(false);
    }
  }, [currentUserEmail, forgotPasswordCode]);

  const startEditingUserNickname = useCallback(() => {
    setUserNicknameInput(currentUserNickname.trim() || currentUserEmail);
    setIsEditingUserNickname(true);
  }, [currentUserEmail, currentUserNickname]);

  const commitUserNickname = useCallback(() => {
    const nextNickname = Array.from(userNicknameInput.trim()).slice(0, MAX_USER_NICKNAME_LENGTH).join("") || currentUserEmail;

    setCurrentUserNickname(nextNickname);
    setUserNicknameInput(nextNickname);
    setIsEditingUserNickname(false);
  }, [currentUserEmail, userNicknameInput]);

  const cancelEditingUserNickname = useCallback(() => {
    setUserNicknameInput(currentUserNickname.trim() || currentUserEmail);
    setIsEditingUserNickname(false);
  }, [currentUserEmail, currentUserNickname]);

  const startEditingUserPhone = useCallback(() => {
    setUserPhoneInput(currentUserPhone.trim());
    setIsEditingUserPhone(true);
  }, [currentUserPhone]);

  const commitUserPhone = useCallback(() => {
    const nextPhone = userPhoneInput.trim();

    setCurrentUserPhone(nextPhone);
    setUserPhoneInput(nextPhone);
    setIsEditingUserPhone(false);
  }, [userPhoneInput]);

  const cancelEditingUserPhone = useCallback(() => {
    setUserPhoneInput(currentUserPhone.trim());
    setIsEditingUserPhone(false);
  }, [currentUserPhone]);

  const updatePasswordField = useCallback((setter: (value: string) => void, value: string) => {
    setter(value);
    setPasswordActionError("");
    setPasswordActionMessage("");
  }, []);

  const uploadUserAvatar = useCallback(async (file?: File) => {
    if (!file) return;

    setIsUploadingUserAvatar(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/upload-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await readJson<{ url?: string }>(response);

      if (data.url) setCurrentUserAvatarUrl(data.url);
    } catch (error) {
      console.warn("头像上传失败", error);
    } finally {
      setIsUploadingUserAvatar(false);
    }
  }, []);

  const activeSession = sessions.find((session) => session.id === activeSessionId && isVisibleSession(session)) ?? sessions.find((session) => isVisibleSession(session)) ?? sessions[0];
  const activeWorkflowItems = sortByUpdatedAtDesc(workflowItems.filter((item) => isVisibleWorkflow(item)));
  const activeWorkflow = activeWorkflowItems.find((item) => item.id === activeWorkflowId) ?? activeWorkflowItems[0];
  const messages = activeSession?.messages ?? initialMessages;
  const activeInput = activeSession?.draftInput ?? "";
  const activeInputLength = Array.from(activeInput).length;
  // ⭐ 超字数：不删字，只用来「计数器变红 + 发送键灰掉 + 发送时拦」（唯一权威 lib/prompt-length）。
  const isActiveInputOverLimit = activeInputLength > currentPromptMaxLength;
  // 输入框宽度原则：默认 800；工具栏左侧按钮组撑宽时，输入框相应加宽，保证发送按钮始终在框内、
  // 且左侧按钮组与发送按钮的最小间距 = 按钮间距(8px)。宽度 = 左组自然宽 + 间距8 + 发送按钮36 + 卡片左右内边距32 + 边框4 = 左组 + 80。
  const TOOLBAR_SHELL_EXTRA = 8 + 36 + 32 + 4;
  const toolbarRequiredWidth = (mode === "agent" || mode === "general")
    ? 800
    : (measuredToolbarLeftWidth > 0 ? Math.ceil(measuredToolbarLeftWidth) + TOOLBAR_SHELL_EXTRA : 800);
  const inputShellWidth = Math.max(toolbarRequiredWidth, 800 + Math.min(206, Math.max(0, activeInputLength - 650) * 0.42));
  const activeUploadedFiles = activeSession?.uploadedFiles ?? [];
  const activeUploadedImages = activeSession?.uploadedImages ?? [];
  const hasReadingUploadedFiles = activeUploadedFiles.some((file) => typeof file !== "string" && file.status === "reading");
  const hasUploadingInputs = activeUploadedImages.some((image) => image.uploadStatus === "uploading") || activeUploadedFiles.some((file) => typeof file !== "string" && file.uploadStatus === "uploading");
  const hasFailedUploadInputs = activeUploadedImages.some((image) => image.uploadStatus === "error") || activeUploadedFiles.some((file) => typeof file !== "string" && file.uploadStatus === "error");
  const activeSessionIdValue = activeSession?.id ?? "";
  const resolvedTheme: "light" | "dark" = themeMode === "system" ? systemPrefersDark ? "dark" : "light" : themeMode;
  const themeModeLabel = themeMode === "dark" ? "深色模式" : themeMode === "system" ? `跟随系统 · ${resolvedTheme === "dark" ? "深色" : "浅色"}` : "浅色模式";
  const ThemeModeIcon = themeMode === "dark" ? RiMoonLine : themeMode === "system" ? RiComputerLine : RiSunLine;
  const quickActionRows = useMemo(() => getQuickActionRows(activeSessionIdValue), [activeSessionIdValue]);
  const activeConversationImageReferences = useMemo(() => getConversationImageReferences(messages), [messages]);
  const assetNameByUrl = useMemo(() => new Map(assets.map((asset) => [normalizeMediaUrlForMatch(asset.url), asset.name])), [assets]);
  const getCanonicalMediaName = useCallback((message: Message, url: string, fallbackName: string) => assetNameByUrl.get(normalizeMediaUrlForMatch(url)) ?? getMediaSystemName(message, url, fallbackName), [assetNameByUrl]);

  useEffect(() => {
    if (activePanel !== "workflow") return;
    const nextActiveWorkflowId = activeWorkflowItems.some((item) => item.id === activeWorkflowId) ? activeWorkflowId : activeWorkflowItems[0]?.id ?? "";
    if (nextActiveWorkflowId !== activeWorkflowId) setActiveWorkflowId(nextActiveWorkflowId);
  }, [activePanel, activeWorkflowId, activeWorkflowItems]);

  /**
   * ⭐ 补拉单个工作流的完整画布（"点哪个读哪个"）。
   * 打开工作台时只有活跃工作流（和后端还在生成的）带画布，其余**只有标题**。
   * ⛔ 必须在渲染画布**之前**补齐：没有画布直接渲染会是一张空画布。
   * 拉到之后清掉 canvasTrimmed → 这份画布才重新获得"可以写回数据库"的权威性。
   */
  const hydrateWorkflowCanvas = useCallback(async (workflowId: string) => {
    if (!workflowId || hydratingWorkflowIdsRef.current.has(workflowId)) return;
    hydratingWorkflowIdsRef.current.add(workflowId);
    setWorkflowCanvasLoadFailedIds((current) => current.filter((id) => id !== workflowId));
    try {
      const { data } = await fetchJsonWithRetry<{ workflow?: { id?: string; canvas?: WorkflowCanvasState } }>(`/api/workspace-state?workflowCanvasId=${encodeURIComponent(workflowId)}`, { cache: "no-store" }, 2, 30_000);
      const canvas = data.workflow?.canvas;
      if (!canvas || typeof canvas !== "object") throw new Error("工作流画布数据无效");
      setWorkflowItems((current) => current.map((item) => (item.id === workflowId ? { ...item, canvas, canvasTrimmed: undefined } : item)));
      // 补拉到完整画布后，这个工作流的"在生成中"就以它自己的 isRunning 为准了，把服务端那份旧列表里的它去掉。
      if (!(canvas.nodes ?? []).some((node) => node.data?.isRunning)) {
        setRunningWorkflowIds((current) => (current.includes(workflowId) ? current.filter((id) => id !== workflowId) : current));
      }
    } catch (error) {
      console.warn("[workflow] 加载工作流画布失败", { workflowId, error });
      setWorkflowCanvasLoadFailedIds((current) => (current.includes(workflowId) ? current : [...current, workflowId]));
    } finally {
      hydratingWorkflowIdsRef.current.delete(workflowId);
    }
  }, []);

  useEffect(() => {
    if (activePanel !== "workflow" || !activeWorkflow?.canvasTrimmed) return;
    if (workflowCanvasLoadFailedIds.includes(activeWorkflow.id)) return;
    void hydrateWorkflowCanvas(activeWorkflow.id);
  }, [activePanel, activeWorkflow?.id, activeWorkflow?.canvasTrimmed, workflowCanvasLoadFailedIds, hydrateWorkflowCanvas]);
  const updateUploadedRowScrollState = useCallback(() => {
    const filesRow = uploadedFilesRowRef.current;
    const imagesRow = uploadedImagesRowRef.current;

    if (filesRow) {
      setCanScrollUploadedFiles({
        left: filesRow.scrollLeft > 1,
        right: filesRow.scrollLeft + filesRow.clientWidth < filesRow.scrollWidth - 1,
      });
    } else {
      setCanScrollUploadedFiles({ left: false, right: false });
    }

    if (imagesRow) {
      setCanScrollUploadedImages({
        left: imagesRow.scrollLeft > 1,
        right: imagesRow.scrollLeft + imagesRow.clientWidth < imagesRow.scrollWidth - 1,
      });
    } else {
      setCanScrollUploadedImages({ left: false, right: false });
    }
  }, []);
  const updateAssetGenerateReferenceScrollState = useCallback(() => {
    const row = assetGenerateReferencesRowRef.current;
    if (!row) {
      setCanScrollAssetGenerateReferences({ left: false, right: false });
      return;
    }

    setCanScrollAssetGenerateReferences({
      left: row.scrollLeft > 1,
      right: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
    });
  }, []);
  const scrollAssetGenerateReferences = useCallback((direction: -1 | 1) => {
    const row = assetGenerateReferencesRowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * Math.max(160, row.clientWidth * 0.72), behavior: "smooth" });
    window.setTimeout(updateAssetGenerateReferenceScrollState, 220);
  }, [updateAssetGenerateReferenceScrollState]);
  const removeAssetGenerateReference = useCallback((name: string) => {
    // 删缩略图：移除该参考图状态 + 删净提示词里它对应的所有 @文件名（对齐对话流规则：不允许“有@文件名、无缩略图”）。
    setActiveAssetGenerateReferences((current) => current.filter((reference) => reference.name !== name));
    const nextPrompt = removeMentionName(characterGeneratePrompt, name, { trim: true });
    setActiveAssetGeneratePrompt(nextPrompt);
    setCharacterPromptCursorOffset(Math.min(characterPromptCursorOffset, nextPrompt.length));
  }, [characterGeneratePrompt, characterPromptCursorOffset, setActiveAssetGeneratePrompt, setActiveAssetGenerateReferences]);
  const getWorkflowPreviewAsset = useCallback((workflow: WorkflowItem, node: WorkflowNode, kind: "image" | "video", url: string, asset?: AssetItem): AssetItem => {
    const nodeName = node.data.mediaSystemNames?.[url];
    const fallbackName = kind === "video" ? "视频生成" : "图片生成";
    const name = nodeName || asset?.systemName || asset?.name || fallbackName;
    const assetPrompt = asset?.sourcePrompt?.trim() ?? "";
    const sourcePrompt = assetPrompt && !isInvalidPersistedPrompt(assetPrompt) ? assetPrompt : getWorkflowNodeSourcePrompt(workflow, node);
    const previewMeta = getWorkflowPreviewMeta(kind, node, url, asset);

    if (asset) {
      return {
        ...asset,
        name,
        systemName: asset.systemName || nodeName || name,
        sourcePrompt,
        posterUrl: kind === "video" ? asset.posterUrl || node.data.posterUrl : asset.posterUrl,
        previewMeta,
        sessionId: asset.sessionId || workflow.id,
        workflowId: asset.workflowId || workflow.id,
        workflowNodeId: asset.workflowNodeId || node.id,
      };
    }

    return {
      id: `${workflow.id}-${node.id}-${kind}-${normalizeMediaUrlForMatch(url)}`,
      type: kind === "video" ? "shot_video" : "other",
      name,
      systemName: nodeName || name,
      url,
      posterUrl: kind === "video" ? node.data.posterUrl : undefined,
      librarySource: "workflow",
      sourcePrompt,
      promptSource: "generated",
      previewMeta,
      sessionId: workflow.id,
      workflowId: workflow.id,
      workflowNodeId: node.id,
      lockedType: true,
      createdAt: workflow.updatedAt ?? Date.now(),
    };
  }, []);
  const getCanonicalPreviewAsset = useCallback((asset: AssetItem): AssetItem => {
    if (isUploadedAsset(asset)) return { ...asset, previewMeta: undefined };

    const normalizedAssetUrl = normalizeMediaUrlForMatch(asset.url);
    const sourceSession = sessions.find((session) => session.id === asset.sessionId && session.messages.some((message) => message.id === asset.messageId || messageHasMediaUrl(message, asset.url))) ?? sessions.find((session) => session.messages.some((message) => message.id === asset.messageId || messageHasMediaUrl(message, asset.url)));
    const sourceMessage = sourceSession?.messages.find((message) => message.role === "assistant" && (message.id === asset.messageId || messageHasMediaUrl(message, asset.url)));
    if (!sourceSession || !sourceMessage) return asset;

    const matchedVideoUrl = getMessageVideos(sourceMessage).find((url) => normalizeMediaUrlForMatch(url) === normalizedAssetUrl);
    const matchedImageUrl = (sourceMessage.images ?? []).find((url) => normalizeMediaUrlForMatch(url) === normalizedAssetUrl);
    const mediaUrl = matchedVideoUrl ?? matchedImageUrl ?? asset.url;
    const isVideo = Boolean(matchedVideoUrl);

    return {
      ...asset,
      name: asset.name || getMediaSystemName(sourceMessage, mediaUrl, asset.name),
      sourcePrompt: isVideo ? sourceMessage.videoPrompts?.[mediaUrl] ?? sourceMessage.generationMeta?.originalPrompt ?? sourceMessage.content : getImageSourcePrompt(sourceMessage, mediaUrl),
      posterUrl: isVideo ? getVideoPosterForMessage(sourceMessage, mediaUrl) ?? asset.posterUrl : asset.posterUrl,
      previewMeta: getPreviewMediaMeta(sourceMessage, isVideo ? undefined : mediaUrl),
      sessionId: sourceSession.id,
      messageId: sourceMessage.id,
    };
  }, [sessions]);
  const visibleAssetUploadSlots = normalizeAssetUploadSlots(assetUploadSlots, getDefaultAssetUploadType(assetFilter));
  const previewMediaOptions = useMemo(() => {
    const isAssetLibraryPreview = Boolean(previewAsset && assets.some((asset) => asset.id === previewAsset.id));
    if (isAssetLibraryPreview && activePanel === "assets") {
      return assets.filter((asset) => {
        if (isAssetTrashExpired(asset, timerNow)) return false;
        return isAssetInFilter(asset, assetFilter);
      }).map(getCanonicalPreviewAsset);
    }

    if (previewAsset?.librarySource === "workflow") {
      const workflowId = previewAsset.workflowId || previewAsset.sessionId;
      const workflow = workflowItems.find((item) => item.id === workflowId);
      if (workflow?.canvas?.nodes?.length) {
        return workflow.canvas.nodes.flatMap((node) => {
          const imageItems = (node.data.images ?? []).map((url, imageIndex) => {
            const existingAsset = assets.find((asset) => isWorkflowAsset(asset) && normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(url));
            const item = getWorkflowPreviewAsset(workflow, node, "image", url, existingAsset);
            return imageIndex === 0 ? item : { ...item, id: `${item.id}-${imageIndex}` };
          });
          const videoItem = node.data.videoUrl ? (() => {
            const existingAsset = assets.find((asset) => isWorkflowAsset(asset) && normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(node.data.videoUrl as string));
            return [getWorkflowPreviewAsset(workflow, node, "video", node.data.videoUrl as string, existingAsset)];
          })() : [];
          return [...imageItems, ...videoItem];
        });
      }
    }

    return messages.flatMap((message) => {
      if (message.role !== "assistant") return [];

      const imageItems = getDisplayImageItemsForMessage(message).map(({ url, imageIndex }) => ({
        id: `${message.id}-${imageIndex}`,
        type: "other" as const,
        name: getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`),
        url,
        posterUrl: undefined,
        sourcePrompt: getImageSourcePrompt(message, url),
        previewMeta: getPreviewMediaMeta(message, url),
        sessionId: activeSessionIdValue,
        messageId: message.id,
        createdAt: message.createdAt ?? 0,
      }));

      const videoItem = getMessageVideos(message).map((url, videoIndex) => ({
        id: `${message.id}-video-${videoIndex}`,
        type: "shot_video" as const,
        name: getCanonicalMediaName(message, url, `生成视频${videoIndex + 1}`),
        url,
        posterUrl: getVideoPosterForMessage(message, url),
        sourcePrompt: message.videoPrompts?.[url] ?? message.generationMeta?.itemPrompts?.[videoIndex] ?? message.generationMeta?.originalPrompt ?? message.content,
        previewMeta: getPreviewMediaMeta(message),
        sessionId: activeSessionIdValue,
        messageId: message.id,
        createdAt: message.createdAt ?? 0,
      }));

      return [...imageItems, ...videoItem];
    });
  }, [activePanel, activeSessionIdValue, assetFilter, assets, getCanonicalMediaName, getCanonicalPreviewAsset, getWorkflowPreviewAsset, messages, previewAsset, timerNow, workflowItems]);
  const enrichAssetPreviewMeta = getCanonicalPreviewAsset;
  const previewAssetId = previewAsset?.id;
  const previewDisplayMeta = previewAsset ? enrichAssetPreviewMeta(previewAsset).previewMeta : undefined;
  const previewIsUploadedAsset = previewAsset ? isUploadedAsset(previewAsset) : false;
  const isPreviewDownloadReady = Boolean(previewAsset?.url);
  const previewSourceLabel = previewAsset && !previewDisplayMeta ? previewAsset.promptSource === "upload" || isUploadPromptPlaceholder(previewAsset.sourcePrompt) ? (isVideoAsset(previewAsset) ? "上传视频" : isAudioAsset(previewAsset) ? "上传音频" : UPLOAD_IMAGE_PROMPT_PLACEHOLDER) : "" : "";
  const previewHasReversedUploadPrompt = Boolean(previewAsset?.sourcePrompt.trim()) && previewAsset?.promptSource === "reverse" && previewIsUploadedAsset;
  const previewHasUsablePrompt = Boolean(previewAsset?.sourcePrompt.trim()) && !isUploadPromptPlaceholder(previewAsset?.sourcePrompt) && (!previewIsUploadedAsset || previewHasReversedUploadPrompt);
  const previewPromptText = previewHasUsablePrompt ? previewAsset?.sourcePrompt.trim() ?? "" : "";
  const previewAssetUrl = previewAsset?.url;
  useEffect(() => {
    if (!previewAssetUrl) { setPreviewJobReferences([]); return; }
    let cancelled = false;
    setPreviewJobReferences([]);
    void (async () => {
      try {
        const response = await fetch("/api/generation-references", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaUrl: previewAssetUrl }) });
        const data = await readJson<{ references?: Array<{ url: string; name?: string; kind: "image" | "video" | "audio" }> }>(response);
        if (!cancelled && Array.isArray(data.references)) setPreviewJobReferences(data.references);
      } catch {
        if (!cancelled) setPreviewJobReferences([]);
      }
    })();
    return () => { cancelled = true; };
  }, [previewAssetUrl]);
  const previewPromptReferences = useMemo<ImageReference[]>(() => {
    // 权威优先：数据库里这张图真正用过的参考图（GenerationJob）。
    const jobImages = previewJobReferences.filter((item) => item.kind === "image");
    if (jobImages.length > 0) return jobImages.map((item, index) => ({ name: item.name || `参考图${index + 1}`, url: item.url }));
    const session = previewAsset?.sessionId ? sessions.find((item) => item.id === previewAsset.sessionId) : undefined;
    const message = session?.messages.find((item) => item.id === previewAsset?.messageId);
    if (message?.imageReferences?.length) return message.imageReferences;
    // 回退：会话不在内存(从资产库打开)且 DB 也没查到时，按 sourcePrompt 的 @名从资产库解析。
    const content = message?.content || previewAsset?.sourcePrompt || "";
    if (!content) return [];
    const conversationRefs = session ? getConversationImageReferences(session.messages) : [];
    return getOrderedExplicitImageReferences(content, assets, [], conversationRefs);
  }, [previewAsset, sessions, assets, previewJobReferences]);
  const previewPromptMediaReferences = useMemo<MediaFileReference[]>(() => {
    // 权威优先：数据库里这张图真正用过的参考视频/音频（GenerationJob）。
    const jobMedia = previewJobReferences.filter((item) => item.kind === "video" || item.kind === "audio");
    if (jobMedia.length > 0) {
      return jobMedia.map((item) => ({ name: item.name || "", url: item.url, mediaKind: item.kind as "video" | "audio", file: { id: createClientId(), name: item.name || "", url: item.url, mediaKind: item.kind as "video" | "audio", uploadStatus: "ready", uploadProgress: 100, status: "ready", size: 0, extension: getFileExtension(item.url), storageName: item.url } }));
    }
    const session = previewAsset?.sessionId ? sessions.find((item) => item.id === previewAsset.sessionId) : undefined;
    const messageIndex = session ? session.messages.findIndex((item) => item.id === previewAsset?.messageId) : -1;
    const message = messageIndex >= 0 && session ? session.messages[messageIndex] : undefined;
    const previousUser = session && messageIndex > 0 ? [...session.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user") : undefined;
    const fromMessage = message ? getUploadedMediaReferences(message.uploadedFiles?.length ? message.uploadedFiles : previousUser?.uploadedFiles) : [];
    if (fromMessage.length > 0) return fromMessage;
    const content = message?.content || previewAsset?.sourcePrompt || "";
    if (!content) return [];
    const mentionedFiles = getMentionedAssets(content, assets).map(toUploadedFileAssetReference).filter((file): file is UploadedDocumentFile => Boolean(file));
    return getUploadedMediaReferences(mentionedFiles);
  }, [previewAsset, sessions, assets, previewJobReferences]);
  const canReversePreviewPrompt = Boolean(previewAsset && !isVideoAsset(previewAsset) && previewIsUploadedAsset && !previewHasUsablePrompt);
  const previewPromptErrorText = previewPromptError && previewPromptError.assetId === previewAssetId ? previewPromptError.message : "";
  const validReferenceNames = new Set([...getValidReferenceNames(assets, activeUploadedImages, activeConversationImageReferences), ...getUploadedMediaReferences(activeUploadedFiles).map((reference) => reference.name)]);
  const hasAnyConversationRunning = resolvingSessionIds.size > 0 || sessions.some((session) => getSessionPendingRequests(session).length > 0) || Boolean(modelInfoSessionId);
  const hasAnyAssetGenerating = assetGenerateJobs.some((job) => job.result.status === "generating");
  // 判定口径统一在 isWorkflowItemRunning()：已加载画布的看自己的 isRunning，只发标题的看服务端 runningWorkflowIds。
  const hasAnyWorkflowGenerating = activeWorkflowItems.some((workflow) => isWorkflowItemRunning(workflow, runningWorkflowIds));
  const hasAnyGenerationRunning = hasAnyConversationRunning || hasAnyAssetGenerating || hasAnyWorkflowGenerating;
  const characterValidReferenceNames = getValidReferenceNames(assets, [], []);
  const assetGenerateReferenceImages = assetGenerateReferenceDrafts[assetGenerateType] ?? [];
  const characterAtQuery = getAtQueryAtCursor(characterGeneratePrompt, characterPromptCursorOffset);
  const characterAtAssetSearch = characterAtQuery?.query ?? "";
  const characterAtAssetGroups = isCharacterAtAssetMenuOpen
    ? CHARACTER_MENTION_CATEGORIES.map((cat) => ({
        type: cat.value,
        assets: assets.filter((asset) => isAssetInFilter(asset, cat.value) && asset.name.includes(characterAtAssetSearch)),
      }))
    : [];
  const characterGenerateStyleLabel = characterGenerateStyle === "2d" ? "2D风格" : characterGenerateStyle === "3d" ? "3D风格" : "写实风格";
  const characterPreviewMeta: PreviewMediaMeta = useMemo(() => ({
    modelLabel: getGenerationModelLabel("image", characterGenerateModel),
    ratio: assetGenerateRatioLabel,
    sizeText: `${characterGenerateDisplayDimensions.width} × ${characterGenerateDisplayDimensions.height}`,
    resolution: characterGenerateDisplayResolution,
    mode: "image",
    qualityBadgeLabel: characterGenerateQualityBadgeLabel,
    styleLabel: characterGenerateStyleLabel,
  }), [assetGenerateRatioLabel, characterGenerateDisplayDimensions.height, characterGenerateDisplayDimensions.width, characterGenerateDisplayResolution, characterGenerateModel, characterGenerateQualityBadgeLabel, characterGenerateStyleLabel]);
  const characterPreviewFrameStyle: CSSProperties = useMemo(() => ({
    aspectRatio: `${characterGenerateDisplayDimensions.width} / ${characterGenerateDisplayDimensions.height}`,
    width: characterGenerateRatio === "single" ? "min(calc((100vh - 190px) * 0.5625), calc(100vw - 470px), 720px)" : "min(calc(100vh - 190px), calc(100vw - 470px), 1180px)",
    maxWidth: "calc(100% - 24px)",
    maxHeight: "calc(100% - 24px)",
  }), [characterGenerateDisplayDimensions.height, characterGenerateDisplayDimensions.width, characterGenerateRatio]);
  const hasCharacterGeneratedImage = characterGenerateResult.status === "succeeded" && Boolean(characterGenerateResult.url);
  const isCharacterGenerating = characterGenerateResult.status === "generating";
  const isCharacterGenerateInputDisabled = isCharacterGenerating || isCharacterPromptOptimizing;
  const visibleCharacterImageScale = characterImageFitMode === "fit" ? characterImageFitScale : characterImageScale;
  const characterImageScalePercent = hasCharacterGeneratedImage ? `${Math.round(visibleCharacterImageScale * 100)}%` : "适合";
  const hasConversation = messages.length > 0;
  const isActiveSessionLoading = activeSession?.messagesLoaded === false || (activeSession ? loadingSessionIds.has(activeSession.id) : false);
  const activeSessionLoadingStartedAt = activeSession ? loadingSessionStartedAt[activeSession.id] ?? timerNow : timerNow;
  const activeSessionLoadingProgress = isActiveSessionLoading ? Math.min(96, Math.floor(Math.max(0, timerNow - activeSessionLoadingStartedAt) / 180)) : 100;
  // ⭐⭐ 2026-08-08 加的**纯诊断日志**（⛔ 不改任何行为）：抓「聊天区莫名卡在『加载中...0%』」。
  //
  // 背景：2026-08-08 在测试服真走界面发被内容审核拦截的提示词，**出现过一次**卡死：
  // 整屏「加载中...0%」+ 没有红字 + 库里那条对话 msgs=0（标题存了、消息一条没存）。
  // 🗣️ 用户一句话推翻了我"初始加载还没好"的假设：**输入框能用、能打字发送，就证明加载早完成了**
  // → 这个加载态是**发送之后才出现**的，是被发送触发的。
  // 3 次复现只中 1 次、根因未坐实 → 按 AGENTS.md 顶部铁律只加日志。
  //
  // ⭐ 这条要回答的问题是二值的：**是 `messagesLoaded === false` 还是 `loadingSessionIds` 触发的？**
  // 前者 → 去看服务端 `workspace-session-messages-skipped`（谁把它置 false / 消息是否被闸门吞掉）；
  // 后者 → 是 `loadSessionDetails` 卡住了（它的 `if (!data.session) return` 会让 messagesLoaded 永远留 false）。
  // ⛔ 同一条会话只报一次，避免刷屏。
  const loadingDiagnosticReportedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isActiveSessionLoading || !activeSession) return;
    if (loadingDiagnosticReportedRef.current.has(activeSession.id)) return;
    loadingDiagnosticReportedRef.current.add(activeSession.id);
    reportClientDiagnostic("chat-session-stuck-loading", {
      sessionId: activeSession.id,
      byMessagesLoadedFalse: activeSession.messagesLoaded === false,
      byLoadingSessionIds: loadingSessionIds.has(activeSession.id),
      localMessageCount: Array.isArray(activeSession.messages) ? activeSession.messages.length : null,
      titleLength: typeof activeSession.title === "string" ? activeSession.title.length : 0,
      pendingRequestCount: getSessionPendingRequests(activeSession).length,
    });
  }, [isActiveSessionLoading, activeSession, loadingSessionIds]);
  const activeIsResolving = activeSession ? resolvingSessionIds.has(activeSession.id) : false;
  const activePendingRequests = getSessionPendingRequests(activeSession);
  const activePendingRequestCount = activePendingRequests.length;
  const activeHasMaxPendingRequests = activePendingRequestCount >= MAX_SESSION_PENDING_REQUESTS;
  // 只有在「真正需要按秒刷新的界面」出现时才开 1 秒计时器：生成进行中 / 会话加载中 / 角色图生成中 / 资产生成任务。
  // 空闲时不再每秒 setState，避免整棵大组件（含依赖 timerNow 的重 useMemo）每秒重渲染导致卡顿。
  // After a close/re-login the foreground pending request is gone but a media message can still be pending
  // (durable recovery keeps polling). Keep the 1s timer alive so the recovered waiting card's progress/elapsed advances.
  const hasRecoveringMedia = messages.some((message) => message.role === "assistant" && ((message.pendingVideoCount ?? 0) > 0 || (message.pendingImageCount ?? 0) > 0 || (message.retryingFailedVideoIndexes?.length ?? 0) > 0 || (message.retryingFailedImageIndexes?.length ?? 0) > 0 || (message.videoSavedFlashAt ? Object.values(message.videoSavedFlashAt).some((at) => Date.now() - at < 3000) : false)));
  const needsLiveTimer = activePendingRequestCount > 0 || isActiveSessionLoading || isCharacterGenerating || assetGenerateJobs.length > 0 || hasRecoveringMedia;
  const isThinking = activeIsResolving || activePendingRequests.some((request) => request.mode === "agent" || request.mode === "general") || modelInfoSessionId === activeSession?.id;
  const isMainInputDisabled = isThinking || isInputPromptOptimizing;
  const activeIsSending = activeSession ? sendingSessionIds.has(activeSession.id) : false;

  useEffect(() => {
    previewAssetRef.current = previewAsset;
  }, [previewAsset]);

  useEffect(() => {
    if (!previewAsset) return;
    const latest = previewMediaOptions.find((item) => item.id === previewAsset.id || normalizeMediaUrlForMatch(item.url) === normalizeMediaUrlForMatch(previewAsset.url));
    const latestPreviewMetaKey = latest?.previewMeta ? JSON.stringify(latest.previewMeta) : "";
    const currentPreviewMetaKey = previewAsset.previewMeta ? JSON.stringify(previewAsset.previewMeta) : "";
    if (!latest || (latest.name === previewAsset.name && latest.url === previewAsset.url && latest.posterUrl === previewAsset.posterUrl && latest.sourcePrompt === previewAsset.sourcePrompt && latestPreviewMetaKey === currentPreviewMetaKey)) return;
    const timer = window.setTimeout(() => {
      setPreviewAsset((current) => {
        if (!current || (current.id !== previewAsset.id && normalizeMediaUrlForMatch(current.url) !== normalizeMediaUrlForMatch(previewAsset.url))) return current;
        const currentMetaKey = current.previewMeta ? JSON.stringify(current.previewMeta) : "";
        if (current.name === latest.name && current.url === latest.url && current.posterUrl === latest.posterUrl && current.sourcePrompt === latest.sourcePrompt && currentMetaKey === latestPreviewMetaKey && current.sessionId === latest.sessionId && current.messageId === latest.messageId) return current;
        return { ...current, name: latest.name, url: latest.url, posterUrl: latest.posterUrl, sourcePrompt: latest.sourcePrompt, previewMeta: latest.previewMeta, sessionId: latest.sessionId, messageId: latest.messageId };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [previewAsset, previewMediaOptions]);

  const clampPreviewScale = useCallback((value: number) => Math.min(2.5, Math.max(0.1, Number(value.toFixed(2)))), []);
  const applyPreviewScale = useCallback((nextScale: number) => {
    setPreviewScale(clampPreviewScale(nextScale));
  }, [clampPreviewScale]);
  const resetPreviewTransform = useCallback(() => {
    setPreviewFitMode("fit");
    setPreviewScale(1);
    setPreviewPan({ x: 0, y: 0 });
    setPreviewNaturalSize({ width: 0, height: 0 });
    setPreviewFitScale(1);
    setIsPreviewDragging(false);
  }, []);
  const applyCharacterImageScale = useCallback((nextScale: number) => {
    setCharacterImageScale(clampPreviewScale(nextScale));
  }, [clampPreviewScale]);
  const visiblePreviewScale = previewFitMode === "fit" ? previewFitScale : previewScale;
  const previewScalePercent = `${Math.round(visiblePreviewScale * 100)}%`;
  const previewLightToolButtonStyle = resolvedTheme === "dark" ? {
    borderColor: "rgba(210, 210, 210, 0.72)",
    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(232, 234, 238, 0.42))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.72), inset 0 -1px 0 rgba(255, 255, 255, 0.2)",
    color: "#777777",
  } as CSSProperties : undefined;

  const updateCharacterImageFitScale = useCallback((dimensions = characterImageNaturalSize) => {
    if (!hasCharacterGeneratedImage || !dimensions.width || !dimensions.height) return;

    const viewport = characterViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const styles = window.getComputedStyle(viewport);
    const availableWidth = rect.width - Number.parseFloat(styles.paddingLeft) - Number.parseFloat(styles.paddingRight);
    const availableHeight = rect.height - Number.parseFloat(styles.paddingTop) - Number.parseFloat(styles.paddingBottom);
    if (availableWidth <= 0 || availableHeight <= 0) return;

    setCharacterImageFitScale(clampPreviewScale(Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height)));
  }, [characterImageNaturalSize, clampPreviewScale, hasCharacterGeneratedImage]);

  const updatePreviewFitScale = useCallback((dimensions = previewNaturalSize) => {
    if (!previewAsset || isVideoAsset(previewAsset) || !dimensions.width || !dimensions.height) return;

    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const styles = window.getComputedStyle(viewport);
    const availableWidth = rect.width - Number.parseFloat(styles.paddingLeft) - Number.parseFloat(styles.paddingRight);
    const availableHeight = rect.height - Number.parseFloat(styles.paddingTop) - Number.parseFloat(styles.paddingBottom);
    if (availableWidth <= 0 || availableHeight <= 0) return;

    setPreviewFitScale(clampPreviewScale(Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height)));
  }, [clampPreviewScale, previewAsset, previewNaturalSize]);

  useEffect(() => {
    if (!previewAssetId) return;
    const frame = window.requestAnimationFrame(() => {
      resetPreviewTransform();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [previewAssetId, resetPreviewTransform]);

  useEffect(() => {
    if (!previewAsset || isVideoAsset(previewAsset)) return;

    const frame = window.requestAnimationFrame(() => {
      const image = previewImageRef.current;
      if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
      if (normalizeMediaUrlForMatch(image.currentSrc || image.src) !== normalizeMediaUrlForMatch(previewAsset.url)) return;

      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      setPreviewNaturalSize((current) => current.width === dimensions.width && current.height === dimensions.height ? current : dimensions);
      updatePreviewFitScale(dimensions);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [previewAsset, updatePreviewFitScale]);

  useEffect(() => {
    if (!hasCharacterGeneratedImage) return;
    const frame = window.requestAnimationFrame(() => {
      setCharacterImageFitMode("fit");
      setCharacterImageScale(1);
      setCharacterImagePan({ x: 0, y: 0 });
      setCharacterImageFitScale(1);
      setIsCharacterImageDragging(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [characterGenerateResult.url, hasCharacterGeneratedImage]);

  useEffect(() => {
    if (!hasCharacterGeneratedImage) return;

    const handleResize = () => updateCharacterImageFitScale();

    updateCharacterImageFitScale();
    const resizeObserver = new ResizeObserver(handleResize);
    if (characterViewportRef.current) resizeObserver.observe(characterViewportRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [hasCharacterGeneratedImage, updateCharacterImageFitScale]);

  useEffect(() => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;

    const updateThumbScrollState = () => {
      const availableHeight = Math.max(166, window.innerHeight - 320);
      const nextPageSize = Math.max(1, Math.floor((availableHeight + 8) / 58));
      setPreviewThumbPageSize((current) => current === nextPageSize ? current : nextPageSize);
    };

    updateThumbScrollState();
    window.addEventListener("resize", updateThumbScrollState);

    return () => {
      window.removeEventListener("resize", updateThumbScrollState);
    };
  }, [previewAsset, previewMediaOptions.length]);

  useEffect(() => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;
    const currentIndex = previewMediaOptions.findIndex((item) => item.id === previewAsset.id || normalizeMediaUrlForMatch(item.url) === normalizeMediaUrlForMatch(previewAsset.url));
    if (currentIndex < 0) return;
    if (currentIndex >= previewThumbPageStart && currentIndex < previewThumbPageStart + previewThumbPageSize) return;
    const timer = window.setTimeout(() => setPreviewThumbPageStart(Math.floor(currentIndex / previewThumbPageSize) * previewThumbPageSize), 0);
    return () => window.clearTimeout(timer);
  }, [previewAsset, previewMediaOptions, previewThumbPageSize, previewThumbPageStart]);

  useEffect(() => {
    const maxStart = Math.max(0, previewMediaOptions.length - 1);
    if (previewThumbPageStart <= maxStart) return;
    const timer = window.setTimeout(() => setPreviewThumbPageStart(maxStart), 0);
    return () => window.clearTimeout(timer);
  }, [previewMediaOptions.length, previewThumbPageStart]);

  useEffect(() => {
    if (!previewAsset || isVideoAsset(previewAsset)) return;

    const handleResize = () => updatePreviewFitScale();

    updatePreviewFitScale();
    const resizeObserver = new ResizeObserver(handleResize);
    if (previewViewportRef.current) resizeObserver.observe(previewViewportRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [previewAsset, updatePreviewFitScale]);

  const shiftPreviewAsset = useCallback((direction: number) => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;
    const currentIndex = previewMediaOptions.findIndex((item) => item.id === previewAsset.id || normalizeMediaUrlForMatch(item.url) === normalizeMediaUrlForMatch(previewAsset.url));
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= previewMediaOptions.length) return;
    const visibleEnd = Math.min(previewMediaOptions.length - 1, previewThumbPageStart + previewThumbPageSize - 1);
    let nextPageStart = previewThumbPageStart;

    if (direction > 0 && currentIndex >= visibleEnd) nextPageStart = nextIndex;
    if (direction < 0 && currentIndex <= previewThumbPageStart) nextPageStart = Math.max(0, nextIndex - previewThumbPageSize + 1);

    setPreviewThumbPageStart(nextPageStart);
    resetPreviewTransform();
    setPreviewAsset(previewMediaOptions[nextIndex]);
  }, [previewAsset, previewMediaOptions, previewThumbPageSize, previewThumbPageStart, resetPreviewTransform]);

  const pagePreviewThumbs = useMemo(() => previewMediaOptions.slice(previewThumbPageStart, previewThumbPageStart + previewThumbPageSize), [previewMediaOptions, previewThumbPageSize, previewThumbPageStart]);
  const previewThumbsNeedScroll = previewMediaOptions.length > previewThumbPageSize;
  const pagePreviewThumbListHeight = Math.max(0, previewThumbPageSize * 50 + Math.max(0, previewThumbPageSize - 1) * 8);
  const previewThumbPreloadCount = Math.min(previewMediaOptions.length, Math.max(previewThumbPageSize * 2, previewThumbPageStart + previewThumbPageSize * 2));
  const canPagePreviewThumbsUp = previewThumbPageStart > 0;
  const canPagePreviewThumbsDown = previewThumbPageStart + previewThumbPageSize < previewMediaOptions.length;
  useEffect(() => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;

    for (const item of previewMediaOptions.slice(0, previewThumbPreloadCount)) {
      if (isVideoAsset(item)) continue;
      const key = normalizeMediaUrlForMatch(item.url);
      if (!key || preloadedPreviewThumbUrlsRef.current.has(key)) continue;
      preloadedPreviewThumbUrlsRef.current.add(key);
      const image = new window.Image();
      image.decoding = "async";
      image.src = item.url;
    }
  }, [previewAsset, previewMediaOptions, previewThumbPreloadCount]);

  const pagePreviewThumbsByButton = useCallback((direction: number) => {
    if (previewMediaOptions.length <= previewThumbPageSize) return;
    if (direction > 0 && !canPagePreviewThumbsDown) return;
    if (direction < 0 && !canPagePreviewThumbsUp) return;

    const nextStart = direction > 0 ? previewThumbPageStart + previewThumbPageSize : Math.max(0, previewThumbPageStart - previewThumbPageSize);
    const nextIndex = direction > 0 ? nextStart : Math.min(previewMediaOptions.length - 1, nextStart + previewThumbPageSize - 1);
    setPreviewThumbPageStart(nextStart);
    resetPreviewTransform();
    setPreviewAsset(previewMediaOptions[nextIndex]);
  }, [canPagePreviewThumbsDown, canPagePreviewThumbsUp, previewMediaOptions, previewThumbPageSize, previewThumbPageStart, resetPreviewTransform]);

  const copyPreviewPrompt = useCallback(async () => {
    if (!previewPromptText) return;
    try {
      await navigator.clipboard.writeText(previewPromptText);
      setPreviewPromptCopyState("success");
    } catch {
      setPreviewPromptCopyState("error");
    }
    window.setTimeout(() => setPreviewPromptCopyState("idle"), 1200);
  }, [previewPromptText]);

  const setSessionSending = useCallback((sessionId: string, isSending: boolean) => {
    if (isSending) {
      sendingSessionIdsRef.current.add(sessionId);
    } else {
      sendingSessionIdsRef.current.delete(sessionId);
    }

    setSendingSessionIds((current) => {
      const next = new Set(current);
      if (isSending) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return next;
    });
  }, []);

  const showInputTip = useCallback((message: string) => {
    const nextTip: ReminderMessage = { message, tone: "default" };
    const currentTip = inputCurrentTipRef.current;

    if (inputTipTimerRef.current !== null || currentTip) {
      if (currentTip?.message === nextTip.message && currentTip.tone === nextTip.tone) return;
      const lastQueuedTip = inputTipQueueRef.current[inputTipQueueRef.current.length - 1];
      if (lastQueuedTip?.message === nextTip.message && lastQueuedTip.tone === nextTip.tone) return;
      inputTipQueueRef.current.push(nextTip);
      return;
    }

    inputCurrentTipRef.current = nextTip;
    setInputReminder(nextTip);
    inputTipTimerRef.current = window.setTimeout(() => {
      setInputReminder((current) => current ? { ...current, exiting: true } : current);
      inputTipTimerRef.current = window.setTimeout(() => {
        inputCurrentTipRef.current = undefined;
        if (inputTipQueueRef.current.length > 0) {
          showNextInputTipRef.current?.();
          return;
        }

        setInputReminder(undefined);
        inputTipTimerRef.current = null;
      }, 100);
    }, 3000);
  }, []);

  useEffect(() => {
    showNextInputTipRef.current = () => {
      const nextTip = inputTipQueueRef.current.shift();
      if (!nextTip) {
        setInputReminder(undefined);
        inputTipTimerRef.current = null;
        return;
      }

      inputCurrentTipRef.current = nextTip;
      setInputReminder(nextTip);
      if (inputTipTimerRef.current !== null) {
        window.clearTimeout(inputTipTimerRef.current);
      }
      inputTipTimerRef.current = window.setTimeout(() => {
        setInputReminder((current) => current ? { ...current, exiting: true } : current);
        inputTipTimerRef.current = window.setTimeout(() => {
          inputCurrentTipRef.current = undefined;
          if (inputTipQueueRef.current.length > 0) {
            showNextInputTipRef.current?.();
            return;
          }

          setInputReminder(undefined);
          inputTipTimerRef.current = null;
        }, 100);
      }, 2000);
    };
  }, []);

  const showAssetUploadTipNow = useCallback((tip: ReminderMessage) => {
    assetUploadCurrentTipRef.current = tip;
    setAssetUploadTip(tip);
    if (assetUploadTipTimerRef.current !== null) {
      window.clearTimeout(assetUploadTipTimerRef.current);
    }
    assetUploadTipTimerRef.current = window.setTimeout(() => {
      setAssetUploadTip((current) => current ? { ...current, exiting: true } : current);
      assetUploadTipTimerRef.current = window.setTimeout(() => {
        assetUploadCurrentTipRef.current = undefined;
        if (assetUploadTipQueueRef.current.length > 0) {
          showNextAssetUploadTipRef.current?.();
          return;
        }
        setAssetUploadTip(undefined);
        assetUploadTipTimerRef.current = null;
      }, 100);
    }, 2000);
  }, []);
  useEffect(() => {
    showNextAssetUploadTipRef.current = () => {
      const nextTip = assetUploadTipQueueRef.current.shift();
      if (!nextTip) {
        setAssetUploadTip(undefined);
        assetUploadTipTimerRef.current = null;
        return;
      }
      showAssetUploadTipNow(nextTip);
    };
  }, [showAssetUploadTipNow]);

  const showAssetUploadTip = useCallback((message: string, tone: ReminderMessage["tone"] = "default") => {
    const nextTip = { message, tone };
    const currentTip = assetUploadCurrentTipRef.current;

    if (assetUploadTipTimerRef.current !== null || currentTip) {
      if (currentTip?.message === nextTip.message && currentTip.tone === nextTip.tone) return;
      const lastQueuedTip = assetUploadTipQueueRef.current[assetUploadTipQueueRef.current.length - 1];
      if (lastQueuedTip?.message === nextTip.message && lastQueuedTip.tone === nextTip.tone) return;
      assetUploadTipQueueRef.current.push(nextTip);
      return;
    }

    showAssetUploadTipNow(nextTip);
  }, [showAssetUploadTipNow]);

  const showGenerationCompleteTipNow = useCallback((tip: ReminderMessage) => {
    generationCompleteCurrentTipRef.current = tip;
    setGenerationCompleteReminder(tip);
    if (generationCompleteTipTimerRef.current !== null) {
      window.clearTimeout(generationCompleteTipTimerRef.current);
    }
    generationCompleteTipTimerRef.current = window.setTimeout(() => {
      setGenerationCompleteReminder((current) => current ? { ...current, exiting: true } : current);
      generationCompleteTipTimerRef.current = window.setTimeout(() => {
        generationCompleteCurrentTipRef.current = undefined;
        if (generationCompleteTipQueueRef.current.length > 0) {
          showNextGenerationCompleteTipRef.current?.();
          return;
        }
        setGenerationCompleteReminder(undefined);
        generationCompleteTipTimerRef.current = null;
      }, 100);
    }, 2000);
  }, []);

  useEffect(() => {
    showNextGenerationCompleteTipRef.current = () => {
      const nextTip = generationCompleteTipQueueRef.current.shift();
      if (!nextTip) {
        setGenerationCompleteReminder(undefined);
        generationCompleteTipTimerRef.current = null;
        return;
      }
      showGenerationCompleteTipNow(nextTip);
    };
  }, [showGenerationCompleteTipNow]);

  const showGenerationCompleteTip = useCallback((message: string) => {
    if (!notifyOnGenerationComplete) return;
    const nextTip: ReminderMessage = { message, tone: "success" };
    const currentTip = generationCompleteCurrentTipRef.current;

    if (generationCompleteTipTimerRef.current !== null || currentTip) {
      if (currentTip?.message === nextTip.message && currentTip.tone === nextTip.tone) return;
      const lastQueuedTip = generationCompleteTipQueueRef.current[generationCompleteTipQueueRef.current.length - 1];
      if (lastQueuedTip?.message === nextTip.message && lastQueuedTip.tone === nextTip.tone) return;
      generationCompleteTipQueueRef.current.push(nextTip);
      return;
    }

    showGenerationCompleteTipNow(nextTip);
  }, [notifyOnGenerationComplete, showGenerationCompleteTipNow]);

  const notifyGenerationCompleteOnce = useCallback((requestId: string, message: string) => {
    if (completedNotificationRequestIdsRef.current.has(requestId)) return;
    completedNotificationRequestIdsRef.current.add(requestId);
    showGenerationCompleteTip(message);
  }, [showGenerationCompleteTip]);

  const selectAssetUploadFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showAssetUploadTip("请选择图片文件");
      return;
    }
    const invalidFile = imageFiles.map(validateImageUploadFile).find(Boolean);
    if (invalidFile) {
      showAssetUploadTip(invalidFile);
      return;
    }

    try {
      const defaultType = getDefaultAssetUploadType(assetFilter);
      const newItems = await Promise.all(imageFiles.map(readFileAsAssetUploadItem));
      const newItemsWithDimensions = await Promise.all(newItems.map(async (item) => ({
        ...item,
        dimensions: await getDataUrlImageDimensions(item.dataUrl).catch(() => undefined),
      })));
      const normalizedSlots = normalizeAssetUploadSlots(assetUploadSlots, defaultType);
      const existingCount = normalizedSlots.filter((slot) => slot.dataUrl).length;
      const availableCount = Math.max(0, ASSET_UPLOAD_SLOT_COUNT - existingCount);
      const acceptedItems = newItemsWithDimensions.slice(0, availableCount);
      let itemIndex = 0;
      const nextSlots: AssetUploadSlot[] = normalizedSlots.map((slot) => {
        if (slot.dataUrl || itemIndex >= acceptedItems.length) return slot;
        const item = acceptedItems[itemIndex];
        itemIndex += 1;
        return { ...slot, fileName: item.fileName, originalFileName: item.fileName, dataUrl: item.dataUrl, uploadFile: item.file, dimensions: item.dimensions, isDuplicate: false, tempToken: undefined, uploadStatus: "uploading", uploadProgress: 6, error: undefined };
      });

      setAssetUploadSlots(nextSlots);
      if (newItemsWithDimensions.length > availableCount) showAssetUploadTip("最多同时上传10张");
    } catch (error) {
      showAssetUploadTip(toUserErrorMessage(error, "图片读取失败"));
    }
  }, [assetFilter, assetUploadSlots, showAssetUploadTip]);

  const selectAssetMediaUploadFiles = useCallback(async (kind: "video" | "audio", files: File[]) => {
    for (const file of files) {
      const fileError = validateMediaUploadFile(file, kind);
      if (fileError) { showAssetUploadTip(fileError); continue; }
      try {
        const metadata = await readMediaFileMetadata(file, kind);
        const metadataError = validateMediaUploadMetadata(kind, { durationSeconds: metadata.durationSeconds, width: metadata.dimensions?.width, height: metadata.dimensions?.height });
        if (metadataError) { showAssetUploadTip(metadataError); continue; }
        // 临时卡：上传期间先显示本地首帧 + 蓝色进度，和上传图片一致。
        const cardId = createClientId();
        const previewUrl = URL.createObjectURL(file);
        setAssetMediaUploadCards((current) => [{ id: cardId, kind, fileName: file.name.replace(/\.[^.]+$/, ""), previewUrl, progress: 2 }, ...current]);
        const clearCard = () => {
          setAssetMediaUploadCards((current) => current.filter((card) => card.id !== cardId));
          URL.revokeObjectURL(previewUrl);
        };
        try {
          const uploaded = await uploadDocumentFileAsset(file, { mediaKind: kind, durationSeconds: metadata.durationSeconds, dimensions: metadata.dimensions }, (progress) => {
            setAssetMediaUploadCards((current) => current.map((card) => card.id === cardId ? { ...card, progress } : card));
          });
          if (uploaded.duplicate) { showAssetUploadTip(`${kind === "video" ? "视频" : "音频"}已存在，无需重复上传！`); clearCard(); continue; }
          // 进度条消失前先把封面/音频预热好，做到"遮罩消失即成功可播放"。
          await preloadUploadedMedia(kind, uploaded.url, uploaded.posterUrl);
          const name = uploaded.name || file.name.replace(/\.[^.]+$/, "") || (kind === "video" ? "上传视频" : "上传音频");
          const filter = kind === "video" ? "upload_videos" : "upload_audios";
          setAssets((current) => current.some((asset) => asset.url === uploaded.url) ? current : [{ id: createClientId(), type: "other", mediaType: kind, name, systemName: name, url: uploaded.url, posterUrl: uploaded.posterUrl, librarySource: "conversation", sourcePrompt: kind === "video" ? "上传视频" : "上传音频", promptSource: "upload", sessionId: activeSessionIdValue, lockedType: true, createdAt: Date.now() }, ...current]);
          adjustAssetCounts([{ filter, delta: 1 }]);
          clearCard();
        } catch (uploadError) {
          clearCard();
          throw uploadError;
        }
      } catch (error) {
        showAssetUploadTip(toUserErrorMessage(error, kind === "video" ? "视频上传失败" : "音频上传失败"));
      }
    }
  }, [activeSessionIdValue, adjustAssetCounts, showAssetUploadTip]);

  useEffect(() => {
    assetUploadSlots.forEach((slot) => {
      if (slot.uploadStatus !== "uploading" || !slot.uploadFile || assetUploadAbortControllersRef.current.has(slot.id)) return;

      const controller = new AbortController();
      assetUploadAbortControllersRef.current.set(slot.id, controller);
      void uploadTemporaryAssetImage(slot.uploadFile, (progress) => {
        setAssetUploadSlots((current) => current.map((item) => item.id === slot.id ? { ...item, uploadStatus: "uploading", uploadProgress: progress } : item));
      }, controller.signal, Boolean(slot.forceReencode), true)
        .then((result) => {
          assetUploadAbortControllersRef.current.delete(slot.id);
          const dupUrl = "duplicate" in result ? result.url : undefined;
          if (dupUrl) showAssetUploadTip("图片已存在，无需重复上传！");
          setAssetUploadSlots((current) => current.map((item) => item.id === slot.id ? { ...item, uploadFile: undefined, tempToken: "duplicate" in result ? undefined : result.token, tempUrl: dupUrl, contentHash: result.contentHash, serverName: result.name, isDuplicate: Boolean(dupUrl), uploadStatus: "ready", uploadProgress: 100, forceReencode: undefined, error: undefined } : item));
        })
        .catch((error) => {
          assetUploadAbortControllersRef.current.delete(slot.id);
          if (controller.signal.aborted) return;
          const errorMessage = toUserErrorMessage(error, "上传失败");
          reportClientDiagnostic("asset-upload-temp failed", { fileName: slot.fileName, error: errorMessage, rawError: error instanceof Error ? error.message : String(error) });
          setAssetUploadSlots((current) => current.map((item) => item.id === slot.id ? { ...item, uploadStatus: "error", uploadProgress: 100, error: errorMessage } : item));
        });
    });
  }, [assetUploadSlots]);

  const retryAssetUploadSlot = useCallback((index: number) => {
    const slot = assetUploadSlots[index];
    if (!slot?.uploadFile) {
      showAssetUploadTip("请重新选择图片");
      return;
    }
    assetUploadAbortControllersRef.current.get(slot.id)?.abort();
    assetUploadAbortControllersRef.current.delete(slot.id);
    setAssetUploadSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, tempToken: undefined, uploadStatus: "uploading", uploadProgress: 6, forceReencode: true, error: undefined } : item));
  }, [assetUploadSlots, showAssetUploadTip]);

  const removeAssetUploadSlot = useCallback((index: number) => {
    const slot = assetUploadSlots[index];
    if (slot) {
      assetUploadAbortControllersRef.current.get(slot.id)?.abort();
      assetUploadAbortControllersRef.current.delete(slot.id);
      if (slot.tempToken) void deleteTemporaryAssetImages([slot.tempToken]);
    }
    setAssetUploadSlots((current) => {
      const defaultType = getDefaultAssetUploadType(assetFilter);
      const normalized = normalizeAssetUploadSlots(current, defaultType);
      const kept = normalized.filter((_, slotIndex) => slotIndex !== index && normalized[slotIndex].dataUrl);
      return normalizeAssetUploadSlots(kept, defaultType);
    });
  }, [assetFilter, assetUploadSlots]);

  const submitAssetUpload = useCallback(async () => {
    const uploadItems = visibleAssetUploadSlots.filter((slot) => slot.dataUrl && slot.uploadStatus === "ready" && (slot.tempToken || slot.tempUrl));
    if (uploadItems.length === 0 || isAssetUploading) return;
    if (uploadItems.some((slot) => slot.uploadStatus === "uploading")) {
      showAssetUploadTip("图片上传中，请稍候");
      return;
    }

    setIsAssetUploading(true);

    try {
      const uploadedItems = await Promise.all(uploadItems.map(async (slot) => {
        // 命中内容哈希去重的槽位（tempUrl）复用已有图，不再 commit；其余提交临时文件拿正式地址。
        const url = slot.tempToken ? await commitTemporaryAssetImage(slot.tempToken) : (slot.tempUrl as string);
        return {
          // 名字一律由服务端权威定（去扩展名 + 全局唯一 + 同图复用同名）；serverName 兜底才用本地清洗名。
          name: slot.serverName || sanitizeAssetName(slot.fileName) || sanitizeAssetName(slot.originalFileName) || "上传图片",
          type: slot.type,
          url,
          contentHash: slot.contentHash,
          isDuplicate: Boolean(slot.tempUrl),
          slot,
        };
      }));

      const validItems = uploadedItems.filter((item) => item.url);
      // 上传时按 contentHash 命中判重的，直接算"已存在"。
      const contentHashDuplicateCount = validItems.filter((item) => item.isDuplicate).length;
      const candidates = validItems.filter((item) => !item.isDuplicate);

      // 提交入库并等待结果：服务端返回权威 name（去扩展名 + 全局唯一 + 同图复用同名）与
      // duplicate=true（这张图同内容/同 url 已在库里，可能在别的分类，不是新图）。
      const postResults = await Promise.all(candidates.map(async (item) => {
        try {
          const response = await fetch("/api/media-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: item.url,
              name: item.name,
              currentCategory: "conversation_uploads",
              mediaType: "image",
              sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
              promptSource: "upload",
              conversationId: activeSessionIdValue,
              contentHash: item.contentHash,
            }),
          });
          const data = await response.json().catch(() => undefined);
          return { item: { ...item, name: (typeof data?.name === "string" && data.name.trim()) ? data.name.trim() : item.name }, duplicate: Boolean(data?.duplicate) };
        } catch (error) {
          console.warn("[media-assets] failed to persist uploaded asset", error);
          return { item, duplicate: false };
        }
      }));

      // 只把服务端确认的新图加入库（重复图不加，避免出现"上传成功却在上传库里找不到"的幽灵）。
      const persistedItems = postResults.filter((result) => !result.duplicate).map((result) => result.item);
      const duplicateCount = contentHashDuplicateCount + postResults.filter((result) => result.duplicate).length;

      if (persistedItems.length > 0) {
        setAssets((current) => {
          let nextAssets = current;
          persistedItems.forEach((item) => {
            if (nextAssets.some((asset) => asset.url === item.url)) return;
            nextAssets = [
              {
                id: createClientId(),
                type: "other",
                name: item.name,
                systemName: item.name,
                url: item.url,
                librarySource: "conversation",
                sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
                promptSource: "upload",
                sessionId: activeSessionIdValue,
                lockedType: true,
                createdAt: Date.now(),
              },
              ...nextAssets,
            ];
          });
          return nextAssets;
        });
        adjustAssetCounts([{ filter: "conversation_uploads", delta: persistedItems.length }]);
      }

      if (persistedItems.length > 0 && duplicateCount > 0) showAssetUploadTip(`成功上传${persistedItems.length}张图片，${duplicateCount}张已存在`, "success");
      else if (persistedItems.length > 0) showAssetUploadTip(`成功上传${persistedItems.length}张图片`, "success");
      else if (duplicateCount > 0) showAssetUploadTip("图片已存在，无需重复上传！");
      assetUploadAbortControllersRef.current.clear();
      setAssetUploadSlots(createAssetUploadSlots(getDefaultAssetUploadType(assetFilter)));
    } catch (error) {
      showAssetUploadTip(toUserErrorMessage(error, "图片上传失败，请稍后再试。"));
    } finally {
      setIsAssetUploading(false);
    }
  }, [activeSessionIdValue, adjustAssetCounts, assetFilter, assets, isAssetUploading, showAssetUploadTip, visibleAssetUploadSlots]);

  useEffect(() => {
    const selectedSlots = assetUploadSlots.filter((slot) => slot.dataUrl);
    if (isAssetUploading || selectedSlots.length === 0 || selectedSlots.some((slot) => slot.uploadStatus === "uploading")) return;
    if (selectedSlots.some((slot) => slot.uploadStatus === "ready" && (slot.tempToken || slot.tempUrl))) void submitAssetUpload();
  }, [assetUploadSlots, isAssetUploading, submitAssetUpload]);

  // ⭐⭐ 2026-08-09 用户拍板：**超字数不删字**。这里只做安全网截断（99999），
  //    超限的表达 = 计数器变红 + 发送键灰掉 + 发送时拦截。⛔ 别把 currentPromptMaxLength 拿回来 slice。
  const setActiveDraftInput = useCallback((value: string) => {
    const nextValue = Array.from(value).slice(0, PROMPT_MAX_LENGTH_CEILING).join("");
    if (value !== nextValue) showInputTip(getPromptCeilingTipText());
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? { ...session, draftInput: nextValue, updatedAt: Date.now() } : session)));
  }, [activeSessionId, showInputTip]);

  const setActiveDraftInputWithMentionCards = useCallback((value: string, restore?: { images?: UploadedImage[]; files?: UploadedDocumentFile[] }) => {
    const nextValue = Array.from(value).slice(0, PROMPT_MAX_LENGTH_CEILING).join("");
    if (value !== nextValue) showInputTip(getPromptCeilingTipText());
    // 有显式 restore（使用提示词/预览还原）= 该媒体自己出生时钉下的完整引用包就是唯一权威，
    // 只用它，绝不再拿提示词文字里的 @名去当前资产库重新派生卡片（否则删了又被@文字重造、或库里换了名会串）。
    const hasExplicitRestore = restore !== undefined;
    const mentionedAssets = hasExplicitRestore ? [] : getMentionedAssets(nextValue, assets);
    const mentionedConversationImages = hasExplicitRestore ? [] : getMentionNames(nextValue)
      .map((name) => activeConversationImageReferences.find((reference) => reference.name === name))
      .filter((reference): reference is ImageReference => Boolean(reference))
      .map((reference) => ({ id: createClientId(), name: reference.name, referenceName: reference.name, url: reference.url, source: "asset" as const }));
    const mentionedImages = [...mentionedAssets.filter((asset) => !isVideoAsset(asset) && !isAudioAsset(asset) && !isNonDisplayableFileAsset(asset.url)).map(toUploadedAssetReference), ...mentionedConversationImages];
    const mentionedFiles = mentionedAssets.map(toUploadedFileAssetReference).filter((file): file is UploadedDocumentFile => Boolean(file));
    // Restore items (from the source message's real attachments) take priority over re-derived @-mentions.
    const restoreImages = restore?.images ?? [];
    const restoreFiles = restore?.files ?? [];

    setSessions((current) => current.map((session) => {
      if (session.id !== activeSessionId) return session;
      // 使用提示词/预览还原（有显式 restore）：媒体整个替换成该条自己的引用包，不保留输入框原有的图/视频/音频。
      // 无显式 restore（普通 @ 派生）：在现有基础上累加。
      const existingImages = hasExplicitRestore ? [] : (session.uploadedImages ?? []);
      const existingFiles = hasExplicitRestore ? [] : (session.uploadedFiles ?? []);
      const maxImages = currentUploadRule.image.maxCount;
      const nextImages = [...existingImages];
      [...restoreImages, ...mentionedImages].forEach((image) => {
        if (nextImages.length >= maxImages || nextImages.some((item) => normalizeMediaUrlForMatch(item.url) === normalizeMediaUrlForMatch(image.url))) return;
        nextImages.push(image);
      });
      const nextFiles = [...existingFiles];
      [...restoreFiles, ...mentionedFiles].forEach((file) => {
        if (nextFiles.some((item) => normalizeMediaUrlForMatch(getUploadedMediaFileUrl(item) || getUploadedFileStorageValue(item)) === normalizeMediaUrlForMatch(file.url ?? file.storageName))) return;
        nextFiles.push(file);
      });
      return { ...session, draftInput: nextValue, uploadedImages: nextImages, uploadedFiles: nextFiles, updatedAt: Date.now() };
    }));
  }, [activeConversationImageReferences, activeSessionId, assets, currentUploadRule.image.maxCount, showInputTip]);

  const addSessionUsage = useCallback((sessionId: string, usage?: UsageMeta) => {
    if (!usage) return;

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionId) return session;
        const nextUsage = addUsageSummary(session.usageSummary, usage);
        return nextUsage ? { ...session, usageSummary: nextUsage } : session;
      }),
    );
  }, []);

  const addSessionGeneratedMediaCount = useCallback((sessionId: string, images: number, videos: number) => {
    if (images <= 0 && videos <= 0) return;
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionId) return session;
        const prev = session.generatedMediaCounts ?? getSessionMediaCounts(session);
        const next = session.generatedMediaCounts
          ? { images: prev.images + Math.max(0, images), videos: prev.videos + Math.max(0, videos) }
          : prev;
        return { ...session, generatedMediaCounts: next };
      }),
    );
  }, []);

  const applyCreditResult = useCallback((sessionId: string, credit?: CreditMeta) => {
    if (!credit || credit.skipped) return;
    if (typeof credit.balance === "number") setCurrentUserCredits(Math.max(0, Math.floor(credit.balance)));
    const chargedCredits = Math.max(0, Math.floor(credit.chargedCredits ?? 0));
    if (chargedCredits > 0) addSessionUsage(sessionId, { credits: chargedCredits });
  }, [addSessionUsage]);

  const applyWorkflowCreditResult = useCallback((credit?: { skipped?: boolean; balance?: number }) => {
    if (!credit || credit.skipped) return;
    if (typeof credit.balance === "number") setCurrentUserCredits(Math.max(0, Math.floor(credit.balance)));
    setWorkflowItems((current) => current.map((workflow) => {
      if (workflow.id !== activeWorkflowId) return workflow;
      const chargedCredits = Math.max(0, Math.floor((credit as { chargedCredits?: number }).chargedCredits ?? 0));
      const usage = (credit as { usage?: UsageMeta }).usage;
      const usageWithCredits = usage ? { ...usage, credits: Math.max(0, Math.floor(usage.credits ?? 0)) + chargedCredits } : chargedCredits > 0 ? { credits: chargedCredits } : undefined;
      const nextUsage = addUsageSummary(workflow.usageSummary, usageWithCredits);
      return nextUsage ? { ...workflow, usageSummary: nextUsage, updatedAt: Date.now() } : workflow;
    }));
  }, [activeWorkflowId]);

  const ensureSessionMemorySummary = useCallback(async (session: WorkSession, model: ModelName, requestId: string) => {
    if (!shouldUpdateMemorySummary(session)) return session;

    const sourceMessages = getSummarySourceMessages(session);
    if (sourceMessages.length === 0) return session;

    try {
      const response = await fetch("/api/conversation-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          previousSummary: session.memorySummary?.content,
          messages: sourceMessages,
          conversationId: session.id,
          conversationTitle: session.title,
          requestId,
        }),
      });
      const data = await readJson<{ summary?: string; usage?: UsageMeta; credit?: CreditMeta }>(response);
      const summary = data.summary?.trim();
      if (!summary) return session;

      addSessionUsage(session.id, data.usage);
      applyCreditResult(session.id, data.credit);

      const nonSystemMessages = session.messages.filter((message) => message.role !== "system");
      const nextMemorySummary: SessionMemorySummary = {
        content: summary,
        updatedAt: Date.now(),
        summarizedMessageId: nonSystemMessages[nonSystemMessages.length - 1]?.id,
        summarizedTokenEstimate: estimateMessageTokens(nonSystemMessages),
      };
      const nextSession = { ...session, memorySummary: nextMemorySummary };

      setSessions((current) => current.map((item) => item.id === session.id ? { ...item, memorySummary: nextMemorySummary } : item));
      return nextSession;
    } catch (error) {
      console.error("[conversation-memory] summary failed", { sessionId: session.id, requestId, error });
      return session;
    }
  }, [addSessionUsage, applyCreditResult]);

  const reversePreviewPrompt = useCallback(async () => {
    if (!previewAsset || isVideoAsset(previewAsset) || isReversePromptingPreview) return;
    if (!isUploadedAsset(previewAsset) || (previewAsset.sourcePrompt.trim() && !isUploadPromptPlaceholder(previewAsset.sourcePrompt))) return;

    setIsReversePromptingPreview(true);
    setPreviewPromptError(null);
    try {
      const reverseModels = [...PROMPT_TOOL_MODEL_CHAIN];
      let data: ChatApiResponse | undefined;
      let nextPrompt = "";
      let lastError: unknown;

      for (const [modelIndex, model] of reverseModels.entries()) {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              mode: "image",
              messages: [{ role: "user", content: "请根据这张图片反推出一段可用于 AI 生图的中文提示词。只输出提示词正文，不要解释，不要分点。", images: [previewAsset.url] }],
              conversationId: activeSessionIdValue,
              conversationTitle: activeSession?.title,
              requestId: createClientId(),
              metadata: { creditSource: "image_prompt_reverse", mediaUrls: [previewAsset.url], recordFailure: modelIndex === reverseModels.length - 1 },
            }),
          });
          data = await readJson<ChatApiResponse>(response);
          nextPrompt = data.content?.trim() ?? "";
          if (nextPrompt) break;
        } catch (error) {
          lastError = error;
        }
      }

      void lastError;
      if (!data || !nextPrompt) throw new Error("服务器繁忙，请稍候再试！");
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);
      setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, sourcePrompt: nextPrompt, promptSource: "reverse" } : current);
      setAssets((current) => current.map((asset) => asset.id === previewAsset.id || normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(previewAsset.url) ? { ...asset, sourcePrompt: nextPrompt, promptSource: "reverse" } : asset));
      if (workspaceStorageMode === "user") {
        void fetch("/api/media-assets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: previewAsset.id, mediaAssetId: previewAsset.mediaId, url: previewAsset.url, reversePrompt: nextPrompt }),
        }).catch((error) => console.warn("[media-assets] failed to persist reverse prompt", error));
      }
    } catch (error) {
      setPreviewPromptError({ assetId: previewAsset.id, message: toUserErrorMessage(error, "服务器繁忙，请稍候再试！") });
    } finally {
      setIsReversePromptingPreview(false);
    }
  }, [activeSession, activeSessionIdValue, addSessionUsage, applyCreditResult, isReversePromptingPreview, previewAsset, showInputTip, workspaceStorageMode]);

  const applyBytePlusAssetUpdatesByUrl = useCallback((updates: Array<{ url?: string; assetId?: string; groupId?: string; status?: AssetItem["bytePlusAssetStatus"]; error?: string }>) => {
    const updateByUrl = new Map(updates.filter((item) => item.url && item.assetId).map((item) => [normalizeMediaUrlForMatch(item.url ?? ""), item]));
    if (updateByUrl.size === 0) return;

    const patchAsset = (asset: AssetItem) => {
      const update = updateByUrl.get(normalizeMediaUrlForMatch(asset.url));
      if (!update?.assetId) return asset;
      return {
        ...asset,
        bytePlusAssetId: update.assetId,
        bytePlusAssetGroupId: update.groupId,
        bytePlusAssetStatus: update.status ?? "Active",
        bytePlusAssetError: update.error,
        bytePlusAssetUpdatedAt: Date.now(),
      };
    };

    setPreviewAsset((current) => current ? patchAsset(current) : current);
    setAssets((current) => current.map(patchAsset));
  }, []);

  const addActiveUploadedImages = useCallback((images: UploadedImage[], options?: { draftBase?: string; draftSuffix?: string; insertReferenceText?: boolean }) => {
    if (images.length === 0) return;

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSessionId) return session;

        const existingImages = session.uploadedImages ?? [];
        const maxImages = currentUploadRule.image.maxCount;
        const availableCount = Math.max(0, maxImages - existingImages.length);
        const newImages = images.filter((image) => !existingImages.some((item) => item.url === image.url)).slice(0, availableCount);
        // 给每张新图分配唯一稳定的引用名：不同图即使文件名相同也错开成 名_2/名_3，避免 @文件名 撞名无法区分。
        const usedReferenceNames = new Set(existingImages.map((item) => getUploadedImageReferenceName(item, existingImages)));
        const dedupedNewImages = newImages.map((image) => {
          const base = (image.referenceName && image.referenceName.trim()) || getUploadedReferenceBaseName(image.name);
          const uniqueName = makeUniqueReferenceName(base, usedReferenceNames);
          usedReferenceNames.add(uniqueName);
          return { ...image, referenceName: uniqueName };
        });
        const nextUploadedImages = [...existingImages, ...dedupedNewImages].slice(0, maxImages);
        const acceptedImages = images
          .map((image) => nextUploadedImages.find((item) => item.url === image.url))
          .filter((image): image is UploadedImage => Boolean(image));
        const referenceText = options?.insertReferenceText ? acceptedImages.map((image) => `@${getUploadedImageReferenceName(image, nextUploadedImages)}`).filter((name, index, array) => array.indexOf(name) === index).join(" ") : "";
        const currentDraft = options?.draftBase ?? session.draftInput ?? "";
        const draftSuffix = options?.draftSuffix ?? "";
        const rawNextDraft = referenceText ? `${currentDraft}${currentDraft && !/\s$/.test(currentDraft) ? " " : ""}${referenceText} ${draftSuffix}` : `${currentDraft}${draftSuffix}`;
        const nextDraft = Array.from(rawNextDraft).slice(0, PROMPT_MAX_LENGTH_CEILING).join("");

        return {
          ...session,
          draftInput: nextDraft,
          uploadedFiles: session.uploadedFiles,
          uploadedImages: nextUploadedImages,
          updatedAt: Date.now(),
        };
      }),
    );
  }, [activeSessionId, currentUploadRule.image.maxCount]);

  // 从资产库 @引用一个视频/音频：不重新上传，直接拿库里已有 url 建一个 ready 参考条目进"杠"，
  // 校验规则复用 currentUploadRule（和 + 号上传同一套：enabled / maxCount）。仅在支持的模型可加。
  const addActiveUploadedMediaReference = useCallback((asset: AssetItem, kind: "video" | "audio", media: { durationSeconds?: number; dimensions?: ImageDimensions }, options?: { draftBase?: string; draftSuffix?: string }) => {
    const extension = getFileExtension(asset.url) || (kind === "video" ? "mp4" : "mp3");
    const dimensions = media.dimensions ?? getPreviewMetaDimensions(asset.previewMeta);
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSessionId) return session;
        const existingFiles = session.uploadedFiles ?? [];
        const existing = existingFiles.find((item) => typeof item !== "string" && Boolean(item.url) && normalizeMediaUrlForMatch(item.url!) === normalizeMediaUrlForMatch(asset.url));
        const usedNames = new Set(existingFiles.map((item) => (typeof item === "string" ? "" : item.name)).filter(Boolean));
        const referenceName = existing && typeof existing !== "string" ? existing.name : makeUniqueReferenceName(getUploadedReferenceBaseName(asset.name), usedNames);
        const nextFiles: UploadedFileEntry[] = existing
          ? existingFiles
          : [...existingFiles, {
              id: createClientId(),
              name: referenceName,
              storageName: asset.url,
              size: 0,
              extension,
              mediaKind: kind,
              durationSeconds: media.durationSeconds,
              dimensions,
              url: asset.url,
              uploadStatus: "ready" as const,
              status: "ready" as const,
              progress: 100,
            }];
        const referenceText = `@${referenceName}`;
        const currentDraft = options?.draftBase ?? session.draftInput ?? "";
        const draftSuffix = options?.draftSuffix ?? "";
        const rawNextDraft = `${currentDraft}${currentDraft && !/\s$/.test(currentDraft) ? " " : ""}${referenceText} ${draftSuffix}`;
        const nextDraft = Array.from(rawNextDraft).slice(0, PROMPT_MAX_LENGTH_CEILING).join("");
        return { ...session, uploadedFiles: nextFiles, draftInput: nextDraft, updatedAt: Date.now() };
      }),
    );
  }, [activeSessionId]);

  const removeActiveUploadedImage = useCallback((imageId: string) => {
    const image = activeUploadedImages.find((item) => item.id === imageId);
    inputImageUploadAbortControllersRef.current.get(imageId)?.abort();
    inputImageUploadAbortControllersRef.current.delete(imageId);
    if (image?.tempToken) void deleteTemporaryAssetImages([image.tempToken]);
    // 规则：不允许“有@文件名、无缩略图”。移除缩略图时同步删净提示词里该图对应的所有 @文件名。
    const removingName = image ? getUploadedImageReferenceName(image, activeUploadedImages) : "";
    setSessions((current) => current.map((session) => {
      if (session.id !== activeSessionId) return session;
      const nextDraft = removingName ? removeAllMentionNames(session.draftInput ?? "", removingName) : session.draftInput;
      // ⭐ 纯日志、不改任何行为（2026-08-05 加）：记「用户删掉了哪一张、@名有没有真的被清掉」。
      // ⛔ 必须有 `mentionStillThere` 这一项：删 @名 和 解析 @名 用的是**两个不对称的正则**
      //（删的 lookahead `(?=$|[\s，。！？；;、])` 不含 `@`，解析的 `[^@\s…]+` 却把 `@` 当终止符）
      // → 实测 `@000@A_old` 这种两个 @ 紧挨的写法**一个字都删不掉、却照样被解析出来** →
      // 发送时会被 `getOrderedExplicitImageReferences` 拿去资产库把老图捞回来（还排最前面）。
      // 这就是 ID_868181「@音频名永远删不掉、每次都带上老音频」的同一个病理。
      // ⛔ 这一轮不修它（根因未定，宁可不动），但一旦线上出现 true 就是现场铁证。
      reportClientDiagnostic("input-image-removed", {
        removedName: removingName,
        removedUrlTail: image?.url ? (image.url.split("/").pop() ?? "") : "",
        mentionStillThere: removingName ? getMentionNames(nextDraft ?? "").includes(removingName) : false,
        draftBefore: (session.draftInput ?? "").slice(0, 200),
        draftAfter: (nextDraft ?? "").slice(0, 200),
        remainingBox: (session.uploadedImages ?? []).filter((item) => item.id !== imageId).map((item) => item.referenceName ?? item.name),
      });
      return { ...session, draftInput: nextDraft, uploadedImages: (session.uploadedImages ?? []).filter((item) => item.id !== imageId), updatedAt: Date.now() };
    }));
  }, [activeSessionId, activeUploadedImages]);

  const removeActiveUploadedFile = useCallback((fileIndex: number) => {
    const removingFile = activeUploadedFiles[fileIndex];
    const removingName = removingFile && isUploadedMediaFile(removingFile) ? getUploadedFileDisplayName(removingFile) : "";
    setSessions((current) => current.map((session) => {
      if (session.id !== activeSessionId) return session;
      const nextDraft = removingName ? removeAllMentionNames(session.draftInput ?? "", removingName) : session.draftInput;
      return { ...session, draftInput: nextDraft, uploadedFiles: (session.uploadedFiles ?? []).filter((_, index) => index !== fileIndex), updatedAt: Date.now() };
    }));
  }, [activeSessionId, activeUploadedFiles]);

  const markTypingComplete = useCallback((messageId: string) => {
    setActiveTypingMessageIds((current) => {
      if (!current.has(messageId)) return current;

      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
    setCompletedTypingMessageIds((current) => {
      if (current.has(messageId)) return current;

      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }, []);

  const keepTypingAtBottom = useCallback(() => {
    if (typingScrollFrameRef.current !== null) return;

    typingScrollFrameRef.current = window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      typingScrollFrameRef.current = null;
    });
  }, []);

  const keepTypingInPlace = useCallback(() => undefined, []);

  const rememberIntentCorrection = useCallback((source: string, targetMode: IntentMode) => {
    setIntentMemoryRules((current) => upsertIntentMemoryRule(current, source, targetMode));
  }, []);

  useEffect(() => {
    if (!needsLiveTimer) return;
    setTimerNow(Date.now());
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [needsLiveTimer]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    workflowItemsRef.current = workflowItems;
  }, [workflowItems]);

  useEffect(() => {
    if (!activeSessionId) return;
    const activeIndex = sessions.findIndex((session) => session.id === activeSessionId);
    if (activeIndex < historyVisibleSessionCount) return;
    setHistoryVisibleSessionCount(Math.max(HISTORY_INITIAL_SESSION_COUNT, activeIndex + 1));
  }, [activeSessionId, historyVisibleSessionCount, sessions]);

  useEffect(() => {
    if (!activeWorkflowId) return;
    const activeIndex = activeWorkflowItems.findIndex((item) => item.id === activeWorkflowId);
    if (activeIndex < workflowVisibleItemCount) return;
    setWorkflowVisibleItemCount(Math.max(WORKFLOW_INITIAL_ITEM_COUNT, activeIndex + 1));
  }, [activeWorkflowId, activeWorkflowItems, workflowVisibleItemCount]);

  const loadSessionDetails = useCallback(async (sessionId: string) => {
    const targetSession = sessionsRef.current.find((session) => session.id === sessionId);
    if (!targetSession || targetSession.messagesLoaded !== false || loadingSessionIds.has(sessionId)) return;

    setLoadingSessionIds((current) => new Set(current).add(sessionId));
    setLoadingSessionStartedAt((current) => ({ ...current, [sessionId]: current[sessionId] ?? Date.now() }));
    try {
      const response = await fetch(`/api/workspace-session?id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const data = await readJson<{ session?: WorkSession | null }>(response);
      if (!data.session) return;
      setSessions((current) => current.map((session) => session.id === sessionId ? { ...data.session, messagesLoaded: true } as WorkSession : session));
    } catch {
      showInputTip("历史对话加载失败，请稍后重试");
    } finally {
      setLoadingSessionIds((current) => {
        const next = new Set(current);
        next.delete(sessionId);
        return next;
      });
      setLoadingSessionStartedAt((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
    }
  }, [loadingSessionIds, showInputTip]);

  const loadOlderMessages = useCallback(async (sessionId: string) => {
    const targetSession = sessionsRef.current.find((session) => session.id === sessionId);
    if (!targetSession?.messagesHasMore || !targetSession.messagesBeforeCursor || loadingOlderMessageSessionIds.has(sessionId)) return;

    setLoadingOlderMessageSessionIds((current) => new Set(current).add(sessionId));
    try {
      const scroller = chatScrollRef.current;
      pendingOlderMessagesScrollRef.current = scroller ? { prevHeight: scroller.scrollHeight, prevTop: scroller.scrollTop } : null;
      suppressChatScrollToBottomRef.current = true;
      const response = await fetch(`/api/workspace-session?id=${encodeURIComponent(sessionId)}&historyOnly=1&before=${targetSession.messagesBeforeCursor}`, { cache: "no-store" });
      const data = await readJson<{ messages?: Message[]; messagesHasMore?: boolean; messagesBeforeCursor?: number }>(response);
      const olderMessages = Array.isArray(data.messages) ? data.messages : [];
      const existingIds = new Set((sessionsRef.current.find((session) => session.id === sessionId)?.messages ?? []).map((message) => message.id));
      const nextOlderMessages = olderMessages.filter((message) => !existingIds.has(message.id));
      if (nextOlderMessages.length === 0) {
        pendingOlderMessagesScrollRef.current = null;
        suppressChatScrollToBottomRef.current = false;
      }
      setSessions((current) => current.map((session) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          messages: nextOlderMessages.length > 0 ? [...nextOlderMessages, ...session.messages] : session.messages,
          messagesHasMore: Boolean(data.messagesHasMore),
          messagesBeforeCursor: data.messagesBeforeCursor,
        };
      }));
    } catch {
      pendingOlderMessagesScrollRef.current = null;
      suppressChatScrollToBottomRef.current = false;
      showInputTip("更早消息加载失败，请稍后重试");
    } finally {
      setLoadingOlderMessageSessionIds((current) => {
        const next = new Set(current);
        next.delete(sessionId);
        return next;
      });
    }
  }, [loadingOlderMessageSessionIds, showInputTip]);

  const loadMoreHistorySessions = useCallback(async () => {
    if (!historyHasMoreSessions || isHistoryLoadingMore) return;

    setIsHistoryLoadingMore(true);
    try {
      const { data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?summary=1&historyOnly=1&offset=${historyNextOffset}&limit=${HISTORY_LOAD_MORE_COUNT}`, { cache: "no-store" });
      const incomingSessions = Array.isArray(data.state?.sessions) ? data.state.sessions.map((session) => replaceSessionMediaUrls(session, legacyMediaUrlReplacements, {})) : [];
      const existingIds = new Set(sessionsRef.current.map((session) => session.id));
      const nextItems = incomingSessions.filter((session) => {
        if (existingIds.has(session.id)) return false;
        existingIds.add(session.id);
        return true;
      });
      setSessions((current) => {
        return nextItems.length > 0 ? [...current, ...nextItems] : current;
      });
      setHistoryHasMoreSessions(Boolean(data.state?.sessionsHasMore));
      setHistoryNextOffset(Math.floor(Number(data.state?.sessionsNextOffset ?? historyNextOffset)));
      setHistoryTotalSessionCount((current) => Math.max(current, Math.floor(Number(data.state?.sessionsTotalCount ?? 0)), sessionsRef.current.filter((session) => isVisibleSession(session)).length + nextItems.length));
      setHistoryVisibleSessionCount((count) => Math.max(count, count + nextItems.length));
    } catch {
      showInputTip("历史对话加载失败，请稍后重试");
    } finally {
      setIsHistoryLoadingMore(false);
    }
  }, [historyHasMoreSessions, historyNextOffset, isHistoryLoadingMore, showInputTip]);

  const loadWorkspaceAssets = useCallback(async (force = false, filter: AssetFilter = assetFilter, offset = 0, reason: "initial" | "scroll" | "auto" = offset > 0 ? "scroll" : "initial") => {
    const filterAssetCount = assets.filter((asset) => isAssetInFilter(asset, filter)).length;
    const hasFilterAssets = filterAssetCount > 0;
    if (assetsLoadStatus === "loading" || (!force && offset === 0 && loadedAssetFilters[filter] && hasFilterAssets)) return;
    setAssetLoadingReason(reason);
    setAssetsLoadStatus("loading");
    try {
      const { response, data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?assetsOnly=1&assetFilter=${encodeURIComponent(filter)}&assetOffset=${offset}&assetLimit=30`, { cache: "no-store" }, 2, 45_000);
      if (handleSessionExpiredResponse(response)) return;
      const state = data.state ?? {};
      const nextAssets = Array.isArray(state.assets)
        ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), sessionsRef.current))
        : [];
      const nextAssetGenerateJobs = Array.isArray(state.assetGenerateJobs) ? normalizeStoredAssetGenerateJobs(state.assetGenerateJobs).map((job) => replaceAssetGenerateJobMediaUrls(job, legacyMediaUrlReplacements, {})) : [];
      setAssets((current) => {
        const kept = offset > 0 ? current : current.filter((asset) => !isAssetInFilter(asset, filter));
        const incomingKeys = new Set(nextAssets.map(getAssetIdentityKey));
        if (offset === 0) return [...nextAssets, ...kept.filter((asset) => !incomingKeys.has(getAssetIdentityKey(asset)))];
        const existingKeys = new Set(kept.map(getAssetIdentityKey));
        return [...kept, ...nextAssets.filter((asset) => !existingKeys.has(getAssetIdentityKey(asset)))];
      });
      if (state.assetCounts && typeof state.assetCounts === "object") setAssetCounts(state.assetCounts);
      setAssetsHasMore(Boolean(state.assetsHasMore));
      setAssetsNextOffset(Math.floor(Number(state.assetsNextOffset ?? nextAssets.length)));
      setAssetRenderLimit((current) => Math.max(current, offset + nextAssets.length, ASSET_RENDER_PAGE_SIZE));
      // 合并：以服务端持久值为准，但保留内存里仍在"生成中"、以及刚刚失败（防抖 PUT 还没落库）的任务，
      // 避免资产库加载把等待卡/失败卡覆盖掉。⭐ 失败卡只有用户点 ✕ 才消失（2026-08-06 用户拍板），
      // 所以① 内存里的 failed 也要保护 ② 已被 ✕ 掉的 id 一律不许从服务端旧快照里复活。
      setAssetGenerateJobs((current) => {
        const dismissed = dismissedAssetGenerateJobIdsRef.current;
        const incoming = nextAssetGenerateJobs.filter((job) => !dismissed.has(job.id));
        const nextIds = new Set(incoming.map((job) => job.id));
        const surviving = current.filter((job) => (job.result.status === "generating" || job.result.status === "failed") && !nextIds.has(job.id) && !dismissed.has(job.id));
        return [...surviving, ...incoming];
      });
      setLoadedAssetFilters((current) => ({ ...current, [filter]: true }));
      setAssetsLoadStatus("loaded");
      setAssetLoadingReason("");
    } catch {
      if (assets.some((asset) => isAssetInFilter(asset, filter))) {
        setAssetsLoadStatus("loaded");
        setAssetLoadingReason("");
        showInputTip("资产库刷新失败，已显示上次加载内容");
        return;
      }
      setAssetsLoadStatus("failed");
      setAssetLoadingReason("");
      showInputTip("资产库加载失败，请稍后重试");
    }
  }, [assetFilter, assets, assetsLoadStatus, loadedAssetFilters, showInputTip]);

  const loadAssetImportPage = useCallback(async (filter: AssetFilter, offset = 0) => {
    setAssetImportPaging((current) => ({ ...current, [filter]: { hasMore: current[filter]?.hasMore ?? false, nextOffset: current[filter]?.nextOffset ?? 0, loading: true } }));
    try {
      const { data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?assetsOnly=1&assetFilter=${encodeURIComponent(filter)}&assetOffset=${offset}&assetLimit=30`, { cache: "no-store" }, 2, 45_000);
      const state = data.state ?? {};
      const nextAssets = Array.isArray(state.assets)
        ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), sessionsRef.current))
        : [];
      setAssetImportItemsByFilter((current) => {
        const prev = offset > 0 ? current[filter] ?? [] : [];
        const existingKeys = new Set(prev.map(getAssetIdentityKey));
        return { ...current, [filter]: [...prev, ...nextAssets.filter((asset) => !existingKeys.has(getAssetIdentityKey(asset)))] };
      });
      if (state.assetCounts && typeof state.assetCounts === "object") setAssetImportCounts((current) => ({ ...current, ...state.assetCounts }));
      setAssetImportPaging((current) => ({ ...current, [filter]: { hasMore: Boolean(state.assetsHasMore), nextOffset: Math.floor(Number(state.assetsNextOffset ?? offset + nextAssets.length)), loading: false } }));
    } catch {
      setAssetImportPaging((current) => ({ ...current, [filter]: { hasMore: false, nextOffset: current[filter]?.nextOffset ?? 0, loading: false } }));
      showInputTip("资产加载失败，请稍后重试");
    }
  }, [showInputTip]);

  const openAssetImportDialog = useCallback(() => {
    setAssetImportSelected({});
    setAssetImportFilter("character_image");
    setAssetImportOpen(true);
    // Always refresh from server on open so newly generated/uploaded assets show up
    // (previously the per-filter cache persisted across opens and hid new assets).
    setAssetImportItemsByFilter({});
    setAssetImportPaging({});
    void loadAssetImportPage("character_image", 0);
  }, [loadAssetImportPage]);

  const selectAssetImportFilter = useCallback((filter: AssetFilter) => {
    setAssetImportFilter(filter);
    setAssetImportItemsByFilter((current) => {
      if (!current[filter]) void loadAssetImportPage(filter, 0);
      return current;
    });
  }, [loadAssetImportPage]);

  const toggleAssetImportSelection = useCallback((asset: AssetItem) => {
    setAssetImportSelected((current) => {
      const key = normalizeMediaUrlForMatch(asset.url);
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      const item: WorkflowImportAsset = {
        id: asset.id,
        name: asset.systemName || asset.name,
        url: asset.url,
        posterUrl: asset.posterUrl,
        kind: isAudioAsset(asset) ? "audio" : isVideoAsset(asset) ? "video" : "image",
        sourcePrompt: asset.sourcePrompt,
        model: asset.model as ModelName | undefined,
        ratio: asset.previewMeta?.ratio,
        resolution: asset.previewMeta?.resolution,
        duration: asset.previewMeta?.duration,
        origin: (isUploadedAssetUrl(asset.url) || asset.promptSource === "upload" || isUploadPromptPlaceholder(asset.sourcePrompt)) ? "upload" : "generated",
      };
      return { ...current, [key]: item };
    });
  }, []);

  const confirmAssetImport = useCallback(async () => {
    const selected = Object.values(assetImportSelected);
    setAssetImportOpen(false);
    setAssetImportSelected({});
    if (selected.length === 0) return;
    // Measure the ORIGINAL image so the imported node shows the true original size (and its box
    // aspect matches the image, so it is not cropped). Videos backfill their real size on load.
    const measureOriginal = (url: string) => new Promise<{ width: number; height: number } | undefined>((resolve) => {
      const image = new window.Image();
      image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : undefined);
      image.onerror = () => resolve(undefined);
      image.src = getStaticMediaUrl(url) ?? url;
    });
    const enriched = await Promise.all(selected.map(async (item) => {
      if (item.kind !== "image") return item;
      const dims = await measureOriginal(item.url);
      return dims ? { ...item, dimensions: dims } : item;
    }));
    setAssetsToImport(enriched);
  }, [assetImportSelected]);

  const loadMentionAssetFilters = useCallback(async () => {
    const filters: AssetFilter[] = MENTION_CATEGORY_FILTERS;
    // 兜底护栏：只按"是否加载过"判缺失。原来还带 `|| !assets.some(...)`，会把"空分类"永远算成缺失，
    // 一旦有解析不了的 @名反复触发本函数，就 loading↔loaded 无限重载卡死输入框（工作流曾踩坑）。
    const missingFilters = filters.filter((filter) => !loadedAssetFilters[filter]);
    if (missingFilters.length === 0 || assetsLoadStatus === "loading") return;
    setAssetsLoadStatus("loading");
    try {
      const results = await Promise.all(missingFilters.map(async (filter) => {
        const { data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?assetsOnly=1&assetFilter=${encodeURIComponent(filter)}&assetOffset=0&assetLimit=30`, { cache: "no-store" }, 2, 45_000);
        return { filter, state: data.state ?? {} };
      }));
      const merged: AssetItem[] = [];
      let mergedCounts: Record<string, number> | undefined;
      for (const { state } of results) {
        if (Array.isArray(state.assets)) {
          merged.push(...applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), sessionsRef.current)));
        }
        if (state.assetCounts && typeof state.assetCounts === "object") mergedCounts = { ...mergedCounts, ...state.assetCounts };
      }
      setAssets((current) => {
        const incomingByKey = new Map(merged.map((asset) => [getAssetIdentityKey(asset), asset]));
        const currentKeys = new Set(current.map(getAssetIdentityKey));
        const updatedCurrent = current.map((asset) => incomingByKey.get(getAssetIdentityKey(asset)) ?? asset);
        return [...updatedCurrent, ...merged.filter((asset) => !currentKeys.has(getAssetIdentityKey(asset)))];
      });
      if (mergedCounts) setAssetCounts((current) => ({ ...current, ...mergedCounts }));
      setLoadedAssetFilters((current) => ({ ...current, ...Object.fromEntries(missingFilters.map((filter) => [filter, true])) }));
      setAssetsLoadStatus("loaded");
    } catch {
      setAssetsLoadStatus(assets.some((asset) => MENTION_CATEGORY_FILTERS.some((filter) => isAssetInFilter(asset, filter))) ? "loaded" : "failed");
      showInputTip("资产引用加载失败，请稍后重试");
    }
  }, [assets, assetsLoadStatus, loadedAssetFilters, showInputTip]);

  // 「@引用资产」按标签懒加载一页（offset=0 首屏；offset>0 下拉加载更多）。合并进共享 assets，
  // 更新计数/已加载标记/分页状态。首次只加载当前标签一屏 + 服务端返回的全部标签计数。
  const loadMentionFilterPage = useCallback(async (filter: AssetFilter, offset = 0) => {
    setMentionFilterPaging((current) => ({ ...current, [filter]: { loading: true, hasMore: current[filter]?.hasMore ?? false, nextOffset: current[filter]?.nextOffset ?? 0 } }));
    try {
      const { data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?assetsOnly=1&assetFilter=${encodeURIComponent(filter)}&assetOffset=${offset}&assetLimit=30`, { cache: "no-store" }, 2, 45_000);
      const state = data.state ?? {};
      const nextAssets = Array.isArray(state.assets)
        ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), sessionsRef.current))
        : [];
      if (state.assetCounts && typeof state.assetCounts === "object") setAssetCounts((current) => ({ ...current, ...state.assetCounts }));
      setAssets((current) => {
        const incomingByKey = new Map(nextAssets.map((asset) => [getAssetIdentityKey(asset), asset]));
        const currentKeys = new Set(current.map(getAssetIdentityKey));
        const updatedCurrent = current.map((asset) => incomingByKey.get(getAssetIdentityKey(asset)) ?? asset);
        return [...updatedCurrent, ...nextAssets.filter((asset) => !currentKeys.has(getAssetIdentityKey(asset)))];
      });
      setLoadedAssetFilters((current) => ({ ...current, [filter]: true }));
      setMentionFilterPaging((current) => ({ ...current, [filter]: { loading: false, hasMore: Boolean(state.assetsHasMore), nextOffset: Math.floor(Number(state.assetsNextOffset ?? offset + nextAssets.length)) } }));
    } catch {
      setMentionFilterPaging((current) => ({ ...current, [filter]: { loading: false, hasMore: current[filter]?.hasMore ?? false, nextOffset: current[filter]?.nextOffset ?? 0 } }));
    }
  }, []);
  const loadMoreMentionGroup = useCallback(async (groupType: AssetFilter, loadedCount: number) => {
    if (mentionFilterPaging[groupType]?.loading) return;
    await loadMentionFilterPage(groupType, loadedCount);
  }, [loadMentionFilterPage, mentionFilterPaging]);

  const loadWorkflowAssets = useCallback(async (workflowId: string) => {
    if (!workflowId) return;
    try {
      const { response, data } = await fetchJsonWithRetry<{ assets?: AssetItem[] }>(`/api/media-assets?workflowId=${encodeURIComponent(workflowId)}`, { cache: "no-store" }, 2, 30_000);
      if (handleSessionExpiredResponse(response)) return;
      const nextAssets = Array.isArray(data.assets)
        ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(data.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), sessionsRef.current))
        : [];
      setAssets((current) => {
        const incomingKeys = new Set(nextAssets.map(getAssetIdentityKey));
        return [...nextAssets, ...current.filter((asset) => !incomingKeys.has(getAssetIdentityKey(asset)))];
      });
      loadedWorkflowAssetIdsRef.current.add(workflowId);
    } catch {
      showInputTip("工作流历史资产加载失败，请稍后重试");
    }
  }, [showInputTip]);

  useEffect(() => {
    if (workspaceStorageMode !== "user") return;
    if (activePanel !== "assets" || assetsLoadStatus === "loading") return;
    const filterAssetCount = assets.filter((asset) => isAssetInFilter(asset, assetFilter)).length;
    const serverFilterCount = Number(assetCounts[assetFilter]);
    const needsCurrentFilter = !loadedAssetFilters[assetFilter] || (!filterAssetCount && Number.isFinite(serverFilterCount) && serverFilterCount > 0);
    if (assetsLoadStatus === "idle" || assetsLoadStatus === "failed" || needsCurrentFilter) void loadWorkspaceAssets(false, assetFilter, 0);
  }, [activePanel, assetCounts, assetFilter, assets, assetsLoadStatus, loadWorkspaceAssets, loadedAssetFilters, workspaceStorageMode]);

  useEffect(() => {
    if (workspaceStorageMode !== "user") return;
    if (activePanel !== "workflow" || !activeWorkflow?.id) return;
    if (loadedWorkflowAssetIdsRef.current.has(activeWorkflow.id)) return;
    void loadWorkflowAssets(activeWorkflow.id);
  }, [activePanel, activeWorkflow?.id, loadWorkflowAssets, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode === "loading") return;
    if (activePanel !== "workflow") return;
    if (workflowItems.some((item) => isVisibleWorkflow(item))) return;
    const workflow = createNumberedWorkflowItem(workflowItems);
    setWorkflowItems((current) => (current.some((item) => isVisibleWorkflow(item)) ? current : [workflow, ...current]));
    setActiveWorkflowId((current) => current || workflow.id);
  }, [activePanel, isLoaded, workflowItems, workspaceStorageMode]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setWorkspaceSite(getCurrentWorkspaceSite(window.location.hostname));
        setWorkspaceLoadStatus("loading");

        const applyInputSettings = (parsedInputSettings: StoredInputSettings | null | undefined) => {
          if (!parsedInputSettings) return;
          const storedImageModel = parsedInputSettings.selectedGenerationModels?.image;
          const storedVideoModel = parsedInputSettings.selectedGenerationModels?.video;
          const storedAudioModel = parsedInputSettings.selectedGenerationModels?.audio;
          const storedGeneralChatModel = parsedInputSettings.selectedGeneralModels?.chat;
          const storedGeneralImageModel = parsedInputSettings.selectedGeneralModels?.image;
          const storedGeneralVideoModel = parsedInputSettings.selectedGeneralModels?.video;
          const nextImageModel = storedImageModel && isGenerationModelOption("image", storedImageModel) ? storedImageModel : DEFAULT_IMAGE_MODEL;
          const nextVideoModel = storedVideoModel && isGenerationModelOption("video", storedVideoModel) ? storedVideoModel : DEFAULT_VIDEO_MODEL;
          const nextAudioModel = storedAudioModel && isGenerationModelOption("audio", storedAudioModel) ? storedAudioModel : DEFAULT_AUDIO_MODEL;
          const nextGeneralModels = {
            chat: storedGeneralChatModel && frontendConversationModels.some((model) => model.id === storedGeneralChatModel) ? storedGeneralChatModel : frontendConversationModels[0].id,
            image: storedGeneralImageModel && isGenerationModelOption("image", storedGeneralImageModel) ? storedGeneralImageModel : DEFAULT_IMAGE_MODEL,
            video: storedGeneralVideoModel && isGenerationModelOption("video", storedGeneralVideoModel) ? storedGeneralVideoModel : DEFAULT_VIDEO_MODEL,
          };
          const nextImageResolution = normalizeImageResolutionForModel(nextImageModel, parsedInputSettings.selectedResolutions?.image);
          const nextVideoResolution = normalizeVideoResolutionForModel(nextVideoModel, parsedInputSettings.selectedResolutions?.video);
          if (isWorkMode(parsedInputSettings.mode)) setMode(parsedInputSettings.mode);
          if (parsedInputSettings.agentModelTier === "normal" || parsedInputSettings.agentModelTier === "advanced") setAgentModelTier(parsedInputSettings.agentModelTier);
          if (typeof parsedInputSettings.generalPreferenceAuto === "boolean") setGeneralPreferenceAuto(parsedInputSettings.generalPreferenceAuto);
          if (parsedInputSettings.generalPreferenceKind === "image" || parsedInputSettings.generalPreferenceKind === "video") setGeneralPreferenceKind(parsedInputSettings.generalPreferenceKind);
          if (typeof parsedInputSettings.generalImageRatio === "string") setGeneralImageRatio(normalizeImageRatioForModel(nextGeneralModels.image, parsedInputSettings.generalImageRatio));
          if (typeof parsedInputSettings.generalImageResolution === "string") setGeneralImageResolution(normalizeImageResolutionForModel(nextGeneralModels.image, parsedInputSettings.generalImageResolution));
          if (typeof parsedInputSettings.generalVideoRatio === "string") setGeneralVideoRatio(parsedInputSettings.generalVideoRatio === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(nextGeneralModels.video, parsedInputSettings.generalVideoRatio, normalizeVideoResolutionForModel(nextGeneralModels.video, parsedInputSettings.generalVideoResolution)));
          if (typeof parsedInputSettings.generalVideoResolution === "string") setGeneralVideoResolution(normalizeVideoResolutionForModel(nextGeneralModels.video, parsedInputSettings.generalVideoResolution));
          if (typeof parsedInputSettings.lastAgentChatModel === "string") setLastAgentChatModel(parsedInputSettings.lastAgentChatModel);
          setSelectedRatios((current) => ({
            ...mergeValidModeSettings(current, parsedInputSettings.selectedRatios, { general: ratioOptions, agent: ratioOptions, image: ["智能比例", ...getSupportedImageRatios(nextImageModel)], video: ["智能比例", ...getSupportedVideoRatios(nextVideoModel)], audio: ratioOptions }),
            image: normalizeImageRatioForModel(nextImageModel, parsedInputSettings.selectedRatios?.image),
            video: parsedInputSettings.selectedRatios?.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(nextVideoModel, parsedInputSettings.selectedRatios?.video, nextVideoResolution),
          }));
          setSelectedResolutions((current) => ({
            ...mergeValidModeSettings(current, parsedInputSettings.selectedResolutions, { general: imageResolutionOptions, agent: imageResolutionOptions, image: getSupportedImageResolutions(nextImageModel), video: getSupportedVideoResolutions(nextVideoModel), audio: imageResolutionOptions }),
            image: nextImageResolution,
            video: nextVideoResolution,
          }));
          setSelectedDurations((current) => mergeValidModeSettings(current, parsedInputSettings.selectedDurations, { general: durationOptions, agent: durationOptions, image: durationOptions, video: getVideoDurationOptions(parsedInputSettings.selectedGenerationModels?.video ?? DEFAULT_VIDEO_MODEL), audio: durationOptions }));
          setSelectedImageCounts((current) => mergeValidModeSettings(current, parsedInputSettings.selectedImageCounts, { general: imageCountOptions, agent: imageCountOptions, image: imageCountOptions, video: imageCountOptions, audio: imageCountOptions }));
          setSelectedGenerationModels(() => ({
            image: nextImageModel,
            video: nextVideoModel,
            audio: nextAudioModel,
          }));
          const nextAudioVoice = normalizeAudioVoiceForModel(nextAudioModel, parsedInputSettings.selectedAudioVoice);
          setSelectedAudioVoice(nextAudioVoice);
          setAudioVoiceLang(getAudioVoiceLang(nextAudioModel, nextAudioVoice));
          setSelectedAudioEmotion(normalizeAudioEmotionForModel(nextAudioModel, parsedInputSettings.selectedAudioEmotion));
          setSelectedAudioReferenceMode(normalizeAudioReferenceModeForModel(nextAudioModel, parsedInputSettings.selectedAudioReferenceMode));
          setSelectedGeneralModels(nextGeneralModels as Record<"chat" | "image" | "video", ModelName>);
        };

        const applyWorkspaceState = (state: WorkspaceStatePayload, storageMode: WorkspaceStorageMode) => {
          const uiState = getStoredWorkspaceUiState();
          const savedSessions = Array.isArray(state.sessions) && state.sessions.length > 0 ? state.sessions : [createSession(state.nextConversationNumber ?? 1)];
          const normalizedWorkspace = normalizeSessionCodesAndMediaNames(getPersistableSessions(savedSessions), state.nextConversationNumber);
          const nextSessions = normalizedWorkspace.sessions.map((session) => replaceSessionMediaUrls(session, legacyMediaUrlReplacements, {}));
          const nextWorkflows = normalizeWorkflowCodesAndMediaNumbers(normalizeStoredWorkflowItems(state.workflowItems));
          const nextStoredWorkflowNumber = Math.max(1, Math.floor(Number(state.nextWorkflowNumber ?? 1)));
          const nextWorkflowNumberValue = Math.max(nextStoredWorkflowNumber, getMaxWorkflowTitleNumber(nextWorkflows) + 1);
          const nextActiveWorkflowId = state.activeWorkflowId && nextWorkflows.some((item) => item.id === state.activeWorkflowId && isVisibleWorkflow(item)) ? state.activeWorkflowId : nextWorkflows.find((item) => isVisibleWorkflow(item))?.id ?? nextWorkflows[0]?.id ?? "";
          const nextActiveSessionId = state.activeSessionId && nextSessions.some((session) => session.id === state.activeSessionId && isVisibleSession(session)) ? state.activeSessionId : nextSessions.find((session) => isVisibleSession(session))?.id ?? nextSessions[0].id;
          const savedAssets = Array.isArray(state.assets) ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), nextSessions)) : undefined;
          const savedAssetGenerateJobs = Array.isArray(state.assetGenerateJobs) ? normalizeStoredAssetGenerateJobs(state.assetGenerateJobs).map((job) => replaceAssetGenerateJobMediaUrls(job, legacyMediaUrlReplacements, {})) : undefined;

          setWorkspaceStorageMode(storageMode);
          applyInputSettings(state.inputSettings);
          const storedActivePanel = state.activePanel === "workflow" && !WORKFLOW_MODE_ENABLED ? "chat" : state.activePanel;
          const nextActivePanel = uiState.activePanel ?? (storedActivePanel === "chat" || storedActivePanel === "workflow" || storedActivePanel === "assets" ? storedActivePanel : undefined);
          const nextAssetFilter = uiState.assetFilter ?? (isAssetFilter(state.assetFilter) ? state.assetFilter : undefined);
          const nextAssetScrollTopByFilter = uiState.assetScrollTopByFilter ?? state.assetScrollTopByFilter;
          // 用户中心「设置」里配置的「登录默认面板」优先：每次进工作台都落在这个面板（会话内切换仍然自由）。
          const preferredPanel = defaultWorkspacePanelRef.current;
          const landingPanel: ActivePanel = preferredPanel === "workflow" && !WORKFLOW_MODE_ENABLED ? "chat" : preferredPanel;
          setActivePanel(nextActivePanel ?? landingPanel);
          if (nextAssetFilter) setAssetFilter(nextAssetFilter);
          if (nextAssetScrollTopByFilter && typeof nextAssetScrollTopByFilter === "object") setAssetScrollTopByFilter(nextAssetScrollTopByFilter);
          setSessions(nextSessions);
          setHistoryHasMoreSessions(Boolean(state.sessionsHasMore));
          setHistoryNextOffset(Math.floor(Number(state.sessionsNextOffset ?? nextSessions.length)));
          setHistoryTotalSessionCount(Math.max(Math.floor(Number(state.sessionsTotalCount ?? 0)), nextSessions.filter((session) => isVisibleSession(session)).length));
          setHistoryVisibleSessionCount(Math.max(HISTORY_INITIAL_SESSION_COUNT, nextSessions.length));
          setNextConversationNumber(normalizedWorkspace.nextConversationNumber);
          setWorkflowItems(nextWorkflows);
          setRunningWorkflowIds(Array.isArray(state.runningWorkflowIds) ? state.runningWorkflowIds.filter((id): id is string => typeof id === "string") : []);
          setNextWorkflowNumber(nextWorkflowNumberValue);
          setWorkflowVisibleItemCount(Math.max(WORKFLOW_INITIAL_ITEM_COUNT, Math.min(nextWorkflows.filter((item) => isVisibleWorkflow(item)).length, WORKFLOW_INITIAL_ITEM_COUNT)));
          setActiveWorkflowId(nextActiveWorkflowId);
          setActiveSessionId(nextActiveSessionId);
          setCompletedTypingMessageIds(new Set(getAssistantMessageIds(nextSessions)));
          setIntentMemoryRules(Array.isArray(state.intentMemoryRules) ? state.intentMemoryRules.slice(0, MAX_INTENT_MEMORY_RULES) : []);
          setFeedbackLogs(Array.isArray(state.feedbackLogs) ? state.feedbackLogs.slice(0, MAX_FEEDBACK_LOGS) : []);
          if (savedAssets) {
            setAssets(extractAssetsFromSessions(nextSessions, savedAssets));
            setAssetsLoadStatus("loaded");
          }
          // ⭐ 已被用户 ✕ 掉的失败卡不许从服务端快照里复活（防抖 PUT 可能还没落库）。
          if (savedAssetGenerateJobs) setAssetGenerateJobs(savedAssetGenerateJobs.filter((job) => !dismissedAssetGenerateJobIdsRef.current.has(job.id)));
        };

        try {
          const { response: meResponse, data: meData } = await fetchJsonWithRetry<{ user?: CurrentUserProfile | null }>("/api/auth/me", { cache: "no-store" });

          if (meResponse.status === 401 || (meResponse.ok && typeof meData.user?.email !== "string")) {
            window.location.replace("/");
            return;
          }

          if (typeof meData.user?.email !== "string") return;

          applyCurrentUserProfile(meData.user);
          let workspaceLoaded = false;
          let workspaceLoadError: unknown;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            if (cancelled) return;
            setWorkspaceLoadStatus(attempt === 0 ? "loading" : "retrying");
            try {
              const { data: workspaceData } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>("/api/workspace-state?summary=1&panel=chat", { cache: "no-store" }, 1, 30_000);
              if (cancelled) return;
              applyWorkspaceState(workspaceData.state ?? {}, "user");
              setWorkspaceLoadStatus("loaded");
              workspaceLoaded = true;
              break;
            } catch (error) {
              workspaceLoadError = error;
              if (attempt < 4) await delay(Math.min(4_000, 1_200 * (attempt + 1)));
            }
          }
          if (!workspaceLoaded) {
            console.warn("用户工作区加载失败，等待用户重试", workspaceLoadError);
            if (!cancelled) setWorkspaceLoadStatus("failed");
          }
        } catch (error) {
          console.warn("登录状态检查失败，保留当前页面等待重试", error);
          if (!cancelled) setWorkspaceLoadStatus("failed");
        } finally {
          if (!cancelled) setIsLoaded(true);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [applyCurrentUserProfile, workspaceLoadRetryKey]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const loadModelAvailability = async () => {
      try {
        const response = await fetch("/api/model-availability", { cache: "no-store" });
        const data = (await response.json()) as { generalModels?: string[]; generalModelProviders?: Record<string, "openrouter" | "byteplus">; chatModels?: string[]; chatModelProviders?: Record<string, "openrouter" | "byteplus">; imageModels?: string[]; assetImageModels?: string[]; videoModels?: string[]; audioModels?: string[]; agentImageModels?: string[]; agentVideoModels?: string[]; uploadRuleOverrides?: UploadRuleOverrides; promptLengthOverrides?: PromptLengthOverrides; editModelToggles?: Record<string, boolean>; creditRate?: { usdToCnyRate?: number; creditsPerCny?: number } };
        if (cancelled) return;
        const next = {
          image: Array.isArray(data.imageModels) ? data.imageModels : [],
          video: Array.isArray(data.videoModels) ? data.videoModels : [],
          audio: Array.isArray(data.audioModels) ? data.audioModels : audioGenerationModels.map((model) => model.id),
        };
        setEnabledGenerationModelIds(next);
        setEnabledAgentGenerationModelIds({
          image: Array.isArray(data.agentImageModels) ? data.agentImageModels : [],
          video: Array.isArray(data.agentVideoModels) ? data.agentVideoModels : [],
        });
        const nextAssetImageModels = Array.isArray(data.assetImageModels) ? data.assetImageModels : [];
        setEnabledAssetImageModelIds(nextAssetImageModels);
        setSelectedGenerationModels((current) => ({
          image: next.image.includes(current.image) ? current.image : next.image[0] ?? current.image,
          video: next.video.includes(current.video) ? current.video : next.video[0] ?? current.video,
          audio: next.audio.includes(current.audio) ? current.audio : next.audio[0] ?? current.audio,
        }));
        setSelectedGeneralModels((current) => ({
          chat: Array.isArray(data.generalModels) && data.generalModels.includes(current.chat) ? current.chat : Array.isArray(data.generalModels) ? data.generalModels[0] as ModelName | undefined ?? current.chat : current.chat,
          image: next.image.includes(current.image) ? current.image : next.image[0] as ModelName | undefined ?? current.image,
          video: next.video.includes(current.video) ? current.video : next.video[0] as ModelName | undefined ?? current.video,
        }));
        setEnabledGeneralChatModelIds(Array.isArray(data.generalModels) ? data.generalModels : []);
        setGeneralModelProviders(data.generalModelProviders && typeof data.generalModelProviders === "object" ? data.generalModelProviders : {});
        setEnabledAgentChatModelIds(Array.isArray(data.chatModels) ? data.chatModels : []);
        setAgentChatModelProviders(data.chatModelProviders && typeof data.chatModelProviders === "object" ? data.chatModelProviders : {});
        setUploadRuleOverrides(data.uploadRuleOverrides && typeof data.uploadRuleOverrides === "object" ? data.uploadRuleOverrides : {});
        setPromptLengthOverrides(data.promptLengthOverrides && typeof data.promptLengthOverrides === "object" ? data.promptLengthOverrides : {});
        setEditModelToggles(data.editModelToggles && typeof data.editModelToggles === "object" ? data.editModelToggles : {});
        if (data.creditRate && typeof data.creditRate === "object" && typeof data.creditRate.usdToCnyRate === "number" && typeof data.creditRate.creditsPerCny === "number") setCreditRate({ usdToCnyRate: data.creditRate.usdToCnyRate, creditsPerCny: data.creditRate.creditsPerCny });
        setCharacterGenerateModel((current) => nextAssetImageModels.includes(current) ? current : nextAssetImageModels[0] ?? current);
      } catch {
        if (!cancelled) {
          setEnabledGenerationModelIds({ image: [], video: [], audio: audioGenerationModels.map((model) => model.id) });
          setEnabledGeneralChatModelIds([]);
          setGeneralModelProviders({});
          setEnabledAgentChatModelIds([]);
          setAgentChatModelProviders({});
          setEnabledAgentGenerationModelIds({ image: [], video: [] });
          setEnabledAssetImageModelIds([]);
          setUploadRuleOverrides({});
        }
      }
    };

    void loadModelAvailability();

    return () => { cancelled = true; };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const checkWorkspaceInstance = async (claim = false) => {
      try {
        const response = await fetch("/api/auth/workspace-instance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ instanceId: workspaceInstanceIdRef.current, claim }),
        });
        const data = (await response.json().catch(() => ({}))) as { active?: boolean };
        if (cancelled) return;
        if (response.status === 401) {
          window.location.replace("/");
          return;
        }
        if (!response.ok) {
          workspaceInstanceCheckFailuresRef.current += 1;
          return;
        }
        if (data.active === true) {
          if (claim) workspaceInstanceClaimedRef.current = true;
          workspaceInstanceCheckFailuresRef.current = 0;
          return;
        }
        if (!claim && workspaceInstanceClaimedRef.current) {
          window.location.replace("/");
          return;
        }
        if (!claim && !workspaceInstanceClaimedRef.current) {
          void checkWorkspaceInstance(true);
          return;
        }
        workspaceInstanceCheckFailuresRef.current = 0;
      } catch {
        if (!cancelled) workspaceInstanceCheckFailuresRef.current += 1;
      }
    };

    void checkWorkspaceInstance(true);
    // 标签页在后台时**降频**而不是完全不发（空闲标签页原来每分钟 ~30 个请求 → 现在 2 个）。
    // ⛔ 不能完全停：这条轮询同时是「同账号被另一个标签页接管 → 本页自我下线（location.replace）」的唯一判定，
    //    完全停掉的话，后台里那个已失去 claim 的旧标签页会**继续自动保存**、把新标签页的编辑覆盖掉（数据风险）。
    //    所以隐藏时仍按 30s 兜底检查一次；回到前台由下面的 focus 监听立刻补一次。
    let hiddenTickAt = 0;
    const instanceInterval = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        const now = Date.now();
        if (now - hiddenTickAt < 30_000) return;
        hiddenTickAt = now;
      }
      void checkWorkspaceInstance(false);
    }, 2000);
    const onFocus = () => void checkWorkspaceInstance(false);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(instanceInterval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;
    const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    const recordActivity = () => {
      const now = Date.now();
      if (now - authActivityPingRef.current < 60_000) return;
      authActivityPingRef.current = now;
      void fetch("/api/auth/activity", { method: "POST", cache: "no-store", keepalive: true }).then((response) => {
        if (!cancelled) handleSessionExpiredResponse(response);
      }).catch(() => undefined);
    };
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true, capture: true }));
    return () => {
      cancelled = true;
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity, { capture: true }));
    };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user" || !hasAnyGenerationRunning) return;
    let cancelled = false;
    const keepGenerationAlive = () => {
      authActivityPingRef.current = Date.now();
      void fetch("/api/auth/activity", { method: "POST", cache: "no-store", keepalive: true }).then((response) => {
        if (!cancelled) handleSessionExpiredResponse(response);
      }).catch(() => undefined);
    };
    keepGenerationAlive();
    const interval = window.setInterval(keepGenerationAlive, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hasAnyGenerationRunning, isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { user?: CurrentUserProfile | null; announcement?: { enabled: boolean; content?: string; version?: string } };
        if (cancelled) return;
        // 把公告广播给顶部横幅（AnnouncementBanner 监听此事件），实现不刷新自动更新。
        if (data.announcement) window.dispatchEvent(new CustomEvent("flashmuse-announcement", { detail: data.announcement }));
        if (response.status === 401 || (response.ok && !data.user?.email)) {
          window.location.replace("/");
          return;
        }
        if (!response.ok) {
          authCheckFailuresRef.current += 1;
          return;
        }
        authCheckFailuresRef.current = 0;
      } catch {
        if (!cancelled) authCheckFailuresRef.current += 1;
      }
    };

    // 标签页在后台时不发轮询；回到前台时 focus 监听会立刻补一次。
    const interval = window.setInterval(() => { if (document.visibilityState === "hidden") return; void checkAuth(); }, 5000);
    window.addEventListener("focus", checkAuth);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkAuth);
    };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    const prompt = window.sessionStorage.getItem(HOME_PROMPT_STORAGE_KEY)?.trim();
    if (!prompt) return;

    window.sessionStorage.removeItem(HOME_PROMPT_STORAGE_KEY);
    const timer = window.setTimeout(() => {
      const session = createSession(nextConversationNumber);
      setNextConversationNumber((current) => Math.max(current + 1, nextConversationNumber + 1));
      setActivePanel("chat");
      setMode("agent");
      setSessions((current) => [session, ...current]);
      setHistoryTotalSessionCount((count) => count + 1);
      setActiveSessionId(session.id);
      setPendingHomePrompt({ sessionId: session.id, prompt });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isLoaded, nextConversationNumber, workspaceStorageMode]);

  useEffect(() => {
    if (!isThinking) return;
    const frame = window.requestAnimationFrame(() => {
      setOpenControlMenu("");
      setIsAtAssetMenuOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isThinking]);

  useEffect(() => {
    if (!userDialogTip) return;
    if (userDialogTip.exiting) return;
    if (userDialogTipTimerRef.current !== null) window.clearTimeout(userDialogTipTimerRef.current);

    userDialogTipTimerRef.current = window.setTimeout(() => {
      setUserDialogTip((current) => current ? { ...current, exiting: true } : current);
      userDialogTipTimerRef.current = window.setTimeout(() => setUserDialogTip(undefined), 100);
    }, 2000);

    return () => {
      if (userDialogTipTimerRef.current !== null) window.clearTimeout(userDialogTipTimerRef.current);
    };
  }, [userDialogTip]);

  useEffect(() => {
    if (securityPasswordMode !== "forgot-code" || forgotPasswordCode.length !== 6 || isForgotPasswordSending) return;

    const timer = window.setTimeout(() => {
      void verifyForgotPasswordCode();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [forgotPasswordCode, isForgotPasswordSending, securityPasswordMode, verifyForgotPasswordCode]);

  useEffect(() => {
    if (!isLoaded) return undefined;
    return applyDocumentLanguage(userLanguage);
  }, [isLoaded, userLanguage]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    setStoredWorkspaceUiState({ activePanel, assetFilter, assetScrollTopByFilter });
  }, [activePanel, assetFilter, assetScrollTopByFilter, isLoaded, workspaceStorageMode]);

  useEffect(() => () => {
    if (workflowTextSaveTimerRef.current !== null) window.clearTimeout(workflowTextSaveTimerRef.current);
  }, []);

  useEffect(() => {
    assetScrollTopByFilterRef.current = assetScrollTopByFilter;
  }, [assetScrollTopByFilter]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    if (workspaceLoadStatus !== "loaded") return;
    if (workspaceSaveTimerRef.current !== null) window.clearTimeout(workspaceSaveTimerRef.current);

    const payload: WorkspaceStatePayload = {
      sessions: getPersistableSessions(sessions),
      nextConversationNumber,
      nextWorkflowNumber,
      activePanel,
      assetFilter,
      // ⛔ assetScrollTopByFilter 不进 PUT 载荷（2026-08-02 审计 2.4）：滚动位置一变就整体重写
      //   几百 KB 的 UserWorkspaceState.state（TOAST 列、WAL 放大），是全系统最大的写放大来源。
      //   滚动位置只保留在本机（setStoredWorkspaceUiState），不再跨设备恢复。
      workflowItems: getPersistableWorkflowItems(normalizeWorkflowCodesAndMediaNumbers(workflowItems)),
      activeWorkflowId,
      activeSessionId,
      inputSettings: {
        mode,
        agentModelTier,
        selectedRatios,
        selectedResolutions,
        selectedDurations,
        selectedImageCounts,
        selectedGenerationModels,
        selectedGeneralModels,
        selectedAudioVoice,
        selectedAudioEmotion,
        selectedAudioReferenceMode,
        generalPreferenceAuto,
        generalPreferenceKind,
        generalImageRatio,
        generalImageResolution,
        generalVideoRatio,
        generalVideoResolution,
        lastAgentChatModel,
      },
      intentMemoryRules: intentMemoryRules.slice(0, MAX_INTENT_MEMORY_RULES),
      feedbackLogs: feedbackLogs.slice(0, MAX_FEEDBACK_LOGS),
    };
    if (assetsLoadStatus === "loaded" || assetGenerateJobs.length > 0) payload.assetGenerateJobs = getPersistableAssetGenerateJobs(assetGenerateJobs);

    // ⭐⭐ 2026-08-08 加的**纯诊断日志**（⛔ 不改任何行为）：抓「即将 PUT 上去的会话形状不对」。
    //
    // 这是「发送后消息丢失」那条链的最后一环：服务端 `upsertWorkspaceSessions` 里
    // `shouldStoreMessages = session.messagesLoaded !== false` —— 一旦我们**发上去的**这份会话带着
    // `messagesLoaded: false` 但**本地其实有消息**，服务端就只更新标题、把消息整个跳过
    // （= 2026-08-08 那次「标题存了、msgs=0」的精确症状）。
    // ⭐ 所以这里在**发出之前**先记一笔"我到底发了什么形状"，和服务端那条日志对账。
    // ⛔ 只记异常形状（有消息却 messagesLoaded===false），正常保存一律不写。
    {
      const suspicious = (Array.isArray(payload.sessions) ? payload.sessions : []).filter(
        (session): session is WorkSession =>
          Boolean(session) && (session as WorkSession).messagesLoaded === false && Array.isArray((session as WorkSession).messages) && ((session as WorkSession).messages?.length ?? 0) > 0,
      );
      if (suspicious.length > 0) {
        reportClientDiagnostic("chat-put-session-shape-suspicious", {
          activeSessionId,
          count: suspicious.length,
          sessions: suspicious.slice(0, 3).map((session) => ({
            id: session.id,
            messageCount: session.messages?.length ?? 0,
            titleLength: typeof session.title === "string" ? session.title.length : 0,
          })),
        });
      }
    }

    workspaceSaveTimerRef.current = window.setTimeout(() => {
      fetch("/api/workspace-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => console.warn("用户工作区保存失败"));
    }, flushNextWorkspaceSaveRef.current ? 0 : 500);
    flushNextWorkspaceSaveRef.current = false;

    return () => {
      if (workspaceSaveTimerRef.current !== null) window.clearTimeout(workspaceSaveTimerRef.current);
    };
    // ⛔ 依赖里不许再放 assets / assetScrollTopByFilter：assets 不在载荷里（变了白发一次全量 PUT），
    //   assetScrollTopByFilter 是资产库滚动位置（滚一下整体重写几百 KB）。见载荷处的注释。
  }, [activePanel, activeSessionId, activeWorkflowId, agentModelTier, assetFilter, assetGenerateJobs, assetsLoadStatus, feedbackLogs, generalImageRatio, generalImageResolution, generalPreferenceAuto, generalPreferenceKind, generalVideoRatio, generalVideoResolution, intentMemoryRules, isLoaded, lastAgentChatModel, mode, nextConversationNumber, nextWorkflowNumber, selectedAudioEmotion, selectedAudioReferenceMode, selectedAudioVoice, selectedDurations, selectedGeneralModels, selectedGenerationModels, selectedImageCounts, selectedRatios, selectedResolutions, sessions, workflowItems, workspaceLoadStatus, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const pollMediaSaveStatus = async () => {
      const urls = collectRemoteMediaUrls(sessionsRef.current, assets, assetGenerateJobs, workflowItems).slice(0, 80);
      if (urls.length === 0) return;

      try {
        const response = await fetch("/api/media-save-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        const data = (await response.json()) as { jobs?: MediaSaveStatusJob[] };
        if (cancelled) return;

        const savedJobs = (data.jobs ?? []).filter((job) => job.status === "saved" && job.localUrl && job.remoteUrl && job.localUrl !== job.remoteUrl);
        if (savedJobs.length === 0) return;
        const jobsToPreload = savedJobs.filter((job) => !preloadingSavedMediaUrlsRef.current.has(job.remoteUrl));
        if (jobsToPreload.length === 0) return;
        jobsToPreload.forEach((job) => preloadingSavedMediaUrlsRef.current.add(job.remoteUrl));
        const preloadResults = await Promise.all(jobsToPreload.map(async (job) => ({ job, ready: await preloadSavedMediaBeforeReplace(job) })));
        preloadResults.forEach(({ job }) => preloadingSavedMediaUrlsRef.current.delete(job.remoteUrl));
        if (cancelled) return;
        const readyJobs = preloadResults.filter((item) => item.ready).map((item) => item.job);
        const replacements = new Map(readyJobs.map((job) => [job.remoteUrl, job.localUrl as string]));
        const dimensions = Object.fromEntries(readyJobs.filter((job) => job.localUrl && job.dimensions).map((job) => [job.localUrl as string, job.dimensions as ImageDimensions]));
        const videoPosters = Object.fromEntries(readyJobs.filter((job) => job.localUrl && job.posterUrl).map((job) => [job.localUrl as string, job.posterUrl as string]));
        const persistItems = savedJobs.flatMap((job) => {
          if (!job.localUrl) return [];
          const isVideo = job.type === "video" || /\.(mp4|webm|mov)(\?|#|$)/i.test(job.localUrl);
          const fromMessage = sessionsRef.current.flatMap((session) => session.messages.map((message) => ({ session, message }))).find(({ message }) => {
            if (isVideo) return message.videoUrl === job.remoteUrl || message.videos?.includes(job.remoteUrl);
            return message.images?.includes(job.remoteUrl) || message.imageResultSlots?.some((slot) => slot.type === "image" && slot.url === job.remoteUrl);
          });
          const fromAsset = assets.find((asset) => asset.url === job.remoteUrl);
          // ⭐ 工作流归属改由服务端给（job.origin，来源 MediaAsset）。
          //   ⛔ 别改回 workflowItems.flatMap 扫全部画布反查 —— 详见 MediaSaveStatusJob.origin 的注释。
          const origin = job.origin;
          const fromWorkflowId = origin?.workflowId;
          const message = fromMessage?.message;
          const session = fromMessage?.session;
          const workflowName = fromWorkflowId ? origin?.systemName : undefined;
          const name = message?.mediaSystemNames?.[job.remoteUrl] ?? fromAsset?.systemName ?? fromAsset?.name ?? workflowName;
          const promptDetail = isVideo ? message?.videoPromptDetails?.[job.remoteUrl] : message?.imagePromptDetails?.[job.remoteUrl];
          const workflowPrompt = fromWorkflowId ? origin?.sourcePrompt : undefined;
          const sourcePrompt = isVideo
            ? promptDetail?.prompt ?? message?.videoPrompts?.[job.remoteUrl] ?? message?.generationMeta?.originalPrompt ?? workflowPrompt ?? fromAsset?.sourcePrompt ?? message?.content
            : promptDetail?.prompt ?? message?.imagePrompts?.[job.remoteUrl] ?? workflowPrompt ?? fromAsset?.sourcePrompt ?? message?.content;
          const assetGenerationCategory = fromAsset && ["character_image", "scene_image", "prop_image", "shot_image"].includes(fromAsset.type) ? fromAsset.type : undefined;
          const currentCategory = fromWorkflowId
            ? isVideo ? "workflow_videos" : "workflow_images"
            : fromAsset?.librarySource === "asset_generation" && assetGenerationCategory
            ? fromAsset.type
            : isVideo ? "conversation_videos" : "conversation_images";
          return [{
            url: job.localUrl,
            name,
            currentCategory,
            mediaType: isVideo ? "video" : "image",
            posterUrl: job.posterUrl,
            thumbnailUrl: job.thumbnailUrl,
            dimensions: job.dimensions,
            sourcePrompt,
            sourceDetail: getPromptSourceDetail(promptDetail),
            promptSource: "generated",
            conversationId: session?.id ?? fromAsset?.sessionId,
            messageId: message?.id ?? fromAsset?.messageId,
            workflowId: fromWorkflowId,
            workflowNodeId: origin?.workflowNodeId,
            model: fromWorkflowId ? origin?.model : undefined,
            settings: fromWorkflowId ? { ratio: origin?.ratio, resolution: origin?.resolution, duration: origin?.duration } : undefined,
          }];
        });

        if (readyJobs.length > 0) {
          setSessions((current) => current.map((session) => replaceSessionMediaUrls(session, replacements, dimensions, videoPosters)));
          setAssets((current) => current.map((asset) => replaceAssetMediaUrls(asset, replacements, videoPosters)));
          setAssetGenerateJobs((current) => current.map((job) => replaceAssetGenerateJobMediaUrls(job, replacements, dimensions)));
          setWorkflowItems((current) => current.map((item) => replaceWorkflowItemMediaUrls(item, replacements, videoPosters)));
        }
        persistItems.forEach((item) => {
          void fetch("/api/media-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          }).catch((error) => console.warn("[media-assets] failed to persist saved generated asset", error));
        });
      } catch {
        // Remote media saving is best-effort; generated content can still display via temporary URL.
      }
    };

    void pollMediaSaveStatus();
    // 标签页在后台时不发轮询（这个轮询会遍历全部会话×消息+资产+工作流，开销不小）；
    // 回到前台后下一个 tick（≤12s）自然会补上。
    const interval = window.setInterval(() => { if (document.visibilityState === "hidden") return; void pollMediaSaveStatus(); }, 12_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [assetGenerateJobs, assets, isLoaded, workflowItems, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    if (userProfileSaveTimerRef.current !== null) window.clearTimeout(userProfileSaveTimerRef.current);

    const payload = {
      nickname: currentUserNickname,
      phone: currentUserPhone,
      avatarUrl: currentUserAvatarUrl,
      language: userLanguage,
      notifyOnGenerationComplete,
      autoSaveHistory,
      previewWheelZoom,
      previewWheelFlip,
      defaultWorkspacePanel,
      defaultImageModel,
      defaultImageRatio,
      defaultImageResolution,
      defaultVideoModel,
      defaultVideoRatio,
      defaultVideoResolution,
      defaultVideoDuration,
      defaultAudioModel,
      defaultAudioVoice: defaultAudioVoice ?? "",
      defaultAudioEmotion,
    };

    userProfileSaveTimerRef.current = window.setTimeout(() => {
      fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => console.warn("用户资料保存失败"));
    }, 500);

    return () => {
      if (userProfileSaveTimerRef.current !== null) window.clearTimeout(userProfileSaveTimerRef.current);
    };
  }, [autoSaveHistory, currentUserAvatarUrl, currentUserNickname, currentUserPhone, isLoaded, notifyOnGenerationComplete, previewWheelFlip, previewWheelZoom, userLanguage, workspaceStorageMode, defaultWorkspacePanel, defaultImageModel, defaultImageRatio, defaultImageResolution, defaultVideoModel, defaultVideoRatio, defaultVideoResolution, defaultVideoDuration, defaultAudioModel, defaultAudioVoice, defaultAudioEmotion]);

  useEffect(() => {
    if (!isLoaded) return;

    const expiredAssets = assets.filter((asset) => asset.type === "trash" && asset.purgeAt && asset.purgeAt <= Date.now());
    if (expiredAssets.length === 0) return;

    setPreviewAsset((current) => (current && isAssetTrashExpired(current, Date.now()) ? null : current));
  }, [assets, isLoaded, timerNow]);

  useEffect(() => {
    document.documentElement.dataset.flashmuseTheme = resolvedTheme;
    document.documentElement.dataset.flashmuseThemeMode = themeMode;
    try {
      window.localStorage.setItem(WORKSPACE_THEME_STORAGE_KEY, themeMode);
    } catch {
      // Theme preference is optional.
    }
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  useEffect(() => {
    return () => {
      if (typingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(typingScrollFrameRef.current);
      }
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      if (inputTipTimerRef.current !== null) {
        window.clearTimeout(inputTipTimerRef.current);
      }
      inputTipQueueRef.current = [];
      inputCurrentTipRef.current = undefined;
      if (assetUploadTipTimerRef.current !== null) {
        window.clearTimeout(assetUploadTipTimerRef.current);
      }
      assetUploadTipQueueRef.current = [];
      assetUploadCurrentTipRef.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    canLoadOlderByScrollRef.current = false;
  }, [activeSessionId, activePanel]);

  useLayoutEffect(() => {
    const pending = pendingOlderMessagesScrollRef.current;
    if (!pending) return;
    pendingOlderMessagesScrollRef.current = null;
    const element = chatScrollRef.current;
    if (!element) return;
    element.scrollTop = pending.prevTop + (element.scrollHeight - pending.prevHeight);
    const session = sessionsRef.current.find((item) => item.id === activeSessionId);
    if (canLoadOlderByScrollRef.current && session?.messagesHasMore && element.scrollTop < 160) void loadOlderMessages(session.id);
  }, [messages.length, activeSessionId, loadOlderMessages]);

  useEffect(() => {
    if (activePanel !== "chat") return;
    if (suppressChatScrollToBottomRef.current) {
      suppressChatScrollToBottomRef.current = false;
      wasThinkingRef.current = isThinking;
      return;
    }
    const thinkingJustEnded = wasThinkingRef.current && !isThinking;
    wasThinkingRef.current = isThinking;
    if (thinkingJustEnded) return;
    messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [activePanel, activeSessionId, messages.length, isThinking]);

  useEffect(() => {
    if (activePanel !== "assets") return;
    const filterChanged = previousAssetFilterRef.current !== assetFilter;
    previousAssetFilterRef.current = assetFilter;
    const top = filterChanged ? 0 : assetScrollTopByFilterRef.current[assetFilter] ?? 0;
    if (filterChanged) {
      assetScrollTopByFilterRef.current = { ...assetScrollTopByFilterRef.current, [assetFilter]: 0 };
      setAssetScrollTopByFilter((current) => ({ ...current, [assetFilter]: 0 }));
    }
    const frame = window.requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel, assetFilter]);

  useEffect(() => {
    if (activePanel !== "chat") return;
    const timer = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      const element = chatScrollRef.current;
      if (!element) return;

      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      setShowScrollToBottom(distanceToBottom > 120);
      canLoadOlderByScrollRef.current = true;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activePanel, activeSessionId]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const updateScrollToBottomButton = () => {
    const element = chatScrollRef.current;
    if (!element) return;

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (activePanel === "assets") {
      setShowScrollToBottom(false);
      setAssetScrollTopByFilter((current) => {
        const currentTop = current[assetFilter] ?? 0;
        if (Math.abs(currentTop - element.scrollTop) < 24) return current;
        const next = { ...current, [assetFilter]: element.scrollTop };
        assetScrollTopByFilterRef.current = next;
        return next;
      });
      if (distanceToBottom < 520) {
        setAssetRenderLimit((current) => current + ASSET_RENDER_PAGE_SIZE);
        if (assetsHasMore && assetsLoadStatus !== "loading") void loadWorkspaceAssets(false, assetFilter, assetsNextOffset, "scroll");
      }
      return;
    }

    setShowScrollToBottom(distanceToBottom > 120);
    if (activePanel === "chat" && canLoadOlderByScrollRef.current && element.scrollTop < 160) {
      const session = sessionsRef.current.find((item) => item.id === activeSessionId);
      if (session?.messagesHasMore) void loadOlderMessages(session.id);
    }
  };

  useEffect(() => {
    if (activePanel !== "assets" || !assetsHasMore || assetsLoadStatus !== "loaded") return;
    const frame = window.requestAnimationFrame(() => {
      const element = chatScrollRef.current;
      if (!element) return;
      if (element.scrollHeight <= element.clientHeight + 120) void loadWorkspaceAssets(false, assetFilter, assetsNextOffset, "auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel, assetFilter, assets.length, assetsHasMore, assetsLoadStatus, assetsNextOffset, loadWorkspaceAssets]);

  const closeAllPopupMenus = (except?: "session" | "workflow" | "collapsedHistory" | "user" | "message" | "assetAction" | "control" | "mention") => {
    if (except !== "session") setOpenSessionMenuId("");
    if (except !== "workflow") setOpenWorkflowMenuId("");
    if (except !== "session" && except !== "workflow") setCollapsedActionMenuPosition(null);
    if (except !== "collapsedHistory") {
      setIsCollapsedHistoryMenuOpen(false);
      setCollapsedActionMenuPosition(null);
    }
    if (except !== "user") {
      setIsUserMenuOpen(false);
      setIsThemeMenuOpen(false);
    }
    if (except !== "message") setOpenMessageMenuId("");
    if (except !== "assetAction") setOpenAssetActionMenuId("");
    if (except !== "control") setOpenControlMenu("");
    if (except !== "mention") setIsAtAssetMenuOpen(false);
  };

  const toggleSessionMenu = (sessionId: string, button: HTMLButtonElement) => {
    const shouldClose = openSessionMenuId === sessionId;
    closeAllPopupMenus(isSidebarCollapsed ? "collapsedHistory" : undefined);
    if (shouldClose) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = 128;
    const reservedBottom = 32;
    if (isSidebarCollapsed) {
      setCollapsedActionMenuPosition({
        left: Math.min(window.innerWidth - 140, rect.right + 8),
        top: Math.min(window.innerHeight - menuHeight - reservedBottom, Math.max(12, rect.top - 8)),
      });
    }
    setSessionMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");
    setOpenSessionMenuId(sessionId);
  };

  const toggleWorkflowMenu = (workflowId: string, button: HTMLButtonElement) => {
    const shouldClose = openWorkflowMenuId === workflowId;
    closeAllPopupMenus(isSidebarCollapsed ? "collapsedHistory" : undefined);
    if (shouldClose) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = 132;
    const reservedBottom = 24;
    if (isSidebarCollapsed) {
      setCollapsedActionMenuPosition({
        left: Math.min(window.innerWidth - 140, rect.right + 8),
        top: Math.min(window.innerHeight - menuHeight - reservedBottom, Math.max(12, rect.top - 8)),
      });
    }
    setSessionMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");
    setOpenWorkflowMenuId(workflowId);
  };

  const closeInputMenus = () => {
    closeAllPopupMenus();
  };

  useEffect(() => {
    if (!openSessionMenuId) return;

    const closeMenu = () => setOpenSessionMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openSessionMenuId]);

  useEffect(() => {
    if (!isCollapsedHistoryMenuOpen) return;

    const closeMenu = () => {
      setIsCollapsedHistoryMenuOpen(false);
      setOpenSessionMenuId("");
    };
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isCollapsedHistoryMenuOpen]);

  useEffect(() => {
    if (!openMessageMenuId) return;

    const closeMenu = () => setOpenMessageMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openMessageMenuId]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeMenu = (event: MouseEvent) => {
      // 点菜单内部或头像按钮内部不关（内部交互）。其余任何空白/画布点击都关。
      const target = event.target as Node | null;
      if (target && (userMenuRef.current?.contains(target) || userMenuButtonRef.current?.contains(target))) return;
      setIsUserMenuOpen(false);
      setIsThemeMenuOpen(false);
    };
    // 用捕获阶段：工作流 tldraw 画布会在冒泡阶段 stopPropagation 吞掉 click，冒泡监听收不到 → 关不掉。
    // 捕获阶段先于画布处理器触发，保证点画布空白也能关（且不吞事件，画布行为照常）。
    window.addEventListener("click", closeMenu, true);

    return () => window.removeEventListener("click", closeMenu, true);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!openAssetActionMenuId) return;

    const closeMenu = () => {
      setOpenAssetActionMenuId("");
    };
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openAssetActionMenuId]);

  useEffect(() => {
    if (!openControlMenu) return;

    const closeMenu = () => setOpenControlMenu("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openControlMenu]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const closeMenu = () => setIsLanguageMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isLanguageMenuOpen]);

  useEffect(() => {
    if (!isAtAssetMenuOpen) return;

    const closeMenu = () => setIsAtAssetMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isAtAssetMenuOpen]);

  useEffect(() => {
    if (!isCharacterAtAssetMenuOpen) return;

    const closeMenu = () => setIsCharacterAtAssetMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isCharacterAtAssetMenuOpen]);

  useEffect(() => {
    const options = getVideoDurationOptions(selectedGenerationModels.video);
    if (options.includes(selectedDurations.video)) return;

    const timer = window.setTimeout(() => {
      setSelectedDurations((current) => ({ ...current, video: options[0] }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedDurations.video, selectedGenerationModels.video]);

  useEffect(() => {
    const safeResolution = normalizeImageResolutionForModel(selectedGenerationModels.image, selectedResolutions.image);
    if (safeResolution === selectedResolutions.image) return;

    const timer = window.setTimeout(() => {
      setSelectedResolutions((current) => ({ ...current, image: safeResolution }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedGenerationModels.image, selectedRatios.image, selectedResolutions.image]);

  useEffect(() => {
    const safeResolution = normalizeImageResolutionForModel(characterGenerateModel, characterGenerateResolution);
    if (safeResolution === characterGenerateResolution) return;

    const timer = window.setTimeout(() => {
      setCharacterGenerateResolution(safeResolution);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [characterGenerateModel, characterGenerateResolution]);

  const renderControlMenu = (name: ControlMenuName, label: string, title: string, options: string[], value: string, onChange: (value: string) => void, icon?: typeof RiImageLine) => {
    const isDurationMenu = name === "duration";
    // 时长档位多的模型（BytePlus Seedance 12 档、Hailuo 3 的 11 档）用两列网格排，3~4 档的还是单列。
    const isMultiColumnDurationMenu = isDurationMenu && options.length > 6;
    const durationMenuRows = Math.ceil(options.length / 2);
    const durationMenuSplitIndex = Math.max(0, options.length - durationMenuRows);

    return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === name;
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu(name);
        }}
        className={`${toolButtonClassName} ${openControlMenu === name ? toolButtonActiveClassName : ""}`}
      >
        <ToolButtonLabel icon={icon} label={label} showChevron />
      </button>

      {openControlMenu === name ? (
        <div className={`yinzao-scrollbar-always absolute bottom-full left-0 z-[70] mb-2 max-h-[420px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)] ${isDurationMenu ? "w-[340px]" : "min-w-[180px]"}`}>
          <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{isDurationMenu ? "选择视频生成时长" : title}</div>
          {isDurationMenu ? (
            <VideoDurationSlider
              supportedSeconds={options.map((option) => Number(option.match(/\d+/)?.[0])).filter((n) => Number.isFinite(n))}
              value={Number(value.match(/\d+/)?.[0]) || 0}
              onChange={(seconds) => onChange(`${seconds}秒`)}
            />
          ) : (
          <div className={isMultiColumnDurationMenu ? "grid grid-cols-2 gap-1.5" : ""}>
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              style={isMultiColumnDurationMenu ? { gridRow: durationMenuRows - (index < durationMenuSplitIndex ? index : index - durationMenuSplitIndex), gridColumn: index < durationMenuSplitIndex ? 2 : 1 } : undefined}
              onClick={() => {
                onChange(option);
                setOpenControlMenu("");
              }}
              className={
                option === value
                  ? `${isDurationMenu ? "h-10" : "my-[3px] h-11"} flex w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]`
                  : `${isDurationMenu ? "h-10" : "my-[3px] h-11"} flex w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]`
              }
            >
              <span className="flex items-center gap-2">
                {icon ? <IconRenderer icon={icon} /> : null}
                <span>{option}</span>
              </span>
              {option === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" /> : null}
            </button>
           ))}
          </div>
          )}
        </div>
      ) : null}
    </div>
    );
  };

  const renderVideoReferenceModeMenu = () => {
    if (!isSelectedVideoReferenceModeModel) return null;
    const referenceModeOptions = getVideoReferenceModeOptions(selectedGenerationModels.video);
    const selectedOption = referenceModeOptions.find((option) => option.value === selectedVideoReferenceMode) ?? referenceModeOptions[0];
    return (
      <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "videoReferenceMode";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("videoReferenceMode");
          }}
          className={`${toolButtonClassName} ${openControlMenu === "videoReferenceMode" ? toolButtonActiveClassName : ""}`}
        >
          <ToolButtonLabel icon={selectedOption.icon} label={selectedOption.label} showChevron />
        </button>

        {openControlMenu === "videoReferenceMode" ? (
          <div className="absolute bottom-full right-0 z-[70] mb-2 w-[360px] rounded-[14px] bg-white p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">参考模式</div>
            {referenceModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedVideoReferenceMode(option.value);
                  setOpenControlMenu("");
                }}
                className={option.value === selectedVideoReferenceMode ? "flex min-h-[58px] w-full items-center justify-between rounded-[10px] bg-[#f5f5f5] px-3 py-2 text-left text-[14px] font-medium text-[#111111]" : "flex min-h-[58px] w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}
              >
                <span className="flex min-w-0 items-start gap-2"><IconRenderer icon={option.icon} /><span className="min-w-0"><span className="block whitespace-nowrap">{option.label}</span><span className="mt-1 block whitespace-normal break-words text-[12px] font-normal leading-4 text-[#999999]">{option.description}</span></span></span>
                {option.value === selectedVideoReferenceMode ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const pruneActiveAudioUploads = () => {
    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSessionId) return session;
        const removingNames = (session.uploadedFiles ?? []).filter((file) => getUploadedFileMediaKind(file) === "audio").map((file) => getUploadedFileDisplayName(file)).filter(Boolean);
        const nextDraft = removingNames.reduce((draft, name) => removeAllMentionNames(draft, name), session.draftInput ?? "");
        return { ...session, draftInput: nextDraft, uploadedFiles: (session.uploadedFiles ?? []).filter((file) => getUploadedFileMediaKind(file) !== "audio"), updatedAt: Date.now() };
      }),
    );
  };

  const renderAudioReferenceModeMenu = () => {
    if (!isSelectedAudioCloneModel) return null;
    const referenceModeOptions = getAudioReferenceModeOptions();
    const selectedOption = referenceModeOptions.find((option) => option.value === selectedAudioReferenceMode) ?? referenceModeOptions[0];
    return (
      <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "audioReferenceMode";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("audioReferenceMode");
          }}
          className={`${toolButtonClassName} ${openControlMenu === "audioReferenceMode" ? toolButtonActiveClassName : ""}`}
        >
          <ToolButtonLabel icon={selectedOption.icon} label={selectedOption.label} showChevron />
        </button>
        {openControlMenu === "audioReferenceMode" ? (
          <div className="absolute bottom-full right-0 z-[70] mb-2 w-[320px] rounded-[14px] bg-white p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">语音模式</div>
            {referenceModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (option.value !== selectedAudioReferenceMode && option.value === "tts") pruneActiveAudioUploads();
                  setSelectedAudioReferenceMode(option.value);
                  setOpenControlMenu("");
                }}
                className={option.value === selectedAudioReferenceMode ? "flex min-h-[58px] w-full items-center justify-between rounded-[10px] bg-[#f5f5f5] px-3 py-2 text-left text-[14px] font-medium text-[#111111]" : "flex min-h-[58px] w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}
              >
                <span className="flex min-w-0 items-start gap-2"><IconRenderer icon={option.icon} /><span className="min-w-0"><span className="block whitespace-nowrap">{option.label}</span><span className="mt-1 block whitespace-normal break-words text-[12px] font-normal leading-4 text-[#999999]">{option.description}</span></span></span>
                {option.value === selectedAudioReferenceMode ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderModelMenu = () => {
    if (mode === "agent" || mode === "general") return null;

    const options = generationModelOptions[mode].filter((option) => enabledGenerationModelIds[mode].includes(option.id));
    const SelectedModelIcon = getGenerationModelIcon(selectedGenerationModel);

    return (
      <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "model";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("model");
          }}
          className={`${toolButtonClassName} ${openControlMenu === "model" ? toolButtonActiveClassName : ""} w-max max-w-none shrink-0 justify-start whitespace-nowrap max-[820px]:w-9 max-[820px]:justify-center max-[820px]:px-0`}
        >
          <span className="flex min-w-0 flex-nowrap items-center gap-2">
            {SelectedModelIcon ? <SelectedModelIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
            <span className={`whitespace-nowrap font-medium max-[820px]:hidden ${isGoldGenerationModel(selectedGenerationModel) ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedGenerationModelLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
        </button>

        {openControlMenu === "model" ? (
          <div className="absolute bottom-full left-0 z-[70] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择模型</div>
            {options.length === 0 ? <div className="px-2 py-6 text-center text-[13px] text-[#999999]">暂无可用模型</div> : options.map((option) => {
              const ModelIcon = getGenerationModelIcon(option.id);
              const isGoldModel = isGoldGenerationModel(option.id);
              const modelHint = getGenerationModelSelectHint(option.id, creditRate.usdToCnyRate, creditRate.creditsPerCny);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedGenerationModels((current) => ({ ...current, [mode]: option.id }));
                    if (mode === "image") {
                      setSelectedResolutions((current) => ({ ...current, image: normalizeImageResolutionForModel(option.id, current.image) }));
                      setSelectedRatios((current) => ({ ...current, image: normalizeImageRatioForModel(option.id, current.image) }));
                    } else if (mode === "video") {
                      setSelectedRatios((current) => ({ ...current, video: current.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(option.id, current.video, normalizeVideoResolutionForModel(option.id, selectedResolutions.video)) }));
                      setSelectedResolutions((current) => ({ ...current, video: normalizeVideoResolutionForModel(option.id, current.video) }));
                      setSelectedDurations((current) => {
                        const options = getVideoDurationOptions(option.id);
                        return { ...current, video: options.includes(current.video) ? current.video : options[0] };
                      });
                    } else if (mode === "audio") {
                      const nextVoice = normalizeAudioVoiceForModel(option.id, selectedAudioVoice);
                      setSelectedAudioVoice(nextVoice);
                      setAudioVoiceLang(getAudioVoiceLang(option.id, nextVoice));
                      setSelectedAudioEmotion(normalizeAudioEmotionForModel(option.id, selectedAudioEmotion));
                      const nextAudioMode = normalizeAudioReferenceModeForModel(option.id, selectedAudioReferenceMode);
                      if (nextAudioMode !== "clone" && selectedAudioReferenceMode === "clone") pruneActiveAudioUploads();
                      setSelectedAudioReferenceMode(nextAudioMode);
                    }
                    setOpenControlMenu("");
                  }}
                  className={
                    option.id === selectedGenerationModel
                      ? `my-[3px] flex w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111] ${modelHint ? "py-2" : "h-11"}`
                      : `my-[3px] flex w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7] ${modelHint ? "py-2" : "h-11"}`
                  }
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      {ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                      <span className={`min-w-0 truncate text-[13px] ${isGoldModel ? "text-[#b8860b]" : ""}`}>{option.label}</span>
                      {isNewGenerationModel(option.id) ? <NewBadge /> : null}
                    </span>
                    {modelHint ? <span className="pl-[26px] text-[11px] font-normal leading-tight text-[#a0a0a0]">{modelHint}</span> : null}
                  </span>
                  {option.id === selectedGenerationModel ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderAudioVoiceMenu = () => {
    if (!isAudioVoiceSelectable(selectedGenerationModel)) return null;
    const langs = getAudioVoiceLangsForModel(selectedGenerationModel);
    const activeLang = langs.some((lang) => lang.value === audioVoiceLang) ? audioVoiceLang : langs[0]?.value ?? "zh";
    const voices = getAudioVoicesForModel(selectedGenerationModel);
    const voiceLabel = getAudioVoiceLabel(selectedGenerationModel, selectedAudioVoice) || "选择音色";
    return (
      <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "audioVoice";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("audioVoice");
          }}
          className={`${toolButtonClassName} ${openControlMenu === "audioVoice" ? toolButtonActiveClassName : ""} w-max max-w-none shrink-0 justify-start whitespace-nowrap`}
        >
          <span className="flex min-w-0 flex-nowrap items-center gap-2">
            <RiVoiceprintLine className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" />
            <span className="whitespace-nowrap font-medium text-[#777777] max-[820px]:hidden">{voiceLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
        </button>
        {openControlMenu === "audioVoice" ? (
          <div className="absolute bottom-full left-0 z-[70] mb-2">
            <AudioVoicePicker
              langs={langs}
              activeLang={activeLang}
              onSelectLang={setAudioVoiceLang}
              voices={voices}
              selectedVoiceId={selectedAudioVoice}
              onPick={(voice) => {
                setSelectedAudioVoice(voice.id);
                setAudioVoiceLang(voice.lang);
                setOpenControlMenu("");
              }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const renderAudioEmotionMenu = () => {
    if (!isAudioEmotionSelectable(selectedGenerationModel)) return null;
    const emotions = getAudioEmotionsForModel(selectedGenerationModel);
    const currentEmotion = normalizeAudioEmotionForModel(selectedGenerationModel, selectedAudioEmotion);
    const emotionLabel = getAudioEmotionLabel(selectedGenerationModel, currentEmotion);
    return (
      <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "audioEmotion";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("audioEmotion");
          }}
          className={`${toolButtonClassName} ${openControlMenu === "audioEmotion" ? toolButtonActiveClassName : ""} w-max max-w-none shrink-0 justify-start whitespace-nowrap`}
        >
          <span className="flex min-w-0 flex-nowrap items-center gap-2">
            <RiEmotionHappyLine className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" />
            <span className="whitespace-nowrap font-medium text-[#777777] max-[820px]:hidden">{emotionLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
        </button>
        {openControlMenu === "audioEmotion" ? (
          <div className="yinzao-scrollbar-always absolute bottom-full left-0 z-[70] mb-2 max-h-[320px] min-w-[160px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择情绪</div>
            {emotions.map((emotion) => {
              const selected = emotion.id === currentEmotion;
              return (
                <button
                  key={emotion.id}
                  type="button"
                  onClick={() => {
                    setSelectedAudioEmotion(emotion.id);
                    setOpenControlMenu("");
                  }}
                  className={selected ? "flex h-9 w-full items-center justify-between rounded-lg bg-[#f5f5f5] px-2.5 text-left" : "flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left transition hover:bg-[#f7f7f7]"}
                >
                  <span className={selected ? "min-w-0 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 truncate text-[13px] text-[#555555]"}>{emotion.label}</span>
                  {selected ? <RiCheckLine className="h-4 w-4 shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderGeneralModelMenu = (kind: "chat" | "image" | "video", title: string) => {
    const menuName = kind === "chat" ? "generalChatModel" : kind === "image" ? "generalImageModel" : "generalVideoModel";
    const options: readonly (ConversationModel | GenerationModel)[] = kind === "chat"
      ? frontendConversationModels.filter((option) => enabledGeneralChatModelIds.includes(option.id))
      : generationModelOptions[kind].filter((option) => enabledGenerationModelIds[kind].includes(option.id));
    const getGeneralChatIcon = (modelId: string) => generalModelProviders[modelId] === "byteplus" ? BytePlusIcon : getGenerationModelIcon(modelId) ?? RiChat3Line;
    const selectedId = selectedGeneralModels[kind];
    const selectedLabel = kind === "chat" ? getConversationModelLabel(selectedId) : getGenerationModelLabel(kind, selectedId);
    const SelectedModelIcon = kind === "chat" ? getGeneralChatIcon(selectedId) : getGenerationModelIcon(selectedId);
    const selectedIsGold = kind === "chat" ? isGoldConversationModel(selectedId) : isGoldGenerationModel(selectedId);

    return (
      <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === menuName;
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu(menuName);
          }}
          className={`${toolButtonClassName} ${openControlMenu === menuName ? toolButtonActiveClassName : ""} w-max max-w-none shrink-0 justify-start whitespace-nowrap px-2.5 max-[820px]:justify-center`}
        >
          <span className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
            {SelectedModelIcon ? <SelectedModelIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
            <span className={`min-w-0 flex-1 truncate whitespace-nowrap font-medium max-[820px]:hidden ${selectedIsGold ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
        </button>

        {openControlMenu === menuName ? (
          <div className="yinzao-scrollbar-always absolute bottom-full left-0 z-[70] mb-2 max-h-[420px] w-[300px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>
            {options.length === 0 ? <div className="px-2 py-6 text-center text-[13px] text-[#999999]">暂无可用模型</div> : options.map((option) => {
              const ModelIcon = kind === "chat" ? getGeneralChatIcon(option.id) : getGenerationModelIcon(option.id);
              const isGoldModel = kind === "chat" ? isGoldConversationModel(option.id) : isGoldGenerationModel(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedGeneralModels((current) => ({ ...current, [kind]: option.id }));
                    if (kind === "image") {
                      setSelectedResolutions((current) => ({ ...current, general: normalizeImageResolutionForModel(option.id, current.general) }));
                    } else if (kind === "video") {
                      setSelectedDurations((current) => {
                        const durationOptionsForModel = getVideoDurationOptions(option.id);
                        return { ...current, general: durationOptionsForModel.includes(current.general) ? current.general : durationOptionsForModel[0] };
                      });
                    }
                    setOpenControlMenu("");
                  }}
                  className={
                    option.id === selectedId
                      ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]"
                      : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                    <span className={`min-w-0 truncate text-[13px] ${isGoldModel ? "text-[#b8860b]" : ""}`}>{option.label}</span>
                  </span>
                  {option.id === selectedId ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderGeneralCustomMenu = () => {
    const kind = generalPreferenceKind;
    const selectedModelId = selectedGeneralModels[kind];
    const SelectedModelIcon = getGenerationModelIcon(selectedModelId);
    const modelOptions = generationModelOptions[kind].filter((option) => enabledGenerationModelIds[kind].includes(option.id));
    const selectedModelLabel = getGenerationModelLabel(kind, selectedModelId);
    const ratioOptionsForKind = kind === "image"
      ? ["智能比例", ...getSupportedImageRatios(selectedModelId)]
      : ["智能比例", ...getSupportedVideoRatios(selectedModelId, generalVideoResolution)];
    const currentRatio = kind === "image" ? generalImageRatio : generalVideoRatio;
    const displayRatio = ratioOptionsForKind.includes(currentRatio) ? currentRatio : ratioOptionsForKind[0];
    const imageResolutions = getSupportedImageResolutions(selectedModelId);
    const videoResolutions = getSupportedVideoResolutions(selectedModelId);
    const displayImageResolution = imageResolutions.includes(generalImageResolution as (typeof imageResolutions)[number]) ? generalImageResolution : imageResolutions[0];
    const displayVideoResolution = videoResolutions.includes(generalVideoResolution as (typeof videoResolutions)[number]) ? generalVideoResolution : videoResolutions[0];
    const displayResolution = kind === "image" ? displayImageResolution : displayVideoResolution;
    const resolutionOptionsForKind = kind === "image" ? imageResolutions : videoResolutions;
    const resolutionButtonLabel = kind === "image" ? getImageResolutionLabel(displayImageResolution) : getVideoResolutionLabel(displayVideoResolution);
    const controlsDisabled = generalPreferenceAuto;
    return (
      <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "generalCustom";
            closeAllPopupMenus();
            setGeneralCustomSubMenu("");
            if (!shouldClose) setOpenControlMenu("generalCustom");
          }}
          className={`${toolButtonClassName} ${openControlMenu === "generalCustom" ? toolButtonActiveClassName : ""}`}
        >
          <ToolButtonLabel icon={RiEqualizerLine} label={generalPreferenceAuto ? "自动" : "自定义"} />
        </button>
        {openControlMenu === "generalCustom" ? (
          <div className="absolute bottom-full left-0 z-[70] mb-2 w-[min(440px,calc(100vw-40px))] rounded-[16px] bg-white p-4 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-medium text-[#222222]">生成偏好</div>
              <button
                type="button"
                role="switch"
                aria-checked={generalPreferenceAuto}
                aria-label="自动"
                onClick={() => setGeneralPreferenceAuto((current) => !current)}
                className="inline-flex items-center gap-2"
              >
                <span className="text-[13px] text-[#888888]">自动</span>
                <span className={generalPreferenceAuto ? "relative h-5 w-9 rounded-full bg-[#111111]" : "relative h-5 w-9 rounded-full bg-[#d8d8d8]"}>
                  <span className={generalPreferenceAuto ? "absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-white" : "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white"} />
                </span>
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-[12px] bg-[#f4f4f4] p-1">
              <button type="button" onClick={() => { setGeneralPreferenceKind("image"); setGeneralCustomSubMenu(""); }} className={kind === "image" ? "h-9 rounded-[10px] bg-white text-[13px] font-medium text-[#111111] shadow-[0_1px_4px_rgba(0,0,0,0.06)]" : "h-9 rounded-[10px] text-[13px] font-medium text-[#888888]"}>图片</button>
              <button type="button" onClick={() => { setGeneralPreferenceKind("video"); setGeneralCustomSubMenu(""); }} className={kind === "video" ? "h-9 rounded-[10px] bg-white text-[13px] font-medium text-[#111111] shadow-[0_1px_4px_rgba(0,0,0,0.06)]" : "h-9 rounded-[10px] text-[13px] font-medium text-[#888888]"}>视频</button>
            </div>
            <div className={controlsDisabled ? "pointer-events-none mt-4 opacity-40" : "mt-4"}>
              <div className="text-[13px] text-[#888888]">选择比例</div>
              <div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">
                {ratioOptionsForKind.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      if (kind === "image") setGeneralImageRatio(option);
                      else setGeneralVideoRatio(option);
                    }}
                    className={option === displayRatio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}
                  >
                    <RatioOptionIcon option={option} />
                    <span className="text-[12px] font-medium leading-none">{option === "智能比例" ? "智能" : option}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 text-[13px] text-[#888888]">其他设置</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setGeneralCustomSubMenu((current) => current === "model" ? "" : "model")}
                    className="flex h-10 w-full items-center justify-between rounded-[12px] bg-[#f5f5f5] px-3 text-[13px] text-[#333333]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {SelectedModelIcon ? <SelectedModelIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                      <span className="min-w-0 truncate">{selectedModelLabel}</span>
                    </span>
                    <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
                  </button>
                  {generalCustomSubMenu === "model" ? (
                    <div className="yinzao-scrollbar-always absolute bottom-full left-0 z-[80] mb-1 max-h-[240px] w-full overflow-y-scroll rounded-[12px] bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                      {modelOptions.length === 0 ? <div className="px-2 py-4 text-center text-[13px] text-[#999999]">暂无可用模型</div> : modelOptions.map((option) => {
                        const ModelIcon = getGenerationModelIcon(option.id);
                        return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSelectedGeneralModels((current) => ({ ...current, [kind]: option.id }));
                            if (kind === "image") {
                              setGeneralImageRatio((current) => normalizeImageRatioForModel(option.id, current));
                              setGeneralImageResolution((current) => normalizeImageResolutionForModel(option.id, current));
                            } else {
                              const nextResolution = normalizeVideoResolutionForModel(option.id, generalVideoResolution);
                              setGeneralVideoResolution(nextResolution);
                              setGeneralVideoRatio((current) => current === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(option.id, current, nextResolution));
                              setSelectedDurations((current) => {
                                const durationOptionsForModel = getVideoDurationOptions(option.id);
                                return { ...current, general: durationOptionsForModel.includes(current.general) ? current.general : durationOptionsForModel[0] };
                              });
                            }
                            setGeneralCustomSubMenu("");
                          }}
                          className={option.id === selectedModelId ? "flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-2.5 text-left text-[13px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between rounded-[8px] px-2.5 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {ModelIcon ? <ModelIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                            <span className="min-w-0 truncate">{option.label}</span>
                          </span>
                          {option.id === selectedModelId ? <RiCheckLine className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                        </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setGeneralCustomSubMenu((current) => current === "resolution" ? "" : "resolution")}
                    className="flex h-10 w-full items-center justify-between rounded-[12px] bg-[#f5f5f5] px-3 text-[13px] text-[#333333]"
                  >
                    <span className="min-w-0 truncate">{resolutionButtonLabel}</span>
                    <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
                  </button>
                  {generalCustomSubMenu === "resolution" ? (
                    <div className="absolute bottom-full left-0 z-[80] mb-1 w-full rounded-[12px] bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                      {resolutionOptionsForKind.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            if (kind === "image") setGeneralImageResolution(normalizeImageResolutionForModel(selectedModelId, option));
                            else {
                              const nextResolution = normalizeVideoResolutionForModel(selectedModelId, option);
                              setGeneralVideoResolution(nextResolution);
                              setGeneralVideoRatio((current) => current === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedModelId, current, nextResolution));
                            }
                            setGeneralCustomSubMenu("");
                          }}
                          className={option === displayResolution ? "flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-2.5 text-left text-[13px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between rounded-[8px] px-2.5 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"}
                        >
                          <span>{kind === "image" ? getImageResolutionLabel(option) : getVideoResolutionLabel(option)}</span>
                          {option === displayResolution ? <RiCheckLine className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterImageModelMenu = () => {
    const options = generationModelOptions.image.filter((option) => enabledAssetImageModelIds.includes(option.id));
    const selectedImageModel = characterGenerateModel;
    const selectedImageModelLabel = getGenerationModelLabel("image", selectedImageModel);
    const SelectedModelIcon = getGenerationModelIcon(selectedImageModel);

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterModel";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterModel");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] px-3.5 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterModel" ? toolButtonActiveClassName : ""}`}
        >
          <span className="flex min-w-0 max-w-full flex-nowrap items-center justify-center gap-2">
            {SelectedModelIcon ? <SelectedModelIcon className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
            <span className={`min-w-0 truncate whitespace-nowrap text-[13px] font-medium ${isGoldGenerationModel(selectedImageModel) ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedImageModelLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
          </span>
        </button>

        {openControlMenu === "characterModel" && !isCharacterGenerateInputDisabled ? (
          <div className="yinzao-scrollbar-always absolute left-0 top-full z-[70] mt-1 max-h-[320px] w-full overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择模型</div>
            {options.length === 0 ? <div className="px-2 py-3 text-[13px] text-[#999999]">暂无可用模型</div> : null}
            {options.map((option) => {
              const ModelIcon = getGenerationModelIcon(option.id);
              const isGoldModel = isGoldGenerationModel(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setCharacterGenerateModel(option.id);
                    setCharacterGenerateResolution((current) => normalizeImageResolutionForModel(option.id, current));
                    setOpenControlMenu("");
                  }}
                  className={
                    option.id === selectedImageModel
                      ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                      : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                    <span className={`min-w-0 truncate text-[13px] leading-none ${isGoldModel ? "text-[#b8860b]" : ""}`}>{option.label}</span>
                  </span>
                  {option.id === selectedImageModel ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterImageResolutionMenu = () => {
    const options = getSupportedImageResolutions(characterGenerateModel);
    const selectedImageResolution = normalizeImageResolutionForModel(characterGenerateModel, characterGenerateResolution);
    const selectedLabel = selectedImageResolution;

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterResolution";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterResolution");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterResolution" ? toolButtonActiveClassName : ""}`}
        >
          <span className="whitespace-nowrap text-[13px] font-medium leading-none text-[#777777]">{selectedLabel}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </button>

        {openControlMenu === "characterResolution" && !isCharacterGenerateInputDisabled ? (
          <div className={`absolute left-0 top-full z-[70] mt-1 rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)] ${isGptImage2Model(characterGenerateModel) ? "w-[calc(200%+8px)]" : "w-full"}`}>
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择分辨率</div>
            {options.map((option) => {
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCharacterGenerateResolution(option);
                    setOpenControlMenu("");
                  }}
                  className={
                    option === selectedImageResolution
                      ? "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                      : "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                  }
                >
                  <span className="text-[13px] font-medium leading-none">{option}</span>
                  {option === selectedImageResolution ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterImageQualityMenu = () => {
    const current = IMAGE_QUALITY_OPTIONS.includes(characterGenerateQuality as (typeof IMAGE_QUALITY_OPTIONS)[number]) ? (characterGenerateQuality as (typeof IMAGE_QUALITY_OPTIONS)[number]) : DEFAULT_IMAGE_QUALITY;

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterQuality";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterQuality");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterQuality" ? toolButtonActiveClassName : ""}`}
        >
          <span className="whitespace-nowrap text-[13px] font-medium leading-none text-[#777777]">{IMAGE_QUALITY_LABELS[current]}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </button>

        {openControlMenu === "characterQuality" && !isCharacterGenerateInputDisabled ? (
          <div className="absolute right-0 top-full z-[70] mt-1 w-[calc(200%+8px)] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">画质</div>
            {IMAGE_QUALITY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCharacterGenerateQuality(option);
                  setOpenControlMenu("");
                }}
                className={
                  option === current
                    ? "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                    : "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                }
              >
                <span className="text-[13px] font-medium leading-none">{IMAGE_QUALITY_LABELS[option]}</span>
                {option === current ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterRatioMenu = () => {
    const options: Array<{ value: AssetGenerateRatio; label: string; iconClassName: string }> = isShotGeneration
      ? [
        { value: "single", label: "竖屏分镜9:16", iconClassName: "h-4 w-[9px]" },
        { value: "three-view", label: "横屏分镜16:9", iconClassName: "h-[9px] w-4" },
      ]
      : isSceneGeneration
      ? [
        { value: "single", label: "单场景9:16", iconClassName: "h-4 w-[9px]" },
        { value: "three-view", label: "单场景16:9", iconClassName: "h-[9px] w-4" },
        { value: "scene-grid", label: "四宫格16:9", iconClassName: "h-[9px] w-4" },
      ]
      : isPropGeneration
      ? [
        { value: "single", label: "单道具9:16", iconClassName: "h-4 w-[9px]" },
        { value: "three-view", label: "多角度16:9", iconClassName: "h-[9px] w-4" },
        { value: "grid-square", label: "四宫格1:1", iconClassName: "h-3.5 w-3.5" },
      ]
      : [
        { value: "single", label: "单人9:16", iconClassName: "h-4 w-[9px]" },
        { value: "three-view", label: "三视图16:9", iconClassName: "h-[9px] w-4" },
      ];
    const selectedOption = options.find((option) => option.value === characterGenerateRatio) ?? options[0];

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterRatio";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterRatio");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] px-3.5 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterRatio" ? toolButtonActiveClassName : ""}`}
        >
          <span className={`${selectedOption.iconClassName} shrink-0 rounded-[2px] border border-[#777777]`} aria-hidden="true" />
          <span className="truncate text-[13px] font-medium leading-none text-[#777777]">{selectedOption.label}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </button>

        {openControlMenu === "characterRatio" && !isCharacterGenerateInputDisabled ? (
          <div className="yinzao-scrollbar-always absolute left-0 top-full z-[70] mt-1 max-h-[320px] w-full overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择比例</div>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setActiveAssetGenerateRatio(option.value);
                  setOpenControlMenu("");
                }}
                className={
                  option.value === characterGenerateRatio
                    ? "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                    : "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`${option.iconClassName} shrink-0 rounded-[2px] border border-[#777777]`} aria-hidden="true" />
                  <span className="truncate text-[13px] font-medium leading-none">{option.label}</span>
                </span>
                {option.value === characterGenerateRatio ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterStyleMenu = () => {
    const options: Array<{ value: "realistic" | "2d" | "3d"; label: string }> = [
      { value: "realistic", label: "写实风格" },
      { value: "2d", label: "2D风格" },
      { value: "3d", label: "3D风格" },
    ];
    const selectedStyleLabel = options.find((option) => option.value === characterGenerateStyle)?.label ?? "写实风格";

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterStyle";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterStyle");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterStyle" ? toolButtonActiveClassName : ""}`}
        >
          <span className="truncate text-[13px] font-medium leading-none text-[#777777]">{selectedStyleLabel}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </button>

        {openControlMenu === "characterStyle" && !isCharacterGenerateInputDisabled ? (
          <div className="yinzao-scrollbar-always absolute left-0 top-full z-[70] mt-1 max-h-[320px] w-full overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择风格</div>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setCharacterGenerateStyle(option.value);
                  setOpenControlMenu("");
                }}
                className={
                  option.value === characterGenerateStyle
                    ? "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                    : "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                }
              >
                <span className="truncate text-[13px] font-medium leading-none">{option.label}</span>
                {option.value === characterGenerateStyle ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderImageSettingsMenu = () => {
    const currentResolutionOptions = mode === "video" ? getSupportedVideoResolutions(selectedGenerationModels.video) : getSupportedImageResolutions(selectedGenerationModels.image);
    const isSmartImageRatio = mode === "image" && selectedRatio === "智能比例";
    const isSmartSettings = isSmartImageRatio || (mode === "video" && selectedRatio === "智能比例");
    const displayResolution = isSmartImageRatio ? normalizeImageResolutionForModel(selectedGenerationModels.image, "智能比例") : selectedResolution;
    // ⭐ 图片模式的比例必须**按模型**给（Recraft 只支持 5 个、无 21:9）。
    // ⛔ 别退回全局 ratioOptions —— 那样用户能选 21:9，而上游不支持会被我们映射成 auto，
    //    出图比例和他选的不一样，界面上完全看不出来。general/agent 模式的模型是自动挑的，仍用全局列表。
    const currentRatioOptions = mode === "video"
      ? ["智能比例", ...getSupportedVideoRatios(selectedGenerationModels.video, displayResolution)]
      : mode === "image"
        ? ["智能比例", ...getSupportedImageRatios(selectedGenerationModels.image)]
        : ratioOptions;
    const displayRatio = mode === "video" ? (selectedRatio === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedGenerationModels.video, selectedRatio, displayResolution)) : selectedRatio;
    const displayDimensions = getDisplayDimensions(displayRatio, displayResolution, mode, mode === "image" ? selectedGenerationModels.image : mode === "video" ? selectedGenerationModels.video : undefined);
    const isNonStandardVideoDimensions = mode === "video" && displayRatio !== "智能比例" && isNonStandardVideoSize(selectedGenerationModels.video, displayResolution, displayRatio);
    const imageResolutionLabel = mode === "image" ? getImageResolutionLabel(displayResolution) : getVideoResolutionLabel(displayResolution);
    const imageQualityBadgeLabel = mode === "image" ? getImageQualityBadgeLabel(displayResolution) : "";
    const settingsMenuWidthClassName = "w-[min(420px,calc(100vw-40px))]";
    const resolutionGridClassName = mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2";
    const resolutionButtonPaddingClassName = mode === "video" ? "px-2" : "px-4";
    const resolutionLabelGapClassName = mode === "video" ? "gap-1.5" : "gap-2";

    return (
      <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "imageSettings";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("imageSettings");
          }}
          className={`relative ${toolButtonClassName} pl-10 ${openControlMenu === "imageSettings" ? toolButtonActiveClassName : ""}`}
        >
          <span className="flex min-w-0 flex-nowrap items-center gap-2">
            <span className="font-medium text-[#777777] max-[820px]:hidden">{displayRatio} /</span>
            <span className={`font-medium max-[820px]:hidden ${imageQualityBadgeLabel ? "text-[#b8860b]" : "text-[#777777]"}`}>{imageResolutionLabel}</span>
            {mode === "image" && isGptImage2Model(selectedGenerationModels.image) ? (
              <span className="font-medium text-[#777777] max-[820px]:hidden">/ 画质{IMAGE_QUALITY_LABELS[(IMAGE_QUALITY_OPTIONS.includes(selectedImageQuality as (typeof IMAGE_QUALITY_OPTIONS)[number]) ? selectedImageQuality : DEFAULT_IMAGE_QUALITY) as (typeof IMAGE_QUALITY_OPTIONS)[number]]}</span>
            ) : null}
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={displayRatio} /></span>
        </button>

        {openControlMenu === "imageSettings" ? (
          <div className={`absolute bottom-full left-0 z-[70] mb-2 ${settingsMenuWidthClassName} rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]`}>
            <div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div>
            <div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">
              {currentRatioOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSelectedRatios((current) => ({ ...current, [mode]: option }));
                    if (mode === "image") {
                      setSelectedResolutions((current) => ({ ...current, image: normalizeImageResolutionForModel(selectedGenerationModels.image, current.image) }));
                    }
                  }}
                  className={option === displayRatio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}
                >
                  <RatioOptionIcon option={option} />
                  <span className="text-[13px] font-medium leading-none">{option === "智能比例" ? "智能" : option}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div>
            <div className={`mt-2 grid ${resolutionGridClassName} rounded-[12px] bg-[#f6f6f6] py-1 ${currentResolutionOptions.length === 1 ? "grid-cols-1" : currentResolutionOptions.length === 2 ? "grid-cols-2" : currentResolutionOptions.length === 3 ? "grid-cols-3" : "grid-cols-4"} ${isSmartSettings ? "opacity-45" : ""}`}>
              {currentResolutionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isSmartSettings}
                  onClick={() => {
                    setSelectedResolutions((current) => ({ ...current, [mode]: option }));
                    if (mode === "video") {
                      setSelectedRatios((current) => ({ ...current, video: current.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedGenerationModels.video, current.video, option) }));
                    }
                  }}
                  className={option === displayResolution ? `flex h-[56px] items-center justify-center rounded-[10px] bg-white ${resolutionButtonPaddingClassName} text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)] disabled:cursor-not-allowed` : `flex h-[56px] items-center justify-center rounded-[10px] ${resolutionButtonPaddingClassName} text-[#666666] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                >
                  <span className={`flex items-center ${resolutionLabelGapClassName} whitespace-nowrap text-[13px] font-medium leading-none ${mode === "image" && getImageQualityBadgeLabel(option) ? "text-[#b8860b]" : ""}`}>
                    <ResolutionOptionIcon option={option} mode={mode} highlighted={mode === "image" && Boolean(getImageQualityBadgeLabel(option))} />
                    <span>{mode === "video" ? getVideoResolutionLabel(option) : getImageResolutionLabel(option)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">尺寸{isNonStandardVideoDimensions ? "（非标）" : ""}</div>
            <div className={`mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 ${isSmartSettings ? "opacity-45" : ""}`}>
              <div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4">
                <span className="text-[13px] font-medium text-[#9a9a9a]">W</span>
                <span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(displayDimensions.width)}</span>
              </div>
              <div className="flex h-[48px] w-[24px] items-center justify-center text-[#8a8a8a]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M4 4L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4">
                <span className="text-[13px] font-medium text-[#9a9a9a]">H</span>
                <span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(displayDimensions.height)}</span>
              </div>
              <div className="text-[13px] font-medium text-[#8a8a8a]">PX</div>
            </div>
            {mode === "image" && isGptImage2Model(selectedGenerationModels.image) ? (
              <>
                <div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">画质</div>
                <div className="mt-2 grid grid-cols-4 gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">
                  {IMAGE_QUALITY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedImageQuality(option)}
                      className={option === selectedImageQuality ? "flex h-[44px] items-center justify-center rounded-[10px] bg-white text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[44px] items-center justify-center rounded-[10px] text-[#666666] transition hover:bg-white/80"}
                    >
                      <span className="text-[13px] font-medium leading-none">{IMAGE_QUALITY_LABELS[option]}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const startNewSession = () => {
    setOpenSessionMenuId("");

    // 新建对话时套用用户在「设置」里配置的默认生成参数（图片/视频两组），省去每次手调。
    // 值可能因模型能力变化而不完全匹配，交给已有的归一化 effect 自动纠正。
    setSelectedGenerationModels((current) => ({ ...current, image: defaultImageModel, video: defaultVideoModel, audio: defaultAudioModel }));
    // ⭐ 比例要按"默认模型支不支持"归一化（例如老账号存着 21:9、默认模型换成 Recraft 就不支持了）。
    setSelectedRatios((current) => ({ ...current, image: normalizeImageRatioForModel(defaultImageModel, defaultImageRatio), video: defaultVideoRatio }));
    setSelectedResolutions((current) => ({ ...current, image: defaultImageResolution, video: defaultVideoResolution }));
    setSelectedDurations((current) => ({ ...current, video: defaultVideoDuration }));
    setSelectedAudioVoice(normalizeAudioVoiceForModel(defaultAudioModel, defaultAudioVoice));
    setSelectedAudioEmotion(normalizeAudioEmotionForModel(defaultAudioModel, defaultAudioEmotion));

    if (activeSession && isEmptySession(activeSession)) {
      return;
    }

    const existingEmptySession = sessions.find((session) => isVisibleSession(session) && isEmptySession(session));

    if (existingEmptySession) {
      setActiveSessionId(existingEmptySession.id);
      return;
    }

    const session = createSession(nextConversationNumber);
    setNextConversationNumber((current) => Math.max(current + 1, nextConversationNumber + 1));
    setSessions((current) => [session, ...current]);
    setHistoryTotalSessionCount((count) => count + 1);
    setActiveSessionId(session.id);
  };

  const startNewWorkflow = () => {
    setOpenWorkflowMenuId("");
    const existingUntitledWorkflow = activeWorkflowItems.find(isUntitledWorkflow);
    if (existingUntitledWorkflow) {
      setActiveWorkflowId(existingUntitledWorkflow.id);
      return;
    }

    const workflow = createWorkflowItem();
    setWorkflowItems((current) => [workflow, ...current]);
    setWorkflowVisibleItemCount((count) => Math.max(WORKFLOW_INITIAL_ITEM_COUNT, Math.min(activeWorkflowItems.length + 1, count + 1)));
    setActiveWorkflowId(workflow.id);
  };

  const pinWorkflow = (workflowId: string) => {
    setOpenWorkflowMenuId("");
    setWorkflowItems((current) => {
      const target = current.find((item) => item.id === workflowId);
      if (!target) return current;
      return [{ ...target, updatedAt: Date.now() }, ...current.filter((item) => item.id !== workflowId)];
    });
  };

  const renameWorkflow = (workflowId: string) => {
    const workflow = workflowItems.find((item) => item.id === workflowId);
    if (!workflow) return;

    setOpenWorkflowMenuId("");
    setRenamingSessionId(workflowId);
    setRenameInput(workflow.title);
  };

  const deleteWorkflow = (workflowId: string) => {
    setOpenWorkflowMenuId("");
    const activeWorkflowCount = workflowItems.filter((item) => isVisibleWorkflow(item)).length;
    if (activeWorkflowCount <= 1) {
      showInputTip("至少保留一个工作流，无法删除");
      return;
    }
    setWorkflowItems((current) => {
      const deletedAt = Date.now();
      const next = ensureWorkflowItems(current.map((item) => item.id === workflowId ? { ...item, deletedAt, updatedAt: deletedAt } : item));
      const nextVisible = next.filter((item) => isVisibleWorkflow(item));
      setActiveWorkflowId((currentActiveId) => {
        if (currentActiveId !== workflowId && nextVisible.some((item) => item.id === currentActiveId)) return currentActiveId;
        return nextVisible[0]?.id ?? next[0]?.id ?? "";
      });
      return next;
    });
  };

  const updateWorkflowCanvas = useCallback((workflowId: string, canvas: WorkflowCanvasState, meta?: { userInitiated?: boolean }) => {
    // ⛔ 从 ref 读当前值、在 setState 之外做全部副作用（编号自增、防抖 PUT）：
    //   React 可能重跑 setState 的 updater，副作用写在 updater 里会重复执行（2026-08-02 审计 2.3）。
    const current = workflowItemsRef.current;
    const target = current.find((item) => item.id === workflowId);
    if (!target) return;
    let title = target.title;
    let workflowCode = getWorkflowCode(target);
    let nextWorkflowNumberForPayload = nextWorkflowNumber;
    if (isUntitledWorkflow(target) && hasWorkflowAction(canvas)) {
      const result = getNextWorkflowTitleFromNumber(current, nextWorkflowNumber);
      title = result.title;
      workflowCode = `w${getWorkflowNumberFromTitle(result.title)}`;
      nextWorkflowNumberForPayload = result.nextWorkflowNumber;
    }
    const textChanged = getWorkflowTextSnapshot(target.canvas) !== getWorkflowTextSnapshot(canvas);
    // ⭐⭐ 置顶规则（2026-07-30 按用户要求定稿）：「画面真的变了」且「变化是用户造成的」才置顶。
    //  · 内容变了没有 → meaningfulChanged
    //  · 是用户造成的吗 → meta.userInitiated（画布在源头标记：按下鼠标/键盘、点菜单按钮、生成回填都算 true；
    //    打开工作流时 normalizeState 的归一化写回是 false）
    //  · 兜底 → mediaChanged：成品媒体地址变了（新生成出图/出视频）一律算变化，即使标记没打上。
    // ⛔ 别再走"往 stripKeys 里加字段"那条老路：剔不完，而且会把改比例/换模型这类真操作也屏蔽掉。
    // meta 缺省时按 true（兼容其它调用方，宁可多置顶也不要漏掉用户的真操作）。
    const meaningfulChanged = getWorkflowMeaningfulSnapshot(target.canvas) !== getWorkflowMeaningfulSnapshot(canvas);
    const mediaChanged = getWorkflowMediaSnapshot(target.canvas) !== getWorkflowMediaSnapshot(canvas);
    const shouldBumpToTop = meaningfulChanged && (meta?.userInitiated !== false || mediaChanged);
    if (nextWorkflowNumberForPayload !== nextWorkflowNumber) setNextWorkflowNumber(nextWorkflowNumberForPayload);
    // ⭐⭐ 2026-08-02 审计复核修正：**映射仍然放在 updater 里**（用 prev，不是用 ref 算好的整份数组）。
    //   原因：`workflowItemsRef` 只在 effect 里同步，如果同一 tick 内先有别处 `setWorkflowItems(fn)`
    //   排队（例如生成回填 applyImageNodeResult），再调到这里，用 ref 算出的整份 next 会**把那次更新覆盖掉**
    //   （成品图静默丢失）。放在 updater 里只改目标那一项，就能和排队中的更新自然叠加。
    //   ⛔ 而"编号自增 / 发 PUT"这类副作用**绝不能**写回 updater（updater 可能重跑），仍留在外面。
    const mapItem = (item: WorkflowItem) => item.id === workflowId
      ? { ...item, workflowCode, title, canvas: { ...canvas, generatedMediaCounts: canvas.generatedMediaCounts ?? item.canvas?.generatedMediaCounts, countedGeneratedUrls: canvas.countedGeneratedUrls ?? item.canvas?.countedGeneratedUrls }, updatedAt: shouldBumpToTop ? Date.now() : (item.updatedAt ?? Date.now()) }
      : item;
    workflowItemsRef.current = current.map(mapItem);
    setWorkflowItems((prev) => {
      const next = prev.map(mapItem);
      workflowItemsRef.current = next;
      return next;
    });
    if (textChanged && workspaceStorageMode === "user") {
      if (workflowTextSaveTimerRef.current !== null) window.clearTimeout(workflowTextSaveTimerRef.current);
      workflowTextSaveTimerRef.current = window.setTimeout(() => {
        // ⭐ 载荷在真正要发的那一刻从 ref 现取（此时已是最新提交值），不用 250ms 前算好的快照。
        const payload: WorkspaceStatePayload = {
          workflowItems: getPersistableWorkflowItems(normalizeWorkflowCodesAndMediaNumbers(workflowItemsRef.current)),
          activePanel: "workflow",
          activeWorkflowId: workflowId,
          nextWorkflowNumber: nextWorkflowNumberForPayload,
        };
        fetch("/api/workspace-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => console.warn("工作流文本保存失败"));
      }, 250);
    }
  }, [nextWorkflowNumber, workspaceStorageMode]);

  const pinSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const target = current.find((session) => session.id === sessionId);
      if (!target) return current;
      return [{ ...target, updatedAt: Date.now() }, ...current.filter((session) => session.id !== sessionId)];
    });
  };

  const renameSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;

    setOpenSessionMenuId("");
    setRenamingSessionId(sessionId);
    setRenameInput(session.title);
  };

  const submitRenameSession = () => {
    const title = renameInput.trim();
    if (!title) return;

    if (activePanel === "workflow") {
      setWorkflowItems((current) => current.map((item) => (item.id === renamingSessionId ? { ...item, title, updatedAt: Date.now() } : item)));
    } else {
      setSessions((current) => current.map((item) => (item.id === renamingSessionId ? { ...item, title, updatedAt: Date.now() } : item)));
      if (workspaceStorageMode === "user") {
        void fetch("/api/credits/conversation-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: renamingSessionId, title }),
        }).catch(() => undefined);
      }
    }
    setRenamingSessionId("");
    setRenameInput("");
  };

  const cancelRenameSession = () => {
    setRenamingSessionId("");
    setRenameInput("");
  };

  const persistMediaAssetState = useCallback((asset: AssetItem | undefined, patch: Record<string, unknown>) => {
    if (!asset || workspaceStorageMode !== "user") return;
    if (isRemoteMediaUrl(asset.url)) return;
    void fetch("/api/media-assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, mediaAssetId: asset.mediaId, url: asset.url, ...patch }),
    }).catch((error) => {
      console.warn("[media-assets] failed to update asset state", error);
      showInputTip("资产状态保存失败，请刷新后重试");
    });
  }, [showInputTip, workspaceStorageMode]);

  const submitRenameAsset = () => {
    const name = assetRenameInput.trim();
    if (!name) return;
    const asset = assets.find((item) => item.id === renamingAssetId);

    setAssets((current) => current.map((asset) => {
      if (asset.id !== renamingAssetId) return asset;
      const systemName = asset.systemName || asset.name;
      return { ...asset, systemName, userName: name === systemName ? undefined : name, name };
    }));
    setOpenAssetActionMenuId("");
    setRenamingAssetId("");
    setAssetRenameInput("");
    persistMediaAssetState(asset, { name });
  };

  const cancelRenameAsset = () => {
    setRenamingAssetId("");
    setAssetRenameInput("");
  };

  const deleteAsset = (assetId: string) => {
    setOpenAssetActionMenuId("");
    const deletingAsset = assets.find((asset) => asset.id === assetId);
    if (deletingAsset && deletingAsset.type !== "trash") {
      adjustAssetCounts([{ filter: getAssetCountFilter(deletingAsset), delta: -1 }, { filter: "trash", delta: 1 }]);
    }
    setAssets((current) => current.map((asset) => (asset.id === assetId ? { ...asset, previousType: asset.type, type: "trash", deletedAt: Date.now(), purgeAt: Date.now() + ASSET_TRASH_RETENTION_MS } : asset)));
    if (deletingAsset?.url) setAssetGenerateJobs((current) => current.filter((job) => job.result.url !== deletingAsset.url));
    setPreviewAsset((current) => (current?.id === assetId ? { ...current, previousType: current.type, type: "trash", deletedAt: Date.now(), purgeAt: Date.now() + ASSET_TRASH_RETENTION_MS } : current));
    persistMediaAssetState(deletingAsset, { delete: true });
  };

  const restoreAsset = (assetId: string) => {
    setOpenAssetActionMenuId("");
    const restoringAsset = assets.find((asset) => asset.id === assetId);
    if (restoringAsset?.type === "trash") {
      const restoredAsset = { ...restoringAsset, type: getRestoreAssetType(restoringAsset), previousType: undefined, deletedAt: undefined, purgeAt: undefined };
      adjustAssetCounts([{ filter: "trash", delta: -1 }, { filter: getAssetCountFilter(restoredAsset), delta: 1 }]);
    }
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              type: getRestoreAssetType(asset),
              previousType: undefined,
              deletedAt: undefined,
              purgeAt: undefined,
            }
          : asset,
      ),
    );
    persistMediaAssetState(restoringAsset, { restore: true });
  };

  const deleteSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const deletedAt = Date.now();
      const nextSessions = current.map((session) => (session.id === sessionId ? { ...session, deletedAt, updatedAt: deletedAt } : session));
      const visibleSessions = nextSessions.filter((session) => isVisibleSession(session));
      const safeSessions = visibleSessions.length > 0 ? nextSessions : [createSession(nextConversationNumber), ...nextSessions];
      if (visibleSessions.length === 0) setNextConversationNumber((current) => Math.max(current + 1, nextConversationNumber + 1));
      setHistoryTotalSessionCount((count) => Math.max(visibleSessions.length === 0 ? 1 : 0, count - 1 + (visibleSessions.length === 0 ? 1 : 0)));
      const nextVisibleSessions = safeSessions.filter((session) => isVisibleSession(session));

      if (sessionId === activeSessionId || !nextVisibleSessions.some((session) => session.id === activeSessionId)) {
        setActiveSessionId(nextVisibleSessions[0]?.id ?? safeSessions[0].id);
      }

      return safeSessions;
    });
  };

  const archiveSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const archivedAt = Date.now();
      const nextSessions = current.map((session) => (session.id === sessionId ? { ...session, archivedAt, updatedAt: archivedAt } : session));
      const visibleSessions = nextSessions.filter((session) => isVisibleSession(session));
      const safeSessions = visibleSessions.length > 0 ? nextSessions : [createSession(nextConversationNumber), ...nextSessions];
      if (visibleSessions.length === 0) setNextConversationNumber((count) => Math.max(count + 1, nextConversationNumber + 1));
      setHistoryTotalSessionCount((count) => Math.max(visibleSessions.length === 0 ? 1 : 0, count - 1 + (visibleSessions.length === 0 ? 1 : 0)));
      const nextVisibleSessions = safeSessions.filter((session) => isVisibleSession(session));
      if (sessionId === activeSessionId || !nextVisibleSessions.some((session) => session.id === activeSessionId)) {
        setActiveSessionId(nextVisibleSessions[0]?.id ?? safeSessions[0].id);
      }
      return safeSessions;
    });
  };

  const restoreArchivedSession = (sessionId: string) => {
    setSessions((current) => current.map((session) => (session.id === sessionId ? { ...session, archivedAt: undefined, updatedAt: Date.now() } : session)));
    setHistoryTotalSessionCount((count) => count + 1);
  };

  const archiveWorkflow = (workflowId: string) => {
    setOpenWorkflowMenuId("");
    const activeWorkflowCount = workflowItems.filter((item) => isVisibleWorkflow(item)).length;
    if (activeWorkflowCount <= 1) {
      showInputTip("至少保留一个工作流，无法归档");
      return;
    }
    setWorkflowItems((current) => {
      const archivedAt = Date.now();
      const next = ensureWorkflowItems(current.map((item) => item.id === workflowId ? { ...item, archivedAt, updatedAt: archivedAt } : item));
      const nextVisible = next.filter((item) => isVisibleWorkflow(item));
      setActiveWorkflowId((currentActiveId) => {
        if (currentActiveId !== workflowId && nextVisible.some((item) => item.id === currentActiveId)) return currentActiveId;
        return nextVisible[0]?.id ?? next[0]?.id ?? "";
      });
      return next;
    });
  };

  const restoreArchivedWorkflow = (workflowId: string) => {
    setWorkflowItems((current) => current.map((item) => (item.id === workflowId ? { ...item, archivedAt: undefined, updatedAt: Date.now() } : item)));
  };

  const appendAssistantMessage = useCallback((sessionId: string, payload: Partial<Message> & Pick<Message, "content">) => {
    const messageId = createClientId();
    const shouldTypeMessage = Boolean(payload.content.trim()) && payload.mode !== "image" && payload.mode !== "video" && payload.mode !== "audio" && !payload.error;
    if (shouldTypeMessage) {
      setActiveTypingMessageIds((current) => {
        const next = new Set(current);
        next.add(messageId);
        return next;
      });
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? payload.requestId && payload.mode !== "video" && session.messages.some((message) => message.role === "assistant" && message.requestId === payload.requestId)
            ? session
            : {
                ...session,
                updatedAt: Date.now(),
                messages: [
                  ...session.messages,
                  {
                    id: messageId,
                    role: "assistant",
                    content: payload.content,
                    suggestions: normalizeMessageSuggestions(payload.suggestions),
                    createdAt: Date.now(),
                    requestId: payload.requestId,
                    images: payload.images,
                    imageResultSlots: payload.imageResultSlots ?? (payload.mode === "image" && payload.pendingImageCount ? Array.from({ length: payload.pendingImageCount }).map(() => ({ type: "pending" as const, startedAt: Date.now() })) : undefined),
                    imageDimensions: payload.imageDimensions,
                    imagePrompts: payload.imagePrompts,
                    imageReferences: payload.imageReferences,
                    uploadedFiles: payload.uploadedFiles,
                    videoDimensions: payload.videoDimensions,
                    videoUrl: payload.videoUrl,
                    videos: payload.videos,
                    videoPrompts: payload.videoPrompts,
                    videoDimensionsMap: payload.videoDimensionsMap,
                    textModel: payload.textModel,
                    statusText: payload.statusText,
                    pendingImageCount: payload.pendingImageCount,
                    failedImageCount: payload.failedImageCount,
                    pendingVideoCount: payload.pendingVideoCount,
                    failedVideoCount: payload.failedVideoCount,
                    pendingAudioCount: payload.pendingAudioCount,
                    audios: payload.audios,
                    audioNames: payload.audioNames,
                    audioPrompts: payload.audioPrompts,
                    error: payload.error,
                    mode: payload.mode,
                    generationMeta: payload.generationMeta,
                    reasoning: payload.reasoning,
                    thinkMs: payload.thinkMs,
                  },
                ],
              }
          : session,
      ),
    );
    return messageId;
  }, []);

  const appendSystemMessage = useCallback((sessionId: string, payload: Pick<Message, "content"> & Partial<Pick<Message, "mode" | "error">>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: [
                ...session.messages,
                {
                  id: createClientId(),
                  role: "system",
                  content: payload.content,
                  mode: payload.mode,
                  error: payload.error,
                  createdAt: Date.now(),
                },
              ],
            }
          : session,
      ),
    );
  }, []);

  const updateAssistantMessageByRequestId = useCallback((sessionId: string, requestId: string, payload: Partial<Message>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      ...payload,
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const appendImagesToAssistantMessage = useCallback((sessionId: string, requestId: string, imageUrls: string[], imageDimensions: Record<string, ImageDimensions> = {}, pendingCompleteCount = 1, imagePrompts: Record<string, string> = {}, mediaSystemNames: Record<string, string> = {}, retryFailedIndex?: number, targetSlotIndex?: number, imagePromptDetails: Record<string, PromptDetail> = {}) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      images: message.retryingFailedImageIndexes?.length ? [...(message.images ?? []), ...imageUrls] : [...(message.images ?? []), ...imageUrls],
                      imageResultSlots: (() => {
                        const requestedCount = getRequestedImageDisplayCount(message) ?? Math.max(1, (message.images?.length ?? 0) + (message.failedImageCount ?? 0) + (message.pendingImageCount ?? 0));
                        const currentSlots = message.imageResultSlots ?? [
                          ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: message.failedImageCount ?? 0 }).map((_, index) => ({ type: "failed" as const, retryingStartedAt: message.retryingFailedImageStartedAt?.[index] })),
                          ...Array.from({ length: message.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: message.createdAt })),
                        ];
                        while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: message.createdAt });
                        let failedOrdinal = -1;
                        const replaceSlotIndex = targetSlotIndex ?? (retryFailedIndex === undefined
                          ? currentSlots.findIndex((slot) => slot.type === "pending" || (slot.type === "failed" && slot.retryingStartedAt))
                          : currentSlots.findIndex((slot) => {
                              if (slot.type !== "failed") return false;
                              failedOrdinal += 1;
                              return failedOrdinal === retryFailedIndex;
                            }));
                        if (replaceSlotIndex >= 0 && imageUrls[0]) {
                          return currentSlots.map((slot, index) => index === replaceSlotIndex ? { type: "image" as const, url: imageUrls[0] } : slot).slice(0, requestedCount);
                        }

                        return currentSlots.slice(0, requestedCount);
                      })(),
                      imageDimensions: { ...(message.imageDimensions ?? {}), ...imageDimensions },
                      imagePrompts: { ...(message.imagePrompts ?? {}), ...imagePrompts },
                      imagePromptDetails: { ...(message.imagePromptDetails ?? {}), ...imagePromptDetails },
                      mediaSystemNames: { ...(message.mediaSystemNames ?? {}), ...mediaSystemNames },
                      pendingImageCount: Math.max(0, (message.pendingImageCount ?? (message.retryingFailedImageIndexes?.length ? 0 : 1)) - pendingCompleteCount),
                      failedImageCount: message.retryingFailedImageIndexes?.length ? Math.max(0, (message.failedImageCount ?? 1) - pendingCompleteCount) : message.failedImageCount,
                      error: (() => {
                        const nextFailedCount = message.retryingFailedImageIndexes?.length ? Math.max(0, (message.failedImageCount ?? 1) - pendingCompleteCount) : (message.failedImageCount ?? 0);
                        return nextFailedCount > 0 ? message.error : undefined;
                      })(),
                      mediaErrorReasons: (() => {
                        const currentReasons = message.mediaErrorReasons ?? [];
                        if (currentReasons.length === 0) return undefined;
                        const nextFailedCount = message.retryingFailedImageIndexes?.length ? Math.max(0, (message.failedImageCount ?? 1) - pendingCompleteCount) : (message.failedImageCount ?? 0);
                        if (nextFailedCount <= 0) return undefined;
                        if (!message.retryingFailedImageIndexes?.length) return currentReasons;
                        const removeIndexes = new Set<number>();
                        if (retryFailedIndex !== undefined) {
                          removeIndexes.add(retryFailedIndex);
                        } else {
                          message.retryingFailedImageIndexes.slice(0, pendingCompleteCount).forEach((index) => removeIndexes.add(index));
                        }
                        const nextReasons = currentReasons.filter((_, index) => !removeIndexes.has(index));
                        return nextReasons.length > 0 ? nextReasons : undefined;
                      })(),
                      retryingFailedImageIndexes: message.retryingFailedImageIndexes?.slice(pendingCompleteCount),
                      retryingFailedImageStartedAt: message.retryingFailedImageIndexes?.slice(pendingCompleteCount).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedImageStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "image",
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const markAssistantImageFailure = useCallback((sessionId: string, requestId: string, retryFailedIndex?: number, errorMessage?: string, targetSlotIndex?: number) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      error: errorMessage ?? message.error,
                      failedImageCount: message.retryingFailedImageIndexes?.length ? message.failedImageCount : (message.failedImageCount ?? 0) + 1,
                      imageResultSlots: (() => {
                        const requestedCount = getRequestedImageDisplayCount(message) ?? Math.max(1, (message.images?.length ?? 0) + (message.failedImageCount ?? 0) + (message.pendingImageCount ?? 0));
                        const currentSlots = message.imageResultSlots ?? [
                          ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: message.failedImageCount ?? 0 }).map((_, index) => ({ type: "failed" as const, retryingStartedAt: message.retryingFailedImageStartedAt?.[index] })),
                          ...Array.from({ length: message.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: message.createdAt })),
                        ];
                        while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: message.createdAt });
                        let failedOrdinal = -1;
                        const failedSlotIndex = targetSlotIndex ?? (retryFailedIndex === undefined
                          ? currentSlots.findIndex((slot) => slot.type === "pending" || (slot.type === "failed" && slot.retryingStartedAt))
                          : currentSlots.findIndex((slot) => {
                              if (slot.type !== "failed") return false;
                              failedOrdinal += 1;
                              return failedOrdinal === retryFailedIndex;
                            }));
                        if (failedSlotIndex >= 0) {
                          return currentSlots.map((slot, index) => index === failedSlotIndex ? { type: "failed" as const, reason: errorMessage ?? GENERIC_MEDIA_ERROR_MESSAGE } : slot).slice(0, requestedCount);
                        }

                        return currentSlots.slice(0, requestedCount);
                      })(),
                      mediaErrorReasons: (() => {
                        const reason = errorMessage ?? GENERIC_MEDIA_ERROR_MESSAGE;
                        const currentReasons = message.mediaErrorReasons ?? [];
                        if (retryFailedIndex === undefined) return [...currentReasons, reason];
                        const nextReasons = [...currentReasons];
                        nextReasons[retryFailedIndex] = reason;
                        return nextReasons;
                      })(),
                      pendingImageCount: Math.max(0, (message.pendingImageCount ?? (message.retryingFailedImageIndexes?.length ? 0 : 1)) - 1),
                      retryingFailedImageIndexes: message.retryingFailedImageIndexes?.slice(1),
                      retryingFailedImageStartedAt: message.retryingFailedImageIndexes?.slice(1).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedImageStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "image",
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const finalizeAssistantImageFailures = useCallback((sessionId: string, requestId: string, failureCount: number, payload: Pick<Message, "content" | "mode"> & Partial<Pick<Message, "error" | "statusText" | "mediaErrorReasons">>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) => {
                if (message.role !== "assistant" || message.requestId !== requestId) return message;

                const requestedCount = getRequestedImageDisplayCount(message) ?? Math.max(1, (message.images?.length ?? 0) + failureCount);
                const currentSlots: ImageResultSlot[] = message.imageResultSlots ?? [
                  ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                  ...Array.from({ length: message.failedImageCount ?? 0 }).map(() => ({ type: "failed" as const })),
                  ...Array.from({ length: message.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: message.createdAt })),
                ];
                while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: message.createdAt });
                let remainingFailures = failureCount;
                const finalizedSlots = currentSlots.map((slot) => {
                  if (slot.type === "image") return slot;
                  const existingReason = slot.type === "failed" ? slot.reason : undefined;
                  if (remainingFailures <= 0) return slot.type === "failed" ? { type: "failed" as const, reason: existingReason } : slot;
                  remainingFailures -= 1;
                  return { type: "failed" as const, reason: existingReason };
                }).slice(0, requestedCount);

                return {
                  ...message,
                  ...payload,
                  pendingImageCount: 0,
                  failedImageCount: Math.max(message.failedImageCount ?? 0, failureCount),
                  imageResultSlots: finalizedSlots,
                  mediaErrorReasons: failureCount > 0 ? payload.mediaErrorReasons ?? message.mediaErrorReasons : undefined,
                  retryingFailedImageIndexes: undefined,
                  retryingFailedImageStartedAt: undefined,
                };
              }),
            }
          : session,
      ),
    );
  }, []);

  const appendVideoToAssistantMessage = useCallback((sessionId: string, requestId: string, videoUrl: string, prompt: string, mediaSystemName?: string, posterUrl?: string, promptDetail?: PromptDetail, realDimensions?: { width: number; height: number; durationSeconds?: number }) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      videoUrl: message.videoUrl ?? videoUrl,
                      videos: [...(message.videos ?? (message.videoUrl ? [message.videoUrl] : [])), videoUrl].filter((url, index, array) => array.indexOf(url) === index),
                      videoPrompts: { ...(message.videoPrompts ?? {}), [videoUrl]: prompt },
                      videoPromptDetails: promptDetail ? { ...(message.videoPromptDetails ?? {}), [videoUrl]: promptDetail } : message.videoPromptDetails,
                      videoPosters: posterUrl ? { ...(message.videoPosters ?? {}), [videoUrl]: posterUrl } : message.videoPosters,
                      // 本地存好、正式交付：撤掉一条"保存中"的远程预览，并给这条本地视频打"保存成功"闪现。
                      videoPreviewUrls: message.videoPreviewUrls?.length ? message.videoPreviewUrls.slice(1) : message.videoPreviewUrls,
                      videoSavedFlashAt: { ...(message.videoSavedFlashAt ?? {}), [videoUrl]: Date.now() },
                      mediaSystemNames: mediaSystemName ? { ...(message.mediaSystemNames ?? {}), [videoUrl]: mediaSystemName } : message.mediaSystemNames,
                      // ⭐ 服务端落地时下发的「真实视频尺寸/时长」，让卡片立刻显示真实比例/分辨率/时长（不用等播放自愈）。
                      videoDimensions: realDimensions?.width && realDimensions.height ? { width: realDimensions.width, height: realDimensions.height } : message.videoDimensions,
                      videoDurationSeconds: typeof realDimensions?.durationSeconds === "number" && realDimensions.durationSeconds > 0 ? realDimensions.durationSeconds : message.videoDurationSeconds,
                      pendingVideoCount: Math.max(0, (message.pendingVideoCount ?? (message.retryingFailedVideoIndexes?.length ? 0 : 1)) - 1),
                      failedVideoCount: message.retryingFailedVideoIndexes?.length ? Math.max(0, (message.failedVideoCount ?? 1) - 1) : message.failedVideoCount,
                      error: (() => {
                        const nextFailedCount = message.retryingFailedVideoIndexes?.length ? Math.max(0, (message.failedVideoCount ?? 1) - 1) : (message.failedVideoCount ?? 0);
                        return nextFailedCount > 0 ? message.error : undefined;
                      })(),
                      mediaErrorReasons: (() => {
                        const currentReasons = message.mediaErrorReasons ?? [];
                        if (currentReasons.length === 0) return undefined;
                        const nextFailedCount = message.retryingFailedVideoIndexes?.length ? Math.max(0, (message.failedVideoCount ?? 1) - 1) : (message.failedVideoCount ?? 0);
                        if (nextFailedCount <= 0) return undefined;
                        const retryIndex = message.retryingFailedVideoIndexes?.[0];
                        const nextReasons = retryIndex === undefined ? currentReasons : currentReasons.filter((_, index) => index !== retryIndex);
                        return nextReasons.length > 0 ? nextReasons : undefined;
                      })(),
                      retryingFailedVideoIndexes: message.retryingFailedVideoIndexes?.slice(1),
                      retryingFailedVideoStartedAt: message.retryingFailedVideoIndexes?.slice(1).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedVideoStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "video",
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  // 乐观显示：供应商已出视频（远程地址）但本地还在存盘时，把远程地址加进 videoPreviewUrls 让用户先看。
  // 展示专用、幂等（已在 videos 或已在 preview 里就不重复加）；本地存好后由 appendVideoToAssistantMessage 撤掉。
  const applyVideoPreviewToMessage = useCallback((sessionId: string, requestId: string, previewUrl: string) => {
    if (!previewUrl) return;
    setSessions((current) => {
      let changed = false;
      const next = current.map((session) => {
        if (session.id !== sessionId) return session;
        const messages = session.messages.map((message) => {
          if (message.role !== "assistant" || message.requestId !== requestId) return message;
          if (message.videos?.includes(previewUrl) || message.videoPreviewUrls?.includes(previewUrl)) return message;
          changed = true;
          return { ...message, videoPreviewUrls: [...(message.videoPreviewUrls ?? []), previewUrl], mode: "video" as const };
        });
        return changed ? { ...session, messages } : session;
      });
      return changed ? next : current;
    });
  }, []);

  const markAssistantVideoFailure = useCallback((sessionId: string, requestId: string, errorMessage?: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) => {
                if (message.role !== "assistant" || message.requestId !== requestId) return message;
                const isRetry = Boolean(message.retryingFailedVideoIndexes?.length);
                // M029：视频失败以前是无脑 failedVideoCount+1（图片是按 slot 下标幂等的，视频没有 slot）。
                // 于是「前台 while 轮询」和「后台 reconcile」对同一个 ${requestId}:video:${index} 双双收尾时，
                // 计数会变成 2（真实事故：失败卡显示两张、但 mediaErrorReasons 只有一条）。
                // 判据：非重试路径下，只有还剩「待生成」名额（pendingVideoCount>0）才是一次真正的收尾；
                // pending 已归 0 = 这个视频早被另一个收尾者处理过（成功或失败）→ 这次是重复收尾，整条不动。
                if (!isRetry && (message.pendingVideoCount ?? 1) <= 0) return message;
                return {
                      ...message,
                      error: errorMessage ?? message.error,
                      mediaErrorReasons: [...(message.mediaErrorReasons ?? []), errorMessage ?? GENERIC_MEDIA_ERROR_MESSAGE],
                      failedVideoCount: isRetry ? message.failedVideoCount : (message.failedVideoCount ?? 0) + 1,
                      pendingVideoCount: Math.max(0, (message.pendingVideoCount ?? (isRetry ? 0 : 1)) - 1),
                      // 失败也撤掉一条"保存中"预览（极少见：远程成功但本地一直存不下到 24h 过期）。
                      videoPreviewUrls: message.videoPreviewUrls?.length ? message.videoPreviewUrls.slice(1) : message.videoPreviewUrls,
                      retryingFailedVideoIndexes: message.retryingFailedVideoIndexes?.slice(1),
                      retryingFailedVideoStartedAt: message.retryingFailedVideoIndexes?.slice(1).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedVideoStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "video",
                    };
              }),
            }
          : session,
      ),
    );
  }, []);

  const updateMessageImageDimensions = useCallback((sessionId: string, messageId: string, imageUrl: string, dimensions: ImageDimensions) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: session.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      imageDimensions: { ...(message.imageDimensions ?? {}), [imageUrl]: dimensions },
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const updateMessageVideoDimensions = useCallback((sessionId: string, messageId: string, dimensions: ImageDimensions) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: session.messages.map((message) => (message.id === messageId ? { ...message, videoDimensions: dimensions } : message)),
            }
          : session,
      ),
    );
  }, []);


  const updatePendingRequest = useCallback((sessionId: string, requestId: string, payload: Partial<PendingGeneration>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId && getSessionPendingRequests(session).some((request) => request.id === requestId)
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: getSessionPendingRequests(session).map((request) => (request.id === requestId ? { ...request, ...payload } : request)),
            }
          : session,
      ),
    );
  }, []);

  const addGeneratedAssets = useCallback((sessionId: string, mode: WorkMode, sourcePrompt: string, urls: string[], messageId?: string, assetTargetType?: AssetTargetType, contextText = "", mediaSystemNames: Record<string, string> = {}, mediaPosterUrls: Record<string, string> = {}, mediaPromptDetails: Record<string, PromptDetail> = {}) => {
    if (urls.length === 0) return;

    const namingText = [sourcePrompt, contextText].filter(Boolean).join("\n");
    const type = mode === "audio" ? "other" : getAssetTypeFromText(namingText || sourcePrompt, mode, assetTargetType);
    const mediaType = mode === "audio" ? "audio" as const : undefined;
    const simulatedAssets = [...assets];
    const itemsToPersist: Array<{ url: string; name: string; posterUrl?: string }> = [];
    urls.forEach((url) => {
      if (!url || simulatedAssets.some((asset) => asset.url === url)) return;
      const systemName = mediaSystemNames[url] || getConversationAssetName(mode, simulatedAssets);
      if (!isRemoteMediaUrl(url)) itemsToPersist.push({ url, name: systemName, posterUrl: mediaPosterUrls[url] });
      simulatedAssets.unshift({ id: url, type, mediaType, name: systemName, systemName, url, posterUrl: mediaPosterUrls[url], librarySource: "conversation", sourcePrompt: namingText || sourcePrompt, promptSource: "generated", sessionId, messageId, createdAt: Date.now() });
    });
    const addedAssetCount = simulatedAssets.length - assets.length;

    setAssets((current) => {
      let nextAssets = current;

      urls.forEach((url) => {
        if (!url || nextAssets.some((asset) => asset.url === url)) return;

        const systemName = mediaSystemNames[url] || getConversationAssetName(mode, nextAssets);
        const name = systemName;
        nextAssets = [
          {
            id: createClientId(),
            type,
            mediaType,
            name,
            systemName,
            url,
            posterUrl: mediaPosterUrls[url],
            librarySource: "conversation",
            sourcePrompt: namingText || sourcePrompt,
            promptSource: "generated",
            sessionId,
            messageId,
            createdAt: Date.now(),
          },
          ...nextAssets,
        ];
      });

      return nextAssets;
    });
    const generatedFilter: AssetFilter = mode === "audio"
      ? "conversation_audios"
      : type === "character_image" || type === "scene_image" || type === "prop_image" || type === "shot_image"
      ? type
      : mode === "video" ? "conversation_videos" : "conversation_images";
    if (addedAssetCount > 0) adjustAssetCounts([{ filter: generatedFilter, delta: addedAssetCount }]);
    if (workspaceStorageMode === "user") {
      itemsToPersist.forEach((item) => {
        const promptDetail = mediaPromptDetails[item.url];
        void fetch("/api/media-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            name: item.name,
            currentCategory: mode === "audio" ? "conversation_audios" : mode === "video" ? "conversation_videos" : "conversation_images",
            mediaType: mode === "audio" ? "audio" : mode === "video" ? "video" : "image",
            posterUrl: item.posterUrl,
            sourcePrompt: promptDetail?.prompt || namingText || sourcePrompt,
            sourceDetail: getPromptSourceDetail(promptDetail),
            promptSource: "generated",
            conversationId: sessionId,
            messageId,
          }),
        }).catch((error) => console.warn("[media-assets] failed to persist conversation generated asset", error));
      });
    }
  }, [adjustAssetCounts, assets, workspaceStorageMode]);

  const addUploadedImagesToAssets = useCallback((sessionId: string, images: UploadedImage[], contextText: string) => {
    if (images.length === 0) return;
    void contextText;

    const simulatedAssets = [...assets];
    const itemsToPersist: Array<{ url: string; name: string; contentHash?: string }> = [];
    images.forEach((image) => {
      if (!image.url || simulatedAssets.some((asset) => asset.url === image.url)) return;
      const baseName = getUploadedImageReferenceName(image, images);
      const name = getUniqueUploadedAssetName(baseName, simulatedAssets, image.url);
      itemsToPersist.push({ url: image.url, name, contentHash: image.contentHash });
      simulatedAssets.unshift({ id: image.url, type: "other", name, systemName: name, url: image.url, librarySource: "conversation", sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload", sessionId, lockedType: true, createdAt: Date.now() });
    });
    const addedAssetCount = simulatedAssets.length - assets.length;

    setAssets((current) => {
      let nextAssets = current;

      images.forEach((image) => {
        if (!image.url || nextAssets.some((asset) => asset.url === image.url)) return;

        const baseName = getUploadedImageReferenceName(image, images);
        const name = getUniqueUploadedAssetName(baseName, nextAssets, image.url);

        nextAssets = [
          {
            id: createClientId(),
            type: "other",
            name,
            systemName: name,
            url: image.url,
            librarySource: "conversation",
            sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
            promptSource: "upload",
            sessionId,
            lockedType: true,
            createdAt: Date.now(),
          },
          ...nextAssets,
        ];
      });

      return nextAssets;
    });
    if (addedAssetCount > 0) adjustAssetCounts([{ filter: "conversation_uploads", delta: addedAssetCount }]);
    if (workspaceStorageMode === "user") {
      itemsToPersist.forEach((item) => {
        void fetch("/api/media-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            name: item.name,
            currentCategory: "conversation_uploads",
            mediaType: "image",
            sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
            promptSource: "upload",
            conversationId: sessionId,
            contentHash: item.contentHash,
          }),
        }).catch((error) => console.warn("[media-assets] failed to persist conversation uploaded asset", error));
      });
    }
  }, [adjustAssetCounts, assets, workspaceStorageMode]);

  const addWorkflowGeneratedAssets = useCallback((workflowId: string, nodeId: string, media: { kind: "image" | "video"; urls: string[]; reservedNames?: string[]; posterUrl?: string; sourcePrompt: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: Record<string, ImageDimensions>; durationSeconds?: Record<string, number>; silent?: boolean; promptOptimization?: { originalPrompt: string; optimizedPrompt: string; attemptsUsed: number; optimizerModel: string } }) => {
    const cleanUrls = media.urls.filter((url) => url && !url.startsWith("data:"));
    if (cleanUrls.length === 0) return;
    const workflow = workflowItems.find((item) => item.id === workflowId);
    if (!workflow) return;
    const newlyGeneratedCount = media.silent ? 0 : cleanUrls.filter((url) => !assets.some((asset) => isWorkflowAsset(asset) && normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(url))).length;
    if (!media.silent) notifyGenerationCompleteOnce(`workflow:${nodeId}:${cleanUrls[0]}`, media.kind === "video" ? "视频生成已完成" : "图片生成已完成");
    const serverNames = Object.fromEntries(cleanUrls.map((url, index) => [url, media.reservedNames?.[index]]).filter((item): item is [string, string] => Boolean(item[1])));
    const reserved = Object.keys(serverNames).length === cleanUrls.length ? { names: serverNames, workflows: workflowItems } : reserveWorkflowMediaSystemNamesForItems(workflowItems, assets, workflowId, media.kind, cleanUrls);
    if (reserved.workflows !== workflowItems) {
      const reservedWorkflow = reserved.workflows.find((item) => item.id === workflowId);
      if (reservedWorkflow) {
        setWorkflowItems((current) => current.map((item) => item.id === workflowId ? {
          ...item,
          workflowCode: reservedWorkflow.workflowCode,
          nextImageNumber: Math.max(item.nextImageNumber ?? 1, reservedWorkflow.nextImageNumber ?? 1),
          nextVideoNumber: Math.max(item.nextVideoNumber ?? 1, reservedWorkflow.nextVideoNumber ?? 1),
        } : item));
      }
    }

    const items = cleanUrls.map((url) => {
      const name = reserved.names[url] ?? (media.kind === "video" ? "视频生成" : "图片生成");
      const dimensions = media.dimensions?.[url];
      const durationSeconds = media.durationSeconds?.[url];
      const displayRatio = dimensions ? getCommonRatioLabel(dimensions.width, dimensions.height) : media.ratio || "-";
      const previewMeta: PreviewMediaMeta = media.kind === "video"
        ? { modelLabel: media.model ? getGenerationModelLabel("video", media.model) : "-", ratio: displayRatio, sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: media.resolution || "-", mode: "video", duration: media.duration }
        : { modelLabel: media.model ? getGenerationModelLabel("image", media.model) : "-", ratio: displayRatio, sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: media.resolution || "-", mode: "image" };
      return { url, name, dimensions, durationSeconds, previewMeta };
    });

    const systemNamesByUrl = Object.fromEntries(items.map((item) => [item.url, item.name]));
    setWorkflowItems((current) => current.map((workflow) => {
      if (workflow.id !== workflowId || !workflow.canvas?.nodes?.length) return workflow;
      // 已计数集合是唯一去重权威(随 canvasJson 持久化)：并发双收尾都跑进这个函数式更新里、串行看到彼此结果，
      // 不再依赖外层可能过期的 assets 闭包，故同一 URL 只会计一次。
      const seed = getWorkflowGeneratedMediaUrls(workflow);
      const hasCountedSet = Array.isArray(workflow.canvas.countedGeneratedUrls);
      const countedSet = new Set(hasCountedSet ? workflow.canvas.countedGeneratedUrls : [...seed.images, ...seed.videos]);
      // 旧数据没有已计数集合时，累计基数按当前真实节点重新播种(忽略可能被旧 bug 累加虚高的历史值)，让计数自愈为真实值。
      const baseCounts = hasCountedSet && workflow.canvas.generatedMediaCounts
        ? workflow.canvas.generatedMediaCounts
        : { images: new Set(seed.images).size, videos: new Set(seed.videos).size };
      const freshUrls = media.silent
        ? []
        : cleanUrls.map((url) => normalizeMediaUrlForMatch(url)).filter((url) => !countedSet.has(url));
      freshUrls.forEach((url) => countedSet.add(url));
      const increment = freshUrls.length;
      const nextCounts = {
        images: baseCounts.images + (media.kind === "image" ? increment : 0),
        videos: baseCounts.videos + (media.kind === "video" ? increment : 0),
      };
      return {
        ...workflow,
        canvas: {
          ...workflow.canvas,
          generatedMediaCounts: nextCounts,
          countedGeneratedUrls: Array.from(countedSet),
          nodes: workflow.canvas.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, mediaSystemNames: { ...(node.data.mediaSystemNames ?? {}), ...systemNamesByUrl } } } : node),
        },
      };
    }));

    setAssets((current) => {
      let next = current;
      items.forEach((item) => {
        const existingIndex = next.findIndex((asset) => normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(item.url) && isWorkflowAsset(asset));
        if (existingIndex >= 0) {
          next = next.map((asset, index) => index === existingIndex ? { ...asset, name: item.name, systemName: item.name, userName: undefined, sourcePrompt: media.sourcePrompt, previewMeta: item.previewMeta, workflowId, workflowNodeId: nodeId } : asset);
          return;
        }
        next = [{
          id: createClientId(),
          type: media.kind === "video" ? "shot_video" : "other",
          name: item.name,
          systemName: item.name,
          url: item.url,
          posterUrl: media.kind === "video" ? media.posterUrl : undefined,
          librarySource: "workflow",
          sourcePrompt: media.sourcePrompt,
          promptSource: "generated",
          previewMeta: item.previewMeta,
          sessionId: workflowId,
          workflowId,
          workflowNodeId: nodeId,
          lockedType: true,
          createdAt: Date.now(),
        }, ...next];
      });
      return next;
    });
    if (newlyGeneratedCount > 0) adjustAssetCounts([{ filter: media.kind === "video" ? "workflow_videos" : "workflow_images", delta: newlyGeneratedCount }]);

    if (workspaceStorageMode === "user") {
      items.forEach((item) => {
        if (isRemoteMediaUrl(item.url)) return;
        void fetch("/api/media-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            name: item.name,
            currentCategory: media.kind === "video" ? "workflow_videos" : "workflow_images",
            mediaType: media.kind,
            posterUrl: media.kind === "video" ? media.posterUrl : undefined,
            dimensions: item.dimensions,
            durationSeconds: item.durationSeconds,
            sourcePrompt: media.sourcePrompt,
            sourceDetail: media.promptOptimization ? JSON.stringify({ promptOptimization: media.promptOptimization }) : undefined,
            promptSource: "generated",
            workflowId,
            workflowNodeId: nodeId,
            model: media.model,
            settings: { ratio: media.ratio, resolution: media.resolution, duration: media.duration },
          }),
        }).then(() => loadWorkspaceAssets(true, media.kind === "video" ? "workflow_videos" : "workflow_images", 0, "auto")).catch((error) => console.warn("[media-assets] failed to persist workflow generated asset", error));
        if (media.kind === "image" && media.promptOptimization) {
          void fetch("/api/workflow-prompt-optimization/cases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workflowId,
              workflowNodeId: nodeId,
              imageUrl: item.url,
              sourceModel: media.model,
              optimizerModel: media.promptOptimization.optimizerModel,
              attemptsUsed: media.promptOptimization.attemptsUsed,
              originalPrompt: media.promptOptimization.originalPrompt,
              optimizedPrompt: media.promptOptimization.optimizedPrompt,
            }),
          }).catch((error) => console.warn("[prompt-optimization] failed to record case", error));
        }
      });
    }
  }, [adjustAssetCounts, assets, loadWorkspaceAssets, notifyGenerationCompleteOnce, workflowItems, workspaceStorageMode]);

  const reserveMediaSystemNames = useCallback((sessionId: string, mode: WorkMode, urls: string[]) => {
    const cleanUrls = urls.filter((url) => url && !url.startsWith("data:"));
    const result: Record<string, string> = {};
    if (cleanUrls.length === 0) return result;

    const currentSession = sessionsRef.current.find((session) => session.id === sessionId);
    const conversationCode = currentSession?.conversationCode || "d0";
    let nextImageNumber = Math.max(1, Math.floor(currentSession?.nextImageNumber ?? 1));
    let nextVideoNumber = Math.max(1, Math.floor(currentSession?.nextVideoNumber ?? 1));
    let nextAudioNumber = Math.max(1, Math.floor(currentSession?.nextAudioNumber ?? 1));
    const existingNames = new Map<string, string>();
    const usedSystemNames = new Set<string>();
    currentSession?.messages.forEach((message) => {
      Object.entries({ ...(message.mediaSystemNames ?? {}), ...(message.audioNames ?? {}) }).forEach(([url, systemName]) => {
        if (!systemName) return;
        usedSystemNames.add(systemName);
        const imageNumber = Number(systemName.match(/^image_(\d+)_d\d+$/)?.[1]);
        const videoNumber = Number(systemName.match(/^video_(\d+)_d\d+$/)?.[1]);
        const audioNumber = Number(systemName.match(/^audio_(\d+)_d\d+$/)?.[1]);
        if (Number.isFinite(imageNumber)) nextImageNumber = Math.max(nextImageNumber, imageNumber + 1);
        if (Number.isFinite(videoNumber)) nextVideoNumber = Math.max(nextVideoNumber, videoNumber + 1);
        if (Number.isFinite(audioNumber)) nextAudioNumber = Math.max(nextAudioNumber, audioNumber + 1);
        if (url) existingNames.set(normalizeMediaUrlForMatch(url), systemName);
      });
    });

    cleanUrls.forEach((url) => {
      const key = normalizeMediaUrlForMatch(url);
      const existingName = existingNames.get(key);
      if (existingName) {
        result[url] = existingName;
        return;
      }

      if (mode === "audio") {
        while (usedSystemNames.has(buildConversationMediaSystemName("audio", nextAudioNumber, conversationCode))) nextAudioNumber += 1;
        result[url] = buildConversationMediaSystemName("audio", nextAudioNumber, conversationCode);
        usedSystemNames.add(result[url]);
        nextAudioNumber += 1;
      } else if (mode === "video") {
        while (usedSystemNames.has(buildConversationMediaSystemName("video", nextVideoNumber, conversationCode))) nextVideoNumber += 1;
        result[url] = buildConversationMediaSystemName("video", nextVideoNumber, conversationCode);
        usedSystemNames.add(result[url]);
        nextVideoNumber += 1;
      } else {
        while (usedSystemNames.has(buildConversationMediaSystemName("image", nextImageNumber, conversationCode))) nextImageNumber += 1;
        result[url] = buildConversationMediaSystemName("image", nextImageNumber, conversationCode);
        usedSystemNames.add(result[url]);
        nextImageNumber += 1;
      }
    });

    sessionsRef.current = sessionsRef.current.map((session) => session.id === sessionId ? { ...session, nextImageNumber, nextVideoNumber, nextAudioNumber } : session);
    setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, nextImageNumber: Math.max(nextImageNumber, session.nextImageNumber ?? 1), nextVideoNumber: Math.max(nextVideoNumber, session.nextVideoNumber ?? 1), nextAudioNumber: Math.max(nextAudioNumber, session.nextAudioNumber ?? 1) } : session));

    return result;
  }, []);

  const clearPendingRequest = useCallback((sessionId: string, requestId: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId && getSessionPendingRequests(session).some((request) => request.id === requestId)
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: getSessionPendingRequests(session).filter((request) => request.id !== requestId),
            }
          : session,
      ),
    );
  }, []);

  const reconciledConversationImageJobsRef = useRef<Set<string>>(new Set());
  const reconciledConversationVideoJobsRef = useRef<Set<string>>(new Set());
  const [recoveryTick, setRecoveryTick] = useState(0);

  // Re-run conversation media recovery when a suspended/background tab becomes visible again (close browser
  // then reopen, switch away and back). Without this the reconcile effects below only re-run when `sessions`
  // change, so a resumed tab could keep showing a waiting card for an already-finished backend job.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      reconciledConversationImageJobsRef.current.clear();
      reconciledConversationVideoJobsRef.current.clear();
      setRecoveryTick((tick) => tick + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    type ConversationImageJobStatus = { requestId: string; status: string; resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta; error?: string; errorCode?: string };
    const jobsToCheck = sessions.flatMap((session) => session.messages.flatMap((message) => {
      if (message.role !== "assistant" || message.mode !== "image" || !message.requestId || (message.pendingImageCount ?? 0) <= 0) return [];
      // Skip requests still being polled by the foreground generator; otherwise both this recovery effect and
      // the foreground poller call markAssistantImageFailure for the same slot and failedImageCount double-counts
      // (inflated count / duplicate error reason / possible extra failed card). Recovery is a backstop only for
      // orphaned jobs (closed/refreshed browser → no foreground poller). Mirrors the conversation-video guard.
      if (runningRequestIdsRef.current.has(message.requestId)) return [];
      const requestedCount = getRequestedImageDisplayCount(message) ?? Math.max(1, (message.images?.length ?? 0) + (message.failedImageCount ?? 0) + (message.pendingImageCount ?? 0));
      const slots = message.imageResultSlots ?? [
        ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
        ...Array.from({ length: message.failedImageCount ?? 0 }).map(() => ({ type: "failed" as const })),
        ...Array.from({ length: message.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: message.createdAt })),
      ];
      return Array.from({ length: requestedCount }).flatMap((_, index) => {
        if (slots[index]?.type !== "pending") return [];
        const imageRequestId = `${message.requestId}:image:${index}`;
        const key = `${session.id}:${message.requestId}:${index}`;
        if (reconciledConversationImageJobsRef.current.has(key)) return [];
        return [{ key, sessionId: session.id, message, index, imageRequestId }];
      });
    }));
    if (jobsToCheck.length === 0) return;
    jobsToCheck.forEach((job) => reconciledConversationImageJobsRef.current.add(job.key));
    let cancelled = false;
    let timer: number | undefined;
    const releaseKeys = () => jobsToCheck.forEach((job) => reconciledConversationImageJobsRef.current.delete(job.key));
    const checkJobs = () => {
      void fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestIds: jobsToCheck.map((job) => job.imageRequestId) }) })
        .then((response) => readJson<{ jobs?: ConversationImageJobStatus[] }>(response))
        .then((data) => {
        if (cancelled) return;
        let stillRunning = false;
        const jobByRequestId = new Map((data.jobs ?? []).map((job) => [job.requestId, job]));
        for (const pending of jobsToCheck) {
          const job = jobByRequestId.get(pending.imageRequestId);
          if (!job || job.status === "queued" || job.status === "running") {
            stillRunning = true;
            continue;
          }
          reconciledConversationImageJobsRef.current.delete(pending.key);
          if (job.status === "failed") {
            markAssistantImageFailure(pending.sessionId, pending.message.requestId ?? "", undefined, getApiErrorMessageWithCode({ error: job.error, errorCode: job.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE), pending.index);
            continue;
          }
          if (job.status !== "succeeded") continue;
          const images = Array.isArray(job.resultUrls) ? job.resultUrls.filter(Boolean) : [];
          if (images.length === 0) {
            markAssistantImageFailure(pending.sessionId, pending.message.requestId ?? "", undefined, GENERIC_MEDIA_ERROR_MESSAGE, pending.index);
            continue;
          }
          const imageDimensions = Object.fromEntries(images.map((url) => [url, job.resultDimensions?.[url]]).filter((item): item is [string, ImageDimensions] => Boolean(item[1])));
          const imagePrompts = Object.fromEntries(images.map((url) => [url, pending.message.content]));
          const serverNames = Object.fromEntries(images.map((url, index) => [url, job.reservedNames?.[index]]).filter((item): item is [string, string] => Boolean(item[1])));
          const mediaSystemNames = Object.keys(serverNames).length === images.length ? serverNames : reserveMediaSystemNames(pending.sessionId, "image", images);
          addSessionUsage(pending.sessionId, job.usage);
          applyCreditResult(pending.sessionId, job.credit);
          appendImagesToAssistantMessage(pending.sessionId, pending.message.requestId ?? "", images, imageDimensions, 1, imagePrompts, mediaSystemNames, undefined, pending.index);
          addSessionGeneratedMediaCount(pending.sessionId, images.length, 0);
        }
        if (stillRunning && !cancelled) timer = window.setTimeout(checkJobs, 3000);
      })
      .catch(() => { if (!cancelled) timer = window.setTimeout(checkJobs, 3000); });
    };
    checkJobs();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); releaseKeys(); };
  }, [addSessionGeneratedMediaCount, addSessionUsage, appendImagesToAssistantMessage, applyCreditResult, markAssistantImageFailure, reserveMediaSystemNames, sessions, recoveryTick]);

  // Conversation-video durable recovery (mirrors the image reconcile). If a video message is still waiting
  // (pendingVideoCount > 0) but the backend job already finished, align it to the job result / failure and
  // keep polling while it runs — so a closed/refreshed browser never leaves a permanent waiting card.
  useEffect(() => {
    type ConversationVideoJobStatus = { requestId: string; status: string; resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, { width: number; height: number; durationSeconds?: number }>; posterUrl?: string; usage?: UsageMeta; credit?: CreditMeta; error?: string; errorCode?: string; extra?: { preview?: { videoUrl?: string } } };
    const jobsToCheck = sessions.flatMap((session) => session.messages.flatMap((message) => {
      if (message.role !== "assistant" || message.mode !== "video" || !message.requestId || (message.pendingVideoCount ?? 0) <= 0) return [];
      // Skip requests that are still being polled by the foreground generator (createAndPollVideo);
      // otherwise both this recovery effect and the foreground poller mark the same failed job and
      // markAssistantVideoFailure double-counts (producing two failed cards). This effect is a
      // recovery backstop only for orphaned jobs (closed/refreshed browser → no foreground poller).
      if (runningRequestIdsRef.current.has(message.requestId)) return [];
      const count = Math.max(1, message.pendingVideoCount ?? 1);
      return Array.from({ length: count }).flatMap((_, index) => {
        const videoRequestId = `${message.requestId}:video:${index}`;
        const key = `${session.id}:${videoRequestId}`;
        if (reconciledConversationVideoJobsRef.current.has(key)) return [];
        return [{ key, sessionId: session.id, message, videoRequestId }];
      });
    }));
    if (jobsToCheck.length === 0) return;
    jobsToCheck.forEach((job) => reconciledConversationVideoJobsRef.current.add(job.key));
    let cancelled = false;
    let timer: number | undefined;
    const checkJobs = () => {
      void fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestIds: jobsToCheck.map((job) => job.videoRequestId) }) })
        .then((response) => readJson<{ jobs?: ConversationVideoJobStatus[] }>(response))
        .then((data) => {
          if (cancelled) return;
          let stillRunning = false;
          const jobByRequestId = new Map((data.jobs ?? []).map((job) => [job.requestId, job]));
          for (const pending of jobsToCheck) {
            const job = jobByRequestId.get(pending.videoRequestId);
            if (!job || job.status === "queued" || job.status === "running") {
              stillRunning = true;
              // 乐观显示：还在跑但供应商已给可直接播的远程地址 → 先让用户看，本地后台继续存。
              const previewUrl = job?.extra?.preview?.videoUrl;
              if (previewUrl) applyVideoPreviewToMessage(pending.sessionId, pending.message.requestId ?? "", previewUrl);
              continue;
            }
            reconciledConversationVideoJobsRef.current.delete(pending.key);
            const status = (job.status ?? "").toLowerCase();
            if (["failed", "error", "expired"].includes(status)) {
              addSessionUsage(pending.sessionId, job.usage);
              markAssistantVideoFailure(pending.sessionId, pending.message.requestId ?? "", getApiErrorMessageWithCode({ error: job.error, errorCode: job.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE));
              continue;
            }
            if (!["succeeded", "success", "completed", "complete", "done"].includes(status)) continue;
            const videoUrl = job.resultUrls?.find(Boolean);
            if (!videoUrl) { markAssistantVideoFailure(pending.sessionId, pending.message.requestId ?? "", "视频生成完成但缺少视频链接"); continue; }
            addSessionUsage(pending.sessionId, job.usage);
            applyCreditResult(pending.sessionId, job.credit);
            const mediaSystemNames = job.reservedNames?.[0] ? { [videoUrl]: job.reservedNames[0] } : reserveMediaSystemNames(pending.sessionId, "video", [videoUrl]);
            appendVideoToAssistantMessage(pending.sessionId, pending.message.requestId ?? "", videoUrl, pending.message.content, mediaSystemNames[videoUrl], job.posterUrl, undefined, job.resultDimensions?.[videoUrl]);
            addGeneratedAssets(pending.sessionId, "video", pending.message.content, [videoUrl], undefined, undefined, pending.message.content, mediaSystemNames, job.posterUrl ? { [videoUrl]: job.posterUrl } : {}, {});
            addSessionGeneratedMediaCount(pending.sessionId, 0, 1);
          }
          if (stillRunning && !cancelled) timer = window.setTimeout(checkJobs, 3000);
        })
        .catch(() => { if (!cancelled) timer = window.setTimeout(checkJobs, 3000); });
    };
    checkJobs();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); jobsToCheck.forEach((job) => reconciledConversationVideoJobsRef.current.delete(job.key)); };
  }, [addGeneratedAssets, addSessionGeneratedMediaCount, addSessionUsage, appendVideoToAssistantMessage, applyVideoPreviewToMessage, applyCreditResult, markAssistantVideoFailure, reserveMediaSystemNames, sessions, recoveryTick]);

  const runGeneration = useCallback(async (sessionId: string, pendingRequest: PendingGeneration) => {
    if (runningRequestIdsRef.current.has(pendingRequest.id)) return;
    // 提交生成后尽快把状态落库（下一次保存改为立即），缩短"点完就关"导致状态没保存的窗口。
    flushNextWorkspaceSaveRef.current = true;

    runningRequestIdsRef.current.add(pendingRequest.id);
    const abortController = new AbortController();
    requestAbortControllersRef.current.set(pendingRequest.id, abortController);
    try {
      if (pendingRequest.needsIntentResolution) {
        const sourceText = pendingRequest.sourceText ?? pendingRequest.messages[pendingRequest.messages.length - 1]?.content ?? "";
        const conversationTitle = sessions.find((session) => session.id === sessionId)?.title;
        const agentChatModels = pendingRequest.mode === "agent"
          ? (pendingRequest.agentChatModelChain?.length ? pendingRequest.agentChatModelChain : [pendingRequest.model])
          : [pendingRequest.model];
        const shouldRetryAgentChat = (error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return false;
          const message = error instanceof Error ? error.message : String(error);
          return !message.includes("不符合平台规则");
        };
        let plan: AgentPlanResponse | undefined;
        let lastPlanError: unknown;
        const planStartedAt = Date.now();
        for (const chatModel of agentChatModels) {
          try {
            plan = await fetch("/api/agent-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: abortController.signal,
              body: JSON.stringify({
                model: chatModel,
                mode: pendingRequest.mode === "general" ? "general" : "agent",
                messages: pendingRequest.messages,
                conversationId: sessionId,
                conversationTitle,
                requestId: pendingRequest.id,
              }),
            }).then((response) => readJson<AgentPlanResponse>(response));
            pendingRequest = { ...pendingRequest, model: chatModel as ModelName };
            break;
          } catch (error) {
            lastPlanError = error;
            if (!shouldRetryAgentChat(error)) throw error;
          }
        }
        if (!plan) throw lastPlanError instanceof Error ? lastPlanError : new Error("连接不到模型，请联系管理员！");
        const remainThinkingMs = MIN_AGENT_THINKING_MS - (Date.now() - planStartedAt);
        if (remainThinkingMs > 0) await new Promise((resolve) => window.setTimeout(resolve, remainThinkingMs));
        addSessionUsage(sessionId, plan.usage);
        applyCreditResult(sessionId, plan.credit);

        if (plan.needsClarification || plan.intent === "clarify") {
          const forceImage = pendingRequest.assetTargetType && pendingRequest.assetTargetType !== "other" && pendingRequest.assetTargetType !== "shot_video" || isExplicitImageGenerationRequest(sourceText);
          const forceVideo = pendingRequest.assetTargetType === "shot_video" || isExplicitVideoGenerationRequest(sourceText);
          if (!forceImage && !forceVideo) {
          appendAssistantMessage(sessionId, {
            content: plan.clarifyQuestion?.trim() || "我需要再确认一下你的目标：你想让我继续聊创意、生成图片，还是生成视频？",
            suggestions: plan.suggestions,
            mode: pendingRequest.mode === "general" ? "general" : "agent",
            requestId: pendingRequest.id,
            textModel: pendingRequest.mode === "general" ? pendingRequest.model : undefined,
          });
          return;
          }
          plan = { ...plan, intent: forceVideo ? "video" : "image", needsClarification: false };
        }
        if (plan.intent === "chat") {
          if (pendingRequest.assetTargetType === "shot_video" || isExplicitVideoGenerationRequest(sourceText)) {
            plan = { ...plan, intent: "video" };
          } else if (pendingRequest.assetTargetType && pendingRequest.assetTargetType !== "other" || isExplicitImageGenerationRequest(sourceText)) {
            plan = { ...plan, intent: "image" };
          }
        }

        const generationMode: WorkMode = plan.intent === "image" || plan.intent === "video" ? plan.intent : pendingRequest.mode === "general" ? "general" : "agent";
        let availableMediaModels = enabledGenerationModelIds;
        if (generationMode === "image" || generationMode === "video") {
          try {
            const response = await fetch("/api/model-availability", { cache: "no-store" });
            const data = (await response.json()) as { imageModels?: string[]; videoModels?: string[]; audioModels?: string[]; agentImageModels?: string[]; agentVideoModels?: string[] };
            const conversationModels = {
              image: Array.isArray(data.imageModels) ? data.imageModels : [],
              video: Array.isArray(data.videoModels) ? data.videoModels : [],
              audio: Array.isArray(data.audioModels) ? data.audioModels : audioGenerationModels.map((model) => model.id),
            };
            availableMediaModels = conversationModels;
            setEnabledGenerationModelIds(conversationModels);
          } catch {}

          if (availableMediaModels[generationMode].length === 0) {
            appendSystemMessage(sessionId, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: generationMode });
            return;
          }
        }
        const generationModel = (generationMode === "image" || generationMode === "video") && (pendingRequest.mode === "general" || pendingRequest.mode === "agent")
          ? pendingRequest.generalPreferenceAuto === false && availableMediaModels[generationMode].includes(pendingRequest.selectedMediaModels?.[generationMode] ?? "")
            ? pendingRequest.selectedMediaModels?.[generationMode] as ModelName
            : (availableMediaModels[generationMode][0] as ModelName)
          : pendingRequest.mode === "general" || pendingRequest.mode === "agent"
          ? pendingRequest.model
          : getAgentGenerationModel(agentModelTier, generationMode, selectedGenerationModels, { sourceText, session: sessions.find((session) => session.id === sessionId), feedbackLogs, enabledModels: availableMediaModels, fallbackModels: enabledGenerationModelIds });
        const plannedSettings = getAgentGenerationSettingsFromPlan(plan, sourceText, generationMode, generationModel);
        const agentSettings = (pendingRequest.mode === "general" || pendingRequest.mode === "agent") && pendingRequest.generalPreferenceAuto === false && pendingRequest.generalMediaSettings && (generationMode === "image" || generationMode === "video")
          ? generationMode === "image"
            ? {
                ...plannedSettings,
                ratio: normalizeImageRatioForModel(generationModel, pendingRequest.generalMediaSettings.imageRatio),
                resolution: normalizeImageResolutionForModel(generationModel, pendingRequest.generalMediaSettings.imageResolution),
              }
            : {
                ...plannedSettings,
                ratio: pendingRequest.generalMediaSettings.videoRatio === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(generationModel, pendingRequest.generalMediaSettings.videoRatio, pendingRequest.generalMediaSettings.videoResolution),
                resolution: pendingRequest.generalMediaSettings.videoRatio === "智能比例" ? "720p" : normalizeVideoResolutionForModel(generationModel, pendingRequest.generalMediaSettings.videoResolution),
                duration: pendingRequest.generalMediaSettings.videoDuration && getVideoDurationOptions(generationModel).includes(pendingRequest.generalMediaSettings.videoDuration) ? pendingRequest.generalMediaSettings.videoDuration : plannedSettings?.duration,
              }
          : plannedSettings;
        const agentPromptDetail = generationMode === "image" || generationMode === "video" ? getAgentPromptDetailFromPlan(plan, sourceText, generationMode) : undefined;
        const agentPrompt = joinPromptDetail(agentPromptDetail);
        const videoReferenceMode = generationMode === "video" && supportsVideoReferenceMode(generationModel) ? pendingRequest.videoReferenceMode ?? "reference" : undefined;
        if (videoReferenceMode === "first_last_frame" && (pendingRequest.referenceImages?.length ?? 0) < 2) {
          appendSystemMessage(sessionId, { content: "首尾帧生视频需要至少两张参考图，请补充首帧和尾帧图片。", error: "首尾帧生视频需要至少两张参考图，请补充首帧和尾帧图片。", mode: "video" });
          return;
        }
        const shouldApplyAgentVideoReferenceMode = generationMode === "video" && supportsVideoReferenceMode(generationModel);
        const effectiveVideoReferenceImages = shouldApplyAgentVideoReferenceMode
          ? getEffectiveVideoReferenceItems(pendingRequest.referenceImages, generationModel, videoReferenceMode)
          : pendingRequest.referenceImages;
        const effectiveVideoImageReferences = shouldApplyAgentVideoReferenceMode
          ? getEffectiveVideoReferenceItems(pendingRequest.imageReferences, generationModel, videoReferenceMode)
          : pendingRequest.imageReferences;
        if (shouldApplyAgentVideoReferenceMode && (pendingRequest.referenceImages?.length ?? 0) > (effectiveVideoReferenceImages?.length ?? 0)) {
          appendSystemMessage(sessionId, { content: getVideoReferenceLimitHint(generationModel, videoReferenceMode), mode: "video" });
        }
        const plannedItemPromptDetails = agentPrompt ? getAgentItemPromptDetailsFromPlan(plan, sourceText, generationMode) : undefined;
        const plannedItemPrompts = plannedItemPromptDetails?.map(joinPromptDetail);
        const agentItemPrompts = generationMode === "video" && agentPrompt && (!plannedItemPrompts?.length) && plan.count && plan.count > 1
          ? Array.from({ length: Math.min(20, Math.floor(plan.count)) }).map((_, index) => `${agentPrompt}，第 ${index + 1} 镜，只生成当前这一镜的一段视频`)
          : plannedItemPrompts;
        const agentItemPromptDetails = plannedItemPromptDetails ?? (agentPromptDetail ? [agentPromptDetail] : undefined);
        const agentItemSettings = generationMode === "video" ? getAgentVideoItemSettingsFromPlan(plan, agentSettings, generationModel) : undefined;
        const agentDisplayText = generationMode === "image" || generationMode === "video" ? getAgentDisplayTextFromPlan(plan, generationMode, sourceText) : undefined;
        const assetTargetType = getAssetTypeFromText([sourceText, plan.subject, ...(plan.constraints ?? [])].filter(Boolean).join("，"), generationMode);
        const nextPendingRequest: PendingGeneration = {
          ...pendingRequest,
          mode: generationMode,
          model: generationModel,
          promptModel: generationMode === "image" || generationMode === "video" ? pendingRequest.model : undefined,
          prompt: agentPrompt,
          originalPrompt: agentPrompt,
          settings: generationMode === "agent" ? undefined : agentSettings,
          assetTargetType: assetTargetType === "other" ? undefined : assetTargetType,
          agentGenerated: generationMode === "image" || generationMode === "video",
          agentDisplayText,
          agentSuggestions: getAgentMediaSuggestions(generationMode, plan.suggestions),
          agentItemPrompts,
          agentItemPromptDetails,
          agentItemSettings,
          referenceImages: effectiveVideoReferenceImages,
          imageReferences: effectiveVideoImageReferences,
          videoReferenceMode,
          needsIntentResolution: false,
        };

        updatePendingRequest(sessionId, pendingRequest.id, nextPendingRequest);

        if (generationMode === "image") {
          appendAssistantMessage(sessionId, {
            content: agentDisplayText ?? "",
            statusText: imageStatusLabels.creating,
            suggestions: nextPendingRequest.agentSuggestions,
            pendingImageCount: getImageCountValue(nextPendingRequest.settings?.imageCount, Number.POSITIVE_INFINITY),
            mode: generationMode,
            requestId: pendingRequest.id,
            imageReferences: effectiveVideoImageReferences,
            generationMeta: { mode: "image", model: nextPendingRequest.model, settings: nextPendingRequest.settings, preserveOriginalInput: nextPendingRequest.preserveOriginalInput, assetTargetType: nextPendingRequest.assetTargetType, originalPrompt: agentPrompt, agentGenerated: true, itemPromptDetails: nextPendingRequest.agentItemPromptDetails },
          });
        }

        if (generationMode === "video") {
          appendAssistantMessage(sessionId, {
            content: agentDisplayText ?? "",
            statusText: videoStatusLabels.creating,
            suggestions: nextPendingRequest.agentSuggestions,
            pendingVideoCount: Math.max(1, agentItemPrompts?.length ?? Math.floor(plan.count ?? 1)),
            mode: generationMode,
            requestId: pendingRequest.id,
            imageReferences: pendingRequest.imageReferences,
            generationMeta: { mode: "video", model: nextPendingRequest.model, settings: nextPendingRequest.settings, preserveOriginalInput: nextPendingRequest.preserveOriginalInput, assetTargetType: nextPendingRequest.assetTargetType, originalPrompt: agentPrompt, agentGenerated: true, itemPrompts: agentItemPrompts, itemPromptDetails: nextPendingRequest.agentItemPromptDetails },
          });
        }

        pendingRequest = nextPendingRequest;
      }

      let prompt = pendingRequest.prompt;

      if (!prompt) {
        const conversationTitle = sessions.find((session) => session.id === sessionId)?.title;
        if (pendingRequest.mode === "agent" || pendingRequest.mode === "general") {
          try {
            const chatModels = pendingRequest.mode === "agent"
              ? (pendingRequest.agentChatModelChain?.length ? pendingRequest.agentChatModelChain : [pendingRequest.promptModel ?? pendingRequest.model])
              : [pendingRequest.promptModel ?? pendingRequest.model];
            let lastChatError: unknown;
            appendAssistantMessage(sessionId, { content: "", mode: pendingRequest.mode, requestId: pendingRequest.id, textModel: pendingRequest.mode === "general" ? pendingRequest.model : undefined });
            for (const chatModel of chatModels) {
              let liveContent = "";
              try {
                const thinkStartedAt = Date.now();
                const response = await fetch("/api/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  signal: abortController.signal,
                  body: JSON.stringify({
                    model: chatModel,
                    mode: pendingRequest.mode,
                    stream: true,
                    messages: pendingRequest.referenceHint ? [...pendingRequest.messages, { role: "user", content: pendingRequest.referenceHint }] : pendingRequest.messages,
                    settings: pendingRequest.settings,
                    originalPrompt: pendingRequest.originalPrompt,
                    conversationId: sessionId,
                    conversationTitle,
                    requestId: pendingRequest.id,
                  }),
                });
                if (await handleSessionExpiredResponse(response)) throw new DOMException("aborted", "AbortError");
                const contentType = response.headers.get("content-type") ?? "";
                let data: ChatApiResponse = {};
                let liveReasoning = "";
                let thinkMsFrozen: number | undefined;
                const thinkMsNow = () => Date.now() - thinkStartedAt;
                const finishThinkMs = () => {
                  if (thinkMsFrozen == null) thinkMsFrozen = thinkMsNow();
                  return thinkMsFrozen;
                };
                let thinkCollapsed = false;
                const waitMs = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
                const visibleThinkText = () => liveReasoning.replace(/\u200b/g, "").trim();
                const syncThinkMessage = (collapsed: boolean) => {
                  updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { reasoning: liveReasoning, thinkMs: collapsed ? finishThinkMs() : thinkMsNow(), thinkCollapsed: collapsed, streaming: false });
                };
                let collapsePromise: Promise<void> | undefined;
                const collapseThink = () => {
                  if (thinkCollapsed) return Promise.resolve();
                  if (collapsePromise) return collapsePromise;
                  collapsePromise = (async () => {
                    if (!visibleThinkText()) {
                      thinkCollapsed = true;
                      flushSync(() => syncThinkMessage(true));
                      return;
                    }
                    flushSync(() => syncThinkMessage(false));
                    await waitMs(Math.min(1200, Math.max(280, visibleThinkText().length * 6)));
                    if (abortController.signal.aborted) throw new DOMException("aborted", "AbortError");
                    thinkCollapsed = true;
                    flushSync(() => syncThinkMessage(true));
                    await waitMs(400);
                    if (abortController.signal.aborted) throw new DOMException("aborted", "AbortError");
                  })();
                  return collapsePromise;
                };
                let thinkIdleTimer: number | undefined;
                const armThinkIdle = () => {
                  window.clearTimeout(thinkIdleTimer);
                  thinkIdleTimer = window.setTimeout(() => {
                    void collapseThink();
                  }, 200);
                };
                const revealBody = async (text: string) => {
                  if (!text) return;
                  await collapseThink();
                  updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { content: text, reasoning: liveReasoning, thinkMs: finishThinkMs(), thinkCollapsed: true, streaming: true, mode: pendingRequest.mode, requestId: pendingRequest.id, textModel: pendingRequest.mode === "agent" ? chatModel : pendingRequest.mode === "general" ? pendingRequest.model : undefined });
                };
                if (contentType.includes("text/event-stream") && response.body) {
                  const reader = response.body.getReader();
                  const decoder = new TextDecoder();
                  let buffer = "";
                  data = {};
                  try {
                  while (true) {
                    const chunk = await reader.read();
                    buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = chunk.done ? "" : (lines.pop() ?? "");
                    for (const line of lines) {
                      if (!line.startsWith("data:")) continue;
                      const raw = line.slice(5).trim();
                      if (!raw) continue;
                      let event: Record<string, unknown>;
                      try { event = JSON.parse(raw) as Record<string, unknown>; } catch { continue; }
                      if (typeof event.error === "string") throw new Error(event.error);
                      if (event.done) {
                        data = event as ChatApiResponse;
                        continue;
                      }
                      if (typeof event.reasoning === "string") {
                        const incoming = event.reasoning;
                        const prevVisible = liveReasoning.replace(/\u200b/g, "");
                        if (incoming === "\u200b") {
                          if (!prevVisible) liveReasoning = incoming;
                        } else if (!prevVisible || incoming.startsWith(prevVisible)) {
                          liveReasoning = incoming;
                        } else {
                          liveReasoning += incoming;
                        }
                        if (visibleThinkText() && !thinkCollapsed) {
                          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { reasoning: liveReasoning, thinkMs: thinkMsNow(), thinkCollapsed: false });
                          armThinkIdle();
                        }
                      }
                      const incomingDelta = typeof event.delta === "string" ? event.delta : "";
                      const incomingReplace = typeof event.content === "string" ? event.content : "";
                      if (incomingDelta || incomingReplace) {
                        window.clearTimeout(thinkIdleTimer);
                        if (incomingDelta) liveContent += incomingDelta;
                        else if (!liveContent || incomingReplace.startsWith(liveContent)) liveContent = incomingReplace;
                        if (liveContent) await revealBody(liveContent);
                        else await collapseThink();
                      }
                    }
                    if (chunk.done) break;
                  }
                  } finally {
                    window.clearTimeout(thinkIdleTimer);
                  }
                  if (!visibleThinkText() && typeof data.reasoning === "string") liveReasoning = data.reasoning;
                  if (visibleThinkText()) await collapseThink();
                } else {
                  data = await readJson<ChatApiResponse>(response);
                  if (data.reasoning) liveReasoning = data.reasoning;
                }
                if (!visibleThinkText() && typeof data.reasoning === "string") liveReasoning = data.reasoning;
                const assembled = liveContent.trim() || data.content?.trim() || "暂时没有生成出可用内容，请换一种说法再试。";
                addSessionUsage(sessionId, data.usage);
                applyCreditResult(sessionId, data.credit);
                if (!liveContent.trim()) await revealBody(assembled);
                updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { suggestions: data.suggestions, reasoning: liveReasoning || data.reasoning, thinkMs: finishThinkMs(), thinkCollapsed: true, streaming: true });
                window.setTimeout(() => {
                  updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { streaming: false });
                }, 1600);
                prompt = assembled;
                updatePendingRequest(sessionId, pendingRequest.id, { prompt, model: chatModel as ModelName });
                if (pendingRequest.mode === "agent") setLastAgentChatModel(chatModel);
                lastChatError = undefined;
                break;
              } catch (error) {
                if (stoppedRequestIdsRef.current.has(pendingRequest.id) || (error instanceof DOMException && error.name === "AbortError")) throw error;
                 const streamErrorText = error instanceof Error ? error.message : String(error);
                 if (liveContent.trim() && !streamErrorText.includes("不符合平台规则")) {
                   prompt = liveContent.trim();
                   lastChatError = undefined;
                   updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { streaming: false, thinkCollapsed: true });
                   break;
                 }
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes("不符合平台规则")) {
                  updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { content: toUserErrorMessage(error), error: toUserErrorMessage(error), mode: pendingRequest.mode });
                  return;
                }
                lastChatError = error;
              }
            }
            if (!prompt) {
              const message = toUserErrorMessage(lastChatError);
              updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { content: message, error: message, mode: pendingRequest.mode });
              return;
            }
          } catch (error) {
            if (stoppedRequestIdsRef.current.has(pendingRequest.id) || (error instanceof DOMException && error.name === "AbortError")) throw error;
            const message = toUserErrorMessage(error);
            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { content: message, error: message, mode: pendingRequest.mode });
            return;
          }
        } else {
        let promptMessages = pendingRequest.mode === "image" || pendingRequest.mode === "video" ? await toPromptPreviewPayloadMessages(pendingRequest.messages) : pendingRequest.messages;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            model: pendingRequest.promptModel ?? pendingRequest.model,
            mode: pendingRequest.mode,
            messages: pendingRequest.referenceHint ? [...promptMessages, { role: "user", content: pendingRequest.referenceHint }] : promptMessages,
            settings: pendingRequest.settings,
            originalPrompt: pendingRequest.originalPrompt,
            conversationId: sessionId,
            conversationTitle,
            requestId: pendingRequest.id,
          }),
        });

        let data: ChatApiResponse;
        try {
          data = await readJson<ChatApiResponse>(response);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (!isRequestTooLargeError(message) || (pendingRequest.mode !== "image" && pendingRequest.mode !== "video")) throw error;

          promptMessages = toPromptPayloadMessages(pendingRequest.messages);
          const retryResponse = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              model: pendingRequest.promptModel ?? pendingRequest.model,
              mode: pendingRequest.mode,
              messages: pendingRequest.referenceHint ? [...promptMessages, { role: "user", content: pendingRequest.referenceHint }] : promptMessages,
              settings: pendingRequest.settings,
              originalPrompt: pendingRequest.originalPrompt,
              conversationId: sessionId,
              conversationTitle,
              requestId: pendingRequest.id,
            }),
          });
          data = await readJson<ChatApiResponse>(retryResponse);
        }
        addSessionUsage(sessionId, data.usage);
        applyCreditResult(sessionId, data.credit);
        prompt = data.content?.trim() || "暂时没有生成出可用内容，请换一种说法再试。";
        updatePendingRequest(sessionId, pendingRequest.id, { prompt });

        if (pendingRequest.mode === "image" || pendingRequest.mode === "video") {
          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
            generationMeta: {
              mode: pendingRequest.mode,
              model: pendingRequest.model,
              settings: pendingRequest.settings,
              preserveOriginalInput: pendingRequest.preserveOriginalInput,
              assetTargetType: pendingRequest.assetTargetType,
              originalPrompt: prompt,
              agentGenerated: pendingRequest.agentGenerated,
            },
          });
        }
        }
      }

      if (pendingRequest.mode === "image" && prompt) {
        const sourceText = pendingRequest.sourceText ?? pendingRequest.messages[pendingRequest.messages.length - 1]?.content ?? "";
        const withReferenceHint = (value: string) => pendingRequest.referenceHint ? `${value}\n\n${pendingRequest.referenceHint}` : value;
        type ConversationImageJobStatus = { requestId: string; status: string; resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta; error?: string; errorCode?: string };
        // Poll a durable backend image job. The backend worker generates/charges/writes-to-asset-library
        // regardless of the browser; we only READ status. No timeout: only an explicit backend failure
        // surfaces as an error. If the client disconnects, the job still finishes; on reload the persisted
        // pending request re-runs runGeneration → resubmits (idempotent by requestId) → polls the finished job.
        const pollConversationImageJob = async (imageRequestId: string): Promise<{ images: string[]; reservedNames?: string[]; imageDimensions: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta }> => {
          while (true) {
            if (abortController.signal.aborted) throw new DOMException("aborted", "AbortError");
            await new Promise((resolve) => window.setTimeout(resolve, 3000));
            if (abortController.signal.aborted) throw new DOMException("aborted", "AbortError");
            let job: ConversationImageJobStatus | undefined;
            try {
              const statusResponse = await fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, signal: abortController.signal, body: JSON.stringify({ requestIds: [imageRequestId] }) });
              const statusData = await readJson<{ jobs?: ConversationImageJobStatus[] }>(statusResponse);
              job = statusData.jobs?.find((item) => item?.requestId === imageRequestId);
            } catch (error) {
              if (abortController.signal.aborted) throw error;
              continue;
            }
            if (!job) continue;
            if (job.status === "failed") throw new Error(getApiErrorMessageWithCode({ error: job.error, errorCode: job.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE));
            if (job.status === "succeeded") return { images: Array.isArray(job.resultUrls) ? job.resultUrls.filter(Boolean) : [], reservedNames: job.reservedNames, imageDimensions: job.resultDimensions ?? {}, usage: job.usage, credit: job.credit };
          }
        };
        const createImage = async (referenceImages: string[] | undefined, promptOverride = prompt, imageRequestId: string, requestedCount = 1) => {
          const conversationSession = sessions.find((session) => session.id === sessionId);
          const conversationTitle = conversationSession?.title;
          const submit = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              prompt: withReferenceHint(promptOverride),
              model: pendingRequest.model,
              referenceImages,
              settings: pendingRequest.settings,
              count: requestedCount,
              conversationId: sessionId,
              conversationTitle,
              conversationCode: conversationSession?.conversationCode,
              requestId: imageRequestId,
              async: true,
              flow: "conversation",
              sourcePrompt: promptOverride,
              suppressContentModerationRecord: pendingRequest.suppressContentModerationRecord,
              metadata: pendingRequest.agentGenerated ? { creditSource: "agent_image_generation" } : undefined,
            }),
          }).then((response) => readJson<{ jobId?: string; error?: string; errorCode?: string }>(response));
          if (!submit.jobId) throw new Error(getApiErrorMessageWithCode({ error: submit.error, errorCode: submit.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE));
          const job = await pollConversationImageJob(imageRequestId);
          return { images: job.images, reservedNames: job.reservedNames, imageDimensions: job.imageDimensions, failureReasons: [] as string[], usage: job.usage, credit: job.credit };
        };

        const createImageWithRetry = async (promptOverride = prompt, imageRequestId: string, requestedCount = 1) => {
          let imageData: { images?: string[]; reservedNames?: string[]; imageDimensions?: Record<string, ImageDimensions>; failureReasons?: string[]; usage?: UsageMeta; credit?: CreditMeta; billableImageCount?: number };

          try {
            imageData = await createImage(pendingRequest.referenceImages, promptOverride, imageRequestId, requestedCount);
          } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (pendingRequest.preserveOriginalInput || !isRequestTooLargeError(message) || !pendingRequest.referenceImages?.length) throw error;

            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: "参考图过大，正在压缩副本后重试" });

            try {
              const retryImages = await compressReferenceImagesForRetry(pendingRequest.referenceImages, RETRY_IMAGE_SIDE, RETRY_IMAGE_QUALITY);
              imageData = await createImage(retryImages, promptOverride, `${imageRequestId}:c1`, requestedCount);
            } catch (retryError) {
              const retryMessage = retryError instanceof Error ? retryError.message : "";
              if (!isRequestTooLargeError(retryMessage)) throw retryError;

              const finalRetryImages = await compressReferenceImagesForRetry(pendingRequest.referenceImages, FINAL_RETRY_IMAGE_SIDE, FINAL_RETRY_IMAGE_QUALITY);
              imageData = await createImage(finalRetryImages, promptOverride, `${imageRequestId}:c2`, requestedCount);
            }
          }

          const nextImages = imageData.images ?? [];
          if (nextImages.length === 0) throw new Error(GENERIC_MEDIA_ERROR_MESSAGE);
          return { images: nextImages, reservedNames: imageData.reservedNames, imageDimensions: imageData.imageDimensions ?? {}, failureReasons: imageData.failureReasons ?? [], usage: imageData.usage, credit: imageData.credit, billableImageCount: imageData.billableImageCount };
        };

        const imageCount = getImageCountValue(pendingRequest.settings?.imageCount, pendingRequest.agentGenerated ? Number.POSITIVE_INFINITY : 4);
        const contextText = pendingRequest.messages.map((message) => message.content).join("\n");
          const results = await Promise.allSettled(
            Array.from({ length: imageCount }).map(async (_, index) => {
              try {
                const fallbackPromptDetail = pendingRequest.agentGenerated ? { prompt: getAgentImageVariantPrompt(prompt, sourceText, index, imageCount) } : undefined;
                const itemPromptDetail = pendingRequest.agentGenerated ? pendingRequest.agentItemPromptDetails?.[index] ?? fallbackPromptDetail : undefined;
                const itemPrompt = pendingRequest.agentGenerated ? joinPromptDetail(itemPromptDetail) || prompt : prompt;
                const imageResult = await createImageWithRetry(itemPrompt, `${pendingRequest.id}:image:${index}`);
                const resultImages = imageResult.images;
                const resultDimensions = Object.fromEntries(resultImages.map((url) => [url, imageResult.imageDimensions[url]]).filter((item): item is [string, ImageDimensions] => Boolean(item[1])));
                const serverNames = Object.fromEntries(resultImages.map((url, imageIndex) => [url, imageResult.reservedNames?.[imageIndex]]).filter((item): item is [string, string] => Boolean(item[1])));
                const mediaSystemNames = Object.keys(serverNames).length === resultImages.length ? serverNames : reserveMediaSystemNames(sessionId, "image", resultImages);
                addSessionUsage(sessionId, imageResult.usage);
                applyCreditResult(sessionId, imageResult.credit);
                const imagePrompts = Object.fromEntries(resultImages.map((url) => [url, itemPrompt]));
                const imagePromptDetails = itemPromptDetail ? Object.fromEntries(resultImages.map((url) => [url, itemPromptDetail])) : {};
                appendImagesToAssistantMessage(sessionId, pendingRequest.id, resultImages, resultDimensions, 1, imagePrompts, mediaSystemNames, pendingRequest.retryFailedIndex, pendingRequest.retryFailedIndex !== undefined ? undefined : index, imagePromptDetails);
                addGeneratedAssets(sessionId, pendingRequest.mode, itemPrompt, resultImages, undefined, pendingRequest.assetTargetType, contextText, mediaSystemNames, {}, imagePromptDetails);
                addSessionGeneratedMediaCount(sessionId, resultImages.length, 0);
                notifyGenerationCompleteOnce(pendingRequest.id, "图片生成已完成");
                return resultImages;
              } catch (error) {
                markAssistantImageFailure(sessionId, pendingRequest.id, pendingRequest.retryFailedIndex, toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), pendingRequest.retryFailedIndex !== undefined ? undefined : index);
                throw error;
              }
            }),
          );

          const successCount = results.filter((result) => result.status === "fulfilled").length;
          const failureCount = results.length - successCount;
          const failureReasons = mediaFailureReasons(results, GENERIC_MEDIA_ERROR_MESSAGE);
          if (failureReasons.length > 0) {
            console.warn("[media-generation] image failure reasons", {
              requestId: pendingRequest.id,
              model: pendingRequest.model,
              successCount,
              failureCount,
              reasons: failureReasons,
            });
          }

          finalizeAssistantImageFailures(sessionId, pendingRequest.id, failureCount, {
            content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? prompt : prompt,
            statusText: undefined,
            error: failureCount > 0 ? (successCount > 0 ? mediaFailureMessage(results, failureCount, GENERIC_MEDIA_ERROR_MESSAGE) : resultErrorMessage(results) ?? GENERIC_MEDIA_ERROR_MESSAGE) : undefined,
            mediaErrorReasons: failureReasons.length > 0 ? failureReasons : undefined,
            mode: pendingRequest.mode,
          });
      }

      if (pendingRequest.mode === "video" && prompt) {
        const withReferenceHint = (value: string) => pendingRequest.referenceHint ? `${value}\n\n${pendingRequest.referenceHint}` : value;
        const createAndPollVideo = async (videoPrompt: string, itemSettings: GenerationSettings | undefined, itemIndex: number, promptDetail?: PromptDetail) => {
          let taskId = itemIndex === 0 ? pendingRequest.taskId : undefined;
          let pendingVideoUsage: UsageMeta | undefined;
          const conversationSession = sessions.find((session) => session.id === sessionId);
          const conversationTitle = conversationSession?.title;
          const videoRequestId = `${pendingRequest.id}:video:${itemIndex}`;

          const settings = itemSettings ?? pendingRequest.settings;

          if (!taskId) {
          const modelVideoPrompt = replaceMentionNamesForModelPrompt(videoPrompt, pendingRequest.imageReferences);
          let reviewNoticeShownForRequest = false;
          const hasReviewNoticeShown = () => {
            if (reviewNoticeShownForRequest) return true;
            const session = sessionsRef.current.find((item) => item.id === sessionId);
            return Boolean(session?.messages.some((message) =>
              message.role === "assistant" && message.requestId === pendingRequest.id && message.bytePlusAutoReviewNoticeShown,
            ));
          };
          const showReviewNoticeOnce = () => {
            if (hasReviewNoticeShown()) return false;
            reviewNoticeShownForRequest = true;
            appendSystemMessage(sessionId, { content: BYTEPLUS_AUTO_REVIEW_NOTICE, mode: "video" });
            return true;
          };
          const createVideoTask = (autoBytePlusAssetReview = false) => fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({ prompt: withReferenceHint(modelVideoPrompt), sourcePrompt: videoPrompt, model: pendingRequest.model, referenceImages: pendingRequest.referenceImages, referenceVideos: pendingRequest.referenceVideos, referenceAudios: pendingRequest.referenceAudios, referenceMode: pendingRequest.videoReferenceMode, settings, conversationId: sessionId, conversationTitle, conversationCode: conversationSession?.conversationCode, requestId: videoRequestId, flow: "conversation", itemIndex, suppressContentModerationRecord: pendingRequest.suppressContentModerationRecord, metadata: pendingRequest.agentGenerated ? { creditSource: "agent_video_generation" } : undefined, autoBytePlusAssetReview }),
          });

          let taskResponse = await createVideoTask();
          let taskData = await readJson<{ id?: string; polling_url?: string; pollingUrl?: string; status?: string; usage?: UsageMeta; autoBytePlusAssetReview?: { triggered?: boolean; assets?: Array<{ url?: string; assetId?: string; groupId?: string; status?: AssetItem["bytePlusAssetStatus"]; error?: string }> } }>(taskResponse);
          if (taskData.status === "reviewing" && taskData.autoBytePlusAssetReview?.triggered) {
            const reviewNotice = BYTEPLUS_AUTO_REVIEW_NOTICE;
            const shouldShowReviewNotice = showReviewNoticeOnce();
            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, shouldShowReviewNotice ? { statusText: reviewNotice, bytePlusAutoReviewNoticeShown: true } : { bytePlusAutoReviewNoticeShown: true });
            taskResponse = await createVideoTask(true);
            taskData = await readJson<{ id?: string; polling_url?: string; pollingUrl?: string; status?: string; usage?: UsageMeta; autoBytePlusAssetReview?: { triggered?: boolean; assets?: Array<{ url?: string; assetId?: string; groupId?: string; status?: AssetItem["bytePlusAssetStatus"]; error?: string }> } }>(taskResponse);
          }
          if (taskData.autoBytePlusAssetReview?.triggered) {
            applyBytePlusAssetUpdatesByUrl(taskData.autoBytePlusAssetReview.assets ?? []);
            if (showReviewNoticeOnce()) updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: BYTEPLUS_AUTO_REVIEW_NOTICE, bytePlusAutoReviewNoticeShown: true });
          }
          pendingVideoUsage = taskData.usage;

          const openRouterTaskId = taskData.polling_url ?? taskData.pollingUrl ?? taskData.id;

          if (!openRouterTaskId) {
            throw new Error("视频平台没有返回任务编号");
          }

          taskId = openRouterTaskId;
          if (itemIndex === 0) updatePendingRequest(sessionId, pendingRequest.id, { taskId });
          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: videoStatusLabels.queued });
          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    videoTask: { taskId: taskId ?? "", status: "queued" },
                  }
                : session,
            ),
          );
          }

          let pollAttempt = 0;
          while (true) {
          const i = pollAttempt;
          pollAttempt += 1;
          const pollInterval = i < FAST_VIDEO_POLL_ATTEMPTS ? FAST_VIDEO_POLL_INTERVAL_MS : SLOW_VIDEO_POLL_INTERVAL_MS;
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          let pollResponse: Response;
          try {
            pollResponse = await fetch("/api/generation-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: abortController.signal,
              body: JSON.stringify({ requestIds: [videoRequestId] }),
            });
          } catch (error) {
            if (abortController.signal.aborted || stoppedRequestIdsRef.current.has(pendingRequest.id) || isAbortLikeError(error)) throw error;
            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: videoStatusLabels.running });
            setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, updatedAt: Date.now(), videoTask: { taskId: taskId ?? "", status: "running" } } : session));
            continue;
          }

          if (!pollResponse.ok && isTransientVideoPollStatus(pollResponse.status)) {
            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: videoStatusLabels.running });
            setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, updatedAt: Date.now(), videoTask: { taskId: taskId ?? "", status: "running" } } : session));
            continue;
          }

          const statusData = await readJson<{ jobs?: Array<{ status?: string; resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, { width: number; height: number; durationSeconds?: number }>; posterUrl?: string; error?: string; errorCode?: string; usage?: UsageMeta; credit?: CreditMeta; extra?: { preview?: { videoUrl?: string } } }> }>(pollResponse);
          const job = statusData.jobs?.[0];
          const pollData: {
            status?: string;
            content?: { video_url?: string; poster_url?: string };
            error?: { message?: string } | string;
            errorCode?: string;
            usage?: UsageMeta;
            credit?: CreditMeta;
            reservedNames?: string[];
          } = job ? { status: job.status, content: { video_url: job.resultUrls?.[0], poster_url: job.posterUrl }, error: job.error, errorCode: job.errorCode, usage: job.usage, credit: job.credit, reservedNames: job.reservedNames } : { status: "running" };

          const status = (pollData.status ?? "running").toLowerCase();
          const statusText = videoStatusLabels[status] ?? `视频状态：${status}`;

          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText });

          // 乐观显示：还在跑但供应商已给可直接播的远程地址 → 先让用户看，本地后台继续存。
          if (["queued", "running"].includes(status) && job?.extra?.preview?.videoUrl) {
            applyVideoPreviewToMessage(sessionId, pendingRequest.id, job.extra.preview.videoUrl);
          }

          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    updatedAt: Date.now(),
                    videoTask: {
                      taskId: taskId ?? "",
                      status,
                      videoUrl: pollData.content?.video_url,
                    },
                  }
                : session,
            ),
          );

          if (["succeeded", "success", "completed", "complete", "done"].includes(status)) {
            addSessionUsage(sessionId, pollData.usage ?? pendingVideoUsage);
            applyCreditResult(sessionId, pollData.credit);

            if (!pollData.content?.video_url) {
              updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
                content: "视频平台返回已完成，但没有返回视频地址。",
                error: "视频生成完成但缺少视频链接，需要继续对接平台返回字段。",
                statusText: "视频缺少链接",
                mode: pendingRequest.mode,
              });
              throw new Error("视频生成完成但缺少视频链接");
            }

            const mediaSystemNames = pollData.reservedNames?.[0] ? { [pollData.content.video_url]: pollData.reservedNames[0] } : reserveMediaSystemNames(sessionId, "video", [pollData.content.video_url]);
            appendVideoToAssistantMessage(sessionId, pendingRequest.id, pollData.content.video_url, videoPrompt, mediaSystemNames[pollData.content.video_url], pollData.content.poster_url, promptDetail, job?.resultDimensions?.[pollData.content.video_url]);
            addGeneratedAssets(sessionId, pendingRequest.mode, videoPrompt, [pollData.content.video_url], undefined, pendingRequest.assetTargetType, pendingRequest.messages.map((message) => message.content).join("\n"), mediaSystemNames, pollData.content.poster_url ? { [pollData.content.video_url]: pollData.content.poster_url } : {}, promptDetail ? { [pollData.content.video_url]: promptDetail } : {});
            addSessionGeneratedMediaCount(sessionId, 0, 1);
            notifyGenerationCompleteOnce(pendingRequest.id, "视频生成已完成");
            return pollData.content.video_url;
          }

          if (["failed", "error", "expired"].includes(status)) {
            addSessionUsage(sessionId, pollData.usage);

            const errorMessage = getApiErrorMessageWithCode({ error: pollData.error, errorCode: pollData.errorCode }, videoStatusLabels[status] ?? GENERIC_MEDIA_ERROR_MESSAGE);
            throw new Error(errorMessage ?? videoStatusLabels[status]);
          }
          }
        };

        const videoPromptDetails = pendingRequest.agentGenerated ? pendingRequest.agentItemPromptDetails?.length ? pendingRequest.agentItemPromptDetails : [{ prompt }] : undefined;
        const videoPrompts = pendingRequest.agentGenerated ? videoPromptDetails?.map(joinPromptDetail) ?? [prompt] : [prompt];
        const results = await Promise.allSettled(
          videoPrompts.map(async (videoPrompt, index) => {
            try {
              return await createAndPollVideo(videoPrompt, pendingRequest.agentItemSettings?.[index], index, videoPromptDetails?.[index]);
            } catch (error) {
              markAssistantVideoFailure(sessionId, pendingRequest.id, toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE));
              throw error;
            }
          }),
        );

        const successCount = results.filter((result) => result.status === "fulfilled").length;
        const failureCount = results.length - successCount;
        const failureReasons = mediaFailureReasons(results, GENERIC_MEDIA_ERROR_MESSAGE);
        if (failureReasons.length > 0) {
          console.warn("[media-generation] video failure reasons", {
            requestId: pendingRequest.id,
            model: pendingRequest.model,
            successCount,
            failureCount,
            reasons: failureReasons,
          });
        }

        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? prompt : prompt,
          statusText: failureCount > 0 && successCount === 0 ? "视频生成失败" : videoStatusLabels.succeeded,
          pendingVideoCount: 0,
          error: failureCount > 0 ? (successCount > 0 ? mediaFailureMessage(results, failureCount, GENERIC_MEDIA_ERROR_MESSAGE) : resultErrorMessage(results) ?? GENERIC_MEDIA_ERROR_MESSAGE) : undefined,
          mediaErrorReasons: failureCount > 0 && failureReasons.length > 0 ? failureReasons : undefined,
          mode: pendingRequest.mode,
          generationMeta: {
            mode: "video",
            model: pendingRequest.model,
            settings: pendingRequest.settings,
            preserveOriginalInput: pendingRequest.preserveOriginalInput,
            assetTargetType: pendingRequest.assetTargetType,
            originalPrompt: pendingRequest.originalPrompt,
            agentGenerated: pendingRequest.agentGenerated,
            itemPrompts: videoPrompts,
            itemPromptDetails: videoPromptDetails,
          },
        });
      }

      if (pendingRequest.mode === "audio" && prompt) {
        const conversationSession = sessions.find((session) => session.id === sessionId);
        const conversationTitle = conversationSession?.title;
        const audioRequestId = `${pendingRequest.id}:audio:0`;
        const submit = await fetch("/api/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({ prompt, sourcePrompt: prompt, model: pendingRequest.model, voice: pendingRequest.voice, emotion: pendingRequest.emotion, audioReferenceMode: pendingRequest.audioReferenceMode, referenceAudios: pendingRequest.referenceAudios, conversationId: sessionId, conversationTitle, conversationCode: conversationSession?.conversationCode, requestId: audioRequestId }),
        }).then((response) => readJson<{ url?: string; name?: string; credit?: CreditMeta; error?: string; errorCode?: string }>(response));
        if (!submit.url) throw new Error(getApiErrorMessageWithCode({ error: submit.error, errorCode: submit.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE));
        applyCreditResult(sessionId, submit.credit);
        const mediaSystemNames = submit.name ? { [submit.url]: submit.name } : reserveMediaSystemNames(sessionId, "audio", [submit.url]);
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: prompt,
          audios: [submit.url],
          audioNames: mediaSystemNames,
          mediaSystemNames,
          audioPrompts: { [submit.url]: prompt },
          pendingAudioCount: 0,
          statusText: undefined,
          mode: pendingRequest.mode,
        });
        addGeneratedAssets(sessionId, "audio", prompt, [submit.url], undefined, undefined, "", mediaSystemNames);
        notifyGenerationCompleteOnce(pendingRequest.id, "语音生成已完成");
      }
    } catch (error) {
      if (stoppedRequestIdsRef.current.has(pendingRequest.id) || (error instanceof DOMException && error.name === "AbortError")) return;
      const message = toUserErrorMessage(error, pendingRequest.mode === "image" || pendingRequest.mode === "video" || pendingRequest.mode === "audio" ? GENERIC_MEDIA_ERROR_MESSAGE : undefined);
      if (pendingRequest.mode === "video") {
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? pendingRequest.prompt ?? "" : pendingRequest.prompt ?? "",
          error: message,
          mediaErrorReasons: [message],
          statusText: "视频生成失败",
          mode: pendingRequest.mode,
        });
      } else if (pendingRequest.mode === "image") {
        const expectedFailureCount = pendingRequest.retryFailedIndex === undefined ? getImageCountValue(pendingRequest.settings?.imageCount, pendingRequest.agentGenerated ? Number.POSITIVE_INFINITY : 4) : 1;
        finalizeAssistantImageFailures(sessionId, pendingRequest.id, expectedFailureCount, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? pendingRequest.prompt ?? "" : pendingRequest.prompt ?? "",
          error: message,
          mediaErrorReasons: [message],
          statusText: imageStatusLabels.failed,
          mode: pendingRequest.mode,
        });
      } else if (pendingRequest.mode === "audio") {
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.prompt ?? "",
          error: message,
          mediaErrorReasons: [message],
          statusText: "语音生成失败",
          pendingAudioCount: 0,
          mode: pendingRequest.mode,
        });
      } else {
        appendSystemMessage(sessionId, { content: message, error: message, mode: pendingRequest.mode });
      }
    } finally {
      clearPendingRequest(sessionId, pendingRequest.id);
      runningRequestIdsRef.current.delete(pendingRequest.id);
      requestAbortControllersRef.current.delete(pendingRequest.id);
      stoppedRequestIdsRef.current.delete(pendingRequest.id);
    }
  }, [addGeneratedAssets, addSessionUsage, addSessionGeneratedMediaCount, agentModelTier, appendAssistantMessage, appendImagesToAssistantMessage, appendSystemMessage, appendVideoToAssistantMessage, applyBytePlusAssetUpdatesByUrl, applyCreditResult, autoSaveHistory, clearPendingRequest, enabledAgentGenerationModelIds, ensureSessionMemorySummary, feedbackLogs, finalizeAssistantImageFailures, markAssistantImageFailure, markAssistantVideoFailure, notifyGenerationCompleteOnce, reserveMediaSystemNames, selectedGenerationModels, selectedModel, sessions, updateAssistantMessageByRequestId, updatePendingRequest]);

  useEffect(() => {
    if (!isLoaded) return;

    sessions.forEach((session) => {
      getSessionPendingRequests(session).forEach((pendingRequest) => {
        if (runningRequestIdsRef.current.has(pendingRequest.id)) return;
        void runGeneration(session.id, pendingRequest);
      });
    });
  }, [isLoaded, runGeneration, sessions]);

  const sendMessage = async (suggestion?: SuggestionInput, forcedMode?: WorkMode) => {
    const normalizedSuggestion = suggestion === undefined ? null : normalizeSuggestionItem(suggestion);
    const isSuggestionSend = Boolean(normalizedSuggestion);
    const rawText = normalizedSuggestion ? normalizedSuggestion.label : activeInput.trim();
    const submitMode = forcedMode ?? mode;
    const modeForSettings: WorkMode = submitMode === "agent" ? mode : submitMode;
    let generationModelsForSubmit = selectedGenerationModels;
    let generalModelsForSubmit = selectedGeneralModels;
    let enabledModelsForSubmit = enabledGenerationModelIds;
    const availableUploadedImages = isSuggestionSend ? [] : activeUploadedImages;
    const availableUploadedFiles = isSuggestionSend ? [] : activeUploadedFiles;
    const submitVideoReferenceMode = submitMode === "video" && supportsVideoReferenceMode(generationModelsForSubmit.video) ? selectedVideoReferenceMode : undefined;
    const submitAudioReferenceMode = submitMode === "audio" ? normalizeAudioReferenceModeForModel(generationModelsForSubmit.audio, selectedAudioReferenceMode) : undefined;
    // 图片/视频生成：必须有提示词才能发（rawText 含 @ 文本，所以有 @ 时它非空、不会被拦）。
    if ((submitMode === "image" || submitMode === "video") && !rawText) {
      showInputTip("请输入提示词！");
      return;
    }
    // ⭐ 超字数兜底（防回车 / 建议卡 / 程序化调用绕过按钮 disabled）。⛔ 不删字，只拦住。
    if (!isSuggestionSend && isPromptOverLimit(activeInput, currentPromptMaxLength)) {
      showInputTip(getPromptOverLimitTipText(countPromptLength(activeInput), currentPromptMaxLength));
      return;
    }
    const submitUploadRule = getUploadRule({ mode: submitMode, modelId: submitMode === "general" ? generalModelsForSubmit.chat : submitMode === "agent" ? selectedModel : generationModelsForSubmit[submitMode], transportMode: "local-base64", videoReferenceMode: submitVideoReferenceMode, audioReferenceMode: submitAudioReferenceMode }, uploadRuleOverrides);
    if (availableUploadedImages.length > submitUploadRule.image.maxCount) {
      showInputTip(`当前模型最多支持 ${submitUploadRule.image.maxCount} 张参考图，不能上传更多图片`);
      return;
    }
    const uploadedVideoFiles = availableUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "video");
    const uploadedAudioFiles = availableUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "audio");
    const uploadedDocumentFiles = availableUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "document");
    // 切换模式后当前模型可能整类不支持（如从视频模式切到图片模式，图片模型不支持视频/音频/文件）。
    // 直接提示"当前模型不支持视频/音频/文件"，而不是含糊的"最多支持 0 个文件"。
    if ((uploadedVideoFiles.length > 0 && !submitUploadRule.video.enabled) || (uploadedAudioFiles.length > 0 && !submitUploadRule.audio.enabled)) {
      showInputTip(getVideoAudioUploadDisabledMessage({ modelId: generationModelsForSubmit.video, videoReferenceMode: submitMode === "video" && supportsVideoReferenceMode(generationModelsForSubmit.video) ? selectedVideoReferenceMode : undefined }));
      return;
    }
    if (uploadedDocumentFiles.length > 0 && !submitUploadRule.document.enabled) {
      showInputTip("当前模型不支持文件");
      return;
    }
    if (uploadedVideoFiles.length > submitUploadRule.video.maxCount) {
      showInputTip(`当前模型最多支持 ${submitUploadRule.video.maxCount} 个参考视频`);
      return;
    }
    if (uploadedAudioFiles.length > submitUploadRule.audio.maxCount) {
      showInputTip(`当前模型最多支持 ${submitUploadRule.audio.maxCount} 个参考音频`);
      return;
    }
    if (uploadedDocumentFiles.length > submitUploadRule.document.maxCount) {
      showInputTip(`当前模型最多支持 ${submitUploadRule.document.maxCount} 个文件`);
      return;
    }
    // 视频编辑/延长（仅 Seedance 2.5）：必须有参考视频（提示词已在上面统一拦过）。
    if (submitAudioReferenceMode === "clone" && uploadedAudioFiles.length < 1) {
      showInputTip("音色克隆必须上传一段参考音频");
      return;
    }
    if (submitVideoReferenceMode === "edit" || submitVideoReferenceMode === "extend") {
      const modeLabel = submitVideoReferenceMode === "edit" ? "视频编辑" : "视频延长";
      if (uploadedVideoFiles.length < 1) {
        showInputTip(`当前是${modeLabel}模式，必须上传一个视频`);
        return;
      }
    }
    const videoTotalDurationError = validateReferenceTotalDuration("video", uploadedVideoFiles.map((file) => getUploadedMediaDuration(file)), generationModelsForSubmit.video);
    if (videoTotalDurationError) {
      showInputTip(videoTotalDurationError);
      return;
    }
    const audioTotalDurationError = submitMode === "audio" ? undefined : validateReferenceTotalDuration("audio", uploadedAudioFiles.map((file) => getUploadedMediaDuration(file)), generationModelsForSubmit.video);
    if (audioTotalDurationError) {
      showInputTip(audioTotalDurationError);
      return;
    }
    if (hasReadingUploadedFiles && !isSuggestionSend) {
      showInputTip("文件读取中");
      return;
    }
    if (hasUploadingInputs && !isSuggestionSend) {
      showInputTip("文件上传中");
      return;
    }
    if (hasFailedUploadInputs && !isSuggestionSend) {
      showInputTip("有文件上传失败，请删除后重新上传");
      return;
    }
    // 参考音频/视频是通过附件（referenceAudios/referenceVideos）送达模型的，与提示词里的 @名无关；
    // 过去在视频模式下强制把媒体 @名补到提示词最前面，会污染模型提示词/存档 content/等待卡显示，
    // 且用户删了又被自动补回（永远删不掉）。这里不再强制补名，@名由用户自行控制。
    const rawTextWithMediaMentions = rawText;
    if ((!rawTextWithMediaMentions && availableUploadedImages.length === 0 && availableUploadedFiles.length === 0) || !activeSession || (submitMode !== "agent" && submitMode !== "general" && activeHasMaxPendingRequests) || sendingSessionIdsRef.current.has(activeSession.id)) return;
    if (workspaceStorageMode === "user" && currentUserCredits <= 0) {
      showInputTip("积分不足，请充值后再使用模型");
      return;
    }

    const availabilityMode = submitMode === "image" || submitMode === "video" || submitMode === "audio" ? submitMode : undefined;
    if (availabilityMode) {
      const modelForAvailability = availabilityMode === "audio" ? generationModelsForSubmit.audio : submitMode === "general" ? generalModelsForSubmit[availabilityMode] : generationModelsForSubmit[availabilityMode];
      const isCurrentModelAvailable = enabledModelsForSubmit[availabilityMode].includes(modelForAvailability);
      if (enabledModelsForSubmit[availabilityMode].length === 0 || !isCurrentModelAvailable) {
        try {
          const response = await fetch("/api/model-availability", { cache: "no-store" });
          const data = (await response.json()) as { imageModels?: string[]; assetImageModels?: string[]; videoModels?: string[]; audioModels?: string[]; agentImageModels?: string[]; agentVideoModels?: string[] };
          const refreshedModels = {
            image: Array.isArray(data.imageModels) ? data.imageModels : [],
            video: Array.isArray(data.videoModels) ? data.videoModels : [],
            audio: Array.isArray(data.audioModels) ? data.audioModels : audioGenerationModels.map((model) => model.id),
          };
          const refreshedAgentModels = {
            image: Array.isArray(data.agentImageModels) ? data.agentImageModels : [],
            video: Array.isArray(data.agentVideoModels) ? data.agentVideoModels : [],
          };
          const refreshedAssetImageModels = Array.isArray(data.assetImageModels) ? data.assetImageModels : [];
          const nextSelectedModels = {
            image: refreshedModels.image.includes(generationModelsForSubmit.image) ? generationModelsForSubmit.image : refreshedModels.image[0] as ModelName | undefined ?? generationModelsForSubmit.image,
            video: refreshedModels.video.includes(generationModelsForSubmit.video) ? generationModelsForSubmit.video : refreshedModels.video[0] as ModelName | undefined ?? generationModelsForSubmit.video,
            audio: refreshedModels.audio.includes(generationModelsForSubmit.audio) ? generationModelsForSubmit.audio : refreshedModels.audio[0] as ModelName | undefined ?? generationModelsForSubmit.audio,
          };
          const nextGeneralModels = {
            chat: generalModelsForSubmit.chat,
            image: refreshedModels.image.includes(generalModelsForSubmit.image) ? generalModelsForSubmit.image : refreshedModels.image[0] as ModelName | undefined ?? generalModelsForSubmit.image,
            video: refreshedModels.video.includes(generalModelsForSubmit.video) ? generalModelsForSubmit.video : refreshedModels.video[0] as ModelName | undefined ?? generalModelsForSubmit.video,
          };
          enabledModelsForSubmit = refreshedModels;
          generationModelsForSubmit = nextSelectedModels;
          generalModelsForSubmit = nextGeneralModels;
          setEnabledGenerationModelIds(refreshedModels);
          setEnabledAgentGenerationModelIds(refreshedAgentModels);
          setEnabledAssetImageModelIds(refreshedAssetImageModels);
          setSelectedGenerationModels(nextSelectedModels);
          if (submitMode === "general") setSelectedGeneralModels(nextGeneralModels);
          setCharacterGenerateModel((current) => refreshedAssetImageModels.includes(current) ? current : refreshedAssetImageModels[0] as ModelName | undefined ?? current);
        } catch {}
      }
    }

    if (availabilityMode && enabledModelsForSubmit[availabilityMode].length === 0) {
      appendSystemMessage(activeSession.id, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: availabilityMode });
      return;
    }
    if (availabilityMode === "image" && !enabledModelsForSubmit.image.includes(submitMode === "general" ? generalModelsForSubmit.image : generationModelsForSubmit.image)) {
      appendSystemMessage(activeSession.id, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: availabilityMode });
      return;
    }
    if (availabilityMode === "video" && !enabledModelsForSubmit.video.includes(submitMode === "general" ? generalModelsForSubmit.video : generationModelsForSubmit.video)) {
      appendSystemMessage(activeSession.id, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: availabilityMode });
      return;
    }

    const sessionId = activeSession.id;
    setSessionSending(sessionId, true);
    let sessionForSend = activeSession;
    sessionForSend = await ensureSessionMemorySummary(
      activeSession,
      submitMode === "general" ? generalModelsForSubmit.chat : selectedModel,
      createClientId(),
    );
    let sendUploadedImages = availableUploadedImages;

    try {
      sendUploadedImages = await persistUploadedImagesForSend(availableUploadedImages);
    } catch (error) {
      // ⛔ 这个兜底会让**整批**图退回原始 dataURL 直发（Promise.all 一失败全失败），
      // 是红字 A5「参考素材不是可审核的公网地址」的源头。上传即转正之后这里本该永不触发，
      // 所以一旦触发必须留痕（服务端也有落盘兜底，不会再毙掉整单）。
      reportClientDiagnostic("send-time-persist-uploaded-images-failed", {
        imageCount: availableUploadedImages.length,
        dataUrlCount: availableUploadedImages.filter((image) => image.url.startsWith("data:")).length,
        tempTokenCount: availableUploadedImages.filter((image) => Boolean(image.tempToken)).length,
        rawError: error instanceof Error ? error.message : String(error),
      });
      sendUploadedImages = availableUploadedImages;
    }

    const explicitImageReferences = getOrderedExplicitImageReferences(rawTextWithMediaMentions, assets, sendUploadedImages, activeConversationImageReferences);
    const uploadedImageReferences = sendUploadedImages.map((image) => ({ name: getUploadedImageReferenceName(image, sendUploadedImages), url: image.url }));
    // 统一规则：有缩略图的一定发，@名只管顺序/意图。以被@命中的顺序排前面，未被@的缩略图按原顺序补在后面，不再因“别的图有@名”就丢弃无@名的缩略图。
    const sourceImageReferences: ImageReference[] = [...explicitImageReferences];
    uploadedImageReferences.forEach((reference) => {
      if (reference.url && !sourceImageReferences.some((item) => item.url === reference.url)) sourceImageReferences.push(reference);
    });
    if (sourceImageReferences.filter((reference, index, array) => Boolean(reference.url) && array.findIndex((item) => item.url === reference.url) === index).length > currentMaxReferenceImages) {
      showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
      return;
    }
    const namedImageReferences: ImageReference[] = sourceImageReferences
      .filter((reference, index, array) => Boolean(reference.url) && array.findIndex((item) => item.url === reference.url) === index)
      .slice(0, currentMaxReferenceImages);
    if (submitMode === "general" && namedImageReferences.length > 0 && !conversationModelSupportsImages(generalModelsForSubmit.chat)) {
      showInputTip("当前对话模型不支持图片，请切换 Seed、Gemini 或 GPT");
      setSessionSending(sessionId, false);
      return;
    }
    const referenceImages = namedImageReferences.map((reference) => reference.url);
    const referenceVideos = uploadedVideoFiles.map(getUploadedMediaFileUrl).filter(Boolean);
    const referenceAudios = uploadedAudioFiles.map(getUploadedMediaFileUrl).filter(Boolean);
    // ⭐⭐ 纯日志、不改任何行为（2026-08-05 加）：把「用户意愿」和「实际发出去的」钉在同一行上。
    //
    // 为什么必须有它：用户 ID_947011 报「换了第二张参考图，发送出去还是原来那张」，
    // 我在测试服把 6 个变体全试过都没复现，而正式服那次是**零上传**（磁盘 + 上传日志双证）
    // → **根因至今未确定**。事后能查到的只有 `GenerationJob.referenceImages`（发了哪几张），
    // 查不到"框里原本是哪几张、提示词里有哪些 @名、每一张是从哪来的"，所以永远差最后一步。
    //
    // ⭐ 最关键的是 `from` 这一段。`getOrderedExplicitImageReferences` 会拿提示词里的 @名
    // 依次去 **输入框 → 历史会话引用 → 整个资产库** 反查，**命中的排在最前面** ——
    // 所以一旦看到 `[@/assetLibrary]`，就等于当场抓住「用户已经把这张图删了、
    // 发送时代码又从资产库把它捞回来还插到最前面」。这正是 ID_868181 那个
    // 「参考音频 @名永远删不掉、每次都带上老音频」的同一个病理（那次是 `ensureMediaFileMentions`
    // 在提交那一刻把删掉的 @名拼回提示词，函数已删；图片这条路还活着）。
    //
    // ⚠️ `/api/client-error` 把 detail 截断到 2000 字符 → 这里只记文件名末段、不记全 url。
    // ⚠️ 只在"真的带了参考素材"时才记，纯文字发送不记（否则日志白涨）。
    if (referenceImages.length > 0 || referenceVideos.length > 0 || referenceAudios.length > 0) {
      const tailOf = (url: string) => url.split("/").pop() ?? url;
      const boxUrlKeys = new Set(sendUploadedImages.map((image) => normalizeMediaUrlForMatch(image.url)));
      const conversationUrlKeys = new Set(activeConversationImageReferences.map((reference) => normalizeMediaUrlForMatch(reference.url)));
      const assetUrlKeys = new Set(assets.map((asset) => normalizeMediaUrlForMatch(asset.url)));
      reportClientDiagnostic("send-reference-snapshot", {
        flow: submitMode,
        // 提示词原文里解析出的 @名（残留的老图 @名会在这里现形）
        mentionNames: getMentionNames(rawTextWithMediaMentions),
        // 发送那一刻输入框里的每一格（用户意愿）
        box: sendUploadedImages.map((image) => `${getUploadedImageReferenceName(image, sendUploadedImages)}=${tailOf(image.url)}`),
        // 实际发出去的顺序 + 每张是"@名命中"还是"缩略图补的" + 来源
        sent: namedImageReferences.map((reference) => {
          const key = normalizeMediaUrlForMatch(reference.url);
          const byMention = explicitImageReferences.some((item) => item.url === reference.url);
          const from = boxUrlKeys.has(key) ? "box" : conversationUrlKeys.has(key) ? "conversation" : assetUrlKeys.has(key) ? "assetLibrary" : "unknown";
          return `${reference.name}=${tailOf(reference.url)}[${byMention ? "@" : "thumb"}/${from}]`;
        }),
        videos: referenceVideos.map(tailOf),
        audios: referenceAudios.map(tailOf),
      });
    }
    const modelReferenceImages = namedImageReferences.map((reference) => {
      const matchedAsset = assets.find((asset) => normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(reference.url));
      if (matchedAsset?.bytePlusAssetStatus === "Active" && matchedAsset.bytePlusAssetId) return `asset://${matchedAsset.bytePlusAssetId}`;
      return reference.url;
    });
    const referencedAssets = getReferencedAssets(rawTextWithMediaMentions, assets);
    const displayImageReferences = (namedImageReferences.length > 0 ? namedImageReferences : referenceImages.map((url, index) => ({ name: `图片${index + 1}`, url }))).slice(0, currentMaxReferenceImages);
    const text = rawTextWithMediaMentions || getImageOnlyPrompt(submitMode);
    // 语音生成：必须有文字（不能把空文本发去 TTS），且不吃"仅图片"那套占位提示。
    if (submitMode === "audio" && !rawTextWithMediaMentions.trim()) {
      showInputTip("请输入要转成语音的文字");
      setSessionSending(sessionId, false);
      return;
    }
    const generationMode: WorkMode = submitMode;
    const directVideoReferenceMode = generationMode === "video" && supportsVideoReferenceMode(generationModelsForSubmit.video) ? selectedVideoReferenceMode : undefined;
    if (generationMode === "video") {
      const referenceComboError = validateVideoReferenceCombination({ modelId: generationModelsForSubmit.video, referenceMode: directVideoReferenceMode, imageCount: referenceImages.length, videoCount: referenceVideos.length, audioCount: referenceAudios.length });
      if (referenceComboError) {
        showInputTip(referenceComboError);
        setSessionSending(sessionId, false);
        return;
      }
      // 参考图尺寸/比例不合规的，发送前就拦住并说清原因（否则会在平台"素材送审"/异步生成阶段被拒，
      // 用户只能看到一句没用的"服务器繁忙"）。受约束的模型集合由 videoModelEnforcesReferenceImageSizeRules
      // 唯一判定（BytePlus Seedance + Kling，两家的 300–6000px / 0.4–2.5 规则完全一致），
      // 没验证过的模型不在集合里、不会被误拦。规则与工作流、服务端共用。
      const referenceImageSizeError = videoModelEnforcesReferenceImageSizeRules(generationModelsForSubmit.video)
        ? await validateVideoReferenceImagesBeforeSend(
          namedImageReferences.map((reference) => {
            const matchedAsset = assets.find((asset) => normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(reference.url));
            const dimensions = getPreviewMetaDimensions(matchedAsset?.previewMeta);
            return { name: reference.name, url: reference.url, width: dimensions?.width, height: dimensions?.height };
          }),
          (url) => getStaticMediaUrl(url) ?? url,
        )
        : undefined;
      if (referenceImageSizeError) {
        showInputTip(referenceImageSizeError);
        setSessionSending(sessionId, false);
        return;
      }
      // ⭐ 某些模型「带参考图」时可用时长被上游收窄（如 Veo 3.1 的 reference_to_video 只允许 8 秒）。
      // 不拦的话任务会被收下、一两分钟后才异步失败，用户只看到"服务器繁忙"。规则唯一来源 models.ts。
      const referenceDurationError = validateVideoDurationWithReferences(
        generationModelsForSubmit.video,
        selectedVideoDuration,
        referenceImages.length,
      );
      if (referenceDurationError) {
        showInputTip(referenceDurationError);
        setSessionSending(sessionId, false);
        return;
      }
    }
    if (directVideoReferenceMode === "first_frame" && referenceImages.length < 1) {
      showInputTip("首帧生视频需要至少一张参考图");
      setSessionSending(sessionId, false);
      return;
    }
    if (directVideoReferenceMode === "last_frame" && referenceImages.length < 1) {
      showInputTip("尾帧生视频需要至少一张参考图");
      setSessionSending(sessionId, false);
      return;
    }
    if (directVideoReferenceMode === "first_last_frame" && referenceImages.length < 2) {
      showInputTip("首尾帧生视频需要至少两张参考图");
      setSessionSending(sessionId, false);
      return;
    }
    const userMessage: Message = { id: createClientId(), role: "user", content: rawTextWithMediaMentions, createdAt: nowTimestamp(), images: referenceImages.length > 0 ? referenceImages : undefined, imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined, uploadedFiles: availableUploadedFiles.length > 0 ? availableUploadedFiles : undefined };
    const payloadUserMessage: Message = { ...userMessage, content: text };
    const messagesWithoutSuggestions = sessionForSend.messages.map((message) => (message.suggestions ? { ...message, suggestions: undefined } : message));
    const optimisticMessages = [...messagesWithoutSuggestions, payloadUserMessage];
    const visibleOptimisticMessages = [...messagesWithoutSuggestions, userMessage];
    const isDirectGenerationMode = submitMode === "image" || submitMode === "video" || submitMode === "audio";
    const visibleMessages = isDirectGenerationMode ? activeSession.messages : visibleOptimisticMessages;
    addUploadedImagesToAssets(sessionId, sendUploadedImages, text);

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新对话" ? getSessionTitle(text) : session.title,
              updatedAt: Date.now(),
              messages: visibleMessages,
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );

    const correctionMode = getCorrectionMode(text);
    const previousUserMessage = getLastUserMessage(activeSession.messages);

    if (correctionMode && previousUserMessage) {
      rememberIntentCorrection(previousUserMessage.content, correctionMode);
    }

    if (submitMode === "agent") {
      const payloadMessages = toAgentPayloadMessages(optimisticMessages, referenceImages.length > 0, sessionForSend.memorySummary);
      if (referencedAssets.length > 0) {
        const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
        if (lastUserMessage) {
          lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
        }
      }

      const agentChatModelChain = getAgentAutoChatModelChain(enabledGeneralChatModelIds);
      if (agentChatModelChain.length === 0) {
        showInputTip("连接不到模型，请联系管理员！");
        setSessionSending(sessionId, false);
        return;
      }
      const pendingRequest: PendingGeneration = {
        id: createClientId(),
        model: selectedModel,
        mode: "agent",
        messages: payloadMessages,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined,
        referenceHint: getReferenceHint(namedImageReferences, text),
        needsIntentResolution: shouldPlanAgentTask(text) || suggestionRequestsGeneration(normalizedSuggestion),
        sourceText: text,
        agentChatModelChain,
        assetTargetType: normalizedSuggestion?.assetTargetType && normalizedSuggestion.assetTargetType !== "other" ? normalizedSuggestion.assetTargetType : undefined,
        selectedMediaModels: {
          image: generalModelsForSubmit.image,
          video: generalModelsForSubmit.video,
        },
        generalPreferenceAuto,
        generalMediaSettings: {
          imageRatio: generalImageRatio,
          imageResolution: generalImageResolution,
          videoRatio: generalVideoRatio,
          videoResolution: generalVideoResolution,
          videoDuration: selectedDurations.general,
        },
      };

      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新对话" ? getSessionTitle(text) : session.title,
                updatedAt: Date.now(),
                messages: visibleMessages,
                pendingRequest: undefined,
                pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
                draftInput: "",
                uploadedFiles: [],
                uploadedImages: [],
              }
            : session,
        ),
      );

      setSessionSending(sessionId, false);
      void runGeneration(sessionId, pendingRequest);
      return;
    }

    if (submitMode === "general") {
      const payloadMessages = toGeneralPayloadMessages(optimisticMessages, generalModelsForSubmit.chat, referenceImages.length > 0, sessionForSend.memorySummary);
      if (referencedAssets.length > 0) {
        const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
        if (lastUserMessage) lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
      }

      const pendingRequest: PendingGeneration = {
        id: createClientId(),
        model: generalModelsForSubmit.chat,
        mode: "general",
        messages: payloadMessages,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined,
        sourceText: text,
        referenceHint: getReferenceHint(namedImageReferences, text),
        selectedMediaModels: {
          image: generalModelsForSubmit.image,
          video: generalModelsForSubmit.video,
        },
        generalPreferenceAuto,
        generalMediaSettings: {
          imageRatio: generalImageRatio,
          imageResolution: generalImageResolution,
          videoRatio: generalVideoRatio,
          videoResolution: generalVideoResolution,
          videoDuration: selectedDurations.general,
        },
        needsIntentResolution: shouldPlanAgentTask(text) || suggestionRequestsGeneration(normalizedSuggestion),
      };
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新对话" ? getSessionTitle(text) : session.title,
                updatedAt: Date.now(),
                messages: visibleMessages,
                pendingRequest: undefined,
                pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
                draftInput: "",
                uploadedFiles: [],
                uploadedImages: [],
              }
            : session,
        ),
      );

      setSessionSending(sessionId, false);
      void runGeneration(sessionId, pendingRequest);
      return;
    }

    const payloadMessages = applyMemorySummaryToPayload(toChatPayloadMessages(optimisticMessages), sessionForSend.memorySummary);
    if (referencedAssets.length > 0) {
      const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
      if (lastUserMessage) {
        lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
      }
    }

    const isAgentAutoGeneration = false;
    const assetTargetType = normalizedSuggestion?.assetTargetType ?? getAssetTypeFromText(text, generationMode);
    const generationModel = isAgentAutoGeneration ? getAgentGenerationModel(agentModelTier, generationMode, generationModelsForSubmit, { sourceText: text, session: activeSession, feedbackLogs, enabledModels: enabledModelsForSubmit }) : generationMode === "image" ? generationModelsForSubmit.image : generationMode === "audio" ? generationModelsForSubmit.audio : generationModelsForSubmit.video;
    const shouldApplyVideoReferenceMode = generationMode === "video" && supportsVideoReferenceMode(generationModel);
    const effectiveReferenceImages = shouldApplyVideoReferenceMode ? getEffectiveVideoReferenceItems(referenceImages, generationModel, directVideoReferenceMode) : referenceImages;
    const effectiveModelReferenceImages = shouldApplyVideoReferenceMode ? getEffectiveVideoReferenceItems(modelReferenceImages, generationModel, directVideoReferenceMode) : modelReferenceImages;
    const effectiveDisplayImageReferences = shouldApplyVideoReferenceMode ? getEffectiveVideoReferenceItems(displayImageReferences, generationModel, directVideoReferenceMode) : displayImageReferences;
    if (shouldApplyVideoReferenceMode && referenceImages.length > effectiveReferenceImages.length) showInputTip(getVideoReferenceLimitHint(generationModel, directVideoReferenceMode));
    const agentSettings = isAgentAutoGeneration ? getAgentGenerationSettings(text, generationMode, generationModel) : undefined;
    const generationResolution = agentSettings?.resolution ?? (generationMode === "image" ? normalizeImageResolutionForModel(generationModel, selectedResolutions[modeForSettings]) : generationMode === "video" ? (selectedRatios.video === "智能比例" ? "720p" : normalizeVideoResolutionForModel(generationModel, selectedResolutions.video)) : selectedResolutions[modeForSettings]);
    const generationRatio = agentSettings?.ratio ?? (generationMode === "video" ? (selectedRatios.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(generationModel, selectedRatios.video, generationResolution)) : selectedRatios[modeForSettings]);
    const agentDisplayText = isAgentAutoGeneration ? getAgentMediaDisplayText(generationMode, text) : undefined;
    const pendingRequest: PendingGeneration = {
      id: createClientId(),
      model: generationModel,
      promptModel: isAgentAutoGeneration ? selectedModel : undefined,
      mode: generationMode,
      prompt: generationMode === "image" || generationMode === "video" || generationMode === "audio" ? text : undefined,
      originalPrompt: generationMode === "image" || generationMode === "video" || generationMode === "audio" ? text : undefined,
      preserveOriginalInput: false,
      assetTargetType: assetTargetType === "other" ? undefined : assetTargetType,
      referenceImages: (shouldApplyVideoReferenceMode ? effectiveModelReferenceImages : effectiveReferenceImages).length > 0 ? (shouldApplyVideoReferenceMode ? effectiveModelReferenceImages : effectiveReferenceImages) : undefined,
      referenceVideos: generationMode === "video" && referenceVideos.length > 0 ? referenceVideos : undefined,
      referenceAudios: ((generationMode === "video" || (generationMode === "audio" && submitAudioReferenceMode === "clone")) && referenceAudios.length > 0) ? referenceAudios : undefined,
      videoReferenceMode: directVideoReferenceMode,
      audioReferenceMode: generationMode === "audio" ? submitAudioReferenceMode : undefined,
      voice: generationMode === "audio" && submitAudioReferenceMode !== "clone" ? normalizeAudioVoiceForModel(generationModel, selectedAudioVoice) : undefined,
      emotion: generationMode === "audio" && submitAudioReferenceMode !== "clone" ? normalizeAudioEmotionForModel(generationModel, selectedAudioEmotion) : undefined,
      imageReferences: effectiveDisplayImageReferences.length > 0 ? effectiveDisplayImageReferences : undefined,
      referenceHint: getReferenceHint(effectiveDisplayImageReferences, text),
      agentGenerated: isAgentAutoGeneration,
      agentDisplayText,
      settings: agentSettings ?? {
        ratio: generationRatio,
        resolution: generationResolution,
        style: selectedStyle,
        duration: generationMode === "video" ? (modeForSettings === "video" ? selectedVideoDuration : selectedDurations.video) : undefined,
        imageCount: generationMode === "image" ? selectedImageCounts[modeForSettings] : undefined,
        quality: generationMode === "image" ? selectedImageQuality : undefined,
      },
      messages: payloadMessages,
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新对话" ? getSessionTitle(text) : session.title,
              updatedAt: Date.now(),
              messages: visibleMessages,
              pendingRequest: undefined,
              pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );

    if (generationMode === "image") {
      appendAssistantMessage(sessionId, {
        content: isAgentAutoGeneration ? agentDisplayText ?? "" : isDirectGenerationMode ? text : "",
        statusText: imageStatusLabels.creating,
        pendingImageCount: getImageCountValue(pendingRequest.settings?.imageCount ?? selectedImageCounts[modeForSettings], isAgentAutoGeneration ? Number.POSITIVE_INFINITY : 4),
        mode: generationMode,
        requestId: pendingRequest.id,
        imageReferences: pendingRequest.imageReferences,
        generationMeta: { mode: "image", model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated },
      });
    }

    if (generationMode === "video") {
      appendAssistantMessage(sessionId, {
        content: isAgentAutoGeneration ? agentDisplayText ?? "" : isDirectGenerationMode ? text : "",
        statusText: videoStatusLabels.creating,
        pendingVideoCount: 1,
        mode: generationMode,
        requestId: pendingRequest.id,
        imageReferences: pendingRequest.imageReferences,
        uploadedFiles: availableUploadedFiles.length > 0 ? availableUploadedFiles : undefined,
        generationMeta: { mode: "video", model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated, videoReferenceMode: pendingRequest.videoReferenceMode },
      });
    }

    if (generationMode === "audio") {
      appendAssistantMessage(sessionId, {
        content: isDirectGenerationMode ? text : "",
        statusText: "正在生成语音…",
        pendingAudioCount: 1,
        mode: generationMode,
        requestId: pendingRequest.id,
        uploadedFiles: availableUploadedFiles.length > 0 ? availableUploadedFiles : undefined,
        generationMeta: { mode: "audio", model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated, voice: pendingRequest.voice, emotion: isAudioEmotionSelectable(pendingRequest.model) ? normalizeAudioEmotionForModel(pendingRequest.model, pendingRequest.emotion) : undefined, audioReferenceMode: pendingRequest.audioReferenceMode },
      });
    }

    // ⭐⭐ 2026-08-08 加的**纯诊断日志**（⛔ 不改任何行为）：抓「发送后消息丢失 + 卡在『加载中...0%』」。
    //
    // 背景：2026-08-08 测试服真走界面发被内容审核拦截的提示词，**3 次里中了 1 次**：
    // 整屏「加载中...0%」、无红字、库里那条对话**标题存了但 msgs=0**。
    // 🗣️ 用户推翻了我"初始加载没好"的假设（输入框能用就说明加载完了）→ 是**发送触发**的。
    //
    // ⭐ 这条记「发送这一刻客户端手里到底有几条消息、会话的 messagesLoaded 是什么」——
    // 它和服务端 `workspace-session-messages-skipped` 配成一对，能把责任切干净：
    //   · 这里 localMessageCount > 0 且服务端出现 skipped  → **是那条持久化闸门吞的**；
    //   · 这里 localMessageCount > 0 但服务端没有 skipped → 消息在客户端后来被别的 setState 覆盖了；
    //   · 这里 localMessageCount === 0                    → 乐观插入压根没成功（往上查 visibleMessages）。
    // ⛔ 只在"异常形状"时记（messagesLoaded===false 或 一条消息都没有），正常发送不写日志、不刷量。
    {
      const sessionAtSend = sessionsRef.current.find((session) => session.id === sessionId);
      const localMessageCount = Array.isArray(sessionAtSend?.messages) ? sessionAtSend.messages.length : null;
      if (sessionAtSend && (sessionAtSend.messagesLoaded === false || localMessageCount === 0)) {
        reportClientDiagnostic("chat-send-suspicious-session-shape", {
          sessionId,
          generationMode,
          messagesLoaded: sessionAtSend.messagesLoaded ?? null,
          localMessageCount,
          titleLength: typeof sessionAtSend.title === "string" ? sessionAtSend.title.length : 0,
          requestId: pendingRequest.id,
        });
      }
    }

    setSessionSending(sessionId, false);
    void runGeneration(sessionId, pendingRequest);
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  useEffect(() => {
    if (!pendingHomePrompt || activeSessionId !== pendingHomePrompt.sessionId || activeSession?.id !== pendingHomePrompt.sessionId) return;

    const prompt = pendingHomePrompt.prompt;
    const timer = window.setTimeout(() => {
      setPendingHomePrompt(null);
      void sendMessageRef.current?.(prompt, "agent");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeSession?.id, activeSessionId, pendingHomePrompt]);

  const stopAgentThinking = () => {
    if (!activeSession) return;
    const agentRequests = getSessionPendingRequests(activeSession).filter((request) => request.mode === "agent" || request.mode === "general");
    if (agentRequests.length === 0) return;

    agentRequests.forEach((request) => {
      stoppedRequestIdsRef.current.add(request.id);
      requestAbortControllersRef.current.get(request.id)?.abort();
    });

    setSessions((current) =>
      current.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: getSessionPendingRequests(session).filter((request) => request.mode !== "agent" && request.mode !== "general"),
              messages: [
                ...session.messages,
                {
                  id: createClientId(),
                  role: "system",
                  content: "已中断思考",
                  mode: "agent",
                  createdAt: Date.now(),
                },
              ],
            }
          : session,
      ),
    );
    setSessionSending(activeSession.id, false);
  };

  const addFeedbackLog = useCallback((kind: FeedbackKind, message: Message) => {
    if (!activeSession) return;

    const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
    const context: Array<{ role: "user" | "assistant"; content: string }> = activeSession.messages
      .slice(Math.max(0, messageIndex - 6), messageIndex + 1)
      .filter((item) => item.role !== "system")
      .map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content.slice(0, 1200) }));

    setFeedbackLogs((current) => [
      {
        id: createClientId(),
        createdAt: Date.now(),
        kind,
        sessionId: activeSession.id,
        sessionTitle: activeSession.title,
        messageId: message.id,
        messageType: getMessageType(message),
        executionMode: message.mode,
        activeMode: mode,
        context,
        message: {
          content: message.content,
          images: message.images,
          videoUrl: message.videoUrl,
          statusText: message.statusText,
          error: message.error,
          mode: message.mode,
        },
        intentMemoryRules,
      },
      ...current,
    ].slice(0, MAX_FEEDBACK_LOGS));
  }, [activeSession, intentMemoryRules, mode]);

  const copyMessage = useCallback(async (message: Message) => {
    addFeedbackLog("copy", message);

    const showCopyFeedback = (state: "success" | "error") => {
      setCopyFeedback({ messageId: message.id, state });
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    };

    try {
      if (message.videoUrl) {
        showCopyFeedback("error");
        return;
      }

      if (message.images?.[0]) {
        await copyImageToClipboard(message.images[0]);
      } else {
        await navigator.clipboard.writeText(message.content);
      }

      showCopyFeedback("success");
    } catch {
      showCopyFeedback("error");
    }
  }, [addFeedbackLog]);

  const copyPrompt = useCallback(async (message: Message) => {
    try {
      // Restore the exact media the user generated with (images/videos/audio/documents),
      // not just what can be re-derived from @-mentions against the asset library.
      const restoreImages = (message.imageReferences ?? [])
        .filter((reference) => Boolean(reference.url))
        .map((reference) => toUploadedAssetReference({ name: reference.name, url: reference.url }));
      // 每条生成消息出生即钉下自己完整的引用包；使用提示词只读它自己那份，绝不回头翻上一条用户消息。
      const sourceFiles = message.uploadedFiles ?? [];
      const restoreFiles = sourceFiles
        .filter((file): file is UploadedDocumentFile => typeof file !== "string" && Boolean(file.url ?? file.storageName))
        .map((file) => ({ ...file, id: createClientId() }));
      setActiveDraftInputWithMentionCards(message.content, { images: restoreImages, files: restoreFiles });
      // ⭐ 纯日志、不改任何行为（2026-08-05 加）：记「使用提示词到底把哪几张图放回了输入框」。
      // 用户 ID_947011 的场景就是从这里起步的（还原两张 → 换掉第二张 → 发送带的还是老那张），
      // 没有这一条就对不上后面 `input-image-removed` / `send-reference-snapshot` 那两条现场。
      // ⚠️ 同时记提示词原文里的 @名：还原回来的文字里若带着老图的 @名，就是后面被从资产库捞回来的伏笔。
      reportClientDiagnostic("copy-prompt-restored", {
        fromMessageId: message.id,
        restoredImages: restoreImages.map((image) => `${image.referenceName ?? image.name}=${image.url.split("/").pop() ?? ""}`),
        restoredFiles: restoreFiles.map((file) => file.name),
        mentionNamesInPrompt: getMentionNames(message.content ?? ""),
        promptHead: (message.content ?? "").slice(0, 200),
      });
      requestAnimationFrame(() => editorRef.current?.focus());
      setCopyFeedback({ messageId: message.id, state: "success" });
    } catch {
      setCopyFeedback({ messageId: message.id, state: "error" });
    }

    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
      copyFeedbackTimerRef.current = null;
    }, 1000);
  }, [activeSession, sessions, setActiveDraftInputWithMentionCards]);

  const regenerateMessage = (message: Message) => {
    if (!activeSession || (message.generationMeta?.agentGenerated ? false : activeHasMaxPendingRequests)) return;
    if (message.role !== "assistant") return;

    addFeedbackLog("regenerate", message);

    const replayMeta = message.generationMeta;
    const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
    if (messageIndex < 0) return;
    const generationMode: WorkMode = replayMeta?.mode ?? (message.videoUrl ? "video" : message.images?.length || message.statusText || message.error ? "image" : message.mode === "agent" ? "agent" : mode);
    const previousUserMessage = [...activeSession.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user");
    const replayPrompt = generationMode === "image" || generationMode === "video" || generationMode === "audio" ? (replayMeta?.originalPrompt ?? message.content).trim() : (previousUserMessage?.content ?? "").trim();
    if (!replayPrompt) return;
    if (generationMode === "agent" && !previousUserMessage) return;

    const sessionId = activeSession.id;
    const replaySettings = replayMeta?.settings;
    const replayUploadedFiles = message.uploadedFiles ?? [];
    const replayReferenceVideos = getUploadedMediaReferences(replayUploadedFiles).filter((reference) => reference.mediaKind === "video").map((reference) => reference.url);
    const replayReferenceAudios = getUploadedMediaReferences(replayUploadedFiles).filter((reference) => reference.mediaKind === "audio").map((reference) => reference.url);
    const replayMessages: ChatPayloadMessage[] = activeSession.messages
      .slice(0, messageIndex)
      .filter((item) => item.id !== "seed-1" && item.role !== "system")
      .map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content, images: item.images }));
    const replayImageReferences = message.imageReferences?.length
      ? message.imageReferences
      : generationMode === "image" || generationMode === "video"
        ? getOrderedExplicitImageReferences(replayPrompt, assets, [], getConversationImageReferences(activeSession.messages.slice(0, messageIndex)))
        : previousUserMessage?.imageReferences;
    const referenceImages = replayImageReferences?.map((reference) => reference.url).filter(Boolean) ?? previousUserMessage?.images?.filter(Boolean);
    const replayModel = generationMode === "image" || generationMode === "video"
      ? (replayMeta?.model ?? (generationMode === "image" ? selectedGenerationModels.image : selectedGenerationModels.video))
      : generationMode === "audio"
        ? (replayMeta?.model ?? selectedGenerationModels.audio)
        : selectedModel;
    const replayResolution = generationMode === "image" ? normalizeImageResolutionForModel(replayModel, replaySettings?.resolution ?? selectedResolutions[generationMode]) : generationMode === "video" ? ((replaySettings?.ratio ?? selectedRatios.video) === "智能比例" ? "720p" : normalizeVideoResolutionForModel(replayModel, replaySettings?.resolution ?? selectedResolutions.video)) : replaySettings?.resolution ?? selectedResolutions[generationMode];
    const replayRatio = generationMode === "video" ? ((replaySettings?.ratio ?? selectedRatios.video) === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(replayModel, replaySettings?.ratio ?? selectedRatios.video, replayResolution)) : replaySettings?.ratio ?? selectedRatios[generationMode];
    const replayVideoReferenceMode = generationMode === "video" && supportsVideoReferenceMode(replayModel) ? selectedVideoReferenceMode : undefined;
    if (replayVideoReferenceMode === "first_frame" && (referenceImages?.length ?? 0) < 1) {
      showInputTip("首帧生视频需要至少一张参考图");
      return;
    }
    if (replayVideoReferenceMode === "last_frame" && (referenceImages?.length ?? 0) < 1) {
      showInputTip("尾帧生视频需要至少一张参考图");
      return;
    }
    if (replayVideoReferenceMode === "first_last_frame" && (referenceImages?.length ?? 0) < 2) {
      showInputTip("首尾帧生视频需要至少两张参考图");
      return;
    }
    const shouldApplyReplayVideoReferenceMode = generationMode === "video" && supportsVideoReferenceMode(replayModel);
    const effectiveReplayReferenceImages = shouldApplyReplayVideoReferenceMode ? getEffectiveVideoReferenceItems(referenceImages, replayModel, replayVideoReferenceMode) : referenceImages;
    const effectiveReplayImageReferences = shouldApplyReplayVideoReferenceMode ? getEffectiveVideoReferenceItems(replayImageReferences, replayModel, replayVideoReferenceMode) : replayImageReferences;
    if (shouldApplyReplayVideoReferenceMode && (referenceImages?.length ?? 0) > (effectiveReplayReferenceImages?.length ?? 0)) showInputTip(getVideoReferenceLimitHint(replayModel, replayVideoReferenceMode));
    const pendingRequest: PendingGeneration = {
      id: createClientId(),
      model: replayModel,
      promptModel: replayMeta?.agentGenerated ? selectedModel : undefined,
      mode: generationMode,
      prompt: generationMode === "image" || generationMode === "video" || generationMode === "audio" ? replayPrompt : undefined,
      originalPrompt: generationMode === "image" || generationMode === "video" || generationMode === "audio" ? replayPrompt : undefined,
      preserveOriginalInput: false,
      referenceImages: effectiveReplayReferenceImages && effectiveReplayReferenceImages.length > 0 ? effectiveReplayReferenceImages : undefined,
      referenceVideos: generationMode === "video" && replayReferenceVideos.length > 0 ? replayReferenceVideos : undefined,
      referenceAudios: ((generationMode === "video" || (generationMode === "audio" && replayMeta?.audioReferenceMode === "clone")) && replayReferenceAudios.length > 0) ? replayReferenceAudios : undefined,
      videoReferenceMode: replayVideoReferenceMode,
      audioReferenceMode: generationMode === "audio" ? normalizeAudioReferenceModeForModel(replayModel, replayMeta?.audioReferenceMode ?? selectedAudioReferenceMode) : undefined,
      voice: generationMode === "audio" && replayMeta?.audioReferenceMode !== "clone" ? normalizeAudioVoiceForModel(replayModel, selectedAudioVoice) : undefined,
      emotion: generationMode === "audio" && replayMeta?.audioReferenceMode !== "clone" ? normalizeAudioEmotionForModel(replayModel, selectedAudioEmotion) : undefined,
      imageReferences: effectiveReplayImageReferences && effectiveReplayImageReferences.length > 0 ? effectiveReplayImageReferences : undefined,
      referenceHint: effectiveReplayImageReferences && effectiveReplayImageReferences.length > 0 ? getReferenceHint(effectiveReplayImageReferences, replayPrompt) : undefined,
      assetTargetType: replayMeta?.assetTargetType,
      agentGenerated: replayMeta?.agentGenerated,
      agentDisplayText: replayMeta?.agentGenerated ? message.content : undefined,
      agentItemPrompts: replayMeta?.itemPrompts,
      agentItemPromptDetails: replayMeta?.itemPromptDetails,
      settings:
        generationMode === "agent"
          ? undefined
          : {
              ratio: replayRatio,
              resolution: replayResolution,
              style: selectedStyle,
              duration: generationMode === "video" ? (replaySettings?.duration ?? selectedVideoDuration) : undefined,
              imageCount: generationMode === "image" ? (replaySettings?.imageCount ?? selectedImageCounts[generationMode]) : undefined,
              quality: generationMode === "image" ? (replaySettings?.quality ?? selectedImageQuality) : undefined,
            },
      messages: replayMessages,
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
            }
          : session,
      ),
    );
    if (generationMode === "image" || generationMode === "video") {
      appendAssistantMessage(sessionId, {
        content: replayMeta?.agentGenerated ? message.content : replayPrompt,
        statusText: generationMode === "video" ? videoStatusLabels.creating : imageStatusLabels.creating,
        pendingImageCount: generationMode === "image" ? getImageCountValue(replaySettings?.imageCount ?? selectedImageCounts[generationMode], replayMeta?.agentGenerated ? Number.POSITIVE_INFINITY : 4) : undefined,
        pendingVideoCount: generationMode === "video" ? Math.max(1, replayMeta?.itemPrompts?.length ?? 1) : undefined,
        mode: generationMode,
        requestId: pendingRequest.id,
        imageReferences: pendingRequest.imageReferences,
        uploadedFiles: replayUploadedFiles.length > 0 ? replayUploadedFiles : undefined,
        generationMeta: generationMode === "image" || generationMode === "video" ? { mode: generationMode, model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated, itemPrompts: pendingRequest.agentItemPrompts, itemPromptDetails: pendingRequest.agentItemPromptDetails, videoReferenceMode: pendingRequest.videoReferenceMode } : undefined,
      });
    }
    if (generationMode === "audio") {
      appendAssistantMessage(sessionId, {
        content: replayPrompt,
        statusText: "正在生成语音…",
        pendingAudioCount: 1,
        mode: "audio",
        requestId: pendingRequest.id,
        uploadedFiles: replayUploadedFiles.length > 0 ? replayUploadedFiles : undefined,
        generationMeta: { mode: "audio", model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated, voice: pendingRequest.voice, emotion: isAudioEmotionSelectable(pendingRequest.model) ? normalizeAudioEmotionForModel(pendingRequest.model, pendingRequest.emotion) : undefined, audioReferenceMode: pendingRequest.audioReferenceMode },
      });
    }
    void runGeneration(sessionId, pendingRequest);
  };

  // 「重新生成」：用**原提示词**重跑同一个失败槽位（其余参数、参考图完全不变）。
  // 返回的 Promise 在这次生成彻底跑完（成功或失败）后 resolve。
  const retryFailedMedia = async (message: Message, failedIndex = 0) => {
    if (!activeSession || message.role !== "assistant") return;
    const meta = message.generationMeta;
    if (!meta || (meta.mode !== "image" && meta.mode !== "video")) return;
    const existingMediaCount = meta.mode === "video" ? getMessageVideos(message).length : message.images?.length ?? 0;
    const targetItemIndex = existingMediaCount + Math.max(0, failedIndex);
    const prompt = (((meta.mode === "video" || meta.agentGenerated ? meta.itemPrompts?.[targetItemIndex] ?? meta.originalPrompt : meta.originalPrompt) ?? "")).trim();
    if (!prompt) return;

    const sessionId = activeSession.id;
    const retryKey = `${sessionId}:${message.id}:${failedIndex}`;
    if (retryingFailedMediaKeysRef.current.has(retryKey)) return;
    retryingFailedMediaKeysRef.current.add(retryKey);
    try {
    const requestId = createClientId();
    const retryStartedAt = Date.now();
    const retryMediaReferences = getUploadedMediaReferences(message.uploadedFiles);
    const retryReferenceVideos = retryMediaReferences.filter((reference) => reference.mediaKind === "video").map((reference) => reference.url);
    const retryReferenceAudios = retryMediaReferences.filter((reference) => reference.mediaKind === "audio").map((reference) => reference.url);
    const pendingRequest: PendingGeneration = {
      id: requestId,
      model: meta.model,
      mode: meta.mode,
      prompt,
      originalPrompt: prompt,
      preserveOriginalInput: meta.preserveOriginalInput,
      referenceImages: message.imageReferences?.map((reference) => reference.url).filter(Boolean),
      referenceVideos: meta.mode === "video" && retryReferenceVideos.length > 0 ? retryReferenceVideos : undefined,
      referenceAudios: meta.mode === "video" && retryReferenceAudios.length > 0 ? retryReferenceAudios : undefined,
      imageReferences: message.imageReferences,
      referenceHint: message.imageReferences?.length ? getReferenceHint(message.imageReferences, prompt) : undefined,
      assetTargetType: meta.assetTargetType,
      agentGenerated: meta.agentGenerated,
      agentDisplayText: meta.agentGenerated ? message.content : undefined,
      agentItemPrompts: meta.mode === "video" ? [prompt] : undefined,
      agentItemPromptDetails: meta.itemPromptDetails?.[targetItemIndex] ? [meta.itemPromptDetails[targetItemIndex]] : undefined,
      retryFailedIndex: failedIndex,
      suppressContentModerationRecord: true,
      settings: meta.mode === "image" ? { ...meta.settings, imageCount: "1张" } : meta.settings,
      messages: activeSession.messages.filter((item) => item.role !== "system").map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content, images: item.images })),
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
              messages: session.messages.map((item) =>
                item.id === message.id
                  ? {
                      ...item,
                      requestId,
                      statusText: meta.mode === "video" ? videoStatusLabels.creating : imageStatusLabels.creating,
                      imageResultSlots: meta.mode === "image" ? (() => {
                        let failedOrdinal = -1;
                        const requestedCount = getRequestedImageDisplayCount(item) ?? Math.max(1, (item.images?.length ?? 0) + (item.failedImageCount ?? 0) + (item.pendingImageCount ?? 0));
                        const currentSlots: ImageResultSlot[] = item.imageResultSlots ?? [
                          ...(item.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: item.failedImageCount ?? 0 }).map(() => ({ type: "failed" as const })),
                          ...Array.from({ length: item.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: item.createdAt })),
                        ];
                        while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: item.createdAt });
                        return currentSlots.map((slot) => {
                          if (slot.type !== "failed") return slot;
                          failedOrdinal += 1;
                          return failedOrdinal === failedIndex ? { type: "failed" as const, retryingStartedAt: retryStartedAt, reason: slot.reason } : slot;
                        }).slice(0, requestedCount);
                      })() : item.imageResultSlots,
                      retryingFailedImageIndexes: meta.mode === "image" ? Array.from(new Set([...(item.retryingFailedImageIndexes ?? []), failedIndex])) : item.retryingFailedImageIndexes,
                      retryingFailedImageStartedAt: meta.mode === "image" ? { ...(item.retryingFailedImageStartedAt ?? {}), [failedIndex]: retryStartedAt } : item.retryingFailedImageStartedAt,
                      retryingFailedVideoIndexes: meta.mode === "video" ? Array.from(new Set([...(item.retryingFailedVideoIndexes ?? []), failedIndex])) : item.retryingFailedVideoIndexes,
                      retryingFailedVideoStartedAt: meta.mode === "video" ? { ...(item.retryingFailedVideoStartedAt ?? {}), [failedIndex]: retryStartedAt } : item.retryingFailedVideoStartedAt,
                      error: (() => {
                        if (meta.mode === "image") {
                          const failedCount = Math.max(0, item.failedImageCount ?? 0);
                          const retryingIndexes = Array.from(new Set([...(item.retryingFailedImageIndexes ?? []), failedIndex]));
                          return failedCount > 0 && retryingIndexes.length >= failedCount ? undefined : item.error;
                        }

                        if (meta.mode === "video") {
                          const failedCount = Math.max(0, item.failedVideoCount ?? 0);
                          const retryingIndexes = Array.from(new Set([...(item.retryingFailedVideoIndexes ?? []), failedIndex]));
                          return failedCount > 0 && retryingIndexes.length >= failedCount ? undefined : item.error;
                        }

                        return undefined;
                      })(),
                    }
                  : item,
              ),
            }
          : session,
      ),
    );

    await runGeneration(sessionId, pendingRequest);
    } finally {
      retryingFailedMediaKeysRef.current.delete(retryKey);
    }
  };

  const submitFeedback = useCallback((kind: FeedbackKind, message: Message) => {
    addFeedbackLog(kind, message);

    if (kind === "wrong_mode" && activeSession) {
      const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
      const previousUserMessage = [...activeSession.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user");
      const correctedMode: IntentMode = message.mode === "video" ? "image" : "video";

      if (previousUserMessage) {
        rememberIntentCorrection(previousUserMessage.content, correctedMode);
      }
    }
  }, [activeSession, addFeedbackLog, rememberIntentCorrection]);

  const copyMessageTextOnly = useCallback(async (message: Message) => {
    setOpenMessageMenuId("");

    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      setCopyFeedback({ messageId: message.id, state: "error" });
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    }
  }, []);

  const copyUserMessageText = useCallback(async (message: Message) => {
    const showCopyFeedback = (state: "success" | "error") => {
      setCopyFeedback({ messageId: message.id, state });
      if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    };

    try {
      await navigator.clipboard.writeText(message.content);
      showCopyFeedback("success");
    } catch {
      showCopyFeedback("error");
    }
  }, []);

  const deleteAssistantMessage = useCallback((messageId: string) => {
    setOpenMessageMenuId("");
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.filter((message) => message.id !== messageId),
            }
          : session,
      ),
    );
  }, [activeSessionId]);

  const toggleReaction = useCallback((kind: "like" | "dislike", message: Message) => {
    setMessageReactions((current) => {
      const next = { ...current };

      if (next[message.id] === kind) {
        delete next[message.id];
        return next;
      }

      next[message.id] = kind;
      return next;
    });
    addFeedbackLog(kind, message);
  }, [addFeedbackLog]);

  const toggleIssueFeedback = useCallback((kind: "wrong" | "wrong_mode", message: Message) => {
    setMessageIssueFeedback((current) => {
      const next = { ...current };

      if (next[message.id] === kind) {
        delete next[message.id];
        return next;
      }

      next[message.id] = kind;
      return next;
    });
    submitFeedback(kind, message);
  }, [submitFeedback]);

  const addFilesToInput = useCallback(async (files: File[]) => {
    const tips = new Set<string>();
    const imageFiles: File[] = [];
    const uploadFiles: Array<{ file: File; media?: { mediaKind?: "document" | "video" | "audio"; durationSeconds?: number; dimensions?: ImageDimensions } }> = [];
    let acceptedImageCount = 0;
    let acceptedFileCount = 0;
    let acceptedVideoCount = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "video").length;
    let acceptedAudioCount = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "audio").length;
    let acceptedVideoDuration = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "video").reduce((sum, file) => sum + getUploadedMediaDuration(file), 0);
    let acceptedAudioDuration = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "audio").reduce((sum, file) => sum + getUploadedMediaDuration(file), 0);
    const maxImages = currentUploadRule.image.maxCount;
    const maxUploadFiles = currentUploadRule.document.maxCount + currentUploadRule.video.maxCount + currentUploadRule.audio.maxCount;
    const remainingImages = Math.max(0, maxImages - activeUploadedImages.length);
    const remainingDocuments = Math.max(0, maxUploadFiles - activeUploadedFiles.length);

    for (const file of files) {
      const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : getUploadKindFromFileName(file.name || file.type);
      const extension = getFileExtension(file.name) || getMimeFileExtension(file.type);

      if (kind === "image") {
        const validationError = validateImageUploadFile(file);
        // ⭐ 纯日志、不改任何行为（2026-08-05 加）：任何"用户选了图、但这张图没进输入框"的分支都留痕。
        // 用户 ID_947011 报「传了新图，发送出去还是老图」，而正式服那次是**零上传** ——
        // 磁盘没有新文件、upload-diagnostics 也没有任何记录，因为图是被丢在**客户端**的，
        // 服务端压根不知道发生过。⛔ 没有这条，下次照样只能靠磁盘时间戳倒推、且分不清是哪条分支丢的。
        const dropReason = !currentUploadRule.image.enabled
          ? "model-disallows-image"
          : validationError
            ? "validation-failed"
            : acceptedImageCount >= remainingImages
              ? "reference-image-limit"
              : undefined;
        if (dropReason) {
          reportClientDiagnostic("input-image-dropped-before-upload", {
            reason: dropReason,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            validationError,
            maxImages,
            remainingImages,
            currentImageCount: activeUploadedImages.length,
          });
        }
        if (!currentUploadRule.image.enabled) {
          tips.add("当前模型不支持上传图片");
        } else if (validationError) {
          tips.add(validationError);
        } else if (acceptedImageCount >= remainingImages) {
          tips.add(`当前模型最多支持 ${maxImages} 张参考图，不能上传更多图片`);
        } else {
          imageFiles.push(file);
          acceptedImageCount += 1;
        }
        continue;
      }

      if (kind === "document") {
        if (!currentUploadRule.document.enabled) {
          tips.add("当前模型不支持上传文件");
        } else if (!currentUploadRule.document.formats.includes(extension)) {
          tips.add("当前模型不支持该文件格式");
        } else if (file.size > currentUploadRule.document.maxSizeMb * 1024 * 1024) {
          tips.add(`当前模型支持的单个文件最大为 ${currentUploadRule.document.maxSizeMb}MB`);
        } else if (acceptedFileCount >= remainingDocuments) {
          tips.add(`当前模型最多支持 ${maxUploadFiles} 个文件`);
        } else {
          uploadFiles.push({ file, media: { mediaKind: "document" } });
          acceptedFileCount += 1;
        }
        continue;
      }

      if (kind === "video") {
        if (!currentUploadRule.video.enabled) {
          tips.add(getVideoAudioUploadDisabledMessage({ modelId: selectedGenerationModel, videoReferenceMode: mode === "video" && isSelectedVideoReferenceModeModel ? selectedVideoReferenceMode : undefined }));
        } else if (validateMediaUploadFile(file, "video")) {
          tips.add(validateMediaUploadFile(file, "video")!);
        } else if (acceptedVideoCount >= currentUploadRule.video.maxCount) {
          tips.add(`当前模型最多支持 ${currentUploadRule.video.maxCount} 个参考视频`);
        } else if (acceptedFileCount >= remainingDocuments) {
          tips.add(`当前模型最多支持 ${maxUploadFiles} 个文件`);
        } else {
          try {
            const media = await readMediaFileMetadata(file, "video");
            const durationError = validateMediaUploadMetadata("video", { durationSeconds: media.durationSeconds, width: media.dimensions?.width, height: media.dimensions?.height, fps: 24 }, { minSeconds: currentUploadRule.video.minSeconds, maxSeconds: currentUploadRule.video.maxSeconds });
            const dimensionError = undefined;
            const nextTotal = acceptedVideoDuration + (media.durationSeconds ?? 0);
            if (durationError) tips.add(durationError);
            else if (dimensionError) tips.add(dimensionError);
            else if (currentUploadRule.video.maxTotalSeconds !== undefined && nextTotal > currentUploadRule.video.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) tips.add(`参考视频总时长不能超过 ${currentUploadRule.video.maxTotalSeconds} 秒`);
            else {
              uploadFiles.push({ file, media: { mediaKind: "video", ...media } });
              acceptedVideoCount += 1;
              acceptedVideoDuration = nextTotal;
              acceptedFileCount += 1;
            }
          } catch (error) {
            tips.add(toUserErrorMessage(error, "视频信息读取失败"));
          }
        }
        continue;
      }

      if (kind === "audio") {
        if (!currentUploadRule.audio.enabled) {
          tips.add(getVideoAudioUploadDisabledMessage({ modelId: selectedGenerationModel, videoReferenceMode: mode === "video" && isSelectedVideoReferenceModeModel ? selectedVideoReferenceMode : undefined }));
        } else if (validateMediaUploadFile(file, "audio")) {
          tips.add(validateMediaUploadFile(file, "audio")!);
        } else if (acceptedAudioCount >= currentUploadRule.audio.maxCount) {
          tips.add(`当前模型最多支持 ${currentUploadRule.audio.maxCount} 个参考音频`);
        } else if (acceptedFileCount >= remainingDocuments) {
          tips.add(`当前模型最多支持 ${maxUploadFiles} 个文件`);
        } else {
          try {
            const media = await readMediaFileMetadata(file, "audio");
            const durationError = validateMediaUploadMetadata("audio", { durationSeconds: media.durationSeconds }, { minSeconds: currentUploadRule.audio.minSeconds, maxSeconds: currentUploadRule.audio.maxSeconds });
            const nextTotal = acceptedAudioDuration + (media.durationSeconds ?? 0);
            if (durationError) tips.add(durationError);
            else if (currentUploadRule.audio.maxTotalSeconds !== undefined && nextTotal > currentUploadRule.audio.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) tips.add(`参考音频总时长不能超过 ${currentUploadRule.audio.maxTotalSeconds} 秒`);
            else {
              uploadFiles.push({ file, media: { mediaKind: "audio", ...media } });
              acceptedAudioCount += 1;
              acceptedAudioDuration = nextTotal;
              acceptedFileCount += 1;
            }
          } catch (error) {
            tips.add(toUserErrorMessage(error, "音频信息读取失败"));
          }
        }
        continue;
      }

      tips.add("暂不支持该文件类型");
    }

    Array.from(tips).slice(0, 3).forEach((tip) => showInputTip(tip));

    if (uploadFiles.length > 0) {
      const documentEntries = uploadFiles.map((item) => createUploadedDocumentEntry(item.file, item.media));
      setSessions((current) =>
        current.map((session) => {
          if (session.id !== activeSessionId) return session;
          const existingFiles = session.uploadedFiles ?? [];
          const existingKeys = new Set(existingFiles.map(getUploadedFileStorageValue));
          const nextFiles = [...existingFiles, ...documentEntries.filter((file) => !existingKeys.has(file.storageName))].slice(0, maxUploadFiles);
          return { ...session, uploadedFiles: nextFiles, updatedAt: Date.now() };
        }),
      );

      uploadFiles.forEach(({ file, media }, index) => {
        const entry = documentEntries[index];
        if (!entry) return;

        void uploadDocumentFileAsset(file, { conversationId: activeSessionId, mediaKind: media?.mediaKind, durationSeconds: media?.durationSeconds, dimensions: media?.dimensions }, (progress) => {
          setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, uploadProgress: progress, uploadStatus: "uploading" } : item) } : session));
        })
          .then(({ url, duplicate, name: serverName, posterUrl }) => {
            if (duplicate) showInputTip(`${media?.mediaKind === "video" ? "视频" : media?.mediaKind === "audio" ? "音频" : "文件"}已存在，无需重复上传！`);
            setSessions((current) => current.map((session) => {
              if (session.id !== activeSessionId) return session;
              const list = session.uploadedFiles ?? [];
              let nextName: string | undefined;
              if (serverName) {
                const usedNames = new Set(list.filter((item) => typeof item !== "string" && item.id !== entry.id).map((item) => (typeof item === "string" ? "" : item.name)).filter(Boolean));
                nextName = makeUniqueReferenceName(serverName, usedNames);
              }
              return { ...session, uploadedFiles: list.map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, url, posterUrl, ...(nextName ? { name: nextName } : {}), uploadProgress: 100, uploadStatus: "ready" } : item) };
            }));
          })
          .catch((error) => {
            setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, uploadProgress: 100, uploadStatus: "error", error: item.error ?? toUserErrorMessage(error, "上传失败") } : item) } : session));
          });

        if (!isReadableDocumentFile(file)) return;

        void readDocumentFileText(file, (progress) => {
          setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, progress, status: "reading" } : item) } : session));
        })
          .then((text) => {
            setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, text, progress: 100, status: "ready", error: undefined } : item) } : session));
          })
          .catch((error) => {
            setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, progress: 100, status: "error", error: toUserErrorMessage(error, "读取失败") } : item) } : session));
          });
      });
    }

    if (imageFiles.length === 0) return;

    const imageResults = await Promise.allSettled(imageFiles.map(readFileAsUploadedImage));
    const images = imageResults.filter((result): result is PromiseFulfilledResult<UploadedImage> => result.status === "fulfilled").map((result) => result.value);
    const imageError = imageResults.find((result) => result.status === "rejected");
    if (imageError) showInputTip("图片读取失败");
    addActiveUploadedImages(images);

    images.forEach((image) => {
      const controller = new AbortController();
      inputImageUploadAbortControllersRef.current.set(image.id, controller);
      void uploadTemporaryAssetImageAndCommit(image.uploadFile as File, (progress) => {
        setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === image.id ? { ...item, uploadProgress: progress, uploadStatus: "uploading" } : item) } : session));
      }, controller.signal, false, true)
        .then((result) => {
          inputImageUploadAbortControllersRef.current.delete(image.id);
          // ⭐ 上传完已经当场转正，这里拿到的就是 /generated 正式地址（见 uploadTemporaryAssetImageAndCommit）。
          // tempToken 一律清空：没有"待转正"的东西了，发送那一刻不再有可失败的网络请求。
          const nextHash = result.contentHash;
          const serverName = result.name;
          if (result.duplicate) showInputTip("图片已存在，无需重复上传！");
          setSessions((current) => current.map((session) => {
            if (session.id !== activeSessionId) return session;
            const list = session.uploadedImages ?? [];
            // 引用名一律用服务端权威名；同框内再兜底去重保证唯一。
            const usedNames = new Set(list.filter((item) => item.id !== image.id).map((item) => item.referenceName).filter((name): name is string => Boolean(name)));
            const referenceName = serverName ? makeUniqueReferenceName(serverName, usedNames) : undefined;
            return { ...session, uploadedImages: list.map((item) => item.id === image.id ? { ...item, tempToken: undefined, url: result.url || item.url, contentHash: nextHash, ...(referenceName ? { referenceName } : {}), uploadProgress: 100, uploadStatus: "ready", forceReencode: undefined, error: undefined } : item) };
          }));
        })
          .catch((error) => {
            inputImageUploadAbortControllersRef.current.delete(image.id);
            if (controller.signal.aborted) return;
            const errorMessage = toUserErrorMessage(error, "上传失败");
            reportClientDiagnostic("input-image-upload failed", { fileName: image.name, error: errorMessage, rawError: error instanceof Error ? error.message : String(error) });
          setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === image.id ? { ...item, uploadProgress: 100, uploadStatus: "error", error: errorMessage } : item) } : session));
        });
    });
  }, [activeSessionId, activeUploadedFiles, activeUploadedImages.length, addActiveUploadedImages, currentUploadRule, showInputTip]);

  const retryInputImageUpload = useCallback((imageId: string) => {
    const image = activeUploadedImages.find((item) => item.id === imageId);
    if (!image?.uploadFile) {
      showInputTip("请重新选择图片");
      return;
    }
    inputImageUploadAbortControllersRef.current.get(imageId)?.abort();
    inputImageUploadAbortControllersRef.current.delete(imageId);
    const controller = new AbortController();
    inputImageUploadAbortControllersRef.current.set(imageId, controller);
    setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === imageId ? { ...item, tempToken: undefined, uploadProgress: 6, uploadStatus: "uploading", forceReencode: true, error: undefined } : item) } : session));
    void uploadTemporaryAssetImageAndCommit(image.uploadFile, (progress) => {
      setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === imageId ? { ...item, uploadProgress: progress, uploadStatus: "uploading" } : item) } : session));
    }, controller.signal, true, true)
      .then((result) => {
        inputImageUploadAbortControllersRef.current.delete(imageId);
        // ⭐ 同上：上传完已当场转正，拿到的就是正式地址，tempToken 一律清空。
        const nextHash = result.contentHash;
        const serverName = result.name;
        if (result.duplicate) showInputTip("图片已存在，无需重复上传！");
        setSessions((current) => current.map((session) => {
          if (session.id !== activeSessionId) return session;
          const list = session.uploadedImages ?? [];
          const usedNames = new Set(list.filter((item) => item.id !== imageId).map((item) => item.referenceName).filter((name): name is string => Boolean(name)));
          const referenceName = serverName ? makeUniqueReferenceName(serverName, usedNames) : undefined;
          return { ...session, uploadedImages: list.map((item) => item.id === imageId ? { ...item, tempToken: undefined, url: result.url || item.url, contentHash: nextHash, ...(referenceName ? { referenceName } : {}), uploadProgress: 100, uploadStatus: "ready", forceReencode: undefined, error: undefined } : item) };
        }));
      })
      .catch((error) => {
        inputImageUploadAbortControllersRef.current.delete(imageId);
        if (controller.signal.aborted) return;
        const errorMessage = toUserErrorMessage(error, "上传失败");
        reportClientDiagnostic("input-image-upload retry failed", { fileName: image.name, error: errorMessage, rawError: error instanceof Error ? error.message : String(error) });
        setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === imageId ? { ...item, uploadProgress: 100, uploadStatus: "error", error: errorMessage } : item) } : session));
      });
  }, [activeSessionId, activeUploadedImages, showInputTip]);

  const hasDraggedFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  const clearDragUploadOverlay = useCallback(() => {
    dragUploadDepthRef.current = 0;
    setIsDragUploadActive(false);
  }, []);
  const handleChatDragEnter = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    if (activePanel === "assets" && !assetsUploadKind) return;
    event.preventDefault();
    event.stopPropagation();
    dragUploadDepthRef.current += 1;
    setIsDragUploadActive(true);
  };
  const handleChatDragOver = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleChatDragLeave = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragUploadDepthRef.current = Math.max(0, dragUploadDepthRef.current - 1);
    if (dragUploadDepthRef.current === 0) setIsDragUploadActive(false);
  };
  const handleChatDrop = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearDragUploadOverlay();
    if (activePanel === "workflow") return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;
    if (activePanel === "assets") {
      if (assetsUploadKind === "image") void selectAssetUploadFiles(files);
      else if (assetsUploadKind === "video") void selectAssetMediaUploadFiles("video", files);
      else if (assetsUploadKind === "audio") void selectAssetMediaUploadFiles("audio", files);
      return;
    }
    void addFilesToInput(files);
  };

  useEffect(() => {
    const handleWindowDrop = (event: globalThis.DragEvent) => {
      if (!Array.from(event.dataTransfer?.types ?? []).includes("Files")) return;
      clearDragUploadOverlay();
    };
    const handleWindowDragEnd = () => clearDragUploadOverlay();
    window.addEventListener("drop", handleWindowDrop, true);
    window.addEventListener("dragend", handleWindowDragEnd, true);
    return () => {
      window.removeEventListener("drop", handleWindowDrop, true);
      window.removeEventListener("dragend", handleWindowDragEnd, true);
    };
  }, [clearDragUploadOverlay]);

  const focusEditorAt = useCallback((offset: number) => {
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      setSelectionTextOffset(editor, offset);
      setDraftCursorOffset(offset);
    });
  }, []);
  // 选中文本后点 @文件名 时覆盖选中区：返回选区起止（无选区则回退到 draftCursorOffset，保持原插入位置行为）。
  const getCurrentDraftSelection = useCallback(() => {
    const editor = editorRef.current;
    const length = activeInput.length;
    const storedCursor = Math.min(Math.max(0, draftCursorOffset), length);
    if (!editor) return { start: storedCursor, end: storedCursor };
    const range = getSelectionTextRange(editor);
    const start = Math.min(Math.max(0, range.start), length);
    const end = Math.min(Math.max(0, range.end), length);
    if (start === end) return { start: storedCursor, end: storedCursor };
    return { start, end };
  }, [activeInput.length, draftCursorOffset]);
  const insertTextAtDraftCursor = useCallback((text: string) => {
    const { start, end } = getCurrentDraftSelection();
    const nextInput = `${activeInput.slice(0, start)}${text}${activeInput.slice(end)}`;
    setActiveDraftInput(nextInput);
    focusEditorAt(start + text.length);
  }, [activeInput, focusEditorAt, getCurrentDraftSelection, setActiveDraftInput]);
  const mentionMediaIntoInput = useCallback((url: string, name: string) => {
    if (activeUploadedImages.length >= currentMaxReferenceImages && !activeUploadedImages.some((image) => image.url === url)) {
      showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
      return;
    }
    setActivePanel("chat");
    const { start, end } = getCurrentDraftSelection();
    addActiveUploadedImages([toUploadedAssetReference({ name, url })], { draftBase: activeInput.slice(0, start), draftSuffix: activeInput.slice(end), insertReferenceText: true });
    focusEditorAt(start + name.length + 2);
  }, [activeInput, activeUploadedImages, addActiveUploadedImages, currentMaxReferenceImages, focusEditorAt, getCurrentDraftSelection, setActivePanel, showInputTip]);
  const mentionAudioIntoInput = useCallback((url: string, name: string) => {
    const already = activeUploadedFiles.some((file) => typeof file !== "string" && Boolean(file.url) && normalizeMediaUrlForMatch(file.url!) === normalizeMediaUrlForMatch(url));
    const existingCount = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "audio").length;
    const maxAudio = currentUploadRule.audio.maxCount;
    if (!already && maxAudio > 0 && existingCount >= maxAudio) {
      showInputTip(`当前模型最多支持 ${maxAudio} 个参考音频`);
      return;
    }
    setActivePanel("chat");
    const { start, end } = getCurrentDraftSelection();
    addActiveUploadedMediaReference({ id: url, type: "other", name, url, mediaType: "audio", sourcePrompt: "", sessionId: activeSessionId ?? "", createdAt: 0 }, "audio", {}, { draftBase: activeInput.slice(0, start), draftSuffix: activeInput.slice(end) });
    focusEditorAt(start + name.length + 2);
  }, [activeInput, activeSessionId, activeUploadedFiles, addActiveUploadedMediaReference, currentUploadRule.audio.maxCount, focusEditorAt, getCurrentDraftSelection, setActivePanel, showInputTip]);
  const focusCharacterEditorAt = useCallback((offset: number) => {
    requestAnimationFrame(() => {
      const editor = characterEditorRef.current;
      if (!editor) return;
      editor.focus();
      setSelectionTextOffset(editor, offset);
      setCharacterPromptCursorOffset(offset);
    });
  }, []);
  const getCurrentCharacterPromptCursor = useCallback(() => {
    const editor = characterEditorRef.current;
    if (!editor) return Math.min(Math.max(0, characterPromptCursorOffset), characterGeneratePrompt.length);

    const cursor = getSelectionTextOffset(editor);
    return Math.min(Math.max(0, cursor), characterGeneratePrompt.length);
  }, [characterGeneratePrompt.length, characterPromptCursorOffset]);
  const getCurrentCharacterPromptSelection = useCallback(() => {
    const editor = characterEditorRef.current;
    const length = characterGeneratePrompt.length;
    const storedCursor = Math.min(Math.max(0, characterPromptCursorOffset), length);
    if (!editor) return { start: storedCursor, end: storedCursor };
    const range = getSelectionTextRange(editor);
    const start = Math.min(Math.max(0, range.start), length);
    const end = Math.min(Math.max(0, range.end), length);
    if (start === end) return { start: storedCursor, end: storedCursor };
    return { start, end };
  }, [characterGeneratePrompt.length, characterPromptCursorOffset]);
  const activeAtQuery = getAtQueryAtCursor(activeInput, draftCursorOffset);
  useEffect(() => {
    const timer = window.setTimeout(updateUploadedRowScrollState, 0);
    window.addEventListener("resize", updateUploadedRowScrollState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateUploadedRowScrollState);
    };
  }, [activeUploadedFiles.length, activeUploadedImages.length, inputShellWidth, updateUploadedRowScrollState]);
  // 测量底部工具栏左侧按钮组的自然宽度，驱动输入框加宽（发送按钮不被顶出框外）。
  useEffect(() => {
    const element = toolbarLeftGroupRef.current;
    if (!element) return;
    const measure = () => {
      // 用 offsetWidth 只量按钮组自身宽度：绝对定位的下拉弹窗不会计入，
      // 避免点开菜单时把测量宽度撑大导致发送按钮间距突然变大。
      const width = element.offsetWidth;
      setMeasuredToolbarLeftWidth((current) => (Math.abs(current - width) > 1 ? width : current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode, selectedGenerationModels.image, selectedGenerationModels.video, selectedImageQuality, activePanel, activeSessionId]);
  useEffect(() => {
    const timer = window.setTimeout(updateAssetGenerateReferenceScrollState, 0);
    window.addEventListener("resize", updateAssetGenerateReferenceScrollState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateAssetGenerateReferenceScrollState);
    };
  }, [assetGenerateReferenceImages.length, isCharacterGenerateOpen, updateAssetGenerateReferenceScrollState]);
  const atAssetSearch = activeAtQuery?.query ?? "";
  const atAssetGroups = activeAtQuery || isAtAssetMenuOpen
    ? MENTION_CATEGORIES.map((cat) => ({
        type: cat.value,
        assets: assets.filter((asset) => isAssetInFilter(asset, cat.value) && asset.name.includes(atAssetSearch)),
      }))
    : [];
  const insertAssetReference = (asset: AssetItem) => {
    const selection = getCurrentDraftSelection();
    const insertBase = activeAtQuery ? activeInput.slice(0, activeAtQuery.index) : activeInput.slice(0, selection.start);
    const insertSuffix = activeAtQuery ? activeInput.slice(activeAtQuery.cursor) : activeInput.slice(selection.end);
    if (isVideoAsset(asset) || isAudioAsset(asset)) {
      const kind = isAudioAsset(asset) ? "audio" : "video";
      const rule = currentUploadRule[kind];
      setIsAtAssetMenuOpen(false);
      if (!rule.enabled) {
        showInputTip(getVideoAudioUploadDisabledMessage({ modelId: selectedGenerationModel, videoReferenceMode: mode === "video" && isSelectedVideoReferenceModeModel ? selectedVideoReferenceMode : undefined }));
        return;
      }
      const already = activeUploadedFiles.some((file) => typeof file !== "string" && Boolean(file.url) && normalizeMediaUrlForMatch(file.url!) === normalizeMediaUrlForMatch(asset.url));
      if (already) {
        addActiveUploadedMediaReference(asset, kind, {}, { draftBase: insertBase, draftSuffix: insertSuffix });
        focusEditorAt((insertBase.length + `@${asset.name} `.length));
        return;
      }
      const existingCount = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === kind).length;
      if (existingCount >= rule.maxCount) {
        showInputTip(kind === "audio" ? `当前模型最多支持 ${rule.maxCount} 个参考音频` : `当前模型最多支持 ${rule.maxCount} 个参考视频`);
        return;
      }
      const kindLabel = kind === "audio" ? "音频" : "视频";
      void (async () => {
        let media: { durationSeconds?: number; dimensions?: ImageDimensions };
        try {
          media = await readMediaMetadataFromUrl(getStaticMediaUrl(asset.url) ?? asset.url, kind);
        } catch {
          showInputTip(`${kindLabel}信息读取失败`);
          return;
        }
        const durationError = validateMediaDuration(kindLabel, media.durationSeconds, rule);
        if (durationError) { showInputTip(durationError); return; }
        if (kind === "video") {
          const dimensionError = validateReferenceVideoDimensions(media.dimensions);
          if (dimensionError) { showInputTip(dimensionError); return; }
        }
        const existingDuration = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === kind).reduce((sum, file) => sum + getUploadedMediaDuration(file), 0);
        if (rule.maxTotalSeconds !== undefined && existingDuration + (media.durationSeconds ?? 0) > rule.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) {
          showInputTip(kind === "audio" ? `参考音频总时长不能超过 ${rule.maxTotalSeconds} 秒` : `参考视频总时长不能超过 ${rule.maxTotalSeconds} 秒`);
          return;
        }
        addActiveUploadedMediaReference(asset, kind, media, { draftBase: insertBase, draftSuffix: insertSuffix });
        focusEditorAt((insertBase.length + `@${asset.name} `.length));
      })();
      return;
    }
    if (activeUploadedImages.length >= currentMaxReferenceImages && !activeUploadedImages.some((image) => image.url === asset.url)) {
      showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
      setIsAtAssetMenuOpen(false);
      return;
    }

    const referenceText = `@${asset.name} `;
    addActiveUploadedImages([toUploadedAssetReference(asset)], { draftBase: insertBase, draftSuffix: insertSuffix, insertReferenceText: true });
    setIsAtAssetMenuOpen(false);
    focusEditorAt((insertBase.length + referenceText.length));
  };
  const insertCharacterAssetReference = (asset: AssetItem) => {
    if (isVideoAsset(asset) || isAudioAsset(asset)) {
      setIsCharacterAtAssetMenuOpen(false);
      showInputTip(getVideoAudioUploadDisabledMessage({}));
      return;
    }
    if (assetGenerateReferenceImages.length >= assetGenerateMaxReferenceImages && !assetGenerateReferenceImages.some((image) => image.url === asset.url)) {
      showInputTip(`当前模型最多支持 ${assetGenerateMaxReferenceImages} 张参考图，不能上传更多图片`);
      setIsCharacterAtAssetMenuOpen(false);
      return;
    }

    const selection = getCurrentCharacterPromptSelection();
    const currentAtQuery = getAtQueryAtCursor(characterGeneratePrompt, selection.start);
    const insertBase = currentAtQuery ? characterGeneratePrompt.slice(0, currentAtQuery.index) : characterGeneratePrompt.slice(0, selection.start);
    const insertSuffix = currentAtQuery ? characterGeneratePrompt.slice(currentAtQuery.cursor) : characterGeneratePrompt.slice(selection.end);
    const referenceText = `@${asset.name} `;
    const nextPrompt = Array.from(`${insertBase}${referenceText}${insertSuffix}`).slice(0, PROMPT_MAX_LENGTH_CEILING).join("");

    setActiveAssetGeneratePrompt(nextPrompt);
    setActiveAssetGenerateReferences((current) => current.some((reference) => reference.url === asset.url) ? current : [...current, { name: asset.name, url: asset.url }]);
    setIsCharacterAtAssetMenuOpen(false);
    focusCharacterEditorAt((insertBase.length + referenceText.length));
  };
  // 点缩略图下的 @文件名：往输入框插入 @名字（缩略图状态已存在，不重复添加）；支持选中覆盖。对齐对话流/工作流。
  const insertCharacterReferenceText = (name: string) => {
    const referenceText = `@${name} `;
    const selection = getCurrentCharacterPromptSelection();
    const insertBase = characterGeneratePrompt.slice(0, selection.start);
    const insertSuffix = characterGeneratePrompt.slice(selection.end);
    const nextPrompt = Array.from(`${insertBase}${referenceText}${insertSuffix}`).slice(0, PROMPT_MAX_LENGTH_CEILING).join("");
    setActiveAssetGeneratePrompt(nextPrompt);
    focusCharacterEditorAt((insertBase.length + referenceText.length));
  };
  const openCharacterMentionAssetMenu = () => {
    setCharacterPromptCursorOffset(getCurrentCharacterPromptCursor());
    setIsCharacterAtAssetMenuOpen(true);
    if (!loadedAssetFilters[characterAtAssetFilter] && !mentionFilterPaging[characterAtAssetFilter]?.loading) void loadMentionFilterPage(characterAtAssetFilter, 0);
  };
  const resetCharacterGenerateWorkspace = useCallback(() => {
    setActiveAssetGenerateJobId("");
    setCharacterGenerateResult({ status: "idle" });
    setCharacterImageScale(1);
    setCharacterImageFitMode("fit");
    setCharacterImagePan({ x: 0, y: 0 });
    setCharacterImageNaturalSize({ width: 0, height: 0 });
    setCharacterImageFitScale(1);
    setIsCharacterImageDragging(false);
    setIsCharacterPromptOptimizing(false);
    setCharacterPromptCursorOffset(0);
    setCharacterAtAssetFilter("character_image");
    setIsCharacterAtAssetMenuOpen(false);
    setOpenControlMenu("");
  }, []);
  const openAssetGenerateJob = useCallback((jobId: string) => {
    const job = assetGenerateJobs.find((item) => item.id === jobId);
    if (!job) return;

    setAssetGenerateType(job.type);
    setCharacterGeneratePrompt(job.prompt);
    // 恢复历史任务时按提示词里的 @文件名 重建该类型的参考图缩略图状态。
    setAssetGenerateReferenceDrafts((current) => ({ ...current, [job.type]: getOrderedExplicitImageReferences(job.prompt, assets, [], []) }));
    setCharacterPromptCursorOffset(job.prompt.length);
    setCharacterGenerateRatio(job.ratio);
    setCharacterGenerateStyle(job.style);
    setCharacterGenerateModel(job.model);
    setCharacterGenerateResolution(job.resolution);
    setCharacterGenerateResult(job.result);
    setCharacterImageScale(1);
    setCharacterImageFitMode("fit");
    setCharacterImagePan({ x: 0, y: 0 });
    setCharacterImageNaturalSize(job.result.dimensions ?? { width: 0, height: 0 });
    setCharacterImageFitScale(1);
    setIsCharacterImageDragging(false);
    setIsCharacterPromptOptimizing(false);
    setCharacterAtAssetFilter("character_image");
    setIsCharacterAtAssetMenuOpen(false);
    setOpenControlMenu("");
    setActiveAssetGenerateJobId(job.id);
    setIsCharacterGenerateOpen(true);
  }, [assetGenerateJobs, assets]);
  const getCharacterPromptReferences = useCallback(() => {
    return assetGenerateReferenceDrafts[assetGenerateType] ?? [];
  }, [assetGenerateReferenceDrafts, assetGenerateType]);
  const optimizeCharacterPrompt = async () => {
    const rawPrompt = characterGeneratePrompt.trim();
    if (!rawPrompt || isCharacterPromptOptimizing || characterGenerateResult.status === "generating") return;

    setIsCharacterPromptOptimizing(true);
    try {
      setIsCharacterAtAssetMenuOpen(false);
      setOpenControlMenu("");
      const referencedAssets = getReferencedAssets(rawPrompt, assets);
      const optimizeModels = [...PROMPT_TOOL_MODEL_CHAIN];
      let data: ChatApiResponse | undefined;
      let nextPrompt = "";
      let lastError: unknown;

      for (const model of optimizeModels) {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              mode: "image",
              messages: [{ role: "user", content: `${isShotGeneration ? getShotPromptOptimizationRuleText(characterGenerateStyle, characterGenerateRatio) : isSceneGeneration ? getScenePromptOptimizationRuleText(characterGenerateStyle, characterGenerateRatio) : isPropGeneration ? getPropPromptOptimizationRuleText(characterGenerateStyle, characterGenerateRatio) : getCharacterPromptOptimizationRuleText(characterGenerateRatio, characterGenerateStyle)}\n\n用户输入：${referencedAssets.length > 0 ? `${rawPrompt}${getAssetReferencesText(referencedAssets)}` : rawPrompt}` }],
              settings: {
                ratio: characterGenerateDisplayRatio,
                resolution: characterGenerateDisplayResolution,
                style: characterGenerateStyleLabel,
                imageCount: "1张",
              },
              originalPrompt: rawPrompt,
              conversationId: activeSessionIdValue,
              conversationTitle: activeSession?.title,
              requestId: createClientId(),
              metadata: { creditSource: "prompt_optimization", originalPrompt: rawPrompt, recordFailure: true },
            }),
          });
          data = await readJson<ChatApiResponse>(response);
          nextPrompt = data.content?.trim() ?? "";
          if (nextPrompt) break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!data || !nextPrompt) throw lastError instanceof Error ? lastError : new Error("没有优化出提示词，请稍后再试。");
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);

      const styledPrompt = enforceAssetGenerateStylePrompt(nextPrompt, characterGenerateStyle);
      setActiveAssetGeneratePrompt(styledPrompt);
      focusCharacterEditorAt(styledPrompt.length);
    } catch (error) {
      void error;
    } finally {
      setIsCharacterPromptOptimizing(false);
    }
  };
  const addCharacterGeneratedAsset = useCallback((url: string, prompt: string, dimensions?: ImageDimensions, type = assetGenerateType, previewMeta = characterPreviewMeta, reservedName?: string) => {
    if (!url) return;
    const name = reservedName ?? getNextAssetGenerationName(type, assets);
    const isNewAsset = !assets.some((asset) => asset.url === url);

    setAssets((current) => {
      if (current.some((asset) => asset.url === url)) return current;

      return [
        {
          id: createClientId(),
          type,
          name,
          systemName: name,
          url,
          librarySource: "asset_generation" as const,
          sourcePrompt: prompt,
          sessionId: activeSessionIdValue,
          lockedType: true,
          previewMeta: dimensions ? getPreviewMetaWithDimensions(previewMeta, dimensions, "image") : previewMeta,
          createdAt: Date.now(),
        },
        ...current,
      ];
    });
    if (isNewAsset) adjustAssetCounts([{ filter: type, delta: 1 }]);
    if (isRemoteMediaUrl(url)) return;
    void fetch("/api/media-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        name,
        currentCategory: type,
        mediaType: "image",
        sourcePrompt: prompt,
        promptSource: "generated",
        model: characterGenerateModel,
        settings: { ratio: characterGenerateDisplayRatio, resolution: characterGenerateDisplayResolution, style: characterGenerateStyleLabel, imageCount: "1张" },
        dimensions,
        previewMeta: dimensions ? getPreviewMetaWithDimensions(previewMeta, dimensions, "image") : previewMeta,
        conversationId: activeSessionIdValue,
      }),
    }).catch((error) => console.warn("[media-assets] failed to persist generated asset", error));
  }, [activeSessionIdValue, adjustAssetCounts, assetGenerateType, assets, characterGenerateDisplayRatio, characterGenerateDisplayResolution, characterGenerateModel, characterGenerateStyleLabel, characterPreviewMeta]);
  const generateCharacterImage = async () => {
    let rawPrompt = characterGeneratePrompt.trim();
    if (!rawPrompt || characterGenerateResult.status === "generating") return;
    // ⭐ 超字数兜底（回车发送也走这里）。⛔ 不删字，只拦住。
    if (isPromptOverLimit(characterGeneratePrompt, assetGeneratePromptMaxLength)) {
      showInputTip(getPromptOverLimitTipText(countPromptLength(characterGeneratePrompt), assetGeneratePromptMaxLength));
      return;
    }
    if (workspaceStorageMode === "user" && currentUserCredits <= 0) {
      showInputTip("积分不足，请充值后再使用模型");
      return;
    }
    if (enabledAssetImageModelIds.length === 0 || !enabledAssetImageModelIds.includes(characterGenerateModel)) {
      showInputTip("连接不到模型，请联系管理员！");
      return;
    }

    const requestId = createClientId();
    // ⛔ 这里以前是「上一次结果是失败 → 复用那条失败卡的 jobId」（原地重试），已于 2026-08-06 去掉：
    // 那样会让**用户没点 ✕ 的失败卡被下一次生成顶掉**（实测：连续两次失败，第一次的错误信息被第二次覆盖，
    // 网格里只留一张卡）。⭐ 产品口径 = 每次生成彼此独立、失败卡只有用户点 ✕ 才消失，
    // 所以每次点生成一律新建一条 job，旧失败卡原样留着。
    const jobId = requestId;
    const startedAt = Date.now();
    const draftReferences = getCharacterPromptReferences();
    const draftByName = new Map(draftReferences.map((reference) => [reference.name, reference]));
    const mentionNames = getMentionNames(rawPrompt);
    const mentionedReferences = mentionNames.map((name) => draftByName.get(name)).filter((reference): reference is ImageReference => Boolean(reference));
    const validReferenceNames = new Set(mentionedReferences.map((reference) => reference.name));
    const danglingNames = mentionNames.filter((name) => !validReferenceNames.has(name));
    if (danglingNames.length > 0) {
      let cleaned = rawPrompt;
      for (const name of danglingNames) cleaned = removeMentionName(cleaned, name, { trim: true });
      rawPrompt = cleaned.trim();
      if (!rawPrompt) { showInputTip("请输入提示词"); return; }
      setActiveAssetGeneratePrompt(rawPrompt);
    }
    if (draftReferences.length > assetGenerateMaxReferenceImages) {
      showInputTip(`当前模型最多支持 ${assetGenerateMaxReferenceImages} 张参考图，不能上传更多图片`);
      return;
    }
    const referenceHint = getReferenceHint(draftReferences, rawPrompt);
    const ruleText = isShotGeneration ? getShotGenerationRuleText(characterGenerateStyle, characterGenerateRatio, characterGenerateModel) : isSceneGeneration ? getSceneGenerationRuleText(characterGenerateStyle, characterGenerateRatio, characterGenerateModel) : isPropGeneration ? getPropGenerationRuleText(characterGenerateStyle, characterGenerateRatio, characterGenerateModel) : getCharacterGenerationRuleText(characterGenerateRatio, characterGenerateStyle, characterGenerateModel);
    const styledPrompt = isPropGeneration ? enforceAssetGeneratePropStylePrompt(rawPrompt, characterGenerateStyle) : enforceAssetGenerateStylePrompt(rawPrompt, characterGenerateStyle);
    const prompt = [ruleText, referenceHint, `${isShotGeneration ? "用户分镜提示词" : isSceneGeneration ? "用户场景提示词" : isPropGeneration ? "用户道具提示词" : "用户角色提示词"}：${styledPrompt}`].filter(Boolean).join("\n\n");
    const previewMetaSnapshot = characterPreviewMeta;
    const settings: GenerationSettings = {
      ratio: characterGenerateDisplayRatio,
      resolution: characterGenerateDisplayResolution,
      style: characterGenerateStyleLabel,
      imageCount: "1张",
      quality: isGptImage2Model(characterGenerateModel) ? characterGenerateQuality : undefined,
    };

    setCharacterImageFitMode("fit");
    setCharacterImageScale(1);
    setCharacterImagePan({ x: 0, y: 0 });
    setCharacterImageNaturalSize({ width: 0, height: 0 });
    setCharacterImageFitScale(1);
    setIsCharacterImageDragging(false);
    setIsCharacterAtAssetMenuOpen(false);
    setOpenControlMenu("");
    const generatingResult: CharacterGenerationResult = { status: "generating", startedAt };

    const jobSnapshot: AssetGenerateJob = {
      id: jobId,
      type: assetGenerateType,
      prompt: rawPrompt,
      ratio: characterGenerateRatio,
      style: characterGenerateStyle,
      model: characterGenerateModel,
      resolution: characterGenerateResolution,
      previewMeta: previewMetaSnapshot,
      result: generatingResult,
    };

    setActiveAssetGenerateJobId(jobId);
    assetGenerateJobPollersRef.current.add(jobId);
    setAssetGenerateJobs((current) => {
      const existingIndex = current.findIndex((job) => job.id === jobId);
      if (existingIndex < 0) return [jobSnapshot, ...current];
      return current.map((job) => job.id === jobId ? jobSnapshot : job);
    });
    setCharacterGenerateResult(generatingResult);
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            sourcePrompt: rawPrompt,
            model: characterGenerateModel,
            referenceImages: draftReferences.length > 0 ? draftReferences.map((reference) => reference.url) : undefined,
            settings,
            count: 1,
            candidateMode: "best",
            async: true,
            conversationId: activeSessionIdValue,
            conversationTitle: activeSession?.title,
            requestId,
          metadata: { creditSource: isShotGeneration ? "shot_image_generation" : isSceneGeneration ? "scene_image_generation" : isPropGeneration ? "prop_image_generation" : "character_image_generation" },
        }),
      });
      const submitted = await readJson<{ jobId?: string; error?: string; reservedNames?: string[] }>(response);
      if (!submitted.jobId) throw new Error(submitted.error || GENERIC_MEDIA_ERROR_MESSAGE);
      let data: { resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta; error?: string } | undefined;
      while (!data) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const statusResponse = await fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestIds: [requestId] }) });
        const status = await readJson<{ jobs?: Array<{ status?: string; resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta; error?: string }> }>(statusResponse);
        const job = status.jobs?.[0];
        if (job?.status === "failed") throw new Error(job.error || GENERIC_MEDIA_ERROR_MESSAGE);
        if (job?.status === "succeeded") data = job;
      }
      const url = data.resultUrls?.[0];
      if (!url) throw new Error(GENERIC_MEDIA_ERROR_MESSAGE);

      const dimensions = data.resultDimensions?.[url];
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);
      if (dimensions && activeAssetGenerateJobIdRef.current === jobId) setCharacterImageNaturalSize(dimensions);
      const succeededResult: CharacterGenerationResult = { status: "succeeded", url, dimensions };
      // ⛔⛔ 这里以前还挂着一句 .filter(同类型的其它 failed 全删掉) —— 已于 2026-08-06 移除。
      // 资产库一次点击 = 一个独立 job（请求体 count 恒为 1），用户连点 N 次就是 N 条互不相干的链；
      // 那句 filter 只看 type、不看批次不看时间，导致"任意一张成功就把别人的失败卡一起抹掉"
      // （正式服实测：3 成 2 败，B_141 那张失败卡被下一张成功顶掉，用户只看到 1 个失败卡）。
      // ⭐ 产品口径：失败卡只有用户点 ✕ 才消失。这里只改自己这一条，绝不动别人。
      setAssetGenerateJobs((current) => current.map((job) => job.id === jobId ? { ...job, result: succeededResult } : job));
      if (activeAssetGenerateJobIdRef.current === jobId) setCharacterGenerateResult(succeededResult);
      addCharacterGeneratedAsset(url, rawPrompt, dimensions, jobSnapshot.type, previewMetaSnapshot, data.reservedNames?.[0] ?? submitted.reservedNames?.[0]);
      notifyGenerationCompleteOnce(requestId, "图片生成已完成");
    } catch (error) {
        const message = normalizeMediaErrorText(toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE, { model: characterGenerateModel }), "image") ?? GENERIC_MEDIA_ERROR_MESSAGE;
      const failedResult: CharacterGenerationResult = { status: "failed", error: message };
      console.error("[asset-generation] image request failed", {
        jobId,
        requestId,
        type: jobSnapshot.type,
        model: jobSnapshot.model,
        ratio: jobSnapshot.ratio,
        resolution: jobSnapshot.resolution,
        error: message,
      });
      setAssetGenerateJobs((current) => {
        const hasJob = current.some((job) => job.id === jobId);
        if (!hasJob) return [{ ...jobSnapshot, result: failedResult }, ...current];
        return current.map((job) => job.id === jobId ? { ...job, result: failedResult } : job);
      });
      if (activeAssetGenerateJobIdRef.current === jobId) setCharacterGenerateResult(failedResult);
    } finally {
      assetGenerateJobPollersRef.current.delete(jobId);
    }
  };
  // 资产库生成"重启/刷新/重登录"恢复：服务端 job 与前端无关地继续生成/扣费/存盘，前端恢复后
  // 按 requestId(=job.id) 续 poll，出图后翻卡+入库；找不到（老数据/已清）则判失败。对齐对话流/工作流。
  const resumeAssetGenerateJob = useCallback(async (job: AssetGenerateJob) => {
    const requestId = job.id;
    if (assetGenerateJobPollersRef.current.has(requestId)) return;
    assetGenerateJobPollersRef.current.add(requestId);
    try {
      let data: { resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta; error?: string } | undefined;
      let notFound = 0;
      while (!data) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const statusResponse = await fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestIds: [requestId] }) });
        const status = await readJson<{ jobs?: Array<{ status?: string; resultUrls?: string[]; reservedNames?: string[]; resultDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta; error?: string }> }>(statusResponse);
        const remote = status.jobs?.[0];
        if (!remote) {
          notFound += 1;
          if (notFound > 40) throw new Error("生成任务已过期或被清理，请重新生成。");
          continue;
        }
        notFound = 0;
        if (remote.status === "failed") throw new Error(remote.error || GENERIC_MEDIA_ERROR_MESSAGE);
        if (remote.status === "succeeded") data = remote;
      }
      const url = data.resultUrls?.[0];
      if (!url) throw new Error(GENERIC_MEDIA_ERROR_MESSAGE);
      const dimensions = data.resultDimensions?.[url];
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);
      const succeededResult: CharacterGenerationResult = { status: "succeeded", url, dimensions };
      setAssetGenerateJobs((current) => current.map((item) => item.id === job.id ? { ...item, result: succeededResult } : item));
      if (activeAssetGenerateJobIdRef.current === job.id) {
        setCharacterGenerateResult(succeededResult);
        if (dimensions) setCharacterImageNaturalSize(dimensions);
      }
      addCharacterGeneratedAsset(url, job.prompt, dimensions, job.type, job.previewMeta, data.reservedNames?.[0]);
      notifyGenerationCompleteOnce(requestId, "图片生成已完成");
    } catch (error) {
      const message = normalizeMediaErrorText(toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE, { model: job.model }), "image") ?? GENERIC_MEDIA_ERROR_MESSAGE;
      const failedResult: CharacterGenerationResult = { status: "failed", error: message };
      setAssetGenerateJobs((current) => current.map((item) => item.id === job.id ? { ...item, result: failedResult } : item));
      if (activeAssetGenerateJobIdRef.current === job.id) setCharacterGenerateResult(failedResult);
    } finally {
      assetGenerateJobPollersRef.current.delete(requestId);
    }
  }, [addCharacterGeneratedAsset, activeSessionIdValue, addSessionUsage, applyCreditResult, notifyGenerationCompleteOnce]);
  useEffect(() => {
    if (!isLoaded) return;
    for (const job of assetGenerateJobs) {
      if (job.result.status === "generating" && !assetGenerateJobPollersRef.current.has(job.id)) void resumeAssetGenerateJob(job);
    }
  }, [assetGenerateJobs, isLoaded, resumeAssetGenerateJob]);
  const clearActiveInput = () => {
    closeInputMenus();
    activeUploadedImages.forEach((image) => {
      inputImageUploadAbortControllersRef.current.get(image.id)?.abort();
      inputImageUploadAbortControllersRef.current.delete(image.id);
    });
    const tempTokens = activeUploadedImages.map((image) => image.tempToken).filter((token): token is string => Boolean(token));
    void deleteTemporaryAssetImages(tempTokens);
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );
    setDraftCursorOffset(0);
    requestAnimationFrame(() => editorRef.current?.focus());
  };
  const optimizeActivePrompt = async () => {
    const rawPrompt = activeInput.trim();
    if (!rawPrompt || isInputPromptOptimizing || (mode !== "image" && mode !== "video")) return;

    setIsInputPromptOptimizing(true);
    try {
      closeInputMenus();
      const referencedAssets = getReferencedAssets(rawPrompt, assets);
      const optimizeModels = [...PROMPT_TOOL_MODEL_CHAIN];
      let data: ChatApiResponse | undefined;
      let nextPrompt = "";
      let lastError: unknown;

      for (const model of optimizeModels) {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              mode,
              messages: [{ role: "user", content: `${getProfessionalPromptOptimizationRuleText(mode)}\n\n用户输入：${referencedAssets.length > 0 ? `${rawPrompt}${getAssetReferencesText(referencedAssets)}` : rawPrompt}` }],
              settings: {
                ratio: selectedRatio,
                resolution: selectedResolution,
                duration: mode === "video" ? selectedVideoDuration : undefined,
                imageCount: mode === "image" ? selectedImageCount : undefined,
              },
              originalPrompt: rawPrompt,
              conversationId: activeSessionIdValue,
              conversationTitle: activeSession?.title,
              requestId: createClientId(),
              metadata: { creditSource: "prompt_optimization", originalPrompt: rawPrompt, recordFailure: true },
            }),
          });
          data = await readJson<ChatApiResponse>(response);
          nextPrompt = data.content?.trim() ?? "";
          if (nextPrompt) break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!data || !nextPrompt) throw lastError instanceof Error ? lastError : new Error("没有优化出提示词，请稍后再试。");
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);
      setActiveDraftInput(nextPrompt);
      focusEditorAt(nextPrompt.length);
    } catch (error) {
      void error;
    } finally {
      setIsInputPromptOptimizing(false);
    }
  };
  const openMentionAssetMenu = () => {
    closeAllPopupMenus("mention");
    setIsAtAssetMenuOpen(true);
    if (!loadedAssetFilters[atAssetFilter] && !mentionFilterPaging[atAssetFilter]?.loading) void loadMentionFilterPage(atAssetFilter, 0);
  };
  const getDefaultDocumentPreviewWidth = useCallback(() => {
    const sidebarWidth = isSidebarVisible ? isSidebarCollapsed ? 80 : 262 : 0;
    const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
    const availableWidth = Math.max(840, viewportWidth - sidebarWidth);
    return Math.max(420, Math.round((availableWidth * 4) / 9));
  }, [isSidebarCollapsed, isSidebarVisible]);
  useEffect(() => {
    if (!previewDocumentFile || hasCustomPreviewDocumentWidth) return;
    const updateDefaultWidth = () => setPreviewDocumentWidth(getDefaultDocumentPreviewWidth());
    updateDefaultWidth();
    window.addEventListener("resize", updateDefaultWidth);
    return () => window.removeEventListener("resize", updateDefaultWidth);
  }, [getDefaultDocumentPreviewWidth, hasCustomPreviewDocumentWidth, previewDocumentFile]);
  const startDocumentPreviewResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setHasCustomPreviewDocumentWidth(true);
    const startX = event.clientX;
    const startWidth = previewDocumentWidth || getDefaultDocumentPreviewWidth();
    const getMaxWidth = () => Math.max(420, window.innerWidth - (isSidebarVisible ? isSidebarCollapsed ? 100 : 282 : 20) - 420);
    const clampWidth = (width: number) => Math.min(getMaxWidth(), Math.max(420, width));
    const handlePointerMove = (moveEvent: PointerEvent) => {
      setPreviewDocumentWidth(clampWidth(startWidth + startX - moveEvent.clientX));
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [getDefaultDocumentPreviewWidth, isSidebarCollapsed, isSidebarVisible, previewDocumentWidth]);
  const switchAgentModelTier = (tier: AgentModelTier) => {
    if (agentModelTier === tier) return;

    setAgentModelTier(tier);
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: [
                ...session.messages,
                {
                  id: createClientId(),
                  role: "system",
                  content: `当前已切换至${tier === "advanced" ? "高级" : "普通"}模式`,
                  createdAt: Date.now(),
                },
              ],
            }
          : session,
      ),
    );
  };

  const showWorkspaceIntlBadge = workspaceSite === "malaysia";
  // 左上角 logo = 切换线路（与首页一致）：新加坡服 ↔ 阿里国内入口。
  const workspaceLogoTargetUrl = workspaceSite === "malaysia" ? ALI_WORKSPACE_URL : MALAYSIA_WORKSPACE_URL;
  const historySessions = sortByUpdatedAtDesc(sessions.filter((session) => isVisibleSession(session)));
  const visibleHistorySessions = historySessions.slice(0, historyVisibleSessionCount);
  const hiddenHistorySessionCount = Math.max(0, historySessions.length - visibleHistorySessions.length);
  const historyDisplaySessionCount = Math.max(historyTotalSessionCount, historySessions.length);
  const visibleWorkflowItems = activeWorkflowItems.slice(0, workflowVisibleItemCount);
  const hiddenWorkflowItemCount = Math.max(0, activeWorkflowItems.length - visibleWorkflowItems.length);
  const shouldShowHistoryLoadStatus = activePanel !== "workflow" && sessions.length === 0 && workspaceLoadStatus !== "loaded";
  const historyLoadStatusText = workspaceLoadStatus === "failed" ? "重新加载历史" : "历史加载中...";
  const retryWorkspaceLoad = () => {
    setIsLoaded(false);
    setWorkspaceLoadStatus("loading");
    setWorkspaceLoadRetryKey((key) => key + 1);
  };
  const getAssetCount = (key: string, fallback: number) => Math.max(0, Math.floor(Number(assetCounts[key] ?? fallback)));
  const hasCurrentFilterAssets = assets.some((asset) => isAssetInFilter(asset, assetFilter));
  const workspaceRootClassName = isSidebarVisible
    ? isSidebarCollapsed
      ? "flashmuse-workspace-root grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white lg:grid-cols-[80px_minmax(0,1fr)]"
      : "flashmuse-workspace-root grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white lg:grid-cols-[262px_minmax(0,1fr)]"
    : "flashmuse-workspace-root grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white";
  // 侧边栏三态唯一切换入口：常规态 → 简化态 → 隐藏 → 常规态（循环）。
  // ⛔ 全项目只允许这一个按钮切侧边栏：点 logo 不切（logo = 切换线路，与首页一致）、进工作流也不切。
  const cycleSidebarState = () => {
    closeAllPopupMenus();
    if (!isSidebarVisible) {
      // 隐藏 → 常规态
      setIsSidebarVisible(true);
      setIsSidebarCollapsed(false);
      return;
    }
    if (!isSidebarCollapsed) {
      // 常规态 → 简化态
      setIsSidebarCollapsed(true);
      return;
    }
    // 简化态 → 隐藏
    setIsSidebarVisible(false);
  };
  // 图标口径：显示中（常规/简化）都用 fold；隐藏时用 unfold。
  const sidebarToggleLabel = !isSidebarVisible ? "显示左侧栏" : isSidebarCollapsed ? "隐藏左侧栏" : "收起左侧栏";

  return (
    <section className={workspaceRootClassName}>
      {isSidebarVisible ? (
      <aside className={isSidebarCollapsed ? "flashmuse-sidebar relative z-10 hidden h-screen min-h-0 flex-col overflow-visible border-r border-[#e5e5e5] bg-[#f9f9f9] px-2 pb-1 pt-4 lg:flex" : "flashmuse-sidebar relative z-10 hidden h-screen min-h-0 flex-col overflow-visible border-r border-[#e5e5e5] bg-[#f9f9f9] px-3 pb-1 pt-4 lg:flex"}>
          <button type="button" onClick={() => { window.location.assign(workspaceLogoTargetUrl); }} className={isSidebarCollapsed ? "mb-5 flex justify-center text-left" : "mb-5 flex items-center gap-3 px-2 text-left"} aria-label="切换线路" title="切换线路">
          <div className={isSidebarCollapsed ? "flex h-[50px] w-[50px] items-center justify-center" : "flex h-[50px] w-[50px] items-center justify-center"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home-assets/logo.png" alt="闪念 FlashMuse" className="h-[50px] w-[50px] object-contain" />
          </div>
          {!isSidebarCollapsed ? <div className="flex min-w-0 flex-col justify-center">
            <span className="flex items-end gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home-assets/logo-text.png" alt="闪念" className="flashmuse-logo-text w-auto object-contain" style={{ height: 26 }} />
              {showWorkspaceIntlBadge ? <span className="pb-[1px] text-[12px] font-medium leading-none text-[#8a8a8a]">Intl.</span> : null}
              {IS_TEST_SERVER ? <span className="pb-[1px] text-[12px] font-semibold leading-none text-[#e0a400]">测试服</span> : null}
            </span>
            <div className="mt-1 whitespace-nowrap text-xs leading-4 text-[#8a8a8a]">AI影游助手</div>
          </div> : null}
        </button>
        <div className={isSidebarCollapsed ? "mb-3 flex flex-col items-center gap-[5px]" : "mb-[22px] space-y-[5px]"}>
          <button type="button" onClick={() => { setStoredWorkspaceUiState({ activePanel: "chat" }); setActivePanel("chat"); }} className={isSidebarCollapsed ? activePanel === "chat" ? "relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] font-medium text-[#111111]" : "relative flex h-10 w-10 items-center justify-center rounded-lg font-medium text-[#555555] transition hover:bg-[#ececec]" : activePanel === "chat" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"} title="对话模式" aria-label="对话模式">
            {activePanel === "chat" ? <RiChatSmileAiLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiChat3Line className="h-5 w-5 shrink-0 text-[#555555]" aria-hidden="true" />}
            {!isSidebarCollapsed ? <span className="text-[13px] leading-[1.2]">对话模式</span> : null}
            {activePanel !== "chat" && hasAnyConversationRunning ? <span className={isSidebarCollapsed ? "absolute ml-7 mt-7 flex w-4 shrink-0 justify-end" : "ml-auto flex w-7 shrink-0 justify-end"}><HaloPulseIndicator /></span> : null}
          </button>
          <button type="button" disabled={!WORKFLOW_MODE_ENABLED} onClick={enterWorkflowPanel} className={!WORKFLOW_MODE_ENABLED ? isSidebarCollapsed ? "relative flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg font-medium text-[#b0b0b0]" : "flex h-10 w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 text-left font-medium text-[#b0b0b0]" : isSidebarCollapsed ? activePanel === "workflow" ? "relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] font-medium text-[#111111]" : "relative flex h-10 w-10 items-center justify-center rounded-lg font-medium text-[#555555] transition hover:bg-[#ececec]" : activePanel === "workflow" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"} title={WORKFLOW_MODE_ENABLED ? "工作流模式" : "工作流模式暂未开放"} aria-label={WORKFLOW_MODE_ENABLED ? "工作流模式" : "工作流模式暂未开放"}>
            {activePanel === "workflow" && WORKFLOW_MODE_ENABLED ? <RiGitMergeLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiGitPullRequestLine className={!WORKFLOW_MODE_ENABLED ? "h-5 w-5 shrink-0 text-[#b0b0b0]" : "h-5 w-5 shrink-0 text-[#555555]"} aria-hidden="true" />}
            {!isSidebarCollapsed ? <span className="text-[13px] leading-[1.2]">工作流模式</span> : null}
            {WORKFLOW_MODE_ENABLED && activePanel !== "workflow" && hasAnyWorkflowGenerating ? <span className={isSidebarCollapsed ? "absolute ml-7 mt-7 flex w-4 shrink-0 justify-end" : "ml-auto flex w-7 shrink-0 justify-end"}><HaloPulseIndicator /></span> : null}
            {!isSidebarCollapsed && !WORKFLOW_MODE_ENABLED ? <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-[#9a9a9a] ring-1 ring-[#e3e3e3]">未开放</span> : null}
          </button>
          <button type="button" onClick={() => {
            setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
            setShowScrollToBottom(false);
            setPreviewDocumentFile(null);
            setStoredWorkspaceUiState({ activePanel: "assets", assetFilter });
            setActivePanel("assets");
            void loadWorkspaceAssets(false, assetFilter, 0);
          }} className={isSidebarCollapsed ? activePanel === "assets" ? "relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] font-medium text-[#111111]" : "relative flex h-10 w-10 items-center justify-center rounded-lg font-medium text-[#555555] transition hover:bg-[#ececec]" : activePanel === "assets" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"} title="资产库" aria-label="资产库">
            {activePanel === "assets" ? <RiFolderOpenLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiFolderLine className="h-5 w-5 shrink-0 text-[#555555]" aria-hidden="true" />}
            {!isSidebarCollapsed ? <span className="text-[13px] leading-[1.2]">资产库</span> : null}
            {activePanel !== "assets" && hasAnyAssetGenerating ? <span className={isSidebarCollapsed ? "absolute ml-7 mt-7 flex w-4 shrink-0 justify-end" : "ml-auto flex w-7 shrink-0 justify-end"}><HaloPulseIndicator /></span> : null}
          </button>
        </div>
        {isSidebarCollapsed ? <div className="mx-auto mb-3 h-px w-12 shrink-0 bg-[#e5e5e5]" aria-hidden="true" /> : null}

        {activePanel === "assets" ? (
          <>
            <div className={isSidebarCollapsed ? "yinzao-chat-scroll yinzao-scrollbar-hover min-h-0 flex-1 space-y-[6px] overflow-y-auto pb-px pt-px" : "yinzao-chat-scroll yinzao-scrollbar-hover -mr-3 min-h-0 flex-1 space-y-[3px] overflow-y-auto pb-px pl-px pr-3 pt-px"}>
              {assetGenerationTypes.map((type) => ({ label: assetTypeLabels[type], value: type, count: getAssetCount(type, assets.filter((asset) => asset.type === type && isAssetGenerationAsset(asset)).length) })).map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = assetTypeIcons[item.value];
                const isAssetTypeGenerating = assetGenerateJobs.some((job) => job.type === item.value && job.result.status === "generating");

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto flex w-10 shrink-0 justify-end text-[12px] text-[#9a9a9a]">{isAssetTypeGenerating ? <HaloPulseIndicator /> : item.count}</span> : isAssetTypeGenerating ? <span className="absolute ml-7 mt-7"><HaloPulseIndicator /></span> : null}
                  </button>
                );
              })}
              {!isSidebarCollapsed ? <div className="mx-3 my-3 h-px bg-[#e5e5e5]" aria-hidden="true" /> : <div className="mx-auto my-2 h-px w-12 bg-[#e5e5e5]" aria-hidden="true" />}
              {!isSidebarCollapsed ? <div className="flex items-center px-3 pb-1 pt-4 text-xs text-[#8a8a8a]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b7b7b7]" aria-hidden="true" />上传的资产</span>
              </div> : <div className="h-2" />}
              {[
                { label: "上传图片", value: "conversation_uploads" as const, count: getAssetCount("conversation_uploads", assets.filter((asset) => isUploadedMediaAsset(asset) && !isVideoAsset(asset) && !isAudioAsset(asset) && !isAssetGenerationAsset(asset) && asset.type !== "trash").length), icon: RiImageLine },
                { label: "上传视频", value: "upload_videos" as const, count: getAssetCount("upload_videos", assets.filter((asset) => isUploadedMediaAsset(asset) && isVideoAsset(asset)).length), icon: RiVideoOnLine },
                { label: "上传音频", value: "upload_audios" as const, count: getAssetCount("upload_audios", assets.filter((asset) => isUploadedMediaAsset(asset) && isAudioAsset(asset)).length), icon: RiVoiceprintLine },
              ].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
              {!isSidebarCollapsed ? <div className="flex items-center px-3 pb-1 pt-4 text-xs text-[#8a8a8a]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b7b7b7]" aria-hidden="true" />对话流资产</span>
              </div> : <div className="h-2" />}
              {[
                { label: "生成图片", value: "conversation_images" as const, count: getAssetCount("conversation_images", assets.filter((asset) => isConversationAsset(asset) && !isVideoAsset(asset) && !isAudioAsset(asset) && !isConversationUploadedAsset(asset)).length), icon: RiImageAiLine },
                { label: "生成视频", value: "conversation_videos" as const, count: getAssetCount("conversation_videos", assets.filter((asset) => isConversationAsset(asset) && isVideoAsset(asset) && !isUploadedMediaAsset(asset)).length), icon: RiFilmAiLine },
                { label: "语音生成", value: "conversation_audios" as const, count: getAssetCount("conversation_audios", assets.filter((asset) => isConversationAsset(asset) && isAudioAsset(asset) && !isUploadedMediaAsset(asset)).length), icon: RiMicAiLine },
              ].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
              {!isSidebarCollapsed ? <div className="flex items-center px-3 pb-1 pt-4 text-xs text-[#8a8a8a]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b7b7b7]" aria-hidden="true" />工作流资产</span>
              </div> : <div className="h-2" />}
              {[
                { label: "生成图片", value: "workflow_images" as const, count: getAssetCount("workflow_images", assets.filter((asset) => isWorkflowAsset(asset) && !isVideoAsset(asset) && !isUploadedMediaAsset(asset)).length), icon: RiImageAiLine },
                { label: "生成视频", value: "workflow_videos" as const, count: getAssetCount("workflow_videos", assets.filter((asset) => isWorkflowAsset(asset) && isVideoAsset(asset) && !isUploadedMediaAsset(asset)).length), icon: RiFilmAiLine },
              ].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
              {!isSidebarCollapsed ? <div className="flex items-center px-3 pb-1 pt-4 text-xs text-[#8a8a8a]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b7b7b7]" aria-hidden="true" />回收资产30天删除</span>
              </div> : <div className="h-2" />}
              {[{ label: assetTypeLabels.trash, value: "trash" as const, count: getAssetCount("trash", assets.filter((asset) => asset.type === "trash").length), icon: RiDeleteBinLine }].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {!isSidebarCollapsed ? <div className="mb-2 flex items-center justify-between px-2 text-xs text-[#8a8a8a]">
              <span>{activePanel === "workflow" ? "历史工作流" : "历史对话"}</span>
              <span>{activePanel === "workflow" ? activeWorkflowItems.length : historyDisplaySessionCount}</span>
            </div> : null}
            <button
              type="button"
              onClick={activePanel === "workflow" ? startNewWorkflow : startNewSession}
              className={isSidebarCollapsed ? "relative mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-[#cfcfcf] text-center font-medium text-[#111111] transition hover:border-[#b8b8b8] hover:bg-[#ececec]" : "relative mb-2 flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-[#cfcfcf] px-3 text-center font-medium text-[#111111] transition hover:border-[#b8b8b8] hover:bg-[#ececec]"}
              aria-label={activePanel === "workflow" ? "新建工作流" : "新建对话"}
              title={activePanel === "workflow" ? "新建工作流" : "新建对话"}
            >
              {isSidebarCollapsed ? <RiAddLine className="h-5 w-5 text-[#111111]" aria-hidden="true" /> : <span className="relative text-[13px] leading-[1.2]">
                <RiAddLine className="absolute right-full top-1/2 mr-2 h-5 w-5 -translate-y-1/2 text-[#111111]" aria-hidden="true" />
                {activePanel === "workflow" ? "新建工作流" : "新建对话"}
              </span>}
            </button>
            {isSidebarCollapsed ? (
              <div className="relative flex min-h-0 flex-1 justify-center pt-px">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    const shouldClose = isCollapsedHistoryMenuOpen;
                    closeAllPopupMenus();
                    if (!shouldClose) setIsCollapsedHistoryMenuOpen(true);
                  }}
                  className={isCollapsedHistoryMenuOpen ? "flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] text-[#111111]" : "flex h-10 w-10 items-center justify-center rounded-lg text-[#555555] transition hover:bg-[#ececec] hover:text-[#111111]"}
                  aria-label={activePanel === "workflow" ? "打开工作流列表" : "打开历史对话"}
                  title={activePanel === "workflow" ? "工作流列表" : "历史对话"}
                >
                  {activePanel === "workflow" ? <RiGitPullRequestLine className="h-5 w-5" aria-hidden="true" /> : <RiChat3Line className="h-5 w-5" aria-hidden="true" />}
                </button>

                {isCollapsedHistoryMenuOpen ? (
                  <div onClick={(event) => event.stopPropagation()} className="absolute left-[66px] top-0 z-40 flex max-h-[520px] w-[222px] flex-col overflow-hidden rounded-[12px] border border-[#e0e0e0] bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                     <div className="yinzao-scrollbar-always min-h-0 flex-1 space-y-[3px] overflow-y-auto pr-1">
                      {activePanel === "workflow" ? visibleWorkflowItems.map((item) => {
                        const isMenuOpen = openWorkflowMenuId === item.id;
                        const isWorkflowRunning = isWorkflowItemRunning(item, runningWorkflowIds);

                        return (
                          <div key={item.id} className="relative">
                            <button type="button" onClick={() => { setActiveWorkflowId(item.id); setOpenWorkflowMenuId(""); setIsCollapsedHistoryMenuOpen(false); }} className={item.id === activeWorkflow?.id ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left" : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"}>
                              <div className={item.id === activeWorkflow?.id ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{item.title}</div>
                            </button>
                            {isWorkflowRunning ? (
                              <div className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center" aria-label="工作流生成中"><HaloPulseIndicator /></div>
                            ) : (
                              <button type="button" aria-label="打开工作流菜单" onClick={(event) => { event.stopPropagation(); toggleWorkflowMenu(item.id, event.currentTarget); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]">
                                <RiMoreLine className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            {isMenuOpen && !isWorkflowRunning && !isSidebarCollapsed ? (
                              <div onClick={(event) => event.stopPropagation()} className="absolute right-1 top-10 z-50 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                                <button type="button" onClick={() => pinWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>置顶</span></button>
                                <button type="button" onClick={() => renameWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>重命名</span></button>
                                <button type="button" onClick={() => archiveWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiInboxArchiveLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>归档</span></button>
                                <button type="button" onClick={() => deleteWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50"><RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>删除</span></button>
                              </div>
                            ) : null}
                          </div>
                        );
                      }) : visibleHistorySessions.map((session) => {
                        const isActive = session.id === activeSession?.id;
                        const isMenuOpen = openSessionMenuId === session.id;
                        const isSessionRunning = resolvingSessionIds.has(session.id) || getSessionPendingRequests(session).length > 0 || modelInfoSessionId === session.id;

                        return (
                          <div key={session.id} className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSessionId(session.id);
                                setOpenSessionMenuId("");
                                setIsCollapsedHistoryMenuOpen(false);
                                void loadSessionDetails(session.id);
                              }}
                              className={isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left" : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"}
                            >
                              <div className={isActive ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{session.title}{loadingSessionIds.has(session.id) ? " · 加载中" : ""}</div>
                            </button>

                            {isSessionRunning ? (
                              <div className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center" aria-label="对话生成中"><HaloPulseIndicator /></div>
                            ) : (
                              <button type="button" aria-label="打开对话菜单" onClick={(event) => { event.stopPropagation(); toggleSessionMenu(session.id, event.currentTarget); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]"><RiMoreLine className="h-4 w-4" aria-hidden="true" /></button>
                            )}

                            {isMenuOpen && !isSessionRunning && !isSidebarCollapsed ? (
                              <div onClick={(event) => event.stopPropagation()} className="absolute right-1 top-10 z-50 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                                <button type="button" onClick={() => pinSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>置顶</span></button>
                                <button type="button" onClick={() => renameSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>重命名</span></button>
                                <button type="button" onClick={() => archiveSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiInboxArchiveLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>归档</span></button>
                                <button type="button" onClick={() => deleteSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50"><RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>删除</span></button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {shouldShowHistoryLoadStatus ? (
                        workspaceLoadStatus === "failed" ? (
                          <button type="button" onClick={retryWorkspaceLoad} className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]">
                            <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#367cee]">{historyLoadStatusText}</div>
                          </button>
                        ) : (
                          <div className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left">
                            <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{historyLoadStatusText}</div>
                          </div>
                        )
                      ) : null}
                      {activePanel === "workflow" && hiddenWorkflowItemCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setWorkflowVisibleItemCount((count) => Math.min(activeWorkflowItems.length, count + WORKFLOW_LOAD_MORE_COUNT))}
                          className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                        >
                          <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">加载更多</div>
                        </button>
                      ) : activePanel !== "workflow" && (hiddenHistorySessionCount > 0 || historyHasMoreSessions) ? (
                        <button
                          type="button"
                          disabled={isHistoryLoadingMore}
                          onClick={() => {
                            if (hiddenHistorySessionCount > 0) {
                              setHistoryVisibleSessionCount((count) => Math.min(historySessions.length, count + HISTORY_LOAD_MORE_COUNT));
                              return;
                            }
                            void loadMoreHistorySessions();
                          }}
                          className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                        >
                          <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{isHistoryLoadingMore ? "加载中..." : "加载更多"}</div>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : <div className="yinzao-chat-scroll yinzao-scrollbar-hover -mr-3 min-h-0 flex-1 space-y-[3px] overflow-y-auto pb-10 pl-px pr-3 pt-px">
              {activePanel === "workflow" ? visibleWorkflowItems.map((item) => {
                const isMenuOpen = openWorkflowMenuId === item.id;
                const isWorkflowRunning = isWorkflowItemRunning(item, runningWorkflowIds);

                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => { setActiveWorkflowId(item.id); setOpenWorkflowMenuId(""); }}
                      className={item.id === activeWorkflow?.id ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left" : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"}
                    >
                      <div className={item.id === activeWorkflow?.id ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{item.title}</div>
                    </button>

                    {isWorkflowRunning ? (
                      <div className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center" aria-label="工作流生成中">
                        <HaloPulseIndicator />
                      </div>
                    ) : (
                    <button
                      type="button"
                      aria-label="打开工作流菜单"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleWorkflowMenu(item.id, event.currentTarget);
                      }}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]"
                    >
                      <RiMoreLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                    )}

                    {isMenuOpen && !isWorkflowRunning ? (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        className={
                          sessionMenuPlacement === "top"
                            ? "absolute bottom-10 right-1 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                            : "absolute right-1 top-10 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                        }
                      >
                        <button type="button" onClick={() => pinWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                          <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>置顶</span>
                        </button>
                        <button type="button" onClick={() => renameWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                          <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>重命名</span>
                        </button>
                        <button type="button" onClick={() => archiveWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                          <RiInboxArchiveLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>归档</span>
                        </button>
                        <button type="button" onClick={() => deleteWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                          <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>删除</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              }) : visibleHistorySessions.map((session) => {
            const isActive = session.id === activeSession?.id;
            const isMenuOpen = openSessionMenuId === session.id;
            const isSessionRunning = resolvingSessionIds.has(session.id) || getSessionPendingRequests(session).length > 0 || modelInfoSessionId === session.id;

            return (
              <div key={session.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setOpenSessionMenuId("");
                    void loadSessionDetails(session.id);
                  }}
                  className={
                    isActive
                      ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left"
                      : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"
                  }
                >
                  <div className={isActive ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{session.title}{loadingSessionIds.has(session.id) ? " · 加载中" : ""}</div>
                </button>

                {isSessionRunning ? (
                  <div className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center" aria-label="对话生成中">
                    <HaloPulseIndicator />
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="打开对话菜单"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSessionMenu(session.id, event.currentTarget);
                    }}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]"
                  >
                    <RiMoreLine className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}

                {isMenuOpen && !isSessionRunning ? (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className={
                      sessionMenuPlacement === "top"
                        ? "absolute bottom-10 right-1 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                        : "absolute right-1 top-10 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                    }
                  >
                    <button type="button" onClick={() => pinSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                      <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>置顶</span>
                    </button>
                    <button type="button" onClick={() => renameSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                      <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>重命名</span>
                    </button>
                    <button type="button" onClick={() => archiveSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                      <RiInboxArchiveLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>归档</span>
                    </button>
                    <button type="button" onClick={() => deleteSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                      <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>删除</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
              })}
              {shouldShowHistoryLoadStatus ? (
                workspaceLoadStatus === "failed" ? (
                  <button type="button" onClick={retryWorkspaceLoad} className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]">
                    <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#367cee]">{historyLoadStatusText}</div>
                  </button>
                ) : (
                  <div className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left">
                    <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{historyLoadStatusText}</div>
                  </div>
                )
              ) : null}
              {activePanel === "workflow" && hiddenWorkflowItemCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setWorkflowVisibleItemCount((count) => Math.min(activeWorkflowItems.length, count + WORKFLOW_LOAD_MORE_COUNT))}
                  className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                >
                  <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">加载更多</div>
                </button>
              ) : activePanel !== "workflow" && (hiddenHistorySessionCount > 0 || historyHasMoreSessions) ? (
                <button
                  type="button"
                  disabled={isHistoryLoadingMore}
                  onClick={() => {
                    if (hiddenHistorySessionCount > 0) {
                      setHistoryVisibleSessionCount((count) => Math.min(historySessions.length, count + HISTORY_LOAD_MORE_COUNT));
                      return;
                    }
                    void loadMoreHistorySessions();
                  }}
                  className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                >
                  <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{isHistoryLoadingMore ? "加载中..." : "加载更多"}</div>
                </button>
              ) : null}
            </div>}
          </>
        )}
        <div className={isSidebarCollapsed ? "relative z-20 mt-0 flex min-h-[118px] flex-col items-center justify-center pb-3 pt-1" : "relative z-20 mt-0 flex min-h-[148px] flex-col justify-center pb-3 pt-1"}>
          <div aria-hidden="true" className={isSidebarCollapsed ? "absolute bottom-0 left-0 right-0 top-[-6px] bg-[#f9f9f9]" : "absolute bottom-0 left-[-12px] right-[-12px] top-[-6px] bg-[#f9f9f9]"} />
          <div aria-hidden="true" style={{ position: "absolute", left: isSidebarCollapsed ? 0 : -12, right: isSidebarCollapsed ? 0 : -12, top: -6, height: 1, background: "#e5e5e5", zIndex: 1 }} />
          {isSidebarCollapsed ? (
            <button type="button" onClick={() => openUserDialog("credits")} className="relative z-10 mt-0 flex h-12 w-12 flex-col items-center justify-center rounded-[10px] border border-[#eeeeee] bg-white text-[#222222] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:bg-[#f7f7f7]" aria-label="打开我的积分" title="我的积分">
              <div className="flex flex-col items-center justify-center gap-0.5">
                <div className="flex flex-col items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold leading-none text-[#222222]">
                  <RiVipDiamondLine className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
                  <span className="font-semibold">{currentUserCredits.toLocaleString("en-US")}</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="relative z-10 mx-[7px] mt-0 rounded-[10px] border border-[#eeeeee] bg-white p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex h-7 items-center px-1">
                <div className="flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-[#222222]">
                  <RiVipDiamondLine className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
                  <span>积分：<span className="font-semibold">{currentUserCredits.toLocaleString("en-US")}</span></span>
                </div>
              </div>
              <button type="button" onClick={() => openUserDialog("credits")} className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#faf8f2] px-2 text-[#9b8460] transition hover:bg-[#f5f1e8]">
                <RiVipCrown2Line className="h-[18px] w-[18px] shrink-0 text-[#9b8460]" aria-hidden="true" />
                <span className="font-medium leading-none" style={{ fontSize: 12 }}>个人免费版</span>
              </button>
            </div>
          )}
          <div
            className={isSidebarCollapsed ? "relative z-10 mt-2" : "relative z-10 mx-2 mt-2"}
            onMouseEnter={() => {
              closeAllPopupMenus("user");
              setIsUserMenuOpen(true);
            }}
            onMouseLeave={() => {
              setIsUserMenuOpen(false);
              setIsThemeMenuOpen(false);
            }}
          >
            {isUserMenuOpen ? (
              <div ref={userMenuRef} className="absolute bottom-full left-1/2 z-[9999] w-[222px] -translate-x-1/2 pb-2">
                <div className="overflow-visible rounded-[12px] border border-[#e0e0e0] bg-white pt-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                  <button type="button" onClick={() => openUserDialog("profile")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiAccountCircleLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>用户信息</span>
                  </button>
                  <button type="button" onClick={() => openUserDialog("credits")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiVipDiamondLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>我的积分</span>
                  </button>
                  <button type="button" onClick={() => openUserDialog("security")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiShieldUserLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>帐号安全</span>
                  </button>
                  <button type="button" onClick={() => openUserDialog("archive")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiInboxArchiveLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>归档</span>
                  </button>
                  <div className="relative mx-2" onMouseEnter={() => setIsThemeMenuOpen(false)} onMouseLeave={() => setIsThemeMenuOpen(false)}>
                    <button type="button" disabled aria-disabled="true" onClick={(event) => { event.stopPropagation(); setIsThemeMenuOpen(false); }} className="flex h-11 w-full cursor-not-allowed items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#aaaaaa] opacity-70">
                      <ThemeModeIcon className="h-[18px] w-[18px] text-[#b0b0b0]" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13 }}>{themeModeLabel}</span>
                      <RiArrowRightSLine className="h-[18px] w-[18px] shrink-0 text-[#b0b0b0]" aria-hidden="true" />
                    </button>
                    {isThemeMenuOpen ? (
                      <div className="absolute bottom-0 left-[calc(100%+8px)] z-[10000] w-[220px] rounded-[12px] border border-[#e0e0e0] bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                        {([
                          { value: "light" as const, label: "浅色模式", icon: RiSunLine },
                          { value: "dark" as const, label: "深色模式", icon: RiMoonLine },
                          { value: "system" as const, label: `跟随系统 · ${resolvedTheme === "dark" ? "深色" : "浅色"}`, icon: RiComputerLine },
                        ]).map((item) => {
                          const ItemIcon = item.icon;
                          const selected = themeMode === item.value;

                          return (
                            <button key={item.value} type="button" onClick={(event) => { event.stopPropagation(); setThemeMode(item.value); setIsThemeMenuOpen(false); setIsUserMenuOpen(false); }} className="flex h-10 w-full items-center gap-3 rounded-[8px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                              <ItemIcon className="h-[18px] w-[18px] shrink-0 text-[#333333]" aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13 }}>{item.label}</span>
                              {selected ? <RiCheckLine className="h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => openUserDialog("settings")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiSettingsLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>设置</span>
                  </button>
                  {currentUserIsAdmin ? (
                    <button type="button" onClick={() => { setIsUserMenuOpen(false); window.open("/admin", "_blank", "noopener,noreferrer"); }} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                      <RiTerminalWindowFill className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                      <span style={{ fontSize: 13 }}>后台管理</span>
                    </button>
                  ) : null}
                  <div className="mt-2 overflow-hidden rounded-b-[12px] border-t border-[#e7e7e7] bg-[#f4f4f4]">
                    <button type="button" onClick={() => void logoutUser()} className="flex h-14 w-full items-center gap-3 px-3 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#eeeeee]">
                      <RiLogoutBoxRLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                      <span style={{ fontSize: 13 }}>退出登录</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <button ref={userMenuButtonRef} type="button" className={isSidebarCollapsed ? "flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : "flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-[#ececec]"}>
              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full" style={currentUserAvatarUrl ? undefined : { backgroundColor: defaultUserAvatar.backgroundColor, border: `1px solid ${defaultUserAvatar.borderColor}`, color: defaultUserAvatar.color }}>
                {currentUserAvatarUrl ? (
                  <Image src={currentUserAvatarUrl} alt="用户头像" width={32} height={32} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[13px] font-medium">{defaultUserAvatar.label}</div>
                )}
              </div>
              {!isSidebarCollapsed ? <div className="flex min-w-0 flex-col justify-center">
                <div className="truncate text-[13px] font-medium leading-4 text-[#333333]">{currentUserNickname || currentUserEmail}</div>
                <div className="truncate text-[12px] leading-4 text-[#8a8a8a]">{currentUserEmail}</div>
              </div> : null}
            </button>
          </div>
        </div>
      </aside>
      ) : null}

      {isSidebarVisible && isSidebarCollapsed && isCollapsedHistoryMenuOpen && collapsedActionMenuPosition && typeof document !== "undefined" ? (() => {
        const session = openSessionMenuId ? visibleHistorySessions.find((item) => item.id === openSessionMenuId) : undefined;
        if (session) {
          return createPortal(
            <div
              onClick={(event) => event.stopPropagation()}
              className="fixed z-[10000] w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
              style={{ left: collapsedActionMenuPosition.left, top: collapsedActionMenuPosition.top }}
            >
              <button type="button" onClick={() => pinSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>置顶</span>
              </button>
              <button type="button" onClick={() => renameSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>重命名</span>
              </button>
              <button type="button" onClick={() => archiveSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                <RiInboxArchiveLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>归档</span>
              </button>
              <button type="button" onClick={() => deleteSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>删除</span>
              </button>
            </div>,
            document.body,
          );
        }

        const workflow = openWorkflowMenuId ? workflowItems.find((item) => item.id === openWorkflowMenuId) : undefined;
        if (!workflow) return null;

        return createPortal(
          <div
            onClick={(event) => event.stopPropagation()}
            className="fixed z-[10000] w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
            style={{ left: collapsedActionMenuPosition.left, top: collapsedActionMenuPosition.top }}
          >
            <button type="button" onClick={() => pinWorkflow(workflow.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
              <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>置顶</span>
            </button>
            <button type="button" onClick={() => renameWorkflow(workflow.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
              <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>重命名</span>
            </button>
            <button type="button" onClick={() => archiveWorkflow(workflow.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
              <RiInboxArchiveLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>归档</span>
            </button>
            <button type="button" onClick={() => deleteWorkflow(workflow.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
              <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>删除</span>
            </button>
          </div>,
          document.body,
        );
      })() : null}

      <section
        className="flashmuse-main relative flex h-screen min-h-screen flex-col bg-white"
        style={{ marginRight: previewDocumentFile ? (previewDocumentWidth || getDefaultDocumentPreviewWidth()) : 0 }}
        onDragEnter={handleChatDragEnter}
        onDragOver={handleChatDragOver}
        onDragLeave={handleChatDragLeave}
        onDrop={handleChatDrop}
      >
        {activePanel !== "workflow" ? <div className="relative z-30 flex h-[56px] shrink-0 items-center justify-center border-b border-[#eeeeee] bg-white px-14">
          <button
            type="button"
            onClick={cycleSidebarState}
            className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
          >
            {isSidebarVisible ? <RiSidebarFoldLine className="h-[22px] w-[22px]" aria-hidden="true" /> : <RiSidebarUnfoldLine className="h-[22px] w-[22px]" aria-hidden="true" />}
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-center">
            <div className="truncate text-[13px] font-medium leading-8 text-[#111111]">{activePanel === "assets" ? "资产库" : activeSession?.title ?? "新对话"}</div>
            {activePanel === "chat" && activeSession ? (
              <button
                type="button"
                onClick={() => renameSession(activeSession.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
                aria-label="重命名当前对话"
              >
                <RiEditBoxLine className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {activePanel === "chat" ? <UsageSummaryButton summary={activeSession?.usageSummary} mediaCounts={getSessionMediaCounts(activeSession)} /> : null}

        </div> : null}

        <div className="relative flex-1 overflow-hidden">
          {isDragUploadActive ? (
            <div className="pointer-events-none absolute inset-2 z-[90] flex items-center justify-center rounded-[12px] border border-dashed border-[#b9b9b9] bg-white/58 backdrop-blur-[8px]">
              <div className="flex -translate-y-6 flex-col items-center text-center">
                <div className="mb-4 flex h-[76px] w-[76px] items-center justify-center rounded-full border-2 border-[#75d06a] bg-transparent text-[#75d06a]">
                  <RiArrowDownFill className="h-[48px] w-[48px]" aria-hidden="true" />
                </div>
                <div className="text-[18px] font-semibold text-[#111111]">{activePanel === "workflow" ? "拖放到画布上传节点" : "在此处拖放文件"}</div>
                <div className="mt-3 max-w-[420px] text-[13px] leading-6 text-[#8a8a8a]">
                  文件类型：{activePanel === "workflow" ? workflowUploadNodeTypeLabel : activePanel === "assets" ? assetsUploadTypeLabel : supportedUploadTypeLabel}
                </div>
              </div>
            </div>
          ) : null}
          <div ref={chatScrollRef} onScroll={updateScrollToBottomButton} className={activePanel === "workflow" ? "yinzao-chat-scroll h-full overflow-y-auto bg-white" : "yinzao-chat-scroll h-full overflow-y-auto bg-white px-4 py-8 pb-6 sm:px-6 lg:px-8"}>
          {activePanel === "assets" ? (
            assetsLoadStatus !== "loaded" && !hasCurrentFilterAssets ? (
              <div className="flex min-h-full items-center justify-center bg-white pb-20 pt-10 text-center">
                <div className="flex w-[220px] flex-col items-center gap-2">
                  <div className="text-[13px] font-medium leading-none text-[#367cee]">{assetsLoadStatus === "failed" ? "加载失败" : "加载中..."}</div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[#e8efff]">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-[#367cee]" />
                  </div>
                  {assetsLoadStatus === "failed" ? <button type="button" onClick={() => { setAssetsLoadStatus("idle"); void loadWorkspaceAssets(); }} className="mt-2 text-[13px] font-medium text-[#367cee]">重新加载</button> : null}
                </div>
              </div>
            ) : (
            <AssetManagementPanel assets={assets} assetFilter={assetFilter} renderLimit={assetRenderLimit} openAssetActionMenuId={openAssetActionMenuId} isLoadingMore={assetsLoadStatus === "loading" && hasCurrentFilterAssets && assetLoadingReason === "scroll"} now={timerNow} pendingAssetGenerateJobs={assetGenerateJobs} onOpenPendingGenerate={openAssetGenerateJob} onDismissGenerateJob={(jobId) => { dismissedAssetGenerateJobIdsRef.current.add(jobId); setAssetGenerateJobs((current) => current.filter((job) => job.id !== jobId)); }} uploadSlots={visibleAssetUploadSlots} mediaUploadCards={assetMediaUploadCards} onSelectUploadFiles={(files) => void selectAssetUploadFiles(files)} onSelectMediaUploadFiles={(kind, files) => void selectAssetMediaUploadFiles(kind, files)} onRemoveUploadSlot={removeAssetUploadSlot} onRetryUploadSlot={retryAssetUploadSlot} onPreview={(asset) => { setPreviewDocumentFile(null); setPreviewAsset(enrichAssetPreviewMeta(asset)); }} onUseAsset={(asset) => {
              if (activeUploadedImages.length >= currentMaxReferenceImages && !activeUploadedImages.some((image) => image.url === asset.url)) {
                showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
                return;
              }

              setActivePanel("chat");
              const cursor = Math.min(Math.max(0, draftCursorOffset), activeInput.length);
              addActiveUploadedImages([toUploadedAssetReference(asset)], { draftBase: activeInput.slice(0, cursor), draftSuffix: activeInput.slice(cursor), insertReferenceText: true });
              focusEditorAt(cursor + asset.name.length + 2);
            }} onRename={(asset) => {
              closeAllPopupMenus();
              setOpenAssetActionMenuId("");
              setRenamingAssetId(asset.id);
              setAssetRenameInput(asset.name);
            }} onToggleActionMenu={(assetId) => {
              const shouldClose = openAssetActionMenuId === assetId;
              closeAllPopupMenus();
              if (!shouldClose) setOpenAssetActionMenuId(assetId);
            }} onOpenCharacterGenerate={() => {
              closeAllPopupMenus();
              setAssetGenerateType("character_image");
              setCharacterGenerateRatio(assetGenerateRatioSelections.character_image === "scene-grid" ? "single" : assetGenerateRatioSelections.character_image);
              resetCharacterGenerateWorkspace();
              setCharacterGeneratePrompt(assetGeneratePromptDrafts.character_image);
              setCharacterPromptCursorOffset(assetGeneratePromptDrafts.character_image.length);
              setIsCharacterGenerateOpen(true);
            }} onOpenSceneGenerate={() => {
              closeAllPopupMenus();
              setAssetGenerateType("scene_image");
              setCharacterGenerateRatio(assetGenerateRatioSelections.scene_image);
              resetCharacterGenerateWorkspace();
              setCharacterGeneratePrompt(assetGeneratePromptDrafts.scene_image);
              setCharacterPromptCursorOffset(assetGeneratePromptDrafts.scene_image.length);
              setIsCharacterGenerateOpen(true);
            }} onOpenPropGenerate={() => {
              closeAllPopupMenus();
              setAssetGenerateType("prop_image");
              setCharacterGenerateRatio(assetGenerateRatioSelections.prop_image === "scene-grid" ? "single" : assetGenerateRatioSelections.prop_image);
              resetCharacterGenerateWorkspace();
              setCharacterGeneratePrompt(assetGeneratePromptDrafts.prop_image);
              setCharacterPromptCursorOffset(assetGeneratePromptDrafts.prop_image.length);
              setIsCharacterGenerateOpen(true);
            }} onOpenShotGenerate={() => {
              closeAllPopupMenus();
              setAssetGenerateType("shot_image");
              setCharacterGenerateRatio(assetGenerateRatioSelections.shot_image === "scene-grid" ? "three-view" : assetGenerateRatioSelections.shot_image);
              resetCharacterGenerateWorkspace();
              setCharacterGeneratePrompt(assetGeneratePromptDrafts.shot_image);
              setCharacterPromptCursorOffset(assetGeneratePromptDrafts.shot_image.length);
              setIsCharacterGenerateOpen(true);
            }} onChangeType={(assetId, target) => {
              const changingAsset = assets.find((asset) => asset.id === assetId);
              const movedAt = Date.now();
              const movedAsset = changingAsset
                ? target === "conversation_image"
                  ? { ...changingAsset, type: "other" as const, librarySource: "conversation" as const, sourcePrompt: changingAsset.sourcePrompt || UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload" as const, lockedType: true, updatedAt: movedAt }
                  : { ...changingAsset, type: target, librarySource: "asset_generation" as const, lockedType: true, updatedAt: movedAt }
                : undefined;
              if (changingAsset && movedAsset) {
                const from = getAssetCountFilter(changingAsset);
                const to = getAssetCountFilter(movedAsset);
                if (from !== to) adjustAssetCounts([{ filter: from, delta: -1 }, { filter: to, delta: 1 }]);
              }
              setAssets((current) => {
                const targetAsset = current.find((asset) => asset.id === assetId);
                if (!targetAsset) return current;
                const nextMovedAsset = target === "conversation_image"
                  ? { ...targetAsset, type: "other" as const, librarySource: "conversation" as const, sourcePrompt: targetAsset.sourcePrompt || UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload" as const, lockedType: true, updatedAt: movedAt }
                  : { ...targetAsset, type: target, librarySource: "asset_generation" as const, lockedType: true, updatedAt: movedAt };
                const movedKey = getAssetIdentityKey(nextMovedAsset);
                return [nextMovedAsset, ...current.filter((asset) => asset.id !== assetId && getAssetIdentityKey(asset) !== movedKey)];
              });
              setOpenAssetActionMenuId("");
              persistMediaAssetState(changingAsset, { currentCategory: target === "conversation_image" ? "conversation_uploads" : target });
            }} onDelete={deleteAsset} onRestore={restoreAsset} />
            )
          ) : activePanel === "workflow" ? (
            activeWorkflow ? (
              <>
                {activeWorkflow.canvasTrimmed ? (
                  // 画布还没补拉回来 → 先不渲染画布（否则会是一张空画布）。
                  <div className="flex h-full w-full items-center justify-center">
                    {workflowCanvasLoadFailedIds.includes(activeWorkflow.id) ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="text-[13px] text-[#666]">工作流加载失败，请检查网络后重试。</div>
                        <button type="button" onClick={() => { void hydrateWorkflowCanvas(activeWorkflow.id); }} className="flex h-9 items-center rounded-lg bg-[#111] px-4 text-[13px] font-medium text-white transition hover:bg-[#333]">重新加载</button>
                      </div>
                    ) : (
                      <div className="text-[13px] text-[#999]">工作流加载中…</div>
                    )}
                  </div>
                ) : (
                <WorkflowCanvas
                  key={activeWorkflow.id}
                  workflowId={activeWorkflow.id}
                  value={activeWorkflow.canvas}
                  workflowTitle={activeWorkflow.title}
                  leftSidebarVisible={isSidebarVisible}
                  leftSidebarToggleLabel={sidebarToggleLabel}
                  onToggleLeftSidebar={cycleSidebarState}
                  workflowAssets={assets.filter((asset) => isWorkflowAsset(asset) && (asset.workflowId || asset.sessionId) === activeWorkflow.id).map((asset) => ({ id: asset.id, name: asset.name, url: asset.url, posterUrl: asset.posterUrl, kind: isVideoAsset(asset) ? "video" : "image", nodeId: asset.workflowNodeId, sourcePrompt: asset.sourcePrompt, model: asset.model as ModelName | undefined, ratio: asset.previewMeta?.ratio, resolution: asset.previewMeta?.resolution, duration: asset.previewMeta?.duration, dimensions: getPreviewMetaDimensions(asset.previewMeta) }))}
                  referenceAssets={MENTION_CATEGORIES.flatMap((cat) => assets.filter((asset) => isAssetInFilter(asset, cat.value)).map((asset) => { const item = assetToMentionPickerItem(asset); return { id: asset.id, name: asset.name, url: asset.url, thumbnailUrl: item.thumbnailUrl, kind: item.kind, groupType: cat.value, groupLabel: cat.label }; }))}
                  referenceAssetsLoadStatus={assetsLoadStatus}
                  referenceAssetCounts={Object.fromEntries(MENTION_CATEGORIES.map((cat) => [cat.value, Number(assetCounts[cat.value] ?? 0)]))}
                  onLoadReferenceAssets={() => { void loadMentionAssetFilters(); }}
                  onLoadReferenceFilter={(value, offset) => { if (offset > 0 || (!loadedAssetFilters[value as AssetFilter] && !mentionFilterPaging[value as AssetFilter]?.loading)) void loadMentionFilterPage(value as AssetFilter, offset); }}
                  referenceFilterLoading={Object.fromEntries(MENTION_CATEGORIES.map((cat) => [cat.value, mentionFilterPaging[cat.value]?.loading ?? false]))}
                  referenceFilterNextOffset={Object.fromEntries(MENTION_CATEGORIES.map((cat) => [cat.value, mentionFilterPaging[cat.value]?.nextOffset ?? 0]))}
                  onLoadMoreReferenceAssets={(groupType, loadedCount) => { void loadMoreMentionGroup(groupType as AssetFilter, loadedCount); }}
                  onExternalFilesDrop={() => {
                    clearDragUploadOverlay();
                  }}
                  onOpenAssetImport={openAssetImportDialog}
                  assetsToImport={assetsToImport}
                  onAssetsImported={() => setAssetsToImport([])}
                  enabledTextModelIds={enabledAgentChatModelIds}
                  textModelProviders={agentChatModelProviders}
                  enabledImageModelIds={enabledGenerationModelIds.image}
                  enabledVideoModelIds={enabledGenerationModelIds.video}
                  uploadRuleOverrides={uploadRuleOverrides}
                  promptLengthOverrides={promptLengthOverrides}
                  creditRate={creditRate}
                  editModelToggles={editModelToggles}
                  getImageDisplayUrl={(url) => getMediaThumbnailUrl(url)}
                  getVideoPosterDisplayUrl={(url, posterUrl) => {
                    const poster = posterUrl ?? getLocalVideoPosterUrl(url);
                    return poster ? getMediaThumbnailUrl(poster) : undefined;
                  }}
                  onGeneratedMedia={(media) => addWorkflowGeneratedAssets(activeWorkflow.id, media.nodeId, { kind: media.kind, urls: media.urls, reservedNames: media.reservedNames, posterUrl: media.posterUrl, sourcePrompt: media.sourcePrompt, model: media.model, ratio: media.ratio, resolution: media.resolution, duration: media.duration, dimensions: media.dimensions, silent: media.silent, promptOptimization: media.promptOptimization })}
                  onShowTip={showInputTip}
                  // 工作流里上传/视频截图入库后，立刻刷新资产库对应的「上传」分类（列表+计数），
                  // 免得右侧图片要手动刷新页面才出现。文档类永不显示、不刷。
                  onUploadedAsset={({ mediaType }) => {
                    const filter: AssetFilter | undefined = mediaType === "image" ? "conversation_uploads" : mediaType === "video" ? "upload_videos" : mediaType === "audio" ? "upload_audios" : undefined;
                    if (filter) void loadWorkspaceAssets(true, filter, 0, "auto");
                  }}
                  onPreviewMedia={(media) => {
                    const existingAsset = assets.find((asset) => isWorkflowAsset(asset) && normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(media.url));
                    const workflowNode = activeWorkflow.canvas?.nodes?.find((node) => node.id === media.nodeId);
                    setPreviewDocumentFile(null);
                    if (workflowNode) {
                      setPreviewAsset(getWorkflowPreviewAsset(activeWorkflow, workflowNode, media.kind, media.url, existingAsset));
                      return;
                    }
                    if (existingAsset) {
                      setPreviewAsset(enrichAssetPreviewMeta(existingAsset));
                      return;
                    }
                    const dimensions = media.dimensions;
                    const previewMeta: PreviewMediaMeta = media.kind === "video"
                      ? { modelLabel: media.model ? getGenerationModelLabel("video", media.model) : "-", ratio: dimensions ? getCommonRatioLabel(dimensions.width, dimensions.height) : media.ratio || "-", sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: dimensions ? getVideoResolutionFromDimensions(dimensions) ?? media.resolution ?? "-" : media.resolution || "-", mode: "video", duration: media.duration }
                      : { modelLabel: media.model ? getGenerationModelLabel("image", media.model) : "-", ratio: dimensions ? getCommonRatioLabel(dimensions.width, dimensions.height) : media.ratio || "-", sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: dimensions ? getImageResolutionFromDimensions(dimensions) ?? media.resolution ?? "-" : media.resolution || "-", mode: "image" };
                    setPreviewAsset({
                      id: `${activeWorkflow.id}-${media.nodeId}-${media.kind}`,
                      type: media.kind === "video" ? "shot_video" : "other",
                      name: media.name,
                      systemName: media.name,
                      url: media.url,
                      posterUrl: media.posterUrl,
                      librarySource: "workflow",
                      sourcePrompt: media.sourcePrompt || activeWorkflow.title,
                      promptSource: "generated",
                      previewMeta,
                      sessionId: activeWorkflow.id,
                      workflowId: activeWorkflow.id,
                      workflowNodeId: media.nodeId,
                      lockedType: true,
                      createdAt: activeWorkflow.updatedAt ?? Date.now(),
                    });
                  }}
                  onChange={(canvas, meta) => updateWorkflowCanvas(activeWorkflow.id, canvas, meta)}
                  onCredit={applyWorkflowCreditResult}
                />
                )}                {inputReminder ? (
                  <div className="pointer-events-none absolute bottom-[108px] left-1/2 z-[10000] -translate-x-1/2">
                    <ReminderToast reminder={inputReminder} />
                  </div>
                ) : null}
                <UsageSummaryButton summary={activeWorkflow.usageSummary} mediaCounts={activeWorkflow.canvas?.countedGeneratedUrls ? (activeWorkflow.canvas.generatedMediaCounts ?? getWorkflowMediaCounts(activeWorkflow)) : getWorkflowMediaCounts(activeWorkflow)} className="absolute right-4 top-4 z-30" />
                {assetImportOpen ? (
                  <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40" onClick={() => setAssetImportOpen(false)}>
                    <div className="flex h-[80vh] w-[1080px] max-w-[94vw] flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-between border-b border-[#eee] px-5 py-3.5">
                        <div className="text-[15px] font-semibold text-[#111]">从资产库导入</div>
                        <button type="button" onClick={() => setAssetImportOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-[#888] hover:bg-[#f2f2f2]"><RiCloseLine className="h-5 w-5" /></button>
                      </div>
                      <div className="flex min-h-0 flex-1">
                        <div className="w-[220px] shrink-0 space-y-0.5 overflow-y-auto border-r border-[#eee] p-2">
                          {ASSET_IMPORT_CATEGORIES.map((cat) => {
                            const isActive = assetImportFilter === cat.value;
                            const count = assetImportCounts[cat.value] ?? 0;
                            const CategoryIcon = cat.icon;
                            return (
                              <button key={cat.value} type="button" onClick={() => selectAssetImportFilter(cat.value)} className={isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"} title={cat.label}>
                                <CategoryIcon className="mr-2 h-5 w-5 shrink-0 text-[#777777]" aria-hidden="true" />
                                <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{cat.label}</span>
                                <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-4" onScroll={(event) => {
                          const el = event.currentTarget;
                          const paging = assetImportPaging[assetImportFilter];
                          if (paging && paging.hasMore && !paging.loading && el.scrollHeight - el.scrollTop - el.clientHeight < 300) void loadAssetImportPage(assetImportFilter, paging.nextOffset);
                        }}>
                          {(() => {
                            const items = assetImportItemsByFilter[assetImportFilter] ?? [];
                            const loading = assetImportPaging[assetImportFilter]?.loading;
                            if (items.length === 0) return <div className="flex h-full items-center justify-center text-[13px] text-[#999]">{loading ? "加载中…" : "暂无资产"}</div>;
                            return (
                              <div className="grid w-full grid-cols-5 gap-3">
                                {items.map((asset) => {
                                  const key = normalizeMediaUrlForMatch(asset.url);
                                  const selected = Boolean(assetImportSelected[key]);
                                  const isVideo = isVideoAsset(asset);
                                  const isAudio = isAudioAsset(asset);
                                  const localPoster = getLocalVideoPosterUrl(asset.url);
                                  const poster = isAudio ? undefined : isVideo ? (asset.posterUrl ? getMediaThumbnailUrl(asset.posterUrl) : localPoster ? getMediaThumbnailUrl(localPoster) : undefined) : getMediaThumbnailUrl(asset.url);
                                  return (
                                    <button key={asset.id} type="button" onClick={() => toggleAssetImportSelection(asset)} className="group relative aspect-square overflow-hidden bg-[#f4f4f4] text-left">
                                      {isAudio ? (
                                        <div className="h-full w-full overflow-hidden"><AudioWaveformPlayer key={asset.url} url={getStaticMediaUrl(asset.url) ?? asset.url} variant="card" /></div>
                                      ) : isVideo ? (
                                        poster ? <img src={poster} alt={asset.systemName || asset.name} draggable={false} className="h-full w-full object-cover" /> : <video src={`${getStaticMediaUrl(asset.url) ?? asset.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                                      ) : poster ? <img src={poster} alt={asset.systemName || asset.name} draggable={false} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[12px] text-[#aaa]">无预览</div>}
                                      {isVideo ? <VideoPlayBadge size="md" /> : null}
                                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-black/75 to-transparent" />
                                      <span className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[calc(100%-16px)] truncate text-[13px] font-medium leading-none text-white">@{asset.systemName || asset.name}</span>
                                      <span className={`absolute right-2 top-2 z-50 flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-[#2f80ed] bg-[#2f80ed] text-white" : "border-white bg-black/25 text-transparent"}`}><RiCheckLine className="h-3.5 w-3.5" /></span>
                                      {selected ? <span className="pointer-events-none absolute inset-0 z-50 border-2 border-[#2f80ed]" /> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#eee] px-5 py-3">
                        <div className="text-[12px] text-[#888]">已选 {Object.keys(assetImportSelected).length} 项</div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setAssetImportOpen(false)} className="rounded-lg border border-[#ddd] px-4 py-2 text-[13px] text-[#444] hover:bg-[#f5f5f5]">取消</button>
                          <button type="button" onClick={() => { void confirmAssetImport(); }} disabled={Object.keys(assetImportSelected).length === 0} className="rounded-lg bg-[#111] px-12 py-2 text-[13px] font-medium text-white hover:bg-[#252525] disabled:opacity-40">确定</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="relative flex h-full min-h-full items-center justify-center bg-[#f3f3f3] bg-[linear-gradient(to_right,#d8d8d8_1px,transparent_1px),linear-gradient(to_bottom,#d8d8d8_1px,transparent_1px),linear-gradient(to_right,#e9e9e9_1px,transparent_1px),linear-gradient(to_bottom,#e9e9e9_1px,transparent_1px)] bg-[size:120px_120px,120px_120px,24px_24px,24px_24px] text-center">
                <button type="button" onClick={cycleSidebarState} className="absolute left-4 top-3 flex h-8 w-8 items-center justify-center rounded-md text-[#5c626b] transition hover:bg-black/5 hover:text-[#30343a]" aria-label={sidebarToggleLabel} title={sidebarToggleLabel}>
                  {isSidebarVisible ? <RiSidebarFoldLine className="h-[22px] w-[22px]" aria-hidden="true" /> : <RiSidebarUnfoldLine className="h-[22px] w-[22px]" aria-hidden="true" />}
                </button>
              </div>
            )
          ) : isActiveSessionLoading ? (
            <div className="flex min-h-full items-center justify-center bg-white pb-20 pt-10 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="text-[13px] font-medium leading-none text-[#367cee]">加载中...{activeSessionLoadingProgress}%</div>
                <div className="h-1 w-[100px] overflow-hidden bg-[#dbe8ff]">
                  <div className="h-full bg-[#367cee] transition-[width] duration-300 ease-out" style={{ width: `${activeSessionLoadingProgress}%` }} />
                </div>
              </div>
            </div>
          ) : !hasConversation ? (
            <div className="flex min-h-full flex-col items-center justify-center pb-20 pt-10 text-center">
              <div className="mb-9 text-[28px] font-semibold tracking-[-0.03em] text-[#050505] sm:text-[32px]">hi~把你的闪念跟我聊一聊！</div>

              <div className="flex max-w-[900px] flex-col items-center gap-3 px-6">
                {quickActionRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex flex-wrap items-center justify-center gap-2">
                    {row.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => {
                          setMode("agent");
                          void sendMessage(action.prompt, "agent");
                        }}
                        className="rounded-[12px] px-4 py-3 leading-none text-[#111111] transition hover:brightness-[0.98] hover:text-[#000000]"
                        style={{ backgroundColor: action.backgroundColor }}
                      >
                        <span style={{ fontSize: 13, lineHeight: 1 }}>{action.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[1006px] space-y-3">
              {activeSession && loadingOlderMessageSessionIds.has(activeSession.id) ? (
                <div className="flex items-center justify-center gap-2 py-4 text-[13px] text-[#8a8a8a]" role="status" aria-label="加载更早的消息">
                  <RiLoader4Line className="h-[16px] w-[16px] animate-spin" aria-hidden="true" />
                  <span>加载更早的消息</span>
                </div>
              ) : null}
              {messages.map((message) => {
                const isLegacyAgentErrorNotice = message.role === "assistant" && message.mode === "agent" && Boolean(message.error) && message.content === message.error;

                if (message.role === "system" || isLegacyAgentErrorNotice) {
                  const noticeMode = message.mode ?? "agent";
                  const modeNoticeContent = `${modeNoticeText[noticeMode].title}，${modeNoticeText[noticeMode].description}`;
                  const isErrorNotice = Boolean(message.error);
                  const isModeNotice = message.content === modeNoticeContent;
                  const isAutoReviewNotice = isBytePlusAutoReviewNotice(message.content);
                  const ModeIcon = isErrorNotice || !isModeNotice ? RiErrorWarningLine : modeOptions.find((option) => option.value === noticeMode)?.icon ?? RiRobot2Line;

                  return (
                    <div key={message.id} className={isErrorNotice || isAutoReviewNotice ? "flex justify-start" : "flex justify-start border-t border-[#eeeeee] pt-4"}>
                      <div className={isErrorNotice ? "inline-flex max-w-full items-start gap-2 text-rose-500" : isAutoReviewNotice ? "inline-flex max-w-full items-start gap-2 text-[#367cee]" : "inline-flex max-w-full items-start gap-2 text-[#9a9a9a]"}>
                        <ModeIcon className="mt-[3px] h-5 w-5 shrink-0" aria-hidden="true" />
                        <div className="text-[13px] leading-6">
                          {isErrorNotice ? (
                            <span>{message.error ?? message.content}</span>
                          ) : !isModeNotice ? (
                            <span>{message.content}</span>
                          ) : (
                            <>
                              <span className="font-semibold text-[#777777]">{modeNoticeText[noticeMode].title}</span>
                              <span>，{modeNoticeText[noticeMode].description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                const lastMessage = messages[messages.length - 1];
                const activeSuggestionMessageId = lastMessage?.role === "assistant" && (lastMessage.mode === "agent" || isAgentGeneratedMedia(lastMessage)) ? lastMessage.id : "";
                const isAssistantMessageComplete = message.role !== "assistant" || message.mode === "image" || message.mode === "video" || message.mode === "audio" || !activeTypingMessageIds.has(message.id) || completedTypingMessageIds.has(message.id);
                const messageType = getMessageType(message);
                const reaction = messageReactions[message.id];
                const issueFeedback = messageIssueFeedback[message.id];
                const activeMessagePendingRequest = activePendingRequests.find((request) => request.id === message.requestId);
                const imagePendingCount = message.mode === "image" ? Math.max(0, message.pendingImageCount ?? 0) : 0;
                const slotFailedImageCount = message.imageResultSlots?.filter((slot) => slot.type === "failed").length ?? 0;
                const imageFailedCount = message.mode === "image" ? Math.max(0, message.failedImageCount ?? 0, slotFailedImageCount) : 0;
                const videoPendingCount = message.mode === "video" ? Math.max(0, message.pendingVideoCount ?? 0) : 0;
                const videoFailedCount = message.mode === "video" ? Math.max(0, message.failedVideoCount ?? 0) : 0;
                const allImageFailuresRetrying = message.mode === "image" && imageFailedCount > 0 && (message.retryingFailedImageIndexes?.length ?? 0) >= imageFailedCount;
                const allVideoFailuresRetrying = message.mode === "video" && videoFailedCount > 0 && (message.retryingFailedVideoIndexes?.length ?? 0) >= videoFailedCount;
                const slotFailedReasons = message.mode === "image" && message.imageResultSlots?.length
                  ? (() => {
                      const list: string[] = [];
                      let ord = -1;
                      for (const slot of message.imageResultSlots) {
                        if (slot.type !== "failed") continue;
                        ord += 1;
                        if (slot.retryingStartedAt) continue;
                        const raw = slot.reason ?? message.mediaErrorReasons?.[ord];
                        list.push(normalizeMediaErrorText(raw, message.mode) ?? GENERIC_MEDIA_ERROR_MESSAGE);
                      }
                      return list;
                    })()
                  : undefined;
                const normalizedMediaErrorReasons = slotFailedReasons ?? (message.mediaErrorReasons ?? []).map((reason) => normalizeMediaErrorText(reason, message.mode)).filter((reason): reason is string => Boolean(reason));
                const mediaErrorReasonCount = normalizedMediaErrorReasons.length;
                const preferredMediaErrorIndex = Math.max(0, normalizedMediaErrorReasons.findIndex((reason) => !isGenericMediaReason(reason)));
                const selectedMediaErrorIndex = mediaErrorReasonCount > 0 ? Math.min(mediaErrorPageIndexes[message.id] ?? preferredMediaErrorIndex, mediaErrorReasonCount - 1) : 0;
                const hasVisibleMediaFailure = (message.mode === "image" && imageFailedCount > 0) || (message.mode === "video" && videoFailedCount > 0) || (message.mode === "audio" && Boolean(message.error));
                const mediaErrorText = !hasVisibleMediaFailure || allImageFailuresRetrying || allVideoFailuresRetrying ? undefined : normalizedMediaErrorReasons[selectedMediaErrorIndex] ?? normalizeMediaErrorText(message.error, message.mode) ?? (message.mode === "image" && imagePendingCount === 0 && imageFailedCount > 0 ? GENERIC_MEDIA_ERROR_MESSAGE : message.mode === "video" && videoPendingCount === 0 && videoFailedCount > 0 ? GENERIC_MEDIA_ERROR_MESSAGE : undefined);
                const isActiveVideoPending = activeMessagePendingRequest?.mode === "video" && videoPendingCount > 0 && !message.error;
                // A video is still pending based on the PERSISTED count, independent of whether the in-memory
                // foreground pending request exists. After a browser close/re-login the foreground request is
                // gone but the durable recovery effect keeps polling — so the waiting card must render from
                // videoPendingCount, not from isActiveVideoPending (which requires an in-memory pending request).
                const isVideoPendingVisible = message.mode === "video" && videoPendingCount > 0 && !message.error;
                // 乐观显示：正在后台存盘、先用远程地址展示的视频（展示专用，不在 message.videos 里）。
                const previewVideoUrls = message.mode === "video" ? (message.videoPreviewUrls ?? []) : [];
                const isActiveImagePending = activeMessagePendingRequest?.mode === "image" && imagePendingCount > 0;
                const isActiveMediaPending = isActiveVideoPending || isActiveImagePending;
                const userImageReferences = message.role === "user" ? getDisplayImageReferences(message) : undefined;
                const isAgentMediaMessage = message.role === "assistant" && isAgentGeneratedMedia(message);
                const mediaPromptReferences = message.role === "assistant" && (message.mode === "image" || message.mode === "video") ? (message.imageReferences?.length ? message.imageReferences : getOrderedExplicitImageReferences(message.content, assets, [], activeConversationImageReferences)) : undefined;
                const imageVariantGroups = message.role === "assistant" && message.mode === "image" && !isAgentMediaMessage ? getImageVariantPages(message) : [];
                const imageVariantCount = imageVariantGroups.length;
                const selectedImageVariantIndex = imageVariantCount > 0 ? Math.min(imageVariantIndexes[message.id] ?? 0, imageVariantCount - 1) : 0;
                const selectedImageVariant = imageVariantGroups[selectedImageVariantIndex];
                const displayImageResultSlots = getDisplayImageResultSlotsForMessage(message);
                const hasDisplayedImageResultSlots = (displayImageResultSlots?.length ?? 0) > 0;
                const displayedMessageImages = isAgentMediaMessage ? getDisplayImagesForMessage(message) : selectedImageVariant?.images ?? getDisplayImagesForMessage(message);
                const displayedImageResultSlots = displayImageResultSlots;
                const showImageStatusOnCurrentPage = selectedImageVariantIndex === 0 || imageVariantCount === 0;
                const displayedPendingImageCount = showImageStatusOnCurrentPage && !displayedImageResultSlots ? imagePendingCount : 0;
                const displayedFailedImageCount = showImageStatusOnCurrentPage ? imageFailedCount : 0;
                const displayedMessageVideos = getMessageVideos(message);
                const userMediaReferences = message.role === "user" ? getUploadedMediaReferences(message.uploadedFiles) : [];
                const mediaPromptFileReferences = message.role === "assistant" && (message.mode === "image" || message.mode === "video" || message.mode === "audio") ? getUploadedMediaReferences(message.uploadedFiles) : [];
                const documentUploadedFiles = getDocumentOnlyUploadedFiles(message.uploadedFiles);
                const agentPromptItems = isAgentMediaMessage ? getAgentMediaPromptItems(message) : [];
                const agentPromptPageIndex = Math.min(agentPromptPageIndexes[message.id] ?? 0, Math.max(0, agentPromptItems.length - 1));
                const setImageVariantIndex = (nextIndex: number) => {
                  if (imageVariantCount <= 1) return;
                  setImageVariantIndexes((current) => ({
                    ...current,
                    [message.id]: (nextIndex + imageVariantCount) % imageVariantCount,
                  }));
                };
                const setAgentPromptPageIndex = (nextIndex: number) => {
                  if (agentPromptItems.length <= 1) return;
                  setAgentPromptPageIndexes((current) => ({ ...current, [message.id]: (nextIndex + agentPromptItems.length) % agentPromptItems.length }));
                };
                const setMediaErrorPageIndex = (nextIndex: number) => {
                  if (mediaErrorReasonCount <= 1) return;
                  setMediaErrorPageIndexes((current) => ({ ...current, [message.id]: (nextIndex + mediaErrorReasonCount) % mediaErrorReasonCount }));
                };
                const visibleThinkText = (message.reasoning ?? "").replace(/\u200b/g, "").trim();
                const hasAssistantBody = Boolean(message.content.trim()) && !message.error;
                const thinkLive = Boolean(visibleThinkText) && !message.thinkCollapsed && !hasAssistantBody;
                const showThinkBlock = Boolean(visibleThinkText) || ((Boolean(message.thinkCollapsed) || hasAssistantBody) && message.thinkMs != null);
                const showThinkLoading = !message.error && !hasAssistantBody && !thinkLive;

                return (
                <div key={message.id} className={message.role === "user" ? "group flex justify-end" : "flex justify-start"}>
                  <div className={message.role === "user" ? "max-w-[92%]" : isAgentMediaMessage ? "flex w-full max-w-full" : "flex max-w-full"}>
                    {false && message.role === "assistant" ? (
                      <div className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e5ddff] bg-[#f1ecff] text-[#6d4aff]">
                        <RiStarSmileLine className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                    ) : null}
                    <div className={message.role === "user" ? "flex min-w-0 flex-col items-end" : isAgentMediaMessage ? "min-w-0 w-full" : "min-w-0"}>
                    {message.role !== "user" || message.content.trim() ? (
                      <>
                      <div
                        className={
                          message.role === "user"
                            ? "inline-block max-w-full rounded-xl bg-[#f4f4f4] px-5 py-3 text-sm leading-7 text-[#111111]"
                            : "px-0 py-1 text-sm leading-7 text-[#111111]"
                        }
                      >
                        {message.role === "assistant" ? (
                        message.mode === "agent" || message.mode === "general" || isAgentMediaMessage ? (
                          isAgentMediaMessage ? <><InlineAssistantIcon message={message} activated={isAgentActivationMessage(message.content)} provider={message.textModel ? generalModelProviders[message.textModel] : undefined} /><ReferencedTextContent content={message.content} references={mediaPromptReferences} /></> : (
                            <>
                              {showThinkBlock ? <ThinkingProcessBlock reasoning={message.reasoning ?? ""} thinkMs={message.thinkMs} live={thinkLive} /> : null}
                              {showThinkLoading ? <ThinkingIndicator compact={showThinkBlock} /> : hasAssistantBody ? <TypewriterFormattedMessage messageId={message.id} content={message.content} isComplete onComplete={markTypingComplete} onTick={keepTypingInPlace} showCaret={Boolean(message.streaming)} leadingIcon={<InlineAssistantIcon message={message} activated={isAgentActivationMessage(message.content)} provider={message.textModel ? generalModelProviders[message.textModel] : undefined} />} /> : null}
                            </>
                          )
                        ) : message.mode === "image" || message.mode === "video" || message.mode === "audio" ? <MediaPromptBlock message={message} references={mediaPromptReferences} mediaReferences={mediaPromptFileReferences} onUsePrompt={(item) => void copyPrompt(item)} copyState={copyFeedback?.messageId === message.id ? copyFeedback.state : undefined} displayImageUrl={displayedMessageImages[0]} variantIndex={selectedImageVariantIndex} variantCount={imageVariantCount} onPreviousVariant={() => setImageVariantIndex(selectedImageVariantIndex - 1)} onNextVariant={() => setImageVariantIndex(selectedImageVariantIndex + 1)} /> : <TypewriterFormattedMessage messageId={message.id} content={message.content} isComplete={isAssistantMessageComplete} onComplete={markTypingComplete} onTick={keepTypingAtBottom} />
                        ) : (
                        <UserMessageContent content={message.content} references={userImageReferences} mediaReferences={userMediaReferences} />
                        )}
                      </div>
                      {message.role === "user" && message.content.trim() ? (
                        <div className="mt-1 flex items-center justify-end gap-2 text-[12px] text-[#b0b0b0] opacity-0 transition-opacity group-hover:opacity-100">
                          <span>{formatMessageTime(message.createdAt)}</span>
                          <button
                            type="button"
                            onClick={() => void copyUserMessageText(message)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[#9a9a9a] transition hover:bg-[#f2f2f2] hover:text-[#555555]"
                            aria-label="复制用户消息"
                          >
                            {copyFeedback?.messageId === message.id && copyFeedback.state === "success" ? <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" /> : <RiCheckboxMultipleBlankLine className="h-3.5 w-3.5" aria-hidden="true" />}
                          </button>
                        </div>
                      ) : null}
                      </>
                    ) : null}

                    {message.role === "user" ? (
                      <>
                        <UploadedDocumentStrip files={documentUploadedFiles} onPreview={(file) => {
                          const previewMedia = getUploadedFilePreviewAsset(file);
                          if (previewMedia) {
                            setPreviewDocumentFile(null);
                            setPreviewAsset(previewMedia);
                          } else if (isUploadedMediaFile(file)) {
                            showInputTip("文件上传中");
                          } else {
                            setPreviewDocumentFile(file);
                          }
                        }} />
                        <ReferenceThumbnailStrip references={userImageReferences} onUseReference={(reference) => {
                          if (activeUploadedImages.length >= currentMaxReferenceImages && !activeUploadedImages.some((image) => image.url === reference.url)) {
                            showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
                            return;
                          }

                          const { start, end } = getCurrentDraftSelection();
                          addActiveUploadedImages([{ id: createClientId(), name: reference.name, referenceName: reference.name, url: reference.url, source: "asset" }], { draftBase: activeInput.slice(0, start), draftSuffix: activeInput.slice(end), insertReferenceText: true });
                          focusEditorAt(start + reference.name.length + 2);
                        }} />
                      </>
                    ) : null}

                    {isAgentMediaMessage && (message.mode === "image" || message.mode === "video") ? (
                      <AgentMediaPromptPanel
                        items={agentPromptItems}
                        pageIndex={agentPromptPageIndex}
                        expanded={Boolean(agentPromptExpandedIds[message.id])}
                        onToggle={() => setAgentPromptExpandedIds((current) => ({ ...current, [message.id]: !current[message.id] }))}
                        onUsePrompt={(prompt) => {
                          const restoreImages = (message.imageReferences ?? [])
                            .filter((reference) => Boolean(reference.url))
                            .map((reference) => toUploadedAssetReference({ name: reference.name, url: reference.url }));
                          const sourceFiles = message.uploadedFiles ?? [];
                          const restoreFiles = sourceFiles
                            .filter((file): file is UploadedDocumentFile => typeof file !== "string" && Boolean(file.url ?? file.storageName))
                            .map((file) => ({ ...file, id: createClientId() }));
                          setActiveDraftInputWithMentionCards(prompt, { images: restoreImages, files: restoreFiles });
                          requestAnimationFrame(() => editorRef.current?.focus());
                        }}
                        onPrevious={() => setAgentPromptPageIndex(agentPromptPageIndex - 1)}
                        onNext={() => setAgentPromptPageIndex(agentPromptPageIndex + 1)}
                      />
                    ) : null}

                      {message.role === "assistant" && message.mode === "image" && isAssistantMessageComplete && ((message.images?.length ?? 0) > 0 || hasDisplayedImageResultSlots || imagePendingCount > 0 || imageFailedCount > 0) ? (
                         <LazyMediaMount height={250} className="mt-2">
                             {displayedImageResultSlots ? (
                               <ImageResultSlotStrip slots={displayedImageResultSlots} imageIndexes={selectedImageVariant?.imageIndexes} pendingCount={displayedPendingImageCount} createdAt={message.createdAt} now={timerNow} rounded={isAgentMediaMessage} isRetrying={activeMessagePendingRequest?.mode === "image"} onRetryFailed={(failedIndex) => void retryFailedMedia(message, failedIndex)} onLoadedDimensions={(url, dimensions) => updateMessageImageDimensions(activeSession?.id ?? "", message.id, url, dimensions)} onMention={mentionMediaIntoInput} getImageName={(url, imageIndex) => getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`)} onPreview={(url, imageIndex) => setPreviewAsset({ id: `${message.id}-${imageIndex}`, type: "other", name: getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`), url, sourcePrompt: getImageSourcePrompt(message, url), previewMeta: getPreviewMediaMeta(message, url), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                             ) : (
                               <ImageResultStrip images={displayedMessageImages} imageIndexes={selectedImageVariant?.imageIndexes} pendingCount={displayedPendingImageCount} failedCount={displayedFailedImageCount} retryingFailedIndexes={message.retryingFailedImageIndexes ?? []} retryingFailedStartedAt={message.retryingFailedImageStartedAt} createdAt={message.createdAt} now={timerNow} rounded={isAgentMediaMessage} onRetryFailed={(failedIndex) => void retryFailedMedia(message, failedIndex)} onLoadedDimensions={(url, dimensions) => updateMessageImageDimensions(activeSession?.id ?? "", message.id, url, dimensions)} onMention={mentionMediaIntoInput} getImageName={(url, imageIndex) => getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`)} onPreview={(url, imageIndex) => setPreviewAsset({ id: `${message.id}-${imageIndex}`, type: "other", name: getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`), url, sourcePrompt: getImageSourcePrompt(message, url), previewMeta: getPreviewMediaMeta(message, url), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                             )}
                          </LazyMediaMount>
                        ) : null}

                      {message.role === "assistant" && message.mode === "video" && isAssistantMessageComplete && (displayedMessageVideos.length > 0 || previewVideoUrls.length > 0 || videoFailedCount > 0 || isVideoPendingVisible) ? (
                        <LazyMediaMount height={360} className={isAgentMediaMessage ? "mt-2 grid w-full max-w-[1006px] grid-cols-2 gap-0.5" : "mt-2 flex max-w-full flex-wrap gap-0.5"}>
                           {displayedMessageVideos.map((url, videoIndex) => (
                             <div key={`${url}-${videoIndex}`} className="contents">
                               <InlineVideoResult url={url} posterUrl={getVideoPosterForMessage(message, url)} rounded={isAgentMediaMessage} compact={isAgentMediaMessage} savedFlashAt={message.videoSavedFlashAt?.[url]} now={timerNow} onLoadedDimensions={(dimensions) => updateMessageVideoDimensions(activeSession?.id ?? "", message.id, dimensions)} onPreview={() => setPreviewAsset({ id: `${message.id}-video-${videoIndex}`, type: "shot_video", name: getCanonicalMediaName(message, url, `生成视频${videoIndex + 1}`), url, posterUrl: getVideoPosterForMessage(message, url), sourcePrompt: message.videoPrompts?.[url] ?? message.generationMeta?.itemPrompts?.[videoIndex] ?? message.generationMeta?.originalPrompt ?? message.content, previewMeta: getPreviewMediaMeta(message), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                             </div>
                            ))}
                           {previewVideoUrls.map((url, previewIndex) => (
                             <div key={`video-preview-${url}-${previewIndex}`} className="contents">
                               <InlineVideoResult url={url} rounded={isAgentMediaMessage} compact={isAgentMediaMessage} saving onPreview={() => setPreviewAsset({ id: `${message.id}-video-preview-${previewIndex}`, type: "shot_video", name: getCanonicalMediaName(message, url, `生成视频${displayedMessageVideos.length + previewIndex + 1}`), url, sourcePrompt: message.generationMeta?.originalPrompt ?? message.content, previewMeta: getPreviewMediaMeta(message), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                             </div>
                            ))}
                          {Array.from({ length: Math.max(0, (isVideoPendingVisible ? videoPendingCount : 0) - previewVideoUrls.length) }).map((_, pendingIndex) => (
                            <MediaWaitingCard key={`video-pending-${pendingIndex}`} createdAt={message.createdAt} now={timerNow} isImage={false} index={videoPendingCount > 1 ? displayedMessageVideos.length + previewVideoUrls.length + pendingIndex + 1 : undefined} rounded={isAgentMediaMessage} compactVideo={isAgentMediaMessage} />
                          ))}
                           {Array.from({ length: videoFailedCount }).map((_, failedIndex) => (
                            message.retryingFailedVideoIndexes?.includes(failedIndex) ? (
                              <MediaWaitingCard key={`video-retrying-failed-${failedIndex}`} createdAt={message.retryingFailedVideoStartedAt?.[failedIndex] ?? message.createdAt} now={timerNow} isImage={false} index={displayedMessageVideos.length + videoPendingCount + failedIndex + 1} rounded={isAgentMediaMessage} compactVideo={isAgentMediaMessage} />
                            ) : (
                              <VideoFailedCard key={`video-failed-${failedIndex}`} rounded={isAgentMediaMessage} compact={isAgentMediaMessage} onRetry={() => retryFailedMedia(message, failedIndex)} />
                            )
                          ))}
                        </LazyMediaMount>
                      ) : null}

                      {message.role === "assistant" && message.mode === "audio" && isAssistantMessageComplete ? (
                        <div className="mt-2">
                          {(message.audios?.length ?? 0) > 0 ? (
                            (message.audios ?? []).map((url, audioIndex) => {
                              const audioName = getCanonicalMediaName(message, url, `生成语音${audioIndex + 1}`);
                              return (
                              <div key={`${url}-${audioIndex}`} className="group relative mb-2 overflow-hidden rounded-none border border-[#e6e8eb] bg-[#e6e6e6]" style={{ width: 880, maxWidth: "100%", height: 200 }}>
                                <AudioWaveformPlayer url={url} variant="card" />
                                <MediaCardHoverActions url={url} name={audioName} mediaType="audio" onMention={mentionAudioIntoInput} />
                              </div>
                              );
                            })
                          ) : (message.pendingAudioCount ?? 0) > 0 && !message.error ? (
                            <MediaWaitingCard createdAt={message.createdAt} now={timerNow} isImage={false} kind="audio" />
                          ) : message.error ? (
                            <VideoFailedCard kind="audio" onRetry={() => regenerateMessage(message)} />
                          ) : null}
                        </div>
                      ) : null}

                    {message.statusText && message.mode !== "video" && message.mode !== "image" && message.mode !== "audio" && isAssistantMessageComplete ? (
                      isActiveMediaPending ? (
                        <div className={isActiveImagePending ? "mt-3 flex max-w-full flex-nowrap gap-0.5 overflow-x-auto pb-1" : "mt-3 grid max-w-full grid-cols-2 gap-0.5 pb-1"}>
                          {Array.from({ length: isActiveImagePending ? getImageCountValue(String(message.pendingImageCount ?? 1)) : Math.max(1, videoPendingCount) }).map((_, pendingIndex) => (
                            <MediaWaitingCard key={pendingIndex} createdAt={message.createdAt} now={timerNow} isImage={isActiveImagePending} index={(isActiveImagePending && (message.pendingImageCount ?? 1) > 1) || (!isActiveImagePending && videoPendingCount > 1) ? pendingIndex + 1 : undefined} rounded={isAgentMediaMessage} compactVideo={isAgentMediaMessage && !isActiveImagePending} />
                          ))}
                        </div>
                      ) : (
                      <div className="relative mt-3 h-[220px] w-[220px] max-w-full overflow-hidden rounded-xl border border-[#dceefa] bg-[#eaf7ff] text-sm text-[#4f6f86]">
                        {isActiveMediaPending ? (
                          <>
                            <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
                            <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
                            <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
                            <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
                            <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
                            <div className="relative z-10 ml-3 mt-3 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
                              {getVideoWaitProgress(message.createdAt, timerNow)}%{isActiveImagePending ? "生成中" : "渲染中"}
                            </div>
                            <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]">
                              {message.statusText}
                              <InlineLoadingDots />
                              <div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(message.createdAt, timerNow)}</div>
                            </div>
                          </>
                        ) : (
                          <div className="p-5">
                            {message.statusText}
                          </div>
                        )}
                      </div>
                      )
                    ) : null}

                    {mediaErrorText && isAssistantMessageComplete ? (
                      <div className="mt-3 text-sm text-rose-500">
                        {mediaErrorReasonCount > 1 ? (
                          <div className="mb-1 flex items-center gap-1 text-[12px] leading-5 text-rose-400">
                            <button type="button" onClick={() => setMediaErrorPageIndex(selectedMediaErrorIndex - 1)} className="rounded px-1 leading-5 transition hover:bg-rose-50 hover:text-rose-500" aria-label="上一条失败原因">&lt;</button>
                            <span>{selectedMediaErrorIndex + 1}/{mediaErrorReasonCount}</span>
                            <button type="button" onClick={() => setMediaErrorPageIndex(selectedMediaErrorIndex + 1)} className="rounded px-1 leading-5 transition hover:bg-rose-50 hover:text-rose-500" aria-label="下一条失败原因">&gt;</button>
                          </div>
                        ) : null}
                        <div>{mediaErrorText}</div>
                      </div>
                    ) : null}
                    {message.role === "assistant" && isAssistantMessageComplete && !(activeMessagePendingRequest && (message.mode === "agent" || message.mode === "general")) ? (
                      <>
                        <div className={message.mode === "image" || message.mode === "video" ? "mt-2 flex flex-wrap items-center gap-1.5" : "mt-3 flex flex-wrap items-center gap-1.5"}>
                          {(message.mode === "agent" || message.mode === "general") && messageType === "text" ? (
                            <FeedbackButton label={copyFeedback?.messageId === message.id ? (copyFeedback.state === "success" ? "已复制" : "无法复制") : "复制"} state={copyFeedback?.messageId === message.id ? copyFeedback.state : "idle"} onClick={() => void copyMessage(message)}>
                              <RiCheckboxMultipleBlankLine className="h-4.5 w-4.5" aria-hidden="true" />
                            </FeedbackButton>
                          ) : null}
                          <FeedbackButton label="重新生成" onClick={() => regenerateMessage(message)}>
                            <RiRefreshLine className="h-4.5 w-4.5" aria-hidden="true" />
                          </FeedbackButton>
                          {reaction !== "dislike" ? (
                            <FeedbackButton label={reaction === "like" ? "取消喜欢" : "喜欢"} onClick={() => toggleReaction("like", message)}>
                              {reaction === "like" ? <RiThumbUpFill className="h-4.5 w-4.5" aria-hidden="true" /> : <RiThumbUpLine className="h-4.5 w-4.5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          {reaction !== "like" ? (
                            <FeedbackButton label={reaction === "dislike" ? "取消不喜欢" : "不喜欢"} onClick={() => toggleReaction("dislike", message)}>
                              {reaction === "dislike" ? <RiThumbDownFill className="h-4.5 w-4.5" aria-hidden="true" /> : <RiThumbDownLine className="h-4.5 w-4.5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          {messageType === "text" ? (
                            <FeedbackButton label={issueFeedback === "wrong" ? "取消回答不对" : "回答不对"} onClick={() => toggleIssueFeedback("wrong", message)}>
                              {issueFeedback === "wrong" ? <ActiveMessageCircleXIcon /> : <RiChatDeleteLine className="h-5 w-5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          {messageType !== "text" ? (
                            <FeedbackButton label={issueFeedback === "wrong_mode" ? "取消模式反馈" : "要图给视频或要视频给图"} onClick={() => toggleIssueFeedback("wrong_mode", message)}>
                              {issueFeedback === "wrong_mode" ? <ActiveAngryIcon /> : <RiEmotionUnhappyLine className="h-5 w-5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          <div className="relative" onClick={(event) => event.stopPropagation()}>
                            <FeedbackButton label="更多" onClick={() => { const shouldClose = openMessageMenuId === message.id; closeAllPopupMenus(); if (!shouldClose) setOpenMessageMenuId(message.id); }}>
                              <RiMoreLine className="h-4.5 w-4.5" aria-hidden="true" />
                            </FeedbackButton>

                            {openMessageMenuId === message.id ? (
                              <div className="absolute bottom-9 left-0 z-40 w-36 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                                <button type="button" onClick={() => void copyMessageTextOnly(message)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                                  <RiCheckboxMultipleBlankLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span>复制文字</span>
                                </button>
                                <button type="button" onClick={() => deleteAssistantMessage(message.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                                  <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span>删除</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <span className="flashmuse-feedback-meta ml-[10px] text-[12px] leading-8 text-[#b0b0b0]">感谢反馈 {formatMessageTime(message.createdAt)}</span>
                        </div>
                        {message.id === activeSuggestionMessageId ? <SuggestionButtons suggestions={message.suggestions} onSelect={(suggestion) => void sendMessage(suggestion, "agent")} /> : null}
                      </>
                    ) : null}
                    </div>
                  </div>
                </div>
                );
              })}
              {isThinking && !(messages[messages.length - 1]?.role === "assistant" && (messages[messages.length - 1]?.mode === "agent" || messages[messages.length - 1]?.mode === "general") && !messages[messages.length - 1]?.error) ? <ThinkingIndicator /> : null}
              <div className="h-[360px]" ref={messageEndRef} />
            </div>
          )}
          </div>

          {activePanel === "chat" ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-transparent px-4 pb-3 sm:px-6 lg:px-8">
          {inputReminder ? (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 -translate-x-1/2">
              <ReminderToast reminder={inputReminder} />
            </div>
          ) : null}
          {showScrollToBottom ? (
            <button
              type="button"
              onClick={scrollToBottom}
              className="pointer-events-auto relative z-40 mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#d9d9d9] bg-white text-[#6f6f6f] shadow-[0_8px_18px_rgba(0,0,0,0.10)] transition hover:text-[#111111]"
              aria-label="定位到最新对话"
            >
              <RiArrowDownWideLine className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <div onClick={() => closeInputMenus()} style={{ width: inputShellWidth }} className="pointer-events-auto relative z-10 mx-auto w-full max-w-[calc(100vw-32px)] rounded-[26px] border-0 bg-transparent px-0 py-0 transition min-[840px]:min-w-[800px]">
            {!isThinking && (activeInput || activeUploadedImages.length > 0 || activeUploadedFiles.length > 0) ? (
              <div className="absolute -top-7 right-12 z-10 flex items-center gap-4">
                {(mode === "image" || mode === "video") && activeInput.trim() ? (
                  <button
                    type="button"
                    disabled={isInputPromptOptimizing}
                    onClick={(event) => {
                      event.stopPropagation();
                      void optimizeActivePrompt();
                    }}
                    className="inline-flex items-center gap-1 bg-transparent px-0 py-0 font-medium leading-none text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="优化提示词"
                  >
                    <RiQuillPenAiLine className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-[11px] leading-none">{isInputPromptOptimizing ? "优化中" : "优化提示词"}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isInputPromptOptimizing}
                  onClick={(event) => {
                    event.stopPropagation();
                    clearActiveInput();
                  }}
                  className="inline-flex items-center gap-1 bg-transparent px-0 py-0 font-medium leading-none text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="清空输入框"
                >
                  <RiFormatClear className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-[11px] leading-none">清空输入框</span>
                </button>
              </div>
            ) : null}
            <div className={`relative z-20 rounded-[26px] border-2 border-[#f1f2f2] bg-white/78 px-4 py-3 shadow-none backdrop-blur-[18px] transition focus-within:border-white/70 focus-within:shadow-[0_10px_32px_rgba(0,0,0,0.12)] ${isMainInputDisabled ? "border-[#f4f4f4] bg-white/54" : ""}`}>
            <div className={isMainInputDisabled ? "pointer-events-none opacity-45 grayscale-[0.15] transition" : "transition"}>
            {activeUploadedImages.length > 0 || activeUploadedFiles.length > 0 ? (
              <div className="mb-3 space-y-2 px-2">
                {/* 上面一行：只显示文档文件（视频/音频已下移，与图片混排显示） */}
                {activeUploadedFiles.some((file) => !isUploadedMediaFile(file)) ? (
                  <div ref={uploadedFilesRowRef} className="yinzao-upload-row-scroll flex flex-wrap gap-2 px-0.5">
                    {activeUploadedFiles.map((file, index) => ({ file, index })).filter(({ file }) => !isUploadedMediaFile(file)).map(({ file, index }) => {
                      const displayName = getUploadedFileDisplayName(file);
                      const meta = getUploadedDocumentMeta(getUploadedFileMetaName(file));
                      const sizeText = formatUploadedFileSize(file);
                      const progress = typeof file === "string" ? 0 : Math.min(100, Math.max(0, Math.floor(file.progress ?? 0)));
                      const uploadProgress = typeof file === "string" ? 0 : Math.min(100, Math.max(0, Math.floor(file.uploadProgress ?? 0)));
                      const isUploading = typeof file !== "string" && file.uploadStatus === "uploading";

                      return (
                        <div key={`${getUploadedFileKey(file)}-${index}`} onClick={() => setPreviewDocumentFile(file)} className="relative flex h-[54px] w-[200px] shrink-0 cursor-pointer items-center gap-3 overflow-hidden rounded-[10px] bg-[#f2f2f2] px-4 transition hover:bg-[#ececec]">
                          <button
                            type="button"
                            disabled={isMainInputDisabled}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeActiveUploadedFile(index);
                            }}
                            className="absolute right-1 top-1 z-30 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55 disabled:pointer-events-none disabled:opacity-40"
                            aria-label="移除文件"
                          >
                            <RiCloseLine className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] border-2 text-[15px] font-bold leading-none" style={{ backgroundColor: meta.bg, borderColor: meta.border, color: meta.color }}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium leading-4 text-[#222222]">{displayName}</div>
                            <div className="mt-0.5 truncate text-[11px] leading-4 text-[#9a9a9a]">{meta.label}{sizeText ? ` · ${sizeText}` : ""}</div>
                          </div>
                          {isUploading ? <UploadProgressOverlay progress={uploadProgress} /> : null}
                          {!isUploading && typeof file !== "string" && file.status === "reading" ? <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black/8"><div className="h-full bg-[#367cee] transition-all" style={{ width: `${progress}%` }} /></div> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {/* 下面一行：图片 + 视频 + 音频 混排（80×80 瓦片、换行、X 在外角，与工作流显示方式一致） */}
                {activeUploadedImages.length > 0 || activeUploadedFiles.some((file) => isUploadedMediaFile(file)) ? (
                  <div ref={uploadedImagesRowRef} className="yinzao-upload-row-scroll flex flex-wrap gap-2 px-0.5">
                    {activeUploadedImages.map((image) => {
                      const isUploading = image.uploadStatus === "uploading";
                      const uploadProgress = Math.min(100, Math.max(0, Math.floor(image.uploadProgress ?? 0)));
                      const previewUrl = image.previewUrl ?? getMediaThumbnailUrl(image.url);

                      return (
                        <div key={image.id} className="group relative h-[80px] w-[80px] shrink-0 overflow-visible">
                          <div className="relative h-full w-full overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]">
                            <HoverImagePreview src={previewUrl} alt={image.name} wrapperClassName="block h-full w-full">
                              <Image src={previewUrl} alt={image.name} width={100} height={100} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                            </HoverImagePreview>
                            <button
                              type="button"
                              disabled={isMainInputDisabled}
                              onClick={() => {
                                insertTextAtDraftCursor(`@${getUploadedImageReferenceName(image, activeUploadedImages)} `);
                              }}
                              className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white transition"
                            >
                              <span className="text-[10px] leading-4">@{getUploadedImageReferenceName(image, activeUploadedImages)}</span>
                            </button>
                            {isUploading ? <UploadProgressOverlay progress={uploadProgress} /> : null}
                            {image.uploadStatus === "error" ? (
                              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-black/58 px-2 text-center text-[13px] font-semibold leading-4 text-white">
                                <span>上传失败</span>
                                {image.uploadFile ? (
                                  <button type="button" onClick={() => retryInputImageUpload(image.id)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#75a7ff] transition hover:text-[#a9c8ff]">
                                    <RiRefreshLine className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>重试</span>
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={isMainInputDisabled}
                            onClick={() => removeActiveUploadedImage(image.id)}
                            className="absolute right-[-5px] top-[-5px] z-30 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black text-white transition hover:bg-black disabled:pointer-events-none disabled:opacity-40"
                            aria-label="移除图片"
                          >
                            <RiCloseLine className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                    {activeUploadedFiles.map((file, index) => ({ file, index })).filter(({ file }) => isUploadedMediaFile(file)).map(({ file, index }) => {
                      const displayName = getUploadedFileDisplayName(file);
                      const mediaKind = getUploadedFileMediaKind(file);
                      const uploadProgress = typeof file === "string" ? 0 : Math.min(100, Math.max(0, Math.floor(file.uploadProgress ?? 0)));
                      const isUploading = typeof file !== "string" && file.uploadStatus === "uploading";
                      const canPreviewMediaFile = Boolean(getUploadedFilePreviewAsset(file));
                      const mediaUrl = getUploadedMediaFileUrl(file);
                      const videoSrc = mediaUrl ? getStaticMediaUrl(mediaUrl) ?? mediaUrl : "";

                      return (
                        <div key={`${getUploadedFileKey(file)}-${index}`} className="group relative h-[80px] w-[80px] shrink-0 overflow-visible">
                          <div className="relative h-full w-full overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]">
                            {mediaKind === "video" ? (
                              <VideoUploadThumbnail src={videoSrc} posterUrl={(typeof file !== "string" && file.posterUrl ? getStaticMediaUrl(file.posterUrl) ?? file.posterUrl : undefined) ?? (mediaUrl ? getLocalVideoPosterUrl(mediaUrl) : undefined)} alt={displayName} />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#8a8a8a]">
                                {mediaKind === "audio" ? <RiVoiceprintLine className="h-7 w-7" aria-hidden="true" /> : <RiVideoLine className="h-7 w-7" aria-hidden="true" />}
                              </div>
                            )}
                            <button
                              type="button"
                              disabled={isMainInputDisabled || !canPreviewMediaFile}
                              onClick={() => {
                                if (!canPreviewMediaFile) {
                                  showInputTip("文件上传中");
                                  return;
                                }
                                insertTextAtDraftCursor(`@${displayName} `);
                              }}
                              className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white transition disabled:cursor-not-allowed"
                            >
                              <span className="text-[10px] leading-4">@{displayName}</span>
                            </button>
                            {isUploading ? <UploadProgressOverlay progress={uploadProgress} /> : null}
                          </div>
                          <button
                            type="button"
                            disabled={isMainInputDisabled}
                            onClick={() => removeActiveUploadedFile(index)}
                            className="absolute right-[-5px] top-[-5px] z-30 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black text-white transition hover:bg-black disabled:pointer-events-none disabled:opacity-40"
                            aria-label="移除文件"
                          >
                            <RiCloseLine className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {/* ⭐ 计数器独立占一行、居右（用户拍板：输入框加高一行，输入区往下移，⛔ 绝不压住文字） */}
            <PromptLengthCounterRow used={activeInputLength} maxLength={currentPromptMaxLength} />
            <div className="relative">
              {!activeInput ? (
                <div className="pointer-events-none absolute left-2 top-1 z-20 flex items-center text-[14px] leading-6 text-[#b3b3b3]">
                  {mode === "audio" ? (
                    isAudioCloneMode ? <span>上传一段{FISH_AUDIO_CLONE_MIN_SECONDS}-{FISH_AUDIO_CLONE_MAX_SECONDS}秒的语音克隆源, 并输入需要转换成语音的文案...</span> : <span>文本转语音，请输入要转成语音的文案...</span>
                  ) : mode === "agent" ? (
                    <>
                  <span>说说短剧想法，或让我写剧本、做分镜；也可上传或</span>
                    <button
                      type="button"
                      disabled={isMainInputDisabled}
                      className="pointer-events-auto inline-flex items-center px-0.5 text-[#367cee] transition hover:text-[#367cee]"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMentionAssetMenu();
                    }}
                    >
                      <RiAtLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                  <span>资产一起创作...</span>
                    </>
                  ) : mode === "general" ? (
                    <>
                  <span>问问题、写方案、做任务，也可以出图出视频；可上传或</span>
                    <button
                      type="button"
                      disabled={isMainInputDisabled}
                      className="pointer-events-auto inline-flex items-center px-0.5 text-[#367cee] transition hover:text-[#367cee]"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMentionAssetMenu();
                    }}
                    >
                      <RiAtLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                  <span>资产...</span>
                    </>
                  ) : (
                    <>
                  <span>输入文字，上传图片或</span>
                    <button
                      type="button"
                      disabled={isMainInputDisabled}
                      className="pointer-events-auto inline-flex items-center px-0.5 text-[#367cee] transition hover:text-[#367cee]"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMentionAssetMenu();
                    }}
                    >
                      <RiAtLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                  <span>资产，描述生成内容...</span>
                    </>
                  )}
                </div>
              ) : null}
              {isAtAssetMenuOpen && mode !== "audio" ? (
                <div onClick={(event) => event.stopPropagation()} className="absolute bottom-full left-2 z-50 mb-4">
                  <AssetMentionPicker
                    categories={MENTION_CATEGORIES}
                    activeValue={atAssetFilter}
                    onSelectCategory={(value) => { setAtAssetFilter(value as AssetFilter); if (!loadedAssetFilters[value as AssetFilter] && !mentionFilterPaging[value as AssetFilter]?.loading) void loadMentionFilterPage(value as AssetFilter, 0); }}
                    itemsFor={(value) => (atAssetGroups.find((group) => group.type === value)?.assets ?? []).map(assetToMentionPickerItem)}
                    counts={assetCounts}
                    loading={(mentionFilterPaging[atAssetFilter]?.loading ?? false) && Object.keys(assetCounts).length === 0}
                    activeLoading={mentionFilterPaging[atAssetFilter]?.loading ?? false}
                    getMediaSrc={(url) => getStaticMediaUrl(url) ?? url}
                    onScrollLoadMore={(value, loadedCount) => { if (!atAssetSearch) void loadMentionFilterPage(value as AssetFilter, mentionFilterPaging[value as AssetFilter]?.nextOffset ?? loadedCount); }}
                    onPick={(item) => { const asset = (atAssetGroups.find((group) => group.type === atAssetFilter)?.assets ?? []).find((candidate) => candidate.id === item.id); if (asset) insertAssetReference(asset); }}
                  />
                </div>
              ) : null}
              <PlainMentionEditor
                value={activeInput}
                disabled={isMainInputDisabled}
                validReferences={validReferenceNames}
                editorRef={editorRef}
                onChange={setActiveDraftInput}
                onPasteImages={(files) => void addFilesToInput(files)}
                onSubmit={() => void sendMessage()}
                onAtTrigger={() => {
                  if (mode === "audio") return;
                  openMentionAssetMenu();
                }}
                onAtClose={() => setIsAtAssetMenuOpen(false)}
                onLimit={() => showInputTip(getPromptCeilingTipText())}
                onCursorChange={setDraftCursorOffset}
              />
              </div>
            </div>
            <div className="mt-3 flex flex-nowrap items-center justify-between gap-3 pb-0.5">
              <div ref={toolbarLeftGroupRef} className={`flex ${mode === "general" ? "min-w-0 flex-1" : "min-w-max"} flex-nowrap items-center gap-2 text-[12px] transition ${isMainInputDisabled ? "pointer-events-none opacity-45 grayscale-[0.15]" : ""}`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadAcceptValue}
                  // ⭐ 当前规则只允许一共 1 个文件时（视频编辑/延长的 1 个参考视频、首帧模式的 1 张图）
                  //    就不给 multiple，免得用户一次选好几个再被逐个提示拒掉。
                  multiple={currentUploadRule.image.maxCount + currentUploadRule.document.maxCount + currentUploadRule.video.maxCount + currentUploadRule.audio.maxCount > 1}
                  disabled={isMainInputDisabled}
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    void addFilesToInput(files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={isMainInputDisabled || !(currentUploadRule.image.enabled || currentUploadRule.document.enabled || currentUploadRule.video.enabled || currentUploadRule.audio.enabled)}
                  onClick={() => fileInputRef.current?.click()}
                  className="yinzao-tool-button yinzao-tool-button-round inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#777777] transition disabled:pointer-events-none disabled:opacity-40"
                  aria-label="上传文件"
                >
                  <RiAddLine className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    disabled={isMainInputDisabled}
                    onClick={() => {
                      const shouldClose = openControlMenu === "mode";
                      closeAllPopupMenus();
                      if (!shouldClose) setOpenControlMenu("mode");
                    }}
                    className={`${toolButtonClassName} ${openControlMenu === "mode" ? toolButtonActiveClassName : ""}`}
                  >
                    <ToolButtonLabel icon={modeOptions.find((option) => option.value === mode)?.icon} label={modeOptions.find((option) => option.value === mode)?.label ?? "模式"} showChevron accent />
                  </button>

                  {openControlMenu === "mode" ? (
                    <div className="absolute bottom-full left-0 z-[70] mb-2 w-[220px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                      <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">创作类型</div>
                      {modeOptions.filter((option) => option.value !== "general" || currentUserGeneralModeEnabled).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (option.value === mode) {
                              setOpenControlMenu("");
                              return;
                            }

                            setMode(option.value);
                            setSessions((current) =>
                              current.map((session) =>
                                session.id === activeSessionId
                                  ? {
                                      ...session,
                                      updatedAt: Date.now(),
                                      messages: [
                                        ...session.messages,
                                        {
                                          id: createClientId(),
                                          role: "system",
                                          content: `${modeNoticeText[option.value].title}，${modeNoticeText[option.value].description}`,
                                          mode: option.value,
                                          createdAt: Date.now(),
                                        },
                                      ],
                                    }
                                  : session,
                              ),
                            );
                            setOpenControlMenu("");
                          }}
                          className={
                            option.value === mode
                              ? "my-[3px] flex h-12 w-full items-center justify-between whitespace-nowrap rounded-[12px] bg-[#eef4ff] px-3 text-left text-[16px] font-medium text-[#111111] ring-1 ring-[#d9e7ff]"
                              : "my-[3px] flex h-12 w-full items-center justify-between whitespace-nowrap rounded-[12px] px-3 text-left text-[16px] text-[#333333] hover:bg-[#f7f7f7]"
                          }
                        >
                          <span className="flex items-center gap-3">
                            <IconRenderer icon={option.icon} />
                            <span className="flex items-center gap-1.5">{option.label}{option.value === "audio" ? <NewBadge /> : null}</span>
                          </span>
                          {option.value === mode ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {mode !== "audio" ? (
                <button
                  type="button"
                  disabled={isMainInputDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    openMentionAssetMenu();
                  }}
                  className={`yinzao-tool-button inline-flex h-9 shrink-0 items-center rounded-[8px] px-3.5 text-[#777777] outline-none transition ${isAtAssetMenuOpen ? toolButtonActiveClassName : ""}`}
                  aria-label="引用资产"
                >
                  <RiAtLine className="h-4.5 w-4.5 text-[#777777]" aria-hidden="true" />
                </button>
                ) : null}

                {mode === "agent" || mode === "general" ? renderGeneralCustomMenu() : null}

                {mode === "general" ? renderGeneralModelMenu("chat", "选择对话模型") : null}

                {mode !== "agent" && mode !== "general" ? (
                  <>
                    {renderModelMenu()}
                    {mode === "audio" && !isAudioCloneMode ? renderAudioVoiceMenu() : null}
                    {mode === "audio" && !isAudioCloneMode ? renderAudioEmotionMenu() : null}
                    {!isVideoEditOrExtendMode && mode !== "audio" ? renderImageSettingsMenu() : null}
                    {mode === "image" ? renderControlMenu("imageCount", selectedImageCount, "同时生成数量", imageCountOptions, selectedImageCount, (value) => setSelectedImageCounts((current) => ({ ...current, [mode]: value })), RiImageAddLine) : null}
                    {mode === "video" && !isVideoEditOrExtendMode ? renderControlMenu("duration", selectedVideoDuration, "视频时长", currentDurationOptions, selectedVideoDuration, (value) => setSelectedDurations((current) => ({ ...current, video: value })), RiTimeLine) : null}
                    {mode === "video" ? renderVideoReferenceModeMenu() : null}
                    {mode === "audio" ? renderAudioReferenceModeMenu() : null}
                  </>
                ) : null}
              </div>
              {/* ⭐ 超字数灰掉时用**通用黑底提示框**（BlackHoverTooltip，唯一权威），⛔ 别用原生 title */}
              <BlackHoverTooltip label={isActiveInputOverLimit && !isThinking ? getPromptLimitTooltipText(currentPromptMaxLength) : ""} className="shrink-0">
              <button
                type="button"
                onClick={() => isThinking ? stopAgentThinking() : void sendMessage()}
                disabled={!isThinking && (isInputPromptOptimizing || hasUploadingInputs || hasFailedUploadInputs || (mode !== "agent" && mode !== "general" && activeHasMaxPendingRequests) || activeIsSending || isActiveInputOverLimit || (!activeInput.trim() && activeUploadedImages.length === 0 && activeUploadedFiles.length === 0))}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#111111] text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white ${isThinking ? "yinzao-stop-shimmer" : ""}`}
                aria-label={isThinking ? "停止思考" : "发送"}
              >
                {isThinking ? <RiStopFill className="h-4 w-4" aria-hidden="true" /> : <RiArrowUpLine className="h-4 w-4" aria-hidden="true" />}
              </button>
              </BlackHoverTooltip>
            </div>
            </div>
            {isInputPromptOptimizing ? <PromptOptimizingOverlay /> : null}
          </div>
        </div> : null}

        </div>
      </section>

      {isCharacterGenerateOpen ? (
        <div className="flashmuse-asset-generate-modal fixed inset-0 z-[11000] overscroll-contain bg-black/58" onMouseDown={() => setIsCharacterGenerateOpen(false)}>
          <div className="flex h-full w-full flex-col">
            <div className="flex min-h-0 min-w-[920px] flex-1 overflow-hidden bg-transparent shadow-[0_20px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flashmuse-preview-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[rgba(245,245,242,0.58)] backdrop-blur-[56px] backdrop-saturate-[190%] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.64)_0%,rgba(255,255,255,0.22)_42%,rgba(255,255,255,0.38)_100%)] after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.72),transparent_28%),radial-gradient(circle_at_82%_88%,rgba(255,255,255,0.36),transparent_34%)]">
                <div className="relative z-10 flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                  <div className="flashmuse-preview-toolbar flex items-center gap-2.5">
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("actual"); applyCharacterImageScale(visibleCharacterImageScale - 0.1); }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label={hasCharacterGeneratedImage ? "缩小图片" : "缩小图片不可用"}>
                      <span className="text-[18px] leading-none">-</span>
                    </button>
                    <div className={`flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666] ${hasCharacterGeneratedImage ? "" : "opacity-30"}`}>{characterImageScalePercent}</div>
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("actual"); applyCharacterImageScale(visibleCharacterImageScale + 0.1); }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label={hasCharacterGeneratedImage ? "放大图片" : "放大图片不可用"}>
                      <span className="text-[18px] leading-none">+</span>
                    </button>
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("actual"); setCharacterImageScale(1); setCharacterImagePan({ x: 0, y: 0 }); }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle}>
                      <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                    </button>
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("fit"); updateCharacterImageFitScale(); setCharacterImagePan({ x: 0, y: 0 }); }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle}>
                      <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasCharacterGeneratedImage && characterGenerateResult.url && !isCharacterGenerating ? (
                      <a href={characterGenerateResult.url} download={getDownloadName({ id: "asset-generated", type: assetGenerateType, name: isSceneGeneration ? "生成场景" : "生成角色", url: characterGenerateResult.url, sourcePrompt: characterGeneratePrompt, sessionId: activeSessionIdValue, createdAt: 0 })} className="inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-6 text-[13px] font-medium text-white transition hover:bg-[#252525]" aria-label="下载图片">
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载</span>
                      </a>
                    ) : (
                      <button type="button" disabled className="inline-flex h-9 min-w-[112px] cursor-not-allowed items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-6 text-[13px] font-medium text-white opacity-30" aria-label="下载图片不可用">
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载</span>
                      </button>
                    )}
                    <button type="button" onClick={() => setIsCharacterGenerateOpen(false)} className="yinzao-tool-button flex h-9 w-9 translate-x-2 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label={`关闭${assetGenerateTitle}`}>
                      <RiCloseLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div ref={characterViewportRef} className={`relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7 ${hasCharacterGeneratedImage && characterImageFitMode === "actual" ? isCharacterImageDragging ? "cursor-grabbing" : "cursor-grab" : ""}`} onWheel={(event) => {
                  if (!hasCharacterGeneratedImage) return;
                  event.preventDefault();
                  const delta = event.deltaY < 0 ? 0.1 : -0.1;
                  setCharacterImageFitMode("actual");
                  applyCharacterImageScale(visibleCharacterImageScale + delta);
                }} onMouseDown={(event) => {
                  if (!hasCharacterGeneratedImage || characterImageFitMode !== "actual") return;
                  event.preventDefault();
                  characterImageDragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: characterImagePan.x, panY: characterImagePan.y };
                  setIsCharacterImageDragging(true);
                }} onMouseMove={(event) => {
                  if (!isCharacterImageDragging) return;
                  const start = characterImageDragStartRef.current;
                  setCharacterImagePan({ x: start.panX + event.clientX - start.pointerX, y: start.panY + event.clientY - start.pointerY });
                }} onMouseUp={() => setIsCharacterImageDragging(false)} onMouseLeave={() => setIsCharacterImageDragging(false)}>
                  <div className="flex h-full w-full items-center justify-center bg-transparent text-center text-[#9a9a9a]">
                    {characterGenerateResult.status === "generating" ? (
                      <div className="relative shrink-0 overflow-hidden bg-[#eaf7ff] text-sm text-[#4f6f86]" style={characterPreviewFrameStyle}>
                        <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
                        <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
                        <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
                        <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
                        <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
                        <div className="absolute left-3 top-3 z-10 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
                          {getVideoWaitProgress(characterGenerateResult.startedAt, timerNow)}%生成中
                        </div>
                        <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]">
                          <div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(characterGenerateResult.startedAt, timerNow)}</div>
                        </div>
                      </div>
                    ) : characterGenerateResult.status === "failed" ? (
                      <div className="relative shrink-0 overflow-hidden bg-[#f3f3f3] text-[#777777]" style={characterPreviewFrameStyle}>
                        <div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none text-[#777777]">
                          <RiEmotionSadLine className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span>图片生成失败</span>
                        </div>
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <BlackHoverTooltip label={isAssetGeneratePromptOverLimit ? getPromptLimitTooltipText(assetGeneratePromptMaxLength) : ""}>
                        <button type="button" disabled={isAssetGeneratePromptOverLimit} onClick={() => void generateCharacterImage()} className="inline-flex items-center gap-1 bg-transparent text-[10px] font-medium text-[#367cee] transition hover:text-[#2568d8] disabled:cursor-not-allowed disabled:text-[#b8b8b8]">
                          <RiResetLeftLine className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="text-[14px] leading-none">重新生成</span>
                        </button>
                        </BlackHoverTooltip>
                        </div>
                        {characterGenerateResult.error ? <div className="absolute bottom-4 left-5 right-5 text-left text-[12px] leading-5 text-red-500">{normalizeMediaErrorText(characterGenerateResult.error, "image") ?? GENERIC_MEDIA_ERROR_MESSAGE}</div> : null}
                      </div>
                    ) : characterGenerateResult.status === "succeeded" && characterGenerateResult.url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={characterGenerateResult.url} alt={isSceneGeneration ? "生成场景" : "生成角色"} draggable={false} onLoad={(event) => {
                          const image = event.currentTarget;
                          const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
                          setCharacterImageNaturalSize(dimensions);
                          setCharacterImageDisplayLoaded(true);
                          setCharacterGenerateResult((current) => current.status === "succeeded" ? { ...current, dimensions } : current);
                          requestAnimationFrame(() => updateCharacterImageFitScale(dimensions));
                        }} className="max-w-none shrink-0 select-none object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" style={{ width: `${(characterImageNaturalSize.width || characterGenerateDisplayDimensions.width) * visibleCharacterImageScale}px`, height: "auto", transform: `translate3d(${characterImagePan.x}px, ${characterImagePan.y}px, 0)`, transition: isCharacterImageDragging ? "none" : "transform 120ms ease-out" }} />
                        {!characterImageDisplayLoaded ? (
                          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 text-[13px] font-medium text-[#8a8a8a]" role="status" aria-label="正在加载中">
                            <LoadingSpinner size={30} />
                            <span>正在加载中...</span>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="flashmuse-asset-generate-empty">
                        <RiImageAddLine className="mx-auto h-8 w-8" aria-hidden="true" />
                        <div className="mt-3 text-[14px] font-medium text-[#777777]">{assetGenerateAreaTitle}</div>
                        <div className="mt-1 text-[12px] text-[#9a9a9a]">生成后的图片会显示在这里</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <aside className="flashmuse-preview-aside flex h-full w-[360px] shrink-0 flex-col border-l border-[#eceae6] bg-[#f8f7f4]" style={resolvedTheme === "dark" ? { backgroundColor: "#2a303c", borderColor: "var(--fm-border-subtle)" } : undefined}>
                <div className="flex min-h-0 flex-1 flex-col px-[10px] pb-[10px] pt-7">
                  <div className="flex shrink-0 items-center gap-2 px-1 text-left text-[16px] font-medium leading-none text-[#111111]">
                    <AssetGenerateIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{assetGenerateTitle}</span>
                  </div>
                  <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
                    <div className="col-span-2 min-w-0">
                      {renderCharacterRatioMenu()}
                    </div>
                    <div className="min-w-0">
                      {renderCharacterStyleMenu()}
                    </div>
                  </div>
                  <div className="mt-2 flex shrink-0 items-center gap-2">
                    <div className={`min-w-0 ${isGptImage2Model(characterGenerateModel) ? "flex-1" : "flex-[2]"}`}>
                      {renderCharacterImageModelMenu()}
                    </div>
                    {isGptImage2Model(characterGenerateModel) ? (
                      <div className="inline-grid shrink-0 grid-cols-2 gap-2">
                        {renderCharacterImageResolutionMenu()}
                        {renderCharacterImageQualityMenu()}
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        {renderCharacterImageResolutionMenu()}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex h-6 shrink-0 items-center justify-center gap-2 px-3 text-[12px] leading-5 text-[#8c8c8c]">
                    <span>{assetGenerateRatioLabel}</span>
                    <span className="text-[#d0d0d0]">|</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span>{characterGenerateDisplayDimensions.width} × {characterGenerateDisplayDimensions.height}</span>
                      <CompactResolutionIcon option={characterGenerateDisplayResolution} mode="image" qualityBadgeLabel={characterGenerateQualityBadgeLabel} />
                    </span>
                    <span className="text-[#d0d0d0]">|</span>
                    <span>{characterGenerateStyleLabel}</span>
                  </div>
                  <div className="flashmuse-asset-generate-input relative mt-3 flex min-h-0 flex-1 flex-col rounded-[8px] border border-[#f1f2f2] bg-white/78 py-3 pl-[10px] pr-0 shadow-none backdrop-blur-[18px] transition focus-within:border-[#c8dbff]" style={resolvedTheme === "dark" ? { backgroundColor: "color-mix(in srgb, var(--fm-panel) 88%, transparent)", borderColor: "var(--fm-border)", boxShadow: "0 16px 42px var(--fm-shadow)" } : undefined}>
                    <div className="flex shrink-0 items-center gap-4 pl-[10px] pr-[10px] text-[13px] font-medium text-[#367cee]">
                      <button type="button" disabled={isCharacterGenerateInputDisabled} onClick={(event) => { event.stopPropagation(); openCharacterMentionAssetMenu(); }} className="inline-flex h-5 items-center gap-1.5 bg-transparent p-0 text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-35" aria-label="引用资产">
                        <RiAtLine className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>引用资产</span>
                      </button>
                      <button type="button" disabled={isCharacterPromptOptimizing || characterGenerateResult.status === "generating" || !characterGeneratePrompt.trim()} onClick={() => void optimizeCharacterPrompt()} className="inline-flex h-5 items-center gap-1.5 bg-transparent p-0 text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-35" aria-label="优化提示词">
                        <RiShining2Line className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isCharacterPromptOptimizing ? "优化中" : "优化提示词"}</span>
                      </button>
                      <button type="button" disabled={isCharacterGenerateInputDisabled || (!characterGeneratePrompt.trim() && assetGenerateReferenceImages.length === 0)} onClick={() => { setActiveAssetGeneratePrompt(""); setActiveAssetGenerateReferences(() => []); setCharacterPromptCursorOffset(0); setIsCharacterAtAssetMenuOpen(false); requestAnimationFrame(() => characterEditorRef.current?.focus()); }} className="inline-flex h-5 items-center gap-1.5 bg-transparent p-0 text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-35" aria-label="清空输入框">
                        <RiFormatClear className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>清空输入框</span>
                      </button>
                    </div>
                    {isCharacterAtAssetMenuOpen && !isCharacterGenerateInputDisabled ? (
                      <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-10 z-[90]">
                        <AssetMentionPicker
                          categories={CHARACTER_MENTION_CATEGORIES}
                          activeValue={characterAtAssetFilter}
                          onSelectCategory={(value) => { setCharacterAtAssetFilter(value as AssetFilter); if (!loadedAssetFilters[value as AssetFilter] && !mentionFilterPaging[value as AssetFilter]?.loading) void loadMentionFilterPage(value as AssetFilter, 0); }}
                          itemsFor={(value) => (characterAtAssetGroups.find((group) => group.type === value)?.assets ?? []).map(assetToMentionPickerItem)}
                          counts={assetCounts}
                          loading={(mentionFilterPaging[characterAtAssetFilter]?.loading ?? false) && Object.keys(assetCounts).length === 0}
                          activeLoading={mentionFilterPaging[characterAtAssetFilter]?.loading ?? false}
                          getMediaSrc={(url) => getStaticMediaUrl(url) ?? url}
                          onScrollLoadMore={(value, loadedCount) => { if (!characterAtAssetSearch) void loadMentionFilterPage(value as AssetFilter, mentionFilterPaging[value as AssetFilter]?.nextOffset ?? loadedCount); }}
                          onPick={(item) => { const asset = (characterAtAssetGroups.find((group) => group.type === characterAtAssetFilter)?.assets ?? []).find((candidate) => candidate.id === item.id); if (asset) insertCharacterAssetReference(asset); }}
                        />
                      </div>
                    ) : null}
                    {assetGenerateReferenceImages.length > 0 ? (
                      <div className="relative mt-2 shrink-0 pl-[10px] pr-[10px]">
                        {canScrollAssetGenerateReferences.left ? (
                          <button type="button" onClick={() => scrollAssetGenerateReferences(-1)} className="absolute left-[10px] top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向左查看图片">
                            <RiArrowLeftSLine className="h-5 w-5" aria-hidden="true" />
                          </button>
                        ) : null}
                        {canScrollAssetGenerateReferences.left ? <div className="pointer-events-none absolute bottom-0 left-[10px] top-0 z-[5] w-10 bg-gradient-to-r from-white/95 to-transparent" /> : null}
                        <div ref={assetGenerateReferencesRowRef} onScroll={updateAssetGenerateReferenceScrollState} className="yinzao-upload-row-scroll flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden scroll-smooth px-0.5">
                          {assetGenerateReferenceImages.map((image) => (
                            <div key={`${image.name}-${image.url}`} className="group relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]">
                              <HoverImagePreview src={image.url} alt={image.name} wrapperClassName="block h-full w-full">
                                <Image src={getMediaThumbnailUrl(image.url)} alt={image.name} width={100} height={100} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                              </HoverImagePreview>
                              <button type="button" disabled={isCharacterGenerateInputDisabled} onClick={() => removeAssetGenerateReference(image.name)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-40" aria-label="移除图片">
                                <RiCloseLine className="h-3 w-3" aria-hidden="true" />
                              </button>
                              <button type="button" disabled={isCharacterGenerateInputDisabled} onClick={() => insertCharacterReferenceText(image.name)} className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white transition">
                                <span className="text-[10px] leading-4">@{image.name}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        {canScrollAssetGenerateReferences.right ? (
                          <button type="button" onClick={() => scrollAssetGenerateReferences(1)} className="absolute right-[10px] top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向右查看图片">
                            <RiArrowRightSLine className="h-5 w-5" aria-hidden="true" />
                          </button>
                        ) : null}
                        {canScrollAssetGenerateReferences.right ? <div className="pointer-events-none absolute bottom-0 right-[10px] top-0 z-[5] w-10 bg-gradient-to-l from-white/95 to-transparent" /> : null}
                      </div>
                    ) : null}
                    {/* ⭐ 资产库这里**不加高**（用户拍板）：计数器行是 flex 兄弟节点，
                        编辑区仍是 flex-1 → 整张卡片总高不变，只把输入区往下移一行。 */}
                    <PromptLengthCounterRow used={assetGeneratePromptLength} maxLength={assetGeneratePromptMaxLength} className="mt-1 pr-[10px]" />
                    <div className="relative mt-2 min-h-0 flex-1 pr-0">
                      {!characterGeneratePrompt ? <div className="flashmuse-asset-generate-placeholder pointer-events-none absolute left-[10px] top-1 z-20 text-[13px] leading-[22px] text-[#b3b3b3]">{assetGeneratePlaceholder}</div> : null}
                      <PlainMentionEditor
                        value={characterGeneratePrompt}
                        validReferences={characterValidReferenceNames}
                        editorRef={characterEditorRef}
                        className="h-full min-h-0 flex-1 pl-[10px] pr-[10px] text-[#111111]"
                        editorStyle={{ fontSize: 13, lineHeight: "22px" }}
                        maxHeight="none"
                        disabled={isCharacterGenerateInputDisabled}
                        onChange={(value) => setActiveAssetGeneratePrompt(value)}
                        onPasteImages={() => showInputTip(`${assetGenerateTitle}界面暂不支持直接粘贴图片，请使用@引用资产`)}
                        onSubmit={() => void generateCharacterImage()}
                        onAtTrigger={() => setIsCharacterAtAssetMenuOpen(true)}
                        onAtClose={() => setIsCharacterAtAssetMenuOpen(false)}
                        onLimit={() => showInputTip(getPromptCeilingTipText())}
                        onCursorChange={setCharacterPromptCursorOffset}
                      />
                    </div>
                    {isCharacterPromptOptimizing ? <PromptOptimizingOverlay /> : null}
                  </div>
                  <BlackHoverTooltip label={isAssetGeneratePromptOverLimit ? getPromptLimitTooltipText(assetGeneratePromptMaxLength) : ""} className="mt-[10px] shrink-0">
                  <button type="button" disabled={!characterGeneratePrompt.trim() || isCharacterGenerateInputDisabled || isAssetGeneratePromptOverLimit} onClick={() => void generateCharacterImage()} className="flashmuse-asset-generate-submit h-12 w-full shrink-0 rounded-[8px] bg-[#111111] px-4 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-30">{characterGenerateResult.status === "generating" ? "生成中" : "生成图片"}</button>
                  </BlackHoverTooltip>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
      {assetUploadTip ? (
        <ReminderToast reminder={assetUploadTip} fixed />
      ) : null}
      {generationCompleteReminder ? (
        <ReminderToast reminder={generationCompleteReminder} fixed />
      ) : null}
      {userDialogTab ? (
        <div className="fixed inset-0 z-[11000] flex overscroll-contain bg-[#f4f4f4] text-[#111111]">
          {userDialogTip ? (
            <div className="pointer-events-none absolute left-1/2 top-6 z-[70] -translate-x-1/2">
              <ReminderToast reminder={userDialogTip} />
            </div>
          ) : null}
          <aside className="flex h-full w-[240px] shrink-0 flex-col px-4 pb-6 pt-5">
            <button type="button" onClick={() => setUserDialogTab("")} className="mb-6 flex h-9 w-full items-center gap-1.5 rounded-[8px] px-2 text-left text-[#333333] transition hover:bg-[#ececec]">
              <RiArrowLeftSLine className="h-5 w-5 shrink-0 text-[#b4b4b4]" aria-hidden="true" />
              <span className="text-[14px] font-medium">{userText("退出用户中心")}</span>
            </button>
            <div className="space-y-1">
              <button type="button" onClick={() => openUserDialog("profile")} className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left transition ${userDialogTab === "profile" ? "bg-[#e9e9e9] text-[#111111]" : "text-[#333333] hover:bg-[#ececec]"}`}>
                <RiAccountCircleLine className="h-[18px] w-[18px] shrink-0 text-[#b4b4b4]" aria-hidden="true" />
                <span className="text-[14px] font-medium">{userText("用户信息")}</span>
              </button>
              <button type="button" onClick={() => openUserDialog("credits")} className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left transition ${userDialogTab === "credits" ? "bg-[#e9e9e9] text-[#111111]" : "text-[#333333] hover:bg-[#ececec]"}`}>
                <RiVipDiamondLine className="h-[18px] w-[18px] shrink-0 text-[#b4b4b4]" aria-hidden="true" />
                <span className="text-[14px] font-medium">{userText("我的积分")}</span>
              </button>
              <button type="button" onClick={() => openUserDialog("security")} className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left transition ${userDialogTab === "security" ? "bg-[#e9e9e9] text-[#111111]" : "text-[#333333] hover:bg-[#ececec]"}`}>
                <RiShieldUserLine className="h-[18px] w-[18px] shrink-0 text-[#b4b4b4]" aria-hidden="true" />
                <span className="text-[14px] font-medium">{userText("帐号安全")}</span>
              </button>
              <button type="button" onClick={() => openUserDialog("archive")} className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left transition ${userDialogTab === "archive" ? "bg-[#e9e9e9] text-[#111111]" : "text-[#333333] hover:bg-[#ececec]"}`}>
                <RiInboxArchiveLine className="h-[18px] w-[18px] shrink-0 text-[#b4b4b4]" aria-hidden="true" />
                <span className="text-[14px] font-medium">{userText("归档")}</span>
              </button>
              <button type="button" onClick={() => openUserDialog("settings")} className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left transition ${userDialogTab === "settings" ? "bg-[#e9e9e9] text-[#111111]" : "text-[#333333] hover:bg-[#ececec]"}`}>
                <RiSettingsLine className="h-[18px] w-[18px] shrink-0 text-[#b4b4b4]" aria-hidden="true" />
                <span className="text-[14px] font-medium">{userText("设置")}</span>
              </button>
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-[16px] rounded-bl-[16px] bg-white">
            <div className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[950px] px-10 pb-10 pt-6">
              <h2 className="mb-8 text-[16px] font-medium leading-none">
                {userDialogTab === "profile" ? userText("用户信息") : userDialogTab === "credits" ? userText("我的积分") : userDialogTab === "security" ? userText("帐号安全") : userDialogTab === "archive" ? userText("归档") : userText("设置")}
              </h2>
              {userDialogTab === "profile" ? (
                <div className="flex items-start gap-8">
                  <div className="flex w-[92px] shrink-0 flex-col items-center">
                    <div className="relative h-[92px] w-[92px]">
                      <div className="h-full w-full overflow-hidden rounded-full" style={currentUserAvatarUrl ? undefined : { backgroundColor: defaultUserAvatar.backgroundColor, border: `1px solid ${defaultUserAvatar.borderColor}`, color: defaultUserAvatar.color }}>
                        {currentUserAvatarUrl ? (
                          <Image src={currentUserAvatarUrl} alt="用户头像" width={92} height={92} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[30px] font-medium">{defaultUserAvatar.label}</div>
                        )}
                      </div>
                      <input
                        ref={userAvatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          void uploadUserAvatar(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={isUploadingUserAvatar}
                        onClick={() => userAvatarInputRef.current?.click()}
                        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-[#d9d9d9] bg-white p-0 text-[#777777] leading-none transition hover:border-[#c8c8c8] hover:text-[#333333] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="上传头像"
                      >
                        <RiCameraLine className="block h-[19px] w-[19px]" aria-hidden="true" />
                      </button>
                    </div>
                    {currentUserId ? <div className="mt-2 w-full truncate text-center text-[12px] font-medium text-[#8a8a8a]">{currentUserId}</div> : null}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    {[
                      { key: "nickname", label: userText("昵称"), value: currentUserNickname || currentUserEmail, icon: RiAccountCircleLine },
                      { key: "email", label: userText("邮箱（登录帐号）"), value: currentUserEmail, icon: RiMailLine },
                      { key: "phone", label: userText("手机"), value: currentUserPhone || userText("未绑定"), icon: RiPhoneLine },
                      { key: "image", label: userText("生成图片"), value: `${generatedImageCount}张`, icon: RiImageLine },
                      { key: "video", label: userText("生成视频"), value: `${generatedVideoCount}段`, icon: RiFilmLine },
                    ].map((item) => {
                      const RowIcon = item.icon;

                      return item.key === "nickname" || item.key === "phone" ? (
                        <div key={item.key} className="flex min-h-11 items-center gap-2">
                          <div className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                            <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                              <RowIcon className="h-[18px] w-[18px] shrink-0 text-[#9a9a9a]" aria-hidden="true" />
                              <span className="text-[14px] font-normal">{item.label}</span>
                            </div>
                            <div className="min-w-0 flex-1 text-right">
                              {item.key === "nickname" && isEditingUserNickname ? (
                                <input
                                  value={userNicknameInput}
                                  onChange={(event) => setUserNicknameInput(Array.from(event.target.value).slice(0, MAX_USER_NICKNAME_LENGTH).join(""))}
                                  maxLength={MAX_USER_NICKNAME_LENGTH}
                                  onBlur={commitUserNickname}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") commitUserNickname();
                                    if (event.key === "Escape") cancelEditingUserNickname();
                                  }}
                                  autoFocus
                                  className="h-8 w-full rounded-[8px] border border-[#dddddd] bg-white px-2 text-right text-[14px] text-[#333333] outline-none transition focus:border-[#367cee]"
                                />
                              ) : item.key === "phone" && isEditingUserPhone ? (
                                <input
                                  value={userPhoneInput}
                                  onChange={(event) => setUserPhoneInput(event.target.value)}
                                  onBlur={commitUserPhone}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") commitUserPhone();
                                    if (event.key === "Escape") cancelEditingUserPhone();
                                  }}
                                  autoFocus
                                  className="h-8 w-full rounded-[8px] border border-[#dddddd] bg-white px-2 text-right text-[14px] text-[#333333] outline-none transition focus:border-[#367cee]"
                                />
                              ) : (
                                <div className="min-w-0 truncate text-right text-[14px] text-[#333333]">{item.value}</div>
                              )}
                            </div>
                          </div>
                          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={item.key === "nickname" ? (isEditingUserNickname ? commitUserNickname : startEditingUserNickname) : (isEditingUserPhone ? commitUserPhone : startEditingUserPhone)} className="flex h-9 w-9 shrink-0 items-center justify-center text-[#9a9a9a] transition hover:text-[#333333]" aria-label={item.key === "nickname" ? "修改昵称" : "修改手机"}>
                            <RiEditBoxLine className="h-[18px] w-[18px]" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <div key={item.key} className="mr-[44px] flex min-h-11 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                          <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                            <RowIcon className="h-[18px] w-[18px] shrink-0 text-[#9a9a9a]" aria-hidden="true" />
                            <span className="text-[14px] font-normal">{item.label}</span>
                          </div>
                            <div className={`min-w-0 truncate text-right text-[14px] ${item.key === "email" ? "text-[#9a9a9a]" : "text-[#333333]"}`}>{item.value}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {userDialogTab === "credits" ? (() => {
                const pageSize = 20;
                const totalPages = Math.max(1, Math.ceil(userCreditConversations.length / pageSize));
                const safePage = Math.min(totalPages, Math.max(1, userCreditPage));
                const rows = userCreditConversations.slice((safePage - 1) * pageSize, safePage * pageSize);

                return (
                  <div>
                    <div className="flex items-center gap-6 rounded-[12px] bg-[#f3f2ed] p-2.5">
                      <div className="min-h-[96px] w-[238px] rounded-[12px] border border-[#e1cbb6] bg-[linear-gradient(100deg,#ffffff_0%,#fbfaf7_54%,#f2eee6_100%)] px-4 py-3 shadow-[0_8px_20px_rgba(114,90,62,0.07)]">
                        <div className="flex h-5 w-fit items-center rounded-full bg-[#c6b19d] px-2.5 text-[11px] font-semibold text-white">免费套餐</div>
                        <div className="mt-3 flex items-center gap-1.5 text-[18px] font-semibold tracking-[-0.02em] text-[#111111]">个人免费版 <RiLeafLine className="h-4.5 w-4.5" aria-hidden="true" /></div>
                        <div className="mt-1.5 max-w-[190px] text-[11px] leading-4 text-[#9a8b7b]">当前为免费版本，暂无升级套餐功能。如有疑问请联系管理员！</div>
                      </div>
                      <div className="min-w-0 flex-1 self-start pt-3">
                        <div className="text-[20px] font-normal tracking-[-0.02em] text-[#111111]">总积分 <span className="ml-2 font-semibold">{currentUserCredits.toLocaleString("en-US")}</span></div>
                        <div className="mt-1.5 text-[12px] leading-5 text-[#9a9a9a]">已赠送积分：{giftedUserCredits.toLocaleString("en-US")}</div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-[5px] border border-[#eeeeee]">
                      <table className="w-full table-fixed text-left text-[12px]">
                        <thead className="bg-[#f7f7f7] text-[#888888]">
                          <tr>
                            <th className="border-r border-[#dddddd] px-3 py-2 font-medium">积分来源</th>
                            <th className="w-[110px] border-r border-[#dddddd] px-3 py-2 text-right font-medium">积分变动</th>
                            <th className="w-[110px] border-r border-[#dddddd] px-3 py-2 text-right font-medium">对话Token</th>
                            <th className="w-[110px] border-r border-[#dddddd] px-3 py-2 text-right font-medium">图片/视频</th>
                            <th className="w-[86px] whitespace-nowrap px-2 py-2 text-right font-medium">最后活跃</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length > 0 ? rows.map((row) => {
                            const SourceIcon = userCreditSourceIcons[row.source ?? "conversation"] ?? RiChatSmileAiLine;
                            const isImageGenerationSource = row.source === "character_image_generation" || row.source === "scene_image_generation" || row.source === "prop_image_generation" || row.source === "shot_image_generation";
                            const isTextOnlySource = row.source === "image_prompt_reverse" || row.source === "prompt_optimization";
                            const isIncreaseRow = row.direction === "increase";
                            const tokenCount = Math.max(0, Math.floor(row.totalTokens ?? 0));
                            const imageText = isIncreaseRow || isTextOnlySource ? "--" : row.imageCount.toLocaleString("en-US");
                            const videoText = isIncreaseRow || ((isImageGenerationSource || isTextOnlySource) && row.videoCount === 0) ? "--" : row.videoCount.toLocaleString("en-US");
                            const sourceTitle = userCreditSourceLabels[row.source ?? "conversation"] ?? row.title;
                            const creditValue = Math.trunc(row.credits);
                            const creditDisplay = creditValue === 0 ? "0" : isIncreaseRow && creditValue > 0 ? `+${creditValue.toLocaleString("en-US")}` : creditValue < 0 ? `-${Math.abs(creditValue).toLocaleString("en-US")}` : `-${creditValue.toLocaleString("en-US")}`;
                            const creditClassName = isIncreaseRow && creditValue > 0 ? "text-[#18a058]" : "text-red-500";
                            return (
                              <tr key={row.conversationId} className="border-t border-[#eeeeee]">
                                <td className="border-r border-[#eeeeee] px-3 py-2 text-[#333333]">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <SourceIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
                                    <span className="min-w-0 truncate">{sourceTitle}</span>
                                  </div>
                                </td>
                                <td className={`border-r border-[#eeeeee] px-3 py-2 text-right font-semibold ${creditClassName}`}>{creditDisplay}</td>
                                <td className="border-r border-[#eeeeee] px-3 py-2 text-right text-[#555555]">{tokenCount > 0 ? tokenCount.toLocaleString("en-US") : "--"}</td>
                                <td className="border-r border-[#eeeeee] px-3 py-2 text-right text-[#555555]">{imageText}/{videoText}</td>
                                <td className="whitespace-nowrap px-2 py-2 text-right text-[#777777]">{formatCreditLastActiveTime(row.lastActiveAt)}</td>
                              </tr>
                            );
                          }) : <tr><td colSpan={5} className="px-3 py-10 text-center text-[#999999]">暂无积分记录</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-[#777777]">
                      <button type="button" disabled={safePage <= 1} onClick={() => setUserCreditPage((page) => Math.max(1, page - 1))} className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[#333333] transition hover:bg-[#f4f4f4] disabled:pointer-events-none disabled:opacity-40"><RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" />上一页</button>
                      <span>{safePage} / {totalPages}</span>
                      <button type="button" disabled={safePage >= totalPages} onClick={() => setUserCreditPage((page) => Math.min(totalPages, page + 1))} className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[#333333] transition hover:bg-[#f4f4f4] disabled:pointer-events-none disabled:opacity-40">下一页<RiArrowRightSLine className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  </div>
                );
              })() : null}

              {userDialogTab === "security" ? (
                <div>
                  <div className="w-full space-y-2">
                    {currentUserHasPassword && securityPasswordMode === "default" ? (
                      <>
                        <div className="flex min-h-11 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                          <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                            <RiLockPasswordLine className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                            <span className="text-[14px] font-normal">***********</span>
                          </div>
                          <div className="min-w-0 truncate text-right text-[14px] text-[#9a9a9a]">{userText("密码已设置")}</div>
                        </div>
                        <div className="flex items-center justify-end gap-5 pt-2">
                          <button type="button" onClick={() => { setSecurityPasswordMode("change"); setPasswordActionError(""); setPasswordActionMessage(""); }} className="bg-transparent p-0 font-normal text-[#367cee] transition hover:text-[#1f63d9]"><span style={{ fontSize: 13 }}>{userText("修改密码")}</span></button>
                          <button type="button" onClick={() => void startForgotPasswordFlow()} disabled={isForgotPasswordSending} className="bg-transparent p-0 font-normal text-[#367cee] transition hover:text-[#1f63d9] disabled:text-[#9bbcf5]"><span style={{ fontSize: 13 }}>{isForgotPasswordSending ? userText("发送中") + "..." : userText("忘记密码")}</span></button>
                        </div>
                      </>
                    ) : null}

                    {!currentUserHasPassword || securityPasswordMode === "change" || securityPasswordMode === "forgot-reset" ? (
                      <>
                        <div className="mb-3 flex items-center gap-2 text-[14px] font-normal text-[#9a9a9a]">
                          <RiErrorWarningLine className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                          <span style={{ fontSize: 13 }}>{securityPasswordMode === "forgot-reset" || !currentUserHasPassword ? userText("设置密码后可用密码登录") : userText("修改密码后请使用新密码登录")}</span>
                        </div>
                        {currentUserHasPassword && securityPasswordMode === "change" ? (
                          <input type="password" value={currentPasswordInput} onChange={(event) => updatePasswordField(setCurrentPasswordInput, event.target.value)} placeholder={userText("当前密码")} className="h-11 w-full rounded-[10px] border-0 bg-[#f7f7f7] px-4 text-[14px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:bg-[#f4f7ff]" />
                        ) : null}
                        <input type="password" value={newPasswordInput} onChange={(event) => updatePasswordField(setNewPasswordInput, event.target.value)} placeholder={userText("新密码，至少8位")} className="h-11 w-full rounded-[10px] border-0 bg-[#f7f7f7] px-4 text-[14px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:bg-[#f4f7ff]" />
                        <input type="password" value={confirmPasswordInput} onChange={(event) => updatePasswordField(setConfirmPasswordInput, event.target.value)} placeholder={userText("再次输入新密码")} className="h-11 w-full rounded-[10px] border-0 bg-[#f7f7f7] px-4 text-[14px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:bg-[#f4f7ff]" />
                      </>
                    ) : null}

                    {securityPasswordMode === "forgot-code" ? (
                      <>
                        <div className="mb-3 flex items-center gap-2 text-[14px] font-normal text-[#9a9a9a]">
                          <RiErrorWarningLine className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                          <span style={{ fontSize: 13 }}>{userText("验证码已发送至登录邮箱，验证后可重设密码")}</span>
                        </div>
                        <div className="flex gap-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <input
                              key={index}
                              value={forgotPasswordCode[index] ?? ""}
                              onChange={(event) => {
                                const digits = event.target.value.replace(/\D/g, "");
                                if (!digits) {
                                  setForgotPasswordCode((current) => `${current.slice(0, index)}${current.slice(index + 1)}`.slice(0, 6));
                                  setPasswordActionError("");
                                  return;
                                }

                                setForgotPasswordCode((current) => `${current.slice(0, index)}${digits}${current.slice(index + 1)}`.slice(0, 6));
                                setPasswordActionError("");
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Backspace" && !forgotPasswordCode[index]) {
                                  (event.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
                                }
                              }}
                              onInput={(event) => {
                                if ((event.currentTarget.value || "").length > 0) {
                                  (event.currentTarget.nextElementSibling as HTMLInputElement | null)?.focus();
                                }
                              }}
                              inputMode="numeric"
                              maxLength={1}
                              className="h-11 w-11 rounded-[10px] border border-[#dddddd] bg-[#f7f7f7] px-0 text-center text-[16px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:border-[#c8d8ff] focus:bg-[#f4f7ff]"
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <button type="button" onClick={() => void startForgotPasswordFlow()} disabled={isForgotPasswordSending} className="bg-transparent p-0 font-normal text-[#367cee] transition hover:text-[#1f63d9] disabled:text-[#9bbcf5]"><span style={{ fontSize: 13 }}>{userText("重新发送")}</span></button>
                        </div>
                      </>
                    ) : null}

                    {passwordActionError ? <div className="mt-3 text-[12px] text-red-500">{passwordActionError}</div> : null}
                    {!currentUserHasPassword || securityPasswordMode === "change" || securityPasswordMode === "forgot-reset" ? (
                      <button type="button" onClick={() => void submitPasswordSettings()} disabled={isPasswordSaving} className="mt-4 h-11 min-w-24 rounded-[10px] bg-[#111111] px-5 text-[14px] font-medium text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#cfcfcf]">
                        {isPasswordSaving ? `${userText("保存中")}...` : currentUserHasPassword ? userText("修改密码") : userText("保存密码")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {userDialogTab === "archive" ? (() => {
                const archivedSessions = sortByUpdatedAtDesc(sessions.filter((session) => isArchivedSession(session)));
                const archivedWorkflows = sortByUpdatedAtDesc(workflowItems.filter((item) => isArchivedWorkflow(item)));
                const rows = archiveKind === "session" ? archivedSessions.map((item) => ({ id: item.id, title: item.title, at: item.archivedAt, kind: "session" as const })) : archivedWorkflows.map((item) => ({ id: item.id, title: item.title, at: item.archivedAt, kind: "workflow" as const }));
                return (
                  <div>
                    <div className="mb-5 flex items-center gap-3">
                      <button type="button" onClick={() => setArchiveKind("session")} className={archiveKind === "session" ? "h-10 min-w-[160px] rounded-[10px] bg-[#111111] px-5 text-[14px] font-medium text-white" : "h-10 min-w-[160px] rounded-[10px] bg-[#f4f4f4] px-5 text-[14px] font-medium text-[#555555] transition hover:bg-[#ececec]"}>{userText("对话流归档")}</button>
                      <button type="button" onClick={() => setArchiveKind("workflow")} className={archiveKind === "workflow" ? "h-10 min-w-[160px] rounded-[10px] bg-[#111111] px-5 text-[14px] font-medium text-white" : "h-10 min-w-[160px] rounded-[10px] bg-[#f4f4f4] px-5 text-[14px] font-medium text-[#555555] transition hover:bg-[#ececec]"}>{userText("工作流归档")}</button>
                    </div>
                    <div className="space-y-2">
                      {rows.length > 0 ? rows.map((row) => (
                        <div key={`${row.kind}-${row.id}`} className="flex min-h-11 items-center gap-2">
                          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-4 rounded-[10px] bg-[#f7f7f7] px-4">
                            <div className="min-w-0 flex-1 truncate text-[14px] text-[#333333]">{row.title}</div>
                            <div className="shrink-0 text-[14px] text-[#9a9a9a]">{formatMessageTime(row.at)}</div>
                          </div>
                          <BlackHoverTooltip label={<span className="text-[16px] font-medium">恢复</span>}>
                          <button type="button" onClick={() => { if (row.kind === "session") restoreArchivedSession(row.id); else restoreArchivedWorkflow(row.id); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#e0e0e0] bg-white text-[#333333] transition hover:bg-[#f7f7f7]" aria-label="恢复">
                            <RiResetLeftLine className="h-[18px] w-[18px]" aria-hidden="true" />
                          </button>
                          </BlackHoverTooltip>
                          <BlackHoverTooltip label={<span className="text-[16px] font-medium">删除</span>}>
                          <button type="button" onClick={() => setArchiveDeleteConfirm({ kind: row.kind, id: row.id, title: row.title })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#e0e0e0] bg-white text-[#333333] transition hover:bg-[#f7f7f7]" aria-label="删除">
                            <RiDeleteBinLine className="h-[18px] w-[18px]" aria-hidden="true" />
                          </button>
                          </BlackHoverTooltip>
                        </div>
                      )) : (
                        <div className="flex min-h-11 items-center justify-center rounded-[10px] bg-[#f7f7f7] px-4 text-[14px] text-[#999999]">{archiveKind === "session" ? "暂无归档对话" : "暂无归档工作流"}</div>
                      )}
                    </div>
                  </div>
                );
              })() : null}

              {userDialogTab === "settings" ? (() => {
                const modelIconNode = (id: string) => { const Ic = getGenerationModelIcon(id); return Ic ? <Ic className="h-4 w-4" aria-hidden="true" /> : <AiGenerate3dIcon />; };
                const enabledImageModelOptions = generationModelOptions.image.filter((option) => enabledGenerationModelIds.image.includes(option.id)).map((option) => ({ value: option.id, label: option.label, icon: modelIconNode(option.id) }));
                const enabledVideoModelOptions = generationModelOptions.video.filter((option) => enabledGenerationModelIds.video.includes(option.id)).map((option) => ({ value: option.id, label: option.label, icon: modelIconNode(option.id) }));
                const enabledAudioModelOptions = generationModelOptions.audio.filter((option) => enabledGenerationModelIds.audio.includes(option.id)).map((option) => ({ value: option.id, label: option.label, icon: modelIconNode(option.id) }));
                const audioVoiceSelectOptions = getAudioVoicesForModel(defaultAudioModel).map((voice) => ({ value: voice.id, label: voice.label }));
                const audioEmotionSelectOptions = getAudioEmotionsForModel(defaultAudioModel).map((emotion) => ({ value: emotion.id, label: emotion.label }));
                const imageResolutionSelectOptions = getSupportedImageResolutions(defaultImageModel).map((value) => ({ value, label: value, icon: <ResolutionOptionIcon option={value} mode="image" /> }));
                const videoResolutionSelectOptions = getSupportedVideoResolutions(defaultVideoModel).map((value) => ({ value, label: value, icon: <ResolutionOptionIcon option={value} mode="video" /> }));
                const videoRatioSelectOptions = ["智能比例", ...getSupportedVideoRatios(defaultVideoModel, defaultVideoResolution as never)].map((value) => ({ value, label: value, icon: <RatioOptionIcon option={value} /> }));
                const videoDurationSelectOptions = getVideoDurationOptions(defaultVideoModel).map((value) => ({ value, label: value, icon: <RiTimeLine className="h-4 w-4" aria-hidden="true" /> }));
                const imageRatioSelectOptions = ["智能比例", ...getSupportedImageRatios(defaultImageModel)].map((value) => ({ value, label: value, icon: <RatioOptionIcon option={value} /> }));
                const panelSelectOptions = [
                  { value: "chat", label: userText("对话模式") },
                  ...(WORKFLOW_MODE_ENABLED ? [{ value: "workflow", label: userText("工作流模式") }] : []),
                  { value: "assets", label: userText("资产库") },
                ];
                const changeDefaultVideoModel = (id: string) => {
                  setDefaultVideoModel(id as ModelName);
                  const resolutionOptions = getSupportedVideoResolutions(id);
                  const nextResolution = resolutionOptions.includes(defaultVideoResolution as never) ? defaultVideoResolution : resolutionOptions[0];
                  setDefaultVideoResolution(nextResolution);
                  const ratioOptionsForModel = ["智能比例", ...getSupportedVideoRatios(id, nextResolution as never)];
                  setDefaultVideoRatio(defaultVideoRatio && ratioOptionsForModel.includes(defaultVideoRatio) ? defaultVideoRatio : "智能比例");
                  const durationOptionsForModel = getVideoDurationOptions(id);
                  setDefaultVideoDuration(durationOptionsForModel.includes(defaultVideoDuration) ? defaultVideoDuration : durationOptionsForModel[0]);
                };
                const changeDefaultVideoResolution = (resolution: string) => {
                  setDefaultVideoResolution(resolution);
                  const ratioOptionsForModel = ["智能比例", ...getSupportedVideoRatios(defaultVideoModel, resolution as never)];
                  setDefaultVideoRatio(defaultVideoRatio && ratioOptionsForModel.includes(defaultVideoRatio) ? defaultVideoRatio : "智能比例");
                };
                const changeDefaultImageModel = (id: string) => {
                  setDefaultImageModel(id as ModelName);
                  const resolutionOptions = getSupportedImageResolutions(id);
                  setDefaultImageResolution((current) => resolutionOptions.includes(current as never) ? current : resolutionOptions[0]);
                  setDefaultImageRatio((current) => normalizeImageRatioForModel(id, current));
                };
                const changeDefaultAudioModel = (id: string) => {
                  setDefaultAudioModel(id as ModelName);
                  setDefaultAudioVoice(normalizeAudioVoiceForModel(id, defaultAudioVoice));
                  setDefaultAudioEmotion(normalizeAudioEmotionForModel(id, defaultAudioEmotion));
                };
                const groupHeading = (text: string) => <div className="px-1 pb-0.5 pt-3 text-[12px] font-medium text-[#9a9a9a]">{text}</div>;
                const selectRow = (iconNode: ReactNode, label: string, control: ReactNode) => (
                  <div className="relative flex min-h-11 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                    <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[#9a9a9a]">{iconNode}</span>
                      <span className="text-[14px] font-normal">{label}</span>
                    </div>
                    {control}
                  </div>
                );
                return (
                <div>
                  <div className="w-full space-y-2">
                    {[
                      { key: "language", label: userText("语言"), value: getLanguageDisplayName(userLanguage), icon: RiGlobalLine },
                      { key: "notify", label: userText("图片/视频生成完成提醒"), value: "", icon: RiNotification2Line },
                      { key: "wheelZoom", label: userText("预览页鼠标放在图片上滚轮有缩放功能"), value: "", icon: RiZoomInLine },
                      { key: "wheelFlip", label: userText("预览页鼠标放在缩略图区域滚轮有翻页功能"), value: "", icon: RiArrowUpDownLine },
                    ].map((item) => {
                      const RowIcon = item.icon;

                      return (
                      <div key={item.key} className="relative flex min-h-11 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                        <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                          <RowIcon className="h-[18px] w-[18px] shrink-0 text-[#9a9a9a]" aria-hidden="true" />
                          <span className="text-[14px] font-normal">{item.label}</span>
                        </div>
                        {item.key === "language" ? (
                          <SettingsSelect
                            value={userLanguage}
                            options={userLanguageOptions.map((option) => ({ value: option, label: getLanguageDisplayName(option) }))}
                            onChange={(option) => {
                              setUserLanguage(option as UserLanguage);
                              setUserDialogTip({ message: option === "繁体中文" ? "已切換到繁體中文" : "已切换到简体中文", tone: "default", noTranslate: true });
                            }}
                          />
                        ) : item.key === "notify" ? (
                          <SettingsSwitch checked={notifyOnGenerationComplete} onChange={setNotifyOnGenerationComplete} />
                        ) : item.key === "wheelZoom" ? (
                          <SettingsSwitch checked={previewWheelZoom} onChange={setPreviewWheelZoom} />
                        ) : item.key === "wheelFlip" ? (
                          <SettingsSwitch checked={previewWheelFlip} onChange={setPreviewWheelFlip} />
                        ) : (
                          <div className="min-w-0 truncate text-right text-[14px] text-[#333333]">{item.value}</div>
                        )}
                      </div>
                      );
                    })}

                    {groupHeading(userText("登录默认"))}
                    {selectRow(<RiSettingsLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("登录后默认进入"), (
                      <SettingsSelect value={defaultWorkspacePanel} options={panelSelectOptions} onChange={(value) => { setDefaultWorkspacePanel(value as ActivePanel); defaultWorkspacePanelRef.current = value as ActivePanel; }} />
                    ))}

                    {groupHeading(userText("新建对话 · 默认图片参数"))}
                    {selectRow(<AiGenerate3dIcon />, userText("默认图片模型"), (
                      <SettingsSelect value={defaultImageModel} options={enabledImageModelOptions} onChange={changeDefaultImageModel} />
                    ))}
                    {selectRow(<RatioOptionIcon option={defaultImageRatio} />, userText("默认比例"), (
                      <SettingsSelect value={defaultImageRatio} options={imageRatioSelectOptions} onChange={setDefaultImageRatio} />
                    ))}
                    {selectRow(<RiFullscreenLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("默认分辨率"), (
                      <SettingsSelect value={defaultImageResolution} options={imageResolutionSelectOptions} onChange={setDefaultImageResolution} />
                    ))}

                    {groupHeading(userText("新建对话 · 默认视频参数"))}
                    {selectRow(<AiGenerate3dIcon />, userText("默认视频模型"), (
                      <SettingsSelect value={defaultVideoModel} options={enabledVideoModelOptions} onChange={changeDefaultVideoModel} />
                    ))}
                    {selectRow(<RatioOptionIcon option={defaultVideoRatio} />, userText("默认比例"), (
                      <SettingsSelect value={defaultVideoRatio} options={videoRatioSelectOptions} onChange={setDefaultVideoRatio} />
                    ))}
                    {selectRow(<RiFullscreenLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("默认分辨率"), (
                      <SettingsSelect value={defaultVideoResolution} options={videoResolutionSelectOptions} onChange={changeDefaultVideoResolution} />
                    ))}
                    {selectRow(<RiTimeLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("默认时长"), (
                      <SettingsSelect value={defaultVideoDuration} options={videoDurationSelectOptions} onChange={setDefaultVideoDuration} />
                    ))}

                    {groupHeading(userText("新建对话 · 默认语音参数"))}
                    {selectRow(<RiMicAiLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("默认语音模型"), (
                      <SettingsSelect value={defaultAudioModel} options={enabledAudioModelOptions} onChange={changeDefaultAudioModel} />
                    ))}
                    {isAudioVoiceSelectable(defaultAudioModel) && defaultAudioVoice ? selectRow(<RiVoiceprintLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("默认音色"), (
                      <SettingsSelect value={defaultAudioVoice} options={audioVoiceSelectOptions} onChange={setDefaultAudioVoice} />
                    )) : null}
                    {isAudioEmotionSelectable(defaultAudioModel) ? selectRow(<RiEmotionHappyLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("默认情绪"), (
                      <SettingsSelect value={defaultAudioEmotion} options={audioEmotionSelectOptions} onChange={setDefaultAudioEmotion} />
                    )) : null}

                    {groupHeading("")}
                    {selectRow(<RiInformationLine className="h-[18px] w-[18px]" aria-hidden="true" />, userText("版本信息"), (
                      <div className="min-w-0 truncate text-right text-[14px] text-[#333333]">{versionLabel()}</div>
                    ))}
                  </div>
                </div>
                );
              })() : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {archiveDeleteConfirm ? (
        <div className="fixed inset-0 z-[11100] flex items-center justify-center bg-black/40" onMouseDown={() => setArchiveDeleteConfirm(null)}>
          <div className="w-[360px] rounded-[14px] bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="text-[15px] font-semibold text-[#111111]">删除归档</div>
            <div className="mt-3 text-[13px] leading-6 text-[#555555]">删除后不可恢复，是否删除「{archiveDeleteConfirm.title}」？</div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setArchiveDeleteConfirm(null)} className="rounded-lg border border-[#ddd] px-4 py-2 text-[13px] text-[#444] hover:bg-[#f5f5f5]">取消</button>
              <button type="button" onClick={() => {
                const { kind, id } = archiveDeleteConfirm;
                setArchiveDeleteConfirm(null);
                if (kind === "session") deleteSession(id);
                else deleteWorkflow(id);
              }} className="rounded-lg bg-[#111] px-12 py-2 text-[13px] font-medium text-white hover:bg-[#252525]">确定</button>
            </div>
          </div>
        </div>
      ) : null}

      {renamingSessionId ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center overscroll-contain bg-black/35 px-4">
          <div className="relative w-full max-w-[500px] rounded-xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
            <button type="button" onClick={cancelRenameSession} className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-900" aria-label="关闭重命名弹窗">
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="mb-3 text-sm font-medium text-slate-900">请重新编辑对话名称：</div>
            <input
              value={renameInput}
              onChange={(event) => setRenameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRenameSession();
                if (event.key === "Escape") cancelRenameSession();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition hover:border-[#bcd3ff] focus:border-[#2b65f5]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cancelRenameSession} className="h-9 w-20 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50">
                取消
              </button>
              <button type="button" onClick={submitRenameSession} className="h-9 w-20 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {renamingAssetId ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center overscroll-contain bg-black/35 px-4">
          <div className="relative w-full max-w-[500px] rounded-xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
            <button type="button" onClick={cancelRenameAsset} className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-900" aria-label="关闭资产重命名弹窗">
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="mb-3 text-sm font-medium text-slate-900">请重新编辑资产名称：</div>
            <input
              value={assetRenameInput}
              onChange={(event) => setAssetRenameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRenameAsset();
                if (event.key === "Escape") cancelRenameAsset();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition hover:border-[#bcd3ff] focus:border-[#2b65f5]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cancelRenameAsset} className="h-9 w-20 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50">
                取消
              </button>
              <button type="button" onClick={submitRenameAsset} className="h-9 w-20 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DocumentPreviewPanel file={previewDocumentFile} width={previewDocumentWidth || getDefaultDocumentPreviewWidth()} onResizeStart={startDocumentPreviewResize} onClose={() => setPreviewDocumentFile(null)} />

      {previewAsset ? (
        <div className="flashmuse-preview-modal fixed inset-0 z-[11000] overscroll-contain bg-black/58" onClick={() => setPreviewAsset(null)}>
          <div className="flex h-full w-full flex-col pt-8 sm:pt-10 lg:pt-12">
            <div className="flex min-h-0 min-w-[920px] flex-1 overflow-hidden rounded-t-[20px] bg-transparent shadow-[0_20px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5" onClick={(event) => event.stopPropagation()}>
              <div className="flashmuse-preview-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[rgba(245,245,242,0.58)] backdrop-blur-[56px] backdrop-saturate-[190%] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.64)_0%,rgba(255,255,255,0.22)_42%,rgba(255,255,255,0.38)_100%)] after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.72),transparent_28%),radial-gradient(circle_at_82%_88%,rgba(255,255,255,0.36),transparent_34%)]">
                <div className="relative z-10 flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                  <div className="flashmuse-preview-toolbar flex items-center gap-2.5">
                    {!isVideoAsset(previewAsset) ? (
                      <>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("actual");
                          applyPreviewScale(visiblePreviewScale - 0.1);
                        }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label="缩小图片">
                          <span className="text-[18px] leading-none">-</span>
                        </button>
                        <div className="flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666]">{previewScalePercent}</div>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("actual");
                          applyPreviewScale(visiblePreviewScale + 0.1);
                        }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label="放大图片">
                          <span className="text-[18px] leading-none">+</span>
                        </button>
                        <BlackHoverTooltip label="显示图片的实际尺寸" side="bottom">
                          <button type="button" onClick={() => {
                            setPreviewFitMode("actual");
                            setPreviewScale(1);
                            setPreviewPan({ x: 0, y: 0 });
                          }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition" style={previewLightToolButtonStyle}>
                            <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                          </button>
                        </BlackHoverTooltip>
                        <BlackHoverTooltip label="显示适合屏幕的完整图片" side="bottom">
                          <button type="button" onClick={() => {
                            setPreviewFitMode("fit");
                            updatePreviewFitScale();
                            setPreviewPan({ x: 0, y: 0 });
                            const viewport = previewViewportRef.current;
                            if (viewport) {
                              viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
                            }
                          }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition" style={previewLightToolButtonStyle}>
                            <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                          </button>
                        </BlackHoverTooltip>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled className="yinzao-tool-button flex h-9 w-9 cursor-not-allowed items-center justify-center text-[#777777] opacity-30" style={previewLightToolButtonStyle} aria-label="缩小图片不可用">
                          <span className="text-[18px] leading-none">-</span>
                        </button>
                        <div className="flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666] opacity-30">适合</div>
                        <button type="button" disabled className="yinzao-tool-button flex h-9 w-9 cursor-not-allowed items-center justify-center text-[#777777] opacity-30" style={previewLightToolButtonStyle} aria-label="放大图片不可用">
                          <span className="text-[18px] leading-none">+</span>
                        </button>
                        <button type="button" disabled className="yinzao-tool-button inline-flex h-9 cursor-not-allowed items-center px-3.5 text-[#777777] opacity-30" style={previewLightToolButtonStyle}>
                          <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                        </button>
                        <button type="button" disabled className="yinzao-tool-button inline-flex h-9 cursor-not-allowed items-center px-3.5 text-[#777777] opacity-30" style={previewLightToolButtonStyle}>
                          <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isPreviewDownloadReady ? (
                      <a href={getDownloadUrl(previewAsset.url)} download={getDownloadName(previewAsset)} className="inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-6 text-[13px] font-medium text-white transition hover:bg-[#252525]" aria-label={isVideoAsset(previewAsset) ? "下载视频" : "下载图片"}>
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载</span>
                      </a>
                    ) : (
                      <button type="button" disabled className="inline-flex h-9 min-w-[132px] cursor-not-allowed items-center justify-center gap-2 rounded-[8px] bg-[#b8b8b8] px-5 text-[13px] font-medium text-white opacity-80" aria-label="下载准备中">
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载准备中...</span>
                      </button>
                    )}
                    <button type="button" onClick={() => setPreviewAsset(null)} className="yinzao-tool-button flex h-9 w-9 translate-x-2 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label="关闭预览">
                      <RiCloseLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {previewMediaOptions.length > 1 ? (
                  <div className="absolute right-2 top-[92px] z-20 flex max-h-[calc(100%-124px)] w-[50px] flex-col items-center gap-2" onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onWheelCapture={(event) => {
                    event.stopPropagation();
                    if (!previewWheelFlip || previewMediaOptions.length <= 1) return;
                    event.preventDefault();
                    shiftPreviewAsset(event.deltaY < 0 ? -1 : 1);
                  }}>
                    {previewThumbsNeedScroll ? (
                      <button type="button" disabled={!canPagePreviewThumbsUp} onClick={(event) => {
                        event.stopPropagation();
                        pagePreviewThumbsByButton(-1);
                      }} className="yinzao-tool-button flex h-[50px] w-[50px] shrink-0 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label="上一页缩略图">
                        <RiArrowUpSLine className="h-6 w-6" aria-hidden="true" />
                      </button>
                    ) : null}
                    <div className="relative overflow-hidden" style={{ height: pagePreviewThumbListHeight }}>
                      <div ref={previewThumbListRef} className="yinzao-hidden-scrollbar flex flex-col gap-2 overflow-hidden">
                        {pagePreviewThumbs.map((image) => {
                          const isSelected = previewAsset.id === image.id || previewAsset.url === image.url;
                          const isVideoThumb = isVideoAsset(image);

                          return (
                            <button key={image.id} type="button" data-preview-thumb-id={image.id} data-preview-thumb-url={image.url} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { if (isSelected) return; resetPreviewTransform(); setPreviewAsset(image); }} className={`flashmuse-preview-thumb relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-[5px] border-2 bg-[#f1f1f1] transition ${isSelected ? "flashmuse-preview-thumb-selected" : "flashmuse-preview-thumb-rest"}`} aria-label={`查看${image.name}`}>
                              {isVideoThumb ? (
                                <>
                                  {image.posterUrl ? <Image src={getMediaThumbnailUrl(image.posterUrl)} alt={image.name} fill sizes="50px" unoptimized className="object-cover" /> : <video src={getStaticMediaUrl(image.url)} className="h-full w-full object-cover" muted playsInline preload="metadata" />}
                                  <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-[3px] bg-black/56 text-white backdrop-blur-[4px]">
                                    <RiFilmLine className="h-3 w-3" aria-hidden="true" />
                                  </span>
                                </>
                              ) : (
                                <Image src={getMediaThumbnailUrl(image.url)} alt={image.name} fill sizes="50px" unoptimized className="object-cover" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {previewThumbsNeedScroll ? (
                      <button type="button" disabled={!canPagePreviewThumbsDown} onClick={(event) => {
                        event.stopPropagation();
                        pagePreviewThumbsByButton(1);
                      }} className="yinzao-tool-button flex h-[50px] w-[50px] shrink-0 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label="下一页缩略图">
                        <RiArrowDownSLine className="h-6 w-6" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div ref={previewViewportRef} className={`relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7 ${!isVideoAsset(previewAsset) && !isAudioAsset(previewAsset) && previewFitMode === "actual" ? isPreviewDragging ? "cursor-grabbing" : "cursor-grab" : ""}`} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onWheel={(event) => {
                  if (!previewWheelZoom || isVideoAsset(previewAsset) || isAudioAsset(previewAsset)) return;
                  event.preventDefault();
                  const delta = event.deltaY < 0 ? 0.1 : -0.1;
                  setPreviewFitMode("actual");
                  applyPreviewScale(visiblePreviewScale + delta);
                }} onMouseDown={(event) => {
                  if (isVideoAsset(previewAsset) || isAudioAsset(previewAsset) || previewFitMode !== "actual") return;
                  event.preventDefault();
                  previewDragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: previewPan.x, panY: previewPan.y };
                  setIsPreviewDragging(true);
                }} onMouseMove={(event) => {
                  if (!isPreviewDragging) return;
                  const start = previewDragStartRef.current;
                  setPreviewPan({ x: start.panX + event.clientX - start.pointerX, y: start.panY + event.clientY - start.pointerY });
                }} onMouseUp={() => setIsPreviewDragging(false)} onMouseLeave={() => setIsPreviewDragging(false)}>
                  <div className="flex h-full w-full items-center justify-center bg-transparent">
                    {isAudioAsset(previewAsset) ? (
                      <div className="flex w-full max-w-[680px] flex-col items-center gap-5 rounded-[20px] bg-white/92 px-8 py-10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e5f7f4] text-[#0f766e]">
                          <RiMusic2Line className="h-8 w-8" aria-hidden="true" />
                        </div>
                        <div className="max-w-full truncate text-[15px] font-medium text-[#222222]">{previewAsset.name}</div>
                        <audio key={`${previewAsset.id}-${previewAsset.url}`} src={getStaticMediaUrl(previewAsset.url)} preload="metadata" controls className="w-full" />
                      </div>
                    ) : isVideoAsset(previewAsset) ? (
                      <video key={`${previewAsset.id}-${previewAsset.url}`} src={getVideoPlaybackUrl(previewAsset.url)} poster={getStaticMediaUrl(previewAsset.posterUrl, videoPosterVersion)} preload="metadata" className="h-full w-full max-h-full max-w-full object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" controls playsInline onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        if (!video.videoWidth || !video.videoHeight) return;
                        const dimensions = { width: video.videoWidth, height: video.videoHeight };
                        setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, previewMeta: getPreviewMetaWithDimensions(current.previewMeta, dimensions, "video") } : current);
                        if (previewAsset.sessionId && previewAsset.messageId) updateMessageVideoDimensions(previewAsset.sessionId, previewAsset.messageId, dimensions);
                      }} />
                    ) : (
                      <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img key={`${previewAsset.id}-${previewAsset.url}`} ref={previewImageRef} src={getStaticMediaUrl(previewAsset.url)} alt={previewAsset.name} draggable={false} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onLoad={(event) => {
                        const image = event.currentTarget;
                        const currentPreviewAsset = previewAssetRef.current;
                        if (!currentPreviewAsset || (currentPreviewAsset.id !== previewAsset.id && normalizeMediaUrlForMatch(currentPreviewAsset.url) !== normalizeMediaUrlForMatch(previewAsset.url))) return;
                        const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
                        setPreviewNaturalSize((current) => current.width === dimensions.width && current.height === dimensions.height ? current : dimensions);
                        requestAnimationFrame(() => updatePreviewFitScale(dimensions));
                        setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, previewMeta: getPreviewMetaWithDimensions(current.previewMeta, dimensions, "image") } : current);
                        if (previewAsset.sessionId && previewAsset.messageId) updateMessageImageDimensions(previewAsset.sessionId, previewAsset.messageId, previewAsset.url, dimensions);
                      }} className="shrink-0 select-none object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" style={previewFitMode === "fit" ? { maxWidth: previewNaturalSize.width ? "none" : "100%", maxHeight: previewNaturalSize.height ? "none" : "100%", width: previewNaturalSize.width ? `${previewNaturalSize.width * previewFitScale}px` : "auto", height: "auto", transform: "translate3d(0, 0, 0)", transition: isPreviewDragging ? "none" : "transform 120ms ease-out" } : { maxWidth: "none", width: `${(previewNaturalSize.width || 2000) * visiblePreviewScale}px`, height: "auto", transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0)`, transition: isPreviewDragging ? "none" : "transform 120ms ease-out" }} />
                      </>
                    )}
                  </div>
                </div>
              </div>
              <aside className="flashmuse-preview-aside relative flex h-full w-[360px] shrink-0 flex-col border-l border-[#eceae6] bg-[#f8f7f4]" style={resolvedTheme === "dark" ? { backgroundColor: "#2a303c", borderColor: "var(--fm-border-subtle)" } : undefined}>
                {isReversePromptingPreview ? <PromptOptimizingOverlay /> : null}
                <div className="mx-9 shrink-0 border-b border-[#e4e2dd] pb-3 pt-7">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-[#111111]">{previewAsset.name}</div>
                    {previewDisplayMeta || previewSourceLabel ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] leading-5 text-[#8c8c8c]">
                        {previewDisplayMeta ? (
                          <>
                            <span className="truncate">{previewDisplayMeta.modelLabel}</span>
                            <span className="text-[#d0d0d0]">|</span>
                            <span>{previewDisplayMeta.ratio}</span>
                            <span className="text-[#d0d0d0]">|</span>
                            <span className="inline-flex items-center gap-1.5">
                              <span>{previewDisplayMeta.sizeText}</span>
                              <CompactResolutionIcon option={previewDisplayMeta.resolution} mode={previewDisplayMeta.mode} qualityBadgeLabel={previewDisplayMeta.qualityBadgeLabel} />
                            </span>
                            {previewDisplayMeta.styleLabel ? (
                              <>
                                <span className="text-[#d0d0d0]">|</span>
                                <span>{previewDisplayMeta.styleLabel}</span>
                              </>
                            ) : null}
                            {previewDisplayMeta.duration ? (
                              <>
                                <span className="text-[#d0d0d0]">|</span>
                                <span>{previewDisplayMeta.duration}</span>
                              </>
                            ) : null}
                          </>
                        ) : null}
                        {previewSourceLabel ? <span>{previewSourceLabel}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={`min-h-0 flex-1 overflow-y-auto px-9 pb-8 pt-4 transition ${isReversePromptingPreview ? "pointer-events-none opacity-45 grayscale-[0.15]" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#8b8b8b]">
                      <RiInformationLine className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>图片提示词</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                    {previewHasUsablePrompt ? (
                      <button type="button" disabled={isReversePromptingPreview} onClick={() => void copyPreviewPrompt()} className="inline-flex h-[26px] w-[26px] items-center justify-center bg-transparent p-0 text-[#777777] transition hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-45" aria-label="复制提示词">
                        {previewPromptCopyState === "success" ? <RiCheckLine className="h-5 w-5 text-[#777777]" aria-hidden="true" /> : previewPromptCopyState === "error" ? <RiCloseLine className="h-4 w-4 text-red-500" aria-hidden="true" /> : <RiCheckboxMultipleBlankLine className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    ) : null}
                    {previewHasUsablePrompt ? (
                      <button type="button" disabled={isReversePromptingPreview} onClick={() => {
                        if (!previewAsset.sourcePrompt.trim()) return;
                        const session = sessions.find((item) => item.id === previewAsset.sessionId);
                        const sourceMessage = session?.messages.find((item) => item.id === previewAsset.messageId);
                        if (sourceMessage) {
                          void copyPrompt(sourceMessage);
                        } else {
                          setActiveDraftInputWithMentionCards(previewAsset.sourcePrompt);
                        }
                        setActivePanel("chat");
                        setPreviewAsset(null);
                        requestAnimationFrame(() => editorRef.current?.focus());
                      }} className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[5px] bg-black/46 px-1.5 font-medium leading-none text-white ring-1 ring-white/12 backdrop-blur-[10px] transition hover:bg-black/58 disabled:cursor-not-allowed disabled:opacity-45">
                        <RiTBoxLine className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[12px] leading-none">使用提示词</span>
                      </button>
                    ) : canReversePreviewPrompt ? (
                      <button type="button" disabled={isReversePromptingPreview} onClick={() => void reversePreviewPrompt()} className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[5px] bg-[#367cee] px-1.5 font-medium leading-none text-white transition hover:bg-[#2f6fd4] disabled:cursor-not-allowed disabled:opacity-55">
                        <RiQuillPenAiLine className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[12px] leading-none">{isReversePromptingPreview ? "反推中" : "反推提示词"}</span>
                      </button>
                    ) : null}
                    </div>
                  </div>
                  {previewPromptErrorText ? <div className="mt-1.5 text-[14px] leading-6 text-red-500">{previewPromptErrorText}</div> : null}
                  {previewHasUsablePrompt && (previewPromptReferences.length > 0 || previewPromptMediaReferences.length > 0) ? (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {previewPromptReferences.filter((reference) => reference.url).map((reference, index) => (
                        <HoverImagePreview key={`img-${reference.url}-${index}`} src={getStaticMediaUrl(reference.url) ?? reference.url} alt={reference.name || `参考图${index + 1}`} wrapperClassName="block h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getMediaThumbnailUrl(reference.url)} alt={reference.name || `参考图${index + 1}`} className="h-full w-full object-cover" />
                        </HoverImagePreview>
                      ))}
                      {previewPromptMediaReferences.filter((reference) => reference.url).map((reference, index) => {
                        const mediaSrc = getStaticMediaUrl(reference.url) ?? reference.url;
                        return (
                          <div key={`media-${reference.url}-${index}`} className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]" title={reference.name}>
                            {reference.mediaKind === "video" ? (
                              <>
                                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                <video src={`${mediaSrc}#t=0.1`} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-cover" />
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45"><span className="ml-[2px] h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-white" /></span>
                                </span>
                              </>
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[#8a8a8a]"><RiVoiceprintLine className="h-7 w-7" aria-hidden="true" /></span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-6 text-[#333333]">{previewHasUsablePrompt ? <ReferencedTextContent content={previewAsset.sourcePrompt} references={previewPromptReferences} mediaReferences={previewPromptMediaReferences} /> : "暂无提示词"}</div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
