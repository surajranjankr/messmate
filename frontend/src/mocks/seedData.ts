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

/**
 * Generate a few demo meal instances around "today".
 * In a real app these would be generated from schedules.
 */
function generateDemoMealInstances(): MealInstance[] {
  const today = new Date();
  const instances: MealInstance[] = [];

  // Generate instances for yesterday, today, and tomorrow
  for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0]!;

    const meals = [
      { type: MealType.BREAKFAST, deadlineHour: 22, deadlineOffset: -1 },
      { type: MealType.LUNCH, deadlineHour: 9, deadlineOffset: 0 },
      { type: MealType.SNACKS, deadlineHour: 14, deadlineOffset: 0 },
      { type: MealType.DINNER, deadlineHour: 17, deadlineOffset: 0 },
    ];

    for (const meal of meals) {
      const deadlineDate = new Date(date);
      if (meal.deadlineOffset !== 0) {
        deadlineDate.setDate(deadlineDate.getDate() + meal.deadlineOffset);
      }
      deadlineDate.setHours(meal.deadlineHour, 0, 0, 0);

      let status: MealInstanceStatus;
      if (dayOffset < 0) {
        status = MealInstanceStatus.COMPLETED;
      } else if (dayOffset === 0) {
        const now = new Date();
        if (now < deadlineDate) {
          status = MealInstanceStatus.RESPONSE_OPEN;
        } else {
          status = MealInstanceStatus.RESPONSE_CLOSED;
        }
      } else {
        status = MealInstanceStatus.UPCOMING;
      }

      instances.push({
        id: `mi-${dateStr}-${meal.type.toLowerCase()}`,
        mealDate: dateStr,
        mealType: meal.type,
        menuVersionId: 'menu-v1',
        responseDeadline: deadlineDate.toISOString(),
        status,
      });
    }
  }

  return instances;
}

export const demoMealInstances: MealInstance[] = generateDemoMealInstances();

// --- Demo Meal Responses ---

/** Generate some demo responses for yesterday's meals */
function generateDemoResponses(): MealResponse[] {
  const responses: MealResponse[] = [];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0]!;

  const students = ['user-student-arjun', 'user-student-priya', 'user-student-rahul'];
  const choices = [
    ResponseChoice.DEFINITELY_EATING,
    ResponseChoice.PROBABLY_EATING,
    ResponseChoice.NOT_EATING,
  ];

  const meals = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];

  for (const meal of meals) {
    for (let i = 0; i < students.length; i++) {
      responses.push({
        id: `resp-${dateStr}-${meal.toLowerCase()}-${students[i]}`,
        studentId: students[i]!,
        mealInstanceId: `mi-${dateStr}-${meal.toLowerCase()}`,
        choice: choices[i % choices.length]!,
        createdAt: yesterday.toISOString(),
        updatedAt: yesterday.toISOString(),
      });
    }
  }

  return responses;
}

export const demoMealResponses: MealResponse[] = generateDemoResponses();

// --- Demo Vendor Decisions ---

function generateDemoVendorDecisions(): VendorDecision[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0]!;

  return [
    {
      mealInstanceId: `mi-${dateStr}-lunch`,
      originalRecommendation: 756,
      finalPlannedQuantity: 756,
      status: VendorDecisionStatus.ACCEPTED,
      updatedAt: yesterday.toISOString(),
    },
    {
      mealInstanceId: `mi-${dateStr}-dinner`,
      originalRecommendation: 756,
      finalPlannedQuantity: 780,
      overrideReason: 'Expecting more students for special dinner',
      status: VendorDecisionStatus.OVERRIDDEN,
      updatedAt: yesterday.toISOString(),
    },
  ];
}

export const demoVendorDecisions: VendorDecision[] = generateDemoVendorDecisions();

// --- Demo Meal Outcomes ---

function generateDemoOutcomes(): MealOutcome[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0]!;

  return [
    {
      mealInstanceId: `mi-${dateStr}-lunch`,
      actualAttendance: 710,
      actualPreparedQuantity: 756,
      preparedUnit: 'portions',
      leftoverQuantity: 46,
      leftoverUnit: 'portions',
      notes: 'Demo outcome data',
      recordedAt: yesterday.toISOString(),
    },
  ];
}

export const demoMealOutcomes: MealOutcome[] = generateDemoOutcomes();

// --- Demo Forecast Recommendations ---

function generateDemoForecasts(): ForecastRecommendation[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0]!;

  return [
    {
      mealInstanceId: `mi-${dateStr}-lunch`,
      baselineAttendance: 700,
      expectedAttendance: 700,
      safetyMarginFraction: 0.08,
      recommendedPortions: 756,
      forecastMethod: ForecastMethod.BASELINE_ONLY,
      dataQualityStatus: DataQualityStatus.DEMONSTRATION,
      explanation:
        'DEMONSTRATION DATA: Using baseline attendance of 700 with 8% safety margin. F=B=700, Q=ceil(700*(1+0.08))=756.',
    },
  ];
}

export const demoForecastRecommendations: ForecastRecommendation[] =
  generateDemoForecasts();

// --- Exports matching storage initialization ---

export const demoUsers = DEMO_USERS;

// --- Constants ---

/** Total registered students for demo purposes */
export const TOTAL_REGISTERED_STUDENTS = 750;

/** Default vendor baseline attendance */
export const DEFAULT_BASELINE_ATTENDANCE = 700;

/** Default safety margin fraction */
export const DEFAULT_SAFETY_MARGIN = 0.08;
