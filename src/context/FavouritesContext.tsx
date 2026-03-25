import React, { createContext, useContext, useState, useEffect } from 'react';
import { RecipeSummary } from '../types';
import client from '../api/client';
import { useAuth } from './AuthContext';

interface FavouritesContextType {
  favourites: string[];
  savedRecipes: RecipeSummary[];
  toggle: (recipeId: string) => Promise<void>;
  isSaved: (recipeId: string) => boolean;
  loading: boolean;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(undefined);

export const FavouritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favourites, setFavourites] = useState<string[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavourites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await client.get('/api/favourites');
      const data = response.data as RecipeSummary[];
      setSavedRecipes(data);
      setFavourites(data.map(r => r.key));
    } catch (error) {
      console.error('Failed to fetch favourites', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFavourites();
    } else {
      setFavourites([]);
      setSavedRecipes([]);
    }
  }, [user]);

  const toggle = async (recipeId: string) => {
    if (!user) return;

    const alreadySaved = favourites.includes(recipeId);
    
    // Optimistic update
    if (alreadySaved) {
      setFavourites(prev => prev.filter(id => id !== recipeId));
      setSavedRecipes(prev => prev.filter(r => r.key !== recipeId));
    } else {
      setFavourites(prev => [...prev, recipeId]);
      // We don't have the full summary here, so we'll wait for the server or refetch
    }

    try {
      if (alreadySaved) {
        await client.delete(`/api/favourites/${recipeId}`);
      } else {
        await client.post('/api/favourites', { recipe_id: recipeId });
        // Refetch to get the full summary for the newly added favourite
        await fetchFavourites();
      }
    } catch (error) {
      console.error('Failed to toggle favourite', error);
      // Revert on error
      fetchFavourites();
    }
  };

  const isSaved = (recipeId: string) => favourites.includes(recipeId);

  return (
    <FavouritesContext.Provider value={{ favourites, savedRecipes, toggle, isSaved, loading }}>
      {children}
    </FavouritesContext.Provider>
  );
};

export const useFavourites = () => {
  const context = useContext(FavouritesContext);
  if (context === undefined) {
    throw new Error('useFavourites must be used within a FavouritesProvider');
  }
  return context;
};
