#!/bin/bash
# Script to generate multiple varied test datasets for robustness testing

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Create data directory if it doesn't exist
mkdir -p ../data

echo "Generating multiple test datasets for robustness testing..."
echo "=========================================================="

# Generate 3 different datasets
for i in 1 2 3; do
    echo ""
    echo "Generating dataset $i..."
    python generate_test_data.py "test_run_${i}.csv"
done

echo ""
echo "=========================================================="
echo "✓ Generated 3 datasets:"
echo "  - data/test_run_1.csv"
echo "  - data/test_run_2.csv"
echo "  - data/test_run_3.csv"
echo ""
echo "You can now test your models on these varied datasets!"

