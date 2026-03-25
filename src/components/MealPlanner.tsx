import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Flame, ChefHat, Clock, Loader, ChevronRight, History, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Dish {
  slot:       string;
  recipe_id:  string;
  name:       string;
  calories:   number;
  protein:    number;
  carbs:      number;
  fat:        number;
  cuisine:    string;
  diet:       string;
  course:     string;
  difficulty: string;
  time_mins:  number;
  emoji:      string;
}

interface MealSlot {
  dishes:          Dish[];
  total_calories:  number;
}

interface DayPlan {
  day:            number;
  total_calories: number;
  meals: {
    Breakfast: MealSlot;
    Lunch:     MealSlot;
    Snack:     MealSlot;
    Dinner:    MealSlot;
  };
}

interface Props {
  onViewRecipe?:    (id: string) => void;
  savedPlan?:       DayPlan[] | null;
  onPlanGenerated?: (plan: DayPlan[]) => void;
}

interface HistoryEntry {
  id: number;
  plan_name: string;
  days: number;
  diet: string;
  daily_calories: number;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MEAL_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Breakfast: { text: '#D4920A', bg: 'rgba(212,146,10,0.06)',  border: 'rgba(212,146,10,0.15)' },
  Lunch:     { text: '#1A6B4A', bg: 'rgba(26,107,74,0.06)',   border: 'rgba(26,107,74,0.15)'  },
  Dinner:    { text: '#C84B11', bg: 'rgba(200,75,17,0.06)',   border: 'rgba(200,75,17,0.15)'  },
  Snack:     { text: '#7C3AED', bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.15)' },
};

const MEAL_ICONS: Record<string, string> = {
  Breakfast: '🌅',
  Lunch:     '☀️',
  Snack:     '🍎',
  Dinner:    '🌙',
};

const SLOT_LABELS: Record<string, string> = {
  main:  'Main',
  side:  'Side',
  carb:  'Carb',
  dal:   'Dal / Curry',
  sabji: 'Sabji',
  extra: 'Extra',
  snack: 'Snack',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Component ────────────────────────────────────────────────────────────────

const MealPlanner: React.FC<Props> = ({ onViewRecipe, savedPlan, onPlanGenerated }) => {
  const { user } = useAuth();
  const [plan, setPlan]           = useState<DayPlan[] | null>(null);
  const [loading, setLoading]     = useState(false);
  const [activeDay, setActiveDay] = useState(0);
  const [gender, setGender]       = useState<'female' | 'male'>('female');

  // History State
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Restore saved plan when switching back to this tab
  useEffect(() => {
    if (savedPlan && !plan) {
      setPlan(savedPlan);
    }
  }, [savedPlan]);

  const loadHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const res = await client.get('/api/mealplan/history');
      setHistory(res.data);
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  // ── Mifflin-St Jeor BMR ────────────────────────────────────────────────────
  function calcDailyCalories(g: 'male' | 'female' = gender): number {
    if (!user) return 2000;
    const age  = (user as any).age ?? 22;
    const h    = user.height;
    const w    = user.weight;
    const bmr  = g === 'male'
      ? 10 * w + 6.25 * h - 5 * age + 5
      : 10 * w + 6.25 * h - 5 * age - 161;
    const tdee = bmr * 1.375;   // lightly active

    if (user.goal === 'weight-loss')  return Math.round(tdee - 400);
    if (user.goal === 'weight-gain')  return Math.round(tdee + 400);
    if (user.goal === 'muscle-gain')  return Math.round(tdee + 200);
    return Math.round(tdee);
  }

  const [settings, setSettings] = useState({
    days:           7,
    diet:           user?.goal === 'muscle-gain' ? 'Non-Veg' : 'Veg',
    daily_calories: calcDailyCalories(),
  });

  // ── Generate ──────────────────────────────────────────────────────────────
  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await client.post('/api/mealplan', {
        daily_calories: settings.daily_calories,
        diet:           settings.diet,
        days:           settings.days,
        goal:           user?.goal ?? 'maintenance',
      });
      const newPlan: DayPlan[] = res.data.plan;
      setPlan(newPlan);
      setActiveDay(0);
      if (onPlanGenerated) onPlanGenerated(newPlan);
      loadHistory(); // Refresh history
    } catch (err) {
      console.error('Meal plan failed', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanFromHistory = async (id: number) => {
    setLoading(true);
    try {
      const res = await client.get(`/api/mealplan/history/${id}`);
      const historyPlan: DayPlan[] = res.data.plan;
      setPlan(historyPlan);
      setActiveDay(0);
      if (onPlanGenerated) onPlanGenerated(historyPlan);
      setShowHistory(false);
    } catch (e) {
      console.error('Failed to load plan from history', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryEntry = async (id: number) => {
    if (!window.confirm('Delete this meal plan from your history?')) return;
    try {
      await client.delete(`/api/mealplan/history/${id}`);
      loadHistory();
    } catch (e) {
      console.error('Failed to delete history entry', e);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-spice text-paper rounded-xl flex items-center justify-center">
              <CalendarDays size={20} />
            </div>
            <h1 className="text-4xl font-serif font-bold">Meal Planner</h1>
          </div>
          <p className="text-ink/50">
            Your personalised {settings.days}-day Indian meal plan — multiple dishes per meal,
            all within your <strong>{user?.goal?.replace(/-/g, ' ')}</strong> calorie budget.
          </p>
        </div>
        
        {user && (
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-ink/10 hover:bg-paper"
            style={{ color: showHistory ? '#C84B11' : 'rgba(13,13,13,0.5)' }}
          >
            <History size={16} />
            History
          </button>
        )}
      </div>

      {/* ── History Panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-ink/5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-ink/40">Past Plans</h3>
                <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-paper rounded-lg transition-colors">
                  <X size={16} className="text-ink/30" />
                </button>
              </div>

              {historyLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader size={24} className="animate-spin text-spice/30" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-center py-8 text-sm italic text-ink/30">No saved plans yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {history.map(entry => (
                    <div key={entry.id} className="p-4 rounded-2xl border border-ink/5 hover:border-spice/20 transition-all flex items-center justify-between group">
                      <div>
                        <p className="font-serif font-bold text-sm">{entry.plan_name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink/30 mt-0.5">
                          {entry.diet} · {entry.days} days · {entry.daily_calories} kcal
                        </p>
                        <p className="text-[9px] text-ink/20 mt-1">
                          {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => loadPlanFromHistory(entry.id)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-spice text-paper hover:opacity-90 transition-all"
                        >
                          Load
                        </button>
                        <button 
                          onClick={() => deleteHistoryEntry(entry.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings Card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-ink/5 mb-8">
        <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-ink/40 mb-5">Customise Your Plan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">

          {/* Gender */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Gender</label>
            <div className="flex gap-2">
              {(['female', 'male'] as const).map(g => (
                <button key={g} onClick={() => {
                  setGender(g);
                  setSettings(s => ({ ...s, daily_calories: calcDailyCalories(g) }));
                }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border"
                  style={{
                    background:  gender === g ? '#C84B11' : 'white',
                    color:       gender === g ? 'white'   : 'rgba(13,13,13,0.4)',
                    borderColor: gender === g ? '#C84B11' : 'rgba(13,13,13,0.1)',
                  }}
                >
                  {g === 'female' ? '♀ F' : '♂ M'}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Calories */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Daily Target (kcal)</label>
            <input
              type="number"
              value={settings.daily_calories}
              onChange={e => setSettings(s => ({ ...s, daily_calories: Number(e.target.value) }))}
              className="w-full bg-paper border border-ink/10 rounded-xl py-2.5 px-4 font-bold text-lg focus:outline-none focus:border-spice transition-colors"
              min={800} max={4000} step={50}
            />
            <p className="text-[10px] text-ink/30">Mifflin-St Jeor · {user?.goal?.replace(/-/g, ' ')}</p>
          </div>

          {/* Diet */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Diet</label>
            <div className="flex gap-2">
              {['Veg', 'Non-Veg'].map(d => (
                <button key={d} onClick={() => setSettings(s => ({ ...s, diet: d }))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border"
                  style={{
                    background:  settings.diet === d ? '#C84B11' : 'white',
                    color:       settings.diet === d ? 'white'   : 'rgba(13,13,13,0.4)',
                    borderColor: settings.diet === d ? '#C84B11' : 'rgba(13,13,13,0.1)',
                  }}
                >
                  {d === 'Veg' ? '🌿 Veg' : '🍗 Non-Veg'}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Duration</label>
            <div className="flex gap-2">
              {[3, 5, 7].map(d => (
                <button key={d} onClick={() => setSettings(s => ({ ...s, days: d }))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border"
                  style={{
                    background:  settings.days === d ? '#C84B11' : 'white',
                    color:       settings.days === d ? 'white'   : 'rgba(13,13,13,0.4)',
                    borderColor: settings.days === d ? '#C84B11' : 'rgba(13,13,13,0.1)',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={generatePlan} disabled={loading}
          className="mt-6 w-full text-paper py-4 rounded-2xl font-bold text-base uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
          style={{ background: loading ? '#aaa' : '#C84B11' }}
        >
          {loading
            ? <><Loader size={18} className="animate-spin" /> Generating your plan…</>
            : <><ChefHat size={18} /> {plan ? 'Regenerate Plan' : 'Generate My Meal Plan'}</>
          }
        </button>
      </div>

      {/* ── Plan Display ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {plan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Day Selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {plan.map((day, idx) => (
                <button key={idx} onClick={() => setActiveDay(idx)}
                  className="flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-2xl transition-all border"
                  style={{
                    background:  activeDay === idx ? '#C84B11' : 'white',
                    color:       activeDay === idx ? 'white'   : 'rgba(13,13,13,0.6)',
                    borderColor: activeDay === idx ? '#C84B11' : 'rgba(13,13,13,0.08)',
                    boxShadow:   activeDay === idx ? '0 4px 20px rgba(200,75,17,0.25)' : 'none',
                  }}
                >
                  <span className="text-[10px] uppercase tracking-widest font-bold opacity-80">{DAY_NAMES[idx % 7]}</span>
                  <span className="font-serif font-bold text-lg leading-tight">{idx + 1}</span>
                  <span className="text-[10px] font-bold mt-1 opacity-60">{day.total_calories} cal</span>
                </button>
              ))}
            </div>

            {/* Active Day Content */}
            {plan[activeDay] && (
              <motion.div key={activeDay} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>

                {/* Day Summary Banner */}
                <div className="rounded-2xl px-6 py-4 mb-6 flex items-center justify-between"
                  style={{ background: '#FDF0E8', border: '1px solid rgba(200,75,17,0.15)' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-1">
                      {DAY_NAMES[activeDay % 7]}day — Day {activeDay + 1}
                    </p>
                    <p className="font-serif font-bold text-2xl text-ink">
                      {plan[activeDay].total_calories}{' '}
                      <span className="text-sm font-sans text-ink/40">kcal · 1 person</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-spice justify-end">
                      <Flame size={16} />
                      <span className="text-sm font-bold">Target: {settings.daily_calories} kcal</span>
                    </div>
                    <p className="text-[10px] text-ink/30 mt-1">All calories shown per 1 serving</p>
                  </div>
                </div>

                {/* Meal Slots */}
                <div className="space-y-6">
                  {(['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const).map((mealSlot) => {
                    const mealData = plan[activeDay].meals[mealSlot];
                    if (!mealData || !mealData.dishes || mealData.dishes.length === 0) return null;
                    const colors = MEAL_COLORS[mealSlot];

                    return (
                      <div key={mealSlot} className="rounded-3xl overflow-hidden border"
                        style={{ borderColor: colors.border }}>

                        {/* Meal Slot Header */}
                        <div className="px-6 py-4 flex items-center justify-between"
                          style={{ background: colors.bg }}>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{MEAL_ICONS[mealSlot]}</span>
                            <div>
                              <span className="text-xs uppercase tracking-widest font-bold"
                                style={{ color: colors.text }}>
                                {mealSlot}
                              </span>
                              <p className="text-[10px] text-ink/40 font-medium mt-0.5">
                                {mealData.dishes.length} dish{mealData.dishes.length > 1 ? 'es' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-serif font-bold text-xl" style={{ color: colors.text }}>
                              {mealData.total_calories}
                            </p>
                            <p className="text-[10px] text-ink/30 font-bold uppercase">kcal total</p>
                          </div>
                        </div>

                        {/* Individual Dishes */}
                        <div className="divide-y" style={{ background: 'white', borderColor: colors.border }}>
                          {mealData.dishes.map((dish, dishIdx) => (
                            <div key={dishIdx} className="px-6 py-4 flex items-center gap-4 hover:bg-paper/50 transition-colors">

                              {/* Slot label pill */}
                              <div className="flex-shrink-0 w-20 text-center">
                                <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
                                  style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}>
                                  {SLOT_LABELS[dish.slot] ?? dish.slot}
                                </span>
                              </div>

                              {/* Emoji */}
                              <span className="text-2xl flex-shrink-0">{dish.emoji}</span>

                              {/* Name + meta */}
                              <div className="flex-1 min-w-0">
                                <p className="font-serif font-semibold text-base leading-tight truncate">{dish.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ink/40 font-bold uppercase tracking-wider">
                                  <span>{dish.cuisine}</span>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5"><Clock size={9} /> {dish.time_mins}m</span>
                                  <span>·</span>
                                  <span>{dish.diet}</span>
                                </div>
                              </div>

                              {/* Calories + macros */}
                              <div className="text-right flex-shrink-0 hidden sm:block">
                                <p className="font-serif font-bold text-lg" style={{ color: colors.text }}>
                                  {dish.calories}
                                </p>
                                <p className="text-[10px] text-ink/30 font-bold uppercase">kcal</p>
                                <div className="flex gap-2 mt-0.5 text-[10px] font-bold text-ink/40">
                                  <span>P {dish.protein}g</span>
                                  <span>C {dish.carbs}g</span>
                                  <span>F {dish.fat}g</span>
                                </div>
                              </div>

                              {/* View button */}
                              {onViewRecipe && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onViewRecipe(dish.recipe_id); }}
                                  className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all hover:opacity-80"
                                  style={{ background: colors.text, color: 'white' }}
                                >
                                  View <ChevronRight size={11} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tip */}
                <div className="mt-6 bg-turmeric/5 border border-turmeric/10 rounded-2xl px-6 py-4 flex items-center gap-4">
                  <span className="text-2xl">💡</span>
                  <p className="text-sm text-ink/60 italic">
                    All calories shown are per 1 serving (1 person).
                    Plan tailored to your <strong>{user?.goal?.replace(/-/g, ' ')}</strong> goal
                    at {settings.daily_calories} kcal/day.
                  </p>
                </div>

              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!plan && !loading && (
        <div className="text-center py-20 opacity-30">
          <CalendarDays size={64} className="mx-auto mb-4" />
          <p className="font-serif text-2xl italic">Your meal plan will appear here</p>
          <p className="text-sm mt-2">Set your preferences above and hit Generate</p>
        </div>
      )}
    </div>
  );
};

export default MealPlanner;