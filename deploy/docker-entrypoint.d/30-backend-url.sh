#!/bin/sh
# 30-backend-url.sh —— #94：容器启动时把 BACKEND_URL（后端源站，如 http://semgravio-admin:8081）
# 注入 nginx 站点配置。只定点替换 __BACKEND_URL__ 占位符，不消费 nginx 自身变量
# （故不使用 envsubst 全量模板机制）。
# 空值 / 占位值 / 带路径的地址一律响亮失败（非零退出，容器直接起不来）。
set -eu

TEMPLATE="/etc/nginx/admin-web/default.conf.template"
TARGET="/etc/nginx/conf.d/default.conf"

fail() {
  echo "[admin-web] FATAL: $1" >&2
  exit 1
}

# 1. 空值响亮失败
[ -n "${BACKEND_URL:-}" ] || fail "BACKEND_URL 不能为空（也未设置）。请在服务器环境填入 admin 后端源站地址（源站口径，如 http://semgravio-admin:8081，不含 /api/admin），参考 .env.production.example。"

# 2. 口径校验：必须是 http(s)://主机[:端口]，不允许携带任何路径（尤其 /api/admin 前缀——
#    前缀由本容器 nginx 保留转发，重复拼接会导致 404）
case "$BACKEND_URL" in
  *__BACKEND_URL__*) fail "BACKEND_URL 仍是占位值（$BACKEND_URL），请填入真实后端源站地址。" ;;
esac
case "$BACKEND_URL" in
  http://*/*|https://*/*) fail "BACKEND_URL 必须是后端源站口径（http(s)://主机[:端口]），不能含路径：$BACKEND_URL" ;;
  http://*|https://*) : ;;
  *) fail "BACKEND_URL 必须是 http(s):// 开头的源站地址：$BACKEND_URL" ;;
esac

[ -f "$TEMPLATE" ] || fail "nginx 配置模板缺失：$TEMPLATE"

# 3. 定点替换占位符（| 分隔避免与地址中的转义冲突；不触碰 $uri 等 nginx 变量）
sed "s|__BACKEND_URL__|${BACKEND_URL%/}|g" "$TEMPLATE" > "$TARGET"

echo "[admin-web] BACKEND_URL=${BACKEND_URL%/} 已注入 nginx 站点配置（/api/admin/** 反代到该源站）。"
