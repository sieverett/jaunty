# Environment Setup Guide

This guide will help you set up a virtual environment and install all dependencies for the ensemble revenue forecasting pipeline.

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

## Quick Setup

### Option 1: Using the Setup Script (macOS/Linux)

```bash
cd model
chmod +x setup_env.sh
./setup_env.sh
```

### Option 2: Manual Setup

#### 1. Create Virtual Environment

**macOS/Linux:**
```bash
cd model
python3 -m venv venv
```

**Windows:**
```bash
cd model
python -m venv venv
```

#### 2. Activate Virtual Environment

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

#### 3. Upgrade pip

```bash
pip install --upgrade pip
```

#### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

## Verifying Installation

After installation, verify that packages are installed:

```bash
python -c "import pandas, numpy, sklearn; print('Core packages installed successfully')"
python -c "import prophet; print('Prophet installed successfully')"  # Optional
python -c "import xgboost; print('XGBoost installed successfully')"  # Optional
```

## Using the Virtual Environment

### Activate (when starting work)
```bash
# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### Deactivate (when done)
```bash
deactivate
```

## Running Jupyter Notebook

If you want to use Jupyter notebooks (like `test_forecast.ipynb`):

```bash
# Make sure virtual environment is activated
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate  # Windows

# Install jupyter kernel for this environment
python -m ipykernel install --user --name=jaunty-model --display-name "Python (jaunty-model)"

# Start Jupyter
jupyter notebook
```

## Troubleshooting

### Prophet Installation Issues

Prophet requires some system dependencies. If installation fails:

**macOS:**
```bash
brew install pkg-config
pip install prophet
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install pkg-config
pip install prophet
```

**Windows:**
Prophet installation on Windows can be tricky. Consider using WSL or conda:
```bash
conda install -c conda-forge prophet
```

### XGBoost Installation Issues

**macOS users:** XGBoost requires OpenMP runtime. Install it first:
```bash
brew install libomp
```

Then set the library path (add to your shell profile for persistence):
```bash
export DYLD_LIBRARY_PATH=/opt/homebrew/opt/libomp/lib:$DYLD_LIBRARY_PATH
```

If XGBoost still fails to install, try:
```bash
pip install --upgrade pip setuptools wheel
pip install xgboost
```

## Requirements File Details

The `requirements.txt` includes:

- **Core**: pandas, numpy, scikit-learn (required)
- **Prophet**: Time series forecasting (optional but recommended)
- **XGBoost**: Machine learning (optional but recommended)
- **Visualization**: matplotlib, seaborn (for notebooks)
- **Jupyter**: For running notebooks

Note: The pipeline will work without Prophet and XGBoost, but will only use the pipeline-based (rule-based) forecasting method.

