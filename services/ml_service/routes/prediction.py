"""
Disruption Prediction Endpoint — GET /api/v1/predict/disruption
Returns LSTM-powered disruption probability for a given zone.
"""
import math
import logging
from datetime import datetime, timezone, timedelta

import numpy as np
from fastapi import APIRouter, Query

from fastapi import APIRouter, Query
import random

logger = logging.getLogger("ml_service")
router = APIRouter()

# Zone-to-city mapping (matches PostGIS zone configuration)
ZONE_CITY_MAP = {
    "delhi_rohini": "delhi_ncr", "delhi_dwarka": "delhi_ncr", "delhi_saket": "delhi_ncr",
    "delhi_laxmi_nagar": "delhi_ncr",
    "mumbai_andheri": "mumbai", "mumbai_bandra": "mumbai", "mumbai_powai": "mumbai",
    "mumbai_dadar": "mumbai",
    "bengaluru_koramangala": "bengaluru", "bengaluru_whitefield": "bengaluru",
    "bengaluru_indiranagar": "bengaluru",
    "hyderabad_gachibowli": "hyderabad", "hyderabad_hitech_city": "hyderabad",
    "hyderabad_secunderabad": "hyderabad",
    "pune_kothrud": "pune", "pune_hinjewadi": "pune", "pune_viman_nagar": "pune",
    "kolkata_salt_lake": "kolkata", "kolkata_newtown": "kolkata",
    "kolkata_park_street": "kolkata", "kolkata_howrah": "kolkata",
}


@router.get("/disruption")
async def predict_disruption(
    zone_code: str = Query(..., example="delhi_rohini"),
    days_ahead: int = Query(default=7, ge=1, le=30, example=7),
):
    import sys
    import os
    ml_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../ml'))
    if ml_path not in sys.path:
        sys.path.append(ml_path)
        
    try:
        from lstm_loader import lstm_store
        result = lstm_store.predict_disruption(zone_code, days_ahead)
        return result
    except Exception as e:
        logger.error(f"LSTM prediction failed: {e}")
        city = ZONE_CITY_MAP.get(zone_code, "delhi_ncr")
        return _rule_based_prediction(zone_code, city, days_ahead)

@router.get("/disruptions/active")
async def get_active_disruptions():
    """Provides active disruptions for the Fraud Queue UI"""
    # Fetch random or modeled synthetic active disruptions for Phase 3 SOAR Demo
    return [
        {
            "id": "CLM-8829-XR",
            "worker_name": "Arjun Kumar (Verified)",
            "zone": "delhi_rohini",
            "event_type": "Hazardous AQI",
            "tier": 3,
            "confidence": 0.987
        },
        {
            "id": "CLM-8830-AB",
            "worker_name": "Priya Sharma (Verified)",
            "zone": "mumbai_andheri",
            "event_type": "Heavy Rainfall",
            "tier": 1,
            "confidence": 0.942
        },
        {
            "id": "CLM-8831-ZZ",
            "worker_name": "Rahul Verma",
            "zone": "chennai_central",
            "event_type": "Curfew/Bandh",
            "tier": 0,
            "confidence": 0.991
        }
    ]


def _generate_recent_sequence(city: str, now: datetime, seq_len: int = 15) -> np.ndarray:
    """
    Generate a synthetic 15-day sequence representing recent conditions.
    In production, this would come from the last 15 days of actual API data.
    """
    from ml.train_lstm_model import CITY_PARAMS, generate_daily_data

    # Generate city data and take the last seq_len days matching current month
    try:
        city_df = generate_daily_data(city, n_days=365)
        month_data = city_df[city_df["month"] == now.month]
        if len(month_data) >= seq_len:
            sample = month_data.tail(seq_len)
        else:
            sample = city_df.tail(seq_len)
    except Exception:
        # Fallback: generate simple synthetic sequence
        features = []
        for i in range(seq_len):
            day = now - timedelta(days=seq_len - i)
            dow = day.weekday()
            month = day.month

            features.append([
                150.0,   # AQI
                30.0,    # temp
                5.0,     # rain
                12.0,    # wind
                0,       # trigger
                math.sin(2 * math.pi * dow / 7),
                math.cos(2 * math.pi * dow / 7),
                math.sin(2 * math.pi * month / 12),
                math.cos(2 * math.pi * month / 12),
            ])
        return np.array(features, dtype=np.float32)

    feature_cols = ["max_aqi", "max_temp_celsius", "rainfall_mm", "wind_speed_kmh",
                    "trigger_fired", "day_of_week_sin", "day_of_week_cos",
                    "month_sin", "month_cos"]
    return sample[feature_cols].values.astype(np.float32)


def _get_primary_risk(city: str, month: int) -> str:
    """Determine primary risk factor based on city and season."""
    if city == "delhi_ncr" and month in [10, 11, 12, 1]:
        return "AQI"
    elif city in ["mumbai", "kolkata", "pune", "bengaluru"] and month in [6, 7, 8, 9]:
        return "heavy_rain"
    elif city in ["delhi_ncr", "hyderabad"] and month in [4, 5, 6]:
        return "extreme_heat"
    elif city in ["mumbai", "kolkata"] and month in [5, 10, 11]:
        return "cyclone"
    else:
        return "mixed"


def _rule_based_prediction(zone_code: str, city: str, days_ahead: int) -> dict:
    """Fallback when LSTM model isn't loaded."""
    now = datetime.now(timezone.utc)
    month = now.month

    # Simple seasonal probability
    CITY_SEASON_RISK = {
        ("delhi_ncr", "winter"): 0.75,
        ("delhi_ncr", "summer"): 0.55,
        ("mumbai", "monsoon"): 0.80,
        ("kolkata", "monsoon"): 0.70,
        ("bengaluru", "monsoon"): 0.50,
    }

    if month in [6, 7, 8, 9]:
        season = "monsoon"
    elif month in [3, 4, 5]:
        season = "summer"
    elif month in [10, 11]:
        season = "post_monsoon"
    else:
        season = "winter"

    prob = CITY_SEASON_RISK.get((city, season), 0.30)
    primary_risk = _get_primary_risk(city, month)

    return {
        "zone_code": zone_code,
        "city": city,
        "prediction_horizon_days": days_ahead,
        "disruption_probability": round(prob, 4),
        "confidence": "medium",
        "primary_risk": primary_risk,
        "model_version": "rule_based_fallback",
    }
