# keepup
Conducts the CDC STEADI 30-second chair stand test in the browser and analyzes results.

Pose detection runs on-device with MediaPipe Pose Landmarker; video never leaves the browser.

## Run locally

Backend (FastAPI, Python 3.12):

```sh
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Frontend (React + Vite):

```sh
cd frontend
npm install
npm run dev   # http://localhost:5173, proxies /api to :8000
```

Set `JWT_SECRET` in `backend/.env` for anything beyond local development.

## Tests

```sh
cd backend && .venv/bin/python -m pytest
cd frontend && npm test
```
