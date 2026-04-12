import json
import logging
import os
from datetime import datetime
from pathlib import Path

import joblib
import pandas as pd
from pymongo import MongoClient

import pipeline

try:
    from sklearn.ensemble import RandomForestRegressor
except Exception:  # pragma: no cover - optional dependency at runtime
    RandomForestRegressor = None

try:
    from statsmodels.tsa.arima.model import ARIMA
except Exception:  # pragma: no cover - optional dependency at runtime
    ARIMA = None

try:
    import numpy as np
    from tensorflow import keras
except Exception:  # pragma: no cover - optional dependency at runtime
    np = None
    keras = None


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://[::1]:27017")
DATABASE_NAME = os.getenv("MONGODB_DB", "agri_market_intel")
MODELS_DIR = Path(__file__).parent.parent / "models"
TRAINING_STRATEGY = "academic-multi-model-v1"
EXCLUDED_MSP_COMMODITIES = {
    "barley",
    "bajra",
    "copra",
    "cotton",
    "de-husked-coconut",
    "gram",
    "groundnut",
    "jowar",
    "jute",
    "maize",
    "masur",
    "moong",
    "nigerseed",
    "paddy",
    "ragi",
    "rapeseed-mustard",
    "safflower",
    "sesamum",
    "soybean",
    "sunflower-seed",
    "toria",
    "tur",
    "urad",
    "wheat",
}

BASE_FEATURE_COLUMNS = [
    "price_lag_1",
    "price_lag_3",
    "price_lag_7",
    "price_roll_mean_3",
    "price_roll_mean_7",
    "price_roll_mean_30",
    "price_spread",
    "arrival_qty",
    "day_of_week",
    "month",
    "day_of_year",
    "humidity",
    "precipitationMm",
    "temperatureMax",
    "temperatureMin",
]
TRAINING_QUERY = {"$or": [{"isCertified": True}, {"source": "seed-bootstrap"}]}


def _metric_bundle(actual, predicted):
    if len(actual) == 0 or len(actual) != len(predicted):
        return None

    actual_series = pd.Series(actual, dtype="float64").reset_index(drop=True)
    predicted_series = pd.Series(predicted, dtype="float64").reset_index(drop=True)
    mae = (actual_series - predicted_series).abs().mean()
    rmse = (((actual_series - predicted_series) ** 2).mean()) ** 0.5
    denominator = actual_series.replace(0, pd.NA).abs()
    mape = (((actual_series - predicted_series).abs() / denominator).dropna().mean() * 100)
    ss_res = ((actual_series - predicted_series) ** 2).sum()
    ss_tot = ((actual_series - actual_series.mean()) ** 2).sum()
    r2 = 1 - (ss_res / ss_tot) if ss_tot else None

    return {
        "mae": round(float(mae), 3),
        "mape": round(float(mape), 3) if pd.notna(mape) else None,
        "r2": round(float(r2), 3) if r2 is not None else None,
        "rmse": round(float(rmse), 3),
    }


def _feature_columns(df):
    columns = [column for column in BASE_FEATURE_COLUMNS if column in df.columns]
    return columns


def _merge_weather(df, db):
    if df is None or df.empty:
        return df, 0.0

    weather_rows = list(
        db["weather_history"].find(
            {
                "marketId": {"$in": list(df["market"].dropna().unique())},
                "$or": [{"isCertified": True}, {"source": "seed-bootstrap"}],
            },
            {
                "_id": 0,
                "date": 1,
                "humidity": 1,
                "marketId": 1,
                "precipitationMm": 1,
                "temperatureMax": 1,
                "temperatureMin": 1,
            },
        )
    )
    if not weather_rows:
        return df, 0.0

    weather_df = pd.DataFrame(weather_rows)
    weather_df = weather_df.rename(columns={"marketId": "market"})
    merged = df.merge(weather_df, on=["market", "date"], how="left")
    weather_coverage = 0.0
    if not merged.empty:
        weather_coverage = round(
            float(
                merged[["humidity", "precipitationMm", "temperatureMax", "temperatureMin"]]
                .notna()
                .any(axis=1)
                .mean()
                * 100
            ),
            2,
        )
    for column in ["humidity", "precipitationMm", "temperatureMax", "temperatureMin"]:
        if column not in merged.columns:
            merged[column] = 0.0
        merged[column] = pd.to_numeric(merged[column], errors="coerce").fillna(0.0)
    return merged, weather_coverage


def build_training_context(data, weather_coverage):
    if not data:
        return {
            "approvedPublicPercent": 0.0,
            "coverageWindow": None,
            "officialPercent": 0.0,
            "rowCountUsed": 0,
            "sourceBreakdown": {},
            "statesCovered": [],
            "weatherCoveragePercent": weather_coverage,
        }

    rows = pd.DataFrame(data)
    rows["date"] = rows["date"].astype(str)
    counts = {}
    for row in data:
        source_type = row.get("sourceType") or ("demo" if row.get("source") == "seed-bootstrap" else "legacy")
        counts[source_type] = counts.get(source_type, 0) + 1

    total = sum(counts.values()) or 1
    return {
        "approvedPublicPercent": round((counts.get("approved_public", 0) + counts.get("approved_public_weather", 0)) * 100 / total, 2),
        "coverageWindow": {
            "maxDate": rows["date"].max(),
            "minDate": rows["date"].min(),
        },
        "officialPercent": round(counts.get("official", 0) * 100 / total, 2),
        "rowCountUsed": int(len(rows)),
        "sourceBreakdown": counts,
        "statesCovered": sorted(set(rows.get("state", pd.Series(dtype="object")).dropna().tolist())),
        "weatherCoveragePercent": weather_coverage,
    }


def fetch_commodity_data(db, commodity):
    cursor = db["daily_prices"].find({"commodity": commodity, **TRAINING_QUERY})
    data = list(cursor)
    if not data:
        return None, None

    df = pd.DataFrame(data)
    rename_map = {
        "arrivalQty": "arrival_qty",
        "marketId": "market",
        "maxPrice": "Max_Price",
        "minPrice": "Min_Price",
        "modalPrice": "modal_price",
    }
    for old_name, new_name in rename_map.items():
        if old_name in df.columns:
            df = df.rename(columns={old_name: new_name})

    for column in ["modal_price", "Max_Price", "Min_Price", "arrival_qty"]:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=["modal_price", "market", "date"])
    grouped = (
        df.groupby(["market", "date"], as_index=False)
        .agg(
            {
                "Max_Price": "mean",
                "Min_Price": "mean",
                "arrival_qty": "sum",
                "modal_price": "mean",
            }
        )
        .sort_values(["market", "date"])
    )
    merged, weather_coverage = _merge_weather(grouped, db)
    return merged, build_training_context(data, weather_coverage)


def build_feature_frame(df):
    if df is None or df.empty:
        return None

    features = pipeline.build_features(df.copy())
    if features is None or features.empty:
        return None

    for column in ["humidity", "precipitationMm", "temperatureMax", "temperatureMin"]:
        if column not in features.columns:
            features[column] = 0.0
        features[column] = pd.to_numeric(features[column], errors="coerce").fillna(0.0)

    if "arrival_qty" not in features.columns:
        features["arrival_qty"] = 0.0

    return features.sort_values(["date", "market"]).reset_index(drop=True)


def split_timewise(df):
    unique_dates = sorted(df["date"].unique())
    if len(unique_dates) < 8:
        return None, None

    split_index = max(1, int(len(unique_dates) * 0.8))
    cutoff = unique_dates[split_index - 1]
    train = df[df["date"] <= cutoff].copy()
    test = df[df["date"] > cutoff].copy()
    if train.empty or test.empty:
        return None, None
    return train, test


def train_random_forest(features_df, output_dir):
    if RandomForestRegressor is None:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "random_forest",
            "notes": "scikit-learn is not installed.",
            "status": "skipped",
        }

    train_df, test_df = split_timewise(features_df)
    if train_df is None:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "random_forest",
            "notes": "Not enough feature rows for time-based validation.",
            "status": "skipped",
        }

    feature_columns = _feature_columns(features_df)
    model = RandomForestRegressor(
        n_estimators=300,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(train_df[feature_columns], train_df["modal_price"])
    predictions = model.predict(test_df[feature_columns])
    metrics = _metric_bundle(test_df["modal_price"], predictions)

    artifact_path = output_dir / "random_forest.pkl"
    joblib.dump(
        {
            "featureColumns": feature_columns,
            "model": model,
        },
        artifact_path,
    )
    return {
        "artifactPath": str(artifact_path),
        "featureColumns": feature_columns,
        "metrics": metrics,
        "modelName": "random_forest",
        "status": "available",
    }


def train_arima(features_df, output_dir):
    if ARIMA is None:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "arima",
            "notes": "statsmodels is not installed.",
            "status": "skipped",
        }

    series_df = (
        features_df.groupby("date", as_index=False)["modal_price"]
        .mean()
        .sort_values("date")
        .reset_index(drop=True)
    )
    if len(series_df) < 20:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "arima",
            "notes": "Not enough commodity-level time points for ARIMA validation.",
            "status": "skipped",
        }

    split_index = max(12, int(len(series_df) * 0.8))
    train = series_df.iloc[:split_index]["modal_price"]
    test = series_df.iloc[split_index:]["modal_price"]
    if test.empty:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "arima",
            "notes": "Not enough holdout data for ARIMA validation.",
            "status": "skipped",
        }

    fitted = ARIMA(train, order=(2, 1, 2)).fit()
    predictions = fitted.forecast(steps=len(test))
    metrics = _metric_bundle(test, predictions)

    artifact_path = output_dir / "arima_summary.json"
    artifact_path.write_text(
        json.dumps(
            {
                "order": [2, 1, 2],
                "trainedOnPoints": int(len(train)),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return {
        "artifactPath": str(artifact_path),
        "metrics": metrics,
        "modelName": "arima",
        "status": "available",
    }


def train_lstm(features_df, output_dir):
    if keras is None or np is None:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "lstm",
            "notes": "tensorflow is not installed.",
            "status": "skipped",
        }

    series_df = (
        features_df.groupby("date", as_index=False)["modal_price"]
        .mean()
        .sort_values("date")
        .reset_index(drop=True)
    )
    values = series_df["modal_price"].astype("float32").to_numpy()
    window = 7
    if len(values) <= window + 8:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "lstm",
            "notes": "Not enough sequence points for LSTM validation.",
            "status": "skipped",
        }

    x_rows = []
    y_rows = []
    for index in range(window, len(values)):
        x_rows.append(values[index - window:index])
        y_rows.append(values[index])

    x = np.array(x_rows, dtype="float32").reshape((-1, window, 1))
    y = np.array(y_rows, dtype="float32")
    split_index = max(8, int(len(x) * 0.8))
    x_train, x_test = x[:split_index], x[split_index:]
    y_train, y_test = y[:split_index], y[split_index:]
    if len(x_test) == 0:
        return {
            "artifactPath": None,
            "metrics": None,
            "modelName": "lstm",
            "notes": "Not enough LSTM holdout rows.",
            "status": "skipped",
        }

    model = keras.Sequential(
        [
            keras.layers.Input(shape=(window, 1)),
            keras.layers.LSTM(32),
            keras.layers.Dense(16, activation="relu"),
            keras.layers.Dense(1),
        ]
    )
    model.compile(optimizer="adam", loss="mse")
    model.fit(x_train, y_train, epochs=20, batch_size=8, verbose=0)
    predictions = model.predict(x_test, verbose=0).reshape(-1)
    metrics = _metric_bundle(y_test, predictions)

    artifact_path = output_dir / "lstm.keras"
    model.save(artifact_path)
    return {
        "artifactPath": str(artifact_path),
        "metrics": metrics,
        "modelName": "lstm",
        "status": "available",
        "windowSize": window,
    }


def choose_best_model(model_reports):
    available = [
        report for report in model_reports
        if report["status"] == "available" and report.get("metrics", {}).get("mape") is not None
    ]
    if not available:
        return {
            "modelName": "heuristic",
            "status": "fallback",
        }

    best = min(available, key=lambda report: report["metrics"]["mape"])
    return {
        "artifactPath": best.get("artifactPath"),
        "metrics": best.get("metrics"),
        "modelName": best["modelName"],
        "status": "available",
    }


def write_metadata(commodity, output_dir, reports, best_model, training_context, pipeline_health):
    metadata = {
        "bestModel": best_model,
        "commodity": commodity,
        "models": reports,
        "pipelineHealth": pipeline_health,
        "strategy": TRAINING_STRATEGY,
        "trainingData": training_context,
        "trainedAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
    }
    metadata_path = output_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def sync_model_versions(db, commodity, metadata):
    trained_at = metadata["trainedAt"]
    best_model_name = metadata["bestModel"]["modelName"]
    for report in metadata["models"]:
        doc = {
            "_id": f"{commodity}-forecast-{report['modelName']}",
            "artifactPath": report.get("artifactPath"),
            "commodity": commodity,
            "isActive": report["modelName"] == best_model_name and report["status"] == "available",
            "metrics": report.get("metrics"),
            "modelName": report["modelName"],
            "policyStatus": "eligible_non_msp",
            "status": report["status"],
            "strategy": TRAINING_STRATEGY,
            "taskType": "forecast",
            "trainingData": metadata.get("trainingData"),
            "pipelineHealth": metadata.get("pipelineHealth"),
            "trainedAt": trained_at,
        }
        if report.get("featureColumns"):
            doc["featureColumns"] = report["featureColumns"]
        if report.get("notes"):
            doc["notes"] = report["notes"]
        db["model_versions"].update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)


def pipeline_health_snapshot(db):
    return {
        "approvedPublicFiles": db["ingest_files"].count_documents({"sourceType": "public_staging", "importStatus": "imported"}),
        "downloadedFiles": db["ingest_files"].count_documents({}),
        "failedFiles": db["ingest_files"].count_documents({"status": "failed"}),
        "quarantinedFiles": db["ingest_files"].count_documents({"importStatus": "quarantined"}),
        "quarantineRows": db["quarantine_rows"].count_documents({}),
        "stagedPriceRows": db["staging_daily_prices"].count_documents({"approvalStatus": {"$ne": "promoted"}}),
        "stagedWeatherRows": db["staging_weather_history"].count_documents({"approvalStatus": {"$ne": "promoted"}}),
    }


def train_commodity(db, commodity):
    logger.info("Training comparison models for %s", commodity)
    raw_df, training_context = fetch_commodity_data(db, commodity)
    features_df = build_feature_frame(raw_df)
    if features_df is None or len(features_df) < 12:
        logger.warning("Skipping %s because there is not enough cleaned training data.", commodity)
        return False

    output_dir = MODELS_DIR / commodity
    output_dir.mkdir(parents=True, exist_ok=True)

    reports = [
        train_arima(features_df, output_dir),
        train_random_forest(features_df, output_dir),
        train_lstm(features_df, output_dir),
    ]
    best_model = choose_best_model(reports)
    metadata = write_metadata(
        commodity,
        output_dir,
        reports,
        best_model,
        training_context,
        pipeline_health_snapshot(db),
    )
    sync_model_versions(db, commodity, metadata)
    logger.info("Completed %s with best model %s", commodity, best_model["modelName"])
    return True


def discover_commodities(db):
    return sorted(
        commodity
        for commodity in db["daily_prices"].distinct("commodity", TRAINING_QUERY)
        if commodity not in EXCLUDED_MSP_COMMODITIES
    )


def main():
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    commodities = discover_commodities(db)
    if not commodities:
        logger.warning("No commodities found in MongoDB. Import real mandi data before training.")
        return

    stats = {"failed": 0, "success": 0}
    for commodity in commodities:
        if train_commodity(db, commodity):
            stats["success"] += 1
        else:
            stats["failed"] += 1

    logger.info("Training complete. Summary: %s", stats)
    client.close()


if __name__ == "__main__":
    main()
