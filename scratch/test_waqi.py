import requests
import json
import pandas as pd
from datetime import datetime

WAQI_TOKEN = 'dbb5b4fa605d51dcaf10a97e85344a6230b47b3e'

ZONES = {
    "delhi_rohini": {"lat": 28.7300, "lon": 77.1100, "city": "delhi_ncr"},
    "delhi_connaught": {"lat": 28.6328, "lon": 77.2197, "city": "delhi_ncr"},
    "mumbai_andheri": {"lat": 19.1136, "lon": 72.8697, "city": "mumbai"},
    "bengaluru_koramangala": {"lat": 12.9325, "lon": 77.6350, "city": "bengaluru"},
    "hyderabad_hitech": {"lat": 17.4550, "lon": 78.3850, "city": "hyderabad"},
    "pune_kothrud": {"lat": 18.5125, "lon": 73.8250, "city": "pune"},
}

def test_waqi_endpoint(zone_id, lat, lon):
    print(f"Testing {zone_id}...")
    try:
        # Step 1: Geo search
        r = requests.get(f'https://api.waqi.info/feed/geo:{lat};{lon}/?token={WAQI_TOKEN}', timeout=15)
        body = r.json()
        if body.get('status') != 'ok':
            print(f"  ❌ Geo failed: {body.get('data')}")
            return
        
        station_id = body['data']['idx']
        station_name = body['data']['city']['name']
        print(f"  ✅ Found station: {station_name} (idx: {station_id})")
        
        # Step 2: Historical obs (The one the user is using)
        # Note: This is an internal endpoint of aqicn.org, not a public API.
        # It often requires specific headers or is rate-limited/restricted.
        r2 = requests.get(f'https://api.waqi.info/api/feed/@{station_id}/obs.en.json', timeout=30)
        print(f"  Status code for obs: {r2.status_code}")
        try:
            body2 = r2.json()
            obs = body2.get('rxs', {}).get('obs', [])
            print(f"  ✅ Obs count: {len(obs)}")
            if len(obs) > 0:
                print(f"  Sample obs: {obs[0]}")
        except Exception as e:
            print(f"  ❌ Failed to parse r2 JSON: {e}")
            print(f"  Response content (first 100 chars): {r2.text[:100]}")

    except Exception as e:
        print(f"  ❌ Error: {e}")

for zone_id, info in ZONES.items():
    test_waqi_endpoint(zone_id, info['lat'], info['lon'])
