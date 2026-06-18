# Tournament Prediction Platform

Full-stack scaffold for a tournament prediction system built with:

- Vite + TypeScript + React
- Ant Design + Bootstrap
- Node.js + Express
- MongoDB via Mongoose, with a memory fallback when `MONGODB_URI` is not set

## What is included

- Homepage with a month calendar and "matches today" section
- Dashboard with score summary, score ledger, and match management table
- Prediction drawer for entering score guesses
- Manual result entry on the dashboard with automatic point calculation
- Read-only prediction mode after all 104 matches have predictions

## Scoring rules

- Group stage: trend +1, exact score +2
- Round of 32 and Round of 16: trend +2, exact score +4
- Quarterfinals and semifinals: trend +3, exact score +6
- Final: trend +4, exact score +8
- Third-place match uses the semifinal scoring tier in this scaffold

## Run locally

1. Install dependencies:
   - `npm install`
2. Start both apps:
   - `npm run dev`
3. Frontend:
   - `http://localhost:5173`
4. Backend:
   - `http://localhost:4000`

## MongoDB

Set `MONGODB_URI` in an `.env` file if you want persistence:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/tournament
PORT=4000
```

If MongoDB is unavailable, the backend falls back to in-memory storage so the app still runs.

