"""Feature engineering utilities for commodity price prediction."""
from __future__ import annotations

import pandas as pd


def _ensure_datetime(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    """Return a copy with the date column parsed to datetime."""
    out = df.copy()
    out[date_col] = pd.to_datetime(out[date_col])
    return out


def create_lag_features(
    df: pd.DataFrame,
    price_col: str = "modal_price",
    group_col: str = "market",
    date_col: str = "date",
) -> pd.DataFrame:
    """Add lag features (1, 3, 7) for the given price column, grouped by the specified market column."""
    out = _ensure_datetime(df, date_col=date_col)
    out = out.sort_values([group_col, date_col])
    out["price_lag_1"] = out.groupby(group_col)[price_col].shift(1)
    out["price_lag_3"] = out.groupby(group_col)[price_col].shift(3)
    out["price_lag_7"] = out.groupby(group_col)[price_col].shift(7)
    return out


def create_rolling_features(
    df: pd.DataFrame,
    price_col: str = "modal_price",
    group_col: str = "market",
    date_col: str = "date",
) -> pd.DataFrame:
    """Add rolling mean features (3, 7, 30) for the given price column, grouped by the specified market column."""
    out = _ensure_datetime(df, date_col=date_col)
    out = out.sort_values([group_col, date_col])
    out["price_roll_mean_3"] = (
        out.groupby(group_col)[price_col].transform(lambda s: s.shift(1).rolling(window=3, min_periods=3).mean())
    )
    out["price_roll_mean_7"] = (
        out.groupby(group_col)[price_col].transform(lambda s: s.shift(1).rolling(window=7, min_periods=7).mean())
    )
    out["price_roll_mean_30"] = (
        out.groupby(group_col)[price_col].transform(lambda s: s.shift(1).rolling(window=30, min_periods=30).mean())
    )
    return out


def create_volatility_features(
    df: pd.DataFrame,
    max_price_col: str | None = "Max_Price",
    min_price_col: str | None = "Min_Price",
    price_col: str = "modal_price",
    group_col: str = "market",
    date_col: str = "date",
) -> pd.DataFrame:
    """
    Add simple volatility features based on daily price spread.

    If both `max_price_col` and `min_price_col` are present in the dataframe,
    `price_spread` is computed as their difference. Otherwise, if `price_col`
    is present, a proxy spread is derived from that column using a small
    rolling window (max - min) **within each market group**. If none of these
    columns are available, the `price_spread` column is created with missing
    values.
    """
    out = df.copy()

    # Prefer explicitly provided max/min columns when available.
    if (
        max_price_col
        and min_price_col
        and max_price_col in out.columns
        and min_price_col in out.columns
    ):
        out["price_spread"] = out[max_price_col] - out[min_price_col]

    # Fall back to deriving a simple spread from a single price column.
    elif price_col in out.columns:
        out = _ensure_datetime(out, date_col=date_col)
        out = out.sort_values([group_col, date_col])
        rolling_max = out.groupby(group_col)[price_col].transform(
            lambda s: s.rolling(window=2, min_periods=1).max()
        )
        rolling_min = out.groupby(group_col)[price_col].transform(
            lambda s: s.rolling(window=2, min_periods=1).min()
        )
        out["price_spread"] = rolling_max - rolling_min

    # If no suitable columns are available, create a placeholder column.
    else:
        out["price_spread"] = pd.NA
    return out


def create_time_features(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    """Add calendar-based time features from the date column."""
    out = _ensure_datetime(df, date_col=date_col)
    out["day_of_week"] = out[date_col].dt.dayofweek
    out["month"] = out[date_col].dt.month
    out["day_of_year"] = out[date_col].dt.dayofyear
    return out


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Run the full feature pipeline and return a feature-ready dataframe."""
    features = create_time_features(df)
    features = create_volatility_features(features)
    features = create_lag_features(features)
    features = create_rolling_features(features)

    required_cols = [
        "price_lag_1",
        "price_lag_3",
        "price_lag_7",
        "price_roll_mean_3",
        "price_roll_mean_7",
        "price_roll_mean_30",
    ]
    features = features.dropna(subset=required_cols)
    return features
