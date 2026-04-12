# Running AgriPulse Locally

This guide explains how to start the AgriPulse application in its real-data-first forecasting mode.

## Recommended Method: Using Docker

The project is already configured with Docker Compose, which is the easiest and most reliable way to run all services (Database, Model Service, Backend, and Frontend) simultaneously with a single command.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Steps
1.  **Open a terminal** in the project root directory.
2.  **Start all services**:
    ```powershell
    docker compose up --build
    ```
3.  **Access the application**:
    - Frontend: `http://localhost:5173`
    - Backend API: `http://localhost:8000`
    - Model Service: `http://localhost:8001`

### Real-data workflow
The application no longer auto-seeds demo mandi data on startup.

1. Official OGD mandi feeds now work automatically:
   - `npm run fetch:official` resolves the official `data.gov.in` resource metadata, paginates the live API, and saves local CSV files for import.
   - For the very large variety-wise historical feed, you can optionally cap the initial download size:
     ```powershell
     $env:OGD_VARIETY_MAX_RECORDS="50000"
     ```
   - Leave `OGD_VARIETY_MAX_RECORDS` unset if you want to fetch the full history.

2. Configure `backend/data/sourceManifest.local.json` only if you want to add extra public staging or weather CSV/ZIP sources:
   - Copy `backend/data/sourceManifest.local.example.json` to `backend/data/sourceManifest.local.json`
   - Replace the sample `downloadUrl` values with real allowlisted public links

3. Fetch configured source files:
   ```powershell
   cd backend
   npm run fetch:all
   ```

4. Import downloaded files into certified/staging collections:
   ```powershell
   npm run import:downloads
   ```

5. Promote approved staging rows into the certified serving/training collections:
   ```powershell
   npm run certify:data
   ```

6. Backfill historical weather for imported markets:
   ```powershell
   npm run backfill:weather
   ```

7. You can still import local mandi CSV files into MongoDB directly:
   ```powershell
   npm run import:csv -- C:\path\to\file1.csv C:\path\to\file2.csv
   ```

8. Train comparison models after import/certification:
   ```powershell
   cd ..\model_service
   python train_models.py
   ```
9. Open the frontend and run forecasts from the imported states, districts, commodities, and mandis.

### Optional demo seed
If you need a controlled demo dataset, run:
```powershell
cd backend
npm run seed:demo
```

If you are using Docker only and want demo options to appear immediately, run:
```powershell
docker compose exec backend npm run seed:demo
```

If the state dropdown shows no options, that means MongoDB currently has no imported/demo mandi data yet.

---

## Manual Method (Without Docker)

If you prefer to run the services individually without Docker, you will need to start each one separately.

### 1. Database (MongoDB)
Ensure you have MongoDB installed and running on your system (default port `27017`).
- If you don't have MongoDB installed, you can use the MongoDB Atlas cloud service.

### 2. Model Service (Python)
1.  Navigate to the `model_service` folder.
2.  Create and activate a virtual environment:
    ```powershell
    python -m venv venv
    .\venv\Scripts\activate
    ```
3.  Install dependencies:
    ```powershell
    pip install -r requirements.txt
    ```
4.  Run the service:
    ```powershell
    python main.py
    ```

### 3. Backend (Node.js)
1.  Navigate to the `backend` folder.
2.  Install dependencies:
    ```powershell
    npm install
    ```
3.  Start the backend:
    ```powershell
    npm start
    ```

### 4. Frontend (Vite/React)
1.  Navigate to the `frontend` folder.
2.  Install dependencies:
    ```powershell
    npm install
    ```
3.  Start the development server:
    ```powershell
    npm run dev
    ```
4.  Open your browser at `http://localhost:5173`.

> [!TIP]
> Always ensure the **MongoDB** and **Model Service** are running before starting the **Backend**, as the backend depends on them to function correctly.
