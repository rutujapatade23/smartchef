"""
SmartChef - Flask Backend API
================================
Loads all trained ML models on startup and exposes REST endpoints
for the React frontend.

ENDPOINTS:
  Auth:
    POST /register              → create user account
    POST /login                 → login
    GET  /logout                → logout

  Recipes:
    GET  /api/recipes/all       → all recipes (paginated)
    GET  /api/recipes/filter    → filter by diet + course
    GET  /api/recipe/<id>       → single recipe detail with nutrition + substitutions
    GET  /api/search?q=         → search recipes by name or ingredient

  ML:
    POST /api/recommend         → KNN: BMI + goal → recommended recipes
    GET  /api/similar/<id>      → TF-IDF: similar recipes to a given recipe
    POST /api/mealplan          → Meal planner: daily cal + diet → N-day plan

USAGE:
  pip install flask flask-cors pandas numpy scikit-learn
  python app.py

The server runs on http://localhost:5000
Vite proxies /api → localhost:5000 automatically (already configured in vite.config.ts)
"""

from flask import Flask, request, jsonify, session
from flask_cors import CORS
import pandas as pd
import numpy as np
import pickle
import os
import random
import warnings
warnings.filterwarnings('ignore')

from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
app.secret_key = 'smartchef-secret-key-2024'   # change in production
CORS(app, supports_credentials=True)

# ─────────────────────────────────────────────
# LOAD ALL MODELS ON STARTUP
# ─────────────────────────────────────────────
print("\n" + "="*55)
print("  SmartChef API — Loading Models...")
print("="*55)

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(BASE_DIR, 'models')
DATA_DIR    = os.path.join(BASE_DIR, 'data')

def load_pickle(filename):
    path = os.path.join(MODELS_DIR, filename)
    with open(path, 'rb') as f:
        return pickle.load(f)

# Load everything into memory once
recipes_df       = load_pickle('recipes_df.pkl')
knn_bundle       = load_pickle('knn_recommender.pkl')
tfidf_bundle     = load_pickle('tfidf_similarity.pkl')
scaler           = load_pickle('feature_scaler.pkl')
encoders         = load_pickle('label_encoders.pkl')
meal_planner_data = load_pickle('meal_planner.pkl')

# Unpack KNN bundle
knn_model        = knn_bundle['model']
knn_feature_cols = knn_bundle['feature_cols']
knn_recipe_ids   = knn_bundle['recipe_ids']

# Unpack TF-IDF bundle
tfidf_vectorizer = tfidf_bundle['vectorizer']
tfidf_matrix     = tfidf_bundle['matrix']
tfidf_recipe_ids = tfidf_bundle['recipe_ids']

print(f"  ✓ Loaded {len(recipes_df)} recipes")
print(f"  ✓ KNN model ready     ({len(knn_recipe_ids)} recipes)")
print(f"  ✓ TF-IDF model ready  ({tfidf_matrix.shape})")
print(f"  ✓ Meal planner ready")
print("="*55 + "\n")

# ── Persistent user store (saved to users.json so users survive restarts) ────
USERS_FILE = os.path.join(BASE_DIR, 'users.json')

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_users(users_dict):
    with open(USERS_FILE, 'w') as f:
        json.dump(users_dict, f, indent=2)

USERS = load_users()

# ─────────────────────────────────────────────
# EMOJI MAPPING (for UI display)
# ─────────────────────────────────────────────
COURSE_EMOJIS = {
    'Breakfast':  ['🥣', '🍳', '🥞', '🫓', '🍱'],
    'Lunch':      ['🍛', '🍚', '🥘', '🫕', '🍲'],
    'Dinner':     ['🍽️', '🥗', '🫙', '🍜', '🥩'],
    'Snack':      ['🥨', '🧆', '🥙', '🌮', '🥪'],
    'Dessert':    ['🍮', '🧁', '🍰', '🍬', '🧇'],
    'Soup':       ['🍜', '🫕', '🥣', '🍲', '🥗'],
    'Drink':      ['🥤', '🧃', '🥛', '☕', '🍵'],
    'Main Course':['🍛', '🥘', '🫕', '🍲', '🍽️'],
}

DIET_EMOJIS = {
    'Veg':     ['🥦', '🥕', '🌽', '🫑', '🍅'],
    'Non-Veg': ['🍗', '🥩', '🦐', '🐟', '🥚'],
}

def get_emoji(course, diet):
    pool = COURSE_EMOJIS.get(course, ['🍴'])
    return random.choice(pool)


# ─────────────────────────────────────────────
# HELPER: Build recipe summary (for list views)
# ─────────────────────────────────────────────
def recipe_to_summary(row):
    return {
        'key':      row['recipe_id'],
        'name':     row['recipe_name'],
        'cuisine':  row['cuisine'],
        'diet':     row['diet'],
        'course':   row['course'],
        'time':     row['time_label'],
        'difficulty': row['difficulty'],
        'calories': int(row['calories']),
        'emoji':    get_emoji(row['course'], row['diet']),
    }


# ─────────────────────────────────────────────
# HELPER: Build recipe detail (for detail view)
# ─────────────────────────────────────────────
def recipe_to_detail(row, servings=4):
    """
    Build the full recipe detail response matching what RecipeDetail.tsx expects:
    - emoji, name, cuisine, difficulty, time, goal
    - ingredients: [{name, qty, unit}]
    - steps: [str]
    - nutrition: {calories, protein, carbs, fats}
    - substitutions: [{from, to, reason}]
    """
    # Parse ingredients into structured list
    ingredients = []
    for ing_str in str(row['ingredients_raw']).split(','):
        ing_str = ing_str.strip()
        if not ing_str:
            continue
        # Try to split "2 tablespoon Oil" → qty=2, unit=tablespoon, name=Oil
        import re
        m = re.match(
            r'^([\d\s/\-\.]+)?\s*(tablespoons?|teaspoons?|cups?|grams?|kg|ml|cloves?|inch|sprigs?|pinch|handful|pieces?|tbsp|tsp|g)?\s*(.+)$',
            ing_str, re.IGNORECASE
        )
        if m:
            qty  = m.group(1).strip() if m.group(1) else '—'
            unit = m.group(2).strip() if m.group(2) else ''
            name = m.group(3).strip() if m.group(3) else ing_str
            # Clean name: remove "- chopped", "(Jeera)" etc.
            name = re.sub(r'\s*-\s*.+$', '', name)
            name = re.sub(r'\(.*?\)', '', name).strip()
        else:
            qty, unit, name = '—', '', ing_str

        if name:
            ingredients.append({'name': name, 'qty': qty, 'unit': unit})

    # Parse instructions into steps (split by newline or ". ")
    raw_instructions = str(row['instructions'])
    steps = [s.strip() for s in raw_instructions.split('\n') if s.strip() and len(s.strip()) > 10]
    if len(steps) <= 1:
        # fallback: split by period
        steps = [s.strip() + '.' for s in raw_instructions.split('.') if len(s.strip()) > 10]
    steps = steps[:15]  # cap at 15 steps

    # Scale nutrition to requested servings
    base_servings = int(row.get('servings', 4)) or 4
    scale = servings / base_servings

    # Smart substitutions based on diet + goal
    substitutions = generate_substitutions(row)

    # Map user goal from profile (passed via session or default)
    goal_map = {
        'weight-loss':   'Weight Loss',
        'weight-gain':   'Weight Gain',
        'muscle-gain':   'Muscle Gain',
        'maintenance':   'Maintenance',
    }

    return {
        'id':         row['recipe_id'],
        'name':       row['recipe_name'],
        'emoji':      get_emoji(row['course'], row['diet']),
        'cuisine':    row['cuisine'],
        'difficulty': row['difficulty'],
        'time':       f"{row['total_time_mins']} mins",
        'diet':       row['diet'],
        'course':     row['course'],
        'goal':       goal_map.get(session.get('goal', 'maintenance'), 'Maintenance'),
        'ingredients': ingredients,
        'steps':      steps,
        'nutrition':  {
            'calories': int(row['calories'] * scale),
            'protein':  round(float(row['protein']) * scale, 1),
            'carbs':    round(float(row['carbs']) * scale, 1),
            'fats':     round(float(row['fat']) * scale, 1),
            'fiber':    round(float(row['fiber']) * scale, 1),
        },
        'substitutions': substitutions,
    }


def generate_substitutions(row):
    """Generate smart ingredient substitutions based on diet and common healthy swaps."""
    subs = []
    ingredients_lower = str(row['ingredients_clean']).lower()

    SUBSTITUTION_RULES = [
        {
            'check': 'sugar',
            'from': 'Sugar', 'to': 'Jaggery or Stevia',
            'reason': 'Lower glycemic index, better for blood sugar control'
        },
        {
            'check': 'maida',
            'from': 'Maida (All-purpose flour)', 'to': 'Whole wheat flour',
            'reason': 'Higher fiber content, more nutrients, better digestion'
        },
        {
            'check': 'cream',
            'from': 'Fresh cream', 'to': 'Hung curd (Greek yogurt)',
            'reason': 'Lower fat, higher protein, same creamy texture'
        },
        {
            'check': 'butter',
            'from': 'Butter', 'to': 'Ghee (in small quantity)',
            'reason': 'Ghee has healthy fats and higher smoke point'
        },
        {
            'check': 'white rice',
            'from': 'White rice', 'to': 'Brown rice or Millets',
            'reason': 'More fiber and nutrients, lower glycemic index'
        },
        {
            'check': 'coconut milk',
            'from': 'Full-fat coconut milk', 'to': 'Light coconut milk',
            'reason': 'Significantly fewer calories, same flavor profile'
        },
        {
            'check': 'paneer',
            'from': 'Full-fat paneer', 'to': 'Low-fat paneer or Tofu',
            'reason': 'Fewer calories, similar protein content'
        },
    ]

    for rule in SUBSTITUTION_RULES:
        if rule['check'] in ingredients_lower:
            subs.append({
                'from':   rule['from'],
                'to':     rule['to'],
                'reason': rule['reason'],
            })
        if len(subs) >= 2:   # max 2 substitutions per recipe
            break

    return subs


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    required = ['name', 'username', 'password', 'height', 'weight', 'goal']
    for field in required:
        if field not in data:
            return jsonify({'success': False, 'message': f'Missing field: {field}'}), 400

    username = data['username'].strip().lower()
    if username in USERS:
        return jsonify({'success': False, 'message': 'Username already exists'}), 409

    USERS[username] = {
        'name':     data['name'],
        'username': username,
        'password': data['password'],   # hash this in production!
        'height':   float(data['height']),
        'weight':   float(data['weight']),
        'goal':     data['goal'],
    }
    save_users(USERS)   # persist to disk

    # Set session
    session['username'] = username
    session['goal']     = data['goal']

    return jsonify({'success': True, 'message': 'Registered successfully'})


@app.route('/login', methods=['POST'])
def login():
    data     = request.json
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')

    user = USERS.get(username)
    if not user or user['password'] != password:
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401

    session['username'] = username
    session['goal']     = user.get('goal', 'maintenance')

    return jsonify({
        'success': True,
        'user': {
            'name':     user['name'],
            'username': user['username'],
            'height':   user['height'],
            'weight':   user['weight'],
            'goal':     user['goal'],
        }
    })


@app.route('/logout', methods=['GET'])
def logout():
    session.clear()
    return jsonify({'success': True})


# ─────────────────────────────────────────────────────────────────────────────
# RECIPE ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/recipes/all', methods=['GET'])
def get_all_recipes():
    """Return paginated recipe list."""
    page     = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 30))

    start = (page - 1) * per_page
    end   = start + per_page

    subset = recipes_df.iloc[start:end]
    result = [recipe_to_summary(row) for _, row in subset.iterrows()]

    return jsonify(result)


@app.route('/api/recipes/filter', methods=['GET'])
def filter_recipes():
    """Filter recipes by diet and/or course."""
    diet   = request.args.get('diet', '').strip()
    course = request.args.get('course', '').strip()

    df = recipes_df.copy()

    if diet:
        # Handle both 'veg'/'non-veg' shorthand and full 'Veg'/'Non-Veg'
        diet_map = {'veg': 'Veg', 'non-veg': 'Non-Veg', 'Veg': 'Veg', 'Non-Veg': 'Non-Veg'}
        mapped = diet_map.get(diet, diet)
        df = df[df['diet'] == mapped]

    if course:
        course_map = {
            'breakfast': 'Breakfast', 'lunch': 'Lunch',
            'dinner': 'Dinner', 'snack': 'Snack',
            'dessert': 'Dessert', 'soup': 'Soup', 'drink': 'Drink',
        }
        mapped = course_map.get(course.lower(), course)
        df = df[df['course'] == mapped]

    # Return up to 50 results
    df = df.head(50)
    result = [recipe_to_summary(row) for _, row in df.iterrows()]

    return jsonify(result)


@app.route('/api/recipe/<recipe_id>', methods=['GET'])
def get_recipe_detail(recipe_id):
    """Return full recipe detail for a single recipe."""
    servings = int(request.args.get('servings', 4))

    row = recipes_df[recipes_df['recipe_id'] == recipe_id]
    if row.empty:
        return jsonify({'error': 'Recipe not found'}), 404

    detail = recipe_to_detail(row.iloc[0], servings=servings)
    return jsonify(detail)


@app.route('/api/search', methods=['GET'])
def search_recipes():
    """Search recipes by name or ingredient."""
    query = request.args.get('q', '').strip().lower()

    if not query:
        return jsonify([])

    # Search in recipe name
    name_mask = recipes_df['recipe_name'].str.lower().str.contains(query, na=False)

    # Search in ingredients
    ingr_mask = recipes_df['ingredients_list_str'].str.lower().str.contains(query, na=False)

    # Search in cuisine
    cuisine_mask = recipes_df['cuisine'].str.lower().str.contains(query, na=False)

    combined = recipes_df[name_mask | ingr_mask | cuisine_mask].head(30)
    result   = [recipe_to_summary(row) for _, row in combined.iterrows()]

    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# ML ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/recommend', methods=['POST'])
def recommend():
    """
    KNN-based recipe recommendation.

    Request body:
    {
      "height": 165,        // cm
      "weight": 70,         // kg
      "goal": "weight-loss",  // weight-loss | weight-gain | muscle-gain | maintenance
      "diet": "Veg",        // Veg | Non-Veg
      "course": "",         // optional: Breakfast | Lunch | Dinner etc.
      "n": 10               // number of recommendations
    }
    """
    data   = request.json or {}
    height = float(data.get('height', 165))
    weight = float(data.get('weight', 70))
    goal   = data.get('goal', 'maintenance')
    diet   = data.get('diet', 'Veg')
    course = data.get('course', '')
    n      = int(data.get('n', 10))

    # ── Calculate BMI ────────────────────────────────────────────────────────
    bmi = weight / ((height / 100) ** 2)

    # ── Build target nutrition vector based on goal ───────────────────────────
    # These are evidence-based daily calorie targets scaled to a single meal
    # (assuming 3 meals/day, each meal ≈ 30% of daily calories)
    GOAL_PROFILES = {
        # [daily_cal, protein_g_per_meal, carbs_g_per_meal, fat_g_per_meal, fiber_g_per_meal]
        'weight-loss':  [300,  22, 30,  8, 8],
        'weight-gain':  [650,  30, 80, 20, 5],
        'muscle-gain':  [500,  35, 55, 12, 6],
        'maintenance':  [450,  18, 55, 14, 6],
    }

    # Adjust for BMI
    profile = GOAL_PROFILES.get(goal, GOAL_PROFILES['maintenance'])
    cal_target, prot_target, carb_target, fat_target, fiber_target = profile

    if bmi > 30:       cal_target = int(cal_target * 0.85)   # reduce for obese
    elif bmi < 18.5:   cal_target = int(cal_target * 1.20)   # increase for underweight

    # ── Encode categorical features ─────────────────────────────────────────
    diet_enc   = encoders['diet']
    course_enc = encoders['course']
    diff_enc   = encoders['difficulty']

    diet_val   = 1 if diet == 'Veg' else 0   # Veg=1, Non-Veg=0
    course_val = 0  # default
    if course:
        try:
            course_val = int(course_enc.transform([course])[0])
        except:
            course_val = 0
    diff_val = 1  # Medium difficulty default

    # ── Build query vector ───────────────────────────────────────────────────
    query_raw = np.array([[
        cal_target, prot_target, carb_target, fat_target, fiber_target,
        diet_val, course_val, diff_val,
        30    # default cook time target
    ]])

    query_scaled = scaler.transform(query_raw)

    # ── Find K nearest recipes ───────────────────────────────────────────────
    distances, indices = knn_model.kneighbors(query_scaled, n_neighbors=min(50, len(recipes_df)))

    # ── Filter by diet preference ────────────────────────────────────────────
    recommended = []
    for idx in indices[0]:
        row = recipes_df.iloc[idx]
        if diet and row['diet'] != diet:
            continue
        if course and row['course'] != course:
            continue
        recommended.append(recipe_to_summary(row))
        if len(recommended) >= n:
            break

    # Fallback: if filters removed too many, add more without diet filter
    if len(recommended) < 5:
        for idx in indices[0]:
            row = recipes_df.iloc[idx]
            summary = recipe_to_summary(row)
            if summary not in recommended:
                recommended.append(summary)
            if len(recommended) >= n:
                break

    return jsonify({
        'bmi':          round(bmi, 1),
        'goal':         goal,
        'cal_target':   cal_target,
        'recipes':      recommended[:n],
        'count':        len(recommended[:n]),
    })


@app.route('/api/similar/<recipe_id>', methods=['GET'])
def similar_recipes(recipe_id):
    """
    TF-IDF content-based similar recipes.
    Returns top N recipes with similar ingredients.
    """
    n = int(request.args.get('n', 5))

    # Find index of recipe in TF-IDF matrix
    try:
        idx = tfidf_recipe_ids.index(recipe_id)
    except ValueError:
        return jsonify({'error': 'Recipe not found'}), 404

    # Compute cosine similarity
    recipe_vec = tfidf_matrix[idx]
    sim_scores = cosine_similarity(recipe_vec, tfidf_matrix).flatten()

    # Sort by similarity, exclude the recipe itself
    top_indices = sim_scores.argsort()[::-1]
    top_indices = [i for i in top_indices if i != idx][:n * 3]   # get extras for filtering

    results = []
    for i in top_indices:
        rid = tfidf_recipe_ids[i]
        row = recipes_df[recipes_df['recipe_id'] == rid]
        if row.empty:
            continue
        summary = recipe_to_summary(row.iloc[0])
        summary['similarity_score'] = round(float(sim_scores[i]), 3)
        results.append(summary)
        if len(results) >= n:
            break

    return jsonify(results)


@app.route('/api/mealplan', methods=['POST'])
def meal_plan():
    """
    Greedy meal planner.

    Request body:
    {
      "daily_calories": 2000,
      "diet": "Veg",
      "days": 7,
      "cuisine": ""       // optional cuisine preference
    }

    Returns a day-by-day meal plan with breakfast, lunch, dinner, snack.
    """
    data           = request.json or {}
    daily_calories = int(data.get('daily_calories', 2000))
    diet           = data.get('diet', 'Veg')
    days           = int(data.get('days', 7))
    days           = min(days, 14)   # cap at 14 days
    cuisine_pref   = data.get('cuisine', '').strip()

    # Calorie split per meal
    MEAL_SPLITS = {
        'Breakfast': 0.25,
        'Lunch':     0.35,
        'Dinner':    0.35,
        'Snack':     0.05,
    }

    meal_pools_raw = meal_planner_data['meal_pools']

    # Convert pools back to DataFrames for easy filtering
    meal_pools = {
        meal: pd.DataFrame(records)
        for meal, records in meal_pools_raw.items()
    }

    def score_recipe(row, cal_target):
        """Score a recipe: closer to calorie target + high protein + high fiber = better."""
        cal_diff = abs(row['calories'] - cal_target) + 1
        protein_bonus = 1 + (row['protein'] / 30)
        fiber_bonus   = 1 + (row['fiber']   / 15)
        return (1 / cal_diff) * protein_bonus * fiber_bonus

    def pick_recipe(meal_slot, cal_target, used_ids, diet_filter, cuisine_filter):
        pool = meal_pools[meal_slot].copy()

        # Filter by diet
        if diet_filter:
            diet_pool = pool[pool['diet'] == diet_filter]
            if len(diet_pool) >= 3:
                pool = diet_pool

        # Filter by cuisine preference
        if cuisine_filter:
            cuisine_pool = pool[pool['cuisine'].str.contains(cuisine_filter, case=False, na=False)]
            if len(cuisine_pool) >= 3:
                pool = cuisine_pool

        # Exclude recently used recipes (avoid repetition)
        pool = pool[~pool['recipe_id'].isin(used_ids)]

        if pool.empty:
            # Reset used if we run out
            pool = meal_pools[meal_slot].copy()

        # Score and pick best
        pool = pool.copy()
        pool['score'] = pool.apply(lambda r: score_recipe(r, cal_target), axis=1)
        best = pool.nlargest(3, 'score').sample(1).iloc[0]   # randomize among top 3 for variety

        return best

    # ── Generate the meal plan ────────────────────────────────────────────────
    plan = []
    used_ids = []

    for day in range(1, days + 1):
        day_plan = {'day': day, 'meals': {}}
        day_total_cal = 0

        for meal_slot, ratio in MEAL_SPLITS.items():
            cal_target = daily_calories * ratio
            recipe = pick_recipe(meal_slot, cal_target, used_ids, diet, cuisine_pref)

            used_ids.append(recipe['recipe_id'])
            if len(used_ids) > 30:   # keep a rolling window
                used_ids = used_ids[-20:]

            day_plan['meals'][meal_slot] = {
                'recipe_id':   recipe['recipe_id'],
                'name':        recipe['recipe_name'],
                'calories':    int(recipe['calories']),
                'protein':     round(float(recipe['protein']), 1),
                'carbs':       round(float(recipe['carbs']), 1),
                'fat':         round(float(recipe['fat']), 1),
                'cuisine':     recipe['cuisine'],
                'diet':        recipe['diet'],
                'difficulty':  recipe['difficulty'],
                'time_mins':   int(recipe['total_time_mins']),
                'emoji':       get_emoji(meal_slot, recipe['diet']),
            }
            day_total_cal += int(recipe['calories'])

        day_plan['total_calories'] = day_total_cal
        plan.append(day_plan)

    return jsonify({
        'days':            days,
        'daily_target':    daily_calories,
        'diet':            diet,
        'plan':            plan,
    })


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status':        'ok',
        'recipes_loaded': len(recipes_df),
        'models':        ['knn_recommender', 'tfidf_similarity', 'meal_planner'],
    })


# ─────────────────────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("  Starting SmartChef API on http://localhost:5000")
    print("  Press Ctrl+C to stop\n")
    app.run(debug=True, port=5000, host='0.0.0.0')
