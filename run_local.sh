#!/bin/bash
cd backend
npm install
npm run dev &
BACKEND_PID=$!
cd ..
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..
echo "✅ Backend e frontend rodando localmente."
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:4000"
trap "echo '🛑 Parando servidores...'; kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT
wait
