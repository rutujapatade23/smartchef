export interface User {
  name: string;
  username: string;
  height: number;
  weight: number;
  age?: number;
  goal: 'weight-loss' | 'weight-gain' | 'muscle-gain' | 'maintenance';
}

export interface RecipeSummary {
  key:        string;
  name:       string;
  cuisine:    string;
  diet:       string;
  course:     string;
  time:       string;
  difficulty: string;
  calories:   number;
  emoji:      string;
}

export interface Ingredient {
  name: string;
  qty:  string;   // string not number — supports "1/2", "¼" etc.
  unit: string;
}

export interface Nutrition {
  calories: number;
  protein:  number;
  carbs:    number;
  fats:     number;
  fiber?:   number;
}

export interface Substitution {
  from:   string;
  to:     string;
  reason: string;
}

export interface RecipeDetail extends RecipeSummary {
  id?:           string;
  servings:      number;
  goal:          string;
  ingredients:   Ingredient[];
  steps:         string[];
  nutrition:     Nutrition;
  substitutions: Substitution[];
}