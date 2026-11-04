# 管理后台前端（Semgravio admin-web）- 生产镜像（#94）
# 多阶段：deps 装 pnpm workspace 依赖 → builder 生产构建 → runner 只留静态产物 + nginx。
# 运行时经 BACKEND_URL（容器启动注入，后端源站口径）将 /api/admin/** 反代到 admin BFF。

# ---- deps：安装 workspace 全部依赖（含 packages/* 内部包，需其 package.json 参与解析）----
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# ---- builder：生产构建（vite build --mode prod，VITE_SERVICE_BASE_URL=/api/admin 同源口径）----
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm build

# ---- runner：nginx 静态站点 + 启动注入 BACKEND_URL ----
FROM nginx:1.27-alpine AS runner

# 静态产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 站点配置模板（__BACKEND_URL__ 占位符，启动时定点替换，不走 envsubst 避免消费 nginx 变量）。
# 故意放在官方 envsubst 扫描目录（/etc/nginx/templates/）之外，官方 20-envsubst-on-templates.sh 不会碰它。
COPY deploy/nginx/default.conf.template /etc/nginx/admin-web/default.conf.template

# 启动注入脚本（空值/占位值/带路径地址响亮失败）；nginx 官方 entrypoint 会执行 /docker-entrypoint.d/*.sh
COPY deploy/docker-entrypoint.d/30-backend-url.sh /docker-entrypoint.d/30-backend-url.sh
RUN chmod +x /docker-entrypoint.d/30-backend-url.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
