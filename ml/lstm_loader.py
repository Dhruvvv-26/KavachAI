import os
import math
import logging
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger("kavach_ml")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

# Zone-to-city mapping
ZONE_CITY_MAP = {
    "delhi_rohini": "delhi_ncr", "delhi_dwarka": "delhi_ncr",
    "delhi_saket": "delhi_ncr", "delhi_lajpat_nagar": "delhi_ncr",
    "delhi_karol_bagh": "delhi_ncr", "gurgaon_cyber_city": "delhi_ncr",
    "mumbai_kurla": "mumbai", "mumbai_andheri_west": "mumbai",
    "mumbai_bandra": "mumbai",
    "bengaluru_koramangala": "bengaluru", "bengaluru_hsr_layout": "bengaluru",
    "hyderabad_hitech_city": "hyderabad",
    "pune_kothrud": "pune",
    "kolkata_salt_lake": "kolkata",
}

class LSTMStore:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.metas = {}
        # Expanded task list for holistic 5nd-hazard intelligence
        self.tasks = ["aqi", "rain", "heat", "storm", "curfew"]

    def load_all(self):
        import torch
        import torch.nn as nn
        
        class BiLSTMWithAttention(nn.Module):
            def __init__(self, input_size, hidden_size, num_layers, dropout):
                super().__init__()
                self.lstm = nn.LSTM(
                    input_size=input_size, 
                    hidden_size=hidden_size, 
                    num_layers=num_layers, 
                    dropout=dropout, 
                    batch_first=True, 
                    bidirectional=True
                )
                self.attn = nn.Linear(hidden_size * 2, 1)
                self.head = nn.Sequential(
                    nn.Linear(hidden_size * 2, 64),
                    nn.ReLU(),
                    nn.Dropout(dropout),
                    nn.Linear(64, 3) # 3 Classes: Normal, Tier 1, Tier 3
                )

            def forward(self, x):
                lstm_out, _ = self.lstm(x)
                attn_weights = torch.softmax(self.attn(lstm_out), dim=1)
                context = torch.sum(attn_weights * lstm_out, dim=1)
                return torch.softmax(self.head(context), dim=1) # Probability distribution over 3 classes

        count = 0
        for task in self.tasks:
            model_path = os.path.join(MODEL_DIR, f"lstm_{task}.pkl")
            scaler_path = os.path.join(MODEL_DIR, f"lstm_scaler_{task}.pkl")
            if not os.path.exists(model_path) or not os.path.exists(scaler_path):
                continue
            
            try:
                import pickle
                with open(model_path, "rb") as f:
                    data = pickle.load(f)
                with open(scaler_path, "rb") as f:
                    scaler = pickle.load(f)
                
                cfg = data["model_config"]
                model = BiLSTMWithAttention(
                    input_size=cfg["input_size"],
                    hidden_size=cfg["hidden_size"],
                    num_layers=cfg["num_layers"],
                    dropout=cfg.get("dropout", 0.3)
                )
                model.load_state_dict(data["model_state"])
                model.eval()
                
                self.models[task] = model
                self.scalers[task] = scaler
                self.metas[task] = data
                count += 1
            except Exception as e:
                logger.error(f"Failed to load {task} model: {e}")
        return count

    def get_features(self, zone_code, seq_len=3):
        """Prepare 72-hour (3-day) lookback sequence for prediction."""
        data_dir = os.path.join(os.path.dirname(__file__), "data", "processed")
        path = os.path.join(data_dir, "all_zones_combined.parquet")
        if not os.path.exists(path):
            return None
        try:
            df = pd.read_parquet(path)
            zdf = df[df['zone_code'] == zone_code].copy().sort_values('date')
            if len(zdf) < 30: return None # Security margin for rolling features
            
            # Map column names (ensure alignment with fetcher output)
            col_map = {
                'max_aqi': 'aqi', 
                'max_temp_celsius': 'temp_max_c', 
                'wind_speed_kmh': 'wind_kmh'
            }
            zdf = zdf.rename(columns={k: v for k, v in col_map.items() if k in zdf.columns})
                
            for col in ['aqi', 'rainfall_mm', 'temp_max_c']:
                zdf[f'{col}_7d_avg']  = zdf[col].rolling(7, min_periods=1).mean()
                zdf[f'{col}_7d_max']  = zdf[col].rolling(7, min_periods=1).max()
                zdf[f'{col}_30d_avg'] = zdf[col].rolling(30, min_periods=1).mean()
                zdf[f'{col}_30d_std'] = zdf[col].rolling(30, min_periods=1).std().fillna(0)
                
            zdf['doy_norm'] = zdf['date'].dt.dayofyear / 365.0
            
            # Feature columns must match Training (Cell 7)
            feature_cols = [
                'aqi', 'aqi_7d_avg', 'aqi_7d_max', 'aqi_30d_avg', 'aqi_30d_std', 
                'rainfall_mm', 'rainfall_mm_7d_avg', 'rainfall_mm_7d_max', 'rainfall_mm_30d_avg', 'rainfall_mm_30d_std', 
                'temp_max_c', 'temp_max_c_7d_avg', 'temp_max_c_7d_max', 'temp_max_c_30d_avg', 'temp_max_c_30d_std', 
                'wind_kmh', 'month_sin', 'month_cos', 'doy_norm'
            ]
                            
            sample = zdf.tail(seq_len)
            return sample[feature_cols].values.astype(np.float32)
        except Exception as e:
            logger.error(f"Error preparing sequence: {e}")
            return None

    def predict_disruption(self, zone_code: str, days_ahead: int = 7) -> dict:
        import torch

        city = ZONE_CITY_MAP.get(zone_code, "delhi_ncr")
        # Load features with 72-hour sequence length
        seq = self.get_features(zone_code, 3)
        if seq is None or len(self.models) == 0:
            return self._rule_based_prediction(zone_code, city, days_ahead)

        probs = {}
        for task in self.models:
            model = self.models[task]
            scaler = self.scalers[task]
            
            n_features = seq.shape[1]
            seq_scaled = scaler.transform(seq).reshape(1, 3, n_features)
            
            with torch.no_grad():
                out = model(torch.FloatTensor(seq_scaled)).numpy()[0] # [P(Normal), P(Tier1), P(Tier3)]
                probs[task] = {
                    "tier1": float(out[1]),
                    "tier3": float(out[2]),
                    "combined": float(out[1] + out[2])
                }
                
        # Get highest risk across all tasks
        max_task = max(probs, key=lambda x: probs[x]["combined"])
        max_prob_data = probs[max_task]
        
        tier3_triggered = max_prob_data["tier3"] > 0.65
        tier1_triggered = max_prob_data["tier1"] > 0.65
        
        if tier3_triggered:
            level = 3
            tier = "tier3"
            status = "FORCE_MAJEURE"
            confidence = "high"
        elif tier1_triggered:
            level = 1
            tier = "tier1"
            status = "DRIP_PAYOUT"
            confidence = "high"
        else:
            level = 0
            tier = None
            status = "NORMAL"
            confidence = "medium"
        
        risk_map = {
            "aqi": "AQI", "rain": "heavy_rain", "heat": "extreme_heat",
            "storm": "storm_cyclone", "curfew": "curfew_bandh"
        }
        
        return {
            "zone_code": zone_code,
            "city": city,
            "prediction_horizon_days": days_ahead,
            "recommended_level": level,
            "recommended_tier": tier,
            "disruption_status": status,
            "primary_risk": risk_map.get(max_task, "mixed"),
            "model_version": "lstm_phase3_soar_multi",
            "task_probabilities": probs
        }

    def _rule_based_prediction(self, zone_code: str, city: str, days_ahead: int) -> dict:
        now = datetime.now(timezone.utc)
        month = now.month
        prob = 0.30
        primary_risk = "mixed"
        return {
            "zone_code": zone_code,
            "city": city,
            "prediction_horizon_days": days_ahead,
            "disruption_probability": prob,
            "confidence": "medium",
            "primary_risk": primary_risk,
            "model_version": "rule_based_fallback"
        }

lstm_store = LSTMStore()

if __name__ == "__main__":
    count = lstm_store.load_all()
    print(f"Loaded {count} models")
    for zone in ["delhi_rohini", "mumbai_kurla", "bengaluru_koramangala"]:
        res = lstm_store.predict_disruption(zone)
        print(f"{zone}: {res}")
