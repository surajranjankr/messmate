// ============================================================
// Demo / Seed Data for MessMate
// ============================================================
// This file contains hardcoded demo data used to bootstrap the
// application. All data is clearly labeled as demonstration data.

import {
  User,
  UserRole,
  UserStatus,
  NotificationSchedule,
  DayOfWeek,
  MealType,
  Notification,
  MealInstance,
  MealInstanceStatus,
  MealResponse,
  ResponseChoice,
  VendorDecision,
  VendorDecisionStatus,
  MealOutcome,
  ForecastRecommendation,
  ForecastMethod,
  DataQualityStatus,
  MenuVersion,
  MenuVersionStatus,
} from '../types';
import { initialMenuData } from './menuData';

// --- Demo Users ---

export const DEMO_USERS: User[] = [
  {
    id: 'user-student-arjun',
    displayName: 'Arjun Sharma',
    email: 'arjun@iiitdwd.ac.in',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  },
  {
    id: 'user-student-priya',
    displayName: 'Priya Patel',
    email: 'priya@iiitdwd.ac.in',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  },
  {
    id: 'user-student-rahul',
    displayName: 'Rahul Verma',
    email: 'rahul@iiitdwd.ac.in',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  },
  {
    id: 'user-vendor',
    displayName: 'Mess Vendor',
    email: 'vendor@iiitdwd.ac.in',
    role: UserRole.VENDOR,
    status: UserStatus.ACTIVE,
  },
  {
    id: 'user-admin',
    displayName: 'Admin User',
    email: 'admin@iiitdwd.ac.in',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  },
];

/** Demo password for all demo accounts */
export const DEMO_PASSWORD = 'demo123';

// --- Demo Notification Schedules ---

const DAYS = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

const MEAL_SCHEDULE_DEFAULTS: {
  mealType: MealType;
  notifySendTime: string;
  responseDeadlineTime: string;
  mealDateOffset: number;
}[] = [
  {
    mealType: MealType.BREAKFAST,
    notifySendTime: '21:00',
    responseDeadlineTime: '22:00',
    mealDateOffset: 1, // notification evening before
  },
  {
    mealType: MealType.LUNCH,
    notifySendTime: '08:00',
    responseDeadlineTime: '09:30',
    mealDateOffset: 0, // same day morning
  },
  {
    mealType: MealType.SNACKS,
    notifySendTime: '12:00',
    responseDeadlineTime: '14:00',
    mealDateOffset: 0,
  },
  {
    mealType: MealType.DINNER,
    notifySendTime: '15:00',
    responseDeadlineTime: '17:00',
    mealDateOffset: 0,
  },
];

export const demoNotificationSchedules: NotificationSchedule[] = DAYS.flatMap((day) =>
  MEAL_SCHEDULE_DEFAULTS.map((meal) => ({
    id: `schedule-${day.toLowerCase()}-${meal.mealType.toLowerCase()}`,
    dayOfWeek: day,
    mealType: meal.mealType,
    enabled: true,
    notifySendTime: meal.notifySendTime,
    responseDeadlineTime: meal.responseDeadlineTime,
    mealDateOffset: meal.mealDateOffset,
    timezone: 'Asia/Kolkata',
  })),
);

// --- Demo Notifications ---

export const demoNotifications: Notification[] = [
  {
    id: 'notif-1',
    title: 'Welcome to MessMate!',
    message:
      'This is a demonstration of the MessMate meal planning system for IIIT Dharwad.',
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  {
    id: 'notif-2',
    title: 'Demo Data Notice',
    message:
      'All data shown in this application is for demonstration purposes only. No real meal orders are being placed.',
    createdAt: new Date().toISOString(),
    isRead: false,
  },
];

// --- Demo Menu Versions ---

export const demoMenuVersions: MenuVersion[] = [
  {
    id: 'menu-v1',
    versionNumber: 1,
    status: MenuVersionStatus.PUBLISHED,
    meals: initialMenuData,
    createdAt: '2026-10-01T10:00:00+05:30',
    publishedAt: '2026-10-01T10:30:00+05:30',
    changeSummary: 'Initial menu transcribed from IIIT DWD MESS 1 PDF',
  },
];

// --- Demo Meal Instances ---

const HISTORICAL_MEALS = [
  { date: '2026-11-01', type: MealType.BREAKFAST, rec: 4, planned: 4, prep: 4, att: 3, waste: 4.5, notes: 'Sunday idli-vada breakfast; smooth service' },
  { date: '2026-11-01', type: MealType.LUNCH, rec: 4, planned: 5, prep: 5, att: 4, waste: 3.8, notes: 'Weekend special lunch; slight override for visitors' },
  { date: '2026-11-01', type: MealType.SNACKS, rec: 3, planned: 3, prep: 3, att: 3, waste: 2.0, notes: 'Evening tea & samosa; optimal turn-out' },
  { date: '2026-11-01', type: MealType.DINNER, rec: 4, planned: 4, prep: 4, att: 4, waste: 1.5, notes: 'Sunday dinner; high turn-out' },

  { date: '2026-11-02', type: MealType.BREAKFAST, rec: 3, planned: 3, prep: 3, att: 3, waste: 2.5, notes: 'Monday morning breakfast; timely preparation' },
  { date: '2026-11-02', type: MealType.LUNCH, rec: 4, planned: 4, prep: 4, att: 4, waste: 3.0, notes: 'Rice, dal & sabzi; well received' },
  { date: '2026-11-02', type: MealType.SNACKS, rec: 3, planned: 3, prep: 3, att: 2, waste: 6.0, notes: 'Late lab sessions slightly reduced attendance' },
  { date: '2026-11-02', type: MealType.DINNER, rec: 4, planned: 4, prep: 4, att: 3, waste: 4.0, notes: 'Chapati & paneer; 1 portion remaining' },

  { date: '2026-11-03', type: MealType.BREAKFAST, rec: 4, planned: 4, prep: 4, att: 4, waste: 1.8, notes: 'Poha & sprouts; clean trays' },
  { date: '2026-11-03', type: MealType.LUNCH, rec: 4, planned: 4, prep: 4, att: 3, waste: 4.2, notes: 'Mid-day meal; within target buffer' },
  { date: '2026-11-03', type: MealType.SNACKS, rec: 3, planned: 3, prep: 3, att: 3, waste: 2.1, notes: 'Biscuits & tea; right on target' },
  { date: '2026-11-03', type: MealType.DINNER, rec: 4, planned: 4, prep: 4, att: 4, waste: 2.0, notes: 'Tuesday dinner; excellent response rate' },
];

const DEMO_STUDENT_IDS = [
  'user-student-arjun',
  'user-student-priya',
  'user-student-rahul',
  'user-0199f175',
];

const SEED_CHOICE_PATTERNS = [
  [ResponseChoice.DEFINITELY_EATING, ResponseChoice.DEFINITELY_EATING, ResponseChoice.NOT_EATING, ResponseChoice.PROBABLY_EATING],
  [ResponseChoice.DEFINITELY_EATING, ResponseChoice.PROBABLY_EATING, ResponseChoice.DEFINITELY_EATING, ResponseChoice.DEFINITELY_EATING],
  [ResponseChoice.PROBABLY_EATING, ResponseChoice.DEFINITELY_EATING, ResponseChoice.NOT_EATING, ResponseChoice.DEFINITELY_EATING],
  [ResponseChoice.DEFINITELY_EATING, ResponseChoice.NOT_EATING, ResponseChoice.DEFINITELY_EATING, ResponseChoice.PROBABLY_EATING],
];

/**
 * Generate demo meal instances including historical past meals and upcoming week.
 */
function generateDemoMealInstances(): MealInstance[] {
  const instances: MealInstance[] = [];

  // 1. Add historical meals (Nov 1 to Nov 3)
  for (const m of HISTORICAL_MEALS) {
    instances.push({
      id: `mi-${m.date}-${m.type.toLowerCase()}`,
      mealDate: m.date,
      mealType: m.type,
      menuVersionId: 'menu-v1',
      responseDeadline: `${m.date}T10:00:00+05:30`,
      responseOpenTime: `${m.date}T06:00:00+05:30`,
      status: MealInstanceStatus.COMPLETED,
    });
  }

  // 2. Add current & upcoming meals (Nov 4 to Nov 7)
  const futureDates = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.SNACKS, MealType.DINNER];

  for (const dateStr of futureDates) {
    for (const type of mealTypes) {
      instances.push({
        id: `mi-${dateStr}-${type.toLowerCase()}`,
        mealDate: dateStr,
        mealType: type,
        menuVersionId: 'menu-v1',
        responseDeadline: `${dateStr}T17:00:00+05:30`,
        responseOpenTime: `${dateStr}T06:00:00+05:30`,
        status: dateStr === '2026-11-04' ? MealInstanceStatus.RESPONSE_OPEN : MealInstanceStatus.UPCOMING,
      });
    }
  }

  return instances;
}

export const demoMealInstances: MealInstance[] = generateDemoMealInstances();

// --- Demo Meal Responses ---

function generateDemoResponses(): MealResponse[] {
  const responses: MealResponse[] = [];

  HISTORICAL_MEALS.forEach((item, idx) => {
    const mid = `mi-${item.date}-${item.type.toLowerCase()}`;
    const pattern = SEED_CHOICE_PATTERNS[idx % SEED_CHOICE_PATTERNS.length]!;

    DEMO_STUDENT_IDS.forEach((studentId, sIdx) => {
      const choice = pattern[sIdx % pattern.length]!;
      responses.push({
        id: `resp-${item.date}-${item.type.toLowerCase()}-${studentId.slice(-6)}`,
        studentId,
        mealInstanceId: mid,
        choice,
        createdAt: `${item.date}T07:15:00Z`,
        updatedAt: `${item.date}T07:15:00Z`,
      });
    });
  });

  return responses;
}

export const demoMealResponses: MealResponse[] = generateDemoResponses();

// --- Demo Vendor Decisions ---

function generateDemoDecisions(): VendorDecision[] {
  return HISTORICAL_MEALS.map((m) => {
    const isOverride = m.planned !== m.rec;
    return {
      mealInstanceId: `mi-${m.date}-${m.type.toLowerCase()}`,
      originalRecommendation: m.rec,
      finalPlannedQuantity: m.planned,
      overrideReason: isOverride ? 'Weekend visitor buffer' : undefined,
      status: isOverride ? VendorDecisionStatus.OVERRIDDEN : VendorDecisionStatus.ACCEPTED,
      updatedAt: `${m.date}T08:00:00Z`,
    };
  });
}

export const demoVendorDecisions: VendorDecision[] = generateDemoDecisions();

// --- Demo Meal Outcomes ---

function generateDemoOutcomes(): MealOutcome[] {
  return HISTORICAL_MEALS.map((m) => ({
    mealInstanceId: `mi-${m.date}-${m.type.toLowerCase()}`,
    actualPreparedQuantity: m.prep,
    preparedUnit: 'portions',
    actualAttendance: m.att,
    leftoverQuantity: Math.max(0, m.prep - m.att),
    leftoverUnit: 'portions',
    wastePercentage: m.waste,
    notes: m.notes,
    recordedAt: `${m.date}T14:30:00Z`,
  }));
}

export const demoMealOutcomes: MealOutcome[] = generateDemoOutcomes();

// --- Demo Forecast Recommendations ---

function generateDemoForecasts(): ForecastRecommendation[] {
  return HISTORICAL_MEALS.map((m) => ({
    mealInstanceId: `mi-${m.date}-${m.type.toLowerCase()}`,
    baselineAttendance: 4,
    expectedAttendance: Number((m.att * 0.9).toFixed(1)),
    safetyMarginFraction: 0.08,
    recommendedPortions: m.rec,
    forecastMethod: ForecastMethod.BASELINE_PLUS_SURVEY,
    dataQualityStatus: DataQualityStatus.SUFFICIENT,
    explanation: `Dynamic demand model for ${m.type} with 8% safety buffer applied.`,
    definitelyEating: 2,
    probablyEating: 1,
    notEating: 1,
    noResponse: 0,
    nonresponseAttendanceRate: 0.70,
  }));
}

export const demoForecastRecommendations: ForecastRecommendation[] = generateDemoForecasts();

// --- Exports matching storage initialization ---

export const demoUsers = DEMO_USERS;

// --- Constants ---

/** Total registered students for demo purposes */
export const TOTAL_REGISTERED_STUDENTS = 3;

/** Default vendor baseline attendance */
export const DEFAULT_BASELINE_ATTENDANCE = 3;
export const DEFAULT_NONRESPONSE_ATTENDANCE_RATE = 0.70;

/** Default safety margin fraction */
export const DEFAULT_SAFETY_MARGIN = 0.08;
