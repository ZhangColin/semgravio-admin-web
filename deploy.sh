#!/usr/bin/env bash
# 服务器运维小工具（semgravio-eu-1；连接参数与 publish.sh 同套默认，可同法覆盖；
# 本脚本只在本地拼命令，docker 一律在服务器侧执行）：
#   ./deploy.sh status   容器概览（semgravio-admin-web ＋ semgravio-nginx）
#   ./deploy.sh logs     跟应用容器日志（semgravio-admin-web）
#   ./deploy.sh restart  重启应用容器（不重建镜像、不动共享 nginx 配置，秒级；
#                        nginx 配置/证书更新统一走 publish.sh 发布门禁）
#   ./deploy.sh smoke    HTTPS 冒烟（HTTP→HTTPS 跳转 / HTTPS 首页 200 / 未登录当前用户 401；
#                        与 publish.sh 同一脚本 deploy/smoke-remote.sh，断言只维护一份）
#   ./deploy.sh sh       登服务器交互 shell
# 未知子命令打印本用法并以 64 退出；help/无参打印用法并以 0 退出。
# 换版上线（打包＋上传＋构建＋门禁安装）不是这里，用 ./publish.sh。
set -euo pipefail
cd "$(dirname "$0")"

SERVER_HOST="${SERVER_HOST:-3.70.172.160}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-$HOME/ssh/semgravio-eu-1.pem}"
REMOTE="${SERVER_USER}@${SERVER_HOST}"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes "$REMOTE")

case "${1:-help}" in
  status)
    "${SSH[@]}" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'semgravio-admin-web|semgravio-nginx' || true"
    ;;
  logs)
    exec "${SSH[@]}" "docker logs -f --tail 200 semgravio-admin-web"
    ;;
  restart)
    "${SSH[@]}" 'docker restart semgravio-admin-web >/dev/null && echo 已重启 semgravio-admin-web（nginx 配置热更走 publish.sh 门禁，无须重启）'
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
