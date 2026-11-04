#!/usr/bin/env bash
# 外部冒烟断言（#96，单一事实源）：HTTP→HTTPS 跳转 / HTTPS 首页 200 / 未登录当前用户 401。
# 消费方两处——运维入口 `./deploy.sh smoke`（ssh 'bash -s' < 本脚本）与一键发布
# `publish.sh` 阶段 5（解包后的部署单元内 `bash deploy/smoke-remote.sh`）——同一组断言，
# 改断言只改这里。
# 判定面 = 共享 nginx 的公网入口行为：Host/SNI 都用真实域名、--resolve 指到 127.0.0.1
# （真实 TLS 握手，不依赖「admin-web 是唯一 listen 443 的 server 块」的隐式兜底）。
# 实际状态码如实输出；任一断言不过即非零退出。
set -uo pipefail

DOMAIN="admin.semgravio.com"
fail=0

http_code=$(curl -s -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/")
http_loc=$(curl -s -o /dev/null -w '%{redirect_url}' --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/")
if [ "$http_code" = "301" ] && [[ "$http_loc" == https://$DOMAIN/* ]]; then
  echo "   ✓ HTTP→HTTPS 跳转：$http_code → $http_loc"
else
  echo "   ✗ HTTP→HTTPS 跳转断言失败：实际 $http_code，Location=$http_loc（期望 301 → https://$DOMAIN/...）"
  fail=1
fi

https_code=$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")
if [ "$https_code" = "200" ]; then
  echo "   ✓ HTTPS 首页：200"
else
  echo "   ✗ HTTPS 首页断言失败：实际 $https_code（期望 200）"
  fail=1
fi

api_code=$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/admin/auth/current")
if [ "$api_code" = "401" ]; then
  echo "   ✓ 未登录当前用户接口：401（正向鉴权证据）"
else
  echo "   ✗ 未登录当前用户接口断言失败：实际 $api_code（期望 401——其他值说明代理/后端链路异常）"
  fail=1
fi

[ "$fail" = 0 ] || exit 1
