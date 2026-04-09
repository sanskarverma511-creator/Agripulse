import os
import logging
import joblib
import pandas as pd
import lightgbm as lgb
from pathlib import Path
from pymongo import MongoClient
import pipeline

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Constants
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://[::1]:27017")
DATABASE_NAME = "agri_market_intel"
MODELS_DIR = Path(__file__).parent.parent / "models"
COMMODITIES = [
    "gram", "maize", "onion", "paddy", "potato", 
    "soybean", "sugarcane", "tomato", "wheat"
]

def fetch_data(commodity: str):
    """Fetch price history for a specific commodity from MongoDB."""
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    collection = db["daily_prices"]
    
    cursor = collection.find({"commodity": commodity})
    data = list(cursor)
    client.close()
    
    if not data:
        return None
    
    return pd.DataFrame(data)

def _preprocess_data(commodity: str, df: pd.DataFrame) -> pd.DataFrame | None:
    """Preprocess data for a specific commodity."""
    if df is None or df.empty:
        logger.warning(f"Empty dataframe for {commodity}")
        return None
    
    # Rename columns to match pipeline expectations in pipeline.py
    # pipeline.py expects: modal_price, Max_Price, Min_Price, arrival_qty, market, date
    rename_map = {
        "arrivalQty": "arrival_qty",
        "modalPrice": "modal_price",
        "maxPrice": "Max_Price",
        "minPrice": "Min_Price",
        "marketId": "market"
    }
    
    # Apply renames for columns that exist
    for old_col, new_col in rename_map.items():
        if old_col in df.columns:
            df.rename(columns={old_col: new_col}, inplace=True)
    
    # Convert to numeric
    numeric_cols = ["modal_price", "Max_Price", "Min_Price", "arrival_qty"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    
    # Drop rows with missing modal_price
    df = df.dropna(subset=["modal_price"])
    
    # Aggregate by market and date to handle duplicates
    # Use mean for prices and sum for arrival_qty
    agg_funcs = {
        "modal_price": "mean",
        "Max_Price": "mean",
        "Min_Price": "mean",
        "arrival_qty": "sum"
    }
    # Keep only columns we can aggregate
    df = df.groupby(["market", "date"]).agg({
        k: v for k, v in agg_funcs.items() if k in df.columns
    }).reset_index()

    logger.info(f"Preprocessing {commodity}: Initial rows (aggregated): {len(df)}")
    
    try:
        from pipeline import build_features
        features_df = build_features(df)
        if features_df is not None:
            logger.info(f"After build_features for {commodity}: {len(features_df)} rows")
        return features_df
    except Exception as e:
        logger.error(f"Error in build_features for {commodity}: {e}")
        return None

def train_model(commodity: str):
    """Train a LightGBM model for a specific commodity."""
    logger.info(f"Starting training for {commodity}...")
    
    try:
        raw_df = fetch_data(commodity)
        features_df = _preprocess_data(commodity, raw_df)
        
        if features_df is None or len(features_df) < 5:
            logger.warning(f"Insufficient features for {commodity}. Skipping.")
            return False
        
        # 2. Define Features and Target
        feature_cols = [
            "price_lag_1", "price_lag_3", "price_lag_7",
            "price_roll_mean_3", "price_roll_mean_7", "price_roll_mean_30",
            "day_of_week", "month"
        ]
        
        # Verify columns exist
        missing_cols = [c for c in feature_cols if c not in features_df.columns]
        if missing_cols:
            logger.warning(f"Missing columns for {commodity}: {missing_cols}")
            return False

        X = features_df[feature_cols]
        y = features_df["modal_price"]
        
        # 3. Train LightGBM Model
        model = lgb.LGBMRegressor(
            n_estimators=100,
            learning_rate=0.05,
            num_leaves=15,
            min_child_samples=5,
            objective="regression",
            random_state=42,
            verbosity=-1
        )
        
        model.fit(X, y)
        
        # 4. Save Model
        output_dir = MODELS_DIR / commodity
        output_dir.mkdir(parents=True, exist_ok=True)
        model_file = output_dir / f"{commodity}_model.pkl"
        
        joblib.dump(model, model_file)
        logger.info(f"Successfully trained and saved model for {commodity} to {model_file}")
        return True
        
    except Exception as e:
        logger.error(f"Error training model for {commodity}: {e}")
        return False

def main():
    logger.info("Starting AgriPulse Model Training Pipeline")
    
    stats = {"success": 0, "failed": 0, "skipped": 0}
    
    for commodity in COMMODITIES:
        success = train_model(commodity)
        if success:
            stats["success"] += 1
        else:
            stats["skipped"] += 1
            
    logger.info(f"Training Complete. Summary: {stats}")

if __name__ == "__main__":
    main()
