#!/usr/bin/env python3
"""
KavachAI ML — Phase 3 SOAR Multi-Class Trainer
============================================
Trains 5 specialized disruption prediction LSTMs (AQI, Rain, Heat, Storm, Curfew)
using 3-class classification (0=Normal, 1=Tier 1, 2=Tier 3).

Architecture (SOAR Protocol):
  - Input:  3-day rolling window (72h) x 19 features
  - LSTM:   2 layers, 128 hidden, Attention Head
  - Output: Linear(3) -> CrossEntropy (Normal, Tier 1, Tier 3)

Target: Multi-class AUC > 0.95
"""

import argparse
import os
import sys
import warnings
import joblib
import pickle
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, f1_score
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

SEED = 42
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "processed")
SEQUENCE_LENGTH = 3      # 72-hour look-back window
BATCH_SIZE = 64
EPOCHS = 50
LR = 0.002
HIDDEN = 128
LAYERS = 2
DROP = 0.3

np.random.seed(SEED)

FEATURE_COLS = [
    'max_aqi','max_aqi_7d_avg','max_aqi_7d_max','max_aqi_30d_avg','max_aqi_30d_std',
    'rainfall_mm','rainfall_mm_7d_avg','rainfall_mm_7d_max','rainfall_mm_30d_avg','rainfall_mm_30d_std',
    'max_temp_celsius','max_temp_celsius_7d_avg','max_temp_celsius_7d_max','max_temp_celsius_30d_avg','max_temp_celsius_30d_std',
    'wind_speed_kmh','month_sin','month_cos','doy_norm',
]

TASKS = {
    'aqi': 'aqi_class',
    'rain': 'rain_class',
    'heat': 'heat_class',
    'storm': 'storm_class',
    'curfew': 'curfew_class'
}

def add_rolling_features(df):
    df = df.sort_values('date').copy()
    for col in ['max_aqi', 'rainfall_mm', 'max_temp_celsius']:
        df[f'{col}_7d_avg']  = df[col].rolling(7,  min_periods=1).mean()
        df[f'{col}_7d_max']  = df[col].rolling(7,  min_periods=1).max()
        df[f'{col}_30d_avg'] = df[col].rolling(30, min_periods=1).mean()
        df[f'{col}_30d_std'] = df[col].rolling(30, min_periods=1).std().fillna(0)
    df['doy_norm'] = df['date'].dt.dayofyear / 365.0
    return df

class KavachLSTM: # Placeholder for local type checking, defined inside train()
    pass

def train():
    import torch
    import torch.nn as nn
    from torch.utils.data import Dataset, DataLoader

    torch.manual_seed(SEED)
    os.makedirs(MODEL_DIR, exist_ok=True)

    # 1. Load Data
    path = os.path.join(DATA_DIR, "all_zones_combined.parquet")
    if not os.path.exists(path):
        print("❌ No combined data found. Run fetch_historical_data.py first.")
        return
    
    combined_df = pd.read_parquet(path)
    combined_df = add_rolling_features(combined_df)

    # 2. Define Model Architecture
    class SOAR_LSTM(nn.Module):
        def __init__(self, inp, hid, layers, drop):
            super().__init__()
            self.lstm = nn.LSTM(inp, hid, layers, batch_first=True, bidirectional=True, dropout=drop if layers>1 else 0)
            self.attn = nn.Linear(hid*2, 1)
            self.head = nn.Sequential(nn.Linear(hid*2, 64), nn.ReLU(), nn.Dropout(drop), nn.Linear(64, 3))
        def forward(self, x):
            out, _ = self.lstm(x)
            w = torch.softmax(self.attn(out), dim=1)
            ctx = (w * out).sum(dim=1)
            return self.head(ctx)

    class MultiClassDS(Dataset):
        def __init__(self, X, y): self.X=torch.FloatTensor(X); self.y=torch.LongTensor(y)
        def __len__(self): return len(self.X)
        def __getitem__(self, i): return self.X[i], self.y[i]

    def make_sequences(df, label_col, scaler=None):
        feat = df[FEATURE_COLS].values.astype(np.float32)
        if scaler is None: scaler = StandardScaler().fit(feat)
        feat = scaler.transform(feat)
        lbl = df[label_col].values.astype(int)
        X, y = [], []
        for i in range(SEQUENCE_LENGTH, len(feat)):
            X.append(feat[i-SEQUENCE_LENGTH:i]); y.append(lbl[i])
        return np.array(X), np.array(y), scaler

    # 3. Train per task
    results = {}
    DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    for task, lbl_col in TASKS.items():
        print(f"\n{'='*70}\nTraining SOAR LSTM — {task.upper()}\n{'='*70}")
        all_X, all_y, sc = [], [], None
        for _, zdf in combined_df.groupby('zone_code'):
            X, y, sc = make_sequences(zdf.reset_index(drop=True), lbl_col, sc)
            all_X.append(X); all_y.append(y)
        
        X_all, y_all = np.concatenate(all_X), np.concatenate(all_y)
        print(f"  Samples: {len(X_all):,} | Class counts: {np.bincount(y_all)}")

        Xtr, Xv, ytr, yv = train_test_split(X_all, y_all, test_size=0.2, random_state=SEED, stratify=y_all)
        tr_dl = DataLoader(MultiClassDS(Xtr, ytr), BATCH_SIZE, shuffle=True)
        vl_dl = DataLoader(MultiClassDS(Xv, yv), BATCH_SIZE)

        model = SOAR_LSTM(len(FEATURE_COLS), HIDDEN, LAYERS, DROP).to(DEVICE)
        optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
        criterion = nn.CrossEntropyLoss()
        
        best_auc, best_state = 0, None
        for ep in range(1, EPOCHS+1):
            model.train()
            for Xb, yb in tr_dl:
                optimizer.zero_grad(); l = criterion(model(Xb.to(DEVICE)), yb.to(DEVICE)); l.backward(); optimizer.step()
            
            model.eval()
            probs, labs = [], []
            with torch.no_grad():
                for Xb, yb in vl_dl: 
                    probs.append(torch.softmax(model(Xb.to(DEVICE)), dim=1).cpu().numpy())
                    labs.append(yb.numpy())
            probs, labs = np.concatenate(probs), np.concatenate(labs)
            
            try: auc = roc_auc_score(labs, probs, multi_class='ovr')
            except: auc = 0.5
            
            if ep % 10 == 0 or ep == 1: print(f"  Epoch {ep:2d} | Valid AUC: {auc:.4f}")
            if auc > best_auc: best_auc = auc; best_state = {k:v.cpu().clone() for k,v in model.state_dict().items()}
        
        model.load_state_dict(best_state)
        print(f"  🎯 Best Multi-Class AUC: {best_auc:.4f}")

        # Save model and artifacts
        model_path = os.path.join(MODEL_DIR, f"lstm_{task}.pkl")
        scaler_path = os.path.join(MODEL_DIR, f"lstm_scaler_{task}.pkl")
        
        with open(model_path, 'wb') as f:
            pickle.dump({
                'model_state': model.cpu().state_dict(),
                'model_config': {'input_size': len(FEATURE_COLS), 'hidden_size': HIDDEN, 'num_layers': LAYERS, 'dropout': DROP},
                'seq_len': SEQUENCE_LENGTH, 'feature_cols': FEATURE_COLS, 'task': task, 'val_auc': best_auc
            }, f)
        with open(scaler_path, 'wb') as f: joblib.dump(sc, f)
        results[task] = best_auc

    print("\n" + "="*70 + "\nSOAR Retraining Complete\n" + "="*70)
    for t, a in results.items():
        print(f"  lstm_{t:<7}: AUC={a:.4f} {'✅' if a >= 0.95 else '❌'}")

if __name__ == "__main__":
    train()
