"""
KavachAI ML Service — FastAPI Application
=============================================
Port 8006. Serves premium pricing, fraud scoring, and disruption prediction.
Loads trained models at startup; falls back to rule-based if models missing.
"""
import logging
import os
import sys
from contextlib import asynccontextmanager

import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Dummy session for Louvain background task
class DummySession:
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def execute(self, query): raise Exception("No DB bounded — falling back")
def AsyncSessionLocal(): return DummySession()

logger = logging.getLogger("ml_service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")

MODEL_DIR = os.environ.get("MODEL_DIR", "/app/models")

# Global model containers — populated at startup
models = {
    "premium_xgb": None,
    "premium_lgb": None,
    "shap_explainer": None,
    "premium_meta": None,
    "iso_forest": None,
    "gb_fraud": None,
    "fraud_scaler": None,
    "fraud_meta": None,
    "lstm_model": None,
    "lstm_scaler": None,
    "lstm_meta": None,
}


def load_models():
    """Load all trained models. Missing models log a warning but don't crash."""
    pkl_files = {
        "premium_xgb": "premium_xgb.pkl",
        "premium_lgb": "premium_lgb.pkl",
        "shap_explainer": "shap_explainer.pkl",
        "premium_meta": "premium_meta.pkl",
        "iso_forest": "iso_forest.pkl",
        "gb_fraud": "gb_fraud.pkl",
        "fraud_scaler": "fraud_scaler.pkl",
        "fraud_meta": "fraud_meta.pkl",
        "lstm_scaler": "lstm_scaler.pkl",
        "lstm_meta": "lstm_meta.pkl",
    }

    for key, filename in pkl_files.items():
        path = os.path.join(MODEL_DIR, filename)
        if os.path.exists(path):
            try:
                models[key] = joblib.load(path)
                logger.info(f"Loaded model: {filename}")
            except Exception as e:
                logger.warning(f"Failed to load {filename}: {e}")
        else:
            logger.warning(f"Model file not found: {path} — using fallback")

    # Ensure ml directory is on sys path so we can import lstm_loader
    ml_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'ml'))
    if ml_path not in sys.path:
        sys.path.append(ml_path)
    
    from lstm_loader import lstm_store
    lstm_count = lstm_store.load_all()
    models["lstm_count"] = lstm_count


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    loaded = sum(1 for v in models.values() if v is not None) + models.get("lstm_count", 0) - 1 # -1 because we count 'lstm_count' entry
    logger.info(f"ML Service started — {loaded} models loaded")
    
    scheduler = AsyncIOScheduler()
    scheduler.start()
    schedule_louvain(scheduler, AsyncSessionLocal)
    
    yield
    scheduler.shutdown()
    logger.info("ML Service shutting down")


app = FastAPI(
    title="KavachAI ML Service",
    version="1.0.0",
    description="Premium pricing, fraud scoring, and disruption prediction",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://kavachai-admin.vercel.app", "http://localhost:3000", "http://localhost:3002", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["http://localhost:3000", "http://localhost:3002", "http://localhost:5173", "*"],
    allow_headers=["http://localhost:3000", "http://localhost:3002", "http://localhost:5173", "*"],
)

# Import and register routes
from routes.premium import router as premium_router
from routes.fraud import router as fraud_router
from routes.prediction import router as prediction_router
from routes.clique import clique_router, schedule_louvain

app.include_router(premium_router, prefix="/api/v1/premium", tags=["Premium"])
app.include_router(fraud_router, prefix="/api/v1/fraud", tags=["Fraud"])
app.include_router(prediction_router, prefix="/api/v1/predict", tags=["Prediction"])
app.include_router(clique_router, prefix="/api/v1/clique")

# Direct mount for dashboard integration without predictable prefix
from routes.prediction import get_active_disruptions
app.add_api_route("/api/v1/disruptions/active", get_active_disruptions, methods=["GET"], tags=["UI Endpoint"])


@app.get("/health")
async def health():
    loaded = sum(1 for v in models.values() if v is not None)
    return {
        "status": "healthy",
        "service": "ml-service",
        "models_loaded": loaded,
        "models_total": len([k for k in models.keys() if k != "lstm_count"]) + 3, # Add 3 for the phase 3 LSTMs
        "premium_ready": models.get("premium_xgb") is not None,
        "fraud_ready": models.get("gb_fraud") is not None,
        "lstm_ready": models.get("lstm_count", 0) > 0,
    }
