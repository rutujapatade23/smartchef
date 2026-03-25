import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RecipeSummary } from '../types';
import client from '../api/client';
import { Search, Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SidebarProps {
  onSelectRecipe: (id: string) => void;
  selectedRecipeId: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelectRecipe, selectedRecipeId }) => {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [search, setSearch] = useState('');
  const [diet, setDiet] = useState('');
  const [course, setCourse] = useState('');
  const [loading, setLoading] = useState(false);

  const bmi = user ? user.weight / Math.pow(user.height / 100, 2) : 0;

  const getBMICategory = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: 'text-blue-400',   icon: <TrendingDown size={14} /> };
    if (val < 25)   return { label: 'Normal',      color: 'text-mint',       icon: <Minus size={14} /> };
    if (val < 30)   return { label: 'Overweight',  color: 'text-turmeric',   icon: <TrendingUp size={14} /> };
    return              { label: 'Obese',         color: 'text-spice',      icon: <TrendingUp size={14} /> };
  };

  const bmiInfo = getBMICategory(bmi);

  useEffect(() => {
    fetchRecipes();
  }, [diet, course]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const endpoint = (diet || course)
        ? `/api/recipes/filter?diet=${diet}&course=${course}`
        : '/api/recipes/all';
      const response = await client.get(endpoint);
      setRecipes(response.data);
    } catch (error) {
      console.error('Failed to fetch recipes', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) { fetchRecipes(); return; }
    setLoading(true);
    try {
      const response = await client.get(`/api/search?q=${search}`);
      setRecipes(response.data);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-[300px] h-[calc(100vh-73px)] sticky top-[73px] bg-ink text-paper flex flex-col border-r border-white/10">

      {/* Health Profile Card */}
      <div className="p-6 border-b border-white/5">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-turmeric" />
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">Health Profile</span>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold uppercase ${bmiInfo.color}`}>
              {bmiInfo.icon}
              {bmiInfo.label}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold">{bmi.toFixed(1)}</span>
            <span className="text-xs opacity-50 font-medium">BMI Score</span>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-[10px] font-bold uppercase tracking-tighter opacity-70">
            <span>{user?.height}cm</span>
            <span>{user?.weight}kg</span>
            <span className="text-turmeric">{user?.goal?.replace(/-/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-6 space-y-3">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-paper placeholder-paper/30 focus:outline-none focus:border-spice transition-colors"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
        </form>

        <div className="flex gap-2">
          {/* Diet dropdown — explicit dark styling so it's always visible */}
          <select
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            className="flex-1 bg-ink border border-white/20 text-paper rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-spice cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            <option value=""  className="bg-ink text-paper">All Diets</option>
            <option value="veg"     className="bg-ink text-paper">Vegetarian</option>
            <option value="non-veg" className="bg-ink text-paper">Non-Veg</option>
          </select>

          {/* Course dropdown */}
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="flex-1 bg-ink border border-white/20 text-paper rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-spice cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            <option value=""          className="bg-ink text-paper">All Courses</option>
            <option value="breakfast" className="bg-ink text-paper">Breakfast</option>
            <option value="lunch"     className="bg-ink text-paper">Lunch</option>
            <option value="dinner"    className="bg-ink text-paper">Dinner</option>
            <option value="snack"     className="bg-ink text-paper">Snack</option>
            <option value="dessert"   className="bg-ink text-paper">Dessert</option>
            <option value="soup"      className="bg-ink text-paper">Soup</option>
          </select>
        </div>
      </div>

      {/* Recipe List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2 custom-scrollbar">
        <h4 className="px-2 text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-4">
          Recommended for you
        </h4>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-spice border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recipes.length > 0 ? (
          recipes.map((recipe) => (
            <button
              key={recipe.key}
              onClick={() => onSelectRecipe(recipe.key)}
              className={`w-full text-left p-3 rounded-xl transition-all group ${
                selectedRecipeId === recipe.key
                  ? 'bg-spice text-paper shadow-lg shadow-spice/20 scale-[1.02]'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {recipe.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <h5 className="font-serif font-bold text-sm truncate">{recipe.name}</h5>
                  <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
                    selectedRecipeId === recipe.key ? 'text-paper/70' : 'text-paper/40'
                  }`}>
                    <span>{recipe.cuisine}</span>
                    <span>•</span>
                    <span>{recipe.time}</span>
                  </div>
                </div>
              </div>
            </button>
          ))
        ) : (
          <p className="text-center py-12 text-sm opacity-40 italic">No recipes found</p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
