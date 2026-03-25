"""
SmartChef - Flask Backend API
================================
ENDPOINTS:
  Auth:
    POST /register
    POST /login
    GET  /logout
    GET  /api/me

  Recipes:
    GET  /api/recipes/all
    GET  /api/recipes/filter
    GET  /api/recipe/<id>
    GET  /api/search?q=

  ML:
    POST /api/recommend
    GET  /api/similar/<id>
    POST /api/mealplan

USAGE:
  pip install flask flask-cors pandas numpy scikit-learn psycopg2-binary python-dotenv werkzeug
  python app.py
"""

from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
import numpy as np
import pickle
import os
import re
import json
import random
import warnings
warnings.filterwarnings('ignore')

import psycopg2
from psycopg2.extras import RealDictCursor
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'smartchef-dev-secret-2024')
CORS(app, supports_credentials=True, origins=['*'])  # Allow all origins for production

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        "status": "success",
        "message": "SmartChef Backend API is running",
        "version": "1.0.0"
    })

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')


# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db():
    if DATABASE_URL:
        # Production: Use the full connection string (Neon/Render)
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    
    # Fallback/Local: Use individual environment variables
    db_config = {
        'host':     os.getenv('DB_HOST',     'localhost'),
        'port':     os.getenv('DB_PORT',     '5432'),
        'dbname':   os.getenv('DB_NAME',     'smartchef'),
        'user':     os.getenv('DB_USER',     'postgres'),
        'password': os.getenv('DB_PASSWORD', '123456789'),
    }
    return psycopg2.connect(**db_config, cursor_factory=RealDictCursor)

def init_db():
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         SERIAL PRIMARY KEY,
            name       VARCHAR(100) NOT NULL,
            email      VARCHAR(150) UNIQUE NOT NULL,
            password   VARCHAR(255) NOT NULL,
            height     FLOAT NOT NULL,
            weight     FLOAT NOT NULL,
            goal       VARCHAR(50) NOT NULL DEFAULT 'maintenance',
            age        INTEGER DEFAULT 21,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    # Add age column if it doesn't exist (for existing databases)
    cur.execute("""
        ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT 21;
    """)
    
    # Add favourites table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS favourites (
            id         SERIAL PRIMARY KEY,
            user_email VARCHAR(150) NOT NULL,
            recipe_id  VARCHAR(100) NOT NULL,
            saved_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_email, recipe_id)
        );
    """)

    # Add meal_plan_history table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS meal_plan_history (
            id         SERIAL PRIMARY KEY,
            user_email VARCHAR(150) NOT NULL,
            plan_name  VARCHAR(200),
            plan_json  TEXT NOT NULL,
            days       INTEGER NOT NULL,
            diet       VARCHAR(20),
            daily_calories INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("  ✓ Database tables ready")


# ─────────────────────────────────────────────
# LOAD ML MODELS
# ─────────────────────────────────────────────
print("\n" + "="*55)
print("  SmartChef API — Loading Models...")
print("="*55)

def load_pickle(filename):
    with open(os.path.join(MODELS_DIR, filename), 'rb') as f:
        return pickle.load(f)

recipes_df        = load_pickle('recipes_df.pkl')
knn_bundle        = load_pickle('knn_recommender.pkl')
tfidf_bundle      = load_pickle('tfidf_similarity.pkl')
scaler            = load_pickle('feature_scaler.pkl')
encoders          = load_pickle('label_encoders.pkl')
meal_planner_data = load_pickle('meal_planner.pkl')

knn_model        = knn_bundle['model']
knn_feature_cols = knn_bundle['feature_cols']
knn_recipe_ids   = knn_bundle['recipe_ids']
tfidf_vectorizer = tfidf_bundle['vectorizer']
tfidf_matrix     = tfidf_bundle['matrix']
tfidf_recipe_ids = tfidf_bundle['recipe_ids']

print(f"  ✓ Loaded {len(recipes_df)} recipes")
print(f"  ✓ KNN model ready")
print(f"  ✓ TF-IDF model ready")
print(f"  ✓ Meal planner ready")

try:
    init_db()
except Exception as e:
    print(f"  ⚠ DB init warning: {e}")

print("="*55 + "\n")



# ─────────────────────────────────────────────
# CALORIES PER SERVING HELPER
# This is the KEY fix — always divide by servings
# so all calorie values are for 1 person / 1 serving
# ─────────────────────────────────────────────
def calories_per_serving(row):
    """Return calories for exactly 1 serving — always a whole number."""
    raw_cal  = float(row.get('calories', 0) or 0)
    servings = float(row.get('servings',  4) or 4)
    if servings <= 0:
        servings = 4
    return round(raw_cal / servings)   # ← int, no decimals

def nutrition_per_serving(row):
    """Return full nutrition dict for 1 serving."""
    servings = float(row.get('servings', 4) or 4)
    if servings <= 0:
        servings = 4
    return {
        'calories': round(float(row.get('calories', 0) or 0) / servings),
        'protein':  round(float(row.get('protein',  0) or 0) / servings, 1),
        'carbs':    round(float(row.get('carbs',    0) or 0) / servings, 1),
        'fat':      round(float(row.get('fat',      0) or 0) / servings, 1),
        'fiber':    round(float(row.get('fiber',    0) or 0) / servings, 1),
    }


# ─────────────────────────────────────────────
# EMOJI HELPERS
# ─────────────────────────────────────────────
COURSE_EMOJIS = {
    'Breakfast':   ['🥣', '🍳', '🥞', '🫓', '🍱'],
    'Lunch':       ['🍛', '🍚', '🥘', '🫕', '🍲'],
    'Dinner':      ['🍽️', '🥗', '🫙', '🍜', '🥩'],
    'Snack':       ['🥨', '🧆', '🥙', '🌮', '🥪'],
    'Dessert':     ['🍮', '🧁', '🍰', '🍬', '🧇'],
    'Soup':        ['🍜', '🫕', '🥣', '🍲', '🥗'],
    'Drink':       ['🥤', '🧃', '🥛', '☕', '🍵'],
    'Main Course': ['🍛', '🥘', '🫕', '🍲', '🍽️'],
}

def get_emoji(course, diet=None):
    return random.choice(COURSE_EMOJIS.get(course, ['🍴']))


# ─────────────────────────────────────────────
# RECIPE HELPERS
# ─────────────────────────────────────────────
def recipe_to_summary(row):
    return {
        'key':        row['recipe_id'],
        'name':       row['recipe_name'],
        'cuisine':    row['cuisine'],
        'diet':       row['diet'],
        'course':     row['course'],
        'time':       row['time_label'],
        'difficulty': row['difficulty'],
        'calories':   int(round(calories_per_serving(row))),  # always whole number
        'emoji':      get_emoji(row['course'], row['diet']),
    }


def recipe_to_detail(row, servings=1):
    ingredients = []
    for ing_str in str(row['ingredients_raw']).split(','):
        ing_str = ing_str.strip()
        if not ing_str:
            continue
        # Match leading number, then optional unit, then name
        # Key fix: qty group requires at least one digit so letter-names aren't consumed
        m = re.match(
            r'^([\d][[\d\s/\.\-]*)?\s*(tablespoons?|teaspoons?|cups?|grams?|kg|ml|cloves?|inches?|sprigs?|pinch|handful|pieces?|tbsp|tsp\b|g\b)?\s*(.+)$',
            ing_str, re.IGNORECASE
        )
        if m:
            qty_raw = m.group(1)
            unit    = (m.group(2) or '').strip()
            name    = (m.group(3) or ing_str).strip()
            qty     = qty_raw.strip() if qty_raw else '—'
            name = re.sub(r'\s*-\s*[A-Z][a-z].*$', '', name)
            name = re.sub(r'\(.*?\)', '', name).strip(' -.,')
        else:
            qty, unit, name = '—', '', ing_str.strip()
        if name and len(name) > 1:
            ingredients.append({'name': name, 'qty': qty, 'unit': unit})

    raw_instructions = str(row['instructions'])
    steps = [s.strip() for s in raw_instructions.split('\n') if s.strip() and len(s.strip()) > 10]
    if len(steps) <= 1:
        steps = [s.strip() + '.' for s in raw_instructions.split('.') if len(s.strip()) > 10]
    steps = steps[:15]

    base_servings = int(row.get('servings', 4)) or 4
    scale = servings / base_servings

    goal_map = {
        'weight-loss': 'Weight Loss', 'weight-gain': 'Weight Gain',
        'muscle-gain': 'Muscle Gain', 'maintenance':  'Maintenance',
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
            'carbs':    round(float(row['carbs'])   * scale, 1),
            'fats':     round(float(row['fat'])     * scale, 1),
            'fiber':    round(float(row['fiber'])   * scale, 1),
        },
        'substitutions': generate_substitutions(row),
        'chef_tip':      generate_chef_tip(row),
    }


def generate_substitutions(row):
    """Rule-based smart substitutions — 18 ingredient rules, goal-aware."""
    subs = []
    ingredients_lower = str(row.get('ingredients_clean', '') or '').lower()
    goal = session.get('goal', 'maintenance')

    RULES = [
        {'check': 'sugar',          'from': 'Sugar',                     'to': 'Jaggery or Stevia',              'reason': 'Lower glycemic index — better blood sugar control'},
        {'check': 'maida',          'from': 'Maida (refined flour)',      'to': 'Whole wheat flour or Besan',     'reason': 'Higher fibre, more nutrients, better digestion'},
        {'check': 'all purpose',    'from': 'All-purpose flour',          'to': 'Whole wheat flour',              'reason': 'More fibre and nutrients than refined flour'},
        {'check': 'fresh cream',    'from': 'Fresh cream',                'to': 'Hung curd (Greek yogurt)',       'reason': 'Lower fat, higher protein, same creamy texture'},
        {'check': 'butter',         'from': 'Butter',                     'to': 'Ghee (small quantity)',          'reason': 'Ghee has healthy fats and a higher smoke point'},
        {'check': 'white rice',     'from': 'White rice',                 'to': 'Brown rice or Millets',          'reason': 'More fibre and nutrients, lower glycemic index'},
        {'check': 'coconut milk',   'from': 'Full-fat coconut milk',      'to': 'Light coconut milk',             'reason': 'Fewer calories, same rich coconut flavour'},
        {'check': 'paneer',         'from': 'Full-fat paneer',            'to': 'Low-fat paneer or Tofu',         'reason': 'Fewer calories, similar protein content'},
        {'check': 'refined oil',    'from': 'Refined oil',                'to': 'Cold-pressed mustard or coconut oil', 'reason': 'Healthier fat profile, better for cooking'},
        {'check': 'milk',           'from': 'Full-fat milk',              'to': 'Low-fat or oat milk',            'reason': 'Fewer calories while maintaining creaminess'},
        {'check': 'potato',         'from': 'Potato',                     'to': 'Sweet potato',                   'reason': 'Higher fibre, more vitamins, lower glycemic index'},
        {'check': 'semolina',       'from': 'Semolina (Rava)',            'to': 'Oats or Ragi flour',             'reason': 'More fibre and protein than refined semolina'},
        {'check': 'condensed milk', 'from': 'Condensed milk',             'to': 'Coconut condensed milk',         'reason': 'Dairy-free option with similar sweetness'},
        {'check': 'chicken',        'from': 'Chicken with skin',          'to': 'Skinless chicken breast',        'reason': 'Significantly lower fat, same protein content'},
        {'check': 'mutton',         'from': 'Mutton',                     'to': 'Lean chicken or fish',           'reason': 'Lower saturated fat, easier to digest'},
        {'check': 'soda',           'from': 'Baking soda',                'to': 'Natural leavening (curd + heat)','reason': 'Gentler on digestion, no metallic aftertaste'},
    ]

    # Goal-specific override: muscle-gain users get protein-boosting subs
    if goal == 'muscle-gain':
        if 'rice' in ingredients_lower:
            subs.append({'from': 'Plain rice', 'to': 'Rice + cooked lentils (1:1)', 'reason': 'Adds complete protein — great for muscle recovery'})
        if 'roti' in ingredients_lower or 'flour' in ingredients_lower:
            subs.append({'from': 'Plain wheat roti', 'to': 'Multigrain or besan roti', 'reason': 'Higher protein per roti, same satisfying texture'})

    if len(subs) < 2:
        for rule in RULES:
            if rule['check'] in ingredients_lower:
                subs.append({'from': rule['from'], 'to': rule['to'], 'reason': rule['reason']})
            if len(subs) >= 2:
                break
    return subs[:2]


def generate_chef_tip(row):
    """Dynamic chef tip based on cuisine, course, cooking time and key ingredients."""
    cuisine   = str(row.get('cuisine', '')).lower()
    course    = str(row.get('course', '')).lower()
    difficulty= str(row.get('difficulty', '')).lower()
    time_mins = int(row.get('total_time_mins', 30) or 30)
    ings      = str(row.get('ingredients_clean', '') or '').lower()
    name      = str(row.get('recipe_name', '') or '').lower()

    # Cuisine-specific tips
    if 'south indian' in cuisine:
        tips = [
            "Ferment the batter overnight for extra tanginess and better texture — the longer, the better.",
            "Always use a well-seasoned cast iron tawa for crispy dosas. Never use a non-stick for authentic results.",
            "Tempering (tadka) with mustard seeds, curry leaves and dried red chilli is the soul of South Indian cooking.",
            "The coconut chutney tastes best freshly ground — never use desiccated coconut as a substitute.",
        ]
    elif 'punjabi' in cuisine or 'north indian' in cuisine:
        tips = [
            "The secret to a rich gravy is slow-cooking onions until deeply golden — never rush this step.",
            "Add a small piece of butter right before serving for that authentic dhaba-style richness.",
            "Whole spices bloomed in hot oil release far more flavour than pre-ground powder.",
            "Resting the dough for at least 30 minutes makes rotis softer and easier to roll.",
        ]
    elif 'bengali' in cuisine:
        tips = [
            "Mustard oil gives Bengali dishes their distinctive pungency — heat it to smoking point first to mellow the sharpness.",
            "Panch phoron (five-spice mix) is your go-to tempering for most Bengali vegetables.",
            "Never overcook fish in Bengali curries — 5 minutes is usually enough once the gravy is ready.",
        ]
    elif 'gujarati' in cuisine:
        tips = [
            "The sweet-salty-spicy balance is key in Gujarati cooking — taste and adjust at every stage.",
            "Adding a pinch of sugar to vegetables like karela balances bitterness beautifully.",
            "Besan-based dishes need constant stirring on low heat to avoid lumps and raw flour taste.",
        ]
    elif 'rajasthani' in cuisine:
        tips = [
            "Rajasthani cooking uses minimal water — rely on yogurt and fat for moisture instead.",
            "Dried spices are the hero here. Toast them dry before grinding for maximum aroma.",
            "Dal Baati is best eaten immediately after it comes out of the oven while the crust is crisp.",
        ]
    elif 'maharashtrian' in cuisine:
        tips = [
            "Goda masala is the secret weapon of Maharashtrian cooking — it adds a unique sweet-spicy depth.",
            "Always add peanuts and sesame seeds for that authentic Maharashtrian nutty flavour.",
            "Kokum souring agent gives a distinctly different tanginess compared to tamarind — don't substitute.",
        ]
    elif 'kerala' in cuisine:
        tips = [
            "Coconut is the backbone of Kerala cuisine — use fresh grated coconut wherever possible.",
            "Coconut oil at the end of cooking gives an authentic Kerala aroma that no other oil replicates.",
            "Curry leaves must be fresh and added to hot oil — dried leaves lose most of their flavour.",
        ]
    elif 'hyderabadi' in cuisine or 'andhra' in cuisine:
        tips = [
            "Dum cooking — sealing the pot with dough and cooking on low flame — is what makes Hyderabadi biryani magical.",
            "The spice level in Andhra cooking is intentional — balance it with cooling raita or rice.",
            "Caramelised onions (birista) take time to make but are non-negotiable for authentic biryani.",
        ]
    elif 'mughlai' in cuisine:
        tips = [
            "Marinating in yogurt and spices for at least 4 hours (ideally overnight) is the Mughlai secret.",
            "Slow cooking on low flame (dum) develops deep, complex flavours that high heat can't replicate.",
            "Use whole spices generously — remove them before serving but let them infuse throughout cooking.",
        ]
    elif 'fusion' in cuisine or 'continental' in cuisine:
        tips = [
            "Fusion cooking is about balance — keep one cuisine as the base and accent with the other.",
            "Season at every stage, not just at the end — this builds layers of flavour.",
        ]
    else:
        tips = [
            "The Bhuna technique — cooking spices in oil until the oil separates — is the foundation of great Indian curries.",
            "Salt added at the beginning draws out moisture; added at the end preserves texture. Know when to use which.",
            "Fresh ingredients always win. Grind your own spices when you can — the aroma difference is remarkable.",
            "Taste constantly as you cook and adjust. Recipes are guides, not rules.",
        ]

    # Course-specific override
    if 'breakfast' in course:
        course_tips = [
            "Breakfast dishes taste best fresh off the pan — prep the batter ahead but cook to order.",
            "A hot tawa and proper resting time between batches makes all the difference for even cooking.",
        ]
        tips = course_tips + tips

    elif 'dessert' in course:
        course_tips = [
            "Indian sweets are sensitive to heat — cook on low flame and stir constantly to avoid burning.",
            "Use full-fat milk for richer, creamier mithai. Low-fat milk will take much longer to reduce.",
        ]
        tips = course_tips + tips

    elif 'soup' in course:
        course_tips = [
            "Always adjust seasoning just before serving — flavours intensify as soup cooks down.",
            "A squeeze of lemon right before serving brightens the entire bowl.",
        ]
        tips = course_tips + tips

    # Ingredient-specific tips mixed in
    if 'dal' in ings or 'lentil' in ings:
        tips.insert(0, "Pressure cook dal until completely soft before tempering — undercooked lentils ruin the texture.")
    if 'chicken' in ings:
        tips.insert(0, "Pat chicken completely dry before marinating — moisture prevents proper browning.")
    if 'fish' in ings:
        tips.insert(0, "Marinate fish for no more than 30 minutes — longer and the acid breaks down the flesh.")
    if 'dough' in ings or 'flour' in ings:
        tips.insert(0, "Rest the dough covered with a damp cloth for at least 20 minutes for softer results.")

    # Difficulty-specific tip
    if difficulty == 'hard':
        tips.append("This is an advanced recipe — read through all steps before you start and prep everything in advance (mise en place).")
    elif difficulty == 'easy' and time_mins < 20:
        tips.append("Quick to make but don't rush the tempering — 60 seconds of blooming spices in hot oil transforms the dish.")

    return random.choice(tips[:6])  # Pick from top 6 most relevant tips


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    required = ['name', 'username', 'password', 'height', 'weight', 'goal']
    for field in required:
        if not data.get(field):
            return jsonify({'success': False, 'message': f'Missing field: {field}'}), 400

    email    = data['username'].strip().lower()
    name     = data['name'].strip()
    password = generate_password_hash(data['password'])
    height   = float(data['height'])
    weight   = float(data['weight'])
    goal     = data['goal']
    age      = int(data.get('age', 21))

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO users (name, email, password, height, weight, goal, age) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id, name, email, height, weight, goal, age",
            (name, email, password, height, weight, goal, age)
        )
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
    except psycopg2.errors.UniqueViolation:
        return jsonify({'success': False, 'message': 'Email already registered'}), 409
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

    session['email'] = email
    session['goal']  = goal

    return jsonify({
        'success': True,
        'user': {
            'name':     user['name'],
            'username': user['email'],
            'height':   user['height'],
            'weight':   user['weight'],
            'goal':     user['goal'],
            'age':      user['age'],
        }
    })


@app.route('/login', methods=['POST'])
def login():
    data     = request.json
    email    = data.get('username', '').strip().lower()
    password = data.get('password', '')

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

    session['email'] = email
    session['goal']  = user['goal']

    return jsonify({
        'success': True,
        'user': {
            'name':     user['name'],
            'username': user['email'],
            'height':   user['height'],
            'weight':   user['weight'],
            'goal':     user['goal'],
            'age':      user.get('age', 21),
        }
    })


@app.route('/logout', methods=['GET'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/profile', methods=['PUT'])
def update_profile():
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    data   = request.json
    name   = data.get('name', '').strip()
    height = float(data.get('height', 0))
    weight = float(data.get('weight', 0))
    goal   = data.get('goal', 'maintenance')
    age    = int(data.get('age', 21))
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "UPDATE users SET name=%s, height=%s, weight=%s, goal=%s, age=%s WHERE email=%s RETURNING name, email, height, weight, goal, age",
            (name, height, weight, goal, age, email)
        )
        user = cur.fetchone()
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    session['goal'] = goal
    return jsonify({'success': True, 'user': {
        'name': user['name'], 'username': user['email'],
        'height': user['height'], 'weight': user['weight'],
        'goal': user['goal'], 'age': user.get('age', 21)
    }})


@app.route('/api/password', methods=['PUT'])
def update_password():
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    data             = request.json
    current_password = data.get('current_password', '')
    new_password     = data.get('new_password', '')
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT password FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        if not user or not check_password_hash(user['password'], current_password):
            cur.close(); conn.close()
            return jsonify({'success': False, 'message': 'Current password is incorrect'}), 401
        cur.execute("UPDATE users SET password=%s WHERE email=%s", (generate_password_hash(new_password), email))
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    return jsonify({'success': True, 'message': 'Password updated successfully'})


@app.route('/api/me', methods=['GET'])
def me():
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT name, email, height, weight, goal, age FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    return jsonify({
        'success': True,
        'user': {
            'name':     user['name'],
            'username': user['email'],
            'height':   user['height'],
            'weight':   user['weight'],
            'goal':     user['goal'],
            'age':      user.get('age', 21),
        }
    })


# ─────────────────────────────────────────────────────────────────────────────
# RECIPE ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/recipes/all', methods=['GET'])
def get_all_recipes():
    page     = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 30))
    start    = (page - 1) * per_page
    subset   = recipes_df.iloc[start:start + per_page]
    return jsonify([recipe_to_summary(row) for _, row in subset.iterrows()])


@app.route('/api/recipes/filter', methods=['GET'])
def filter_recipes():
    diet      = request.args.get('diet', '').strip()
    course    = request.args.get('course', '').strip()
    min_cal   = request.args.get('min_cal', '')
    max_cal   = request.args.get('max_cal', '')
    max_time  = request.args.get('max_time', '')
    diff      = request.args.get('difficulty', '').strip()
    cuisine   = request.args.get('cuisine', '').strip()
    inc_ing   = request.args.get('include_ingredient', '').strip()
    exc_ing   = request.args.get('exclude_ingredient', '').strip()

    df = recipes_df.copy()

    if diet:
        mapped = {'veg': 'Veg', 'non-veg': 'Non-Veg'}.get(diet, diet)
        df = df[df['diet'] == mapped]
    if course:
        mapped = {'breakfast':'Breakfast','lunch':'Lunch','dinner':'Dinner',
                  'snack':'Snack','dessert':'Dessert','soup':'Soup','drink':'Drink'}.get(course.lower(), course)
        df = df[df['course'] == mapped]
    
    if min_cal:
        df = df[df['calories'] >= int(min_cal)]
    if max_cal:
        df = df[df['calories'] <= int(max_cal)]
    if max_time:
        df = df[df['total_time_mins'] <= int(max_time)]
    if diff:
        df = df[df['difficulty'] == diff]
    if cuisine:
        df = df[df['cuisine'].str.lower().str.contains(cuisine.lower(), na=False)]
    if inc_ing:
        df = df[df['ingredients_list_str'].str.lower().str.contains(inc_ing.lower(), na=False)]
    if exc_ing:
        df = df[~df['ingredients_list_str'].str.lower().str.contains(exc_ing.lower(), na=False)]

    return jsonify([recipe_to_summary(row) for _, row in df.head(50).iterrows()])


@app.route('/api/recipe/<recipe_id>', methods=['GET'])
def get_recipe_detail(recipe_id):
    servings = int(request.args.get('servings', 1))
    row      = recipes_df[recipes_df['recipe_id'] == recipe_id]
    if row.empty:
        return jsonify({'error': 'Recipe not found'}), 404
    return jsonify(recipe_to_detail(row.iloc[0], servings=servings))


@app.route('/api/search', methods=['GET'])
def search_recipes():
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify([])
    mask = (
        recipes_df['recipe_name'].str.lower().str.contains(query, na=False) |
        recipes_df['ingredients_list_str'].str.lower().str.contains(query, na=False) |
        recipes_df['cuisine'].str.lower().str.contains(query, na=False)
    )
    return jsonify([recipe_to_summary(row) for _, row in recipes_df[mask].head(30).iterrows()])


# ─────────────────────────────────────────────────────────────────────────────
# FAVOURITES ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/favourites', methods=['POST'])
def add_favourite():
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    data = request.json
    recipe_id = data.get('recipe_id')
    if not recipe_id:
        return jsonify({'success': False, 'message': 'Missing recipe_id'}), 400
        
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO favourites (user_email, recipe_id) VALUES (%s, %s) ON CONFLICT (user_email, recipe_id) DO NOTHING",
            (email, recipe_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/favourites/<recipe_id>', methods=['DELETE'])
def remove_favourite(recipe_id):
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "DELETE FROM favourites WHERE user_email = %s AND recipe_id = %s",
            (email, recipe_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/favourites', methods=['GET'])
def get_favourites():
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT recipe_id FROM favourites WHERE user_email = %s", (email,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        fav_ids = [row['recipe_id'] for row in rows]
        
        # Join with recipes_df to get full summaries
        fav_recipes = []
        for rid in fav_ids:
            row = recipes_df[recipes_df['recipe_id'] == rid]
            if not row.empty:
                fav_recipes.append(recipe_to_summary(row.iloc[0]))
                
        return jsonify(fav_recipes)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# ML ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/recommend', methods=['POST'])
def recommend():
    data   = request.json or {}
    height = float(data.get('height', 165))
    weight = float(data.get('weight', 70))
    goal   = data.get('goal', 'maintenance')
    diet   = data.get('diet', 'Veg')
    course = data.get('course', '')
    n      = int(data.get('n', 10))

    bmi = weight / ((height / 100) ** 2)

    GOAL_PROFILES = {
        'weight-loss': [300, 22, 30,  8, 8],
        'weight-gain': [650, 30, 80, 20, 5],
        'muscle-gain': [500, 35, 55, 12, 6],
        'maintenance': [450, 18, 55, 14, 6],
    }
    profile = GOAL_PROFILES.get(goal, GOAL_PROFILES['maintenance'])
    cal_target, prot_target, carb_target, fat_target, fiber_target = profile

    if bmi > 30:     cal_target = int(cal_target * 0.85)
    elif bmi < 18.5: cal_target = int(cal_target * 1.20)

    course_enc = encoders['course']
    diet_val   = 1 if diet == 'Veg' else 0
    course_val = 0
    if course:
        try:
            course_val = int(course_enc.transform([course])[0])
        except:
            course_val = 0

    query_scaled = scaler.transform(np.array([[
        cal_target, prot_target, carb_target, fat_target, fiber_target,
        diet_val, course_val, 1, 30
    ]]))

    distances, indices = knn_model.kneighbors(query_scaled, n_neighbors=min(50, len(recipes_df)))

    recommended = []
    for idx in indices[0]:
        row = recipes_df.iloc[idx]
        if diet and row['diet'] != diet: continue
        if course and row['course'] != course: continue
        recommended.append(recipe_to_summary(row))
        if len(recommended) >= n: break

    if len(recommended) < 5:
        for idx in indices[0]:
            s = recipe_to_summary(recipes_df.iloc[idx])
            if s not in recommended:
                recommended.append(s)
            if len(recommended) >= n: break

    return jsonify({
        'bmi': round(bmi, 1), 'goal': goal,
        'cal_target': cal_target,
        'recipes': recommended[:n],
        'count': len(recommended[:n])
    })


@app.route('/api/similar/<recipe_id>', methods=['GET'])
def similar_recipes(recipe_id):
    n = int(request.args.get('n', 5))
    try:
        idx = tfidf_recipe_ids.index(recipe_id)
    except ValueError:
        return jsonify({'error': 'Recipe not found'}), 404

    sim_scores  = cosine_similarity(tfidf_matrix[idx], tfidf_matrix).flatten()
    top_indices = [i for i in sim_scores.argsort()[::-1] if i != idx][:n * 3]

    results = []
    for i in top_indices:
        row = recipes_df[recipes_df['recipe_id'] == tfidf_recipe_ids[i]]
        if row.empty: continue
        s = recipe_to_summary(row.iloc[0])
        s['similarity_score'] = round(float(sim_scores[i]), 3)
        results.append(s)
        if len(results) >= n: break

    return jsonify(results)


import json
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────────────
# MEAL PLAN — Multi-dish Indian meals, calories per 1 serving, goal-aware
# ─────────────────────────────────────────────────────────────────────────────

# How many dishes to pick per meal slot
MEAL_STRUCTURE = {
    'Breakfast': {
        'slots': [
            {'name': 'main',  'courses': ['Breakfast'],                   'cal_ratio': 0.70},
            {'name': 'side',  'courses': ['Drink', 'Snack', 'Dessert'],   'cal_ratio': 0.30},
        ],
        'total_ratio': 0.25,  # 25% of daily calories
    },
    'Lunch': {
        'slots': [
            {'name': 'carb',  'courses': ['Lunch', 'Main Course'],        'cal_ratio': 0.30},  # rice/roti
            {'name': 'dal',   'courses': ['Lunch', 'Main Course', 'Soup'],'cal_ratio': 0.35},  # dal/curry
            {'name': 'sabji', 'courses': ['Lunch', 'Main Course'],        'cal_ratio': 0.25},  # sabji/side
            {'name': 'extra', 'courses': ['Snack', 'Dessert'],            'cal_ratio': 0.10},  # raita/salad
        ],
        'total_ratio': 0.35,  # 35% of daily calories
    },
    'Snack': {
        'slots': [
            {'name': 'snack', 'courses': ['Snack', 'Drink', 'Dessert'],   'cal_ratio': 1.00},
        ],
        'total_ratio': 0.05,  # 5% of daily calories
    },
    'Dinner': {
        'slots': [
            {'name': 'carb',  'courses': ['Dinner', 'Main Course'],       'cal_ratio': 0.35},  # rice/roti
            {'name': 'main',  'courses': ['Dinner', 'Main Course'],       'cal_ratio': 0.45},  # curry/gravy
            {'name': 'side',  'courses': ['Dinner', 'Soup', 'Snack'],     'cal_ratio': 0.20},  # side/soup
        ],
        'total_ratio': 0.35,  # 35% of daily calories
    },
}

def build_meal_pool(diet=None, goal=None, daily_calories=2000):
    """Fast vectorized meal pool builder — no .apply() loops."""
    df = recipes_df.copy()

    # Diet filter
    if diet and diet in ['Veg', 'Non-Veg']:
        filtered = df[df['diet'] == diet]
        if len(filtered) >= 50:
            df = filtered

    # Vectorized per-serving nutrition (100x faster than .apply)
    srv = df['servings'].fillna(4).astype(float).clip(lower=1)
    df['cal_per_serving']   = df['calories'].fillna(0).astype(float) / srv
    df['prot_per_serving']  = df['protein'].fillna(0).astype(float)  / srv
    df['carb_per_serving']  = df['carbs'].fillna(0).astype(float)    / srv
    df['fat_per_serving']   = df['fat'].fillna(0).astype(float)      / srv
    df['fiber_per_serving'] = df['fiber'].fillna(0).astype(float)    / srv

    df = df[(df['cal_per_serving'] >= 30) & (df['cal_per_serving'] <= 1500)]
    return df


def pick_dish(pool_df, target_courses, cal_target, used_ids, tolerance=0.60):
    """
    Pick 1 recipe from pool that:
    - Matches one of the target courses
    - Has per-serving calories within ±tolerance of cal_target
    - Hasn't been used yet this week
    """
    candidates = pool_df[pool_df['course'].isin(target_courses)].copy()

    # Try strict calorie range first
    cal_min = cal_target * (1 - tolerance)
    cal_max = cal_target * (1 + tolerance)
    strict  = candidates[
        (candidates['cal_per_serving'] >= cal_min) &
        (candidates['cal_per_serving'] <= cal_max) &
        (~candidates['recipe_id'].isin(used_ids))
    ]

    if len(strict) >= 1:
        candidates = strict
    else:
        # Fallback: just avoid used IDs
        candidates = candidates[~candidates['recipe_id'].isin(used_ids)]
        if candidates.empty:
            candidates = pool_df[pool_df['course'].isin(target_courses)].copy()

    if candidates.empty:
        return None

    # Score: prefer recipes closest to calorie target + good protein
    candidates = candidates.copy()
    candidates['score'] = (
        1.0 / (abs(candidates['cal_per_serving'] - cal_target) + 1) *
        (1 + candidates['prot_per_serving'] / 30) *
        (1 + candidates['fiber_per_serving'] / 15)
    )

    # Sample from top 5 to add variety
    top = candidates.nlargest(5, 'score')
    chosen = top.sample(1).iloc[0]
    return chosen


@app.route('/api/mealplan', methods=['POST'])
def meal_plan():
    data           = request.json or {}
    daily_calories = int(data.get('daily_calories', 2000))
    diet           = data.get('diet', 'Veg')
    days           = min(int(data.get('days', 7)), 14)
    goal           = data.get('goal', 'maintenance')

    # Build pool for this request
    pool_df = build_meal_pool(diet=diet, goal=goal, daily_calories=daily_calories)

    plan     = []
    used_ids = []   # Track used recipes across all days for variety

    for day_num in range(1, days + 1):
        day_plan = {
            'day':            day_num,
            'meals':          {},
            'total_calories': 0,
        }

        for meal_slot, structure in MEAL_STRUCTURE.items():
            meal_total_cal = daily_calories * structure['total_ratio']
            dishes         = []
            meal_cal_total = 0

            for slot_info in structure['slots']:
                slot_cal_target = meal_total_cal * slot_info['cal_ratio']
                chosen = pick_dish(
                    pool_df,
                    target_courses=slot_info['courses'],
                    cal_target=slot_cal_target,
                    used_ids=used_ids,
                    tolerance=0.60,
                )
                if chosen is None:
                    continue

                used_ids.append(chosen['recipe_id'])
                # Keep used_ids from growing too large
                if len(used_ids) > days * 20:
                    used_ids = used_ids[-(days * 10):]

                cal_1  = round(chosen['cal_per_serving'])
                prot_1 = round(chosen['prot_per_serving'], 1)
                carb_1 = round(chosen['carb_per_serving'], 1)
                fat_1  = round(chosen['fat_per_serving'],  1)

                dishes.append({
                    'slot':       slot_info['name'],
                    'recipe_id':  chosen['recipe_id'],
                    'name':       chosen['recipe_name'],
                    'calories':   cal_1,
                    'protein':    prot_1,
                    'carbs':      carb_1,
                    'fat':        fat_1,
                    'cuisine':    chosen['cuisine'],
                    'diet':       chosen['diet'],
                    'course':     chosen['course'],
                    'difficulty': chosen['difficulty'],
                    'time_mins':  int(chosen['total_time_mins']),
                    'emoji':      get_emoji(meal_slot, chosen['diet']),
                })
                meal_cal_total += cal_1

            # Store dishes list + meal total
            day_plan['meals'][meal_slot] = {
                'dishes':         dishes,
                'total_calories': meal_cal_total,
            }
            day_plan['total_calories'] += meal_cal_total

        plan.append(day_plan)

    # Save to history if logged in
    email = session.get('email')
    if email:
        try:
            plan_name = f"{days}-Day {diet} Plan · {datetime.now().strftime('%b %d')}"
            conn = get_db()
            cur  = conn.cursor()
            cur.execute(
                """INSERT INTO meal_plan_history 
                   (user_email, plan_name, plan_json, days, diet, daily_calories) 
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (email, plan_name, json.dumps(plan), days, diet, daily_calories)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Error saving meal plan history: {e}")

    return jsonify({
        'days':          days,
        'daily_target':  daily_calories,
        'diet':          diet,
        'goal':          goal,
        'plan':          plan,
    })


# ─────────────────────────────────────────────────────────────────────────────
# MEAL PLAN HISTORY ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/mealplan/history', methods=['GET'])
def get_mealplan_history():
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            """SELECT id, plan_name, days, diet, daily_calories, created_at 
               FROM meal_plan_history 
               WHERE user_email = %s 
               ORDER BY created_at DESC LIMIT 10""",
            (email,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/mealplan/history/<int:plan_id>', methods=['GET'])
def get_mealplan_history_entry(plan_id):
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT * FROM meal_plan_history WHERE id = %s AND user_email = %s",
            (plan_id, email)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not row:
            return jsonify({'success': False, 'message': 'Plan not found'}), 404
            
        return jsonify({
            'id': row['id'],
            'plan_name': row['plan_name'],
            'days': row['days'],
            'diet': row['diet'],
            'daily_calories': row['daily_calories'],
            'created_at': row['created_at'],
            'plan': json.loads(row['plan_json'])
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/mealplan/history/<int:plan_id>', methods=['DELETE'])
def delete_mealplan_history_entry(plan_id):
    email = session.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
        
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "DELETE FROM meal_plan_history WHERE id = %s AND user_email = %s",
            (plan_id, email)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'recipes_loaded': len(recipes_df),
        'models': ['knn_recommender', 'tfidf_similarity', 'meal_planner'],
        'database': 'postgresql'
    })


# ─────────────────────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"  Starting SmartChef API on http://0.0.0.0:{port}")
    print("  Press Ctrl+C to stop\n")
    # In production on Render, we use gunicorn. For local testing, we use app.run
    # Setting debug=False for production
    app.run(debug=False, port=port, host='0.0.0.0')