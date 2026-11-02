// ============================================================
// Report Service
// ============================================================
// Aggregates data for admin and vendor reporting dashboards,
// keeping demonstration estimates distinct from actual recorded outcomes.

import {
  DashboardSummary,
  MealReportEntry,
  ReportFilters,
  UserRole,
} from '../types';
import { authService } from './authService';
import { scheduleService } from './scheduleService';
import { menuService } from './menuService';
import { mealInstanceService } from './mealInstanceService';
import { responseService } from './responseService';
import { forecastService } from './forecastService';
import { outcomeService } from './outcomeService';
import { TOTAL_REGISTERED_STUDENTS } from '../mocks/seedData';
import { apiClient } from './apiClient';

export const reportService = {
  /**
   * Get overall system metrics for the administrative dashboard.
   */
  getDashboardSummary(): DashboardSummary {
    const users = authService.getUsers();
    const students = users.filter((u) => u.role === UserRole.STUDENT);
    const vendors = users.filter((u) => u.role === UserRole.VENDOR);
    const admins = users.filter((u) => u.role === UserRole.ADMIN);

    const schedules = scheduleService.getSchedules();
    const publishedMenu = menuService.getPublishedMenu();

    const instances = mealInstanceService.getAllMealInstances();
    const upcomingDeadlines = instances
      .filter((i) => i.status === 'RESPONSE_OPEN' || i.status === 'UPCOMING')
      .slice(0, 5);

    return {
      totalStudents: TOTAL_REGISTERED_STUDENTS, // 750 registered cohort
      totalVendors: vendors.length,
      totalAdmins: admins.length,
      configuredSchedules: schedules.filter((s) => s.enabled).length,
      publishedMenuVersion: publishedMenu?.versionNumber,
      upcomingDeadlines,
    };
  },

  /**
   * Get detailed per-meal reports combining responses, recommendations,
   * vendor decisions, and post-meal outcomes.
   */
  getMealReports(filters?: ReportFilters): MealReportEntry[] {
    let instances = mealInstanceService.getAllMealInstances();

    if (filters?.mealType) {
      instances = instances.filter((i) => i.mealType === filters.mealType);
    }
    if (filters?.startDate) {
      instances = instances.filter((i) => i.mealDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      instances = instances.filter((i) => i.mealDate <= filters.endDate!);
    }

    return instances.map((inst) => {
      const counts = responseService.getAggregateCounts(inst.id);
      const recommendation = forecastService.getRecommendation(inst.id);
      const decision = forecastService.getVendorDecision(inst.id) ?? undefined;
      const outcome = outcomeService.getOutcome(inst.id) ?? undefined;

      return {
        mealInstanceId: inst.id,
        mealDate: inst.mealDate,
        mealType: inst.mealType,
        counts,
        recommendation,
        decision,
        outcome,
      };
    });
  },

  /**
   * Fetch dashboard summary from FastAPI backend.
   */
  async fetchDashboardSummary(): Promise<DashboardSummary> {
    try {
      const summary = await apiClient.get<DashboardSummary>('/reports/summary');
      if (summary) return summary;
    } catch {
      // Fallback
    }
    return this.getDashboardSummary();
  },

  /**
   * Fetch meal reports from FastAPI backend with filters.
   */
  async fetchMealReports(filters?: ReportFilters): Promise<MealReportEntry[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.mealType) params.append('mealType', filters.mealType);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const query = params.toString() ? `?${params.toString()}` : '';
      const reports = await apiClient.get<MealReportEntry[]>(`/reports/meals${query}`);
      if (reports && Array.isArray(reports)) return reports;
    } catch {
      // Fallback
    }
    return this.getMealReports(filters);
  },
};
