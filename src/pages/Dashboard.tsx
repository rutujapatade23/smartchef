import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import RecipeDetailView from '../components/RecipeDetail';
import RecipesPage from '../components/RecipesPage';
import MealPlanner from '../components/MealPlanner';
import Recommendations from '../components/Recommendations';
import { UtensilsCrossed, CalendarDays, Sparkles, Heart } from 'lucide-react';

type Tab = 'recipes' | 'mealplan' | 'recommendations' | 'saved';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'recipes',         label: 'Recipes',   icon: <UtensilsCrossed size={15} /> },
  { id: 'mealplan',        label: 'Meal Plan', icon: <CalendarDays size={15} /> },
  { id: 'recommendations', label: 'For You',   icon: <Sparkles size={15} /> },
  { id: 'saved',           label: 'Saved',     icon: <Heart size={15} /> },
];

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab]               = useState<Tab>('recipes');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeServings, setRecipeServings]     = useState<number>(1);
  const [savedMealPlan, setSavedMealPlan]       = useState<any>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.history.pushState({ tab: 'recipes' }, '', '/dashboard');
    const handlePop = () => {
      setActiveTab('recipes');
      setSelectedRecipeId(null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab !== 'recipes' && tab !== 'saved') setSelectedRecipeId(null);
    scrollToTop();
  };

  const handleViewRecipeFromMealPlan = (id: string) => {
    setRecipeServings(1);
    setSelectedRecipeId(id);
    setActiveTab('recipes');
    setTimeout(scrollToTop, 50);
  };

  const handleSelectRecipe = (id: string) => {
    setRecipeServings(1);
    setSelectedRecipeId(id);
    setTimeout(scrollToTop, 50);
  };

  // When a recipe is selected in the full-page view, go back resets it
  const handleBackFromDetail = () => {
    setSelectedRecipeId(null);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-paper">
      <div className="w-12 h-12 border-4 border-spice border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Navbar />

      {/* Tab Bar */}
      <div
        className="sticky z-40 bg-paper/90 backdrop-blur-md border-b border-ink/5 flex items-center px-6"
        style={{ top: 73 }}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-widest relative transition-all ${
                active ? 'text-spice' : 'text-ink/30 hover:text-ink/60'
              }`}
            >
              {tab.icon}
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-spice rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <main ref={mainRef} className="h-full overflow-y-auto custom-scrollbar">

          {/* RECIPES & SAVED TABS — Full page layout */}
          {(activeTab === 'recipes' || activeTab === 'saved') && (
            <>
              {selectedRecipeId ? (
                /* ── Recipe Detail View ── */
                <div>
                  {/* Back button */}
                  <div className="px-8 pt-6 pb-0">
                    <button
                      onClick={handleBackFromDetail}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink/40 hover:text-spice transition-colors mb-2"
                    >
                      ← Back to Recipes
                    </button>
                  </div>
                  <RecipeDetailView
                    recipeId={selectedRecipeId}
                    onSelectRecipe={handleSelectRecipe}
                    defaultServings={recipeServings}
                  />
                </div>
              ) : (
                /* ── Full-page Recipes Grid ── */
                <RecipesPage
                  onSelectRecipe={handleSelectRecipe}
                  selectedRecipeId={selectedRecipeId}
                  defaultMode={activeTab === 'saved' ? 'saved' : 'all'}
                />
              )}
            </>
          )}

          {activeTab === 'mealplan' && (
            <MealPlanner
              onViewRecipe={handleViewRecipeFromMealPlan}
              savedPlan={savedMealPlan}
              onPlanGenerated={setSavedMealPlan}
            />
          )}

          {activeTab === 'recommendations' && (
            <Recommendations onSelectRecipe={(id) => {
              handleViewRecipeFromMealPlan(id);
            }} />
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;