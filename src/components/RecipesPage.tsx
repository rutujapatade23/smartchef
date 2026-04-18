import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFavourites } from '../context/FavouritesContext';
import { RecipeSummary } from '../types';
import client from '../api/client';
import {
  Search, Flame, Clock, Heart, X, ChevronDown, SlidersHorizontal,
  Utensils, Star, Scale, TrendingDown, TrendingUp, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecipesPageProps {
  onSelectRecipe: (id: string) => void;
  selectedRecipeId: string | null;
  defaultMode?: 'all' | 'saved';
}

// Each course gets its own vivid color palette
const COURSES = [
  { value: '', label: 'All',       emoji: '🍽️', bg: 'from-orange-500 to-rose-500',   light: 'bg-orange-50  text-orange-600  border-orange-200' },
  { value: 'breakfast', label: 'Breakfast', emoji: '🥣', bg: 'from-amber-400 to-orange-500',  light: 'bg-amber-50   text-amber-700   border-amber-200'  },
  { value: 'lunch',     label: 'Lunch',     emoji: '🍛', bg: 'from-emerald-500 to-teal-500',  light: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
  { value: 'dinner',    label: 'Dinner',    emoji: '🍲', bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50  text-violet-700  border-violet-200' },
  { value: 'snack',     label: 'Snack',     emoji: '🥨', bg: 'from-pink-500 to-rose-500',     light: 'bg-pink-50    text-pink-700    border-pink-200'   },
  { value: 'dessert',   label: 'Dessert',   emoji: '🍮', bg: 'from-rose-400 to-pink-500',     light: 'bg-rose-50    text-rose-700    border-rose-200'   },
  { value: 'soup',      label: 'Soup',      emoji: '🍜', bg: 'from-sky-500 to-blue-600',      light: 'bg-sky-50     text-sky-700     border-sky-200'    },
];

// Colorful gradient backgrounds for cards — cycle through these
const CARD_GRADIENTS = [
  'from-orange-50 to-amber-50',
  'from-emerald-50 to-teal-50',
  'from-violet-50 to-purple-50',
  'from-pink-50 to-rose-50',
  'from-sky-50 to-blue-50',
  'from-amber-50 to-yellow-50',
  'from-indigo-50 to-violet-50',
  'from-teal-50 to-cyan-50',
];

const ACCENT_COLORS = [
  { border: 'hover:border-orange-300', ring: 'ring-orange-200', dot: 'bg-orange-400' },
  { border: 'hover:border-emerald-300', ring: 'ring-emerald-200', dot: 'bg-emerald-400' },
  { border: 'hover:border-violet-300', ring: 'ring-violet-200', dot: 'bg-violet-400' },
  { border: 'hover:border-pink-300', ring: 'ring-pink-200', dot: 'bg-pink-400' },
  { border: 'hover:border-sky-300', ring: 'ring-sky-200', dot: 'bg-sky-400' },
  { border: 'hover:border-amber-300', ring: 'ring-amber-200', dot: 'bg-amber-400' },
  { border: 'hover:border-indigo-300', ring: 'ring-indigo-200', dot: 'bg-indigo-400' },
  { border: 'hover:border-teal-300', ring: 'ring-teal-200', dot: 'bg-teal-400' },
];

const DIETS = [
  { value: '', label: 'All Diets' },
  { value: 'veg', label: '🌿 Vegetarian' },
  { value: 'non-veg', label: '🍗 Non-Veg' },
];

const TIME_OPTIONS = [
  { value: '', label: 'Any Time' },
  { value: '15', label: '≤ 15 min' },
  { value: '30', label: '≤ 30 min' },
  { value: '60', label: '≤ 1 hr' },
];

const DIFF_OPTIONS = ['', 'Easy', 'Medium', 'Hard'];

const RecipesPage: React.FC<RecipesPageProps> = ({ onSelectRecipe, selectedRecipeId, defaultMode = 'all' }) => {
  const { user } = useAuth();
  const { savedRecipes, isSaved, toggle } = useFavourites();

  const [mode, setMode] = useState<'all' | 'saved'>(defaultMode);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [diet, setDiet] = useState('');
  const [maxTime, setMaxTime] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => { if (defaultMode) setMode(defaultMode); }, [defaultMode]);
  useEffect(() => { if (mode === 'all') fetchRecipes(); }, [diet, course, mode]);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (diet) params.append('diet', diet);
      if (course) params.append('course', course);
      if (maxTime) params.append('max_time', maxTime);
      if (difficulty) params.append('difficulty', difficulty);
      params.append('per_page', '50');
      const res = await client.get(`/api/recipes/filter?${params.toString()}`);
      setRecipes(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [diet, course, maxTime, difficulty]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) { fetchRecipes(); return; }
    setLoading(true);
    try {
      const res = await client.get(`/api/search?q=${encodeURIComponent(search)}`);
      setRecipes(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const clearAll = () => {
    setSearch(''); setDiet(''); setCourse('');
    setMaxTime(''); setDifficulty('');
    setTimeout(fetchRecipes, 0);
  };

  const activeCount = [diet, maxTime, difficulty].filter(Boolean).length;
  const displayRecipes = mode === 'all' ? recipes : savedRecipes;

  // BMI helpers
  const bmi = user ? user.weight / Math.pow(user.height / 100, 2) : 0;
  const getBMIInfo = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: '#60A5FA', icon: <TrendingDown size={12} /> };
    if (val < 25)   return { label: 'Normal',      color: '#4ADE80', icon: <Minus size={12} /> };
    if (val < 30)   return { label: 'Overweight',  color: '#FBBF24', icon: <TrendingUp size={12} /> };
    return               { label: 'Obese',        color: '#f87171', icon: <TrendingUp size={12} /> };
  };
  const bmiInfo = getBMIInfo(bmi);

  const activeCourse = COURSES.find(c => c.value === course) || COURSES[0];

  return (
    <div className="min-h-full" style={{ background: 'linear-gradient(160deg, #fdf6ee 0%, #f9f0ff 50%, #eef6fd 100%)' }}>

      {/* ── Colorful Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a0a00] via-[#3D2218] to-[#1e1060] px-8 pt-8 pb-0">
        {/* decorative blobs */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-4 right-8 w-48 h-48 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          {/* Top row: greeting + health card + toggle */}
          <div className="flex items-start justify-between mb-7 gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-300/80">★ Recipe Library</span>
              </div>
              <h1 className="font-serif font-bold text-4xl text-white mb-1 drop-shadow">
                {mode === 'all'
                  ? (user ? `Good day, ${user.name.split(' ')[0]}! 👋` : 'All Recipes')
                  : 'Saved Recipes ❤️'}
              </h1>
              {user && mode === 'all' && (
                <p className="text-white/50 text-sm font-medium">
                  {recipes.length > 0 ? `${recipes.length}` : '50'}+ recipes · your{' '}
                  <span className="text-orange-300 font-bold">{user.goal.replace(/-/g, ' ')}</span> plan
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 flex-shrink-0">
              {/* Health Profile Card */}
              {user && (
                <div className="rounded-2xl p-4 min-w-[195px] backdrop-blur-sm"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Scale size={13} className="text-amber-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Health Profile</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: bmiInfo.color }}>
                      {bmiInfo.icon} {bmiInfo.label}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-serif font-bold text-3xl text-amber-400">{bmi.toFixed(1)}</span>
                    <span className="text-xs font-medium text-white/40">BMI</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase pt-2"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}>
                    <span>{user.height}cm</span>
                    <span>{user.weight}kg</span>
                    <span className="text-amber-400">{user.goal.replace(/-/g, ' ')}</span>
                  </div>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="flex flex-col gap-1.5 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <button onClick={() => setMode('all')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    mode === 'all' ? 'bg-white text-[#3D2218] shadow-lg' : 'text-white/50 hover:text-white'
                  }`}>
                  <Utensils size={12} /> All Recipes
                </button>
                <button onClick={() => setMode('saved')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    mode === 'saved' ? 'bg-rose-500 text-white shadow-lg' : 'text-white/50 hover:text-white'
                  }`}>
                  <Heart size={12} fill={mode === 'saved' ? 'white' : 'none'} /> Saved
                </button>
              </div>
            </div>
          </div>

          {/* Search bar only — course pills moved below */}
          {mode === 'all' && (
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Search recipes, cuisine, ingredients…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium focus:outline-none transition-all text-white placeholder-white/30"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); fetchRecipes(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10">
                    <X size={14} className="text-white/40" />
                  </button>
                )}
              </div>
              <button type="submit"
                className="px-6 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-lg text-white"
                style={{ background: 'linear-gradient(135deg, #C84B11, #e8621a)' }}>
                Search
              </button>
              <button type="button" onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                  activeCount > 0
                    ? 'text-white'
                    : 'text-white/60 hover:text-white'
                }`}
                style={activeCount > 0
                  ? { background: 'linear-gradient(135deg, #C84B11, #e8621a)', border: '1px solid #C84B11' }
                  : { border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)' }
                }>
                <SlidersHorizontal size={15} />
                Filters {activeCount > 0 && <span className="bg-white text-[#C84B11] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{activeCount}</span>}
                <ChevronDown size={13} className={`transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
              </button>
              {activeCount > 0 && (
                <button type="button" onClick={clearAll} className="px-3 text-xs font-bold text-white/40 hover:text-white transition-colors">
                  Clear
                </button>
              )}
            </form>
          )}
        </div>
      </div>

      {/* ── Course pill tabs — in white area below dark header ── */}
      {mode === 'all' && (
        <div className="bg-white border-b border-ink/8 px-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {COURSES.map(c => (
                <button key={c.value} onClick={() => setCourse(c.value)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-5 py-3 text-xs font-bold transition-all whitespace-nowrap border-b-2 ${
                    course === c.value
                      ? 'border-spice text-spice'
                      : 'border-transparent text-ink/40 hover:text-ink/70 hover:border-ink/20'
                  }`}
                >
                  <span className="text-base">{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Expandable more filters ── */}
      <AnimatePresence>
        {showMoreFilters && mode === 'all' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-ink/8">
            <div className="bg-white px-8 py-5 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">Diet</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIETS.map(d => (
                      <button key={d.value} onClick={() => setDiet(d.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          diet === d.value ? 'text-white' : 'bg-paper border border-ink/10 text-ink/50 hover:border-spice/40 hover:text-spice'
                        }`}
                        style={diet === d.value ? { background: 'linear-gradient(135deg, #C84B11, #e8621a)' } : {}}
                      >{d.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">Cook Time</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_OPTIONS.map(t => (
                      <button key={t.value} onClick={() => setMaxTime(t.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          maxTime === t.value ? 'text-white' : 'bg-paper border border-ink/10 text-ink/50 hover:border-spice/40 hover:text-spice'
                        }`}
                        style={maxTime === t.value ? { background: 'linear-gradient(135deg, #C84B11, #e8621a)' } : {}}
                      >{t.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">Difficulty</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIFF_OPTIONS.map(d => (
                      <button key={d} onClick={() => setDifficulty(d)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          difficulty === d ? 'text-white' : 'bg-paper border border-ink/10 text-ink/50 hover:border-spice/40 hover:text-spice'
                        }`}
                        style={difficulty === d ? { background: 'linear-gradient(135deg, #C84B11, #e8621a)' } : {}}
                      >{d || 'Any'}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => { fetchRecipes(); setShowMoreFilters(false); }}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #C84B11, #e8621a)' }}>
                Apply Filters
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Recipe Grid ── */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#C84B11', borderTopColor: 'transparent' }} />
            <p className="text-ink/40 text-sm font-medium">Finding the best recipes…</p>
          </div>
        ) : displayRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span className="text-5xl">{mode === 'saved' ? '💔' : '🥣'}</span>
            <p className="text-xl font-serif font-bold text-ink">
              {mode === 'saved' ? 'No saved recipes yet' : 'No recipes found'}
            </p>
            <p className="text-ink/40 text-sm">
              {mode === 'saved' ? 'Click the heart on any recipe to save it here.' : 'Try adjusting the filters above.'}
            </p>
            {mode === 'all' && (
              <button onClick={clearAll}
                className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #C84B11, #e8621a)' }}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Active filter badge only — NO recipe count text */}
            <div className="flex items-center gap-3 mb-5">
              {course && (
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${activeCourse.light}`}>
                  {activeCourse.emoji} {activeCourse.label}
                  <button onClick={() => setCourse('')} className="ml-1 opacity-60 hover:opacity-100">
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayRecipes.map((recipe, idx) => {
                const isSelected = selectedRecipeId === recipe.key;
                const saved = isSaved(recipe.key);
                const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];

                return (
                  <motion.div
                    key={recipe.key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.035, 0.5) }}
                    className={`group relative rounded-2xl border-2 transition-all duration-200 cursor-pointer hover:-translate-y-1.5 ${
                      isSelected
                        ? recipe.diet === 'Veg'
                          ? 'border-emerald-400 shadow-xl shadow-emerald-100 ring-2 ring-emerald-200'
                          : 'border-rose-400 shadow-xl shadow-rose-100 ring-2 ring-rose-200'
                        : recipe.diet === 'Veg'
                          ? 'border-transparent hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50'
                          : 'border-transparent hover:border-rose-200 hover:shadow-lg hover:shadow-rose-50'
                    }`}
                    style={{ background: 'white' }}
                    onClick={() => onSelectRecipe(recipe.key)}
                  >
                    {/* Top strip: GREEN for Veg, RED for Non-Veg */}
                    <div className="h-1.5 w-full rounded-t-2xl"
                      style={{
                        background: recipe.diet === 'Veg'
                          ? 'linear-gradient(90deg, #10b981, #059669)'
                          : 'linear-gradient(90deg, #f43f5e, #e11d48)'
                      }}
                    />

                    {/* Save button */}
                    <button
                      className="absolute top-4 right-3 z-10 p-1.5 rounded-full bg-white shadow-sm hover:scale-110 transition-transform"
                      onClick={e => { e.stopPropagation(); toggle(recipe.key); }}
                    >
                      <Heart
                        size={14}
                        fill={saved ? '#e11d48' : 'none'}
                        stroke={saved ? '#e11d48' : '#d1d5db'}
                        className="transition-colors group-hover:stroke-red-400"
                      />
                    </button>

                    <div className="p-4 pt-3">
                      {/* Emoji + Diet badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl drop-shadow-sm">{recipe.emoji}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          recipe.diet === 'Veg'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-rose-100 text-rose-600'
                        }`}>
                          {recipe.diet === 'Veg' ? '🌿 V' : '🍗 NV'}
                        </span>
                      </div>

                      {/* Name */}
                      <h3 className={`font-serif font-bold text-sm leading-snug mb-1 line-clamp-2 transition-colors ${
                        isSelected
                          ? recipe.diet === 'Veg' ? 'text-emerald-600' : 'text-rose-600'
                          : recipe.diet === 'Veg'
                            ? 'text-ink group-hover:text-emerald-600'
                            : 'text-ink group-hover:text-rose-600'
                      }`}>
                        {recipe.name}
                      </h3>

                      {/* Cuisine · Course */}
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/35 mb-3">
                        {recipe.cuisine} · {recipe.course}
                      </p>

                      {/* Footer chips */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50">
                          <Flame size={11} className="text-orange-500" />
                          <span className="text-[11px] font-bold text-orange-600">{Math.round(recipe.calories)} kcal</span>
                        </div>
                        <div className="flex items-center gap-1 text-ink/30">
                          <Clock size={11} />
                          <span className="text-[10px] font-semibold">{recipe.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Selected glow bar at bottom */}
                    {isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl"
                        style={{ background: 'linear-gradient(90deg, #C84B11, #f97316)' }} />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RecipesPage;
