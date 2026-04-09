import json
import logging
import math
import os
from datetime import datetime, timedelta
from pathlib import Path
from statistics import mean, pstdev

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import pipeline


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

STRATEGY_NAME = "historical-weather-v2"
AVAILABLE_MODELS = [
    "gram",
    "maize",
    "onion",
    "paddy",
    "potato",
    "soybean",
    "sugarcane",
    "tomato",
    "wheat",
]

CROP_WEATHER_RULES = {
    "gram": {
        "heavy_rain_mm": 10,
        "humidity_ceiling": 68,
        "ideal_temp": (18, 29),
        "ideal_weekly_precip_mm": 5,
        "sensitivity": 0.9,
    },
    "maize": {
        "heavy_rain_mm": 16,
        "humidity_ceiling": 78,
        "ideal_temp": (22, 32),
        "ideal_weekly_precip_mm": 16,
        "sensitivity": 0.8,
    },
    "onion": {
        "heavy_rain_mm": 10,
        "humidity_ceiling": 72,
        "ideal_temp": (20, 30),
        "ideal_weekly_precip_mm": 6,
        "sensitivity": 0.95,
    },
    "paddy": {
        "heavy_rain_mm": 24,
        "humidity_ceiling": 90,
        "ideal_temp": (24, 34),
        "ideal_weekly_precip_mm": 35,
        "sensitivity": 0.6,
    },
    "potato": {
        "heavy_rain_mm": 12,
        "humidity_ceiling": 76,
        "ideal_temp": (18, 27),
        "ideal_weekly_precip_mm": 9,
        "sensitivity": 0.9,
    },
    "soybean": {
        "heavy_rain_mm": 15,
        "humidity_ceiling": 78,
        "ideal_temp": (22, 32),
        "ideal_weekly_precip_mm": 18,
        "sensitivity": 0.8,
    },
    "tomato": {
        "heavy_rain_mm": 10,
        "humidity_ceiling": 75,
        "ideal_temp": (21, 30),
        "ideal_weekly_precip_mm": 10,
        "sensitivity": 1.0,
    },
    "sugarcane": {
        "heavy_rain_mm": 30,
        "humidity_ceiling": 88,
        "ideal_temp": (21, 36),
        "ideal_weekly_precip_mm": 40,
        "sensitivity": 0.5,
    },
    "wheat": {
        "heavy_rain_mm": 12,
        "humidity_ceiling": 70,
        "ideal_temp": (20, 30),
        "ideal_weekly_precip_mm": 8,
        "sensitivity": 0.85,
    },
}

MODELS_DIR = Path(__file__).parent.parent / "models"


class ModelManager:
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.models: dict[str, any] = {}
        self.load_models()

    def load_models(self):
        for commodity in AVAILABLE_MODELS:
            model_path = self.models_dir / commodity / f"{commodity}_model.pkl"
            if model_path.exists():
                try:
                    self.models[commodity] = joblib.load(model_path)
                    logger.info(f"Loaded model for {commodity}")
                except Exception as e:
                    logger.error(f"Failed to load model for {commodity}: {e}")
            else:
                logger.warning(f"No model found for {commodity} at {model_path}")

    def get_model(self, commodity: str):
        return self.models.get(commodity)


model_manager = ModelManager(MODELS_DIR)

app = FastAPI(title="Smart Agri Market Model Service")


class HistoryPoint(BaseModel):
    arrivalQty: float = 0
    date: str
    maxPrice: float
    minPrice: float
    modalPrice: float


class WeatherPoint(BaseModel):
    conditionLabel: str | None = None
    date: str
    humidity: float | None = None
    precipitationMm: float | None = None
    temperatureMax: float | None = None
    temperatureMin: float | None = None
    weatherCode: int | None = None


class WeatherWindow(BaseModel):
    averageHumidity: float | None = None
    averageMaxTemp: float | None = None
    averageMinTemp: float | None = None
    rainyDays: int | None = None
    totalPrecipitation: float | None = None


class WeatherSummary(BaseModel):
    conditionLabel: str | None = None
    current: WeatherPoint | None = None
    daily: list[WeatherPoint] = Field(default_factory=list)
    fetchedAt: str | None = None
    note: str | None = None
    resolvedFrom: str | None = None
    source: str | None = None
    status: str = "unavailable"
    window: WeatherWindow | None = None


class CandidateMarket(BaseModel):
    district: str
    estimatedDistanceKm: float = 24
    history: list[HistoryPoint]
    marketId: str
    marketName: str
    state: str
    weather: WeatherSummary | None = None


class PredictRequest(BaseModel):
    candidates: list[CandidateMarket]
    commodity: str
    district: str
    farmLocationText: str = ""
    quantity: float | None = None
    state: str
    transportCostPerKm: float | None = None


class ForecastRequest(BaseModel):
    commodity: str
    district: str
    estimatedDistanceKm: float = 24
    history: list[HistoryPoint]
    marketId: str
    marketName: str
    quantity: float | None = None
    state: str
    transportCostPerKm: float | None = None
    weather: WeatherSummary | None = None


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def _mean(values: list[float]) -> float:
    return mean(values) if values else 0.0


def _std(values: list[float]) -> float:
    return pstdev(values) if len(values) > 1 else 0.0


def _trend_label(prices: list[float]) -> str:
    if len(prices) < 4:
        return "Limited history"

    delta = prices[-1] - _mean(prices[-4:-1])
    if delta > 60:
        return "Rising"
    if delta < -60:
        return "Cooling"
    return "Stable"


def _risk_level(volatility_ratio: float) -> str:
    if volatility_ratio < 0.035:
        return "Low"
    if volatility_ratio < 0.075:
        return "Medium"
    return "High"


def _confidence_label(history_len: int, volatility_ratio: float) -> str:
    if history_len >= 18 and volatility_ratio < 0.06:
        return "High"
    if history_len >= 10 and volatility_ratio < 0.1:
        return "Medium"
    return "Low"


def _transport_cost(transport_cost_per_km: float | None, distance_km: float | None) -> float | None:
    if transport_cost_per_km is None or distance_km is None:
        return None
    return round(transport_cost_per_km * distance_km, 2)


def _build_anomalies(history: list[HistoryPoint]) -> list[dict]:
    prices = [point.modalPrice for point in history]
    arrivals = [point.arrivalQty for point in history]
    price_mean = _mean(prices)
    price_std = max(_std(prices), 1)
    arrival_mean = _mean(arrivals)
    arrival_std = max(_std(arrivals), 1)

    anomalies: list[dict] = []
    for point in history:
        if abs(point.modalPrice - price_mean) / price_std >= 1.6:
            anomalies.append(
                {
                    "date": point.date,
                    "reason": "Price spike" if point.modalPrice > price_mean else "Price dip",
                    "value": point.modalPrice,
                }
            )
        elif abs(point.arrivalQty - arrival_mean) / arrival_std >= 1.6:
            anomalies.append(
                {
                    "date": point.date,
                    "reason": "Arrival surge" if point.arrivalQty > arrival_mean else "Arrival drop",
                    "value": point.arrivalQty,
                }
            )

    return anomalies[-5:]


def _weather_days(weather: WeatherSummary | None) -> list[WeatherPoint]:
    if not weather or not weather.daily:
        return []
    return weather.daily[:7]


def _temp_score(avg_temp: float, ideal_low: float, ideal_high: float) -> float:
    center = (ideal_low + ideal_high) / 2
    tolerance = max((ideal_high - ideal_low) / 2, 1)
    deviation = abs(avg_temp - center) / tolerance
    if ideal_low <= avg_temp <= ideal_high:
        return _clamp(1 - (deviation * 0.35), 0.45, 1.0)
    return _clamp(0.2 - deviation, -1.0, 0.2)


def _precip_score(total_precip: float, ideal_total: float, heavy_rain_days: int) -> float:
    deviation = abs(total_precip - ideal_total) / max(ideal_total + 4, 8)
    base_score = 1 - deviation
    penalty = heavy_rain_days * 0.18
    return _clamp(base_score - penalty, -1.0, 1.0)


def _humidity_score(avg_humidity: float, ceiling: float) -> float:
    if avg_humidity <= ceiling:
        return _clamp(1 - ((ceiling - avg_humidity) / max(ceiling, 1)) * 0.2, 0.65, 1.0)
    excess = (avg_humidity - ceiling) / 10
    return _clamp(0.2 - excess, -1.0, 0.2)


def _analyze_weather(commodity: str, weather: WeatherSummary | None) -> dict:
    default_summary = {
        "conditionLabel": weather.conditionLabel if weather else "Weather unavailable",
        "current": weather.current.model_dump() if weather and weather.current else None,
        "daily": [day.model_dump() for day in _weather_days(weather)],
        "fetchedAt": weather.fetchedAt if weather else None,
        "note": weather.note if weather else "Live weather data is unavailable.",
        "resolvedFrom": weather.resolvedFrom if weather else None,
        "source": weather.source if weather else "open-meteo",
        "status": weather.status if weather else "unavailable",
        "window": weather.window.model_dump() if weather and weather.window else None,
    }

    days = _weather_days(weather)
    if not days or (weather and weather.status == "unavailable"):
        return {
            "adjustment": 0.0,
            "label": "Unavailable",
            "reason": "Live weather data was unavailable, so the model leaned on price history and arrivals.",
            "score": 0.0,
            "summary": default_summary,
        }

    rules = CROP_WEATHER_RULES.get(commodity, CROP_WEATHER_RULES["wheat"])
    avg_temp = _mean(
        [
            _mean(
                [
                    day.temperatureMax or 0,
                    day.temperatureMin or 0,
                ]
            )
            for day in days
        ]
    )
    total_precip = _mean([day.precipitationMm or 0 for day in days]) * len(days)
    avg_humidity = _mean([day.humidity or 0 for day in days])
    heavy_rain_days = sum(1 for day in days if (day.precipitationMm or 0) >= rules["heavy_rain_mm"])
    current_condition = weather.current.conditionLabel if weather and weather.current else "Clear"

    temp_component = _temp_score(avg_temp, *rules["ideal_temp"])
    precip_component = _precip_score(total_precip, rules["ideal_weekly_precip_mm"], heavy_rain_days)
    humidity_component = _humidity_score(avg_humidity, rules["humidity_ceiling"])
    disruption_penalty = 0.0
    if current_condition in {"Stormy", "Rainy"}:
        disruption_penalty += 0.18
    if current_condition == "Hot":
        disruption_penalty += 0.1

    score = _clamp(
        (
            (temp_component * 0.38)
            + (precip_component * 0.37)
            + (humidity_component * 0.25)
            - disruption_penalty
        ),
        -1.0,
        1.0,
    )
    adjustment = round(score * 120 * rules["sensitivity"], 2)

    if score >= 0.3:
        label = "Favorable"
    elif score <= -0.2:
        label = "Risky"
    else:
        label = "Mixed"

    if label == "Favorable":
        reason = (
            f"Weather looks favorable for {commodity} with {avg_temp:.1f}C average temperature, "
            f"{total_precip:.1f} mm rain, and humidity near {avg_humidity:.0f}%."
        )
    elif label == "Risky":
        reason = (
            f"Weather may pressure mandi performance for {commodity}: {heavy_rain_days} heavy-rain day(s), "
            f"{total_precip:.1f} mm rain, and humidity near {avg_humidity:.0f}%."
        )
    else:
        reason = (
            f"Weather is mixed for {commodity}, with moderate support from temperature but some pressure from "
            f"rainfall and humidity."
        )

    enriched_window = dict(default_summary["window"] or {})
    enriched_window.update(
        {
            "averageHumidity": round(avg_humidity, 1),
            "averageTemp": round(avg_temp, 1),
            "heavyRainDays": heavy_rain_days,
            "totalPrecipitation": round(total_precip, 1),
        }
    )
    default_summary["window"] = enriched_window

    return {
        "adjustment": adjustment,
        "label": label,
        "reason": reason,
        "score": round(score, 2),
        "summary": default_summary,
    }


def _daily_weather_modifier(commodity: str, weather_day: WeatherPoint | None) -> float:
    if not weather_day:
        return 0.0

    rules = CROP_WEATHER_RULES.get(commodity, CROP_WEATHER_RULES["wheat"])
    avg_temp = _mean([weather_day.temperatureMax or 0, weather_day.temperatureMin or 0])
    temp_component = _temp_score(avg_temp, *rules["ideal_temp"])
    humidity_component = _humidity_score(weather_day.humidity or 0, rules["humidity_ceiling"])
    precip_component = _precip_score(
        weather_day.precipitationMm or 0,
        max(rules["ideal_weekly_precip_mm"] / 7, 1),
        1 if (weather_day.precipitationMm or 0) >= rules["heavy_rain_mm"] else 0,
    )
    return round(
        _clamp(
            ((temp_component * 0.34) + (precip_component * 0.38) + (humidity_component * 0.28)),
            -1.0,
            1.0,
        )
        * 28
        * rules["sensitivity"],
        2,
    )


def _effective_volatility_ratio(base_ratio: float, weather_signal: dict) -> float:
    score = weather_signal["score"]
    if weather_signal["label"] == "Unavailable":
        return base_ratio + 0.015
    if score < 0:
        return base_ratio + abs(score) * 0.03
    return max(base_ratio - (score * 0.01), 0.0)


def _generate_forecast_points(
    commodity: str,
    history: list[HistoryPoint],
    weather: WeatherSummary | None,
    estimated_distance_km: float | None,
    quantity: float | None,
    transport_cost_per_km: float | None,
) -> dict:
    prices = [point.modalPrice for point in history]
    arrivals = [point.arrivalQty for point in history]
    weather_signal = _analyze_weather(commodity, weather)
    weather_days = weather_signal["summary"]["daily"]

    last_price = prices[-1]
    rolling3 = _mean(prices[-3:])
    rolling7 = _mean(prices[-7:])
    volatility = _std(prices[-7:]) or max(last_price * 0.02, 50)
    momentum = last_price - prices[-4] if len(prices) >= 4 else 0
    avg_arrival = _mean(arrivals[-7:])
    last_arrival = arrivals[-1]
    arrival_pressure = ((avg_arrival - last_arrival) / max(avg_arrival, 1)) * 55
    baseline = (
        (0.45 * last_price)
        + (0.3 * rolling3)
        + (0.25 * rolling7)
        + arrival_pressure
        + (weather_signal["adjustment"] * 0.42)
    )
    drift = (momentum * 0.2) + (arrival_pressure * 0.15)

    last_date = datetime.strptime(history[-1].date, "%Y-%m-%d")
    current = baseline
    forecast_points = []
    for step in range(1, 8):
        day_weather = weather_days[step - 1] if len(weather_days) >= step else None
        weather_adjustment = _daily_weather_modifier(
            commodity,
            WeatherPoint(**day_weather) if day_weather else None,
        )
        mean_reversion = (rolling7 - current) * 0.08
        seasonal = math.sin(step / 2.4) * (volatility * 0.18)
        predicted = max(100.0, current + drift + mean_reversion + seasonal + weather_adjustment)
        band = max(60.0, volatility * (1.0 + abs(weather_signal["score"]) * 0.25))
        point = {
            "forecastDate": (last_date + timedelta(days=step)).strftime("%Y-%m-%d"),
            "predictedPrice": round(predicted, 2),
            "lowerBound": round(max(0.0, predicted - band), 2),
            "upperBound": round(predicted + band, 2),
        }
        if day_weather:
            point.update(day_weather)
        forecast_points.append(point)
        current = predicted

    avg_price = _mean([point["predictedPrice"] for point in forecast_points])
    best_day = max(forecast_points, key=lambda point: point["predictedPrice"])
    expected_change_percent = round(((avg_price - last_price) / max(last_price, 1)) * 100, 2)
    profit_transport_cost = _transport_cost(transport_cost_per_km, estimated_distance_km)
    gross_revenue = round(avg_price * quantity, 2) if quantity is not None else None
    net_return = (
        round(gross_revenue - profit_transport_cost, 2)
        if gross_revenue is not None and profit_transport_cost is not None
        else None
    )
    effective_ratio = _effective_volatility_ratio(volatility / max(rolling7, 1), weather_signal)

    return {
        "confidenceLabel": _confidence_label(len(history), effective_ratio),
        "forecast": forecast_points,
        "profitEstimate": {
            "grossRevenue": gross_revenue,
            "netReturn": net_return,
            "transportCost": profit_transport_cost,
        },
        "riskLevel": _risk_level(effective_ratio),
        "summary": {
            "averageForecastPrice": round(avg_price, 2),
            "bestSellDay": best_day,
            "expectedChangePercent": expected_change_percent,
        },
        "weatherImpactLabel": weather_signal["label"],
        "weatherImpactScore": weather_signal["score"],
        "weatherSummary": weather_signal["summary"],
    }


def _build_explanation(
    market_name: str,
    prices: list[float],
    arrivals: list[float],
    predicted_price: float,
    trend_label: str,
    weather_signal: dict,
) -> list[str]:
    last_price = prices[-1]
    rolling7 = _mean(prices[-7:])
    last_arrival = arrivals[-1]
    avg_arrival = _mean(arrivals[-7:])
    explanations = [
        f"{market_name} is {trend_label.lower()} with the latest modal price at {last_price:.0f} INR/quintal.",
        f"The 7-day average is {rolling7:.0f} INR/quintal and the model projects {predicted_price:.0f} next.",
        (
            f"Arrivals are {'below' if last_arrival < avg_arrival else 'above'} the weekly average "
            f"({last_arrival:.0f} vs {avg_arrival:.0f}), which affects price pressure."
        ),
        weather_signal["reason"],
    ]

    if predicted_price > rolling7:
        explanations.append("Recent momentum and market conditions support a stronger selling window.")
    else:
        explanations.append("Price momentum is moderating, so the forecast favors stable rather than aggressive upside.")

    return explanations[:5]


def _score_candidate(
    candidate: CandidateMarket,
    commodity: str,
    quantity: float | None,
    transport_cost_per_km: float | None,
) -> dict:
    history = candidate.history
    if len(history) < 5:
        raise ValueError(f"Insufficient history for market {candidate.marketName}")

    prices = [point.modalPrice for point in history]
    arrivals = [point.arrivalQty for point in history]
    last_price = prices[-1]
    rolling3 = _mean(prices[-3:])
    rolling7 = _mean(prices[-7:])
    momentum = last_price - prices[-4] if len(prices) >= 4 else 0
    volatility = _std(prices[-7:]) or max(last_price * 0.02, 50)
    avg_arrival = _mean(arrivals[-7:])
    last_arrival = arrivals[-1]
    arrival_adjustment = ((avg_arrival - last_arrival) / max(avg_arrival, 1)) * 70
    weather_signal = _analyze_weather(commodity, candidate.weather)
    
    # Try ML model first
    model = model_manager.get_model(commodity)
    ml_predicted_price = None
    
    if model:
        try:
            # Convert history to DataFrame for feature engineering
            history_df = pd.DataFrame([p.model_dump() for p in history])
            # Rename columns to match training pipeline
            history_df = history_df.rename(columns={
                "arrivalQty": "arrival_qty",
                "modalPrice": "modal_price",
                "maxPrice": "Max_Price",
                "minPrice": "Min_Price"
            })
            history_df["market"] = candidate.marketId
            
            features = pipeline.build_features(history_df)
            if not features.empty:
                # Use the latest feature row for prediction
                latest_features = features.iloc[-1:]
                # Select only the features the model was trained on
                # (Assuming the model only uses the engineered features)
                # For LGBM, we can pass the whole DF if it matches training columns
                prediction = model.predict(latest_features)
                ml_predicted_price = float(prediction[0])
                logger.info(f"ML prediction for {commodity} in {candidate.marketName}: {ml_predicted_price}")
        except Exception as e:
            logger.warning(f"ML inference failed for {commodity}: {e}")

    # Heuristic baseline
    heuristic_price = (
        (0.45 * last_price)
        + (0.25 * rolling3)
        + (0.2 * rolling7)
        + (0.1 * (last_price + momentum))
        + arrival_adjustment
        + weather_signal["adjustment"]
    )
    
    # Combined prediction (favor ML if available)
    predicted_price = ml_predicted_price if ml_predicted_price is not None else heuristic_price

    transport_cost = _transport_cost(transport_cost_per_km, candidate.estimatedDistanceKm)
    gross_revenue = round(predicted_price * quantity, 2) if quantity is not None else None
    net_return = (
        round(gross_revenue - transport_cost, 2)
        if gross_revenue is not None and transport_cost is not None
        else None
    )
    trend_label = _trend_label(prices)
    volatility_ratio = _effective_volatility_ratio(volatility / max(rolling7, 1), weather_signal)
    forecast_snapshot = _generate_forecast_points(
        commodity,
        history,
        candidate.weather,
        candidate.estimatedDistanceKm,
        quantity,
        transport_cost_per_km,
    )

    return {
        "arrivalQty": round(last_arrival, 2),
        "confidenceLabel": _confidence_label(len(history), volatility_ratio),
        "estimatedDistanceKm": candidate.estimatedDistanceKm,
        "explanation": _build_explanation(
            candidate.marketName,
            prices,
            arrivals,
            predicted_price,
            trend_label,
            weather_signal,
        ),
        "forecastSummary": forecast_snapshot["summary"],
        "grossRevenue": gross_revenue,
        "marketId": candidate.marketId,
        "marketName": candidate.marketName,
        "netReturn": net_return,
        "predictedPrice": round(predicted_price, 2),
        "recentTrend": trend_label,
        "riskLevel": _risk_level(volatility_ratio),
        "weatherImpactLabel": weather_signal["label"],
        "weatherImpactScore": weather_signal["score"],
        "weatherSummary": weather_signal["summary"],
    }


@app.post("/predict")
def predict(request: PredictRequest):
    try:
        if not request.candidates:
            raise ValueError("At least one candidate market is required.")

        scored_markets = [
            _score_candidate(candidate, request.commodity, request.quantity, request.transportCostPerKm)
            for candidate in request.candidates
        ]
        scored_markets.sort(key=lambda market: market["predictedPrice"], reverse=True)
        best_market = scored_markets[0]

        return {
            "bestMarketId": best_market["marketId"],
            "bestMarketName": best_market["marketName"],
            "confidenceLabel": best_market["confidenceLabel"],
            "explanation": best_market["explanation"],
            "forecastSummary": best_market["forecastSummary"],
            "predictedPrice": best_market["predictedPrice"],
            "riskLevel": best_market["riskLevel"],
            "topMarkets": scored_markets[:5],
            "weatherImpactLabel": best_market["weatherImpactLabel"],
            "weatherImpactScore": best_market["weatherImpactScore"],
            "weatherSummary": best_market["weatherSummary"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Prediction failed for commodity %s", request.commodity)
        raise HTTPException(status_code=500, detail="Prediction failed") from exc


@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        if len(request.history) < 5:
            raise ValueError("At least 5 historical data points are required for forecasting.")

        result = _generate_forecast_points(
            request.commodity,
            request.history,
            request.weather,
            request.estimatedDistanceKm,
            request.quantity,
            request.transportCostPerKm,
        )
        result["anomalies"] = _build_anomalies(request.history)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Forecast failed for market %s", request.marketId)
        raise HTTPException(status_code=500, detail="Forecast failed") from exc


@app.get("/models")
def list_models():
    return {
        "available_models": AVAILABLE_MODELS,
        "strategy": STRATEGY_NAME,
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "smart-agri-model-service",
        "strategy": STRATEGY_NAME,
    }
