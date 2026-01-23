// Script para fazer push automático via GitHub API
// Execute: node scripts/auto-push.js

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'PainelEMSERH/EMSERH';
const BRANCH = 'main';
const PROJECT_DIR = __dirname.replace('\\scripts', '');

// Você precisa configurar um Personal Access Token do GitHub
// Vá em: https://github.com/settings/tokens
// Crie um token com permissão 'repo'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

if (!GITHUB_TOKEN) {
  console.log('⚠️  GITHUB_TOKEN não configurado.');
  console.log('📝 Configure: export GITHUB_TOKEN=seu_token_aqui');
  console.log('🔗 Ou crie em: https://github.com/settings/tokens');
  process.exit(1);
}

function gitCommand(cmd) {
  try {
    return execSync(`git ${cmd}`, { 
      cwd: PROJECT_DIR, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (error) {
    return null;
  }
}

function autoPush() {
  console.log('🔄 Verificando mudanças...');
  
  const status = gitCommand('status --short');
  if (!status || !status.trim()) {
    console.log('✅ Nenhuma mudança pendente.');
    return;
  }
  
  console.log('📝 Mudanças detectadas!');
  console.log(status);
  
  // Adiciona e commita
  gitCommand('add -A');
  gitCommand('commit -m "feat: atualizações automáticas"');
  
  // Push via Git (mais simples que API)
  console.log('🚀 Fazendo push...');
  const pushResult = gitCommand('push origin main');
  
  if (pushResult) {
    console.log('✅ Push concluído!');
  } else {
    console.log('❌ Erro no push. Verifique suas credenciais Git.');
  }
}

autoPush();
