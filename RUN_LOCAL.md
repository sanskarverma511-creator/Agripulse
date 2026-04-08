# Running AgriPulse Locally

This guide explains how to start the AgriPulse (formerly Agricultural-Price-Prediction-System) application on your local machine.

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
