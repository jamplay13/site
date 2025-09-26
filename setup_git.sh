#!/bin/bash
git init
git add .
git commit -m "Projeto completo: Cassino Sandbox (frontend Tailwind + backend Node)"
git branch -M main
git remote add origin <URL_DO_SEU_REPO>
git push -u origin main
echo "✅ Git configurado! Substitua <URL_DO_SEU_REPO> pelo seu repositório GitHub antes de rodar."
