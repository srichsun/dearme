# SPEC — 吃什麼（減脂餐點清單）

## 目標

一個只給自己用的餐點清單，回答「今天可以吃什麼」。
打開第一個畫面就是列表 + 搜尋；新增用一題一題問的彈窗，幾秒內填完。
另外一個「心得」畫面，用講的或打的把飲食經驗記下來（之後要濃縮成 pattern 的原料）。
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
| category | str | `breakfast` / `meal` / `snack` | 早餐 / 正餐 / 點心 |
| source | str | `eat_out` / `home_cooked` | 外食 / 自己煮 |
| season | str | `summer` / `winter` / `all` | 夏 / 冬 / 四季 |
| method | str, nullable | `stir_fry` / `air_fryer` / `rice_cooker` / `microwave` | 炒 / 氣炸鍋 / 電鍋 / 微波爐；只有自己煮才有 |
| recipe | text, nullable | 自由文字 | 食材和步驟自己換行寫 |
| note | text, nullable | 自由文字 | 想寫熱量就寫這裡 |
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
- `source = eat_out` → `method` 和 `recipe` 一律清空存 null，就算送了也丟掉。為什麼：外食沒有煮法；不清掉的話搜「氣炸鍋」會撈到外食。
- 讀、改、刪都同時比對 `id` 和 `user_id`，別人的餐點一律 404（和不存在同一個答案）。為什麼：照 mantras 的做法，猜 id 猜不到別人的東西。

### API（prefix `/api/meals`，全部要登入）
- `GET /api/meals?q=&category=&source=&season=&method=` → `{"meals":[...]}`，新到舊。
  `q` 對 `name` / `recipe` / `note` 做不分大小寫的子字串比對；篩選條件是 AND；`season=summer` 會同時撈 `summer` 和 `all`（`winter` 同理）。
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

### 畫面（`frontend/src/meals/`，繁體中文）
- **列表頁（第一個畫面）**：頂端搜尋框 + 「用問的」切換；下面四組篩選標籤（分類 / 來源 / 季節 / 煮法）；卡片列出名稱、四個標籤、食譜與備註（有才顯示）；每張卡有「編輯」「刪除」。
  「用問的」模式：送 `POST /api/meals/search`，把回來的 `filters` 直接套成標籤（你看得到它理解成什麼，可以再點掉）；`fallback` 時顯示一行「沒問到 AI，用關鍵字搜」。
- **刪除**：按下後那張卡變成「確定刪除？／取消」兩顆鈕，不用瀏覽器 confirm。為什麼：瀏覽器 confirm 會擋住自動化測試，也不好看。
- **心得頁**：`MealsApp` 上方兩個切換「餐點」「心得」，預設「餐點」。
  心得頁：一個文字框 + 麥克風鈕（沿用 `speech.js` 的 `useRecorder` / `transcribe`，轉好的字接在框裡讓你看過再送）+「記下來」；下面新到舊列出每一條，附日期和「刪除」（同樣兩段確認）。
  為什麼轉完先進文字框不直接送：語音辨識會錯字，這些字之後要拿去濃縮，錯的原料會出錯的 pattern。
- **新增／編輯彈窗（typeform 式）**：一次一題，順序 名稱 → 分類 → 外食/自己煮 → 季節 → 煮法（外食跳過）→ 食譜（外食跳過）→ 備註。
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

## 不做
一週規劃、拖拉、熱量與營養素、AI 推薦、心得濃縮、心得編輯、圖片、分享、Dear Me 的 tab 連到 `/meals`、資料匯入。

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
