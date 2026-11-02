// ============================================================
// Student Response History Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { responseService } from '@/services/responseService';
import { mealInstanceService } from '@/services/mealInstanceService';
import { menuService } from '@/services/menuService';
import { MealResponse, MealInstance } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  formatDate,
  formatTime,
  formatMealType,
  formatResponseChoice,
  getDayOfWeekFromDate,
  isBeforeDeadline,
} from '@/lib/utils';
import { History, Shield, Inbox } from 'lucide-react';
import { parseISO } from 'date-fns';

export const ResponseHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<MealResponse[]>([]);
  const [instancesMap, setInstancesMap] = useState<Record<string, MealInstance>>({});

  useEffect(() => {
    if (!user) return;
    const records = responseService.getMyHistory(user.id);
    setHistory(records);

    const map: Record<string, MealInstance> = {};
    const instances = mealInstanceService.getAllMealInstances();
    instances.forEach((i) => {
      map[i.id] = i;
    });
    setInstancesMap(map);
  }, [user]);

  const getMenuSummary = (inst?: MealInstance) => {
    if (!inst) return 'N/A';
    const mealDate = parseISO(inst.mealDate);
    const day = getDayOfWeekFromDate(mealDate);
    const entry = menuService.getMenuForMeal(day, inst.mealType, inst.menuVersionId);
    if (!entry) return 'Menu details';
    return entry.dishes.map((d) => d.name).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            My Response History
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Your personal log of meal attendance responses
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-lavender/60 border border-border rounded-lg text-xs text-text-secondary">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span>Private to your account</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span>Submitted Intentions</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="p-12 text-center text-text-secondary">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No response history found</p>
              <p className="text-xs mt-1">
                When you respond to upcoming meals, your intentions will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meal & Date</TableHead>
                  <TableHead>Menu Items</TableHead>
                  <TableHead>Your Response</TableHead>
                  <TableHead>Submitted / Updated</TableHead>
                  <TableHead>Deadline Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => {
                  const inst = instancesMap[record.mealInstanceId];
                  const isClosed = inst ? !isBeforeDeadline(inst.responseDeadline) : true;

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-semibold text-xs whitespace-nowrap">
                        <div>{inst ? formatMealType(inst.mealType) : 'Meal'}</div>
                        <div className="text-text-secondary font-normal text-[11px]">
                          {inst ? formatDate(inst.mealDate) : record.mealInstanceId}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-text-secondary max-w-xs truncate">
                        {getMenuSummary(inst)}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            record.choice === 'DEFINITELY_EATING'
                              ? 'success'
                              : record.choice === 'PROBABLY_EATING'
                              ? 'warning'
                              : 'error'
                          }
                          className="text-[11px]"
                        >
                          {formatResponseChoice(record.choice)}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                        {formatTime(record.updatedAt)} ({formatDate(record.updatedAt)})
                      </TableCell>

                      <TableCell>
                        {isClosed ? (
                          <Badge variant="muted" className="text-[10px]">
                            Locked
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Editable
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
