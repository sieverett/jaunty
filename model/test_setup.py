#!/usr/bin/env python3
"""
Quick test script to verify the ensemble pipeline setup.
"""

import sys
import os

# Add parent directory to path (works from both model/ and project root)
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

def test_imports():
    """Test that all modules can be imported"""
    print("Testing imports...")
    
    try:
        from model.pipeline import EnsemblePipeline
        print("  ✓ EnsemblePipeline")
    except Exception as e:
        print(f"  ✗ EnsemblePipeline: {e}")
        return False
    
    try:
        from model.data_loader import DataLoader
        print("  ✓ DataLoader")
    except Exception as e:
        print(f"  ✗ DataLoader: {e}")
        return False
    
    try:
        from model.trainer import ModelTrainer
        print("  ✓ ModelTrainer")
    except Exception as e:
        print(f"  ✗ ModelTrainer: {e}")
        return False
    
    try:
        from model.inference import ForecastInference
        print("  ✓ ForecastInference")
    except Exception as e:
        print(f"  ✗ ForecastInference: {e}")
        return False
    
    return True

def test_dependencies():
    """Test that all dependencies are available"""
    print("\nTesting dependencies...")
    
    dependencies = {
        'pandas': 'pandas',
        'numpy': 'numpy',
        'sklearn': 'scikit-learn',
        'prophet': 'prophet',
        'xgboost': 'xgboost',
        'matplotlib': 'matplotlib',
        'seaborn': 'seaborn',
    }
    
    all_ok = True
    for module_name, package_name in dependencies.items():
        try:
            __import__(module_name)
            print(f"  ✓ {package_name}")
        except ImportError as e:
            print(f"  ✗ {package_name}: {e}")
            all_ok = False
    
    return all_ok

def test_pipeline_initialization():
    """Test that pipeline can be initialized"""
    print("\nTesting pipeline initialization...")
    
    try:
        from model.pipeline import EnsemblePipeline
        pipeline = EnsemblePipeline(model_dir="model/artifacts", min_years=1.0)
        print("  ✓ Pipeline initialized successfully")
        return True
    except Exception as e:
        print(f"  ✗ Pipeline initialization failed: {e}")
        return False

if __name__ == "__main__":
    print("="*70)
    print("ENSEMBLE PIPELINE SETUP TEST")
    print("="*70)
    
    all_tests_passed = True
    
    # Test imports
    if not test_imports():
        all_tests_passed = False
    
    # Test dependencies
    if not test_dependencies():
        all_tests_passed = False
    
    # Test pipeline initialization
    if not test_pipeline_initialization():
        all_tests_passed = False
    
    print("\n" + "="*70)
    if all_tests_passed:
        print("✓ ALL TESTS PASSED - Setup is complete!")
        print("\nNext steps:")
        print("  1. Run the Jupyter notebook: jupyter notebook test_forecast.ipynb")
        print("  2. Or use the pipeline: from model.pipeline import EnsemblePipeline")
    else:
        print("✗ SOME TESTS FAILED - Please check the errors above")
    print("="*70)
    
    sys.exit(0 if all_tests_passed else 1)

