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

## Build do App Electron (Passo a Passo)

O app Electron inclui a API Go embutida, permitindo execução standalone sem Docker.

### 1. Compilar o binário da API

```bash
cd api
go build -o bin/api ./cmd/api
```

### 2. Instalar dependências do frontend

```bash
cd app
npm install
```

### 3. Gerar o pacote de distribuição

```bash
# Linux (gera .deb e AppImage)
npm run electron:build

# Apenas Linux
npm run electron:build:linux

# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac
```

### 4. Instalar o pacote gerado

```bash
# Debian/Ubuntu (.deb)
sudo dpkg -i app/release/docker-management-ui_1.0.0_amd64.deb

# Ou usar AppImage diretamente
chmod +x "app/release/Docker Manager-1.0.0.AppImage"
./app/release/Docker\ Manager-1.0.0.AppImage
```

### Arquivos gerados

Após o build, os pacotes ficam em `app/release/`:

| Arquivo | Plataforma | Descrição |
|---------|------------|-----------|
| `docker-management-ui_1.0.0_amd64.deb` | Linux | Pacote Debian/Ubuntu |
| `Docker Manager-1.0.0.AppImage` | Linux | Executável portátil |
| `Docker Manager Setup 1.0.0.exe` | Windows | Instalador NSIS |
| `Docker Manager-1.0.0.dmg` | macOS | Instalador DMG |

### Personalização do ícone

Coloque os ícones na pasta `app/build/`:

- `icon.png` - Linux (mínimo 256x256, recomendado 512x512)
- `icon.ico` - Windows (256x256)
- `icon.icns` - macOS (512x512 ou 1024x1024)

```bash
# Converter PNG para ICO (requer ImageMagick)
convert icon.png -resize 256x256 icon.ico
```

### Como funciona a API embutida

O app Electron verifica automaticamente:

1. Se já existe uma API rodando na porta 8001 (ex: via Docker) → usa ela
2. Se não → inicia o binário embutido em `/opt/Docker Manager/resources/api/api`

Isso permite usar o app tanto com Docker quanto standalone.

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
