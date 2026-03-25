import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, ArrowRight, Brain, Salad, Clock, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const RECIPES = [
  {
    emoji: '🍛', name: 'Dal Makhani', cuisine: 'North Indian', difficulty: 'Medium',
    nutrition: [['320','kcal','#C84B11'],['18g','protein','#1A6B4A'],['42g','carbs','#D4920A'],['9g','fats','#0D0D0D']],
    ingredients: [['Whole black lentils','1 cup'],['Butter & cream','2 tbsp'],['Tomato puree','½ cup'],['Garam masala','1 tsp']],
    badge: '✓ Goal: Weight Loss',
    swap: { from: 'Cream', to: 'Hung curd', reason: 'Lower fat, same texture' },
  },
  {
    emoji: '🥘', name: 'Palak Paneer', cuisine: 'Punjabi', difficulty: 'Easy',
    nutrition: [['280','kcal','#C84B11'],['22g','protein','#1A6B4A'],['18g','carbs','#D4920A'],['14g','fats','#0D0D0D']],
    ingredients: [['Spinach leaves','2 cups'],['Paneer cubes','200g'],['Onion & garlic','1 each'],['Cumin seeds','1 tsp']],
    badge: '✓ Goal: Muscle Gain',
    swap: { from: 'Full-fat paneer', to: 'Low-fat paneer', reason: 'Same protein, fewer calories' },
  },
  {
    emoji: '🍲', name: 'Chicken Biryani', cuisine: 'Hyderabadi', difficulty: 'Hard',
    nutrition: [['520','kcal','#C84B11'],['35g','protein','#1A6B4A'],['58g','carbs','#D4920A'],['12g','fats','#0D0D0D']],
    ingredients: [['Basmati rice','1 cup'],['Chicken pieces','300g'],['Whole spices','mix'],['Saffron milk','2 tbsp']],
    badge: '✓ Goal: Weight Gain',
    swap: { from: 'White rice', to: 'Brown rice', reason: 'More fibre and nutrients' },
  },
  {
    emoji: '🥗', name: 'Sprouts Chaat', cuisine: 'Indian', difficulty: 'Easy',
    nutrition: [['180','kcal','#C84B11'],['12g','protein','#1A6B4A'],['28g','carbs','#D4920A'],['3g','fats','#0D0D0D']],
    ingredients: [['Mixed sprouts','1 cup'],['Tomato & onion','½ each'],['Chaat masala','1 tsp'],['Lemon juice','1 tbsp']],
    badge: '✓ Goal: Weight Loss',
    swap: { from: 'Regular salt', to: 'Rock salt', reason: 'Better mineral content' },
  },
  {
    emoji: '🧆', name: 'Masala Peanut Chaat', cuisine: 'Indian', difficulty: 'Easy',
    nutrition: [['210','kcal','#C84B11'],['9g','protein','#1A6B4A'],['18g','carbs','#D4920A'],['12g','fats','#0D0D0D']],
    ingredients: [['Roasted peanuts','½ cup'],['Red onion','1 small'],['Green chilli','1'],['Coriander leaves','handful']],
    badge: '✓ Goal: Maintenance',
    swap: { from: 'Fried peanuts', to: 'Roasted peanuts', reason: 'Same crunch, much less oil' },
  },
  {
    emoji: '🍠', name: 'Baked Aloo Tikki', cuisine: 'North Indian', difficulty: 'Medium',
    nutrition: [['165','kcal','#C84B11'],['5g','protein','#1A6B4A'],['32g','carbs','#D4920A'],['2g','fats','#0D0D0D']],
    ingredients: [['Boiled potatoes','2 large'],['Green peas','¼ cup'],['Cumin & coriander','1 tsp each'],['Ginger paste','½ tsp']],
    badge: '✓ Goal: Weight Loss',
    swap: { from: 'Deep fried', to: 'Baked in oven', reason: 'Saves 120 kcal per serving' },
  },
];

const Landing: React.FC = () => {
  const [currentRecipe, setCurrentRecipe] = useState(0);

  // Auto-rotate every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentRecipe(prev => (prev + 1) % RECIPES.length);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const recipe = RECIPES[currentRecipe];

  return (
    <div className="min-h-screen bg-paper">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-paper/90 backdrop-blur-md"
        style={{ borderBottom: '1px solid rgba(13,13,13,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-spice rounded-lg flex items-center justify-center">
            <ChefHat size={18} className="text-paper" />
          </div>
          <span className="font-serif text-xl font-bold text-ink">SmartChef</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-semibold text-ink/50 hover:text-ink transition-colors px-4 py-2">
            Sign In
          </Link>
          <Link to="/register"
            className="text-sm font-bold px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-spice transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pt-20 min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=2000"
            alt="Indian Food"
            className="w-full h-full object-cover"
            style={{ opacity: 0.1 }}
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center py-20">

            {/* Left */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-8 bg-spice/10 text-spice">
                <Star size={11} fill="currentColor" /> Personalised Indian Nutrition
              </div>
              <h1 className="font-serif font-bold text-ink mb-6" style={{ fontSize: 'clamp(2.8rem, 4.5vw, 4rem)', lineHeight: 1.1 }}>
                Your personal<br />Indian food<br />
                <span className="text-spice italic">companion.</span>
              </h1>
              <p className="text-ink/60 text-lg leading-relaxed mb-10 max-w-md">
                SmartChef recommends authentic Indian recipes tailored to your BMI and health goals — with real nutrition data calculated from scratch.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/register"
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold bg-ink text-paper hover:bg-spice transition-all hover:scale-105"
                >
                  Start Your Journey <ArrowRight size={18} />
                </Link>
                <Link to="/login"
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold border border-ink/10 text-ink hover:bg-ink/5 transition-all"
                >
                  Sign In
                </Link>
              </div>
              <div className="flex items-center gap-6 mt-12 pt-8" style={{ borderTop: '1px solid rgba(13,13,13,0.08)' }}>
                <div>
                  <p className="font-serif font-bold text-2xl text-ink">5,938</p>
                  <p className="text-xs text-ink/40 font-semibold uppercase tracking-wider">Recipes</p>
                </div>
                <div className="w-px h-10 bg-ink/10" />
                <div>
                  <p className="font-serif font-bold text-2xl text-ink">82</p>
                  <p className="text-xs text-ink/40 font-semibold uppercase tracking-wider">Cuisines</p>
                </div>
              </div>
            </motion.div>

            {/* Right — rotating recipe card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentRecipe}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.8 }}
                    className="bg-white rounded-3xl p-6 shadow-2xl"
                    style={{ border: '1px solid rgba(13,13,13,0.06)' }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-5">
                      <span className="text-4xl">{recipe.emoji}</span>
                      <div>
                        <div className="flex gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-spice/10 text-spice">
                            {recipe.cuisine}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-turmeric/10 text-turmeric">
                            {recipe.difficulty}
                          </span>
                        </div>
                        <h3 className="font-serif font-bold text-xl text-ink">{recipe.name}</h3>
                      </div>
                    </div>

                    {/* Nutrition */}
                    <div className="grid grid-cols-4 gap-3 mb-5">
                      {recipe.nutrition.map(([v, l, c]) => (
                        <div key={l} className="bg-paper rounded-xl p-3 text-center">
                          <p className="font-bold text-lg" style={{ color: c }}>{v}</p>
                          <p className="text-[10px] text-ink/40 font-bold uppercase">{l}</p>
                        </div>
                      ))}
                    </div>

                    {/* Ingredients */}
                    <div className="space-y-2">
                      {recipe.ingredients.map(([ing, qty], i) => (
                        <div key={i} className="flex items-center justify-between py-2"
                          style={{ borderBottom: '1px solid rgba(13,13,13,0.05)' }}
                        >
                          <span className="text-sm text-ink/70 font-medium">{ing}</span>
                          <span className="text-sm font-serif italic text-spice font-bold">{qty}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Floating goal badge */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`badge-${currentRecipe}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.6 }}
                    className="absolute -top-4 -right-4 bg-mint text-paper px-4 py-2 rounded-full text-xs font-bold shadow-lg"
                  >
                    {recipe.badge}
                  </motion.div>
                </AnimatePresence>

                {/* Floating swap card */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`swap-${currentRecipe}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.6 }}
                    className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl"
                    style={{ border: '1px solid rgba(13,13,13,0.06)', maxWidth: 210 }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-mint mb-2">Smart Swap</p>
                    <p className="text-xs text-ink/60">
                      <span className="line-through text-ink/30">{recipe.swap.from}</span>
                      {' → '}
                      <span className="font-bold text-mint">{recipe.swap.to}</span>
                    </p>
                    <p className="text-[10px] text-ink/40 mt-1">{recipe.swap.reason}</p>
                  </motion.div>
                </AnimatePresence>

                {/* Dot indicators */}
                <div className="flex justify-center gap-2 mt-10">
                  {RECIPES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentRecipe(i)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ background: i === currentRecipe ? '#C84B11' : 'rgba(13,13,13,0.15)' }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="py-28 px-8" style={{ background: '#F0ECE4' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-spice mb-3">What SmartChef does</p>
            <h2 className="font-serif font-bold text-5xl text-ink">Built for your health</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Brain size={28} />, color: 'bg-spice', title: 'AI Recommendations', desc: 'Our model analyses your BMI and goal to recommend the most suitable recipes from 5,938 options.' },
              { icon: <Salad size={28} />, color: 'bg-mint',  title: 'Real Nutrition Data', desc: "Every recipe's nutrition is calculated by parsing ingredient quantities — calories, protein, carbs, fat and fiber." },
              { icon: <Clock size={28} />, color: 'bg-turmeric', title: 'Smart Meal Plans', desc: 'Get a personalised 7-day meal plan that hits your daily calorie target with breakfast, lunch, dinner and snack.' },
            ].map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-8 shadow-sm" style={{ border: '1px solid rgba(13,13,13,0.05)' }}
              >
                <div className={`w-14 h-14 ${f.color} text-paper rounded-2xl flex items-center justify-center mb-6`}>{f.icon}</div>
                <h3 className="font-serif font-bold text-2xl text-ink mb-3">{f.title}</h3>
                <p className="text-ink/60 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="py-28 px-8 bg-ink text-paper">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-turmeric mb-4">How it works</p>
            <h2 className="font-serif font-bold text-5xl mb-8">Three steps to eating better</h2>
            <div className="space-y-6">
              {[
                { num: '01', title: 'Tell us about yourself', desc: 'Enter your height, weight and health goal. SmartChef calculates your BMI and daily calorie needs automatically.' },
                { num: '02', title: 'Get personalised recipes', desc: 'Browse recipes handpicked for your body and goals — with real calorie, protein, carb and fat values for every dish.' },
                { num: '03', title: 'Plan your whole week', desc: 'Generate a full 7-day meal plan in one click. Breakfast, lunch, dinner and snacks — all within your daily target.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-5">
                  <span className="font-serif text-4xl font-bold text-white/10 leading-none flex-shrink-0">{item.num}</span>
                  <div>
                    <h4 className="font-bold text-paper mb-1">{item.title}</h4>
                    <p className="text-paper/50 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="aspect-square rounded-[3rem] overflow-hidden" style={{ transform: 'rotate(2deg)' }}>
              <img
                src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800"
                alt="Healthy Food" className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-28 px-8 text-center bg-paper">
        <h2 className="font-serif font-bold text-6xl text-ink mb-6">Ready to eat smarter?</h2>
        <p className="text-ink/50 text-xl mb-10 max-w-lg mx-auto">
          Personalised Indian recipes based on your health profile. Free to use.
        </p>
        <Link to="/register"
          className="inline-flex items-center gap-3 px-12 py-5 rounded-2xl font-bold text-lg bg-spice text-paper hover:bg-ink transition-all hover:scale-105"
        >
          Create Free Account <ArrowRight size={20} />
        </Link>
      </section>

    </div>
  );
};

export default Landing;