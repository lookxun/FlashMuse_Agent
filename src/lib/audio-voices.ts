export type AudioVoiceLang = "zh" | "yue" | "en" | "ja" | "ko";

export type AudioVoiceOption = { id: string; label: string; lang: AudioVoiceLang; previewText?: string };

function slugVoiceId(id: string) {
  return id.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export function getAudioVoicePreviewUrl(voice: AudioVoiceOption) {
  if (!voice.previewText) return undefined;
  return `/voice-previews/minimax/${slugVoiceId(voice.id)}.mp3`;
}

export const AUDIO_VOICE_LANGS: Array<{ value: AudioVoiceLang; label: string }> = [
  { value: "zh", label: "普通话" },
  { value: "yue", label: "粤语" },
  { value: "en", label: "英语" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
];

const QWEN_VOICES: AudioVoiceOption[] = [
  { id: "longanlingxin", label: "龙安灵心", lang: "zh" },
  { id: "longanlufeng", label: "龙安鲁风", lang: "zh" },
];

const MINIMAX_VOICES: AudioVoiceOption[] = [
  { id: "Chinese (Mandarin)_Reliable_Executive", label: "可靠高管", lang: "zh", previewText: "这件事我已经安排好了，按时推进就行。" },
  { id: "Chinese (Mandarin)_News_Anchor", label: "新闻主播", lang: "zh", previewText: "接下来为您播报今天的主要新闻。" },
  { id: "Chinese (Mandarin)_Unrestrained_Young_Man", label: "不羁青年", lang: "zh", previewText: "别跟我讲规矩，我想怎么来就怎么来。" },
  { id: "Chinese (Mandarin)_Mature_Woman", label: "成熟女性", lang: "zh", previewText: "有些事不必急着说破，你自己会明白。" },
  { id: "Arrogant_Miss", label: "傲娇小姐", lang: "zh", previewText: "哼，又不是专门说给你听的。" },
  { id: "Robot_Armor", label: "机器人铠甲", lang: "zh", previewText: "系统已就绪，等待你的下一条指令。" },
  { id: "Chinese (Mandarin)_Kind-hearted_Antie", label: "热心阿姨", lang: "zh", previewText: "来来来，快坐，阿姨给你倒杯热水。" },
  { id: "Chinese (Mandarin)_HK_Flight_Attendant", label: "港航乘务", lang: "zh", previewText: "各位旅客请注意，本次航班即将起飞。" },
  { id: "Chinese (Mandarin)_Humorous_Elder", label: "幽默长者", lang: "zh", previewText: "哎，活这么大，啥热闹没见过。" },
  { id: "Chinese (Mandarin)_Gentleman", label: "绅士", lang: "zh", previewText: "请允许我为您介绍接下来的安排。" },
  { id: "Chinese (Mandarin)_Warm_Bestie", label: "温暖闺蜜", lang: "zh", previewText: "没事的，有我在，你慢慢说就好。" },
  { id: "Chinese (Mandarin)_Stubborn_Friend", label: "倔强朋友", lang: "zh", previewText: "说了不做就不做，这次我不会让步。" },
  { id: "Chinese (Mandarin)_Sweet_Lady", label: "甜美女士", lang: "zh", previewText: "今天天气真好，心情也跟着亮起来了。" },
  { id: "Chinese (Mandarin)_Southern_Young_Man", label: "南方青年", lang: "zh", previewText: "走啦，去外面吹吹风，别闷着。" },
  { id: "Chinese (Mandarin)_Wise_Women", label: "智慧女性", lang: "zh", previewText: "把关键问题想清楚，答案其实很简单。" },
  { id: "Chinese (Mandarin)_Gentle_Youth", label: "温和青年", lang: "zh", previewText: "不着急，我们一步一步来就好。" },
  { id: "Chinese (Mandarin)_Warm_Girl", label: "温暖少女", lang: "zh", previewText: "你回来啦，我等你很久了。" },
  { id: "Chinese (Mandarin)_Male_Announcer", label: "男播音", lang: "zh", previewText: "欢迎收听本期节目，我是今天的播音员。" },
  { id: "Chinese (Mandarin)_Kind-hearted_Elder", label: "慈祥长者", lang: "zh", previewText: "孩子，慢慢来，别给自己太大压力。" },
  { id: "Chinese (Mandarin)_Cute_Spirit", label: "可爱精灵", lang: "zh", previewText: "嘿，看我发现了什么好玩的东西！" },
  { id: "Chinese (Mandarin)_Radio_Host", label: "电台主持", lang: "zh", previewText: "夜深了，把音量调低，我们继续聊。" },
  { id: "Chinese (Mandarin)_Lyrical_Voice", label: "抒情嗓音", lang: "zh", previewText: "风轻轻走过窗边，像一句没说完的话。" },
  { id: "Chinese (Mandarin)_Straightforward_Boy", label: "直率男孩", lang: "zh", previewText: "有话直说，绕来绕去多累啊。" },
  { id: "Chinese (Mandarin)_Sincere_Adult", label: "真诚成人", lang: "zh", previewText: "我是认真的，这句话绝没有别的意思。" },
  { id: "Chinese (Mandarin)_Gentle_Senior", label: "温和长辈", lang: "zh", previewText: "先吃饭，别的事儿吃完再商量。" },
  { id: "Chinese (Mandarin)_Crisp_Girl", label: "清脆少女", lang: "zh", previewText: "早上好呀，今天也要元气满满哦。" },
  { id: "Chinese (Mandarin)_Pure-hearted_Boy", label: "纯真男孩", lang: "zh", previewText: "这个我也会！你教我一下好不好？" },
  { id: "Chinese (Mandarin)_Soft_Girl", label: "软萌少女", lang: "zh", previewText: "嗯……那、那你再陪我待一会儿嘛。" },
  { id: "Chinese (Mandarin)_IntellectualGirl", label: "知性少女", lang: "zh", previewText: "这本书后半段写得特别好，值得再读。" },
  { id: "Chinese (Mandarin)_Warm_HeartedGirl", label: "暖心少女", lang: "zh", previewText: "别怕，我一直都在你身边。" },
  { id: "Chinese (Mandarin)_Laid_BackGirl", label: "慵懒少女", lang: "zh", previewText: "好困啊，再让我躺五分钟就起来。" },
  { id: "Chinese (Mandarin)_ExplorativeGirl", label: "探索少女", lang: "zh", previewText: "前面那条路我还没走过，一起去看看？" },
  { id: "Chinese (Mandarin)_Warm-HeartedAunt", label: "暖心阿姨", lang: "zh", previewText: "回家了就好，阿姨给你留了晚饭。" },
  { id: "Chinese (Mandarin)_BashfulGirl", label: "害羞少女", lang: "zh", previewText: "那个……我、我其实想跟你说一声谢谢。" },
  { id: "Cantonese_GentleLady", label: "温柔女士", lang: "yue", previewText: "唔使急，慢慢讲，我听住你。" },
  { id: "Cantonese_PlayfulMan", label: "俏皮男", lang: "yue", previewText: "喂，得闲饮茶啊？我请你啦。" },
  { id: "Cantonese_CuteGirl", label: "可爱少女", lang: "yue", previewText: "嘻嘻，今日天气咁好，出街玩啊！" },
  { id: "Cantonese_KindWoman", label: "和善女士", lang: "yue", previewText: "返嚟啦？快啲入嚟坐，我煮咗汤。" },
  { id: "English_expressive_narrator", label: "富有表现力旁白", lang: "en", previewText: "Let me take you into a story you will not forget." },
  { id: "English_radiant_girl", label: "明媚少女", lang: "en", previewText: "Today feels so bright. I just want to smile." },
  { id: "English_magnetic_voiced_man", label: "磁性男声", lang: "en", previewText: "Come closer. I have something to tell you." },
  { id: "English_compelling_lady1", label: "有感染力女士", lang: "en", previewText: "You can do this. I believe in you." },
  { id: "English_Aussie_Bloke", label: "澳洲小伙", lang: "en", previewText: "No worries, mate. We will figure it out." },
  { id: "English_captivating_female1", label: "迷人女声", lang: "en", previewText: "Stay with me for a moment. Listen." },
  { id: "English_Upbeat_Woman", label: "开朗女性", lang: "en", previewText: "Good morning! Let’s make today a great one." },
  { id: "English_Trustworth_Man", label: "可靠男士", lang: "en", previewText: "I have already handled it. You can count on me." },
  { id: "English_CalmWoman", label: "平静女性", lang: "en", previewText: "Take a breath. There is no need to rush." },
  { id: "English_UpsetGirl", label: "懊恼少女", lang: "en", previewText: "Ugh, why does this always happen to me?" },
  { id: "English_Gentle-voiced_man", label: "温和男声", lang: "en", previewText: "It is alright. We can talk it through." },
  { id: "English_Whispering_girl", label: "耳语少女", lang: "en", previewText: "Shh… come here. I will tell you a secret." },
  { id: "English_Diligent_Man", label: "勤恳男士", lang: "en", previewText: "I will stay until the work is done." },
  { id: "English_Graceful_Lady", label: "优雅女士", lang: "en", previewText: "Please, after you. It would be my pleasure." },
  { id: "English_ReservedYoungMan", label: "内敛青年", lang: "en", previewText: "I do not say much. But I mean it." },
  { id: "English_PlayfulGirl", label: "俏皮少女", lang: "en", previewText: "Guess what? I have a little surprise." },
  { id: "English_ManWithDeepVoice", label: "低沉男声", lang: "en", previewText: "Night falls, and the city grows quiet." },
  { id: "English_MaturePartner", label: "成熟伴侣", lang: "en", previewText: "I am here. You do not have to face this alone." },
  { id: "English_FriendlyPerson", label: "友善小伙", lang: "en", previewText: "Hey, need a hand? I am right here." },
  { id: "English_MatureBoss", label: "强势女士", lang: "en", previewText: "Do it now. I will not say it twice." },
  { id: "English_Debator", label: "男辩手", lang: "en", previewText: "The facts are clear. Let me prove my point." },
  { id: "English_LovelyGirl", label: "可爱少女", lang: "en", previewText: "Hi! Can I sit with you for a bit?" },
  { id: "English_Steadymentor", label: "可靠男士", lang: "en", previewText: "Lean on me. I will not let you down." },
  { id: "English_Deep-VoicedGentleman", label: "低沉绅士", lang: "en", previewText: "Allow me. A gentleman always keeps his word." },
  { id: "English_Wiselady", label: "睿智女士", lang: "en", previewText: "Look closer. The answer is simpler than it seems." },
  { id: "English_CaptivatingStoryteller", label: "迷人讲述者", lang: "en", previewText: "Once upon a time, a door opened in the dark." },
  { id: "English_DecentYoungMan", label: "正派青年", lang: "en", previewText: "That is not right. We should do better." },
  { id: "English_SentimentalLady", label: "感性女士", lang: "en", previewText: "Some nights, I still think about that day." },
  { id: "English_ImposingManner", label: "威严女王", lang: "en", previewText: "Kneel, or stand tall. Choose now." },
  { id: "English_SadTeen", label: "少年", lang: "en", previewText: "I… I just wanted to say I am sorry." },
  { id: "English_PassionateWarrior", label: "热血战士", lang: "en", previewText: "Charge with me! This is our moment!" },
  { id: "English_WiseScholar", label: "睿智学者", lang: "en", previewText: "History repeats, if we refuse to learn." },
  { id: "English_Soft-spokenGirl", label: "轻声少女", lang: "en", previewText: "If it is okay… may I speak softly?" },
  { id: "English_SereneWoman", label: "宁静女性", lang: "en", previewText: "The rain is falling. Let us just sit still." },
  { id: "English_ConfidentWoman", label: "自信女性", lang: "en", previewText: "I know who I am. I will not step back." },
  { id: "English_PatientMan", label: "耐心男士", lang: "en", previewText: "One step at a time. I will wait." },
  { id: "English_Comedian", label: "喜剧演员", lang: "en", previewText: "Wait, wait. You have got to hear this joke." },
  { id: "English_BossyLeader", label: "强势领导", lang: "en", previewText: "Listen up. We move as one, right now." },
  { id: "English_Strong-WilledBoy", label: "意志坚定男孩", lang: "en", previewText: "I will not give up. Not this time." },
  { id: "English_StressedLady", label: "焦虑女士", lang: "en", previewText: "What if it all goes wrong? I cannot stop thinking." },
  { id: "English_AssertiveQueen", label: "果断女王", lang: "en", previewText: "Decision made. We proceed at once." },
  { id: "English_AnimeCharacter", label: "女旁白", lang: "en", previewText: "In this world, every choice leaves a mark." },
  { id: "English_Jovialman", label: "快活男士", lang: "en", previewText: "Ha! That was fun. Let’s do it again." },
  { id: "English_WhimsicalGirl", label: "古灵精怪少女", lang: "en", previewText: "I have a wild idea. Trust me on this." },
  { id: "English_Kind-heartedGirl", label: "善良少女", lang: "en", previewText: "If you are tired, I can stay with you." },
  { id: "Japanese_IntellectualSenior", label: "知性长辈", lang: "ja", previewText: "焦らなくていい。答えは、もう近くにあるよ。" },
  { id: "Japanese_DecisivePrincess", label: "果断公主", lang: "ja", previewText: "決まりよ。今すぐ、進みなさい。" },
  { id: "Japanese_LoyalKnight", label: "忠诚骑士", lang: "ja", previewText: "ご安心を。この命にかけて、お守りします。" },
  { id: "Japanese_DominantMan", label: "强势男士", lang: "ja", previewText: "言い訳はいい。結果だけ持ってこい。" },
  { id: "Japanese_SeriousCommander", label: "严肃指挥官", lang: "ja", previewText: "全隊、聞け。今から一斉に動く。" },
  { id: "Japanese_ColdQueen", label: "冷艳女王", lang: "ja", previewText: "跪くか、立つか。選ぶのは今よ。" },
  { id: "Japanese_DependableWoman", label: "可靠女性", lang: "ja", previewText: "任せて。私がちゃんと片付けておくから。" },
  { id: "Japanese_GentleButler", label: "温和管家", lang: "ja", previewText: "少々お待ちを。すぐご用意いたします。" },
  { id: "Japanese_KindLady", label: "和善女士", lang: "ja", previewText: "さあ、どうぞ。温かいお茶を入れたの。" },
  { id: "Japanese_CalmLady", label: "平静女士", lang: "ja", previewText: "深呼吸して。急がなくて大丈夫よ。" },
  { id: "Japanese_OptimisticYouth", label: "乐观青年", lang: "ja", previewText: "大丈夫！きっとうまくいくって。" },
  { id: "Japanese_GenerousIzakayaOwner", label: "豪爽居酒屋老板", lang: "ja", previewText: "いらっしゃい！今日は飲んでけよ！" },
  { id: "Japanese_SportyStudent", label: "运动学生", lang: "ja", previewText: "もう一回走ろうぜ。まだ体、動ける！" },
  { id: "Japanese_InnocentBoy", label: "天真男孩", lang: "ja", previewText: "ねえ、これ何？教えてよ！" },
  { id: "Japanese_GracefulMaiden", label: "优雅少女", lang: "ja", previewText: "今夜は、少しだけお付き合いいただけますか。" },
  { id: "Korean_AirheadedGirl", label: "迷糊少女", lang: "ko", previewText: "어… 내가 지금 뭐 하려고 했지?" },
  { id: "Korean_AthleticGirl", label: "运动少女", lang: "ko", previewText: "자, 한 바퀴 더! 아직 할 수 있어!" },
  { id: "Korean_AthleticStudent", label: "运动学生", lang: "ko", previewText: "워밍업 끝났어. 바로 시작하자." },
  { id: "Korean_BraveAdventurer", label: "勇敢冒险者", lang: "ko", previewText: "길이 없어도 괜찮아. 내가 앞장설게." },
  { id: "Korean_BraveFemaleWarrior", label: "勇敢女战士", lang: "ko", previewText: "물러서지 마. 오늘은 우리가 이긴다." },
  { id: "Korean_BraveYouth", label: "勇敢青年", lang: "ko", previewText: "무서워도 가보자. 같이 가면 돼." },
  { id: "Korean_CalmGentleman", label: "沉稳绅士", lang: "ko", previewText: "천천히 하세요. 제가 기다릴게요." },
  { id: "Korean_CalmLady", label: "平静女士", lang: "ko", previewText: "숨 고르세요. 서두를 필요 없어요." },
  { id: "Korean_CaringWoman", label: "体贴女性", lang: "ko", previewText: "힘들었지? 오늘은 내가 옆에 있을게." },
  { id: "Korean_CharmingElderSister", label: "迷人姐姐", lang: "ko", previewText: "왜, 또 나한테 기대고 싶어졌어?" },
  { id: "Korean_CharmingSister", label: "迷人姐姐", lang: "ko", previewText: "여기 앉아. 내가 차 한잔 따라줄게." },
  { id: "Korean_CheerfulBoyfriend", label: "开朗男友", lang: "ko", previewText: "자기야, 오늘 기분 좋아 보이네." },
  { id: "Korean_CheerfulCoolJunior", label: "开朗学弟", lang: "ko", previewText: "선배! 저 도와드릴까요?" },
  { id: "Korean_CheerfulLittleSister", label: "开朗妹妹", lang: "ko", previewText: "언니는 걱정 마. 내가 있잖아!" },
  { id: "Korean_ChildhoodFriendGirl", label: "青梅竹马", lang: "ko", previewText: "우리, 어릴 때부터 이렇게 왔잖아." },
  { id: "Korean_CockyGuy", label: "自负小伙", lang: "ko", previewText: "이건 나한테 식은 죽 먹기지." },
  { id: "Korean_ColdGirl", label: "冷淡少女", lang: "ko", previewText: "상관없어. 네 마음대로 해." },
  { id: "Korean_ColdYoungMan", label: "冷淡青年", lang: "ko", previewText: "말 섞기 싫어. 그냥 가자." },
  { id: "Korean_ConfidentBoss", label: "自信上司", lang: "ko", previewText: "결정은 내가 한다. 바로 진행해." },
  { id: "Korean_ConsiderateSenior", label: "体贴前辈", lang: "ko", previewText: "막히면 말해. 내가 알려줄게." },
  { id: "Korean_DecisiveQueen", label: "果断女王", lang: "ko", previewText: "됐어. 이제부터는 내 방식대로." },
  { id: "Korean_DominantMan", label: "强势男士", lang: "ko", previewText: "변명은 됐어. 결과만 가져와." },
  { id: "Korean_ElegantPrincess", label: "优雅公主", lang: "ko", previewText: "오늘 밤은, 잠시만 함께해 주시겠어요?" },
  { id: "Korean_EnchantingSister", label: "魅惑姐姐", lang: "ko", previewText: "그렇게 쳐다보면… 책임져야 할걸." },
  { id: "Korean_EnthusiasticTeen", label: "热情少年", lang: "ko", previewText: "야, 이거 진짜 대박이야! 같이 가자!" },
  { id: "Korean_FriendlyBigSister", label: "友善姐姐", lang: "ko", previewText: "괜찮아, 언니가 도와줄게." },
  { id: "Korean_GentleBoss", label: "温和上司", lang: "ko", previewText: "천천히 해도 돼. 내가 책임질게." },
  { id: "Korean_GentleWoman", label: "温和女性", lang: "ko", previewText: "괜찮아요. 우리 천천히 이야기해요." },
  { id: "Korean_HaughtyLady", label: "高傲女士", lang: "ko", previewText: "나랑 비교하지 마. 원래 달라." },
  { id: "Korean_InnocentBoy", label: "天真男孩", lang: "ko", previewText: "이거 뭐야? 나도 해봐도 돼?" },
  { id: "Korean_IntellectualMan", label: "知性男士", lang: "ko", previewText: "핵심만 보면, 답은 생각보다 간단해." },
  { id: "Korean_IntellectualSenior", label: "知性长辈", lang: "ko", previewText: "급할 것 없다. 이미 가까이 있어." },
  { id: "Korean_LonelyWarrior", label: "孤独战士", lang: "ko", previewText: "혼자여도 괜찮아. 나는 버틸 수 있어." },
  { id: "Korean_MatureLady", label: "成熟女士", lang: "ko", previewText: "어떤 말은, 굳이 꺼내지 않아도 돼." },
  { id: "Korean_MysteriousGirl", label: "神秘少女", lang: "ko", previewText: "쉿… 이건 너만 알아." },
  { id: "Korean_OptimisticYouth", label: "乐观青年", lang: "ko", previewText: "괜찮아! 분명 잘 될 거야." },
  { id: "Korean_PlayboyCharmer", label: "花花公子", lang: "ko", previewText: "오늘 밤, 나랑 한잔할래?" },
  { id: "Korean_PossessiveMan", label: "占有欲男士", lang: "ko", previewText: "넌 내 거야. 다른 데 가지 마." },
  { id: "Korean_QuirkyGirl", label: "古灵精怪少女", lang: "ko", previewText: "나 미친 아이디어 있어. 믿어봐." },
  { id: "Korean_ReliableSister", label: "可靠姐姐", lang: "ko", previewText: "나한테 맡겨. 언니가 해결할게." },
  { id: "Korean_ReliableYouth", label: "可靠青年", lang: "ko", previewText: "걱정 마. 내가 책임질게." },
  { id: "Korean_SassyGirl", label: "泼辣少女", lang: "ko", previewText: "뭐? 다시 말해봐. 내가 참아줄 줄 알아?" },
  { id: "Korean_ShyGirl", label: "害羞少女", lang: "ko", previewText: "그… 그냥, 고마워서 말하려고." },
  { id: "Korean_SoothingLady", label: "安抚女士", lang: "ko", previewText: "울지 마. 다 지나갈 거야." },
  { id: "Korean_StrictBoss", label: "严厉上司", lang: "ko", previewText: "정신 차려. 다시 해. 지금 당장." },
  { id: "Korean_SweetGirl", label: "甜美少女", lang: "ko", previewText: "오늘 날씨 진짜 좋다. 기분도 좋아." },
  { id: "Korean_ThoughtfulWoman", label: "体贴女性", lang: "ko", previewText: "힘들면 기대. 내가 여기 있으니까." },
  { id: "Korean_WiseElf", label: "睿智精灵", lang: "ko", previewText: "서두르지 마. 숲은 답을 알고 있어." },
  { id: "Korean_WiseTeacher", label: "睿智老师", lang: "ko", previewText: "질문은 좋아. 같이 생각해 보자." },
];

export function getAudioVoicesForModel(modelId?: string): AudioVoiceOption[] {
  if (!modelId) return [];
  if (modelId === "qwen/qwen-audio-3.0-tts-plus") return QWEN_VOICES;
  if (modelId === "minimax/speech-2.8-hd") return MINIMAX_VOICES;
  return [];
}

export function getAudioVoiceLangsForModel(modelId?: string) {
  const voices = getAudioVoicesForModel(modelId);
  const langs = new Set(voices.map((voice) => voice.lang));
  return AUDIO_VOICE_LANGS.filter((lang) => langs.has(lang.value));
}

export function getDefaultAudioVoiceId(modelId?: string): string | undefined {
  return getAudioVoicesForModel(modelId)[0]?.id;
}

export function normalizeAudioVoiceForModel(modelId: string | undefined, voiceId: string | undefined): string | undefined {
  const voices = getAudioVoicesForModel(modelId);
  if (voices.length === 0) return undefined;
  if (voiceId && voices.some((voice) => voice.id === voiceId)) return voiceId;
  return voices[0].id;
}

export function getAudioVoiceLabel(modelId: string | undefined, voiceId: string | undefined): string {
  const voices = getAudioVoicesForModel(modelId);
  return voices.find((voice) => voice.id === voiceId)?.label ?? "";
}

export function getAudioVoiceLang(modelId: string | undefined, voiceId: string | undefined): AudioVoiceLang {
  const voices = getAudioVoicesForModel(modelId);
  return voices.find((voice) => voice.id === voiceId)?.lang ?? getAudioVoiceLangsForModel(modelId)[0]?.value ?? "zh";
}

export function isAudioVoiceSelectable(modelId?: string) {
  return getAudioVoicesForModel(modelId).length > 0;
}
