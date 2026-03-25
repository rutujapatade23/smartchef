import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFavourites } from '../context/FavouritesContext';
import { RecipeSummary } from '../types';
import client from '../api/client';
import { Search, Scale, TrendingUp, TrendingDown, Minus, Heart, BookOpen, Settings2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  onSelectRecipe: (id: string) => void;
  selectedRecipeId: string | null;
  defaultMode?: 'all' | 'saved';
}

const BROWN       = '#3D2218';
const BROWN_LIGHT = '#4E2D1E';
const BROWN_BORDER= '#5C3622';
const GOLD        = '#D4920A';

const Sidebar: React.FC<SidebarProps> = ({ onSelectRecipe, selectedRecipeId, defaultMode = 'all' }) => {
  const { user } = useAuth();
  const { savedRecipes, loading: favLoading } = useFavourites();
  const [mode, setMode]       = useState<'all' | 'saved'>(defaultMode);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [search, setSearch]   = useState('');
  const [diet, setDiet]       = useState('');
  const [course, setCourse]   = useState('');
  const [loading, setLoading] = useState(false);

  // Advanced Filters State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minCal, setMinCal] = useState('');
  const [maxCal, setMaxCal] = useState('');
  const [maxTime, setMaxTime] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [includeIng, setIncludeIng] = useState('');
  const [excludeIng, setExcludeIng] = useState('');

  useEffect(() => {
    if (defaultMode) setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    if (mode === 'all') fetchRecipes();
  }, [diet, course, mode]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (diet) params.append('diet', diet);
      if (course) params.append('course', course);
      if (minCal) params.append('min_cal', minCal);
      if (maxCal) params.append('max_cal', maxCal);
      if (maxTime) params.append('max_time', maxTime);
      if (difficulty) params.append('difficulty', difficulty);
      if (cuisine) params.append('cuisine', cuisine);
      if (includeIng) params.append('include_ingredient', includeIng);
      if (excludeIng) params.append('exclude_ingredient', excludeIng);

      const res = await client.get(`/api/recipes/filter?${params.toString()}`);
      setRecipes(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const activeFiltersCount = [
    minCal, maxCal, maxTime, difficulty, cuisine, includeIng, excludeIng
  ].filter(Boolean).length;

  const clearFilters = () => {
    setMinCal('');
    setMaxCal('');
    setMaxTime('');
    setDifficulty('');
    setCuisine('');
    setIncludeIng('');
    setExcludeIng('');
    // Optionally refetch if we want to reset search as well
    // fetchRecipes();
  };

  const bmi = user ? user.weight / Math.pow(user.height / 100, 2) : 0;

  const getBMICategory = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: '#60A5FA', icon: <TrendingDown size={12} /> };
    if (val < 25)   return { label: 'Normal',      color: '#4ADE80', icon: <Minus size={12} /> };
    if (val < 30)   return { label: 'Overweight',  color: GOLD,      icon: <TrendingUp size={12} /> };
    return               { label: 'Obese',        color: '#C84B11', icon: <TrendingUp size={12} /> };
  };

  const bmiInfo = getBMICategory(bmi);

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

  return (
    <aside
      className="flex flex-col custom-scrollbar flex-shrink-0"
      style={{
        width: 300,
        minWidth: 300,
        // ← KEY FIX: use alignSelf stretch + minHeight so sidebar fills the entire content area
        alignSelf: 'stretch',
        background: BROWN,
        borderRight: `1px solid ${BROWN_BORDER}`,
        // sticky so it follows scroll but fills height
        position: 'sticky',
        top: 113,
        height: 'calc(100vh - 113px)',
        overflowY: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Mode Tabs */}
      <div className="p-3 flex gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${BROWN_BORDER}` }}>
        <button
          onClick={() => setMode('all')}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
          style={{
            background: mode === 'all' ? GOLD : BROWN_LIGHT,
            color: mode === 'all' ? BROWN : 'rgba(255,255,255,0.6)',
            border: `1px solid ${mode === 'all' ? GOLD : BROWN_BORDER}`
          }}
        >
          <BookOpen size={12} />
          All Recipes
        </button>
        <button
          onClick={() => setMode('saved')}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
          style={{
            background: mode === 'saved' ? '#e11d48' : BROWN_LIGHT,
            color: mode === 'saved' ? '#fff' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${mode === 'saved' ? '#e11d48' : BROWN_BORDER}`
          }}
        >
          <Heart size={12} fill={mode === 'saved' ? '#fff' : 'none'} />
          Saved
        </button>
      </div>

      {/* BMI Card */}
      <div className="p-5 flex-shrink-0" style={{ borderBottom: `1px solid ${BROWN_BORDER}` }}>
        <div className="rounded-2xl p-4" style={{ background: BROWN_LIGHT, border: `1px solid ${BROWN_BORDER}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale size={14} style={{ color: GOLD }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Health Profile
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: bmiInfo.color }}>
              {bmiInfo.icon} {bmiInfo.label}
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-serif font-bold text-4xl" style={{ color: GOLD }}>{bmi.toFixed(1)}</span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>BMI</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase pt-3"
            style={{ borderTop: `1px solid ${BROWN_BORDER}`, color: 'rgba(255,255,255,0.5)' }}
          >
            <span>{user?.height}cm</span>
            <span>{user?.weight}kg</span>
            <span style={{ color: GOLD }}>{user?.goal?.replace(/-/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Search + Filters - Hidden in Saved mode */}
      {mode === 'all' && (
        <div className="p-4 space-y-3 flex-shrink-0" style={{ borderBottom: `1px solid ${BROWN_BORDER}` }}>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search recipes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              style={{ background: BROWN_LIGHT, border: `1px solid ${BROWN_BORDER}`, color: '#F7F3ED' }}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.3)' }} />
          </form>
          <div className="flex gap-2">
            <select value={diet} onChange={e => setDiet(e.target.value)}
              className="flex-1 rounded-xl py-2 px-3 text-xs font-semibold cursor-pointer"
              style={{ background: BROWN_LIGHT, border: `1px solid ${BROWN_BORDER}`, color: '#F7F3ED', colorScheme: 'dark' }}
            >
              <option value="">All Diets</option>
              <option value="veg">Vegetarian</option>
              <option value="non-veg">Non-Veg</option>
            </select>
            <select value={course} onChange={e => setCourse(e.target.value)}
              className="flex-1 rounded-xl py-2 px-3 text-xs font-semibold cursor-pointer"
              style={{ background: BROWN_LIGHT, border: `1px solid ${BROWN_BORDER}`, color: '#F7F3ED', colorScheme: 'dark' }}
            >
              <option value="">All Courses</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
              <option value="dessert">Dessert</option>
              <option value="soup">Soup</option>
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
            style={{ 
              background: showAdvanced ? BROWN_LIGHT : 'transparent',
              border: `1px solid ${BROWN_BORDER}`,
              color: activeFiltersCount > 0 ? GOLD : 'rgba(255,255,255,0.4)'
            }}
          >
            <div className="flex items-center gap-2">
              <Settings2 size={12} />
              Filters {activeFiltersCount > 0 && `· ${activeFiltersCount}`}
            </div>
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Collapsible Advanced Filters */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4 pt-2"
              >
                {/* Calorie Range */}
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Calories (kcal)</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minCal}
                      onChange={e => setMinCal(e.target.value)}
                      className="w-1/2 bg-transparent border rounded-lg px-2 py-1.5 text-xs"
                      style={{ borderColor: BROWN_BORDER, color: '#F7F3ED' }}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxCal}
                      onChange={e => setMaxCal(e.target.value)}
                      className="w-1/2 bg-transparent border rounded-lg px-2 py-1.5 text-xs"
                      style={{ borderColor: BROWN_BORDER, color: '#F7F3ED' }}
                    />
                  </div>
                </div>

                {/* Max Time */}
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Max Time</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['', '15', '30', '60', '90'].map(val => (
                      <button
                        key={val}
                        onClick={() => setMaxTime(val)}
                        className="px-2.5 py-1 rounded-full text-[9px] font-bold transition-all"
                        style={{
                          background: maxTime === val ? GOLD : BROWN_LIGHT,
                          color: maxTime === val ? BROWN : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${maxTime === val ? GOLD : BROWN_BORDER}`
                        }}
                      >
                        {val === '' ? 'Any' : val === '90' ? '90m+' : `${val}m`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Difficulty</p>
                  <div className="flex gap-1.5">
                    {['Easy', 'Medium', 'Hard'].map(val => (
                      <button
                        key={val}
                        onClick={() => setDifficulty(difficulty === val ? '' : val)}
                        className="flex-1 py-1 rounded-lg text-[9px] font-bold transition-all"
                        style={{
                          background: difficulty === val ? GOLD : BROWN_LIGHT,
                          color: difficulty === val ? BROWN : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${difficulty === val ? GOLD : BROWN_BORDER}`
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuisine */}
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Cuisine</p>
                  <input
                    type="text"
                    placeholder="e.g. Punjabi, Italian"
                    value={cuisine}
                    onChange={e => setCuisine(e.target.value)}
                    className="w-full bg-transparent border rounded-lg px-2 py-1.5 text-xs"
                    style={{ borderColor: BROWN_BORDER, color: '#F7F3ED' }}
                  />
                </div>

                {/* Ingredients */}
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Include</p>
                    <input
                      type="text"
                      placeholder="Paneer..."
                      value={includeIng}
                      onChange={e => setIncludeIng(e.target.value)}
                      className="w-full bg-transparent border rounded-lg px-2 py-1.5 text-xs"
                      style={{ borderColor: BROWN_BORDER, color: '#F7F3ED' }}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">Exclude</p>
                    <input
                      type="text"
                      placeholder="Onion..."
                      value={excludeIng}
                      onChange={e => setExcludeIng(e.target.value)}
                      className="w-full bg-transparent border rounded-lg px-2 py-1.5 text-xs"
                      style={{ borderColor: BROWN_BORDER, color: '#F7F3ED' }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={fetchRecipes}
                    className="flex-[2] py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                    style={{ background: '#C84B11', color: '#fff' }}
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={clearFilters}
                    className="flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-all"
                    style={{ color: '#F7F3ED' }}
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Recipe List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
        <p className="text-[10px] font-bold uppercase tracking-widest px-2 mb-3"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          {mode === 'all' ? 'Recommended for you' : 'Your saved collection'}
        </p>

        {(mode === 'all' ? loading : favLoading) ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: mode === 'all' ? GOLD : '#e11d48', borderTopColor: 'transparent' }} />
          </div>
        ) : (mode === 'all' ? recipes : savedRecipes).length > 0 ? (
          (mode === 'all' ? recipes : savedRecipes).map(recipe => {
            const isSelected = selectedRecipeId === recipe.key;
            return (
              <button
                key={recipe.key}
                onClick={() => onSelectRecipe(recipe.key)}
                className="w-full text-left p-3 rounded-xl transition-all"
                style={{
                  background:  isSelected ? (mode === 'all' ? 'linear-gradient(135deg, #C84B11, #A33A0D)' : 'linear-gradient(135deg, #e11d48, #be123c)') : 'transparent',
                  border:      isSelected ? (mode === 'all' ? '1px solid #C84B11' : '1px solid #e11d48') : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = BROWN_LIGHT; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">{recipe.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif font-bold text-sm truncate"
                      style={{ color: isSelected ? '#fff' : '#F7F3ED' }}>
                      {recipe.name}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                      {recipe.cuisine} · {recipe.time}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center py-12 px-4 space-y-2">
            <p className="text-2xl">{mode === 'all' ? '🥣' : '💔'}</p>
            <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {mode === 'all' ? 'No recipes found' : 'No saved recipes yet'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;