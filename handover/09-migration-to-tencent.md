# 杩佺Щ锛氶┈鏉?鈫?鑵捐浜戞柊鍔犲潯锛堣繘琛屼腑锛?
Last updated: 2026-07-10 China time. 鐘舵€侊細**闃舵1 宸插畬鎴愶紙骞冲彴宸插湪鑵捐閮ㄧ讲璺戦€氾級锛岀敤鎴锋鍦ㄦ祴璇曘€傞樁娈?/3/4 鏈紑濮嬨€?*

涓嬩竴涓?AI锛氭湰鏂囦欢鏄繖娆℃湇鍔″櫒杩佺Щ鐨?*鏉冨▉璁板綍**锛屽厛璇诲畠鍐嶅姩鎵嬨€傚洖澶嶉鏍硷細绠€娲佺洿鎺ヤ腑鏂囥€?
---

## 涓€銆佷负浠€涔堣縼绉?
- 鐜颁富鏈嶅姟鍣ㄥ湪**椹潵 BytePlus `101.47.19.109`**锛岃窇 Next.js/API/PostgreSQL/濯掍綋銆傜敤鎴峰叏璧伴樋閲屽叆鍙?`ali.venusface.com` 鍙嶄唬椹潵銆?- **椹潵鈫旈樋閲岃法澧冨叕缃戦摼璺暱鏈?20~50% 涓㈠寘**锛堣 02-architecture "璺ㄥ閾捐矾鏄湰鏋舵瀯鐨勫浐鏈夎蒋鑲?锛夛紝鏄叏绔欏崱/涓婁紶鎱?鐏板睆鐨勬€绘牴婧愩€侭BR/nginx 鍙不鏍囥€?- 鏈?session 瀹炴祴涓嬭浇閫熷害锛?*椹潵(main.venusface.com=101.47.19.109) ~0.07 MB/s銆佸欢杩?351ms**锛?*鑵捐浜戞柊鍔犲潯 `119.28.116.16` ~2.27 MB/s銆佸揩绾?32 鍊?*銆?- **鐢ㄦ埛鍐冲畾锛氭妸涓绘湇鍔″櫒浠庨┈鏉?BytePlus 杩佸埌鑵捐浜戞柊鍔犲潯 `119.28.116.16`锛岄┈鏉ラ偅鍙板純鐢ㄣ€傞樋閲屼繚鐣欙紝浣嗙敱"闃块噷闀滃儚椹潵"鏀规垚"闃块噷闀滃儚鑵捐鏂板姞鍧?銆?*

## 浜屻€佺‖绾︽潫锛堝姟蹇呴伒瀹堬級

- 鑵捐鏂板姞鍧¤繖鍙板拰闃块噷閭ｅ彴涓婇兘**杩樿窇鐫€鍏跺畠椤圭洰锛岀粷涓嶈兘褰卞搷**銆?- 鑵捐杩欏彴鏄?*绾?Docker 涓绘満**锛屽叾瀹冮」鐩細
  - `/opt/PS-`锛圕inematicFlow锛夛細瀹瑰櫒 `ps--frontend`(瀹夸富 3000)銆乣ps--backend`(8001)銆乣ps--db`(postgres 5432)銆?  - `/home/ubuntu/VibeSocial`锛歚vibesocial-nginx`(瀹夸富 **80**)銆乣vibesocial-backend`(8000)銆乵inio銆乸ostgres銆?  - 鍚勬湁鐙珛 docker 缃戠粶 `ps-_default`銆乣vibesocial_default`銆?- 瀹夸富鏈轰笂**娌℃湁** nginx/node/pm2/ffmpeg/psql锛堝叏鍦ㄥ悇鑷鍣ㄩ噷锛夈€?0/3000/5432/8000/8001 绔彛宸茶鍗犮€?- 鑵捐**瀹夊叏缁?*锛堣吘璁簯鎺у埗鍙板眰锛孲SH 鏀逛笉浜嗭紝鎴戜滑**娌℃湁鑵捐浜?API 瀵嗛挜**锛夛細鍘熸湰鍙斁琛?22/80/3000/8001锛?*鐢ㄦ埛鍚庢潵涓撻棬涓烘湰椤圭洰寮€浜?5000**銆倁fw 鏈惎鐢ㄣ€?
## 涓夈€佸垎闃舵璁″垝锛堢敤鎴峰凡纭锛?
1. **闃舵1锝滃湪鑵捐鎶婂钩鍙版灦璧锋潵锛岀敤 IP+绔彛娴嬭瘯**锛堜笉纰板煙鍚嶃€佷笉纰伴樋閲屻€佷笉纰伴┈鏉ワ級銆傞噸鐐癸細妯″瀷涓?403 + 鐢熸垚/涓婁紶/鐧诲綍鍏ㄨ窇閫氥€傗啇 **宸插畬鎴愶紝鐢ㄦ埛娴嬭瘯涓?*
2. **闃舵2锝滄壘涓閲屾病浜烘椂鎺ラ樋閲?+ 鍋滄湇**锛氳繛閫氳吘璁啍闃块噷锛屾寕缁存姢鍋滄湇锛堢敤鎴锋殏涓嶈兘璁块棶锛夈€?3. **闃舵3锝滄暟鎹縼绉?*锛氶┈鏉?PostgreSQL + `/generated` 濯掍綋杩佸埌鑵捐锛涢樋閲屽弽浠ｇ洰鏍囬┈鏉?IP鈫掕吘璁?IP锛涢獙鏀跺悗鏀惧紑璁块棶銆?4. **闃舵4锝滄敹灏?*锛氳瀵熷嚑澶╋紝璋冩暣/寮€鍚?ali-sync 鏂瑰悜锛岀ǔ瀹氬悗姝ｅ紡寮冪敤椹潵锛涙洿鏂颁氦鎺ユ枃妗ｃ€?
## 鍥涖€佽吘璁柊鍔犲潯鏈嶅姟鍣ㄤ俊鎭?
- IP `119.28.116.16`锛孶buntu 24.04锛岀敤鎴?`ubuntu`锛?*鍏嶅瘑 sudo**銆?- 瀵嗛挜锛歚E:\project\銆?銆憇erver\鑵捐浜慱鏂板姞鍧℃湇鍔″櫒\CinematicFlow.pem`銆傚湴鍧€鏂囦欢鍚岀洰褰?`鑵捐浜慱鏂板姞鍧℃湇鍔″櫒鍦板潃.txt`銆?- **Windows 鏉冮檺鍧?*锛歱em 鏉冮檺澶紑鏀撅紝ssh 鎷掔敤銆傚厛澶嶅埗鍒颁复鏃剁洰褰曞啀閿佹潈闄愶細
  `Copy-Item` 鍒?`C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem`锛沗icacls <copy> /inheritance:r`锛沗icacls <copy> /grant:r "ASUS:(R)"`銆備箣鍚庣敤杩欎釜鍓湰 ssh/scp銆?- 鐧诲綍锛歚ssh -i "<涓存椂鍓湰>" ubuntu@119.28.116.16`銆?- 璧勬簮锛? 鏍?/ 7.4G 鍐呭瓨 / 纾佺洏 197G锛堥儴缃插悗鐢?~96G銆佸墿 ~94G锛夈€?- **China鈫掓柊鍔犲潯涓婁紶寰堟參锛堝疄娴?~68KB/s锛夛紝澶ф枃浠?scp 浼氳秴鏃?*銆傚绛栵細婧愮爜鍖呮帓闄ゅぇ鐩綍锛坣ode_modules/.next/public/generated/public/home-assets 澶ц棰戯級锛屽帇鍒?<1MB锛涙垨璧伴┈鏉ヤ腑杞紙椹潵鈫旀柊鍔犲潯鏁版嵁涓績蹇級銆?
## 浜斻€侀樁娈? 宸插仛鐨勪簨锛堥儴缃插叏鏅級

### 鍘?鐣欏喅绛栫偣锛堝凡閫氳繃锛?鑵捐鏂板姞鍧″疄娴嬭皟妯″瀷**鏃犲湴鍖哄皝閿?*锛歄penRouter `/models` 200銆乣seed-2.0-lite` 瀵硅瘽 200銆乣gpt-5.4-image-2` 浠呭弬鏁?400锛堣兘鍒?OpenAI銆侀潪 403锛夈€丅ytePlus ark 200銆傝縼绉绘柟妗堟垚绔嬨€?
### 閮ㄧ讲鏂瑰紡锛氭柟妗?A锛堝畬鍏ㄩ殧绂荤殑鐙珛 Docker 鏍堬級
- 浣嶇疆 `/opt/flashmuse/`锛歚app/`(婧愮爜锛屽惈 Dockerfile) + `docker-compose.yml` + `data/{.env.local, generated, runtime, pgdata, home-assets}`銆?- **浠撳簱鏂板鏂囦欢**锛堟湰鍦?`E:\project\FlashMuse_Agent`锛屾湭 commit锛夛細`Dockerfile`銆乣.dockerignore`銆乣docker-entrypoint.sh`銆?  - Dockerfile锛歚node:22-bookworm-slim`锛岃 `rsync openssh-client`锛堜緵闃舵3 ali-sync锛夛紝`COPY package*.json + patches` 鍚?`npm install`锛堣Е鍙?postinstall patch-package 閲嶆墦 tldraw license patch锛夛紝`COPY . .`锛宍npx prisma generate`锛宍npm run build`銆俠uild arg `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=true`锛堝伐浣滄祦淇濇寔寮€锛夈€?  - `.dockerignore` 鎺掗櫎 node_modules/.next/.git/.runtime/public/generated/public/home-assets/.env*/handover/planning 绛夈€?  - `docker-entrypoint.sh`锛歚npx prisma migrate deploy` 鍚?`exec npm run start`锛坣ext start锛孭ORT=3000锛夈€?- `docker-compose.yml`锛堝湪 `/opt/flashmuse/`锛屾湰鍦颁复鏃跺壇鏈湪 opencode temp锛夛細
  - `name: flashmuse`锛岀綉缁?`flashmuse_default`锛堜笌鍏跺畠椤圭洰闅旂锛夈€?  - `flashmuse-db`锛歚postgres:16-alpine`锛?*涓嶆毚闇插涓荤鍙?*锛堝彧鍦?compose 鍐呯綉锛屽交搴曢伩寮€宸插崰鐨?5432锛夛紝鏁版嵁鍗?`/opt/flashmuse/data/pgdata`銆?  - `flashmuse-app`锛歜uild `./app`锛?*绔彛 `5000:3000`**锛屽嵎鎸?`.env.local`(鍙啓)銆乣generated`銆乣runtime`(=.runtime)銆乣home-assets`銆傜幆澧?`DATABASE_URL` 鎸囧悜 `flashmuse-db`銆?  - **DB 瀵嗙爜**锛氶殢鏈虹敓鎴愶紝鍚屾椂鍐欏湪 `docker-compose.yml` 涓?`data/.env.local` 鐨?DATABASE_URL 閲屻€?- **`.env.local` 鐢遍┈鏉?prod `/var/www/flashmuse/.env.local` 娲剧敓**锛堜繚璇?API key/妯″瀷鍋忓ソ/涓婁紶瑙勫垯鍜岀嚎涓婁竴鑷达級锛屾敼鍔細DATABASE_URL鈫掑鍣ㄥ簱銆佸垹 `AUTH_COOKIE_DOMAIN`銆乣FORCE_INSECURE_AUTH_COOKIE=true`銆乣ALI_SYNC_GENERATED_ENABLED=false`銆?*AUTH_SECRET 淇濇寔涓庨┈鏉ヤ竴鑷?*锛堥樁娈?杩佹暟鎹悗鑰佷細璇濅粛鏈夋晥锛夈€?  - 鈿狅笍 **`.env.local` 鏄彲鍙樼姸鎬佷笉鍙槸閰嶇疆**锛氬悗鍙?妯″瀷寮€鍏?绯荤粺璁剧疆/涓婁紶瑙勫垯"淇濆瓨浼?*鏀瑰啓璇ユ枃浠?*锛孉PI key 杩愯鏃朵篃浠庤鏂囦欢璇伙紙`getLocalEnvValue`锛夈€傛墍浠ュ畠鏄?bind-mount 鐨勫彲鍐欐枃浠讹紝閲嶅惎/閲嶅缓涓嶄涪銆?- 鏁版嵁搴擄細**鍏ㄦ柊绌哄簱**锛屾墍鏈?Prisma 杩佺Щ宸?apply锛堝惈 `20260710000000_generation_job_name_reservations`锛夈€倃orker 宸插惎鍔ㄣ€?- **home-assets**锛氶椤靛彧鐢?lite 閭ｅ + logo + 澶囨鍥撅紙鍏?~7MB锛夛紝宸蹭紶 `/opt/flashmuse/data/home-assets` 骞舵寕杞斤紱**澶х殑鍘熷 hero 瑙嗛锛垀110MB锛夋寜鐢ㄦ埛瑕佹眰涓嶈浜?*銆?- **next.config.ts 鏀瑰姩锛堝敮涓€涓庨┈鏉ヤ笉鍚岀殑婧愮爜锛?*锛氱粰 `/home-assets/:path*` 鍜?`/generated/:path*` 鍔?`Cache-Control: public, max-age=31536000, immutable`銆備慨澶?棣栭〉鍒囪棰戦粦闂?鈥斺€旀牴鍥犳槸 Next 瀵?public 榛樿 `max-age=0`锛屾瘡娆″垏瑙嗛 video 鍏冪礌閲嶆寕閮借**璺ㄥ鍥炴柊鍔犲潯楠岃瘉涓€娆?*鎵嶆樉绀猴紝绌烘。闇查粦搴曪紱椹潵/闃块噷鏄?nginx 缁欎簡闀跨紦瀛樹笉鍥炴簮鎵€浠ヤ笉闂€傛鏀瑰姩鍚屾鍥為┈鏉?闃块噷涔熸湁鐩婃棤瀹炽€?
### 浠ｇ爜涓€鑷存€ф牳瀵癸紙閲嶈缁撹锛?瀵归┈鏉?`/var/www/flashmuse` 涓庢湰鍦伴儴缃叉爲鍋氫簡 md5 娓呭崟瀵规瘮锛?*194 涓簮鐮佹枃浠讹紙src/prisma/patches/public/home-assets/package*/instrumentation/tsconfig 绛夛級閫愬瓧鑺備竴鑷达紝鍞竴涓嶅悓鏄?`next.config.ts`锛堜笂闈㈤偅涓紦瀛樻敼杩涳級**銆傗啋 **鑵捐涓婄殑骞冲彴浠ｇ爜 = 椹潵绾夸笂锛屾棤浠ｇ爜婕傜Щ锛屽姛鑳借涓哄簲瀹屽叏涓€鑷淬€?*

### 楠岃瘉 & 璁块棶
- 鏈嶅姟鍣ㄥ唴 `curl localhost:5000`锛歚/`銆乣/workspace`銆乣/admin`銆乣/api/model-availability`銆乣/home-assets/logo.png`銆乣hero-background-lite.mp4` 鍏?200锛涘閮?`http://119.28.116.16:5000` 涔?200銆?- **娴嬭瘯鍦板潃锛堜氦缁欑敤鎴凤級**锛歚http://119.28.116.16:5000`锛堝伐浣滃彴 `/workspace`锛屽悗鍙?`/admin`锛岀鐞嗗憳 `lookxun@163.com` 鏀堕獙璇佺爜鐧诲綍锛夈€?*绌哄簱鍏ㄦ柊瀹炰緥**锛岄渶閭娉ㄥ唽/鐧诲綍娴嬭瘯銆?- 鏇句复鏃剁敤 Cloudflare quick tunnel锛堟湇鍔″櫒鍙嚭绔欍€佷笉寮€鍏ョ珯绔彛锛夌粰杩囦竴涓?https 娴嬭瘯缃戝潃锛?000 寮€閫氬悗宸插仠鎺夐毀閬撱€?
## 鍏€侀樁娈? 鏈夋剰淇濈暀鐨勫樊寮傦紙涓嶆槸 bug锛岄樁娈?/3鍒囨崲鏃惰鏀瑰洖锛?
1. `NEXT_PUBLIC_*` 鏋勫缓鏃剁暀绌猴紙鍙?build arg 浼犱簡 `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=true`锛夆啋 瀹㈡埛绔蛋鍚屾簮锛岄€傚悎 IP 娴嬭瘯銆?*鍒囧煙鍚嶆椂瑕佺敤 venusface 鍊奸噸鏂?build**锛堝苟澶勭悊 `chat-workbench.tsx`/`page.tsx` 閲岀‖缂栫爜鐨勯┈鏉?IP 101.47.19.109銆侀樋閲?IP銆乿enusface 鍩熷悕鍒ゆ柇锛屽姞/鎹㈡垚鑵捐 IP 鎴栨柊 host锛夈€?2. `ALI_SYNC_GENERATED_ENABLED=false`锛堥樁娈?鎺ラ樋閲屽啀寮€锛涢暅鍍忓凡瑁?rsync/ssh锛宬ey 闇€鎸傝繘瀹瑰櫒锛夈€?3. `FORCE_INSECURE_AUTH_COOKIE=true` + 鏃?`AUTH_COOKIE_DOMAIN`锛堝洜鐜板湪 IP+HTTP锛夈€備笂 HTTPS/鍩熷悕鏃舵敼鍥炪€?4. 鍚庡彴"鏈嶅姟鍣ㄤ俊鎭?椤?`server-info/route.ts` 纭紪鐮侀┈鏉?闃块噷 SSH锛屽湪杩欏彴浼氬け鏁堬紙闈炴牳蹇冿級锛屽垏鎹㈠悗鏀广€?5. 棣栭〉澶у昂瀵?hero 瑙嗛鏈紶锛堜笉褰卞搷鍔熻兘锛夈€?6. `NEXT_PUBLIC_PRIMARY_BASE_URL` 鏈嶅姟绔厹搴曚负 `https://main.venusface.com`锛圔ytePlus 鐪熶汉瀹℃牳鎻愪氦鍙傝€冨浘鍏綉 URL 鐢級锛岄樁娈?鎸囧悜椹潵锛屾甯哥敓鎴愪笉鍙楀奖鍝嶏紱鍒囨崲鏃舵敼鎴愯吘璁澶栧湴鍧€銆?
## 涓冦€佷笅涓€涓?AI 鐨勪笅涓€姝ワ紙闃舵2/3锛?
**鍏堢瓑鐢ㄦ埛娴嬭瘯缁撹銆?* 鐢ㄦ埛娴?OK 鍚庯細

**闃舵2锛堝閲岋級**锛氭帴闃块噷 + 鍋滄湇銆傛柟寮忓緟瀹氾紝鍊欓€夛細闃块噷 nginx 鍔犱竴涓弽浠?FlashMuse 鐨?server锛堟寚鍚戣吘璁紝鑵捐瀹夊叏缁勫凡寮€ 5000锛孉li鈫掕吘璁?5000 鍙揪锛夛紱鎴栧厛鎸傜淮鎶ら〉銆?*闃块噷涔熸湁鍏跺畠椤圭洰锛屾敼 nginx 鐢ㄧ嫭绔?conf銆佸埆鍔ㄥ埆浜虹殑銆?* 闃块噷鐧诲綍淇℃伅鍦?`E:\project\銆?銆憇erver\闃块噷鏈嶅姟鍣╘闃块噷鏈嶅姟鍣?txt`锛涗粠椹潵璺抽樋閲岀敤 `/root/.ssh/flashmuse_to_ali_ed25519`銆?
**闃舵3锛堟暟鎹縼绉伙級**锛?- PostgreSQL锛氶┈鏉?`pg_dump` 鈫?鐏屽叆鑵捐 `flashmuse-db`锛堝鍣ㄥ唴搴擄紝鍙?`docker exec` psql 鎴栦复鏃舵毚闇茬鍙ｏ級銆傛敞鎰忛┈鏉?`.env.local` 鏈変袱涓?DATABASE_URL銆佺浜屼釜鐣稿舰锛岀敤绗竴涓紱psql 瑕佸幓鎺?`?schema=`銆?- 濯掍綋锛氶┈鏉?`/var/www/flashmuse/public/generated` rsync 鈫?鑵捐 `/opt/flashmuse/data/generated`锛堥噺澶э紝璧伴┈鏉モ啋鏂板姞鍧★級銆?- 瀹屾暣 home-assets锛堝惈澶ц棰戯紝濡傛灉瑕侊級琛ヤ紶銆?- 闃块噷鍙嶄唬鐩爣锛氶┈鏉?IP 鈫?鑵捐 IP锛涙敼 NEXT_PUBLIC_* 涓哄煙鍚嶅苟閲?build锛涘叧 insecure cookie銆佽鍥?cookie domain锛涘紑 ali-sync锛堟柟鍚戯細鑵捐鈫掗樋閲岋級銆?- 鐢?`.runtime/deploy-checks/prod-deploy-snapshot.mjs` 閭ｅ鎬濊矾鏍稿鏁版嵁瀹屾暣鎬с€?- 椹潵淇濈暀鐑锛岀ǔ瀹氬嚑澶╁啀寮冪敤銆?
## 鍏€佹搷浣滃蹇橈紙韪╄繃鐨勫潙锛?
- Tencent pem 鏉冮檺锛氬厛 `icacls` 閿佹潈闄愬壇鏈啀鐢紙瑙佺鍥涜妭锛夈€?- **PowerShell 涓嶈兘 heredoc / 鍐呰仈澶嶆潅 bash锛坰ed/awk/nested quotes 浼氬穿锛?*锛氭妸鑴氭湰鍐欐垚鏈湴 `.sh` 鈫?`scp` 鈫?`ssh "sed -i 's/\r$//' /tmp/x.sh && bash /tmp/x.sh"`銆?- 鏈嶅姟鍣ㄦ敼 compose锛氭湰鍦版敼涓存椂鍓湰閲嶄紶锛屽埆鐢?ssh 鍐呰仈 sed锛圥owerShell 杞箟浼氬潖锛夈€?- docker 鍛戒护鐢?`sudo docker ...`銆俢ompose 鐗堟湰 v5.1.1銆?- 閲嶅缓 app锛歴cp 鏀瑰姩鏂囦欢鍒?`/opt/flashmuse/app/` 鈫?`cd /opt/flashmuse && sudo docker compose up -d --build flashmuse-app`锛坣pm 灞傛湁缂撳瓨锛屽彧閲嶈窇 build锛夈€傚悗鍙拌窇 `nohup ... >/tmp/log 2>&1 &` 鍐嶈疆璇紝閬垮厤宸ュ叿 120s 瓒呮椂銆?- 鏇炬妸 CinematicFlow.pem 涓存椂鎺ㄥ埌椹潵鍋氫腑杞€佺敤瀹屽凡鍒犮€?

---

## 【2026-07-10 追加，可读】阶段1 补齐 nginx 层（本文件上文是乱码，以本段为准）

问题：阶段1 部署后，用户对话流生成的图片在资产库缩略图一直闪、点开原图空白。

根因：Next.js 
ext start 只服务「构建时就存在」于 public/ 的静态文件。.dockerignore 排除了 public/generated，所以镜像里 /generated 不在 Next 静态清单，运行时即使 bind-mount 了文件，Next 对 /generated/* 一律 404；缩略图能出是因为走 /api/media-thumbnail 路由直接读盘。马来/阿里从没暴露此问题，是因为 /generated 一直由 nginx 服务、不经过 Next；腾讯阶段1 的 Docker 栈只有 app+postgres，没有 nginx —— 这就是"完整独立项目"缺的一块。

修复：给 flashmuse 栈新增 flashmuse-nginx(nginx:alpine) 容器（对齐马来架构）：
- nginx 对外 5000 -> 容器 80；app 改为只 expose 3000（内部），不再直接占 5000。
- nginx /generated/、/home-assets/ 直接 alias 磁盘（bind-mount 只读 /opt/flashmuse/data/generated->/srv/generated、home-assets->/srv/home-assets），其余 location / 反代 http://flashmuse-app:3000。
- 只在 flashmuse_default 网络、只用原有 5000 端口，未碰 ps-/vibesocial。

服务器改动：
- /opt/flashmuse/docker-compose.yml（加 flashmuse-nginx service；app ports->expose）。旧版备份 /opt/flashmuse/docker-compose.yml.bak.*。
- 新增 /opt/flashmuse/data/nginx/flashmuse.conf。
- sudo docker compose up -d 重建（app 无需重 build）。验证：/generated 原图 404->200（localhost + 外网 IP），首页/workspace/logo 全 200，其它项目状态未变。

注意-本地仓库未同步：docker-compose.yml(含 nginx) 与 nginx/flashmuse.conf 目前只在服务器上，本地仓库没有。下一个 AI 待办：把这两个文件补进本地仓库迁移分支，并确保迁移文档明确"栈包含 nginx，负责服务 /generated"，否则将来重建栈会再次漏掉 nginx。

注意-本文件(09)上半部分内容是乱码：写入时编码被破坏。当前可读权威记录见 01-current-status.md 顶部 + 05-next-actions.md 顶部。