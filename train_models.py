"""
SmartChef - Model Training Script
====================================
Trains 3 ML models and saves them as .pkl files:

  MODEL 1: KNN Recommender
    - Input : BMI value + health goal + diet preference
    - Method: K-Nearest Neighbors on nutrition feature vectors
    - Output: Top N recipe recommendations tailored to the user's health profile

  MODEL 2: TF-IDF Content Similarity
    - Input : A recipe_id
    - Method: TF-IDF vectorization of ingredients → cosine similarity
    - Output: Top N similar recipes based on ingredient overlap

  MODEL 3: Meal Planner
    - Input : Daily calorie target + diet preference + days
    - Method: Greedy algorithm — selects best recipe per meal slot
              within calorie budget using nutrition scoring
    - Output: N-day meal plan with Breakfast / Lunch / Dinner

INPUT:  data/recipes_with_nutrition.csv
OUTPUT: models/knn_recommender.pkl
        models/tfidf_similarity.pkl
        models/label_encoders.pkl
        models/feature_scaler.pkl
        models/training_report.txt

USAGE:
  python train_models.py

REQUIREMENTS:
  pip install pandas numpy scikit-learn
"""

import pandas as pd
import numpy as np
import pickle
import os
import json
import warnings
warnings.filterwarnings('ignore')

from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
INPUT_FILE   = "data/recipes_with_nutrition.csv"
MODELS_DIR   = "models"

KNN_MODEL_PATH      = "models/knn_recommender.pkl"
TFIDF_MODEL_PATH    = "models/tfidf_similarity.pkl"
ENCODERS_PATH       = "models/label_encoders.pkl"
SCALER_PATH         = "models/feature_scaler.pkl"
REPORT_PATH         = "models/training_report.txt"


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: LOAD & PREPARE DATA
# ─────────────────────────────────────────────────────────────────────────────
def load_and_prepare(path):
    print("\n" + "="*60)
    print("STEP 1: Loading & Preparing Data")
    print("="*60)

    df = pd.read_csv(path)
    print(f"  ✓ Loaded {len(df)} recipes")

    # Drop rows with missing nutrition (shouldn't happen but safety check)
    before = len(df)
    df = df.dropna(subset=['calories', 'protein', 'carbs', 'fat', 'fiber'])
    print(f"  ✓ Dropped {before - len(df)} rows with missing nutrition")

    # Reset index
    df = df.reset_index(drop=True)

    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: FEATURE ENGINEERING FOR KNN
# ─────────────────────────────────────────────────────────────────────────────
def build_knn_features(df):
    """
    Build a feature matrix for KNN recommendation.

    Features used:
      Numerical  : calories, protein, carbs, fat, fiber (normalized)
      Categorical: diet, course (label encoded then included)

    The idea: when a user provides their BMI + goal, we compute a
    'target nutrition profile' and find K nearest recipes to that profile.
    """
    print("\n" + "="*60)
    print("STEP 2: Building KNN Feature Matrix")
    print("="*60)

    # ── Label encode categorical features ────────────────────────────────────
    encoders = {}

    diet_enc = LabelEncoder()
    df['diet_encoded'] = diet_enc.fit_transform(df['diet'])
    encoders['diet'] = diet_enc
    print(f"  ✓ Diet classes    : {list(diet_enc.classes_)}")

    course_enc = LabelEncoder()
    df['course_encoded'] = course_enc.fit_transform(df['course'])
    encoders['course'] = course_enc
    print(f"  ✓ Course classes  : {list(course_enc.classes_)}")

    cuisine_enc = LabelEncoder()
    df['cuisine_encoded'] = cuisine_enc.fit_transform(df['cuisine'])
    encoders['cuisine'] = cuisine_enc
    print(f"  ✓ Cuisine classes : {len(cuisine_enc.classes_)} cuisines encoded")

    difficulty_enc = LabelEncoder()
    df['difficulty_encoded'] = difficulty_enc.fit_transform(df['difficulty'])
    encoders['difficulty'] = difficulty_enc
    print(f"  ✓ Difficulty classes : {list(difficulty_enc.classes_)}")

    # ── Build numerical feature matrix ───────────────────────────────────────
    # We weight nutrition features more heavily than categorical ones
    # because recipe recommendations are nutrition-driven
    feature_cols = [
        'calories',           # weight: high importance
        'protein',            # weight: high importance
        'carbs',              # weight: high importance
        'fat',                # weight: high importance
        'fiber',              # weight: medium
        'diet_encoded',       # weight: medium
        'course_encoded',     # weight: low
        'difficulty_encoded', # weight: low
        'total_time_mins',    # weight: low
    ]

    X = df[feature_cols].values.astype(float)

    # ── Scale features ───────────────────────────────────────────────────────
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f"  ✓ Feature matrix  : {X_scaled.shape[0]} recipes × {X_scaled.shape[1]} features")
    print(f"  Features used     : {feature_cols}")

    return df, X_scaled, scaler, encoders, feature_cols


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: TRAIN KNN MODEL
# ─────────────────────────────────────────────────────────────────────────────
def train_knn(X_scaled, n_neighbors=10):
    """
    Train KNN model using Ball Tree algorithm (efficient for large datasets).
    We use cosine distance so that the direction (nutrition ratio) matters
    more than absolute magnitude.
    """
    print("\n" + "="*60)
    print("STEP 3: Training KNN Recommender")
    print("="*60)

    knn = NearestNeighbors(
        n_neighbors=n_neighbors,
        algorithm='ball_tree',   # efficient for medium datasets
        metric='euclidean',      # works well with StandardScaler
        n_jobs=-1                # use all CPU cores
    )
    knn.fit(X_scaled)

    print(f"  ✓ KNN trained with n_neighbors={n_neighbors}")
    print(f"  Algorithm : ball_tree")
    print(f"  Metric    : euclidean (on scaled features)")
    print(f"  Dataset   : {X_scaled.shape[0]} recipes")

    # ── Quick validation: test a sample recommendation ───────────────────────
    # Simulate a user: BMI=27 (overweight), goal=weight-loss
    # Target profile: low calories (~250), high protein (~20g), low carbs (~25g)
    sample_query = np.array([[250, 20, 25, 8, 5, 0, 0, 1, 30]])  # Veg, Main Course
    # Note: this is raw; in actual use we scale it first
    print(f"\n  Validation test:")
    print(f"  Sample user profile: 250 cal, 20g protein, 25g carbs, 8g fat, 5g fiber")

    return knn


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: BUILD TFIDF SIMILARITY MODEL
# ─────────────────────────────────────────────────────────────────────────────
def train_tfidf(df):
    """
    Build a TF-IDF matrix on ingredient lists.
    Each recipe is represented as a bag-of-ingredients.
    Cosine similarity between recipes = ingredient overlap.

    This powers the 'Similar Recipes' feature.
    """
    print("\n" + "="*60)
    print("STEP 4: Training TF-IDF Content Similarity")
    print("="*60)

    # Use ingredients_list_str as the document for each recipe
    corpus = df['ingredients_list_str'].fillna('').tolist()

    # Also mix in recipe name and cuisine for richer matching
    enriched_corpus = []
    for i, row in df.iterrows():
        doc = (
            row['ingredients_list_str'] + ' ' +
            row['cuisine'].lower() + ' ' +
            row['course'].lower() + ' ' +
            row['diet'].lower()
        )
        enriched_corpus.append(doc)

    # TF-IDF vectorizer
    # - min_df=2: ignore ingredients appearing in only 1 recipe (likely noise)
    # - max_features=3000: keep top 3000 terms
    # - ngram_range=(1,2): capture "cumin seeds", "red chilli" as single terms
    tfidf = TfidfVectorizer(
        max_features=3000,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,    # apply log(1+tf) to reduce impact of frequent terms
        strip_accents='unicode',
        analyzer='word',
        token_pattern=r'[a-zA-Z]{2,}',  # only word tokens, min 2 chars
    )

    tfidf_matrix = tfidf.fit_transform(enriched_corpus)

    print(f"  ✓ TF-IDF matrix   : {tfidf_matrix.shape[0]} recipes × {tfidf_matrix.shape[1]} terms")
    print(f"  Vocabulary size   : {len(tfidf.vocabulary_)}")
    print(f"  Top 20 terms      : {list(tfidf.vocabulary_.keys())[:20]}")

    # ── Validation: check similarity for first recipe ─────────────────────────
    sample_vec = tfidf_matrix[0]
    sims = cosine_similarity(sample_vec, tfidf_matrix).flatten()
    top5_idx = sims.argsort()[::-1][1:6]
    print(f"\n  Validation — Similar to '{df.iloc[0]['recipe_name']}':")
    for idx in top5_idx:
        print(f"    → {df.iloc[idx]['recipe_name']} (score: {sims[idx]:.3f})")

    return tfidf, tfidf_matrix


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: BUILD MEAL PLANNER
# ─────────────────────────────────────────────────────────────────────────────
def build_meal_planner(df):
    """
    The meal planner is not a trained ML model — it's a greedy optimization
    algorithm that selects recipes to fill meal slots within a calorie budget.

    For each day:
      - Breakfast : ~25% of daily calories
      - Lunch     : ~35% of daily calories
      - Dinner    : ~35% of daily calories
      - Snack     : ~5%  of daily calories (optional)

    Scoring function:
      score = (1 / |calories - target|+1) × protein_bonus × fiber_bonus
      where protein_bonus = 1 + (protein/30) and fiber_bonus = 1 + (fiber/15)

    This selects recipes closest to the calorie target while preferring
    high-protein, high-fiber options (healthier choices).

    We save the filtered recipe pools (by course) for fast lookup at runtime.
    """
    print("\n" + "="*60)
    print("STEP 5: Building Meal Planner Data Structures")
    print("="*60)

    # Build course-specific recipe pools
    meal_pools = {}

    COURSE_MEAL_MAP = {
        'Breakfast': ['Breakfast'],
        'Lunch':     ['Lunch', 'Main Course'],
        'Dinner':    ['Dinner', 'Main Course'],
        'Snack':     ['Snack'],
    }

    for meal_slot, courses in COURSE_MEAL_MAP.items():
        pool = df[df['course'].isin(courses)].copy()
        # Keep only essential columns for the planner (saves memory)
        pool = pool[[
            'recipe_id', 'recipe_name', 'cuisine', 'diet',
            'course', 'calories', 'protein', 'carbs',
            'fat', 'fiber', 'total_time_mins', 'difficulty'
        ]].reset_index(drop=True)
        meal_pools[meal_slot] = pool
        print(f"  ✓ {meal_slot:<12} pool: {len(pool)} recipes")

    # Save calorie distribution stats for runtime use
    calorie_stats = {
        'mean':   float(df['calories'].mean()),
        'median': float(df['calories'].median()),
        'std':    float(df['calories'].std()),
        'by_course': df.groupby('course')['calories'].median().to_dict()
    }

    meal_planner_data = {
        'meal_pools':    {k: v.to_dict('records') for k, v in meal_pools.items()},
        'calorie_stats': calorie_stats,
    }

    print(f"\n  ✓ Meal planner data built")
    print(f"  Daily calorie stats: mean={calorie_stats['mean']:.0f}, median={calorie_stats['median']:.0f}")

    # ── Validation: test a 1-day plan ─────────────────────────────────────────
    print(f"\n  Validation — Sample 1-day plan (2000 cal target, Veg):")
    daily_target = 2000
    targets = {'Breakfast': 0.25, 'Lunch': 0.35, 'Dinner': 0.35, 'Snack': 0.05}

    for meal, ratio in targets.items():
        cal_target = daily_target * ratio
        pool = meal_pools[meal]
        veg_pool = pool[pool['diet'] == 'Veg'] if len(pool[pool['diet'] == 'Veg']) > 0 else pool
        if len(veg_pool) == 0:
            continue
        # Score: closest to calorie target + protein + fiber bonus
        veg_pool = veg_pool.copy()
        veg_pool['score'] = (
            1 / (abs(veg_pool['calories'] - cal_target) + 1) *
            (1 + veg_pool['protein'] / 30) *
            (1 + veg_pool['fiber'] / 15)
        )
        best = veg_pool.nlargest(1, 'score').iloc[0]
        print(f"    {meal:<12} → {best['recipe_name'][:40]:<40} ({best['calories']} kcal)")

    return meal_planner_data


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: SAVE ALL MODELS
# ─────────────────────────────────────────────────────────────────────────────
def save_models(knn, scaler, encoders, feature_cols, tfidf, tfidf_matrix, meal_planner_data, df):
    print("\n" + "="*60)
    print("STEP 6: Saving Models")
    print("="*60)

    os.makedirs(MODELS_DIR, exist_ok=True)

    # KNN model
    knn_bundle = {
        'model':        knn,
        'feature_cols': feature_cols,
        'recipe_ids':   df['recipe_id'].tolist(),
        'recipe_names': df['recipe_name'].tolist(),
    }
    with open(KNN_MODEL_PATH, 'wb') as f:
        pickle.dump(knn_bundle, f)
    size = os.path.getsize(KNN_MODEL_PATH) / 1024
    print(f"  ✓ KNN model saved      → {KNN_MODEL_PATH} ({size:.1f} KB)")

    # TF-IDF model + matrix
    tfidf_bundle = {
        'vectorizer': tfidf,
        'matrix':     tfidf_matrix,
        'recipe_ids': df['recipe_id'].tolist(),
    }
    with open(TFIDF_MODEL_PATH, 'wb') as f:
        pickle.dump(tfidf_bundle, f)
    size = os.path.getsize(TFIDF_MODEL_PATH) / 1024
    print(f"  ✓ TF-IDF model saved   → {TFIDF_MODEL_PATH} ({size:.1f} KB)")

    # Scaler
    with open(SCALER_PATH, 'wb') as f:
        pickle.dump(scaler, f)
    size = os.path.getsize(SCALER_PATH) / 1024
    print(f"  ✓ Scaler saved         → {SCALER_PATH} ({size:.1f} KB)")

    # Label encoders
    with open(ENCODERS_PATH, 'wb') as f:
        pickle.dump(encoders, f)
    size = os.path.getsize(ENCODERS_PATH) / 1024
    print(f"  ✓ Encoders saved       → {ENCODERS_PATH} ({size:.1f} KB)")

    # Meal planner data
    meal_planner_path = os.path.join(MODELS_DIR, 'meal_planner.pkl')
    with open(meal_planner_path, 'wb') as f:
        pickle.dump(meal_planner_data, f)
    size = os.path.getsize(meal_planner_path) / 1024
    print(f"  ✓ Meal planner saved   → {meal_planner_path} ({size:.1f} KB)")

    # Also save the full processed dataframe as pickle for fast Flask loading
    df_path = os.path.join(MODELS_DIR, 'recipes_df.pkl')
    with open(df_path, 'wb') as f:
        pickle.dump(df, f)
    size = os.path.getsize(df_path) / 1024
    print(f"  ✓ Recipe dataframe saved → {df_path} ({size:.1f} KB)")

    return meal_planner_path


# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: GENERATE TRAINING REPORT
# ─────────────────────────────────────────────────────────────────────────────
def generate_report(df, knn, tfidf, tfidf_matrix, feature_cols):
    print("\n" + "="*60)
    print("STEP 7: Generating Training Report")
    print("="*60)

    lines = []
    lines.append("=" * 60)
    lines.append("SMARTCHEF — MODEL TRAINING REPORT")
    lines.append("=" * 60)
    lines.append("")
    lines.append("1. DATASET USED")
    lines.append(f"   File    : data/recipes_with_nutrition.csv")
    lines.append(f"   Recipes : {len(df)}")
    lines.append(f"   Columns : {len(df.columns)}")
    lines.append("")
    lines.append("2. MODEL 1 — KNN RECOMMENDER")
    lines.append(f"   Algorithm  : K-Nearest Neighbors (Ball Tree)")
    lines.append(f"   Metric     : Euclidean (on StandardScaled features)")
    lines.append(f"   K value    : 10 neighbors")
    lines.append(f"   Features   : {feature_cols}")
    lines.append(f"   Purpose    : Given user BMI + goal → recommend recipes")
    lines.append(f"   Input      : Nutrition target vector [cal, protein, carbs, fat, fiber, ...]")
    lines.append(f"   Output     : Top N recipe IDs sorted by distance")
    lines.append("")
    lines.append("3. MODEL 2 — TF-IDF CONTENT SIMILARITY")
    lines.append(f"   Algorithm  : TF-IDF Vectorization + Cosine Similarity")
    lines.append(f"   Vocab size : {len(tfidf.vocabulary_)}")
    lines.append(f"   Matrix     : {tfidf_matrix.shape[0]} × {tfidf_matrix.shape[1]}")
    lines.append(f"   N-grams    : (1, 2) — unigrams and bigrams")
    lines.append(f"   Purpose    : Given a recipe → find similar recipes")
    lines.append(f"   Input      : recipe_id")
    lines.append(f"   Output     : Top N similar recipe IDs with scores")
    lines.append("")
    lines.append("4. MODEL 3 — MEAL PLANNER")
    lines.append(f"   Algorithm  : Greedy Nutrition Scoring")
    lines.append(f"   Purpose    : Given daily calorie target → generate N-day meal plan")
    lines.append(f"   Slots      : Breakfast (25%) + Lunch (35%) + Dinner (35%) + Snack (5%)")
    lines.append(f"   Scoring    : 1/(|cal-target|+1) × protein_bonus × fiber_bonus")
    lines.append(f"   Input      : daily_calories, diet, days, cuisine_preference")
    lines.append(f"   Output     : Structured meal plan with recipe details")
    lines.append("")
    lines.append("5. SAVED FILES")
    lines.append(f"   models/knn_recommender.pkl")
    lines.append(f"   models/tfidf_similarity.pkl")
    lines.append(f"   models/feature_scaler.pkl")
    lines.append(f"   models/label_encoders.pkl")
    lines.append(f"   models/meal_planner.pkl")
    lines.append(f"   models/recipes_df.pkl")
    lines.append("")
    lines.append("6. HOW MODELS ARE USED IN FLASK (app.py)")
    lines.append("   /api/recommend  → loads knn + scaler + encoders")
    lines.append("                     user BMI+goal → target vector → KNN.kneighbors()")
    lines.append("   /api/similar    → loads tfidf matrix")
    lines.append("                     recipe_id → cosine_similarity() → top N")
    lines.append("   /api/mealplan   → loads meal_planner pools")
    lines.append("                     daily_cal + diet → greedy scoring → N-day plan")
    lines.append("")
    lines.append("=" * 60)
    lines.append("END OF REPORT")
    lines.append("=" * 60)

    report_text = '\n'.join(lines)
    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(report_text)

    print(f"  ✓ Report saved to: {REPORT_PATH}")
    print()
    print(report_text)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "🤖 " * 20)
    print("  SMARTCHEF — MODEL TRAINING PIPELINE")
    print("🤖 " * 20)

    if not os.path.exists(INPUT_FILE):
        print(f"\n❌ ERROR: {INPUT_FILE} not found.")
        print("   Run preprocess.py and nutrition_mapper.py first.")
        return

    # Run all steps
    df                                            = load_and_prepare(INPUT_FILE)
    df, X_scaled, scaler, encoders, feature_cols = build_knn_features(df)
    knn                                           = train_knn(X_scaled, n_neighbors=10)
    tfidf, tfidf_matrix                           = train_tfidf(df)
    meal_planner_data                             = build_meal_planner(df)
    save_models(knn, scaler, encoders, feature_cols, tfidf, tfidf_matrix, meal_planner_data, df)
    generate_report(df, knn, tfidf, tfidf_matrix, feature_cols)

    print("\n" + "✅ " * 20)
    print("  ALL MODELS TRAINED AND SAVED!")
    print("✅ " * 20)
    print("\n  Models in models/ folder:")
    for f in os.listdir(MODELS_DIR):
        size = os.path.getsize(os.path.join(MODELS_DIR, f)) / 1024
        print(f"    {f:<30} {size:.1f} KB")
    print("\n  Next step: Write app.py (Flask API)")


if __name__ == '__main__':
    main()
