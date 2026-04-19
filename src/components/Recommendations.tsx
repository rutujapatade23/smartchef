import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Clock, Flame, ChevronRight, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface RecipeSummary {
  key: string; name: string; cuisine: string; diet: string;
  course: string; time: string; difficulty: string; calories: number; emoji: string;
}

interface RecommendResponse {
  bmi: number; goal: string; cal_target: number; recipes: RecipeSummary[]; count: number;
}

interface Props { onSelectRecipe: (id: string) => void; }

const GOAL_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  'weight-loss':  { label: 'Weight Loss',  color: 'text-spice',    desc: 'Low-calorie, high-fibre picks' },
  'weight-gain':  { label: 'Weight Gain',  color: 'text-turmeric', desc: 'Calorie-dense, nutritious meals' },
  'muscle-gain':  { label: 'Muscle Gain',  color: 'text-mint',     desc: 'High-protein, balanced carbs' },
  'maintenance':  { label: 'Maintenance',  color: 'text-ink',      desc: 'Balanced macros for your BMI' },
};

const COURSE_FILTERS = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];

const Recommendations: React.FC<Props> = ({ onSelectRecipe }) => {
  const { user } = useAuth();
  const [data, setData]                     = useState<RecommendResponse | null>(null);
  const [loading, setLoading]               = useState(false);
  const [courseFilter, setCourseFilter]     = useState('All');
  const [dietFilter, setDietFilter]         = useState('Veg');

  const bmi = user ? user.weight / Math.pow(user.height / 100, 2) : 0;
  const goalInfo = GOAL_LABELS[user?.goal ?? 'maintenance'];

  const fetchRecommendations = async (course = courseFilter, diet = dietFilter, shuffle = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await client.post('/api/recommend', {
        height: user.height, weight: user.weight, goal: user.goal,
        diet, course: course === 'All' ? '' : course, n: 12, shuffle,
      });
      setData(response.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecommendations(); }, []);

  const handleCourse = (c: string) => { setCourseFilter(c); fetchRecommendations(c, dietFilter); };
  const handleDiet   = (d: string) => { setDietFilter(d);   fetchRecommendations(courseFilter, d); };

  const getBMILabel = (b: number) => {
    if (b < 18.5) return { label: 'Underweight', color: 'text-blue-500' };
    if (b < 25)   return { label: 'Normal',       color: 'text-mint' };
    if (b < 30)   return { label: 'Overweight',   color: 'text-turmeric' };
    return              { label: 'Obese',         color: 'text-spice' };
  };
  const bmiLabel = getBMILabel(bmi);

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-spice text-paper rounded-xl flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <h1 className="text-4xl font-serif font-bold">For You</h1>
        </div>
      </div>

      {/* Profile Stats — all light colored */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* BMI card — light warm background instead of black */}
        <div className="rounded-2xl p-5" style={{ background: '#FDF6EE', border: '1px solid rgba(200,75,17,0.15)' }}>
          <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-2">Your BMI</p>
          <p className="font-serif font-bold text-4xl text-ink">{bmi.toFixed(1)}</p>
          <p className={`text-xs font-bold uppercase mt-1 ${bmiLabel.color}`}>{bmiLabel.label}</p>
        </div>
        <div className="bg-spice/5 border border-spice/10 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-2">Your Goal</p>
          <p className={`font-serif font-bold text-2xl ${goalInfo.color}`}>{goalInfo.label}</p>
          <p className="text-xs text-ink/40 mt-1">{goalInfo.desc}</p>
        </div>
        <div className="bg-mint/5 border border-mint/10 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-2">Calorie Target</p>
          <p className="font-serif font-bold text-4xl text-mint">{data?.cal_target ?? '—'}</p>
          <p className="text-xs text-ink/40 mt-1">kcal per meal</p>
        </div>
      </div>

      {/* Filters — spice/orange theme, no black */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex gap-2 flex-wrap">
          {COURSE_FILTERS.map(c => (
            <button key={c} onClick={() => handleCourse(c)}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border"
              style={{
                background:   courseFilter === c ? '#C84B11' : 'white',
                color:        courseFilter === c ? 'white'   : 'rgba(13,13,13,0.4)',
                borderColor:  courseFilter === c ? '#C84B11' : 'rgba(13,13,13,0.1)',
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['Veg', 'Non-Veg'].map(d => (
            <button key={d} onClick={() => handleDiet(d)}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border"
              style={{
                background:  dietFilter === d ? '#C84B11' : 'white',
                color:       dietFilter === d ? 'white'   : 'rgba(13,13,13,0.4)',
                borderColor: dietFilter === d ? '#C84B11' : 'rgba(13,13,13,0.1)',
              }}
            >
              {d === 'Veg' ? '🌿 Veg' : '🍗 Non-Veg'}
            </button>
          ))}
        </div>
        <button onClick={() => fetchRecommendations(courseFilter, dietFilter, true)} disabled={loading}
          className="ml-auto px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-ink/10 hover:border-spice/30 text-ink/40 hover:text-spice transition-all flex items-center gap-2 disabled:opacity-30"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Recipe Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-10 h-10 border-4 border-spice border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.recipes.length ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {data.recipes.map((recipe, idx) => (
            <motion.button key={recipe.key}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              onClick={() => onSelectRecipe(recipe.key)}
              className="text-left bg-white rounded-3xl p-5 border border-ink/5 shadow-sm hover:shadow-md hover:border-spice/20 hover:-translate-y-1 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-4xl">{recipe.emoji}</span>
                <span className="px-2 py-1 bg-paper rounded-full text-[10px] font-bold uppercase tracking-widest text-ink/40 border border-ink/5">
                  {recipe.course}
                </span>
              </div>
              <h3 className="font-serif font-bold text-base leading-tight mb-2 group-hover:text-spice transition-colors line-clamp-2">
                {recipe.name}
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-ink/30 mb-4">
                <span>{recipe.cuisine}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Clock size={9} /> {recipe.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Flame size={13} className="text-spice" />
                  <span className="font-bold text-spice text-sm">{recipe.calories} kcal</span>
                </div>
                <div className="w-7 h-7 bg-paper rounded-full flex items-center justify-center group-hover:bg-spice group-hover:text-paper transition-all border border-ink/5">
                  <ChevronRight size={14} />
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-20 opacity-30">
          <Sparkles size={48} className="mx-auto mb-4" />
          <p className="font-serif text-xl italic">No recommendations found</p>
        </div>
      )}

      {data && (
        <div className="mt-8 p-4 bg-paper border border-ink/5 rounded-2xl text-center">
          <p className="text-[10px] text-ink/30 font-bold uppercase tracking-widest">
            Powered by KNN Recommender · {data.count} recipes matched · BMI {data.bmi} · {data.goal.replace(/-/g, ' ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default Recommendations;