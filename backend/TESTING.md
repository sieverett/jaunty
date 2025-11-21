# Testing Guide

This guide explains how to test the API endpoints using Swagger UI.

## Accessing Swagger UI

1. Start the backend server:
   ```bash
   cd jaunty/backend
   uvicorn main:app --reload
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8000/docs
   ```

## Testing File Upload Endpoint (`/upload`)

### Step-by-Step Instructions

1. **Locate the endpoint**
   - Scroll down to find the `POST /upload` endpoint
   - Or use Ctrl+F (Cmd+F on Mac) to search for "upload"

2. **Expand the endpoint**
   - Click on `POST /upload` to expand it
   - You'll see the endpoint description and parameters

3. **Click "Try it out"**
   - This enables interactive testing mode
   - The parameters section becomes editable

4. **Upload a file**
   - Find the `file` parameter (it will show as a file input)
   - Click "Choose File" or "Browse" button
   - Navigate to and select a CSV file (e.g., `../../data/test_data.csv`)
   - The file name will appear next to the button

5. **Execute the request**
   - Click the blue "Execute" button at the bottom
   - Wait for the response (usually takes 1-2 seconds)

6. **View the response**
   - Scroll down to see the response
   - **Server response** section shows:
     - Status code (200 for success)
     - Response body with file details
     - Response headers

### Example Response

```json
{
  "status": "success",
  "message": "File uploaded successfully",
  "filename": "20241120_211500_test_data.csv",
  "file_path": "/path/to/JAUNTY/tmp/20241120_211500_test_data.csv",
  "file_size": 44831,
  "uploaded_at": "2024-11-20T21:15:00.123456",
  "files_deleted": null,
  "total_files": 1
}
```

### Troubleshooting

**File not uploading:**
- Make sure the file is a `.csv` file
- Check that the file is not empty
- Verify the file path is correct

**"Failed to fetch" error:**
- Ensure the backend server is running
- Check that you're accessing `http://localhost:8000/docs`
- Try refreshing the page

**File size issues:**
- Very large files (>100MB) may take longer to upload
- Check server logs for any errors

## Testing Other Endpoints

### `/forecast` Endpoint

1. Expand `POST /forecast`
2. Click "Try it out"
3. Upload a CSV file in the `file` parameter
4. Optionally set:
   - `forecast_date`: Date in YYYY-MM-DD format (or leave empty)
   - `train_models`: Set to `true` or `false` (default: false)
5. Click "Execute"

### `/train` Endpoint

1. Expand `POST /train`
2. Click "Try it out"
3. Upload a CSV file in the `file` parameter
4. Click "Execute"
5. Wait for training to complete (may take several minutes)

### `/report` Endpoint

1. Expand `POST /report`
2. Click "Try it out"
3. Upload a CSV file in the `file` parameter
4. Optionally set:
   - `forecast_date`: Date in YYYY-MM-DD format
   - `train_models`: Set to `true` or `false`
5. Click "Execute"
6. Note: Requires Azure OpenAI configuration

## Tips

- **Copy response**: Click the response body to select and copy it
- **Download response**: Some browsers allow downloading the JSON response
- **View curl command**: Swagger shows the equivalent curl command at the bottom
- **Schema**: Click "Schema" to see the expected request/response structure
- **Reset**: Click "Cancel" to exit "Try it out" mode

## Alternative: Using cURL

Swagger UI shows the equivalent cURL command at the bottom of each request. You can copy and run it in your terminal:

```bash
curl -X 'POST' \
  'http://localhost:8000/upload' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/path/to/your/file.csv'
```

