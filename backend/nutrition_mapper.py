"""
SmartChef - Nutrition Mapper Script (v2 — improved)
=====================================================
Key improvements over v1:
  - Better ingredient parser (handles "inch ginger", "cloves garlic", truncated names)
  - 250+ ingredient nutrition database (vs 173 in v1)
  - Smarter fuzzy matching (handles plurals, common aliases, truncated names)
  - Better servings estimator per course type

INPUT:  data/cleaned_recipes.csv
OUTPUT: data/recipes_with_nutrition.csv
        data/nutrition_map.json

USAGE:
  python nutrition_mapper.py
"""

import pandas as pd
import numpy as np
import re
import os
import json

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
INPUT_FILE       = "data/cleaned_recipes.csv"
OUTPUT_CSV       = "data/recipes_with_nutrition.csv"
OUTPUT_JSON      = "data/nutrition_map.json"
DEFAULT_SERVINGS = 4


# ─────────────────────────────────────────────────────────────────────────────
# NUTRITION DATABASE — per 100g edible portion
# Format: { name: [calories, protein_g, carbs_g, fat_g, fiber_g] }
# Source: USDA FoodData Central + IFCT 2017
# ─────────────────────────────────────────────────────────────────────────────
NUTRITION_DB = {
    # ── GRAINS & FLOURS ──────────────────────────────────────────────────────
    "rice":                [130,  2.7, 28.2,  0.3,  0.4],
    "basmati rice":        [130,  2.7, 28.2,  0.3,  0.4],
    "brown rice":          [123,  2.7, 25.6,  1.0,  1.8],
    "poha":                [333,  7.3, 75.2,  0.4,  1.3],
    "flattened rice":      [333,  7.3, 75.2,  0.4,  1.3],
    "wheat flour":         [364, 10.3, 76.3,  1.0,  2.7],
    "atta":                [364, 10.3, 76.3,  1.0,  2.7],
    "maida":               [364, 10.0, 76.0,  1.0,  0.5],
    "all purpose flour":   [364, 10.0, 76.0,  1.0,  0.5],
    "gram flour":          [387, 22.4, 57.8,  6.7, 10.8],
    "besan":               [387, 22.4, 57.8,  6.7, 10.8],
    "chickpea flour":      [387, 22.4, 57.8,  6.7, 10.8],
    "rice flour":          [366,  6.0, 80.1,  1.4,  2.4],
    "corn flour":          [381,  0.3, 91.3,  0.1,  0.9],
    "cornstarch":          [381,  0.3, 91.3,  0.1,  0.9],
    "semolina":            [360, 12.7, 72.8,  1.1,  3.9],
    "sooji":               [360, 12.7, 72.8,  1.1,  3.9],
    "rava":                [360, 12.7, 72.8,  1.1,  3.9],
    "ragi flour":          [328,  7.3, 72.0,  1.1,  3.6],
    "ragi":                [328,  7.3, 72.0,  1.1,  3.6],
    "finger millet":       [328,  7.3, 72.0,  1.1,  3.6],
    "jowar":               [349, 10.4, 72.6,  1.9,  6.3],
    "bajra":               [361, 11.6, 67.5,  5.0,  1.2],
    "oats":                [389, 17.0, 66.3,  6.9, 10.6],
    "rolled oats":         [389, 17.0, 66.3,  6.9, 10.6],
    "bread":               [265,  9.0, 49.2,  3.2,  2.7],
    "brown bread":         [247,  9.0, 46.0,  3.2,  6.0],
    "whole wheat bread":   [247,  9.0, 46.0,  3.2,  6.0],
    "vermicelli":          [352, 11.0, 72.2,  1.4,  2.2],
    "semiya":              [352, 11.0, 72.2,  1.4,  2.2],
    "seviyan":             [352, 11.0, 72.2,  1.4,  2.2],
    "noodles":             [138,  4.5, 25.2,  2.0,  1.0],
    "hakka noodles":       [352, 11.0, 72.2,  1.4,  2.2],
    "pasta":               [131,  5.0, 25.1,  1.1,  1.8],
    "spaghetti":           [131,  5.0, 25.1,  1.1,  1.8],
    "suji":                [360, 12.7, 72.8,  1.1,  3.9],
    "quinoa":              [120,  4.4, 21.3,  1.9,  2.8],
    "sabudana":            [350,  0.2, 86.8,  0.0,  0.0],
    "tapioca":             [350,  0.2, 86.8,  0.0,  0.0],
    "cornmeal":            [362,  8.1, 73.0,  3.6,  7.3],

    # ── LENTILS & LEGUMES ────────────────────────────────────────────────────
    "chana dal":           [364, 20.1, 60.5,  5.6,  8.0],
    "arhar dal":           [343, 22.3, 57.6,  1.7,  8.4],
    "toor dal":            [343, 22.3, 57.6,  1.7,  8.4],
    "moong dal":           [347, 24.0, 59.9,  1.2, 16.3],
    "green moong":         [347, 24.0, 59.9,  1.2, 16.3],
    "whole moong":         [347, 24.0, 59.9,  1.2, 16.3],
    "urad dal":            [347, 25.0, 59.0,  1.4,  0.9],
    "black urad":          [341, 25.2, 58.0,  1.6,  0.9],
    "masoor dal":          [116,  9.0, 20.1,  0.4,  7.9],
    "red lentil":          [116,  9.0, 20.1,  0.4,  7.9],
    "kidney beans":        [127,  8.7, 22.8,  0.5,  6.4],
    "rajma":               [127,  8.7, 22.8,  0.5,  6.4],
    "black beans":         [132,  8.9, 23.7,  0.5,  8.7],
    "chickpeas":           [364, 19.3, 60.7,  6.0, 17.4],
    "kabuli chana":        [364, 19.3, 60.7,  6.0, 17.4],
    "black chickpeas":     [378, 20.0, 63.0,  6.0, 17.0],
    "kala chana":          [378, 20.0, 63.0,  6.0, 17.0],
    "green peas":          [ 81,  5.4, 14.5,  0.4,  5.1],
    "peas":                [ 81,  5.4, 14.5,  0.4,  5.1],
    "soya":                [446, 36.5, 30.2, 19.9,  9.3],
    "lentils":             [116,  9.0, 20.1,  0.4,  7.9],

    # ── VEGETABLES ───────────────────────────────────────────────────────────
    "onion":               [ 40,  1.1,  9.3,  0.1,  1.7],
    "shallot":             [ 72,  2.5, 16.8,  0.1,  3.2],
    "spring onion":        [ 32,  1.8,  7.3,  0.2,  2.6],
    "scallion":            [ 32,  1.8,  7.3,  0.2,  2.6],
    "tomato":              [ 18,  0.9,  3.9,  0.2,  1.2],
    "potato":              [ 77,  2.0, 17.5,  0.1,  2.2],
    "sweet potato":        [ 86,  1.6, 20.1,  0.1,  3.0],
    "carrot":              [ 41,  0.9,  9.6,  0.2,  2.8],
    "spinach":             [ 23,  2.9,  3.6,  0.4,  2.2],
    "palak":               [ 23,  2.9,  3.6,  0.4,  2.2],
    "cabbage":             [ 25,  1.3,  5.8,  0.1,  2.5],
    "cauliflower":         [ 25,  1.9,  5.0,  0.3,  2.0],
    "gobi":                [ 25,  1.9,  5.0,  0.3,  2.0],
    "broccoli":            [ 34,  2.8,  6.6,  0.4,  2.6],
    "brinjal":             [ 25,  1.0,  5.9,  0.2,  3.0],
    "eggplant":            [ 25,  1.0,  5.9,  0.2,  3.0],
    "baingan":             [ 25,  1.0,  5.9,  0.2,  3.0],
    "bitter gourd":        [ 17,  1.0,  3.7,  0.2,  2.8],
    "karela":              [ 17,  1.0,  3.7,  0.2,  2.8],
    "ladyfinger":          [ 33,  1.9,  7.5,  0.2,  3.2],
    "okra":                [ 33,  1.9,  7.5,  0.2,  3.2],
    "bhindi":              [ 33,  1.9,  7.5,  0.2,  3.2],
    "green beans":         [ 31,  1.8,  7.1,  0.1,  2.7],
    "french beans":        [ 31,  1.8,  7.1,  0.1,  2.7],
    "mushroom":            [ 22,  3.1,  3.3,  0.3,  1.0],
    "corn":                [ 86,  3.3, 19.0,  1.4,  2.7],
    "sweet corn":          [ 86,  3.3, 19.0,  1.4,  2.7],
    "green bell pepper":   [ 20,  0.9,  4.6,  0.2,  1.7],
    "capsicum":            [ 20,  0.9,  4.6,  0.2,  1.7],
    "red bell pepper":     [ 31,  1.0,  6.0,  0.3,  2.1],
    "yellow bell pepper":  [ 27,  1.0,  6.3,  0.2,  0.9],
    "cucumber":            [ 15,  0.7,  3.6,  0.1,  0.5],
    "zucchini":            [ 17,  1.2,  3.1,  0.3,  1.0],
    "pumpkin":             [ 26,  1.0,  6.5,  0.1,  0.5],
    "bottle gourd":        [ 14,  0.2,  3.4,  0.0,  0.5],
    "lauki":               [ 14,  0.2,  3.4,  0.0,  0.5],
    "ridge gourd":         [ 20,  0.5,  4.4,  0.1,  0.5],
    "tindora":             [ 18,  1.2,  3.8,  0.2,  1.5],
    "ivy gourd":           [ 18,  1.2,  3.8,  0.2,  1.5],
    "drumstick":           [ 37,  2.1,  8.5,  0.2,  3.2],
    "moringa":             [ 37,  2.1,  8.5,  0.2,  3.2],
    "raw banana":          [ 89,  1.3, 23.0,  0.1,  2.6],
    "plantain":            [ 89,  1.3, 23.0,  0.1,  2.6],
    "raw papaya":          [ 32,  0.5,  7.2,  0.1,  0.9],
    "yam":                 [118,  1.5, 27.9,  0.2,  4.1],
    "colocasia":           [112,  1.5, 26.5,  0.2,  4.0],
    "arbi":                [112,  1.5, 26.5,  0.2,  4.0],
    "lotus stem":          [ 74,  2.6, 17.2,  0.1,  4.9],
    "raw mango":           [ 60,  0.4, 15.0,  0.1,  1.6],
    "radish":              [ 16,  0.7,  3.4,  0.1,  1.6],
    "mooli":               [ 16,  0.7,  3.4,  0.1,  1.6],
    "beetroot":            [ 43,  1.6,  9.6,  0.2,  2.8],
    "celery":              [ 16,  0.7,  3.0,  0.2,  1.6],
    "leek":                [ 61,  1.5, 14.2,  0.3,  1.8],
    "asparagus":           [ 20,  2.2,  3.9,  0.1,  2.1],
    "baby corn":           [ 26,  2.0,  5.1,  0.2,  1.9],

    # ── FRUITS ───────────────────────────────────────────────────────────────
    "mango":               [ 60,  0.8, 15.0,  0.4,  1.6],
    "banana":              [ 89,  1.1, 22.8,  0.3,  2.6],
    "lemon":               [ 29,  1.1,  9.3,  0.3,  2.8],
    "lime":                [ 29,  0.7, 10.5,  0.2,  2.8],
    "orange":              [ 47,  0.9, 11.8,  0.1,  2.4],
    "apple":               [ 52,  0.3, 13.8,  0.2,  2.4],
    "coconut":             [354,  3.3, 15.2, 33.5,  9.0],
    "coconut milk":        [230,  2.3,  5.5, 24.0,  2.2],
    "coconut cream":       [330,  3.3,  7.4, 34.7,  2.2],
    "tamarind":            [239,  2.8, 62.5,  0.6,  5.1],
    "tamarind water":      [ 24,  0.3,  6.3,  0.1,  0.5],
    "pomegranate":         [ 83,  1.7, 18.7,  1.2,  4.0],
    "papaya":              [ 32,  0.5,  7.2,  0.1,  0.9],
    "pineapple":           [ 50,  0.5, 13.1,  0.1,  1.4],
    "grapes":              [ 69,  0.7, 18.1,  0.2,  0.9],
    "strawberry":          [ 32,  0.7,  7.7,  0.3,  2.0],
    "avocado":             [160,  2.0,  8.5, 14.7,  6.7],

    # ── DAIRY & EGGS ─────────────────────────────────────────────────────────
    "milk":                [ 61,  3.2,  4.8,  3.3,  0.0],
    "curd":                [ 61,  3.5,  4.7,  3.3,  0.0],
    "yogurt":              [ 61,  3.5,  4.7,  3.3,  0.0],
    "dahi":                [ 61,  3.5,  4.7,  3.3,  0.0],
    "hung curd":           [100,  7.0,  4.0,  7.0,  0.0],
    "greek yogurt":        [100,  7.0,  4.0,  7.0,  0.0],
    "butter":              [717,  0.9,  0.1, 81.1,  0.0],
    "ghee":                [900,  0.0,  0.0,100.0,  0.0],
    "paneer":              [265, 18.3,  1.2, 20.8,  0.0],
    "cheese":              [402, 25.0,  1.3, 33.1,  0.0],
    "cream":               [345,  2.8,  2.9, 36.1,  0.0],
    "fresh cream":         [345,  2.8,  2.9, 36.1,  0.0],
    "condensed milk":      [321,  7.9, 54.4,  8.7,  0.0],
    "egg":                 [155, 13.0,  1.1, 11.0,  0.0],
    "khoya":               [421, 19.8, 36.4, 24.5,  0.0],
    "mawa":                [421, 19.8, 36.4, 24.5,  0.0],
    "buttermilk":          [ 40,  3.3,  4.8,  0.9,  0.0],
    "whipping cream":      [257,  1.9,  3.2, 26.7,  0.0],
    "milk powder":         [496, 26.3, 54.4, 21.5,  0.0],

    # ── MEAT & SEAFOOD ───────────────────────────────────────────────────────
    "chicken":             [165, 31.0,  0.0,  3.6,  0.0],
    "mutton":              [294, 25.6,  0.0, 21.0,  0.0],
    "lamb":                [294, 25.6,  0.0, 21.0,  0.0],
    "beef":                [250, 26.1,  0.0, 15.4,  0.0],
    "pork":                [242, 27.0,  0.0, 14.0,  0.0],
    "fish":                [206, 22.0,  0.0, 12.0,  0.0],
    "salmon":              [208, 20.4,  0.0, 13.4,  0.0],
    "tuna":                [144, 23.7,  0.0,  4.9,  0.0],
    "prawns":              [ 85, 18.0,  0.9,  0.9,  0.0],
    "shrimp":              [ 85, 18.0,  0.9,  0.9,  0.0],
    "crab":                [ 97, 19.5,  0.1,  1.8,  0.0],
    "keema":               [294, 25.6,  0.0, 21.0,  0.0],
    "mince":               [294, 25.6,  0.0, 21.0,  0.0],

    # ── OILS & FATS ──────────────────────────────────────────────────────────
    "oil":                 [884,  0.0,  0.0,100.0,  0.0],
    "sunflower oil":       [884,  0.0,  0.0,100.0,  0.0],
    "olive oil":           [884,  0.0,  0.0,100.0,  0.0],
    "mustard oil":         [884,  0.0,  0.0,100.0,  0.0],
    "sesame oil":          [884,  0.0,  0.0,100.0,  0.0],
    "coconut oil":         [862,  0.0,  0.0, 99.1,  0.0],
    "vegetable oil":       [884,  0.0,  0.0,100.0,  0.0],
    "cooking oil":         [884,  0.0,  0.0,100.0,  0.0],

    # ── NUTS & SEEDS ─────────────────────────────────────────────────────────
    "cashew":              [553, 18.2, 30.2, 43.9,  3.3],
    "peanut":              [567, 25.8, 16.1, 49.2,  8.5],
    "groundnut":           [567, 25.8, 16.1, 49.2,  8.5],
    "almond":              [579, 21.2, 21.7, 49.9, 12.5],
    "badam":               [579, 21.2, 21.7, 49.9, 12.5],
    "pistachio":           [562, 20.0, 27.2, 45.4, 10.6],
    "walnut":              [654, 15.2, 13.7, 65.2,  6.7],
    "raisin":              [299,  3.1, 79.2,  0.5,  3.7],
    "kishmish":            [299,  3.1, 79.2,  0.5,  3.7],
    "sesame":              [573, 17.7, 23.5, 49.7, 11.8],
    "til":                 [573, 17.7, 23.5, 49.7, 11.8],
    "poppy seed":          [525, 17.9, 28.1, 41.6, 19.5],
    "khus khus":           [525, 17.9, 28.1, 41.6, 19.5],
    "flax seed":           [534, 18.3, 28.9, 42.2, 27.3],
    "melon seed":          [557, 28.8, 15.3, 45.9,  0.5],
    "charmagaz":           [557, 28.8, 15.3, 45.9,  0.5],
    "pine nut":            [673, 13.7, 13.1, 68.4,  3.7],
    "chestnut":            [245,  3.2, 53.0,  2.2,  5.1],
    "desiccated coconut":  [592,  6.8, 24.0, 57.2, 16.3],

    # ── SPICES & SEASONINGS ──────────────────────────────────────────────────
    "turmeric":            [354,  7.8, 64.9,  9.9, 21.1],
    "red chilli":          [282, 13.5, 55.9,  8.6, 35.0],
    "chilli powder":       [282, 13.5, 55.9,  8.6, 35.0],
    "coriander powder":    [298, 12.4, 54.9, 17.8, 41.9],
    "dhania powder":       [298, 12.4, 54.9, 17.8, 41.9],
    "cumin":               [375, 17.8, 44.2, 22.3, 10.5],
    "jeera":               [375, 17.8, 44.2, 22.3, 10.5],
    "mustard seed":        [508, 26.1, 28.1, 36.2, 12.2],
    "rai":                 [508, 26.1, 28.1, 36.2, 12.2],
    "garam masala":        [357, 13.7, 52.3, 15.0, 21.2],
    "black pepper":        [251, 10.4, 63.7,  3.3, 25.3],
    "cardamom":            [311,  6.7, 68.5,  6.7, 28.0],
    "elaichi":             [311,  6.7, 68.5,  6.7, 28.0],
    "cinnamon":            [247,  3.9, 80.6,  1.2, 53.1],
    "dalchini":            [247,  3.9, 80.6,  1.2, 53.1],
    "clove":               [274,  6.0, 65.5, 13.0, 33.9],
    "laung":               [274,  6.0, 65.5, 13.0, 33.9],
    "asafoetida":          [297,  4.0, 67.8,  1.1,  4.1],
    "hing":                [297,  4.0, 67.8,  1.1,  4.1],
    "ajwain":              [305, 15.9, 43.0, 25.0, 21.2],
    "carom seed":          [305, 15.9, 43.0, 25.0, 21.2],
    "fennel":              [345, 15.8, 52.3, 14.9, 39.8],
    "saunf":               [345, 15.8, 52.3, 14.9, 39.8],
    "fenugreek":           [323, 23.0, 58.4,  6.4, 24.6],
    "methi":               [323, 23.0, 58.4,  6.4, 24.6],
    "kasuri methi":        [323, 23.0, 58.4,  6.4, 24.6],
    "chaat masala":        [250, 10.0, 50.0,  5.0, 15.0],
    "amchur":              [320,  2.0, 79.0,  0.5, 13.0],
    "dry mango powder":    [320,  2.0, 79.0,  0.5, 13.0],
    "saffron":             [310, 11.4, 65.4,  5.9,  3.9],
    "star anise":          [337,  6.0, 50.0, 16.0, 15.0],
    "mace":                [475, 12.2, 50.5, 32.4,  0.0],
    "nutmeg":              [525,  5.8, 49.3, 36.3,  0.0],
    "bay leaf":            [313,  7.6, 74.9,  8.4, 26.3],
    "black cardamom":      [311,  6.7, 68.5,  6.7, 28.0],
    "kala namak":          [  0,  0.0,  0.0,  0.0,  0.0],
    "oregano":             [265, 11.0, 64.4,  4.3, 42.5],
    "red chilli flakes":   [282, 13.5, 55.9,  8.6, 35.0],
    "mixed spice":         [300, 10.0, 55.0, 10.0, 20.0],
    "pav bhaji masala":    [300, 10.0, 55.0, 10.0, 20.0],
    "biryani masala":      [300, 10.0, 55.0, 10.0, 20.0],
    "sambar powder":       [280, 12.0, 50.0,  8.0, 18.0],
    "rasam powder":        [280, 12.0, 50.0,  8.0, 18.0],

    # ── FRESH HERBS & AROMATICS ──────────────────────────────────────────────
    "ginger":              [ 80,  1.8, 17.8,  0.8,  2.0],
    "garlic":              [149,  6.4, 33.1,  0.5,  2.1],
    "ginger garlic paste": [ 80,  2.0, 17.0,  0.5,  1.5],
    "green chilli":        [ 40,  2.0,  9.5,  0.4,  1.5],
    "dry red chilli":      [282, 13.5, 55.9,  8.6, 35.0],
    "coriander leaves":    [ 23,  2.1,  3.7,  0.5,  2.8],
    "cilantro":            [ 23,  2.1,  3.7,  0.5,  2.8],
    "dhania":              [ 23,  2.1,  3.7,  0.5,  2.8],
    "mint leaves":         [ 44,  3.3,  8.4,  0.7,  6.8],
    "pudina":              [ 44,  3.3,  8.4,  0.7,  6.8],
    "curry leaves":        [108,  6.1, 16.0,  1.0, 13.1],
    "kadi patta":          [108,  6.1, 16.0,  1.0, 13.1],
    "basil":               [ 23,  3.2,  2.6,  0.6,  1.6],
    "parsley":             [ 36,  3.0,  6.3,  0.8,  3.3],
    "dill":                [ 43,  3.5,  7.0,  1.1,  2.1],
    "thyme":               [101,  5.6, 24.5,  1.7, 14.0],
    "rosemary":            [131,  3.3, 20.7,  5.9, 14.1],

    # ── SWEETENERS ───────────────────────────────────────────────────────────
    "sugar":               [387,  0.0,100.0,  0.0,  0.0],
    "brown sugar":         [380,  0.1, 98.1,  0.0,  0.0],
    "jaggery":             [383,  0.4, 98.0,  0.1,  0.0],
    "gur":                 [383,  0.4, 98.0,  0.1,  0.0],
    "honey":               [304,  0.3, 82.4,  0.0,  0.2],
    "maple syrup":         [260,  0.0, 67.0,  0.1,  0.0],
    "stevia":              [  0,  0.0,  0.0,  0.0,  0.0],
    "sugar syrup":         [240,  0.0, 64.0,  0.0,  0.0],

    # ── CONDIMENTS & SAUCES ──────────────────────────────────────────────────
    "soy sauce":           [ 53,  5.6,  4.9,  0.6,  0.8],
    "tomato ketchup":      [100,  1.7, 27.0,  0.1,  0.3],
    "tomato sauce":        [100,  1.7, 27.0,  0.1,  0.3],
    "vinegar":             [ 18,  0.0,  0.0,  0.0,  0.0],
    "lemon juice":         [ 22,  0.4,  6.9,  0.2,  0.3],
    "tamarind paste":      [239,  2.8, 62.5,  0.6,  5.1],
    "vanilla":             [288,  0.1, 12.7,  0.1,  0.0],
    "worcestershire":      [ 78,  1.3, 18.3,  0.1,  0.0],
    "oyster sauce":        [ 51,  0.0, 11.0,  0.3,  0.3],
    "fish sauce":          [ 35,  5.1,  3.6,  0.1,  0.0],
    "hot sauce":           [ 45,  1.5,  7.0,  0.5,  1.0],
    "mayonnaise":          [680,  1.0,  0.6, 75.0,  0.0],
    "tomato puree":        [ 32,  1.7,  7.3,  0.2,  1.7],
    "coconut chutney":     [200,  3.0, 15.0, 16.0,  5.0],
    "green chutney":       [ 60,  2.0,  8.0,  2.0,  3.0],

    # ── LEAVENING & THICKENERS ───────────────────────────────────────────────
    "baking powder":       [ 53,  0.0, 27.7,  0.0,  0.2],
    "baking soda":         [  0,  0.0,  0.0,  0.0,  0.0],
    "yeast":               [325, 40.4, 41.2,  7.6, 26.9],
    "gelatin":             [335, 85.6,  0.0,  0.1,  0.0],
    "agar":                [ 26,  0.5,  6.8,  0.0,  0.5],

    # ── ZERO CALORIE ─────────────────────────────────────────────────────────
    "salt":                [  0,  0.0,  0.0,  0.0,  0.0],
    "water":               [  0,  0.0,  0.0,  0.0,  0.0],
    "ice":                 [  0,  0.0,  0.0,  0.0,  0.0],
    "kewra water":         [  0,  0.0,  0.0,  0.0,  0.0],
    "rose water":          [  0,  0.0,  0.0,  0.0,  0.0],

    # ── BEVERAGES & MISC ─────────────────────────────────────────────────────
    "tea":                 [  1,  0.0,  0.3,  0.0,  0.0],
    "coffee":              [  2,  0.3,  0.0,  0.0,  0.0],
    "cocoa":               [228, 19.6, 57.9, 13.7, 37.0],
    "chocolate":           [546,  4.9, 59.4, 31.3,  7.0],
    "dark chocolate":      [604,  7.8, 45.9, 43.1, 10.9],

    # ── DEFAULT FALLBACK ─────────────────────────────────────────────────────
    "__default__":         [ 50,  1.5,  8.0,  1.5,  1.0],
}

# Common aliases / alternate spellings → canonical name
ALIASES = {
    "atta":          "wheat flour",
    "maida":         "all purpose flour",
    "sooji":         "semolina",
    "suji":          "semolina",
    "rava":          "semolina",
    "ragi":          "ragi flour",
    "semiya":        "vermicelli",
    "seviyan":       "vermicelli",
    "dahi":          "curd",
    "palak":         "spinach",
    "gobi":          "cauliflower",
    "baingan":       "brinjal",
    "karela":        "bitter gourd",
    "bhindi":        "okra",
    "lauki":         "bottle gourd",
    "mooli":         "radish",
    "arbi":          "colocasia",
    "jeera":         "cumin",
    "rai":           "mustard seed",
    "methi":         "fenugreek",
    "saunf":         "fennel",
    "hing":          "asafoetida",
    "laung":         "clove",
    "elaichi":       "cardamom",
    "dalchini":      "cinnamon",
    "kali mirch":    "black pepper",
    "lal mirch":     "red chilli",
    "dhania":        "coriander leaves",
    "pudina":        "mint leaves",
    "kadi patta":    "curry leaves",
    "gur":           "jaggery",
    "mawa":          "khoya",
    "besan":         "gram flour",
    "kabuli chana":  "chickpeas",
    "kala chana":    "black chickpeas",
    "rajma":         "kidney beans",
    "rajmah":        "kidney beans",
    "toor dal":      "arhar dal",
    "masoor":        "masoor dal",
    "groundnut":     "peanut",
    "badam":         "almond",
    "kishmish":      "raisin",
    "til":           "sesame",
    "khus khus":     "poppy seed",
    "charmagaz":     "melon seed",
    "kewra":         "kewra water",
}

# ─────────────────────────────────────────────────────────────────────────────
# UNIT → GRAMS CONVERSION
# ─────────────────────────────────────────────────────────────────────────────
UNIT_TO_GRAMS = {
    "teaspoon": 5, "teaspoons": 5, "tsp": 5,
    "tablespoon": 15, "tablespoons": 15, "tbsp": 15,
    "cup": 240, "cups": 240,
    "ml": 1, "milliliter": 1, "milliliters": 1,
    "liter": 1000, "litre": 1000, "liters": 1000, "litres": 1000,
    "gram": 1, "grams": 1, "g": 1,
    "kg": 1000, "kilogram": 1000, "kilograms": 1000,
    "piece": 80, "pieces": 80,
    "inch": 10,
    "clove": 4, "cloves": 4,
    "sprig": 5, "sprigs": 5,
    "bunch": 50,
    "handful": 30,
    "pinch": 1,
    "slice": 30, "slices": 30,
    "pod": 2, "pods": 2,
    "leaf": 1, "leaves": 5,
    "stalk": 20, "stalks": 20,
    "stick": 10, "sticks": 10,
    "strand": 0.1, "strands": 0.1,
    "drop": 0.05, "drops": 0.05,
    "spoon": 15, "spoons": 15,
}

# Per-item weights for countable ingredients
ITEM_GRAMS = {
    "egg": 60, "eggs": 60,
    "onion": 100, "onions": 100,
    "potato": 150, "potatoes": 150,
    "tomato": 100, "tomatoes": 100,
    "lemon": 58, "lemons": 58,
    "lime": 44, "limes": 44,
    "carrot": 80, "carrots": 80,
    "banana": 120, "bananas": 120,
    "green chilli": 8, "green chillies": 8,
    "dry red chilli": 3, "dry red chillies": 3,
    "garlic": 4,
    "cardamom": 2,
    "clove": 2,
    "bay leaf": 1, "bay leaves": 1,
    "cinnamon stick": 4, "cinnamon sticks": 4,
    "star anise": 2,
}


# ─────────────────────────────────────────────────────────────────────────────
# IMPROVED QUANTITY PARSER
# ─────────────────────────────────────────────────────────────────────────────
def fraction_to_float(text):
    text = text.strip()
    mixed = re.match(r'^(\d+)[\s\-]+(\d+)/(\d+)$', text)
    if mixed:
        return int(mixed.group(1)) + int(mixed.group(2)) / int(mixed.group(3))
    simple = re.match(r'^(\d+)/(\d+)$', text)
    if simple:
        return int(simple.group(1)) / int(simple.group(2))
    try:
        return float(text)
    except:
        return 1.0


def clean_ingredient_name(name):
    """Remove prep instructions and normalize ingredient name."""
    name = name.lower().strip()
    # Remove bracketed content: "(Jeera)" → ""
    name = re.sub(r'\(.*?\)', '', name)
    # Remove after dash (prep instructions): "onion - finely chopped" → "onion"
    name = re.sub(r'\s*[-–]\s*(finely|coarsely|roughly|thinly|freshly|grated|chopped|sliced|diced|minced|crushed|ground|powdered|soaked|boiled|cooked|peeled|deseeded|blanched|roasted|fried|dried|washed|cleaned|beaten|whisked|melted|softened|fresh|frozen|canned|packed|heaped|levelled|for|to taste|as required|as needed).*$', '', name, flags=re.IGNORECASE)
    # Remove common prep suffixes
    name = re.sub(r'\s*,\s*(finely|coarsely|roughly|thinly|freshly|chopped|sliced|diced|minced|crushed|ground|grated).*$', '', name, flags=re.IGNORECASE)
    # Remove "to taste", "as required" etc.
    name = re.sub(r'\b(to taste|as required|as needed|as per taste|for cooking|for frying|for garnish|for tempering|a pinch of?|a dash of?)\b.*$', '', name, flags=re.IGNORECASE)
    # Handle "inch ginger" → "ginger", "cloves garlic" → "garlic"
    name = re.sub(r'^(inch(es)?|cloves?|sprig|bunch|handful|pinch|piece|pods?|leaf|leaves|strand|sticks?)\s+', '', name, flags=re.IGNORECASE)
    # Clean up whitespace
    name = re.sub(r'\s+', ' ', name).strip(' -–—.,')
    return name


def parse_ingredient(raw):
    """Parse ingredient string → (cleaned_name, grams)."""
    raw = raw.strip()
    if not raw:
        return None, 0

    raw_lower = raw.lower()

    # Skip non-ingredients
    skip_patterns = ['to taste', 'as required', 'as needed', 'for garnish', 'for serving']
    for pat in skip_patterns:
        if raw_lower.endswith(pat) and len(raw_lower) < 30:
            return clean_ingredient_name(raw_lower), 2  # tiny amount

    # Pattern 1: "2 tablespoon oil" or "500 grams chicken"
    pattern = re.compile(
        r'^([\d\s/\-\.½¼¾⅓⅔]+)\s*'
        r'(tablespoons?|teaspoons?|tbsp|tsp|cups?|grams?|kg|ml|liters?|litres?|milliliters?'
        r'|cloves?|inch(?:es)?|sprigs?|bunch(?:es)?|handful|pinch(?:es)?|pieces?|slices?'
        r'|pods?|leaves?|stalks?|sticks?|strands?|drops?|spoons?|g\b)\s*'
        r'(of\s+)?(.+)?$',
        re.IGNORECASE
    )
    m = pattern.match(raw)

    if m:
        qty_str  = m.group(1).strip()
        unit_str = m.group(2).strip().lower()
        name_raw = (m.group(4) or '').strip()
        qty = fraction_to_float(qty_str)

        # Normalize unit
        unit_key = unit_str.rstrip('s') if unit_str not in UNIT_TO_GRAMS else unit_str
        grams_per_unit = UNIT_TO_GRAMS.get(unit_str, UNIT_TO_GRAMS.get(unit_key, 15))
        grams = qty * grams_per_unit

        name = clean_ingredient_name(name_raw) if name_raw else clean_ingredient_name(raw)

    else:
        # Pattern 2: "2 eggs" or "3 onions" (count with no unit)
        count_m = re.match(r'^([\d\s/\-\.½¼¾⅓⅔]+)\s+(.+)$', raw)
        if count_m:
            qty_str  = count_m.group(1).strip()
            name_raw = count_m.group(2).strip()
            qty  = fraction_to_float(qty_str)
            name = clean_ingredient_name(name_raw)
            # Check item-specific weight
            item_g = None
            for key, wt in ITEM_GRAMS.items():
                if key in name.lower():
                    item_g = wt
                    break
            grams = qty * (item_g or 60)
        else:
            # No quantity — assume small amount
            name  = clean_ingredient_name(raw)
            grams = 10

    name = re.sub(r'\s+', ' ', name).strip()
    grams = min(max(grams, 0.5), 2000)
    return name, round(grams, 1)


# ─────────────────────────────────────────────────────────────────────────────
# NUTRITION LOOKUP
# ─────────────────────────────────────────────────────────────────────────────
def lookup_nutrition(name):
    """Return [cal, protein, carbs, fat, fiber] per 100g for ingredient name."""
    if not name:
        return NUTRITION_DB['__default__']

    n = name.lower().strip()

    # Apply alias first
    n = ALIASES.get(n, n)

    # Exact match
    if n in NUTRITION_DB:
        return NUTRITION_DB[n]

    # Check aliases for partial match
    for alias, canonical in ALIASES.items():
        if alias in n:
            if canonical in NUTRITION_DB:
                return NUTRITION_DB[canonical]

    # Substring: DB key contained in ingredient name
    best_key = None
    best_len = 0
    for key in NUTRITION_DB:
        if key == '__default__':
            continue
        if key in n and len(key) > best_len:
            best_key = key
            best_len = len(key)
    if best_key:
        return NUTRITION_DB[best_key]

    # Reverse: ingredient name contained in DB key
    for key in NUTRITION_DB:
        if key == '__default__':
            continue
        if n in key:
            return NUTRITION_DB[key]

    # Word overlap: find DB key with most words in common
    n_words = set(n.split())
    best_overlap = 0
    best_key = None
    for key in NUTRITION_DB:
        if key == '__default__':
            continue
        overlap = len(n_words & set(key.split()))
        if overlap > best_overlap:
            best_overlap = overlap
            best_key = key
    if best_overlap >= 1 and best_key:
        return NUTRITION_DB[best_key]

    return NUTRITION_DB['__default__']


# ─────────────────────────────────────────────────────────────────────────────
# SERVINGS ESTIMATOR
# ─────────────────────────────────────────────────────────────────────────────
COURSE_SERVINGS = {
    'Breakfast': 3,
    'Snack':     4,
    'Lunch':     4,
    'Dinner':    4,
    'Main Course': 4,
    'Soup':      4,
    'Drink':     4,
    'Dessert':   6,
}

NAME_SERVINGS_KEYWORDS = {
    'biryani': 5, 'pulao': 4, 'curry': 4, 'dal': 4,
    'cake': 8, 'bread': 8, 'loaf': 8,
    'halwa': 6, 'ladoo': 12, 'barfi': 12, 'mithai': 12,
    'kheer': 5, 'payasam': 5,
    'chutney': 6, 'pickle': 10, 'achar': 10,
    'raita': 4, 'salad': 3,
    'dosa': 3, 'idli': 4, 'paratha': 3, 'roti': 4, 'naan': 3,
    'sandwich': 2, 'wrap': 2,
    'smoothie': 2, 'juice': 3, 'shake': 2, 'lassi': 3,
    'soup': 4, 'broth': 4,
    'rice': 4,
}

def estimate_servings(recipe_name, course, ingredient_count):
    name_lower = recipe_name.lower()
    for kw, sv in NAME_SERVINGS_KEYWORDS.items():
        if kw in name_lower:
            return sv
    if course in COURSE_SERVINGS:
        return COURSE_SERVINGS[course]
    if ingredient_count > 20:
        return 6
    if ingredient_count <= 4:
        return 2
    return DEFAULT_SERVINGS


# ─────────────────────────────────────────────────────────────────────────────
# PER-RECIPE NUTRITION CALCULATOR
# ─────────────────────────────────────────────────────────────────────────────
def calculate_nutrition(ingredients_raw, recipe_name, course, ingredient_count):
    servings = estimate_servings(recipe_name, course, ingredient_count)

    total = [0.0, 0.0, 0.0, 0.0, 0.0]  # cal, protein, carbs, fat, fiber

    for raw_ing in str(ingredients_raw).split(','):
        raw_ing = raw_ing.strip()
        if not raw_ing:
            continue
        name, grams = parse_ingredient(raw_ing)
        if not name or grams <= 0:
            continue
        nutrition = lookup_nutrition(name)
        factor = grams / 100.0
        for i in range(5):
            total[i] += nutrition[i] * factor

    per_serving = {
        'calories': max(30, round(total[0] / servings)),
        'protein':  round(total[1] / servings, 1),
        'carbs':    round(total[2] / servings, 1),
        'fat':      round(total[3] / servings, 1),
        'fiber':    round(total[4] / servings, 1),
        'servings': servings,
    }
    return per_serving


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print("  SMARTCHEF — NUTRITION MAPPER v2")
    print("="*60)

    if not os.path.exists(INPUT_FILE):
        print(f"\nERROR: {INPUT_FILE} not found. Run preprocess.py first.")
        return

    print(f"\n[1] Loading {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE)
    print(f"  Loaded {len(df)} recipes")

    print(f"\n[2] Calculating nutrition...")
    results = []
    for i, row in df.iterrows():
        if i % 1000 == 0:
            print(f"    {i+1}/{len(df)}...")
        nutrition = calculate_nutrition(
            ingredients_raw=str(row.get('ingredients_raw', '')),
            recipe_name=str(row.get('recipe_name', '')),
            course=str(row.get('course', 'Lunch')),
            ingredient_count=int(row.get('ingredient_count', 6))
        )
        results.append(nutrition)

    nutrition_df = pd.DataFrame(results)

    # Drop old nutrition columns if they exist
    for col in ['calories', 'protein', 'carbs', 'fat', 'fiber', 'servings']:
        if col in df.columns:
            df = df.drop(columns=[col])

    df = pd.concat([df, nutrition_df], axis=1)

    # Sanity cap
    df.loc[df['calories'] > 2500, 'calories'] = 2500
    df.loc[df['protein']  < 0,    'protein']  = 0
    df.loc[df['fat']      < 0,    'fat']       = 0
    df.loc[df['carbs']    < 0,    'carbs']     = 0

    print(f"\n[3] Nutrition summary:")
    print(f"  Avg calories/serving: {df['calories'].mean():.0f} kcal")
    print(f"  < 50 kcal: {len(df[df['calories'] < 50])} recipes")
    print(f"  < 100 kcal: {len(df[df['calories'] < 100])} recipes")
    print(f"  100-500 kcal: {len(df[(df['calories'] >= 100) & (df['calories'] <= 500)])} recipes")
    print(f"\n  By course:")
    print(df.groupby('course')[['calories', 'protein']].mean().round(1).to_string())

    print(f"\n[4] Saving {OUTPUT_CSV}...")
    df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
    print(f"  Saved {len(df)} recipes")

    print(f"\n[5] Saving {OUTPUT_JSON}...")
    export = {k: {'cal': v[0], 'protein': v[1], 'carbs': v[2], 'fat': v[3], 'fiber': v[4]}
              for k, v in NUTRITION_DB.items() if k != '__default__'}
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(export, f, indent=2)
    print(f"  Saved {len(export)} ingredients")

    print("\n" + "="*60)
    print("  DONE! Now run train_models.py to retrain ML models.")
    print("="*60)


if __name__ == '__main__':
    main()