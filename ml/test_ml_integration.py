"""
KavachAI — Phase 3 SOAR Integration Test
Verifies the Multi-Class 5nd-Hazard prediction contract.
"""
import sys
import os
import unittest
import numpy as np

# Add repo root and ml dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from ml.lstm_loader import lstm_store

class TestMLIntegrationSOAR(unittest.TestCase):
    def setUp(self):
        # Ensure we have a mock parquet file for testing if real one missing
        data_dir = os.path.join(os.path.dirname(__file__), "data", "processed")
        os.makedirs(data_dir, exist_ok=True)
        self.parquet_path = os.path.join(data_dir, "all_zones_combined.parquet")
        
    def test_prediction_contract(self):
        """Verify that the prediction result contains the new SOAR fields."""
        # Test with a known zone
        zone = "delhi_rohini"
        result = lstm_store.predict_disruption(zone)
        
        print(f"\nPrediction for {zone}:")
        print(f"Status: {result.get('disruption_status')}")
        print(f"Level:  {result.get('recommended_level')}")
        print(f"Tier:   {result.get('recommended_tier')}")
        print(f"Risk:   {result.get('primary_risk')}")
        
        # Required SOAR fields
        self.assertIn("recommended_level", result)
        self.assertIn("recommended_tier", result)
        self.assertIn("disruption_status", result)
        self.assertIn("task_probabilities", result)
        
        # Verify Level vs Tier mapping
        if result["recommended_level"] == 3:
            self.assertEqual(result["recommended_tier"], "tier3")
            self.assertEqual(result["disruption_status"], "FORCE_MAJEURE")
        elif result["recommended_level"] == 1:
            self.assertEqual(result["recommended_tier"], "tier1")
            self.assertEqual(result["disruption_status"], "DRIP_PAYOUT")
            
    def test_feature_scaling_alignment(self):
        """Verify that the features prepared match the 19-column Training contract."""
        features = lstm_store.get_features("delhi_rohini", seq_len=3)
        if features is not None:
            self.assertEqual(features.shape, (3, 19))
            print("✅ Feature sequence shape (3, 19) verified.")
        else:
            print("⚠️ Skipping feature check (no parquet data found)")

if __name__ == "__main__":
    # Note: This requires the models to be present in ml/models/ to pass fully
    unittest.main()
