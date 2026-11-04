#!/usr/bin/env bash
# 一键发布 admin-web 到 semgravio-eu-1：远端前置检查 → 打包（记录 HEAD revision）→ 上传 →
# 服务器解包（不覆盖现网 env 与证书）→ 镜像构建启动 → 共享 nginx 配置/证书经门禁安装 → HTTPS 冒烟。
# 仓库根执行：deploy/release.sh（PowerShell 里：bash deploy/release.sh）
# 平台是 infra 的普通接入方（#93）：发布前置检查共享基础设施（semgravio-nginx 健康＋webnet 在），
# 自己的 conf 经门禁 install-nginx-conf.sh 安装（撞车即拒/语法门禁/失败回滚）；不触碰
# 基础设施的数据库/缓存/预览网络等其它职责（那些归 infra 单元管辖）。
# 任一阶段失败即非零退出；本脚本只在你显式执行时改动服务器（本票交付只做静态验证，见 deploy/validate.sh）。
#
# 可覆盖变量（默认＝法兰克福现网，沿用 aiplatform 连接参数）：
#   SERVER_HOST=3.70.172.160   SERVER_USER=ubuntu   SSH_KEY=$HOME/ssh/semgravio-eu-1.pem
#   REMOTE_DIR=semgravio-admin-web（相对服务器 $HOME；绝对路径以 / 开头也可）
#   INFRA_DIR=semgravio-infra（相对服务器 $HOME；共享 infra 单元目录，门禁脚本所在）
# 常用开关：SKIP_BUILD=1 复用 dist/ 里最新的包只发布；ALLOW_DIRTY=1 带脏打包（醒目警告，见 build-bundle.sh）。
# 服务器侧日常运维（看状态/日志/重启/冒烟）用 deploy/server.sh。
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER_HOST="${SERVER_HOST:-3.70.172.160}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-$HOME/ssh/semgravio-eu-1.pem}"
REMOTE_DIR="${REMOTE_DIR:-semgravio-admin-web}"
INFRA_DIR="${INFRA_DIR:-semgravio-infra}"
REMOTE="${SERVER_USER}@${SERVER_HOST}"

echo "== 0/6 本地前置：密钥 =="
[ -f "$SSH_KEY" ] || { echo "错误：找不到密钥 $SSH_KEY（可用 SSH_KEY=... 覆盖）"; exit 1; }

echo "== 1/6 SSH 连通 =="
ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 "$REMOTE" true

echo "== 2/6 远端前置检查（上传与构建之前；缺项即中止，不改任何服务器状态） =="
ssh -i "$SSH_KEY" -o BatchMode=yes "$REMOTE" \
  "REMOTE_DIR=$REMOTE_DIR INFRA_DIR=$INFRA_DIR bash -s" <<'REMOTE'
set -euo pipefail
if [ "${REMOTE_DIR:0:1}" = "/" ]; then APP_PATH="$REMOTE_DIR"; else APP_PATH="$HOME/$REMOTE_DIR"; fi
if [ "${INFRA_DIR:0:1}" = "/" ]; then INFRA_PATH="$INFRA_DIR"; else INFRA_PATH="$HOME/$INFRA_DIR"; fi

bad=0
# 共享 nginx 健康（唯一对外入口）
st=$(docker inspect -f '{{.State.Health.Status}}' semgravio-nginx 2>/dev/null || echo missing)
if [ "$st" != "healthy" ]; then
  echo "   ✗ 共享 nginx semgravio-nginx：$st"
  bad=1
else
  echo "   ✓ semgravio-nginx healthy"
fi
# webnet（应用容器与共享 nginx 的共联网络）
if ! docker network inspect webnet >/dev/null 2>&1; then
  echo "   ✗ 网络 webnet 缺失"
  bad=1
else
  echo "   ✓ webnet 存在"
fi
# 服务器环境值：BACKEND_URL 已填、非占位、源站口径（不带 /api/admin）
ENV_FILE="$APP_PATH/.env.production"
BACKEND_URL=""
[ -f "$ENV_FILE" ] && BACKEND_URL=$(grep -E '^BACKEND_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)
case "$BACKEND_URL" in
  ""|*BACKEND_URL*|*__*) echo "   ✗ $ENV_FILE 缺 BACKEND_URL 或仍为占位值"; bad=1 ;;
  */api/admin*)          echo "   ✗ BACKEND_URL=$BACKEND_URL 含 /api/admin——源站口径不含路径前缀"; bad=1 ;;
  http://*|https://*)    echo "   ✓ BACKEND_URL=$BACKEND_URL" ;;
  *)                    echo "   ✗ BACKEND_URL=$BACKEND_URL 不是合法 http(s) 源站地址"; bad=1 ;;
esac
# 证书与私钥（证书源目录在应用部署单元内，固定文件名）
for f in admin.semgravio.com_bundle.pem admin.semgravio.com.key; do
  if [ -f "$APP_PATH/deploy/certs/$f" ]; then
    echo "   ✓ certs/$f"
  else
    echo "   ✗ 缺证书文件 $APP_PATH/deploy/certs/$f"
    bad=1
  fi
done
# 门禁脚本在场
if [ -x "$INFRA_PATH/install-nginx-conf.sh" ]; then
  echo "   ✓ 门禁 $INFRA_PATH/install-nginx-conf.sh"
else
  echo "   ✗ 缺门禁脚本 $INFRA_PATH/install-nginx-conf.sh（infra 未起栈或路径不对）"
  bad=1
fi
[ "$bad" = 0 ] || { echo "远端前置检查未过：按上面 ✗ 补齐后重跑（nginx/webnet 先跑 infra 起栈）"; exit 1; }
REMOTE

echo "== 3/6 打包（已提交源码，记录 HEAD revision） =="
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  BUNDLE=$(ls -t dist/admin-web-deploy-*.tar.gz 2>/dev/null | head -1 || true)
  [ -n "$BUNDLE" ] || { echo "错误：dist/ 没有现成包；去掉 SKIP_BUILD 全新打包，或先跑 deploy/build-bundle.sh"; exit 1; }
  echo "复用现有包：$BUNDLE"
else
  BUNDLE=$(deploy/build-bundle.sh | tee /dev/stderr | tail -n 1)
  [ -n "$BUNDLE" ] || exit 1
fi
BASENAME=$(basename "$BUNDLE")

echo "== 4/6 上传（$(du -h "$BUNDLE" | cut -f1) → $REMOTE） =="
scp -i "$SSH_KEY" "$BUNDLE" "$REMOTE:"

echo "== 5/6 服务器：解包 → 构建启动 → 门禁安装 → 冒烟 =="
ssh -i "$SSH_KEY" -o BatchMode=yes "$REMOTE" \
  "BUNDLE_FN=$BASENAME REMOTE_DIR=$REMOTE_DIR INFRA_DIR=$INFRA_DIR bash -s" <<'REMOTE'
set -euo pipefail
if [ "${REMOTE_DIR:0:1}" = "/" ]; then cd "$REMOTE_DIR"; else cd "$HOME/$REMOTE_DIR"; fi
if [ "${INFRA_DIR:0:1}" = "/" ]; then INFRA_PATH="$INFRA_DIR"; else INFRA_PATH="$HOME/$INFRA_DIR"; fi

echo "-- 解包 $BUNDLE_FN（git archive 产物，不含 .env.production/certs——现网 env 与证书不被覆盖）"
tar -xzf "$HOME/$BUNDLE_FN" --strip-components=1
rm "$HOME/$BUNDLE_FN"
echo "   REVISION: $(cat REVISION)"
# 双保险：解包后现网输入必须仍在（前置检查已验过它们在）
for f in .env.production deploy/certs/admin.semgravio.com_bundle.pem deploy/certs/admin.semgravio.com.key; do
  [ -e "$f" ] || { echo "   ✗ 解包后 $f 丢失——立即人工排查"; exit 1; }
done

echo "-- 构建并启动（compose 显式 name/image/container_name，重复执行不误伤其他服务容器）"
docker compose -f deploy/web.compose.yml up -d --build

echo "-- 共享 nginx 配置与证书经门禁安装（撞车即拒/语法门禁/失败回滚；conf.d 挂载热更）"
"$INFRA_PATH/install-nginx-conf.sh" admin-web "$PWD/deploy/nginx/admin-web.conf" "$PWD/deploy/certs"

echo "-- 等应用就绪（经共享 nginx 探 HTTPS 首页，最长 120s）"
i=0
until [ "$(curl -sk -o /dev/null -w '%{http_code}' --resolve admin.semgravio.com:443:127.0.0.1 https://admin.semgravio.com/)" = "200" ]; do
  i=$((i+1))
  [ "$i" -ge 60 ] && { echo "应用 120s 未就绪；查日志：deploy/server.sh logs web"; exit 1; }
  sleep 2
done

echo "-- 冒烟（与 deploy/server.sh smoke 同一脚本 deploy/smoke-remote.sh；实际状态码如实输出）"
bash deploy/smoke-remote.sh
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'semgravio-admin-web|semgravio-nginx' || true
REMOTE

echo "== 完成：$BASENAME 已上线 =="
