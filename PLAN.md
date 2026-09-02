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
- Status: todo

### 8. feat(web): meals list with search and filters
- Files: `frontend/src/meals/MealsApp.jsx`, `frontend/src/meals/MealList.jsx`, `frontend/src/meals/meals.css`
- Test: `flow.test.js` 補 `withSeasonAll`（有的話）；其餘靠 Check 的 lint/build + Chrome 走 SPEC e2e 第 3 步的搜尋段
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 列表、關鍵字、四組標籤、「用問的」、fallback 提示、兩段式刪除都能在 Chrome 操作
- Status: todo

### 9. feat(web): typeform-style add and edit dialog
- Files: `frontend/src/meals/QuickAdd.jsx`, `frontend/src/meals/MealList.jsx`, `frontend/src/meals/meals.css`
- Test: `flow.test.js` 補 `nextStep`/`prevStep` 與答案變動時步驟重算（改成外食後當前題落在被跳過的題要往前縮）
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 鍵盤走完七題新增一筆；編輯預填、點進度點跳題；失敗留在彈窗
- Status: todo

### 10. feat(web): notes screen with voice input
- Files: `frontend/src/meals/MealsApp.jsx`, `frontend/src/meals/Notes.jsx`, `frontend/src/meals/meals.css`
- Test: 純邏輯無新增；靠 Check 的 lint/build + Chrome 走 SPEC e2e 第 3 步的心得段
- Check: `cd frontend && npm run lint && npm test && npm run build`
- Done when: 講一句 → 字進框 → 記下來 → 列表出現；刪除兩段確認
- Status: todo

## 收工前
1. `uv run ruff check . && uv run pytest -q`；`cd frontend && npm run lint && npm test && npm run build`
2. `/verify-tests` 看新測試
3. `adversarial-reviewer` 對整段 diff（對著 SPEC.md / PLAN.md）
4. Chrome 走完 SPEC 的 e2e 第 3 步

## Open questions
- SPEC.md / PLAN.md 要不要一起進 repo（CI 對 `**.md` 不觸發部署，進了也不會多跑一次）。
