#!/usr/bin/env bash
# #94 部署物静态契约检查——只读仓库文件，不构建镜像、不起容器、不连真实服务器。
# 每条验收标准对应一组断言；任一 FAIL 退出码为 1。
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fail=0
ok() { printf 'PASS  %s\n' "$1"; }
bad() { printf 'FAIL  %s\n' "$1"; fail=1; }
check() {
  local name="$1" file="$2" pattern="$3" invert="${4:-}"
  if [ ! -f "$ROOT/$file" ]; then
    bad "$name（缺文件 $file）"
    return
  fi
  if grep -Eq -- "$pattern" "$ROOT/$file" 2>/dev/null; then
    [ -n "$invert" ] && bad "$name" || ok "$name"
  else
    [ -n "$invert" ] && ok "$name" || bad "$name"
  fi
}
check_sh() {
  local name="$1" file="$2"
  if [ ! -f "$ROOT/$file" ]; then
    bad "$name（缺文件 $file）"
    return
  fi
  if bash -n "$ROOT/$file" 2>/dev/null; then
    ok "$name"
  else
    bad "$name（bash -n 语法错误）"
  fi
}

echo '== A. 生产环境基础地址 =='
check '.env.prod 基础地址为同源 /api/admin' '.env.prod' '^VITE_SERVICE_BASE_URL=/api/admin$'
check '.env.prod 不再指向 Apifox mock' '.env.prod' 'apifox' invert=1
check '.env.test 开发态配置保持 localhost:8081 不变' '.env.test' '^VITE_SERVICE_BASE_URL=http://localhost:8081/api/admin$'
check '.dockerignore 放行构建所需的 .env（VITE_ 公共配置）' '.dockerignore' '^!\.env$'
check '.dockerignore 放行构建所需的 .env.prod（同源 /api/admin 口径）' '.dockerignore' '^!\.env\.prod$'

echo '== B. 多阶段镜像 =='
check 'Dockerfile deps 阶段（pnpm workspace 依赖安装）' 'Dockerfile' '^FROM .* AS deps$'
check 'Dockerfile builder 阶段（生产构建）' 'Dockerfile' '^FROM .* AS builder$'
check 'Dockerfile 运行阶段基于 nginx' 'Dockerfile' '^FROM nginx'
check 'Dockerfile 运行阶段只拷静态产物 dist' 'Dockerfile' 'COPY --from=builder .*/dist '
check 'Dockerfile 拷入 nginx 配置模板' 'Dockerfile' 'default\.conf\.template'
check 'Dockerfile 模板不放官方 envsubst 扫描目录（/etc/nginx/templates/）' 'Dockerfile' 'default\.conf\.template /etc/nginx/templates/' invert=1
check 'Dockerfile 拷入启动注入脚本' 'Dockerfile' 'docker-entrypoint\.d'
check 'Dockerfile 无旧 Next 残留' 'Dockerfile' '\.next|NEXT_TELEMETRY' invert=1

echo '== C. Compose 生产编排 =='
check 'compose 显式项目名' 'docker-compose.prod.yml' '^name: '
check 'compose 显式镜像名' 'docker-compose.prod.yml' '^[[:space:]]+image: '
check 'compose 容器名 semgravio-admin-web' 'docker-compose.prod.yml' '^[[:space:]]+container_name: semgravio-admin-web$'
check 'compose 仅接入 external webnet' 'docker-compose.prod.yml' '^[[:space:]]+external: true$'
check 'compose 无宿主端口映射' 'docker-compose.prod.yml' '^[[:space:]]+ports:' invert=1
check 'compose 透传 BACKEND_URL' 'docker-compose.prod.yml' 'BACKEND_URL'

echo '== D. nginx SPA 回退与代理 =='
NGX_TMPL='deploy/nginx/default.conf.template'
check 'nginx 模板存在' "$NGX_TMPL" '.'
check 'nginx 模板含 __BACKEND_URL__ 占位符' "$NGX_TMPL" '__BACKEND_URL__'
check '代理保留完整原始 URI（proxy_pass 变量不带 URI 部分）' "$NGX_TMPL" 'proxy_pass \$backend_upstream;'
check 'Docker DNS 可重解析（resolver 127.0.0.11）' "$NGX_TMPL" 'resolver 127\.0\.0\.11'
check 'history 路由回退到入口' "$NGX_TMPL" 'try_files \$uri \$uri/ /index\.html'
check '裸 /api/admin 不回退成 index.html（精确匹配 404）' "$NGX_TMPL" 'location = /api/admin'
check '静态资源路径不被回退吞掉（/assets/ =404）' "$NGX_TMPL" 'location /assets/'

echo '== E. 启动注入脚本 =='
ENTRY='deploy/docker-entrypoint.d/30-backend-url.sh'
check_sh '启动注入脚本语法（bash -n）' "$ENTRY"
check '空 BACKEND_URL 响亮失败' "$ENTRY" 'BACKEND_URL 不能为空|BACKEND_URL is required|BACKEND_URL.*required'
check '占位值响亮失败' "$ENTRY" '__BACKEND_URL__'
check '拒绝携带 /api/admin 后缀的源站地址' "$ENTRY" '/api/admin'
check '模板替换不消费 nginx 自身变量（sed 定点替换占位符）' "$ENTRY" 'sed .*__BACKEND_URL__'

echo '== F. 服务器环境变量模板 =='
check '服务器 env 模板存在且含 BACKEND_URL 规则说明' '.env.production.example' '^#.*BACKEND_URL'

echo '== G. 全部 shell 脚本语法 =='
check_sh 'deploy.sh 语法' 'deploy.sh'
check_sh 'publish.sh 语法' 'publish.sh'
check_sh 'deploy/validate.sh 语法' 'deploy/validate.sh'

echo
if [ "$fail" -eq 0 ]; then
  echo '全部静态契约检查通过（未构建、未起栈）。'
else
  echo '存在未通过的静态契约检查。'
fi
exit "$fail"
