// ============================================================
// Menu Management & Versioning Page
// ============================================================
// Supports full weekly menu editing, separate draft / published lifecycle,
// immutable version publishing, and historical version inspection.

import React, { useState, useEffect } from 'react';
import { menuService } from '@/services/menuService';
import {
  MenuVersion,
  MenuVersionStatus,
  MenuMealEntry,
  DayOfWeek,
  MealType,
  DishItem,
} from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDayOfWeek, formatMealType, formatDateTime, generateId } from '@/lib/utils';
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit,
  Save,
  Send,
  RotateCcw,
  History,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Info,
} from 'lucide-react';

export const MenuManagementPage: React.FC = () => {
  const [publishedVersion, setPublishedVersion] = useState<MenuVersion | null>(null);
  const [draftVersion, setDraftVersion] = useState<MenuVersion | null>(null);
  const [versionHistory, setVersionHistory] = useState<MenuVersion[]>([]);
  const [isEditingDraft, setIsEditingDraft] = useState<boolean>(false);

  // Active viewing/editing selection
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(DayOfWeek.MONDAY);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(MealType.BREAKFAST);

  // Dish edit dialog state
  const [isDishDialogOpen, setIsDishDialogOpen] = useState<boolean>(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishName, setDishName] = useState<string>('');
  const [dishAlternatives, setDishAlternatives] = useState<string>('');
  const [changeSummary, setChangeSummary] = useState<string>('');

  // Version inspection modal
  const [inspectingVersion, setInspectingVersion] = useState<MenuVersion | null>(null);

  // Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const days = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
  ];

  const mealTypes = [
    MealType.BREAKFAST,
    MealType.LUNCH,
    MealType.SNACKS,
    MealType.DINNER,
  ];

  const loadMenuData = () => {
    const pub = menuService.getPublishedMenu();
    setPublishedVersion(pub);

    const draft = menuService.getDraft();
    setDraftVersion(draft);
    setIsEditingDraft(!!draft);

    const history = menuService.getVersionHistory();
    setVersionHistory(history);
  };

  useEffect(() => {
    loadMenuData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Determine current active meals dataset (draft if exists, otherwise published)
  const activeVersion = draftVersion || publishedVersion;
  const currentMeals = activeVersion?.meals ?? [];

  const currentMealEntry = currentMeals.find(
    (m) => m.dayOfWeek === selectedDay && m.mealType === selectedMealType
  );

  const handleStartDraft = () => {
    const draft = menuService.getOrCreateDraft();
    setDraftVersion(draft);
    setIsEditingDraft(true);
    showToast('Draft menu created from current published version.');
  };

  const handleDiscardDraft = () => {
    if (window.confirm('Discard all un-published changes in this draft?')) {
      menuService.discardDraft();
      setDraftVersion(null);
      setIsEditingDraft(false);
      loadMenuData();
      showToast('Draft discarded.');
    }
  };

  const handlePublish = () => {
    if (!draftVersion) {
      setErrorMessage('No draft exists to publish.');
      return;
    }

    try {
      const summary = changeSummary.trim() || 'Menu revision update';
      const published = menuService.publishDraft(summary);
      setChangeSummary('');
      loadMenuData();
      showToast(`Successfully published Menu Version ${published.versionNumber}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error publishing menu.';
      setErrorMessage(msg);
    }
  };

  // Dish modifications
  const handleOpenAddDish = () => {
    if (!draftVersion) {
      handleStartDraft();
    }
    setEditingDishId(null);
    setDishName('');
    setDishAlternatives('');
    setIsDishDialogOpen(true);
  };

  const handleOpenEditDish = (dish: DishItem) => {
    if (!draftVersion) {
      handleStartDraft();
    }
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishAlternatives(dish.alternatives?.join(', ') ?? '');
    setIsDishDialogOpen(true);
  };

  const handleSaveDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim()) return;

    // Ensure draft exists
    let draft = draftVersion;
    if (!draft) {
      draft = menuService.getOrCreateDraft();
      setDraftVersion(draft);
    }

    const alts = dishAlternatives
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updatedMeals = draft.meals.map((meal) => {
      if (meal.dayOfWeek === selectedDay && meal.mealType === selectedMealType) {
        let updatedDishes: DishItem[];
        if (editingDishId) {
          updatedDishes = meal.dishes.map((d) =>
            d.id === editingDishId
              ? { ...d, name: dishName.trim(), alternatives: alts.length > 0 ? alts : undefined }
              : d
          );
        } else {
          updatedDishes = [
            ...meal.dishes,
            {
              id: `dish-${generateId().slice(0, 6)}`,
              name: dishName.trim(),
              alternatives: alts.length > 0 ? alts : undefined,
            },
          ];
        }
        return { ...meal, dishes: updatedDishes };
      }
      return meal;
    });

    const saved = menuService.saveDraft(updatedMeals);
    setDraftVersion(saved);
    setIsDishDialogOpen(false);
    showToast(editingDishId ? 'Dish updated in draft.' : 'Dish added to draft.');
  };

  const handleDeleteDish = (dishId: string) => {
    let draft = draftVersion;
    if (!draft) {
      draft = menuService.getOrCreateDraft();
      setDraftVersion(draft);
    }

    const updatedMeals = draft.meals.map((meal) => {
      if (meal.dayOfWeek === selectedDay && meal.mealType === selectedMealType) {
        return {
          ...meal,
          dishes: meal.dishes.filter((d) => d.id !== dishId),
        };
      }
      return meal;
    });

    const saved = menuService.saveDraft(updatedMeals);
    setDraftVersion(saved);
    showToast('Dish removed from draft.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Menu Management & Versioning
            </h2>
            {draftVersion ? (
              <Badge variant="warning" className="text-xs">
                Draft (v{draftVersion.versionNumber}) In Progress
              </Badge>
            ) : (
              <Badge variant="success" className="text-xs">
                Published (v{publishedVersion?.versionNumber ?? 1}) Active
              </Badge>
            )}
          </div>
          <p className="text-sm text-text-secondary">
            Manage weekly dishes, alternating-week alternatives, and publish immutable versions.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {draftVersion ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardDraft}
                className="text-error border-error/30 hover:bg-error-light text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Discard Draft
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePublish}
                className="gap-1.5 text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" /> Publish New Version
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleStartDraft}
              className="gap-1.5 text-xs"
            >
              <Edit className="w-3.5 h-3.5" /> Create Edit Draft
            </Button>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-success-light text-success border border-success/30 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-error-light text-error border border-error/30 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Tabs: Editor vs Version History */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'editor' | 'history')}>
        <TabsList className="bg-lavender/60">
          <TabsTrigger value="editor" className="text-xs">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Weekly Menu Editor
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <History className="w-3.5 h-3.5 mr-1.5" /> Version History ({versionHistory.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Editor */}
        <TabsContent value="editor" className="space-y-6 pt-4">
          {/* Day of Week Selector */}
          <div className="flex overflow-x-auto gap-2 pb-2">
            {days.map((day) => (
              <Button
                key={day}
                variant={selectedDay === day ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDay(day)}
                className="text-xs font-semibold shrink-0"
              >
                {formatDayOfWeek(day)}
              </Button>
            ))}
          </div>

          {/* Meal Type Selector */}
          <div className="flex gap-2">
            {mealTypes.map((type) => (
              <Button
                key={type}
                variant={selectedMealType === type ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedMealType(type)}
                className="text-xs shrink-0"
              >
                {formatMealType(type)}
              </Button>
            ))}
          </div>

          {/* Current Selected Meal Slot Card */}
          <Card>
            <CardHeader className="bg-lavender/30 pb-3 flex flex-row items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary uppercase">
                  {formatDayOfWeek(selectedDay)} &bull; {formatMealType(selectedMealType)}
                </span>
                <CardTitle className="text-lg mt-0.5">Dishes & Ingredients</CardTitle>
              </div>
              <Button
                size="sm"
                onClick={handleOpenAddDish}
                className="text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Dish
              </Button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Dish Items List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">
                  Configured Dishes:
                </span>

                {(!currentMealEntry || currentMealEntry.dishes.length === 0) ? (
                  <p className="text-xs text-text-secondary italic py-4">No dishes configured for this meal slot.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentMealEntry.dishes.map((dish) => (
                      <div
                        key={dish.id}
                        className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-text-primary text-sm">
                            {dish.name}
                          </div>
                          {dish.alternatives && dish.alternatives.length > 0 && (
                            <div className="text-[11px] text-text-secondary mt-0.5">
                              Alternating: <em>{dish.alternatives.join(', ')}</em>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDish(dish)}
                            className="h-7 w-7 p-0 text-text-secondary"
                            title="Edit dish"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDish(dish.id)}
                            className="h-7 w-7 p-0 text-error hover:bg-error-light"
                            title="Remove dish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Accompaniments & Notes Display */}
              {currentMealEntry && (
                <div className="pt-3 border-t border-border-light space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-text-secondary">Accompaniments: </span>
                    <span className="text-text-primary">
                      {currentMealEntry.accompaniments.join(' • ') || 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-text-secondary">Notes & Limits: </span>
                    <span className="text-primary">
                      {currentMealEntry.notes.join('; ') || 'Standard mess guidelines apply'}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Version History */}
        <TabsContent value="history" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-3 border-b border-border-light">
              <CardTitle className="text-base">Immutable Menu Version Audit Log</CardTitle>
              <CardDescription className="text-xs">
                Review all past published iterations and their publication timestamps
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-light">
                {versionHistory.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-primary">
                          Version {ver.versionNumber}
                        </span>
                        <Badge
                          variant={
                            ver.status === MenuVersionStatus.PUBLISHED
                              ? 'success'
                              : ver.status === MenuVersionStatus.DRAFT
                              ? 'warning'
                              : 'muted'
                          }
                          className="text-[10px]"
                        >
                          {ver.status}
                        </Badge>
                      </div>
                      <p className="text-text-secondary text-[11px]">
                        {ver.changeSummary || 'Standard weekly iteration'}
                      </p>
                      <span className="text-[10px] text-text-secondary block">
                        Created: {formatDateTime(ver.createdAt)}
                        {ver.publishedAt && ` • Published: ${formatDateTime(ver.publishedAt)}`}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectingVersion(ver)}
                      className="text-xs h-8 gap-1.5 self-start sm:self-auto"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Dishes
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dish Add/Edit Dialog */}
      <Dialog open={isDishDialogOpen} onOpenChange={setIsDishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDishId ? 'Edit Dish Entry' : 'Add Dish to Menu Slot'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveDish} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="dishName">Dish Name</Label>
              <Input
                id="dishName"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder="e.g. Masala Dosa"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alternatives">
                Alternating-Week Alternatives (Comma-separated)
              </Label>
              <Input
                id="alternatives"
                value={dishAlternatives}
                onChange={(e) => setDishAlternatives(e.target.value)}
                placeholder="e.g. Poha with Sev, Sheera"
              />
              <p className="text-[11px] text-text-secondary">
                For slash-separated menu items that rotate every other week.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDishDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Save to Draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Version Inspection Modal */}
      {inspectingVersion && (
        <Dialog open={!!inspectingVersion} onOpenChange={() => setInspectingVersion(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Inspecting Menu Version {inspectingVersion.versionNumber} ({inspectingVersion.status})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-lavender/50 rounded-lg text-text-secondary">
                <span className="font-semibold block text-text-primary">Summary:</span>
                {inspectingVersion.changeSummary || 'None'}
              </div>

              <div className="space-y-3">
                <span className="font-bold text-text-primary block">Meals Included (28 total slots):</span>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                  {inspectingVersion.meals.map((m) => (
                    <div key={m.id} className="p-2 border border-border rounded-lg bg-card">
                      <div className="font-semibold text-primary">
                        {formatDayOfWeek(m.dayOfWeek)} - {formatMealType(m.mealType)}
                      </div>
                      <div className="text-[11px] text-text-secondary truncate mt-0.5">
                        {m.dishes.map((d) => d.name).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setInspectingVersion(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
