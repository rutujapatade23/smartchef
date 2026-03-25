"""
SmartChef - Data Preprocessing Script
======================================
This script performs full data cleaning and feature engineering
on the Cleaned_Indian_Food_Dataset.csv file.

OUTPUT FILES:
  - cleaned_recipes.csv        → Cleaned dataset with new features
  - preprocessing_report.txt   → Summary of all cleaning steps done

USAGE:
  python preprocess.py

REQUIREMENTS:
  pip install pandas numpy
"""

import pandas as pd
import numpy as np
import re
import os
import json
from collections import Counter

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
INPUT_FILE  = "data/Cleaned_Indian_Food_Dataset.csv"
OUTPUT_FILE = "data/cleaned_recipes.csv"
REPORT_FILE = "data/preprocessing_report.txt"

# ─────────────────────────────────────────────
# STEP 1: LOAD DATA
# ─────────────────────────────────────────────
def load_data(path):
    print("\n" + "="*60)
    print("STEP 1: Loading Dataset")
    print("="*60)
    
    df = pd.read_csv(path, encoding='utf-8-sig')  # utf-8-sig handles BOM characters
    
    print(f"  ✓ Loaded {len(df)} rows and {len(df.columns)} columns")
    print(f"  Columns: {list(df.columns)}")
    
    return df


# ─────────────────────────────────────────────
# STEP 2: BASIC CLEANING
# ─────────────────────────────────────────────
def basic_cleaning(df):
    print("\n" + "="*60)
    print("STEP 2: Basic Cleaning")
    print("="*60)
    
    original_len = len(df)
    report = {}

    # 2a. Rename columns to clean snake_case names
    df = df.rename(columns={
        'TranslatedRecipeName':  'recipe_name',
        'TranslatedIngredients': 'ingredients_raw',
        'TotalTimeInMins':       'total_time_mins',
        'Cuisine':               'cuisine',
        'TranslatedInstructions':'instructions',
        'URL':                   'source_url',
        'Cleaned-Ingredients':   'ingredients_clean',
        'image-url':             'image_url',
        'Ingredient-count':      'ingredient_count',
    })
    print("  ✓ Renamed columns to snake_case")

    # 2b. Strip leading/trailing whitespace from all string columns
    str_cols = df.select_dtypes(include=['object', 'str']).columns
    df[str_cols] = df[str_cols].apply(lambda col: col.str.strip())
    print("  ✓ Stripped whitespace from all string columns")

    # 2c. Drop exact duplicate rows
    before = len(df)
    df = df.drop_duplicates(subset=['recipe_name', 'ingredients_raw'])
    dupes_removed = before - len(df)
    report['duplicates_removed'] = dupes_removed
    print(f"  ✓ Removed {dupes_removed} duplicate rows")

    # 2d. Drop rows where recipe_name or ingredients_raw is empty
    before = len(df)
    df = df[df['recipe_name'].str.len() > 0]
    df = df[df['ingredients_raw'].str.len() > 0]
    df = df[df['instructions'].str.len() > 0]
    empty_removed = before - len(df)
    report['empty_rows_removed'] = empty_removed
    print(f"  ✓ Removed {empty_removed} rows with empty critical fields")

    # 2e. Fix TotalTimeInMins — convert to int, replace 0 or invalid with NaN then median
    df['total_time_mins'] = pd.to_numeric(df['total_time_mins'], errors='coerce')
    df.loc[df['total_time_mins'] <= 0, 'total_time_mins'] = np.nan
    df.loc[df['total_time_mins'] > 480, 'total_time_mins'] = np.nan  # cap at 8 hours
    median_time = df['total_time_mins'].median()
    df['total_time_mins'] = df['total_time_mins'].fillna(median_time).astype(int)
    report['time_median_used'] = int(median_time)
    print(f"  ✓ Fixed total_time_mins (invalid → median={int(median_time)} mins)")

    # 2f. Fix ingredient_count — convert to int
    df['ingredient_count'] = pd.to_numeric(df['ingredient_count'], errors='coerce')
    df['ingredient_count'] = df['ingredient_count'].fillna(
        df['ingredient_count'].median()
    ).astype(int)
    print("  ✓ Fixed ingredient_count column")

    # 2g. Normalize cuisine names (strip BOM, trailing spaces, fix known issues)
    df['cuisine'] = df['cuisine'].str.replace('\ufeff', '', regex=False)
    df['cuisine'] = df['cuisine'].str.strip()
    CUISINE_MAP = {
        'North Indian Recipes': 'North Indian',
        'South Indian Recipes': 'South Indian',
        'Italian Recipes':      'Italian',
        'Maharashtrian Recipes':'Maharashtrian',
        'Bengali Recipes':      'Bengali',
        'Kerala Recipes':       'Kerala',
        'Gujarati Recipes':     'Gujarati',
        'Rajasthani':           'Rajasthani',
        'Punjabi':              'Punjabi',
    }
    df['cuisine'] = df['cuisine'].replace(CUISINE_MAP)
    print("  ✓ Normalized cuisine names")

    final_len = len(df)
    report['rows_before'] = original_len
    report['rows_after']  = final_len
    report['total_removed'] = original_len - final_len
    print(f"\n  Summary: {original_len} → {final_len} rows (removed {original_len - final_len})")

    df = df.reset_index(drop=True)
    return df, report


# ─────────────────────────────────────────────
# STEP 3: FEATURE ENGINEERING — Diet Tag
# ─────────────────────────────────────────────
def add_diet_tag(df):
    print("\n" + "="*60)
    print("STEP 3: Feature Engineering — Diet Tag (Veg/Non-Veg)")
    print("="*60)

    NON_VEG_KEYWORDS = [
        'chicken', 'mutton', 'lamb', 'fish', 'prawn', 'shrimp',
        'egg', 'eggs', 'beef', 'pork', 'meat', 'crab', 'lobster',
        'tuna', 'salmon', 'anchovy', 'sardine', 'duck', 'turkey',
        'keema', 'mince', 'bacon', 'sausage', 'ham', 'goat',
        'liver', 'kidney', 'bone', 'stock', 'broth', 'squid', 'octopus',
    ]

    def is_non_veg(row):
        text = (row['ingredients_clean'] + ' ' + row['recipe_name']).lower()
        return any(kw in text for kw in NON_VEG_KEYWORDS)

    df['diet'] = df.apply(lambda row: 'Non-Veg' if is_non_veg(row) else 'Veg', axis=1)

    counts = df['diet'].value_counts()
    print(f"  ✓ Veg: {counts.get('Veg', 0)}  |  Non-Veg: {counts.get('Non-Veg', 0)}")

    return df


# ─────────────────────────────────────────────
# STEP 4: FEATURE ENGINEERING — Course Tag
# ─────────────────────────────────────────────
def add_course_tag(df):
    print("\n" + "="*60)
    print("STEP 4: Feature Engineering — Course Tag")
    print("="*60)

    COURSE_KEYWORDS = {
        'Dessert':    ['halwa','kheer','ladoo','barfi','mithai','sweet','cake',
                       'pudding','payasam','gulab','jamun','rasgulla','sandesh',
                       'burfi','modak','sheera','phirni','rabdi','kulfi','ice cream'],
        'Breakfast':  ['breakfast','upma','idli','dosa','poha','paratha','uttapam',
                       'oats','pancake','omelette','toast','sandwich','chilla',
                       'besan chilla','rava','semiya','vermicelli breakfast',
                       'puttu','appam','pongal'],
        'Snack':      ['snack','chaat','bhel','pakora','samosa','tikki','cutlet',
                       'fritter','bajji','bonda','murukku','chakli','vada',
                       'kachori','mathri','namkeen'],
        'Soup':       ['soup','shorba','rasam','broth','stew','chowder'],
        'Drink':      ['juice','smoothie','lassi','sharbat','chai','tea','coffee',
                       'drink','beverage','shake','nimbu pani','kanji'],
        'Lunch':      ['rice','biryani','pulao','dal','sabzi','thali',
                       'bhat','chawal','khichdi'],
        'Dinner':     ['curry','masala','gravy','korma','rogan','bhuna',
                       'roti','naan','chapati','paratha dinner'],
    }

    # Priority order
    PRIORITY = ['Drink','Dessert','Soup','Breakfast','Snack','Lunch','Dinner','Main Course']

    def get_course(name):
        name_lower = name.lower()
        for course, keywords in COURSE_KEYWORDS.items():
            if any(kw in name_lower for kw in keywords):
                return course
        return 'Main Course'

    df['course'] = df['recipe_name'].apply(get_course)

    counts = df['course'].value_counts()
    print("  ✓ Course distribution:")
    for course, count in counts.items():
        print(f"     {course:<15} {count}")

    return df


# ─────────────────────────────────────────────
# STEP 5: FEATURE ENGINEERING — Difficulty
# ─────────────────────────────────────────────
def add_difficulty(df):
    print("\n" + "="*60)
    print("STEP 5: Feature Engineering — Difficulty Level")
    print("="*60)

    def get_difficulty(row):
        time = row['total_time_mins']
        steps = len(row['instructions'].split('.'))
        ing_count = row['ingredient_count']

        score = 0
        if time > 60:    score += 2
        elif time > 30:  score += 1
        if steps > 10:   score += 2
        elif steps > 6:  score += 1
        if ing_count > 12: score += 2
        elif ing_count > 7: score += 1

        if score <= 2:   return 'Easy'
        elif score <= 4: return 'Medium'
        else:            return 'Hard'

    df['difficulty'] = df.apply(get_difficulty, axis=1)

    counts = df['difficulty'].value_counts()
    print("  ✓ Difficulty distribution:")
    for d, c in counts.items():
        print(f"     {d:<10} {c}")

    return df


# ─────────────────────────────────────────────
# STEP 6: FEATURE ENGINEERING — Cooking Time Label
# ─────────────────────────────────────────────
def add_time_label(df):
    print("\n" + "="*60)
    print("STEP 6: Feature Engineering — Time Label")
    print("="*60)

    def time_label(mins):
        if mins <= 15:   return 'Under 15 mins'
        elif mins <= 30: return '15–30 mins'
        elif mins <= 60: return '30–60 mins'
        else:            return '60+ mins'

    df['time_label'] = df['total_time_mins'].apply(time_label)
    print("  ✓ Time label distribution:")
    for label, count in df['time_label'].value_counts().items():
        print(f"     {label:<20} {count}")

    return df


# ─────────────────────────────────────────────
# STEP 7: FEATURE ENGINEERING — Ingredient List
# ─────────────────────────────────────────────
def clean_ingredient_list(df):
    print("\n" + "="*60)
    print("STEP 7: Cleaning Ingredient List")
    print("="*60)

    def parse_ingredients(raw):
        """Convert comma-separated ingredient string to a clean list."""
        ingredients = [i.strip().lower() for i in raw.split(',') if i.strip()]
        # Remove bracketed alternate names, e.g. "Cumin seeds (Jeera)" → "cumin seeds"
        cleaned = []
        for ing in ingredients:
            ing = re.sub(r'\(.*?\)', '', ing).strip()   # remove parentheses
            ing = re.sub(r'\s+', ' ', ing)              # normalize spaces
            if len(ing) > 2:
                cleaned.append(ing)
        return cleaned

    df['ingredients_list'] = df['ingredients_clean'].apply(parse_ingredients)
    df['ingredients_list_str'] = df['ingredients_list'].apply(lambda x: ', '.join(x))

    # Count total unique ingredients in the whole dataset
    all_ingredients = []
    for lst in df['ingredients_list']:
        all_ingredients.extend(lst)
    unique_ingredients = len(set(all_ingredients))
    print(f"  ✓ Total unique ingredients in dataset: {unique_ingredients}")

    # Show top 20 most common ingredients
    common = Counter(all_ingredients).most_common(20)
    print("  ✓ Top 20 most common ingredients:")
    for ing, count in common:
        print(f"     {ing:<35} {count}")

    return df


# ─────────────────────────────────────────────
# STEP 8: ADD UNIQUE ID
# ─────────────────────────────────────────────
def add_recipe_id(df):
    print("\n" + "="*60)
    print("STEP 8: Adding Recipe IDs")
    print("="*60)

    df.insert(0, 'recipe_id', range(1, len(df) + 1))
    df['recipe_id'] = df['recipe_id'].apply(lambda x: f"R{x:04d}")
    print(f"  ✓ Added recipe_id column (R0001 to R{len(df):04d})")

    return df


# ─────────────────────────────────────────────
# STEP 9: FINAL COLUMN SELECTION & SAVE
# ─────────────────────────────────────────────
def save_output(df, output_path, report_data):
    print("\n" + "="*60)
    print("STEP 9: Saving Cleaned Dataset")
    print("="*60)

    # Select final columns (drop raw/intermediate ones)
    final_columns = [
        'recipe_id',
        'recipe_name',
        'cuisine',
        'diet',
        'course',
        'difficulty',
        'total_time_mins',
        'time_label',
        'ingredient_count',
        'ingredients_raw',
        'ingredients_clean',
        'ingredients_list_str',
        'instructions',
        'image_url',
        'source_url',
    ]

    df_final = df[final_columns]

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_final.to_csv(output_path, index=False, encoding='utf-8')

    print(f"  ✓ Saved {len(df_final)} recipes to: {output_path}")
    print(f"  Final columns: {list(df_final.columns)}")

    return df_final


# ─────────────────────────────────────────────
# STEP 10: GENERATE PREPROCESSING REPORT
# ─────────────────────────────────────────────
def generate_report(df, cleaning_report, output_path):
    print("\n" + "="*60)
    print("STEP 10: Generating Preprocessing Report")
    print("="*60)

    lines = []
    lines.append("=" * 60)
    lines.append("SMARTCHEF — DATA PREPROCESSING REPORT")
    lines.append("=" * 60)
    lines.append("")
    lines.append("1. DATASET SUMMARY")
    lines.append(f"   Total recipes after cleaning : {len(df)}")
    lines.append(f"   Rows removed (duplicates)    : {cleaning_report.get('duplicates_removed', 0)}")
    lines.append(f"   Rows removed (empty fields)  : {cleaning_report.get('empty_rows_removed', 0)}")
    lines.append(f"   Time median used for fill    : {cleaning_report.get('time_median_used', 0)} mins")
    lines.append("")
    lines.append("2. NEW FEATURES ADDED")
    lines.append("   recipe_id          → Unique ID (R0001–R5XXX)")
    lines.append("   diet               → Veg / Non-Veg (keyword detection)")
    lines.append("   course             → Breakfast / Snack / Lunch / Dinner / etc.")
    lines.append("   difficulty         → Easy / Medium / Hard (time + steps + ingredients)")
    lines.append("   time_label         → Under 15 mins / 15–30 mins / etc.")
    lines.append("   ingredients_list_str → Clean comma-separated ingredient list")
    lines.append("")
    lines.append("3. CLEANING OPERATIONS")
    lines.append("   ✓ Renamed all columns to snake_case")
    lines.append("   ✓ Stripped whitespace from all string columns")
    lines.append("   ✓ Removed exact duplicate rows")
    lines.append("   ✓ Removed rows with empty recipe name / ingredients / instructions")
    lines.append("   ✓ Fixed total_time_mins (0 and >480 replaced with median)")
    lines.append("   ✓ Fixed ingredient_count (non-numeric → median)")
    lines.append("   ✓ Normalized cuisine names (removed BOM, standardized suffixes)")
    lines.append("   ✓ Removed parenthetical aliases from ingredient names")
    lines.append("")
    lines.append("4. FEATURE DISTRIBUTIONS")
    lines.append("")
    lines.append("   Diet:")
    for val, cnt in df['diet'].value_counts().items():
        lines.append(f"     {val:<15} {cnt}")
    lines.append("")
    lines.append("   Course:")
    for val, cnt in df['course'].value_counts().items():
        lines.append(f"     {val:<20} {cnt}")
    lines.append("")
    lines.append("   Difficulty:")
    for val, cnt in df['difficulty'].value_counts().items():
        lines.append(f"     {val:<15} {cnt}")
    lines.append("")
    lines.append("   Time Label:")
    for val, cnt in df['time_label'].value_counts().items():
        lines.append(f"     {val:<25} {cnt}")
    lines.append("")
    lines.append("   Top 10 Cuisines:")
    for val, cnt in df['cuisine'].value_counts().head(10).items():
        lines.append(f"     {val:<30} {cnt}")
    lines.append("")
    lines.append("5. OUTPUT FILE")
    lines.append(f"   data/cleaned_recipes.csv")
    lines.append("")
    lines.append("=" * 60)
    lines.append("END OF REPORT")
    lines.append("=" * 60)

    report_text = '\n'.join(lines)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        f.write(report_text)

    print("  ✓ Report saved to:", output_path)
    print()
    print(report_text)

    return report_text


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    print("\n" + "🍴 " * 20)
    print("  SMARTCHEF — DATA PREPROCESSING PIPELINE")
    print("🍴 " * 20)

    # Check input file exists
    if not os.path.exists(INPUT_FILE):
        print(f"\n❌ ERROR: Input file not found: {INPUT_FILE}")
        print("   Make sure Cleaned_Indian_Food_Dataset.csv is inside the data/ folder")
        return

    # Run pipeline
    df = load_data(INPUT_FILE)
    df, cleaning_report = basic_cleaning(df)
    df = add_diet_tag(df)
    df = add_course_tag(df)
    df = add_difficulty(df)
    df = add_time_label(df)
    df = clean_ingredient_list(df)
    df = add_recipe_id(df)
    df_final = save_output(df, OUTPUT_FILE, cleaning_report)
    generate_report(df_final, cleaning_report, REPORT_FILE)

    print("\n" + "✅ " * 20)
    print("  PREPROCESSING COMPLETE!")
    print("✅ " * 20)
    print(f"\n  Output files:")
    print(f"    → {OUTPUT_FILE}")
    print(f"    → {REPORT_FILE}")
    print("\n  Next step: Run nutrition_mapper.py to add nutrition data")


if __name__ == '__main__':
    main()
