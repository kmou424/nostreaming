# nostreaming

一个通用的 LLM API 反向代理工具，支持多个上游提供商，提供 OpenAI 兼容的接口，并实现伪流式，让你闲置的第三方转发 API 也能利用起来。

## 功能特性

- 🔄 **多提供商支持**: 支持 OpenAI 等(咕咕咕)上游 LLM 提供商
- 🔌 **OpenAI 兼容接口**: 提供标准的 OpenAI API 接口，无需修改客户端代码
- 📡 **Fake-Streaming**: 实现伪流式传输，客户端通过 SSE 连接，后端发送非流式请求到上游
- 🔐 **API 密钥认证**: 支持 Bearer token 认证
- 🎯 **模型过滤**: 支持白名单/黑名单模式过滤模型
- 🐳 **Docker 支持**: 提供完整的 Docker 部署方案
- 📊 **结构化日志**: 基于配置的日志级别和结构化输出

## 快速开始

### 前置要求

- [Bun](https://bun.sh) >= 1.0.0

### 本地运行

1. **安装依赖**

```bash
bun install
```

2. **配置应用**

```bash
cp config.toml.example config.toml
# 编辑 config.toml 配置你的提供商信息
```

3. **启动服务**

```bash
bun run src/index.ts
```

服务将在 `http://localhost:3000` 启动。

## 配置说明

配置文件使用 TOML 格式，主要配置项：

```toml
[app]
host = "0.0.0.0"
port = 3000
keys = ["sk-XXXXX"]  # API 密钥列表，用于认证
fakeStreamInterval = 500  # fake-streaming 保持连接间隔（毫秒）

[logging]
level = "info"  # debug, info, warn, error

[providers.my-openai]
enabled = true
type = "openai"
endpoint = "https://api.openai.com/v1"
api_key = "sk-proj-1234567890"

[providers.my-openai.filter]
mode = "whitelist"  # whitelist 或 blacklist
models = ["gpt-4o", "gpt-4o-mini"]
```

详细配置说明请参考 `config.toml.example`。

## 部署方式

### Docker 部署（推荐）

#### 使用 Docker Compose

```bash
# 准备配置文件
cp config.toml.example config.toml
# 编辑 config.toml

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 使用 Docker

```bash
# 构建镜像
docker build -t nostreaming:latest .

# 运行容器
docker run -d \
  --name nostreaming \
  -p 3000:3000 \
  -v $(pwd)/config.toml:/app/config.toml:ro \
  nostreaming:latest
```

详细的 Docker 部署指南请参考 [README.docker.md](./README.docker.md)。

### 本地部署

```bash
# 安装依赖
bun install

# 配置应用
cp config.toml.example config.toml
# 编辑 config.toml

# 启动服务
bun run src/index.ts
```

## API 使用

### 健康检查

```bash
curl http://localhost:3000/health
```

### 获取模型列表

```bash
curl -H "Authorization: Bearer sk-XXXXX" \
  http://localhost:3000/v1/models
```

### 聊天补全

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-XXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### 流式请求

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-XXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

## 模型命名规则

模型名称格式：`{provider_name}/{model_id}`

例如：

- `my-openai/gpt-4o` - 使用 `my-openai` 提供商的 `gpt-4o` 模型
- `my-openai/gpt-4o-mini` - 使用 `my-openai` 提供商的 `gpt-4o-mini` 模型

## 技术栈

- **Runtime**: Bun
- **HTTP Framework**: Elysia
- **配置**: TOML
- **HTTP Client**: Axios
- **验证**: Zod

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
