# Docker 部署指南

本项目使用 [Bun 官方 Docker 镜像](https://hub.docker.com/r/oven/bun) 作为基础镜像。

## 构建镜像

```bash
docker build -t nostreaming:latest .
```

## 运行容器

### 方式 1: 使用 Docker Compose（推荐）

```bash
# 确保 config.toml 文件存在
cp config.toml.example config.toml
# 编辑 config.toml 配置你的设置

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 方式 2: 直接使用 Docker

```bash
# 运行容器，挂载配置文件
docker run -d \
  --name nostreaming \
  -p 3000:3000 \
  -v $(pwd)/config.toml:/app/config.toml:ro \
  nostreaming:latest
```

## 配置说明

- **配置文件**: `config.toml` 需要通过 volume 挂载到容器的 `/app/config.toml`
- **端口**: 默认暴露 3000 端口，可在 `config.toml` 中修改
- **健康检查**: 容器包含健康检查，每 30 秒检查一次

## 环境变量

可以通过环境变量覆盖配置（如果应用支持）：

```bash
docker run -d \
  --name nostreaming \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -v $(pwd)/config.toml:/app/config.toml:ro \
  nostreaming:latest
```

## 多阶段构建

Dockerfile 使用多阶段构建优化镜像大小：

1. **base**: Bun 基础镜像
2. **deps**: 安装所有依赖（包括开发依赖）
3. **build**: 构建阶段（可选）
4. **release**: 最终生产镜像，只包含生产依赖

## 安全特性

- 使用非 root 用户 (`appuser`) 运行应用
- 配置文件以只读模式挂载
- 最小化镜像体积

## 故障排查

### 查看容器日志

```bash
docker logs nostreaming
docker logs -f nostreaming  # 实时查看
```

### 进入容器调试

```bash
docker exec -it nostreaming /bin/sh
```

### 检查健康状态

```bash
docker ps  # 查看容器状态
docker inspect nostreaming | grep Health -A 10
```
