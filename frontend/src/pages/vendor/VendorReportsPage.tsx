// ============================================================
// Vendor Reports & Analytics
// ============================================================

import React, { useState, useEffect } from 'react';
import { reportService } from '@/services/reportService';
import { MealReportEntry, MealType } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { formatDate, formatMealType } from '@/lib/utils';
import { BarChart3, Sparkles, TrendingUp, Filter, AlertCircle } from 'lucide-react';

export const VendorReportsPage: React.FC = () => {
  const [reports, setReports] = useState<MealReportEntry[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<string>('ALL');

  useEffect(() => {
    const filters = selectedMealType !== 'ALL'
      ? { mealType: selectedMealType as MealType }
      : undefined;
    const data = reportService.getMealReports(filters);
    setReports(data);
  }, [selectedMealType]);

  // Prepare chart data comparing recommended vs planned/prepared
  const chartData = reports
    .filter((r) => r.recommendation && (r.decision || r.outcome))
    .map((r) => ({
      name: `${formatDate(r.mealDate).slice(0, 6)} ${formatMealType(r.mealType).slice(0, 1)}`,
      Recommended: r.recommendation?.recommendedPortions ?? 0,
      Planned: r.decision?.finalPlannedQuantity ?? r.recommendation?.recommendedPortions ?? 0,
      Prepared: r.outcome?.actualPreparedQuantity ?? 0,
      Attendance: r.outcome?.actualAttendance ?? 0,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Kitchen Preparation Reports
            </h2>
            <Badge variant="warning" className="text-xs">
              Demonstration Data
            </Badge>
          </div>
          <p className="text-sm text-text-secondary">
            Comparative analysis of recommended portions, actual prepared quantities, and attendance.
          </p>
        </div>

        {/* Filter */}
        <div className="w-48">
          <Select
            value={selectedMealType}
            onChange={(e) => setSelectedMealType(e.target.value)}
          >
            <option value="ALL">All Meal Types</option>
            <option value={MealType.BREAKFAST}>Breakfast</option>
            <option value={MealType.LUNCH}>Lunch</option>
            <option value={MealType.SNACKS}>Snacks</option>
            <option value={MealType.DINNER}>Dinner</option>
          </Select>
        </div>
      </div>

      {/* Demonstration notice */}
      <div className="p-3.5 bg-lavender/50 border border-border-light rounded-xl flex items-start gap-2.5 text-xs text-text-secondary">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-text-primary">
            Illustrative Demonstration Dataset
          </span>
          <p className="leading-relaxed">
            Data points shown here are generated from prototype simulations and recorded demo outcomes. No claims of measured food waste reduction can be made until the operational pilot conducts dual-weighed baseline measurements.
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span>Recommended vs Planned vs Prepared Portions</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Comparison of recommended demand versus vendor kitchen decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-text-secondary">
              No historical data available for the selected filter.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E0F1" />
                  <XAxis dataKey="name" fontSize={11} stroke="#6B6577" />
                  <YAxis fontSize={11} stroke="#6B6577" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E7E0F1',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Recommended" fill="#8B5DD6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Planned" fill="#6D35C5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Prepared" fill="#21864A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-border-light">
          <CardTitle className="text-base">Per-Meal Audit Records</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meal & Date</TableHead>
                <TableHead>Definitely / Probably / No Resp</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead>Planned Batch</TableHead>
                <TableHead>Actual Prepared</TableHead>
                <TableHead>Actual Attendance</TableHead>
                <TableHead>Leftovers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.mealInstanceId}>
                  <TableCell className="font-semibold text-xs whitespace-nowrap">
                    <div>{formatMealType(r.mealType)}</div>
                    <div className="text-text-secondary font-normal text-[11px]">
                      {formatDate(r.mealDate)}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs">
                    <span className="text-success font-medium">{r.counts.definitelyEating}</span>
                    <span className="text-text-secondary"> / </span>
                    <span className="text-warning font-medium">{r.counts.probablyEating}</span>
                    <span className="text-text-secondary"> / </span>
                    <span className="text-text-secondary">{r.counts.noResponse}</span>
                  </TableCell>

                  <TableCell className="text-xs font-medium text-primary">
                    {r.recommendation ? `${r.recommendation.recommendedPortions} port.` : '—'}
                  </TableCell>

                  <TableCell className="text-xs font-semibold">
                    {r.decision ? (
                      <Badge variant="secondary" className="text-[11px]">
                        {r.decision.finalPlannedQuantity} port.
                      </Badge>
                    ) : (
                      <span className="text-text-secondary italic">Pending</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs">
                    {r.outcome?.actualPreparedQuantity !== undefined
                      ? `${r.outcome.actualPreparedQuantity} port.`
                      : '—'}
                  </TableCell>

                  <TableCell className="text-xs">
                    {r.outcome?.actualAttendance !== undefined
                      ? `${r.outcome.actualAttendance} students`
                      : '—'}
                  </TableCell>

                  <TableCell className="text-xs">
                    {r.outcome?.leftoverQuantity !== undefined ? (
                      <span className="font-semibold text-warning">
                        {r.outcome.leftoverQuantity} {r.outcome.leftoverUnit}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
