# MessMate Phase 2 Preflight Baseline Report

**Audit Date:** November 3, 2026  
**Auditor:** Antigravity Full-Stack Engineer  
**Workspace:** `C:\Users\Suraj ranjan kumar\Desktop\messmate`

---

## 1. Git Repository State

- **Branch:** `main` (clean sync with `origin/main`).
- **Modified files:** `.gitignore`, `README.md`.
- **Untracked directories:** `UI/`, `backend/`, `docs/`, `frontend/`.
- **Commit policy:** No Git commits or pushes will be executed without explicit user authorization.

---

## 2. Environment Verification

- **Node.js:** `v24.14.0`
- **npm:** `11.9.0`
- **Frontend Build Status:** Vite v8.3.5 production build verified (`tsc -b && vite build` completed in 1.62s).
- **Frontend Test Suite:** Vitest v5.1.0 verified (7 test suites, 27 tests passing, 0 failures).
- **Python Environment:**
  - `python --version`: Python 3.13.5 (installed via Anaconda at `C:\anaconda3\python.exe`).
  - Python 3.12 folder `C:\Users\Suraj ranjan kumar\AppData\Local\Programs\Python\Python312` was inspected but does not contain a functional binary.
  - Python 3.13.5 will be used to initialize the isolated project virtual environment in `backend/.venv`.

---

## 3. Existing Frontend Service Contracts & Domain Types

The frontend currently uses 9 decoupled services:

1. **`authService`**:
   - `login(credentials: LoginCredentials): Promise<User>`
   - `logout(): void`
   - `getCurrentUser(): User | null`
   - `getUsers(): User[]`
   - `addUser(userData: Omit<User, 'id'>): User`
   - `updateUser(id: string, updates: Partial<User>): User`
   - `toggleUserStatus(id: string): User`

2. **`menuService`**:
   - `getAllVersions(): MenuVersion[]`
   - `getPublishedMenu(): MenuVersion | null`
   - `getDraft(): MenuVersion | null`
   - `getOrCreateDraft(): MenuVersion`
   - `saveDraft(meals: MenuMealEntry[], changeSummary?: string): MenuVersion`
   - `discardDraft(): void`
   - `publishDraft(changeSummary?: string): MenuVersion`
   - `getVersionHistory(): MenuVersion[]`
   - `getMenuForMeal(dayOfWeek: DayOfWeek, mealType: MealType, versionId?: string): MenuMealEntry | null`

3. **`mealInstanceService`**:
   - `getAllMealInstances(): MealInstance[]`
   - `getMealInstance(id: string): MealInstance | null`
   - `getMealsByDate(dateStr: string): MealInstance[]`
   - `getTodaysMeals(): MealInstance[]`
   - `getNextActionableMeal(): MealInstance | null`
   - `saveMealInstance(instance: MealInstance): void`

4. **`responseService`**:
   - `getMyResponse(studentId: string, mealInstanceId: string): MealResponse | null`
   - `submitResponse(studentId: string, mealInstanceId: string, choice: ResponseChoice): MealResponse`
   - `getMyHistory(studentId: string): MealResponse[]`
   - `getAggregateCounts(mealInstanceId: string): MealCounts` (strictly maintains `noResponse` separate from `notEating`)

5. **`notificationService`**:
   - `getNotifications(): Notification[]`
   - `getUnreadCount(): number`
   - `markAsRead(notificationId: string): void`
   - `markAllAsRead(): void`
   - `addNotification(title: string, message: string, mealInstanceId?: string): Notification`

6. **`scheduleService`**:
   - `getSchedules(): NotificationSchedule[]` (28 schedules: 7 days $\times$ 4 meals)
   - `updateSchedule(id: string, updates: Partial<NotificationSchedule>): NotificationSchedule`
   - `validateSchedules(schedules?: NotificationSchedule[]): ScheduleValidationResult`
   - `acknowledgeOverlap(schedule1Id: string, schedule2Id: string): void`

7. **`forecastService`**:
   - `getBaselineAttendance(): number` (700)
   - `getSafetyMargin(): number` (0.08)
   - `getRecommendation(mealInstanceId: string): ForecastRecommendation` ($F = B$, $Q = \lceil F \times (1 + m) \rceil = 756$)
   - `getVendorDecision(mealInstanceId: string): VendorDecision | null`
   - `saveVendorDecision(mealInstanceId: string, plannedQuantity: number, overrideReason?: string): VendorDecision`

8. **`outcomeService`**:
   - `getAllOutcomes(): MealOutcome[]`
   - `getOutcome(mealInstanceId: string): MealOutcome | null`
   - `saveOutcome(outcomeData: ...): MealOutcome`

9. **`reportService`**:
   - `getDashboardSummary(): DashboardSummary`
   - `getMealReports(filters?: ReportFilters): MealReportEntry[]`

---

## 4. Phase 2 Plan of Record

- **Backend Foundation:** Initialize dedicated virtual environment `backend/.venv/`.
- **Stack:** Python 3.13.5, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, SQLite (`backend/data/messmate.db`), Alembic, pytest, HTTPX.
- **Security:** Argon2 / Bcrypt password hashing (`passlib` / `pwdlib` / `bcrypt`), JWT bearer tokens, role authorization (`STUDENT`, `VENDOR`, `ADMIN`).
- **Database Schema:** Tables for `users`, `menu_versions`, `menu_meal_entries`, `dish_items`, `meal_instances`, `meal_responses`, `notification_schedules`, `notifications`, `vendor_decisions`, `meal_outcomes`.
- **API Contracts:** REST API at `/api/v1` mirroring the 9 services.
- **Frontend Integration:** HTTP client in `frontend/src/services/apiClient.ts`, updating the 9 frontend services to call the backend API asynchronously with JWT token persistence and clean error handling.
- **Testing:** Comprehensive pytest suite testing auth, responses, deadlines, vendor plans, outcomes, schedules, and menu versioning; plus vitest integration tests and production build verification.
