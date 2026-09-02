# SPEC — 吃什麼（減脂餐點清單）

## 目標

一個只給自己用的餐點清單，回答「今天可以吃什麼」。
打開第一個畫面就是列表 + 搜尋；新增用一題一題問的彈窗，幾秒內填完。
另外一個「反思」畫面（2026-09-02 從「心得」改名、範圍放寬），用講的或打的把跟能量有關的發現記下來——飲食、訓練、睡眠、情緒都算（之後要濃縮成 pattern 的原料）。表名仍是 `meal_notes`，路徑仍是 `/api/meals/notes`。
放在 dearme 專案底下，網址 `heydearmyself.com/meals`，用同一個 Google 登入。

## 決定（每一條都有為什麼）

### 放哪裡
- **放 dearme，當獨立模組**：`app/api/routes/meals.py`、`app/services/meals.py`、`app/models/meal.py`、`frontend/src/meals/`。
  Dear Me 的四個 tab 不連過去，Dear Me 的畫面一行都不改。
  為什麼：登入、DB、CI 部署全現成；隔離成一包，以後要搬出去整包搬。
- **網址 `/meals`**：`main.jsx` 看 `location.pathname`，`/meals` 開頭就渲染 `MealsApp`，其他照舊渲染 `App`。
  為什麼：專案沒裝 react-router，只有一條新路徑，不值得為它加套件。後端要加一條 `GET /meals` 回 `index.html`（`StaticFiles(html=True)` 只對 `/` 回 index），API 放在 `/api/meals` 才不會跟頁面同路徑打架。
- **登入**：沿用 Firebase，每筆餐點用 `user_id` 隔離。沒登入時 `/meals` 只顯示一顆「用 Google 登入」按鈕。
  為什麼：後端所有 route 都靠 `CurrentUid`，照規則走最省事，而且別人登進來也只看得到自己的。

### 資料模型（`meals` 表，一支 alembic migration）
| 欄位 | 型別 | 值 | 備註 |
|---|---|---|---|
| id | int PK | | |
| user_id | str(128) index | | Firebase uid |
| name | str(200) | 必填、去頭尾空白、不可空 | |
| category | str(64) | `breakfast` / `meal` / `snack`，**複選**（2026-09-02 改）| 早餐 / 正餐 / 點心；存成 `,breakfast,meal,`，至少一個；API 收/回 `categories` 陣列，`category=` 篩選含有就算 |
| source | str | `eat_out` / `home_cooked` | 外食 / 自己煮 |
| season | str | `summer` / `winter` / `all` | 夏 / 冬 / 四季 |
| method | str, nullable | `stir_fry` / `air_fryer` / `rice_cooker` / `microwave` | 炒 / 氣炸鍋 / 電鍋 / 微波爐；只有自己煮才有 |
| recipe | text, nullable | 自由文字 | 食材和步驟自己換行寫 |
| note | text, nullable | 自由文字 | 想寫熱量就寫這裡 |
| rating | int, nullable | 1–10 | 幾顆星；選填（2026-09-02 加） |
| place_id / place_name / address / phone / lat / lng / maps_url | nullable | 外食店家（Google Places） | 只有外食才有；自煮一律清空。彈窗打店名 → Google 建議 → 點一下全部填好（2026-09-02 加） |
| video_url | text, nullable | http(s) 網址 | 影片連結（IG／YouTube）；卡片「▶ 看影片」。只存連結、不抓內容（2026-09-02 決定：IG 沒有 API，抓 caption 靠縫、機房 IP 常被擋，先不做） |
| price | int, nullable | 1 / 2 / 3 | 外食價位：`$` 300 內／`$$` 400–600／`$$$` 800 以上；只有外食，自煮清空；貼連結時用 Google 的 priceLevel 當預設（2026-09-02 加） |
| proteins | str(64), nullable | `beef` / `pork` / `chicken` / `seafood`，複選 | 牛／豬／雞／海鮮；存成 `,beef,chicken,`（前後都有逗號，篩選用 `LIKE '%,chicken,%'`）；API 收/回陣列（2026-09-02 加） |
| kind | str(64), nullable | 自由文字 | 「類型」：火鍋、牛排、海鮮、超商…自己打，選填（2026-09-02 加）。列表可「依類型看」 |
| created_at / updated_at | tz datetime | | |

- 列舉值存英文代碼、畫面顯示中文。為什麼：DB 和 API 不綁語言，之後改文案不用動資料。
- 有「四季」。為什麼：水煮蛋這種東西不該被迫選夏或冬，搜「夏天」時它要出現。
- 食譜一個文字欄。為什麼：唯一使用者，拆食材表/步驟表只會讓輸入變慢。
- 不記熱量／營養素。為什麼：這版需求是「知道可以吃什麼」；之後要做的話用 migration 加欄位即可。
- 一律 hard delete。為什麼：自己的清單，沒有「復原」需求，少一個 `deleted_at` 就少一個每次查詢都要記得加的條件。

### 心得（`meal_notes` 表，同一支 migration）
| 欄位 | 型別 | 備註 |
|---|---|---|
| id | int PK | |
| user_id | str(128) index | |
| text | text | 必填、去頭尾空白、不可空 |
| created_at | tz datetime, index | 新到舊列出 |

- **不綁餐點**。為什麼：「吃油的飽足感很久」「早上不想吃燕麥是因為不香不油」都不屬於哪一道菜；硬綁只會讓輸入多一步。
- **存原話、不改寫**。為什麼：這是之後濃縮 pattern 的原料，原料要是你講的，不是模型潤過的。
- **不做濃縮**（這版）。為什麼：濃縮要有夠多條才有意義；先把收集做順。之後做法和 Dear Me 一樣：按一顆「整理」→ 一次 LLM → 存成 pattern 列表。
- 只有新增、列出、刪除，沒有編輯。為什麼：講錯了就刪掉重講，比在手機上改字快。

### 規則（寫在 service 層，API 只轉 HTTP 狀態）
- `name` 空白 → 拒絕（422）。
- `category` / `source` / `season` / `method` 不在清單內 → 拒絕（422）。
- `source = home_cooked` 而 `method` 是空的 → 拒絕（422）。為什麼：自己煮一定有煮法，這是你要搜的維度。
- `video_url` 有給就必須以 `http://` 或 `https://` 開頭，否則 422；去頭尾空白；空字串存 null。
- `rating` 有給就必須是 1–10 的整數，否則 422；沒給存 null。為什麼：選填，沒吃過的還不能評。
- `source = home_cooked` → 店家七個欄位一律清空。為什麼：自己煮沒有店。
- `source = eat_out` → `method` 和 `recipe` 一律清空存 null，就算送了也丟掉。為什麼：外食沒有煮法；不清掉的話搜「氣炸鍋」會撈到外食。
- 讀、改、刪都同時比對 `id` 和 `user_id`，別人的餐點一律 404（和不存在同一個答案）。為什麼：照 mantras 的做法，猜 id 猜不到別人的東西。

### API（prefix `/api/meals`，全部要登入）
- `GET /api/meals?q=&category=&source=&season=&method=&kind=&protein=`（`protein` 單一代碼，含有就算；`price=1|2|3`） → `{"meals":[...]}`，新到舊。`kind` 精確比對。
- `GET /api/meals?near=25.04,121.56` → 有座標的外食依直線距離近到遠排在前面、每筆多 `distance_m`；沒座標的照舊排在後面。座標格式錯 → 422。
- `POST /api/meals/search` body 可帶 `near`，同上。句子裡有「附近／最近／現在」→ 模型把 source 設成 eat_out。
- `GET /api/meals/kinds?source=` → `{"kinds":[{"kind":"火鍋","count":3},...]}`，多到少；沒填類型的不算；`source=eat_out` 只算外食。
  `q` 對 `name` / `recipe` / `note` / `kind` 做不分大小寫的子字串比對；篩選條件是 AND；`season=summer` 會同時撈 `summer` 和 `all`（`winter` 同理）。
- `POST /api/meals` → 201 + 那筆。
- `PATCH /api/meals/{id}` → 整筆更新（送完整欄位），200 + 那筆。為什麼：編輯走同一個彈窗、每次都有完整答案，不需要部分更新。
- `DELETE /api/meals/{id}` → `{"deleted": id}`。
- `GET /api/meals/notes` → `{"notes":[...]}` 新到舊；`POST /api/meals/notes` body `{"text"}` → 201；`DELETE /api/meals/notes/{id}`。空白 → 422；別人的 → 404。
  notes 的路由放在 `/{id}` 之前：現在沒有 GET `/meals/{id}` 所以不會撞，放前面是防以後加了會吃掉 `notes`。
- 語音轉文字沿用現有的 `POST /transcribe`（不新增後端）。
- `POST /api/meals/search` body `{"text": "夏天自己煮的點心 用氣炸鍋"}` →
  `{"filters": {"q":..., "category":..., "source":..., "season":..., "method":...}, "meals":[...], "fallback": false}`。
  LLM（dearme 的 worker 模型 + structured output）只做一件事：把句子翻成上面那組篩選條件；然後走和 `GET /meals` 完全同一個查詢。
  LLM 失敗或逾時 → `filters = {"q": 原句}`、`fallback: true`，照樣回列表。
  為什麼：便宜、快、可測（mock 掉模型就能測）；結果永遠是你自己資料的子集合，不會亂編。

### 畫面（`frontend/src/meals/`，繁中／英文可切換）
- **語言**（2026-09-02 加）：右上角「EN／中」切換，存在 localStorage `meals.lang`，預設跟瀏覽器語言（中文語系→中文）。所有字串在 `i18n.js` 一個字典；選項和題目的中英在 `flow.js` 的 `OPTIONS` / `STEPS`。測試檢查每個 key 兩種語言都有。Google Places 的建議語言跟著介面。
- **列表頁（第一個畫面）**：頂端搜尋框 + 「用問的」切換；下面四組篩選標籤（分類 / 來源 / 季節 / 煮法）；卡片列出名稱、四個標籤、食譜與備註（有才顯示）；每張卡有「編輯」「刪除」。
  「用問的」模式：送 `POST /api/meals/search`，把回來的 `filters` 直接套成標籤（你看得到它理解成什麼，可以再點掉）；`fallback` 時顯示一行「沒問到 AI，用關鍵字搜」。
- **哪家店？**（外食才問）：打店名，Google Places 自動完成列建議；點一下店名／地址／電話／座標／Maps 連結全填好；也可跳過。金鑰是瀏覽器金鑰、限 heydearmyself.com 和 localhost。
- **離我最近**：列表一顆鈕，按了要瀏覽器定位 → 重新載入帶 `near` → 有座標的店卡片顯示公尺／公里和「導航」（開 Google Maps）。定位被拒就提示一行。
- **GO**（2026-09-02 加）：主畫面右上一顆醒目的 GO。按下 → 先選「1 按距離／2 按分類」（數字鍵可用）。按距離：定位、列表切成 外食＋離我最近，近到遠。按分類：列出外食用過的類型 → 點一個 → 外食＋那一類（不強制定位，「離我最近」鈕仍可按）。用 `GET /api/meals/kinds?source=eat_out`。
- **新增 → 餐點／餐廳**（2026-09-02 加）：按「＋ 新增」先選。餐點＝原本的問答。餐廳＝貼一個 Google Maps 分享連結（`maps.app.goo.gl/…` 或長網址）→ `POST /api/meals/resolve-link {url}` → 後端跟著轉址、從網址取出「地址＋店名」文字（`q=`／`/place/<名>`）→ Places 文字搜尋 → 回店家七欄 + `kind_hint`（Google 的主要類型，如「速食餐廳」）→ 畫面預覽 → 按「新增」以 外食／正餐／四季／類型=kind_hint 建立，之後可編輯。伺服器金鑰 `PLACES_SERVER_KEY`（Secret Manager，只限 Places API）。
- **依類型看**：列表頁多一個檢視切換「全部 / 依類型」。依類型先列每個類型和數量，點一個就變成那類的列表（上面有一顆「← 全部類型」）。
- **刪除**：按下後那張卡變成「確定刪除？／取消」兩顆鈕，不用瀏覽器 confirm。為什麼：瀏覽器 confirm 會擋住自動化測試，也不好看。
- **心得頁**：`MealsApp` 上方兩個切換「餐點」「心得」，預設「餐點」。
  心得頁：一個文字框 + 麥克風鈕（沿用 `speech.js` 的 `useRecorder` / `transcribe`，轉好的字接在框裡讓你看過再送）+「記下來」；下面新到舊列出每一條，附日期和「刪除」（同樣兩段確認）。
  為什麼轉完先進文字框不直接送：語音辨識會錯字，這些字之後要拿去濃縮，錯的原料會出錯的 pattern。
- **新增／編輯彈窗（typeform 式）**：一次一題，順序 名稱 → 類型（選填，列出用過的可點）→ 肉類（複選、選填、數字鍵切換）→ 分類 → … → 哪家店？（外食）→ 價位（外食、選填）→ 外食/自己煮 → 季節 → 煮法（外食跳過）→ 食譜（外食跳過）→ 幾顆星（選填，數字鍵 1–9，0 = 10）→ 影片連結（選填）→ 備註（可按麥克風用講的，轉好的字接在框裡看過再送）。卡片上顯示 ★ 和分數。
  Enter 下一題、Esc 關閉、選項題可按數字鍵 1-4；上方有進度點，編輯時預先填好、點進度點可直接跳題。
  最後一題送出；失敗就留在彈窗並顯示錯誤。
- **純邏輯抽到 `frontend/src/meals/flow.js`**：`visibleSteps(answers)`（外食就沒有煮法/食譜兩題）、`toQuery(filters)`（篩選條件 → query string，空值不帶）、`labelOf(field, code)`（代碼 → 中文）。
  為什麼：這三個是會出錯的地方，而且不用畫面就能測。
- 樣式獨立一個 `meals.css`，沿用 `index.css` 的色票變數；不動 `App.css`。

### 測試
- 後端 `tests/test_meals.py`（service）：CRUD、外食清空煮法、自己煮沒煮法被拒、跨 user 隔離、每個篩選條件、季節含四季、關鍵字比對三個欄位。
- 後端 `tests/test_meals_api.py`（route）：422 的每一種、404 別人的、`/meals/search` 用 mock 模型回條件、模型丟例外時 fallback。
- 後端 `tests/test_meal_notes.py`：新增去空白、空白被拒、新到舊、跨 user 隔離、刪別人的 False；route 層 `notes` 不被吃成 `/meals/{id}`。
- 前端 `frontend/src/meals/flow.test.js`（vitest）：`visibleSteps` 外食/自煮兩條路、`toQuery` 空值不帶、`labelOf` 未知代碼原樣回傳。
- CI 加一步 `npm test`。

### 之後要做的（這版不做，但 schema 先讓路）
- **一週規劃 + 拖拉**：另開 `plan_slots` 表（`user_id`, `date`, `slot` = breakfast/lunch/dinner/snack, `meal_id` FK → meals）。餐點是目錄、計畫是指標；拖拉只是改那筆的 `date`/`slot`。所以 `meals` 表**不放日期**、category 的 `meal` 同時給午餐和晚餐用。
- **濃縮心得成 pattern**：`meal_notes` 全部送一次 LLM → 存到新表 `meal_patterns`；心得原文永遠留著。
- **熱量／營養素目標**：到時在 `meals` 加 `calories` / `protein` / `carbs` / `fat` 欄位（一支 migration），目標存在使用者設定，每日加總在 `plan_slots` 那邊算。

### 餐點／食譜分頁（2026-09-02 改）
- 五個切換：今天／餐點／食譜／反思／採買。**餐點**＝`source=eat_out`，**食譜**＝`source=home_cooked`，各自固定，不再顯示外食／自煮標籤與篩選。
- 煮法（炒／氣炸鍋／電鍋／微波爐）只在食譜頁出現（篩選與卡片標籤）；GO、離我最近、餐廳貼連結只在餐點頁。
- 新增時不再問「外食還是自己煮」：由所在頁決定（`fixedSource`），問答少一題。資料模型不變。

### 今天（第一頁，2026-09-02 加）
- 三個切換：**今天**（預設）／餐點／反思。
- **目標 Goal**：一段自己寫的文字，點一下就能改，Enter 或離開就存（`goals` 表，每人一筆）。
- **每日清單**：`habits`（user_id / text / position）；打勾＝今天完成，存在 `habit_checks(habit_id, day)`（台灣日期，一天一筆），隔天自動歸零、歷史留著。可新增、改字、刪除（兩段確認）。
- **預設五項**：清單是空的時候給一顆「加入預設」→ `POST /api/today/habits/starter` 塞進：不要給自己壓力，專注感恩今天／吃 2500 大卡／重訓／10 點關機準備睡覺／10000 步。只在空的時候有效。
- **黃金原則**（2026-09-02 加）：今天頁最下面一個區塊，一行一條原則，可新增、改字、刪除，沒有打勾。`principles`（user_id / text / position）。
- API（prefix `/api/today`，要登入）：`GET /` → `{goal, day, habits:[{id,text,done}]}`；`PUT /goal`；`POST /habits`、`PATCH /habits/{id}`、`DELETE /habits/{id}`；`POST /habits/{id}/check`、`DELETE /habits/{id}/check`；`POST /habits/starter`；`GET /principles`、`POST /principles`、`PATCH /principles/{id}`、`DELETE /principles/{id}`。別人的 habit / principle 一律 404。

### 採買（2026-09-02 加）
- 第四個切換「採買」：五個區塊 蛋白質 `protein`／碳水 `carbs`／飲料 `drinks`／點心 `snacks`／水果 `fruit`。
- `shopping_items`（user_id / section / text / done / position）。買到打勾（持續，不歸零）；「清掉已買」一次刪掉打勾的。
- API（prefix `/api/shopping`）：`GET /` → `{items:[{id,section,text,done}]}` 依區塊、位置排；`POST /` `{section,text}`；`PATCH /{id}` `{text?, done?}`；`DELETE /{id}`；`POST /clear-done`。未知區塊 422，別人的 404。

## 不做
一週規劃、拖拉、熱量與營養素、AI 推薦、心得濃縮、心得編輯、圖片、分享、Dear Me 的 tab 連到 `/meals`、資料匯入、地圖畫面、營業時間。

## 怎麼證明做完了（end-to-end check）
1. `uv run ruff check . && uv run pytest -q` 全綠（含新測試）。
2. `cd frontend && npm run lint && npm test && npm run build` 全綠。
3. 本機開 backend + Vite，Chrome 開 `http://localhost:5173/meals`：
   登入 → 按「新增」→ 用鍵盤走完七題新增一筆「氣炸鍋雞胸」（自己煮 / 夏 / 氣炸鍋）→ 列表出現；
   再新增一筆外食「7-11 茶葉蛋」（點心 / 四季）→ 搜尋框打「雞胸」只剩一筆；
   切「用問的」打「夏天自己煮的 用氣炸鍋」→ 標籤自動變成 自己煮 / 夏 / 氣炸鍋，列表只剩雞胸；
   編輯雞胸改成外食 → 卡片上煮法標籤消失；刪除茶葉蛋 → 列表剩一筆；
   切「心得」→ 按麥克風講一句「吃油的飽足感很久」→ 文字出現在框裡 → 記下來 → 列表出現這一條。
4. 用一個全新的空白資料庫 `alembic upgrade head` 再 `downgrade -1` 不報錯。
5. `npm run build` 後用 uvicorn 起 app，`curl -i localhost:8000/meals` 回 200 text/html（不是 API 的 401）。
