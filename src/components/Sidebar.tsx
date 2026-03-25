import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RecipeSummary } from '../types';
import client from '../api/client';
import { Search, Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SidebarProps {
  onSelectRecipe: (id: string) => void;
  selectedRecipeId: string | null;
}

const BROWN       = '#3D2218';
const BROWN_LIGHT = '#4E2D1E';
const BROWN_BORDER= '#5C3622';
const GOLD        = '#D4920A';

const Sidebar: React.FC<SidebarProps> = ({ onSelectRecipe, selectedRecipeId }) => {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [search, setSearch]   = useState('');
  const [diet, setDiet]       = useState('');
  const [course, setCourse]   = useState('');
  const [loading, setLoading] = useState(false);

  const bmi = user ? user.weight / Math.pow(user.height / 100, 2) : 0;

  const getBMICategory = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: '#60A5FA', icon: <TrendingDown size={12} /> };
    if (val < 25)   return { label: 'Normal',      color: '#4ADE80', icon: <Minus size={12} /> };
    if (val < 30)   return { label: 'Overweight',  color: GOLD,      icon: <TrendingUp size={12} /> };
    return               { label: 'Obese',        color: '#C84B11', icon: <TrendingUp size={12} /> };
  };

  const bmiInfo = getBMICategory(bmi);

  useEffect(() => { fetchRecipes(); }, [diet, course]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const endpoint = (diet || course)
        ? `/api/recipes/filter?diet=${diet}&course=${course}`
        : '/api/recipes/all';
      const res = await client.get(endpoint);
      setRecipes(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

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

      {/* Search + Filters */}
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
      </div>

      {/* Recipe List — flex-1 so it fills remaining height */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
        <p className="text-[10px] font-bold uppercase tracking-widest px-2 mb-3"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          Recommended for you
        </p>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: GOLD, borderTopColor: 'transparent' }} />
          </div>
        ) : recipes.length > 0 ? (
          recipes.map(recipe => {
            const isSelected = selectedRecipeId === recipe.key;
            return (
              <button
                key={recipe.key}
                onClick={() => onSelectRecipe(recipe.key)}
                className="w-full text-left p-3 rounded-xl transition-all"
                style={{
                  background:  isSelected ? 'linear-gradient(135deg, #C84B11, #A33A0D)' : 'transparent',
                  border:      isSelected ? '1px solid #C84B11' : '1px solid transparent',
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
          <p className="text-center py-12 text-sm italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No recipes found
          </p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;