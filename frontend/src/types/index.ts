// ============================================================
// MessMate Domain Types
// ============================================================

// --- Enums ---

export enum UserRole {
  STUDENT = 'STUDENT',
  VENDOR = 'VENDOR',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  SNACKS = 'SNACKS',
  DINNER = 'DINNER',
}

export enum ResponseChoice {
  DEFINITELY_EATING = 'DEFINITELY_EATING',
  PROBABLY_EATING = 'PROBABLY_EATING',
  NOT_EATING = 'NOT_EATING',
}

export enum MealInstanceStatus {
  UPCOMING = 'UPCOMING',
  RESPONSE_OPEN = 'RESPONSE_OPEN',
  RESPONSE_CLOSED = 'RESPONSE_CLOSED',
  COMPLETED = 'COMPLETED',
}

export enum MenuVersionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum VendorDecisionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  OVERRIDDEN = 'OVERRIDDEN',
  CONFIRMED = 'CONFIRMED',
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export enum ForecastMethod {
  BASELINE_ONLY = 'BASELINE_ONLY',
  BASELINE_PLUS_SURVEY = 'BASELINE_PLUS_SURVEY',
}

export enum DataQualityStatus {
  SUFFICIENT = 'SUFFICIENT',
  LIMITED = 'LIMITED',
  INSUFFICIENT = 'INSUFFICIENT',
  DEMONSTRATION = 'DEMONSTRATION',
}

// --- Core Models ---

export interface User {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

/** The menu for a single meal on a single day */
export interface MenuMealEntry {
  id: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  /** Main dishes for this meal slot */
  dishes: DishItem[];
  /** Common accompaniments (e.g. "Plain Rice + Pickle + Papad") */
  accompaniments: string[];
  /** Notes from the source menu (e.g. serving limits) */
  notes: string[];
}

export interface DishItem {
  id: string;
  name: string;
  /** If slash-separated in source, these are the alternatives for alternating weeks */
  alternatives?: string[];
  /** Category within the meal (main, side, beverage, dessert, etc.) */
  category?: string;
}

export interface MenuVersion {
  id: string;
  versionNumber: number;
  status: MenuVersionStatus;
  /** The full weekly menu data */
  meals: MenuMealEntry[];
  createdAt: string; // ISO 8601
  publishedAt?: string; // ISO 8601
  changeSummary?: string;
}

export interface MealInstance {
  id: string;
  /** Date of the meal in YYYY-MM-DD format */
  mealDate: string;
  mealType: MealType;
  menuVersionId: string;
  responseDeadline: string; // ISO 8601 with timezone
  responseOpenTime?: string; // ISO 8601 with timezone
  status: MealInstanceStatus;
}

export interface MealResponse {
  id: string;
  studentId: string;
  mealInstanceId: string;
  choice: ResponseChoice;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface MealCounts {
  definitelyEating: number;
  probablyEating: number;
  notEating: number;
  noResponse: number;
  totalRegistered: number;
}

export interface ForecastRecommendation {
  mealInstanceId: string;
  baselineAttendance: number;
  expectedAttendance: number;
  safetyMarginFraction: number;
  recommendedPortions?: number | null;
  forecastMethod: ForecastMethod | string;
  dataQualityStatus: DataQualityStatus | string;
  explanation: string;
  definitelyEating?: number;
  probablyEating?: number;
  notEating?: number;
  noResponse?: number;
  nonresponseAttendanceRate?: number | null;
}

export interface VendorDecision {
  mealInstanceId: string;
  originalRecommendation?: number | null;
  finalPlannedQuantity: number;
  overrideReason?: string;
  status: VendorDecisionStatus;
  updatedAt: string; // ISO 8601
}

export interface MealOutcome {
  mealInstanceId: string;
  actualAttendance?: number;
  actualPreparedQuantity?: number;
  preparedUnit: string; // e.g. "portions"
  leftoverQuantity?: number;
  leftoverUnit?: string; // e.g. "kg" or "portions"
  notes?: string;
  recordedAt: string; // ISO 8601
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string; // ISO 8601
  isRead: boolean;
  mealInstanceId?: string;
}

export interface NotificationSchedule {
  id: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  enabled: boolean;
  /** Time to send notification, e.g. "21:00" in 24h format */
  notifySendTime: string;
  /** Response deadline time, e.g. "22:00" in 24h format */
  responseDeadlineTime: string;
  /** Whether the meal is on the same day as the notification or the next day */
  mealDateOffset: number; // 0 = same day, 1 = next day
  timezone: string; // "Asia/Kolkata"
  /** Whether an overlap warning was acknowledged */
  overlapAcknowledged?: boolean;
}

// --- Report Types ---

export interface DashboardSummary {
  totalStudents: number;
  totalVendors: number;
  totalAdmins: number;
  configuredSchedules: number;
  publishedMenuVersion?: number;
  upcomingDeadlines: MealInstance[];
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  mealType?: MealType;
}

export interface MealReportEntry {
  mealInstanceId: string;
  mealDate: string;
  mealType: MealType;
  counts: MealCounts;
  recommendation?: ForecastRecommendation;
  decision?: VendorDecision;
  outcome?: MealOutcome;
}

// --- Auth Types ---

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// --- Schedule Validation ---

export interface ScheduleValidationResult {
  isValid: boolean;
  errors: ScheduleValidationError[];
  warnings: ScheduleOverlapWarning[];
}

export interface ScheduleValidationError {
  scheduleId: string;
  field: string;
  message: string;
}

export interface ScheduleOverlapWarning {
  schedule1Id: string;
  schedule2Id: string;
  schedule1Label: string;
  schedule2Label: string;
  overlapDescription: string;
  acknowledged: boolean;
}
