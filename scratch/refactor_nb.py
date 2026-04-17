import json

def update_notebook_to_multiclass():
    path = "/home/dhruvvv_26/Desktop/KavachAI/ml/KavachAI_LSTM_Training_Phase3.ipynb"
    with open(path, 'r') as f:
        nb = json.load(f)

    # 1. Update Headers/Markdown
    nb['cells'][0]['source'] = [
        "# KavachAI — LSTM Training (Phase 3: SOAR Multi-Class)\n",
        "\n",
        "**Trains 5 disruption level prediction models:**\n",
        "- `0` = Normal | `1` = Tier 1 (Drip Payout) | `2` = Tier 3 (Force Majeure)\n",
        "\n",
        "**Hazards:**\n",
        "- `lstm_aqi.pkl` | `lstm_rain.pkl` | `lstm_heat.pkl` | `lstm_storm.pkl` | `lstm_curfew.pkl` \n",
        "\n",
        "**Target:** Multi-class AUC > 0.95 per model\n",
        "**Window:** 72-hour sliding lookback\n"
    ]

    # 2. Update Cell 2 (Config) - Remove WAQI
    nb['cells'][2]['source'] = [
        "# ── Cell 2: CONFIG ──────────────────────────────────────────────────────\n",
        "START_DATE = '2022-01-01'\n",
        "END_DATE   = '2025-01-01'\n",
        "print(f'Training window: {START_DATE} to {END_DATE}')\n"
    ]

    # 3. Cell 6: Merge & Feature Engineering (Labels 0, 1, 2)
    # Note: Labels are now coming from the fetcher as 'aqi_label', etc.
    nb['cells'][5]['source'] = [
        "# ── Cell 6: Merge + Feature Engineering (3-Class Labels) ─────────────────\n",
        "def add_features(df):\n",
        "    df = df.sort_values('date').copy()\n",
        "    for col in ['max_aqi', 'rainfall_mm', 'max_temp_celsius']:\n",
        "        df[f'{col}_7d_avg']  = df[col].rolling(7,  min_periods=1).mean()\n",
        "        df[f'{col}_7d_max']  = df[col].rolling(7,  min_periods=1).max()\n",
        "        df[f'{col}_30d_avg'] = df[col].rolling(30, min_periods=1).mean()\n",
        "        df[f'{col}_30d_std'] = df[col].rolling(30, min_periods=1).std().fillna(0)\n",
        "    df['month_sin'] = np.sin(2 * np.pi * df['date'].dt.month / 12)\n",
        "    df['month_cos'] = np.cos(2 * np.pi * df['date'].dt.month / 12)\n",
        "    df['doy_norm']  = df['date'].dt.dayofyear / 365.0\n",
        "    return df\n",
        "\n",
        "combined = pd.read_parquet('ml/data/processed/all_zones_combined.parquet')\n",
        "all_processed = []\n",
        "for zone_id, zdf in combined.groupby('zone_code'):\n",
        "    zdf = add_features(zdf)\n",
        "    all_processed.append(zdf)\n",
        "    print(f'✅ {zone_id} processed')\n",
        "\n",
        "combined = pd.concat(all_processed)\n",
        "print(f'\\nCombined Dataset: {len(combined):,} rows')\n"
    ]

    # 4. Cell 7: Multi-Class Training
    nb['cells'][6]['source'] = [
        "# ── Cell 7: Train Multi-Class LSTMs (SOAR Protocol) ───────────────────────\n",
        "import pickle, warnings\n",
        "from sklearn.preprocessing import StandardScaler\n",
        "from sklearn.metrics import roc_auc_score, classification_report, roc_curve\n",
        "from sklearn.model_selection import train_test_split\n",
        "import torch, torch.nn as nn\n",
        "from torch.utils.data import Dataset, DataLoader\n",
        "import matplotlib.pyplot as plt\n",
        "warnings.filterwarnings('ignore')\n",
        "\n",
        "# Architecture Parameters\n",
        "SEQ_LEN    = 3      # 72-hour lookback (daily data)\n",
        "BATCH_SIZE = 64\n",
        "EPOCHS     = 50\n",
        "LR         = 2e-3\n",
        "HIDDEN     = 128\n",
        "LAYERS     = 2\n",
        "DROP       = 0.3\n",
        "DEVICE     = torch.device('cuda' if torch.cuda.is_available() else 'cpu')\n",
        "\n",
        "FEATURE_COLS = [\n",
        "    'max_aqi','max_aqi_7d_avg','max_aqi_7d_max','max_aqi_30d_avg','max_aqi_30d_std',\n",
        "    'rainfall_mm','rainfall_mm_7d_avg','rainfall_mm_7d_max','rainfall_mm_30d_avg','rainfall_mm_30d_std',\n",
        "    'max_temp_celsius','max_temp_celsius_7d_avg','max_temp_celsius_7d_max','max_temp_celsius_30d_avg','max_temp_celsius_30d_std',\n",
        "    'wind_speed_kmh','month_sin','month_cos','doy_norm',\n",
        "]\n",
        "\n",
        "class MultiClassDS(Dataset):\n",
        "    def __init__(self, X, y): self.X=torch.FloatTensor(X); self.y=torch.LongTensor(y)\n",
        "    def __len__(self): return len(self.X)\n",
        "    def __getitem__(self, i): return self.X[i], self.y[i]\n",
        "\n",
        "class KavachLSTM(nn.Module):\n",
        "    def __init__(self, inp, hid, layers, drop):\n",
        "        super().__init__()\n",
        "        self.lstm = nn.LSTM(inp, hid, layers, batch_first=True, bidirectional=True, dropout=drop if layers>1 else 0)\n",
        "        self.attn = nn.Linear(hid*2, 1)\n",
        "        self.head = nn.Sequential(nn.Linear(hid*2, 64), nn.ReLU(), nn.Dropout(drop), nn.Linear(64, 3)) # 3 Classes\n",
        "    def forward(self, x):\n",
        "        out, _ = self.lstm(x)\n",
        "        w = torch.softmax(self.attn(out), dim=1)\n",
        "        ctx = (w * out).sum(dim=1)\n",
        "        return self.head(ctx)\n",
        "\n",
        "def make_sequences(df, label_col, scaler=None):\n",
        "    feat = df[FEATURE_COLS].values.astype(np.float32)\n",
        "    if scaler is None: scaler = StandardScaler().fit(feat)\n",
        "    feat = scaler.transform(feat)\n",
        "    lbl = df[label_col].values.astype(int)\n",
        "    X, y = [], []\n",
        "    for i in range(SEQ_LEN, len(feat)):\n",
        "        X.append(feat[i-SEQ_LEN:i]); y.append(lbl[i])\n",
        "    return np.array(X), np.array(y), scaler\n",
        "\n",
        "TASKS = {'aqi':'aqi_label', 'rain':'rain_label', 'heat':'heat_label', 'storm':'storm_label', 'curfew':'curfew_label'}\n",
        "results = {}\n",
        "\n",
        "for task, lbl_col in TASKS.items():\n",
        "    print(f'\\n{\"=\"*60}\\nTraining SOAR Multi-Class LSTM — {task.upper()}\\n{\"=\"*60}')\n",
        "    df_s = combined.sort_values(['zone_code','date'])\n",
        "    all_X, all_y, sc = [], [], None\n",
        "    for _, zdf in df_s.groupby('zone_code'):\n",
        "        X, y, sc = make_sequences(zdf.reset_index(drop=True), lbl_col, sc)\n",
        "        all_X.append(X); all_y.append(y)\n",
        "    \n",
        "    X_all, y_all = np.concatenate(all_X), np.concatenate(all_y)\n",
        "    print(f'  Dataset: {len(X_all):,} samples | Distribution: {np.bincount(y_all)}')\n",
        "    \n",
        "    Xtr, Xv, ytr, yv = train_test_split(X_all, y_all, test_size=0.2, random_state=42, stratify=y_all)\n",
        "    tr_dl = DataLoader(MultiClassDS(Xtr, ytr), BATCH_SIZE, shuffle=True)\n",
        "    vl_dl = DataLoader(MultiClassDS(Xv, yv), BATCH_SIZE)\n",
        "\n",
        "    model = KavachLSTM(len(FEATURE_COLS), HIDDEN, LAYERS, DROP).to(DEVICE)\n",
        "    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)\n",
        "    crit = nn.CrossEntropyLoss() # Standard for multi-class\n",
        "    \n",
        "    best_auc, best_state = 0, None\n",
        "    for ep in range(1, EPOCHS+1):\n",
        "        model.train()\n",
        "        for Xb, yb in tr_dl:\n",
        "            opt.zero_grad(); l = crit(model(Xb.to(DEVICE)), yb.to(DEVICE)); l.backward(); opt.step()\n",
        "        \n",
        "        model.eval()\n",
        "        probs, labs = [], []\n",
        "        with torch.no_grad():\n",
        "            for Xb, yb in vl_dl: \n",
        "                probs.append(torch.softmax(model(Xb.to(DEVICE)), dim=1).cpu().numpy())\n",
        "                labs.append(yb.numpy())\n",
        "        probs, labs = np.concatenate(probs), np.concatenate(labs)\n",
        "        \n",
        "        # Multi-class OvR AUC\n",
        "        try: auc = roc_auc_score(labs, probs, multi_class='ovr')\n",
        "        except: auc = 0.5\n",
        "        \n",
        "        if ep % 5 == 0 or ep == 1: print(f'  Epoch {ep:2d} | Valid AUC: {auc:.4f}')\n",
        "        if auc > best_auc: best_auc = auc; best_state = {k:v.cpu().clone() for k,v in model.state_dict().items()}\n",
        "    \n",
        "    model.load_state_dict(best_state)\n",
        "    print(f'  🎯 Best Multi-Class AUC: {best_auc:.4f}')\n",
        "    \n",
        "    # Save\n",
        "    with open(f'ml/models/lstm_{task}.pkl', 'wb') as f:\n",
        "        pickle.dump({'model_state':model.cpu().state_dict(), \n",
        "                     'model_config':{'input_size':len(FEATURE_COLS),'hidden_size':HIDDEN,'num_layers':LAYERS,'dropout':DROP},\n",
        "                     'seq_len':SEQ_LEN, 'feature_cols':FEATURE_COLS, 'task':task, 'val_auc':best_auc}, f)\n",
        "    with open(f'ml/models/lstm_scaler_{task}.pkl', 'wb') as f: pickle.dump(sc, f)\n",
        "    results[task] = best_auc\n",
        "\n",
        "print('\\nModel training complete. All models saved to ml/models/')\n"
    ]

    # 5. Cell 8: Download all 10 files
    nb['cells'][7]['source'] = [
        "# ── Cell 8: Download Model Files (10 total) ───────────────────────────────\n",
        "from google.colab import files\n",
        "import os\n",
        "\n",
        "TASKS = ['aqi', 'rain', 'heat', 'storm', 'curfew']\n",
        "for task in TASKS:\n",
        "    for prefix in ['lstm_', 'lstm_scaler_']:\n",
        "        path = f'ml/models/{prefix}{task}.pkl'\n",
        "        if os.path.exists(path):\n",
        "            files.download(path)\n",
        "            print(f'⬇️ Downloaded: {path}')\n"
    ]

    with open(path, 'w') as f:
        json.dump(nb, f, indent=1)
    
    print("Notebook refactored for 3-class SOAR classification.")

if __name__ == "__main__":
    update_notebook_to_multiclass()
