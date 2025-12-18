# SAGA Store Python Backend

This branch contains a Python backend implementation designed to integrate with your company's LIMS system.

## Architecture

```
React Frontend (main branch) → Python Backend (FastAPI) → Supabase Database
                                        ↓ ↑
                                Company LIMS System
```

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in the `backend/` directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LIMS Integration (configure based on your system)
LIMS_API_URL=https://your-lims-api.com
LIMS_API_KEY=your_lims_api_key
```

### 3. Run the Server

```bash
# Development
cd backend
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API documentation (Swagger UI): `http://localhost:8000/docs`

## API Endpoints

### Samples
- `GET /api/samples` - List samples with pagination
- `GET /api/samples/{sample_id}` - Get specific sample
- `POST /api/samples/checkout` - Checkout multiple samples

### Containers
- `GET /api/containers` - List containers with sample counts

### Audit
- `GET /api/audit` - Get audit logs

### LIMS Integration
- `POST /api/lims/sync` - Sync data with LIMS (customize for your system)
- `POST /api/lims/export-sample/{sample_id}` - Export sample to LIMS

## LIMS Integration

The `main.py` file includes placeholder endpoints for LIMS integration:

1. **Sync Endpoint** (`/api/lims/sync`): Bidirectional sync between SAGA and LIMS
2. **Export Endpoint** (`/api/lims/export-sample`): Push samples to LIMS

### Customization for Your LIMS

1. Install your LIMS Python client library:
   ```bash
   pip install your-lims-client
   ```

2. Add it to `requirements.txt`

3. Implement the LIMS client in `main.py`:
   ```python
   from your_lims_client import LIMSClient
   
   lims = LIMSClient(api_url=LIMS_API_URL, api_key=LIMS_API_KEY)
   ```

4. Customize the sync logic based on your LIMS API

## Frontend Integration

Update your React app to use the Python backend:

```typescript
// src/lib/api.ts
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:8000'

export async function fetchSamples() {
  const response = await fetch(`${API_BASE_URL}/api/samples`)
  return response.json()
}
```

## Deployment

### Option 1: Railway
```bash
railway init
railway up
```

### Option 2: Render
Create `render.yaml`:
```yaml
services:
  - type: web
    name: saga-store-api
    env: python
    buildCommand: pip install -r backend/requirements.txt
    startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

### Option 3: Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Development Workflow

1. Keep `main` branch for current TypeScript implementation
2. Use `python-backend` branch for Python backend development
3. Merge Python backend when ready for production
4. Both can coexist - choose which backend to use via environment variables

## Next Steps

1. [ ] Customize LIMS integration endpoints
2. [ ] Add authentication middleware
3. [ ] Implement batch operations for LIMS sync
4. [ ] Add webhooks for real-time LIMS updates
5. [ ] Create Python scripts for data migration
6. [ ] Add comprehensive error handling and logging
7. [ ] Write integration tests
