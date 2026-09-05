# PLAN — 吃什麼（照 SPEC.md）

### 1. feat: add meals and meal_notes tables
- Files: `app/models/meal.py`, `app/models/meal_note.py`, `app/models/__init__.py`, `migrations/versions/e5f6a7b8c9d0_add_meals_and_meal_notes.py`
- Test: `tests/test_meals.py::test_a_meal_round_trips_through_the_table`, `tests/test_meal_notes.py::test_a_note_round_trips_through_the_table`
- Check: `uv run pytest tests/test_meals.py tests/test_meal_notes.py -q && uv run ruff check .` ＋ 空白 DB `alembic upgrade head` / `downgrade -1`
- Done when: 兩張表存在、一筆寫進去讀得回來、migration 可逆
- Status: done

### 2. feat: meals service with validation
- Files: `app/services/meals.py`, `tests/test_meals.py`
- Test: `test_meals.py` — 建立、改、刪；名稱空白拒絕；列舉值錯誤拒絕；自己煮沒煮法拒絕；外食清空煮法與食譜；跨 user 改/刪回 None/False
- Check: `uv run pytest tests/test_meals.py -q && uv run ruff check .`
- Done when: SPEC「規則」那一節每一條都有一個紅過再綠的測試
- Status: done

### 3. feat: filter and keyword search for meals
- Files: `app/services/meals.py`, `tests/test_meals.py`
- Test: `test_meals.py` — 每個篩選條件各一；條件 AND；`season=summer` 含 `all`；`q` 對 name/recipe/note 三欄、不分大小寫；新到舊
- Check: `uv run pytest tests/test_meals.py -q && uv run ruff check .`
- Done when: `list_meals(uid, q=, category=, source=, season=, method=)` 行為和 SPEC API 那一節一致
- Status: done

### 4. feat: meal notes service
- Files: `app/services/meal_notes.py`, `tests/test_meal_notes.py`
- Test: `test_meal_notes.py` — 去空白、空白拒絕、新到舊、跨 user 隔離、刪別人的 False
- Check: `uv run pytest tests/test_meal_notes.py -q && uv run ruff check .`
- Done when: 新增／列出／刪除三個函式都有測試
- Status: done

### 5. feat: meals and notes API routes
- Files: `app/api/routes/meals.py`, `app/schemas/meal.py`, `app/api/router.py`, `tests/test_meals_api.py`
- Test: `test_meals_api.py` — POST 201、PATCH 整筆、DELETE、422 每一種、別人的 404、`GET /meals/notes` 不被吃成 `/meals/{id}`、notes 的 201/422/404
- Check: `uv run pytest tests/test_meals_api.py -q && uv run ruff check .`
- Done when: 所有端點登入後可用、錯誤碼照 SPEC
- Status: done

### 6. feat: turn a sentence into meal filters
- Files: `app/services/meal_search.py`, `app/api/routes/meals.py`, `tests/test_meal_search.py`
- Test: `test_meal_search.py` — mock 模型回條件 → 走同一個查詢；模型丟例外 → `fallback: true` 且 `q` = 原句；模型回未知代碼 → 丟掉那個條件
- Check: `uv run pytest tests/test_meal_search.py -q && uv run ruff check .`
- Done when: `POST /meals/search` 有模型和沒模型都回列表
- Status: done

### 7. feat(web): /meals entry, flow logic, vitest
- Files: `frontend/src/main.jsx`, `frontend/src/meals/MealsApp.jsx`（登入牆 + 空殼）, `frontend/src/meals/flow.js`, `frontend/src/meals/flow.test.js`, `frontend/package.json`, `.github/workflows/ci.yml`
- Test: `flow.test.js` — `visibleSteps` 外食 5 題／自煮 7 題；`toQuery` 空值不帶、有值編碼；`labelOf` 未知代碼原樣回傳
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: `/meals` 看得到登入鈕、登入後看得到空殼；Dear Me 首頁不變；CI 多一步 test
- Status: done

### 8. feat(web): meals list with search and filters
- Files: `frontend/src/meals/MealsApp.jsx`, `frontend/src/meals/MealList.jsx`, `frontend/src/meals/meals.css`
- Test: `flow.test.js` 補 `withSeasonAll`（有的話）；其餘靠 Check 的 lint/build + Chrome 走 SPEC e2e 第 3 步的搜尋段
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 列表、關鍵字、四組標籤、「用問的」、fallback 提示、兩段式刪除都能在 Chrome 操作
- Status: done

### 9. feat(web): typeform-style add and edit dialog
- Files: `frontend/src/meals/QuickAdd.jsx`, `frontend/src/meals/MealList.jsx`, `frontend/src/meals/meals.css`
- Test: `flow.test.js` 補 `nextStep`/`prevStep` 與答案變動時步驟重算（改成外食後當前題落在被跳過的題要往前縮）
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 鍵盤走完七題新增一筆；編輯預填、點進度點跳題；失敗留在彈窗
- Status: done

### 10. feat(web): notes screen with voice input
- Files: `frontend/src/meals/MealsApp.jsx`, `frontend/src/meals/Notes.jsx`, `frontend/src/meals/meals.css`
- Test: 純邏輯無新增；靠 Check 的 lint/build + Chrome 走 SPEC e2e 第 3 步的心得段
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 講一句 → 字進框 → 記下來 → 列表出現；刪除兩段確認
- Status: done

### 11. feat: add a rating to meals
- Files: `app/models/meal.py`, `migrations/versions/f6a7b8c9d0e1_add_meal_rating.py`, `tests/test_meals.py`
- Test: `test_a_meal_round_trips_through_the_table` 含 rating
- Check: `uv run pytest tests/test_meals.py -q && uv run ruff check .` ＋ scratch DB upgrade/downgrade
- Done when: 欄位存在、可逆
- Status: done

### 12. feat: rating rule and API
- Files: `app/services/meals.py`, `app/schemas/meal.py`, `app/api/routes/meals.py`, `tests/test_meals.py`, `tests/test_meals_api.py`
- Test: 1–10 存、0/11/小數/字串 拒絕、沒給存 null、API 回 rating
- Check: `uv run pytest tests/test_meals.py tests/test_meals_api.py -q && uv run ruff check .`
- Done when: rating 走和其他欄位一樣的規則
- Status: done

### 13. feat(web): stars in the dialog and on the card
- Files: `frontend/src/meals/flow.js`, `flow.test.js`, `QuickAdd.jsx`, `MealList.jsx`, `meals.css`
- Test: `keyToRating` 1–9/0/其他、`stars(n)`、步驟數 8/6、payload 含 rating
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 彈窗多一題可跳過、卡片顯示 ★
- Status: done

### 14. feat(web): speak the note in the dialog
- Files: `frontend/src/meals/flow.js`, `flow.test.js`, `QuickAdd.jsx`, `meals.css`
- Test: `appendSpoken` 空框直接放、有字用空格接、空轉錄不動
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 備註那題有麥克風，講完的字出現在框裡
- Status: done

### 15. feat: add a kind to meals
- Files: `app/models/meal.py`, `migrations/versions/a7b8c9d0e1f2_add_meal_kind.py`, `tests/test_meals.py`
- Check: `uv run pytest tests/test_meals.py -q && uv run ruff check .` ＋ scratch DB upgrade/downgrade
- Status: done

### 16. feat: kind filter, kinds count, keyword over kind
- Files: `app/services/meals.py`, `app/schemas/meal.py`, `app/api/routes/meals.py`, `tests/test_meals.py`, `tests/test_meals_api.py`
- Test: kind 去空白/None、`kind=` 篩選、`kinds()` 每人各自計數多到少、`q` 比對 kind、`GET /api/meals/kinds`
- Check: `uv run pytest tests/test_meals.py tests/test_meals_api.py -q && uv run ruff check .`
- Status: done

### 17. feat(web): kind step and browse-by-kind view
- Files: `frontend/src/meals/flow.js`, `flow.test.js`, `QuickAdd.jsx`, `MealList.jsx`, `meals.css`
- Test: 步驟數 9/7、payload/fromMeal 含 kind、`toQuery` 帶 kind
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Status: done

### 18. feat: shop fields on eat-out meals
- Files: `app/models/meal.py`, `migrations/versions/b8c9d0e1f2a3_add_meal_place.py`, `app/services/meals.py`, `app/schemas/meal.py`, `app/api/routes/meals.py`, tests
- Test: 外食存店家、自煮清空店家、lat/lng 範圍檢查、API 回 place
- Check: `uv run pytest tests/test_meals.py tests/test_meals_api.py -q && uv run ruff check .` ＋ scratch DB
- Status: done

### 19. feat: nearest first with ?near=
- Files: `app/services/meals.py`, `app/api/routes/meals.py`, `app/services/meal_search.py`, tests
- Test: haversine 已知兩點、near 排序有座標在前、沒座標照舊、壞座標 422、search 帶 near
- Check: `uv run pytest -q && uv run ruff check .`
- Status: done

### 20. feat(web): pick the shop from Google Places, nearest button
- Files: `frontend/src/meals/places.js`, `flow.js`, `flow.test.js`, `QuickAdd.jsx`, `MealList.jsx`, `meals.css`, `frontend/.env*`
- Test: `formatDistance`、步驟數（外食 8 / 自煮 9）、payload 自煮不帶店家
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Status: done

### 21. feat(web): switch the meals screens between 中 and EN
- Files: `frontend/src/meals/i18n.js`, `i18n.test.js`, `flow.js`, `flow.test.js`, `MealsApp.jsx`, `MealList.jsx`, `QuickAdd.jsx`, `Notes.jsx`, `places.js`, `meals.css`
- Test: 每個 key 中英都有、`labelOf`/`stepText` 兩種語言、未知語言退回中文
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Status: done

### 22. feat: video link on meals
- Files: `app/models/meal.py`, `migrations/versions/c9d0e1f2a3b4_add_meal_video_url.py`, `app/services/meals.py`, `app/schemas/meal.py`, `app/api/routes/meals.py`, tests
- Test: http(s) 存、其他拒絕、空白 null、API 回 video_url
- Check: `uv run pytest -q && uv run ruff check .` ＋ scratch DB
- Status: done

### 23. feat(web): video link step and "watch" on the card
- Files: `frontend/src/meals/flow.js`, `flow.test.js`, `i18n.js`, `QuickAdd.jsx`, `MealList.jsx`, `meals.css`
- Test: 步驟數 10/9、payload/fromMeal 含 video_url、`isVideoUrl`
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Status: done

### 24. feat: kinds can be narrowed to a source
- Files: `app/services/meals.py`, `app/api/routes/meals.py`, `tests/test_meals.py`, `tests/test_meals_api.py`
- Test: `kinds(uid, source="eat_out")` 只算外食、route 帶 source
- Check: `uv run pytest -q && uv run ruff check .`
- Status: done

### 25. feat(web): GO — what to eat out, nearest first
- Files: `frontend/src/meals/GoDialog.jsx`, `MealsApp.jsx`, `MealList.jsx`, `flow.js`, `flow.test.js`, `i18n.js`, `meals.css`
- Test: `goFilters(kind)` 外食 + 類型／不限
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Status: done

### 26. feat: goals, habits, habit_checks tables
- Files: `app/models/today.py`, `app/models/__init__.py`, `migrations/versions/d0e1f2a3b4c5_add_today_tables.py`
- Check: `uv run pytest -q && uv run ruff check .` ＋ scratch DB
- Status: done

### 27. feat: today service and API
- Files: `app/services/today.py`, `app/schemas/today.py`, `app/api/routes/today.py`, `app/api/router.py`, `tests/test_today.py`
- Test: goal 存/改、habit CRUD、打勾今天、隔天歸零、starter 只在空時、跨 user 404
- Check: `uv run pytest tests/test_today.py -q && uv run ruff check .`
- Status: done

### 28. feat(web): Today tab first — goal and checklist
- Files: `frontend/src/meals/Today.jsx`, `MealsApp.jsx`, `i18n.js`, `meals.css`
- Test: 字典完整性測試涵蓋新字串
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Status: done

### 29. feat: Taiwan food table in the repo, with matching
- Files: `app/data/tfnd.json`, `app/services/nutrition_db.py`, `tests/test_nutrition_db.py`
- Status: done

### 30. feat: food_logs and nutrition_targets tables
- Files: `app/models/food.py`, `migrations/versions/a9b0c1d2e3f4_add_food_logs.py`
- Status: done

### 31. feat: estimate a meal from words or a photo, checked against the table
- Files: `app/services/food_estimate.py`, `app/services/blobs.py`, `tests/test_food_estimate.py`
- Status: done

### 32. feat: food log API — the day, save, edit, targets, report
- Files: `app/services/food.py`, `app/schemas/food.py`, `app/api/routes/food.py`, `tests/test_food.py`
- Status: done

### 33. feat(web): 飲食 tab — input, preview, day, targets
- Files: `frontend/src/meals/Food.jsx`, `foodmath.js`, `foodmath.test.js`
- Status: done

### 34. feat(web): report — days and weekly averages
- Files: `frontend/src/meals/FoodReport.jsx`
- Status: done

### 35. feat: food_items, brand source, table sanity check
- Files: `app/models/food.py`, `migrations/versions/b0c1d2e3f4a5_add_food_items.py`, `app/services/food_items.py`, `food_estimate.py`, `food.py`, `routes/food.py`, tests
- Status: todo

### 36. feat(web): edit or drop each item; source tags
- Status: todo

## 收工前
1. `uv run ruff check . && uv run pytest -q`；`cd frontend && npm run lint && npm test && npm run build`
2. `/verify-tests` 看新測試
3. `adversarial-reviewer` 對整段 diff（對著 SPEC.md / PLAN.md）
4. Chrome 走完 SPEC 的 e2e 第 3 步

## Open questions
- SPEC.md / PLAN.md 要不要一起進 repo（CI 對 `**.md` 不觸發部署，進了也不會多跑一次）。
