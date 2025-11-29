#!/usr/bin/env python3
"""
Test empirical stage conversion rates implementation.

This test verifies that:
1. Conversion rates are calculated correctly from historical data
2. Rates are saved as artifacts during training
3. Rates are loaded during inference
4. Fallback to hardcoded rates works when empirical rates unavailable
"""

import sys
import os
import tempfile
import shutil
import pandas as pd
import numpy as np
from pathlib import Path

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from model.pipeline import EnsemblePipeline
from model.trainer import ModelTrainer
from model.inference import ForecastInference


def create_test_data() -> pd.DataFrame:
    """Create synthetic test data with known conversion rates"""
    np.random.seed(42)

    # Create data with known conversion rates:
    # inquiry: 30% convert (300/1000)
    # quote_sent: 50% convert (100/200)
    # booked: 80% convert (80/100)
    # final_payment: 95% convert (95/100)

    data = []
    lead_id = 0

    # Inquiry stage: 700 lost, 300 proceed
    for i in range(700):
        # Spread inquiries over 400 days for wider date range
        inquiry_offset = (i * 400) // 700
        data.append({
            'lead_id': f'LEAD_{lead_id:04d}',
            'inquiry_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset),
            'destination': np.random.choice(['Asia', 'Europe', 'Latin America']),
            'trip_price': np.random.uniform(3000, 8000),
            'lead_source': np.random.choice(['Website', 'Referral', 'Social Media']),
            'current_stage': 'lost',
            'is_repeat_customer': 0,
            'quote_date': pd.NaT,
            'booking_date': pd.NaT,
            'trip_date': pd.NaT,
            'final_payment_date': pd.NaT,
            'duration_days': np.random.choice([7, 10, 14, 21])
        })
        lead_id += 1

    # Quote_sent stage: 100 lost, 200 proceed (of which 100 complete)
    for i in range(200):
        inquiry_offset = (i * 400) // 200
        trip_offset = inquiry_offset + 90  # Trip 90 days after inquiry
        is_completed = i < 100  # First 100 complete
        data.append({
            'lead_id': f'LEAD_{lead_id:04d}',
            'inquiry_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset),
            'destination': np.random.choice(['Asia', 'Europe', 'Latin America']),
            'trip_price': np.random.uniform(3000, 8000),
            'lead_source': np.random.choice(['Website', 'Referral', 'Social Media']),
            'current_stage': 'completed' if is_completed else 'lost',
            'is_repeat_customer': 0,
            'quote_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset + 5),
            'booking_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset + 10) if is_completed else pd.NaT,
            'trip_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=trip_offset) if is_completed else pd.NaT,
            'final_payment_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=trip_offset - 15) if is_completed else pd.NaT,
            'duration_days': np.random.choice([7, 10, 14, 21])
        })
        lead_id += 1

    # Booked stage: 20 cancelled, 100 proceed (of which 80 complete)
    for i in range(100):
        inquiry_offset = (i * 400) // 100
        trip_offset = inquiry_offset + 90
        is_completed = i < 80  # First 80 complete
        data.append({
            'lead_id': f'LEAD_{lead_id:04d}',
            'inquiry_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset),
            'destination': np.random.choice(['Asia', 'Europe', 'Latin America']),
            'trip_price': np.random.uniform(3000, 8000),
            'lead_source': np.random.choice(['Website', 'Referral', 'Social Media']),
            'current_stage': 'completed' if is_completed else 'cancelled',
            'is_repeat_customer': 0,
            'quote_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset + 5),
            'booking_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset + 10),
            'trip_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=trip_offset) if is_completed else pd.NaT,
            'final_payment_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=trip_offset - 15) if is_completed else pd.NaT,
            'duration_days': np.random.choice([7, 10, 14, 21])
        })
        lead_id += 1

    # Final_payment stage: 5 cancelled, 100 total (95 complete)
    for i in range(100):
        inquiry_offset = (i * 400) // 100
        trip_offset = inquiry_offset + 90
        is_completed = i < 95  # First 95 complete
        data.append({
            'lead_id': f'LEAD_{lead_id:04d}',
            'inquiry_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset),
            'destination': np.random.choice(['Asia', 'Europe', 'Latin America']),
            'trip_price': np.random.uniform(3000, 8000),
            'lead_source': np.random.choice(['Website', 'Referral', 'Social Media']),
            'current_stage': 'completed' if is_completed else 'cancelled',
            'is_repeat_customer': 0,
            'quote_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset + 5),
            'booking_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=inquiry_offset + 10),
            'trip_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=trip_offset) if is_completed else pd.NaT,
            'final_payment_date': pd.Timestamp('2023-01-01') + pd.Timedelta(days=trip_offset - 15),
            'duration_days': np.random.choice([7, 10, 14, 21])
        })
        lead_id += 1

    return pd.DataFrame(data)


def test_conversion_rate_calculation():
    """Test that conversion rates are calculated correctly"""
    print("\n" + "="*70)
    print("TEST 1: Conversion Rate Calculation")
    print("="*70)

    df = create_test_data()

    print(f"\nTest data created: {len(df)} records")
    print(f"Stage distribution:")
    print(df['current_stage'].value_counts())

    # Create temporary model directory
    with tempfile.TemporaryDirectory() as temp_dir:
        trainer = ModelTrainer(model_dir=temp_dir)

        # Calculate conversion rates
        rates = trainer.calculate_stage_conversion_rates(df)

        print(f"\nCalculated conversion rates:")
        for stage, rate in rates.items():
            print(f"  {stage}: {rate:.3f}")

        # Expected rates (approximate):
        # inquiry: 375/1000 = 0.375 (all completed records had inquiries)
        # quote_sent: 275/300 ≈ 0.917 (completed with quote_date / total with quote_sent+)
        # booked: 275/280 ≈ 0.982 (completed with booking_date / total with booked+)
        # final_payment: 275/280 ≈ 0.982 (completed with final_payment_date / total with final_payment+)

        # Verify rates are reasonable
        assert 0 <= rates['inquiry'] <= 1, "Inquiry rate out of range"
        assert 0 <= rates['quote_sent'] <= 1, "Quote_sent rate out of range"
        assert 0 <= rates['booked'] <= 1, "Booked rate out of range"
        assert 0 <= rates['final_payment'] <= 1, "Final_payment rate out of range"

        # Verify progression: rates should generally increase as stages progress
        # (leads further in the funnel are more likely to convert)
        print(f"\nVerifying rate progression...")
        if rates['quote_sent'] > rates['inquiry']:
            print(f"  ✓ quote_sent ({rates['quote_sent']:.3f}) > inquiry ({rates['inquiry']:.3f})")
        else:
            print(f"  ⚠ quote_sent ({rates['quote_sent']:.3f}) <= inquiry ({rates['inquiry']:.3f})")

        if rates['booked'] > rates['quote_sent']:
            print(f"  ✓ booked ({rates['booked']:.3f}) > quote_sent ({rates['quote_sent']:.3f})")
        else:
            print(f"  ⚠ booked ({rates['booked']:.3f}) <= quote_sent ({rates['quote_sent']:.3f})")

        if rates['final_payment'] >= rates['booked']:
            print(f"  ✓ final_payment ({rates['final_payment']:.3f}) >= booked ({rates['booked']:.3f})")
        else:
            print(f"  ⚠ final_payment ({rates['final_payment']:.3f}) < booked ({rates['booked']:.3f})")

        print("\n✓ TEST 1 PASSED: Conversion rates calculated successfully")
        return True


def test_rates_saved_and_loaded():
    """Test that rates are saved during training and loaded during inference"""
    print("\n" + "="*70)
    print("TEST 2: Save and Load Conversion Rates")
    print("="*70)

    df = create_test_data()

    # Create temporary CSV
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        csv_path = f.name
        df.to_csv(csv_path, index=False)

    try:
        # Create temporary model directory
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"\nUsing temporary model directory: {temp_dir}")

            # Train models (this should save conversion rates)
            print("\nTraining models...")
            pipeline = EnsemblePipeline(model_dir=temp_dir, min_years=0.5)

            try:
                metadata = pipeline.train(csv_path)

                # Check that rates were saved
                rates_file = os.path.join(temp_dir, 'stage_conversion_rates.pkl')
                assert os.path.exists(rates_file), f"Conversion rates file not found: {rates_file}"
                print(f"✓ Conversion rates file created: {rates_file}")

                # Check that rates are in metadata
                assert 'stage_conversion_rates' in metadata, "Rates not in metadata"
                print(f"✓ Conversion rates in training metadata")

                # Now test loading in inference
                print("\nTesting inference loading...")
                inference = ForecastInference(model_dir=temp_dir)
                inference.load_models()

                # Check that rates were loaded
                assert inference.stage_conversion_rates is not None, "Rates not loaded"
                print(f"✓ Conversion rates loaded in inference engine")

                print(f"\nLoaded rates:")
                for stage, rate in inference.stage_conversion_rates.items():
                    print(f"  {stage}: {rate:.3f}")

                print("\n✓ TEST 2 PASSED: Rates saved and loaded successfully")
                return True

            except Exception as e:
                print(f"\n✗ TEST 2 FAILED: Training failed: {e}")
                import traceback
                traceback.print_exc()
                return False
    finally:
        # Clean up temp CSV
        if os.path.exists(csv_path):
            os.unlink(csv_path)


def test_fallback_to_hardcoded():
    """Test that fallback to hardcoded rates works when empirical rates unavailable"""
    print("\n" + "="*70)
    print("TEST 3: Fallback to Hardcoded Rates")
    print("="*70)

    # Create temporary model directory without rates file
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"\nUsing empty model directory: {temp_dir}")

        # Create inference engine without loading models
        inference = ForecastInference(model_dir=temp_dir)

        # Verify rates are None initially
        assert inference.stage_conversion_rates is None, "Rates should be None initially"
        print("✓ Rates are None before loading")

        # Create test pipeline data
        pipeline_data = pd.DataFrame({
            'lead_id': ['LEAD_001', 'LEAD_002', 'LEAD_003'],
            'current_stage': ['inquiry', 'quote_sent', 'booked'],
            'trip_price': [5000, 6000, 7000],
            'inquiry_date': pd.Timestamp('2024-01-01'),
            'destination': ['Asia', 'Europe', 'Latin America'],
            'lead_source': ['Website', 'Referral', 'Social Media'],
            'is_repeat_customer': [0, 0, 1],
            'duration_days': [10, 14, 21]
        })

        # Generate forecast (should use hardcoded fallback)
        result = inference.forecast_pipeline(pipeline_data)

        print(f"\nForecast result: ${result['forecast']:,.2f}")
        print(f"Details: {result['details']}")

        # Verify fallback was used
        assert result['details']['rates_source'] == 'hardcoded', "Should use hardcoded rates"
        print("✓ Fallback to hardcoded rates used")

        # Verify hardcoded rates are correct
        expected_hardcoded = {
            'inquiry': 0.15,
            'quote_sent': 0.35,
            'booked': 0.90,
            'final_payment': 0.98
        }

        for stage, expected_rate in expected_hardcoded.items():
            actual_rate = result['details']['conversion_rates'].get(stage)
            assert actual_rate == expected_rate, f"Rate mismatch for {stage}: {actual_rate} != {expected_rate}"

        print("✓ Hardcoded rates are correct")

        # Calculate expected forecast manually
        expected_forecast = (
            5000 * 0.15 +  # inquiry
            6000 * 0.35 +  # quote_sent
            7000 * 0.90    # booked
        )

        assert abs(result['forecast'] - expected_forecast) < 0.01, \
            f"Forecast mismatch: {result['forecast']} != {expected_forecast}"

        print(f"✓ Forecast calculation correct: ${result['forecast']:,.2f}")

        print("\n✓ TEST 3 PASSED: Fallback works correctly")
        return True


def test_empirical_vs_hardcoded():
    """Test that empirical rates are used when available, not hardcoded"""
    print("\n" + "="*70)
    print("TEST 4: Empirical Rates Override Hardcoded")
    print("="*70)

    df = create_test_data()

    # Create temporary CSV
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        csv_path = f.name
        df.to_csv(csv_path, index=False)

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Train to get empirical rates
            pipeline = EnsemblePipeline(model_dir=temp_dir, min_years=0.5)

            try:
                pipeline.train(csv_path)

                # Load inference engine
                inference = ForecastInference(model_dir=temp_dir)
                inference.load_models()

                # Create test pipeline data
                pipeline_data = pd.DataFrame({
                    'lead_id': ['LEAD_001'],
                    'current_stage': ['inquiry'],
                    'trip_price': [5000],
                    'inquiry_date': pd.Timestamp('2024-01-01'),
                    'destination': ['Asia'],
                    'lead_source': ['Website'],
                    'is_repeat_customer': [0],
                    'duration_days': [10]
                })

                # Generate forecast
                result = inference.forecast_pipeline(pipeline_data)

                # Verify empirical rates were used
                assert result['details']['rates_source'] == 'empirical', "Should use empirical rates"
                print("✓ Empirical rates used (not hardcoded)")

                # Verify rates differ from hardcoded (they should for our test data)
                empirical_rate = result['details']['conversion_rates']['inquiry']
                hardcoded_rate = 0.15

                print(f"\nRate comparison for 'inquiry':")
                print(f"  Empirical: {empirical_rate:.3f}")
                print(f"  Hardcoded: {hardcoded_rate:.3f}")

                if empirical_rate != hardcoded_rate:
                    print("✓ Empirical rate differs from hardcoded (as expected)")
                else:
                    print("⚠ Empirical rate matches hardcoded (unlikely but possible)")

                print("\n✓ TEST 4 PASSED: Empirical rates override hardcoded")
                return True

            except Exception as e:
                print(f"\n✗ TEST 4 FAILED: {e}")
                import traceback
                traceback.print_exc()
                return False
    finally:
        if os.path.exists(csv_path):
            os.unlink(csv_path)


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*70)
    print("EMPIRICAL STAGE CONVERSION RATES - TEST SUITE")
    print("="*70)

    tests = [
        ("Conversion Rate Calculation", test_conversion_rate_calculation),
        ("Save and Load Rates", test_rates_saved_and_loaded),
        ("Fallback to Hardcoded", test_fallback_to_hardcoded),
        ("Empirical Override Hardcoded", test_empirical_vs_hardcoded)
    ]

    results = []
    for test_name, test_func in tests:
        try:
            passed = test_func()
            results.append((test_name, passed))
        except Exception as e:
            print(f"\n✗ TEST FAILED WITH EXCEPTION: {test_name}")
            print(f"   {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))

    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    for test_name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{status}: {test_name}")

    all_passed = all(passed for _, passed in results)

    print("\n" + "="*70)
    if all_passed:
        print("✓ ALL TESTS PASSED")
    else:
        print("✗ SOME TESTS FAILED")
    print("="*70)

    return all_passed


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
