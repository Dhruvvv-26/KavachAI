import pandas as pd
import numpy as np
import os
import json

def run_qa():
    print("="*60)
    print("KavachAI — Pre-Flight ML QA Audit")
    print("="*60)
    
    errors = []
    
    # --- STEP 1: Audit Dataset ---
    parquet_path = "ml/data/processed/all_zones_combined.parquet"
    if not os.path.exists(parquet_path):
        errors.append(f"Parquet file missing: {parquet_path}")
    else:
        df = pd.read_parquet(parquet_path)
        print(f"\n[STEP 1] Auditing dataset: {len(df):,} rows")
        
        # 1. Class Distribution Check
        hazards = ['aqi', 'rain', 'heat', 'storm', 'curfew']
        # Note: Checking for _class as per directive (I know it's currently _label)
        for h in hazards:
            col = f"{h}_class"
            if col not in df.columns:
                actual_col = f"{h}_label"
                if actual_col in df.columns:
                    errors.append(f"Naming Error: Found '{actual_col}' but directive requires '{col}'.")
                else:
                    errors.append(f"Missing Hazard: Column '{col}' not found.")
            else:
                counts = df[col].value_counts().to_dict()
                print(f"  - {col}: {counts}")
                if not all(k in counts for k in [0, 1, 2]):
                    errors.append(f"Imbalance/Missing Class: '{col}' missing required classes {set([0, 1, 2]) - set(counts.keys())}")

        # 2. Hardcoded Injection Check
        # Michaung (2023-12-04), Elections (2024-04-19)
        michaung_date = "2023-12-04"
        election_date = "2024-04-19"
        
        df['date_str'] = df['date'].dt.strftime('%Y-%m-%d')
        
        for date_val, name in [(michaung_date, "Michaung"), (election_date, "Election")]:
            match = df[df['date_str'] == date_val]
            if match.empty:
                errors.append(f"Injection Missing: Date {date_val} ({name}) not found in dataset.")
            else:
                # Check curfew_class (or label)
                col = "curfew_class" if "curfew_class" in df.columns else "curfew_label"
                if not (match[col] == 2).all():
                    errors.append(f"Injection Failed: {name} ({date_val}) curfew level is NOT 2 (Found: {match[col].values})")
                else:
                    print(f"  - ✅ {name} ({date_val}) injection verified (Level 2).")

        # 3. Shape & NaN Check
        years = len(df['date'].unique()) / 365
        print(f"  - Spans approx {years:.1f} years.")
        if years < 2.5: errors.append(f"Dataset span too short: {years:.1f} years.")
        
        nan_counts = df.isna().sum().sum()
        if nan_counts > 0:
            errors.append(f"Critical NaNs: {nan_counts} missing values found.")
        else:
            print("  - ✅ No NaNs found in core columns.")

    # --- STEP 2: Audit Notebook ---
    nb_path = "ml/KavachAI_LSTM_Training_Phase3.ipynb"
    if not os.path.exists(nb_path):
        errors.append(f"Notebook missing: {nb_path}")
    else:
        with open(nb_path, 'r') as f:
            nb = json.load(f)
        
        content = ""
        for cell in nb['cells']:
            if cell['cell_type'] == 'code':
                content += "".join(cell['source']) + "\n"
        
        print("\n[STEP 2] Auditing Notebook Architecture")
        
        # 1. Output Head
        if "Linear(64, 3)" in content or "Linear(hid*2, 64), nn.ReLU(), nn.Dropout(drop), nn.Linear(64, 3)" in content:
            print("  - ✅ Output Head: 3 neurons verified.")
        else:
            errors.append("Architecture Mismatch: Final linear layer must output 3 neurons.")
            
        # 2. Loss Function
        if "CrossEntropyLoss()" in content:
            print("  - ✅ Loss Function: CrossEntropyLoss verified.")
        else:
            errors.append("Loss Function Error: Must use nn.CrossEntropyLoss().")
            
        # 3. Window Size
        if "SEQ_LEN = 3" in content or "SEQ_LEN    = 3" in content:
            print("  - ✅ Window Size: 72-hour (3-day) sliding window verified.")
        else:
            errors.append("Window Size Error: SEQ_LEN must be 3 for daily-stepped daily-lookback.")
            
        # 4. Metric
        if "multi_class='ovr'" in content:
            print("  - ✅ Metric: Multi-class OvR AUC verified.")
        else:
            errors.append("Metric Error: roc_auc_score must use multi_class='ovr'.")

    # Final Report
    print("\n" + "="*60)
    if errors:
        print("❌ NO-GO (Red Light)")
        for err in errors:
            print(f"  - {err}")
    else:
        print("✅ GO (Green Light)")
        print("\nYou have the Green Light to upload to Colab.")
    print("="*60)

if __name__ == "__main__":
    run_qa()
