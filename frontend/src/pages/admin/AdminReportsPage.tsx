// ============================================================
// Administrator Reports & Analytics
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
  LineChart,
  Line,
} from 'recharts';
import { formatDate, formatMealType } from '@/lib/utils';
import { BarChart3, TrendingUp, Sparkles, AlertCircle } from 'lucide-react';

export const AdminReportsPage: React.FC = () => {
  const [reports, setReports] = useState<MealReportEntry[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<string>('ALL');

  useEffect(() => {
    let isMounted = true;
    async function loadReports() {
      const filters = selectedMealType !== 'ALL'
        ? { mealType: selectedMealType as MealType }
        : undefined;
      const data = await reportService.fetchMealReports(filters);
      if (isMounted) {
        setReports(data);
      }
    }
    loadReports();
    return () => {
      isMounted = false;
    };
  }, [selectedMealType]);

  const chartData = reports
    .filter((r) => r.recommendation)
    .map((r) => {
      const def = r.counts.definitelyEating;
      const prob = r.counts.probablyEating;
      const notEating = r.counts.notEating;
      const totalResponded = def + prob + notEating;
      const totalRegistered = r.counts.totalRegistered;
      const coveragePct = totalRegistered > 0 ? Math.round((totalResponded / totalRegistered) * 100) : 0;

      return {
        name: `${formatDate(r.mealDate).slice(0, 6)} ${formatMealType(r.mealType).slice(0, 1)}`,
        Definitely: def,
        Probably: prob,
        NotEating: notEating,
        CoveragePct: coveragePct,
        Recommended: r.recommendation?.recommendedPortions ?? 0,
        Prepared: r.outcome?.actualPreparedQuantity ?? r.decision?.finalPlannedQuantity ?? 0,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Institutional Reports & Waste Forecasting Evaluation
            </h2>
            <Badge variant="warning" className="text-xs">
              Demonstration Analytics
            </Badge>
          </div>
          <p className="text-sm text-text-secondary">
            Evaluation of student response coverage, preparation accuracy, and demand baselines.
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

      {/* Demonstration Notice */}
      <div className="p-4 bg-lavender/50 border border-border-light rounded-xl flex items-start gap-3 text-xs text-text-secondary">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-text-primary block">
            Academic / Demonstration Prototype Notice
          </span>
          <p className="leading-relaxed">
            All forecasting figures and response numbers represent simulated prototype values. Proving waste reduction requires formal dual-weighed baseline measurements during the live mess pilot phase.
          </p>
        </div>
      </div>

      {/* Grid of 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Intention Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Student Response Intentions</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Definite vs probable vs not eating response counts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
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
                  <Bar dataKey="Definitely" fill="#21864A" stackId="a" />
                  <Bar dataKey="Probably" fill="#C88712" stackId="a" />
                  <Bar dataKey="NotEating" fill="#C83C4A" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Recommended vs Actual Prepared */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>Recommended Portions vs Batch Prepared</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Baseline recommendation (F=B, Q=ceil(F*(1+m))) vs actual kitchen preparation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Line type="monotone" dataKey="Recommended" stroke="#8B5DD6" strokeWidth={2} />
                  <Line type="monotone" dataKey="Prepared" stroke="#21864A" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comprehensive Audit Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-border-light">
          <CardTitle className="text-base">Comprehensive Meal Demand Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meal & Date</TableHead>
                <TableHead>Definitely</TableHead>
                <TableHead>Probably</TableHead>
                <TableHead>Not Eating</TableHead>
                <TableHead>No Response</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead>Final Prepared</TableHead>
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

                  <TableCell className="text-xs text-success font-bold">
                    {r.counts.definitelyEating}
                  </TableCell>

                  <TableCell className="text-xs text-warning font-semibold">
                    {r.counts.probablyEating}
                  </TableCell>

                  <TableCell className="text-xs text-error font-semibold">
                    {r.counts.notEating}
                  </TableCell>

                  <TableCell className="text-xs text-text-primary font-bold">
                    {r.counts.noResponse}
                  </TableCell>

                  <TableCell className="text-xs font-semibold text-primary">
                    {r.recommendation?.recommendedPortions !== undefined && r.recommendation?.recommendedPortions !== null
                      ? `${r.recommendation.recommendedPortions} portions`
                      : <span className="text-text-secondary italic">Insufficient data</span>}
                  </TableCell>

                  <TableCell className="text-xs font-semibold">
                    {r.outcome?.actualPreparedQuantity !== undefined
                      ? `${r.outcome.actualPreparedQuantity} portions`
                      : r.decision?.finalPlannedQuantity !== undefined
                      ? `${r.decision.finalPlannedQuantity} portions (planned)`
                      : <span className="text-text-secondary italic">Not recorded</span>}
                  </TableCell>

                  <TableCell className="text-xs">
                    {r.outcome?.actualAttendance !== undefined ? (
                      <Badge variant="secondary" className="text-[11px]">
                        {r.outcome.actualAttendance} students
                      </Badge>
                    ) : (
                      <span className="text-text-secondary italic">Not recorded</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs">
                    {r.outcome?.leftoverQuantity !== undefined ? (
                      <span className="font-semibold text-warning">
                        {r.outcome.leftoverQuantity} {r.outcome.leftoverUnit || 'kg'}
                      </span>
                    ) : (
                      <span className="text-text-secondary italic">—</span>
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
