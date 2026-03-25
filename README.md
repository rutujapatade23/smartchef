# SmartChef 🍳

SmartChef is an AI-powered culinary companion that helps you plan meals, discover recipes, and track nutritional information. Built with a React frontend and a Python backend, it uses machine learning to provide personalized recipe recommendations and meal plans.

## ✨ Features

- **Personalized Recommendations**: Discover recipes based on your preferences.
- **Meal Planning**: Plan your weekly meals with ease.
- **Nutrition Tracking**: Detailed nutritional information for every recipe.
- **Indian Food Dataset**: Specialized focus on Indian cuisine.
- **Interactive UI**: A modern, responsive dashboard built with React and Vite.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Python, Flask/FastAPI (app.py)
- **Machine Learning**: Scikit-learn (K-NN Recommender, TF-IDF Similarity)
- **Data**: CSV-based recipe and nutrition datasets

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- Python (v3.8+)
- npm or yarn

### Frontend Setup

1. Navigate to the root directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Backend Setup

1. Navigate to the `backend` directory.
2. Create a virtual environment:
   ```bash
   python -m venv env
   ```
3. Activate the virtual environment:
   - Windows: `env\Scripts\activate`
   - Linux/Mac: `source env/bin/activate`
4. Install Python dependencies (ensure you have a requirements.txt, or install manually):
   ```bash
   pip install flask flask-cors pandas scikit-learn
   ```
5. Run the backend server:
   ```bash
   python app.py
   ```

## 📂 Project Structure

- `src/`: React frontend source code (components, pages, context, etc.)
- `backend/`: Python backend logic and ML models.
- `backend/data/`: Datasets used for training and recommendations.
- `backend/models/`: Saved ML models (.pkl files).

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
