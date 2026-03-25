import React, { useState, useEffect, useRef } from 'react';
import { RecipeDetail, RecipeSummary } from '../types';
import client from '../api/client';
import NutritionCard from './NutritionCard';
import { Users, Clock, Flame, ChevronRight, Info, AlertCircle, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface RecipeDetailViewProps {
  recipeId: string | null;
  onSelectRecipe?: (id: string) => void;
  defaultServings?: number;
}

function parseQty(qty: string): number {
  if (!qty || qty === '—') return 0;
  const trimmed = qty.trim();
  const mixed = trimmed.match(/^(\d+)[\s\-]+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = trimmed.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  return parseFloat(trimmed) || 0;
}

function formatQty(val: number): string {
  if (val === 0) return '—';
  const fracs: [number, string][] = [
    [0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾'],
  ];
  const whole = Math.floor(val);
  const decimal = val - whole;
  for (const [f, sym] of fracs) {
    if (Math.abs(decimal - f) < 0.05) return whole > 0 ? `${whole} ${sym}` : sym;
  }
  return val % 1 === 0 ? String(val) : val.toFixed(1);
}

// ── Featured empty state ───────────────────────────────────────────────────
const FeaturedGrid: React.FC<{ onSelect: (id: string) => void }> = ({ onSelect }) => {
  const { user } = useAuth();
  const [featured, setFeatured] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        if (user) {
          const res = await client.post('/api/recommend', {
            height: user.height, weight: user.weight,
            goal: user.goal, diet: 'Veg', n: 6,
          });
          setFeatured(res.data.recipes || []);
        } else {
          const res = await client.get('/api/recipes/all?per_page=6');
          setFeatured(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-spice border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Star size={16} className="text-spice" fill="currentColor" />
          <span className="text-xs font-bold uppercase tracking-widest text-spice">Recommended for you</span>
        </div>
        <h2 className="font-serif font-bold text-4xl text-ink">
          {user ? `Good day, ${user.name.split(' ')[0]}!` : 'What shall we cook today?'}
        </h2>
        <p className="text-ink/50 mt-2">
          {user
            ? `Based on your ${user.goal.replace(/-/g, ' ')} goal — here are today's picks.`
            : 'Select a recipe from the sidebar or explore these popular dishes.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featured.map((recipe, idx) => (
          <motion.button key={recipe.key}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            onClick={() => onSelect(recipe.key)}
            className="text-left bg-white rounded-2xl p-5 border border-ink/5 shadow-sm hover:shadow-md hover:border-spice/20 hover:-translate-y-1 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{recipe.emoji}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-paper text-ink/40 border border-ink/5">
                {recipe.course}
              </span>
            </div>
            <h3 className="font-serif font-bold text-sm leading-tight mb-1 group-hover:text-spice transition-colors line-clamp-2">
              {recipe.name}
            </h3>
            <p className="text-[10px] text-ink/40 font-bold uppercase tracking-wider mb-3">
              {recipe.cuisine} · {recipe.time}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Flame size={12} className="text-spice" />
                <span className="text-xs font-bold text-spice">{Math.round(recipe.calories)} kcal</span>
              </div>
              <ChevronRight size={14} className="text-ink/20 group-hover:text-spice transition-colors" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipeId, onSelectRecipe, defaultServings = 1
}) => {
  const [recipe, setRecipe]   = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [servings, setServings] = useState(defaultServings);
  const baseServingsRef = useRef(1);
  const emojiRef = useRef<string>('🍛');

  useEffect(() => {
    if (recipeId) {
      setServings(defaultServings);
      fetchRecipe(recipeId);
    }
  }, [recipeId, defaultServings]);

  const fetchRecipe = async (id: string) => {
    setLoading(true);
    try {
      const response = await client.get(`/api/recipe/${id}?servings=1`);
      setRecipe(response.data);
      baseServingsRef.current = 1;
      if (response.data.emoji) emojiRef.current = response.data.emoji;
    } catch (error) {
      console.error('Failed to fetch recipe', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServingsChange = (newServings: number) => {
    if (newServings < 1 || newServings > 20) return;
    setServings(newServings);
  };

  const scale = servings / (baseServingsRef.current || 1);

  const scaledNutrition = recipe ? {
    calories: Math.round(recipe.nutrition.calories * scale),
    protein:  Math.round(recipe.nutrition.protein  * scale * 10) / 10,
    carbs:    Math.round(recipe.nutrition.carbs     * scale * 10) / 10,
    fats:     Math.round(recipe.nutrition.fats      * scale * 10) / 10,
  } : null;

  const scaledIngredients = recipe?.ingredients.map(ing => {
    const baseQty = parseQty(ing.qty);
    return { ...ing, qty: formatQty(baseQty * scale) };
  }) ?? [];

  if (!recipeId) {
    return <FeaturedGrid onSelect={onSelectRecipe || (() => {})} />;
  }

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-spice border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!recipe) return null;

  return (
    <motion.div
      key={recipeId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      // ← removed max-w-4xl so content fills full available width
      className="w-full p-8"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-6xl">{emojiRef.current}</span>
          <div>
            <div className="flex gap-2 mb-2">
              <span className="px-3 py-1 bg-spice/10 text-spice text-[10px] font-bold uppercase tracking-widest rounded-full">
                {recipe.cuisine}
              </span>
              <span className="px-3 py-1 bg-turmeric/10 text-turmeric text-[10px] font-bold uppercase tracking-widest rounded-full">
                {recipe.difficulty}
              </span>
              <span className="px-3 py-1 bg-mint/10 text-mint text-[10px] font-bold uppercase tracking-widest rounded-full">
                {recipe.diet}
              </span>
            </div>
            <h1 className="text-4xl font-serif font-bold leading-tight">{recipe.name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-8 py-5 border-y border-ink/5">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-spice" />
            <span className="font-medium">{recipe.time}</span>
          </div>
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-ink/5">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-spice" />
              <span className="font-medium">Servings</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => handleServingsChange(servings - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-paper hover:bg-spice/10 transition-colors font-bold text-lg"
              >−</button>
              <span className="font-bold w-6 text-center">{servings}</span>
              <button onClick={() => handleServingsChange(servings + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-paper hover:bg-spice/10 transition-colors font-bold text-lg"
              >+</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-spice" />
            <span className="font-medium text-spice uppercase tracking-widest text-xs font-bold">
              Goal: {recipe.goal}
            </span>
          </div>
        </div>
      </header>

      {/* ── Body — 2 columns: content + sidebar ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* Left: Ingredients + Steps */}
        <div className="lg:col-span-2 space-y-12">

          {/* Ingredients */}
          <section>
            <h3 className="text-2xl font-serif font-bold mb-6 flex items-center gap-3">
              <span className="w-8 h-8 bg-spice text-paper rounded-full flex items-center justify-center text-sm font-bold">
                01
              </span>
              Ingredients
              <span className="text-sm font-sans font-normal text-ink/40 ml-1">
                for {servings} serving{servings !== 1 ? 's' : ''}
              </span>
            </h3>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-ink/5">
              <ul className="space-y-3">
                {scaledIngredients.map((ing, idx) => (
                  <li key={idx}
                    className="flex items-center justify-between py-3 border-b border-ink/5 last:border-0 last:pb-0">
                    <span className="font-medium text-ink/80">{ing.name}</span>
                    <span className="font-serif italic text-spice font-bold">{ing.qty} {ing.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Method — redesigned steps */}
          <section>
            <h3 className="text-2xl font-serif font-bold mb-8 flex items-center gap-3">
              <span className="w-8 h-8 bg-spice text-paper rounded-full flex items-center justify-center text-sm font-bold">
                02
              </span>
              Method
            </h3>

            <div className="space-y-0">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="relative flex gap-6 pb-10 last:pb-0">

                  {/* Vertical connector line */}
                  {idx < recipe.steps.length - 1 && (
                    <div className="absolute left-5 top-10 bottom-0 w-px bg-spice/10" />
                  )}

                  {/* Step number circle */}
                  <div className="flex-shrink-0 relative z-10">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2"
                      style={{
                        background:   idx === 0 ? '#C84B11' : 'white',
                        borderColor:  '#C84B11',
                        color:        idx === 0 ? 'white'   : '#C84B11',
                      }}
                    >
                      {idx + 1}
                    </div>
                  </div>

                  {/* Step text */}
                  <div className="flex-1 pt-1.5 pb-2">
                    <div className="bg-white rounded-2xl px-6 py-5 border border-ink/5 shadow-sm">
                      {/* Step label */}
                      <p className="text-[10px] uppercase tracking-widest font-bold text-spice/60 mb-2">
                        Step {idx + 1}
                      </p>
                      {/* Step content — larger, readable font */}
                      <p className="text-base leading-7 text-ink/80 font-medium">
                        {step}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Nutrition + Substitutions + Tip — sticky sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">

          {/* Nutrition */}
          <section>
            <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-ink/40 mb-4">
              Nutrition · {servings} serving{servings !== 1 ? 's' : ''}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NutritionCard label="Calories" value={scaledNutrition?.calories ?? 0} unit="kcal" color="#C84B11" />
              <NutritionCard label="Protein"  value={scaledNutrition?.protein  ?? 0} unit="g"    color="#1A6B4A" />
              <NutritionCard label="Carbs"    value={scaledNutrition?.carbs    ?? 0} unit="g"    color="#D4920A" />
              <NutritionCard label="Fats"     value={scaledNutrition?.fats     ?? 0} unit="g"    color="#0D0D0D" />
            </div>
          </section>

          {/* Smart Substitutions */}
          {recipe.substitutions.length > 0 && (
            <section className="bg-mint/5 rounded-3xl p-6 border border-mint/10">
              <h4 className="flex items-center gap-2 text-mint font-bold uppercase tracking-widest text-[10px] mb-4">
                <Info size={14} /> Smart Substitutions
              </h4>
              <div className="space-y-4">
                {recipe.substitutions.map((sub, idx) => (
                  <div key={idx} className="bg-white/60 p-4 rounded-2xl border border-mint/10">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="line-through text-ink/40 text-sm">{sub.from}</span>
                      <ChevronRight size={14} className="text-mint flex-shrink-0" />
                      <span className="font-bold text-mint">{sub.to}</span>
                    </div>
                    <p className="text-xs text-ink/60 italic">{sub.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Chef's Tip */}
          <div className="bg-turmeric/5 rounded-3xl p-6 border border-turmeric/10">
            <div className="flex items-center gap-2 text-turmeric font-bold uppercase tracking-widest text-[10px] mb-2">
              <AlertCircle size={14} /> Chef's Tip
            </div>
            <p className="text-sm italic text-ink/70 leading-relaxed">
              {(recipe as any).chef_tip || 'The Bhuna technique — cooking spices until the oil separates — is the foundation of great Indian curries.'}
            </p>
          </div>

          {/* Course badge */}
          <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-ink/40">Course</span>
            <span className="px-3 py-1 bg-spice/10 text-spice text-xs font-bold uppercase tracking-widest rounded-full">
              {recipe.course}
            </span>
          </div>
        </aside>
      </div>
    </motion.div>
  );
};

export default RecipeDetailView;