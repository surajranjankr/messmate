// ============================================================
// Weekly Menu Page (IIIT Dharwad Mess 1)
// ============================================================

import React, { useState } from 'react';
import { menuService } from '@/services/menuService';
import { DayOfWeek, MealType, MenuMealEntry } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDayOfWeek, formatMealType } from '@/lib/utils';
import { MENU_NOTES, MENU_SOURCE_INFO } from '@/mocks/menuData';
import {
  CalendarDays,
  Coffee,
  Sun,
  Cookie,
  Moon,
  Info,
  ShieldAlert,
  FileText,
} from 'lucide-react';

export const WeeklyMenuPage: React.FC = () => {
  const publishedMenu = menuService.getPublishedMenu();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(DayOfWeek.MONDAY);

  const days: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
  ];

  const mealIcons: Record<MealType, React.ReactNode> = {
    [MealType.BREAKFAST]: <Coffee className="w-4 h-4 text-primary" />,
    [MealType.LUNCH]: <Sun className="w-4 h-4 text-warning" />,
    [MealType.SNACKS]: <Cookie className="w-4 h-4 text-primary-dark" />,
    [MealType.DINNER]: <Moon className="w-4 h-4 text-primary" />,
  };

  const getMealsForDay = (day: DayOfWeek): MenuMealEntry[] => {
    if (!publishedMenu) return [];
    return publishedMenu.meals.filter((m) => m.dayOfWeek === day);
  };

  const dayMeals = getMealsForDay(selectedDay);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              Published Version {publishedMenu?.versionNumber ?? 1}
            </Badge>
            <span className="text-xs text-text-secondary font-medium">
              Source: IIIT Dharwad Mess 1 Menu
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Official Weekly Mess Menu
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Published menu schedule for students and mess operations
          </p>
        </div>
      </div>

      {/* Serving Rules & Source Document Banner */}
      <div className="p-4 bg-lavender/50 border border-border rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
          <Info className="w-4 h-4" />
          <span>Mess Rules & Limits (From Official Mess Document)</span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-text-secondary pt-1">
          {MENU_NOTES.map((note, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <span className="text-primary font-bold">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Day Selector Tabs */}
      <Tabs value={selectedDay} onValueChange={(val) => setSelectedDay(val as DayOfWeek)}>
        <TabsList className="w-full flex overflow-x-auto justify-start md:justify-center p-1 bg-lavender/60">
          {days.map((day) => (
            <TabsTrigger
              key={day}
              value={day}
              className="px-3 md:px-5 py-2 text-xs md:text-sm font-semibold shrink-0"
            >
              {formatDayOfWeek(day)}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dayMeals.map((meal) => (
              <Card key={meal.id} className="border-border shadow-xs hover:shadow-sm transition-shadow">
                <CardHeader className="pb-3 border-b border-border-light bg-lavender/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {mealIcons[meal.mealType]}
                      <span>{formatMealType(meal.mealType)}</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {meal.mealType}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-3 text-xs">
                  {/* Dishes */}
                  <div>
                    <span className="font-bold text-text-secondary uppercase tracking-wider text-[11px] block mb-2">
                      Main Dishes:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {meal.dishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="bg-card border border-border px-3 py-1.5 rounded-lg text-text-primary"
                        >
                          <span className="font-medium">{dish.name}</span>
                          {dish.alternatives && dish.alternatives.length > 0 && (
                            <span className="text-[11px] text-text-secondary ml-1 italic">
                              / {dish.alternatives.join(' / ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Accompaniments */}
                  {meal.accompaniments.length > 0 && (
                    <div className="pt-2 border-t border-border-light">
                      <span className="font-semibold text-text-secondary block mb-1">
                        Accompaniments & Beverages:
                      </span>
                      <p className="text-text-primary leading-relaxed">
                        {meal.accompaniments.join(' • ')}
                      </p>
                    </div>
                  )}

                  {/* Notes & Serving limits */}
                  {meal.notes.length > 0 && (
                    <div className="pt-2 border-t border-border-light text-[11px] text-primary bg-lavender/40 p-2 rounded-lg">
                      <span className="font-bold">Applicable rule: </span>
                      {meal.notes.join('; ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Tabs>
    </div>
  );
};
