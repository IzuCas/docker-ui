# Docker Manager

Uma aplicação completa para gerenciamento de Docker com interface web moderna e opção de app desktop Electron.

## Características

- 🐳 Gerenciamento completo de containers, imagens, volumes e redes
- 🖥️ Interface web React moderna com Tailwind CSS
- 🔧 API REST em Go com documentação OpenAPI
- 💻 App desktop Electron (opcional)
- 🐋 Deploy via Docker Compose ou execução local

## Modos de Execução

### 1. Docker Compose (Recomendado para produção)

```bash
# Iniciar todos os serviços
docker compose up -d

# Frontend: http://localhost:3000
# API: http://localhost:8001
```

### 2. Desenvolvimento Local (Sem Docker)

```bash
# Usando o script de desenvolvimento
./run.sh dev

# Ou usando Make
make dev

# Ou manualmente:
# Terminal 1 - API
cd api && go run ./cmd/api

# Terminal 2 - Frontend
cd app && npm run dev
```

### 3. App Desktop Electron

```bash
# Desenvolvimento
cd app
npm install
npm run dev:electron

# Build para distribuição
make electron
# ou
cd app && npm run electron:build
```

## Pré-requisitos

### Para Docker Compose
- Docker e Docker Compose

### Para Desenvolvimento Local
- Go 1.24+
- Node.js 18+
- npm
- Docker (para a API gerenciar containers)

### Para Electron
- Todos os requisitos de desenvolvimento local
- Dependências do Electron Builder para sua plataforma

## Estrutura do Projeto

```
├── api/                    # Backend Go
│   ├── cmd/api/           # Ponto de entrada
│   └── internal/          # Lógica da aplicação (Clean Architecture)
├── app/                    # Frontend React
│   ├── src/               # Código fonte React
│   └── electron/          # Código Electron
├── docker-compose.yml      # Configuração Docker
├── Makefile               # Comandos de build
└── run.sh                 # Script de desenvolvimento
```

## Comandos Disponíveis

### Makefile

```bash
make help           # Mostrar ajuda
make dev            # Rodar API + Frontend (desenvolvimento)
make api            # Rodar apenas a API
make app            # Rodar apenas o frontend
make electron-dev   # Rodar app Electron em desenvolvimento
make electron       # Build do app Electron
make docker-up      # Iniciar com Docker Compose
make docker-down    # Parar Docker Compose
make clean          # Limpar artefatos de build
```

### Script run.sh

```bash
./run.sh help       # Mostrar ajuda
./run.sh dev        # Rodar API + Frontend
./run.sh api        # Rodar apenas a API
./run.sh app        # Rodar apenas o frontend
./run.sh electron   # Rodar app Electron
./run.sh build      # Build para produção
```

## Configuração

### Variáveis de Ambiente

#### API
- `PORT`: Porta da API (padrão: 8001)
- `DOCKER_HOST`: Socket do Docker (padrão: unix:///var/run/docker.sock)

#### Frontend
- `VITE_API_URL`: URL da API (padrão: /api com proxy)

## Permissões do Docker

Para executar localmente, seu usuário precisa ter acesso ao Docker:

```bash
sudo usermod -aG docker $USER
newgrp docker  # ou faça logout/login
```

## Licença

MIT
