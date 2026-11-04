#!/usr/bin/env bash
# 服务器运维小工具（semgravio-eu-1；连接参数与 deploy/release.sh 同套默认，可同法覆盖；
# 本脚本只在本地拼命令，docker 一律在服务器侧执行）：
#   deploy/server.sh status     容器概览（semgravio-admin-web ＋ semgravio-nginx）
#   deploy/server.sh logs web   跟应用容器日志（semgravio-admin-web；logs 单写也可）
#   deploy/server.sh restart    重启应用容器（不重建镜像、不动共享 nginx 配置，秒级；
#                               nginx 配置/证书更新统一走 deploy/release.sh 发布门禁）
#   deploy/server.sh smoke      HTTPS 冒烟（HTTP→HTTPS / 首页 200 / 未登录当前用户 401；
#                               与发布同一脚本 deploy/smoke-remote.sh）
#   deploy/server.sh sh         登服务器交互 shell
# 未知子命令打印本用法并以 64 退出；help/无参打印用法并以 0 退出。
# 换版上线（打包＋上传＋构建＋门禁安装）不是这里，用 deploy/release.sh。
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER_HOST="${SERVER_HOST:-3.70.172.160}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-$HOME/ssh/semgravio-eu-1.pem}"
REMOTE="${SERVER_USER}@${SERVER_HOST}"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes "$REMOTE")

if [ "${1:-}" = logs ] && { [ $# -gt 2 ] || { [ $# -eq 2 ] && [ "$2" != web ]; }; }; then
  echo "用法：deploy/server.sh logs [web]（退出码 64）" >&2
  exit 64
fi

case "${1:-help}" in
  status)
    "${SSH[@]}" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'semgravio-admin-web|semgravio-nginx' || true"
    ;;
  logs)
    exec "${SSH[@]}" "docker logs -f --tail 200 semgravio-admin-web"
    ;;
  restart)
    "${SSH[@]}" 'docker restart semgravio-admin-web >/dev/null && echo 已重启 semgravio-admin-web（nginx 配置热更走 deploy/release.sh 门禁，无须重启）'
    ;;
  smoke)
    "${SSH[@]}" 'bash -s' < deploy/smoke-remote.sh
    ;;
  sh)
    exec "${SSH[@]}"
    ;;
  help)
    grep '^# ' "$0" | tail -n +2
    ;;
  *)
    grep '^# ' "$0" | tail -n +2 >&2
    echo "未知子命令：${1:-}（退出码 64）" >&2
    exit 64
    ;;
esac
