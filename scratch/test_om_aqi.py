import requests

def test_open_meteo_aqi():
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude": 28.7300,
        "longitude": 77.1100,
        "start_date": "2024-01-01",
        "end_date": "2024-01-05",
        "hourly": "pm10,pm2_5,us_aqi,us_aqi_pm2_5,us_aqi_pm10",
        "timezone": "Asia/Kolkata"
    }
    resp = requests.get(url, params=params)
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print("Keys:", data.keys())
        if 'hourly' in data:
            print("Hourly features:", data['hourly'].keys())
            print("First few points of us_aqi:", data['hourly'].get('us_aqi')[:5])
            print("First few points of pm2_5:", data['hourly'].get('pm2_5')[:5])

if __name__ == "__main__":
    test_open_meteo_aqi()
