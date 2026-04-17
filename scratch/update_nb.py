import json

def update_notebook():
    notebook_path = "/home/dhruvvv_26/Desktop/KavachAI/ml/KavachAI_LSTM_Training_Phase3.ipynb"
    with open(notebook_path, 'r') as f:
        nb = json.load(f)
        
    new_source = [
        "# ── Cell 5: Fetch / Synthesize AQI ───────────────────────────────────────\n",
        "def synthesize_aqi(zone_id, city):\n",
        "    \"\"\"Physically calibrated synthetic AQI — CPCB annual report calibrated\"\"\"\n",
        "    profiles = {\n",
        "        'delhi_ncr':  {'base': 160, 'winter_peak': 380, 'monsoon_floor': 55},\n",
        "        'mumbai':     {'base': 85,  'winter_peak': 160, 'monsoon_floor': 40},\n",
        "        'bengaluru':  {'base': 65,  'winter_peak': 120, 'monsoon_floor': 35},\n",
        "        'hyderabad':  {'base': 95,  'winter_peak': 180, 'monsoon_floor': 45},\n",
        "        'pune':       {'base': 80,  'winter_peak': 150, 'monsoon_floor': 38},\n",
        "    }\n",
        "    p = profiles.get(city, profiles['delhi_ncr'])\n",
        "    dates = pd.date_range(start=START_DATE, end=END_DATE, freq='D')\n",
        "    np.random.seed(abs(hash(zone_id)) % (2**31))\n",
        "    aqi_vals = []\n",
        "    for d in dates:\n",
        "        m = d.month\n",
        "        if m in [11, 12, 1, 2]:    s = p['winter_peak']\n",
        "        elif m in [6, 7, 8, 9]:    s = p['monsoon_floor']\n",
        "        elif m in [3, 4, 5]:       s = p['base'] * 0.9\n",
        "        else:                      s = p['base'] * 1.3\n",
        "        s *= (1 - (d.year - 2022) * 0.03)\n",
        "        s *= 1.08 if d.weekday() < 5 else 0.95\n",
        "        aqi_vals.append(round(np.clip(s * np.random.lognormal(0, 0.18), 10, 500), 1))\n",
        "    return pd.DataFrame({'date': dates, 'aqi': aqi_vals, 'zone_id': zone_id})\n",
        "\n",
        "def fetch_aqi_openmeteo(zone_id, lat, lon):\n",
        "    try:\n",
        "        url = \"https://air-quality-api.open-meteo.com/v1/air-quality\"\n",
        "        params = {\n",
        "            \"latitude\": lat,\n",
        "            \"longitude\": lon,\n",
        "            \"start_date\": START_DATE,\n",
        "            \"end_date\": END_DATE,\n",
        "            \"hourly\": \"us_aqi\",\n",
        "            \"timezone\": \"Asia/Kolkata\",\n",
        "        }\n",
        "        r = requests.get(url, params=params, timeout=30)\n",
        "        r.raise_for_status()\n",
        "        data = r.json()\n",
        "        \n",
        "        hourly = data[\"hourly\"]\n",
        "        df = pd.DataFrame({\n",
        "            \"time\": pd.to_datetime(hourly[\"time\"]),\n",
        "            \"us_aqi\": hourly[\"us_aqi\"],\n",
        "        })\n",
        "        \n",
        "        # Fill NaNs with a sensible moderate default\n",
        "        df[\"us_aqi\"] = df[\"us_aqi\"].ffill().fillna(50.0)\n",
        "        \n",
        "        # Group by local date to find daily maximum AQI\n",
        "        df[\"date\"] = df[\"time\"].dt.floor(\"D\")\n",
        "        daily_df = df.groupby(\"date\")[\"us_aqi\"].max().reset_index()\n",
        "        daily_df.rename(columns={\"us_aqi\": \"aqi\"}, inplace=True)\n",
        "        daily_df[\"zone_id\"] = zone_id\n",
        "        \n",
        "        print(f'  📡 Open-Meteo AQI data: {len(daily_df)} days')\n",
        "        return daily_df\n",
        "    except Exception as e:\n",
        "        print(f'  ⚠️  Open-Meteo failed ({e}) — synthesizing')\n",
        "        return synthesize_aqi(zone_id, ZONES[zone_id]['city'])\n",
        "\n",
        "aqi_dfs = {}\n",
        "for zone_id, info in ZONES.items():\n",
        "    print(f'📍 AQI for {zone_id}...')\n",
        "    df = fetch_aqi_openmeteo(zone_id, info['lat'], info['lon'])\n",
        "    df.to_parquet(f'ml/data/raw/{zone_id}_aqi.parquet', index=False)\n",
        "    aqi_dfs[zone_id] = df\n",
        "    time.sleep(0.5)\n",
        "\n",
        "print('\\nAll AQI data ready ✅')\n"
    ]
    
    # Locate the right cell and update
    for cell in nb['cells']:
        if cell['cell_type'] == 'code' and cell.get('metadata', {}).get('id') == 'fetch_aqi':
            cell['source'] = new_source
            break
            
    with open(notebook_path, 'w') as f:
        json.dump(nb, f, indent=1, ensure_ascii=False)
        
    print("Notebook updated successfully.")

if __name__ == "__main__":
    update_notebook()
