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
check 'Dockerfile deps 阶段（pnpm workspace 依赖安装）' 'deploy/web.Dockerfile' '^FROM .* AS deps$'
check 'Dockerfile builder 阶段（生产构建）' 'deploy/web.Dockerfile' '^FROM .* AS builder$'
check 'Dockerfile 运行阶段基于 nginx' 'deploy/web.Dockerfile' '^FROM nginx'
check 'Dockerfile 运行阶段只拷静态产物 dist' 'deploy/web.Dockerfile' 'COPY --from=builder .*/dist '
check 'Dockerfile 拷入 nginx 配置模板' 'deploy/web.Dockerfile' 'default\.conf\.template'
check 'Dockerfile 模板不放官方 envsubst 扫描目录（/etc/nginx/templates/）' 'deploy/web.Dockerfile' 'default\.conf\.template /etc/nginx/templates/' invert=1
check 'Dockerfile 拷入启动注入脚本' 'deploy/web.Dockerfile' 'docker-entrypoint\.d'
check 'Dockerfile 无旧 Next 残留' 'deploy/web.Dockerfile' '\.next|NEXT_TELEMETRY' invert=1

echo '== C. Compose 生产编排 =='
check 'compose 显式项目名' 'deploy/web.compose.yml' '^name: '
check 'compose 显式镜像名' 'deploy/web.compose.yml' '^[[:space:]]+image: '
check 'compose 容器名 semgravio-admin-web' 'deploy/web.compose.yml' '^[[:space:]]+container_name: semgravio-admin-web$'
check 'compose 仅接入 external webnet' 'deploy/web.compose.yml' '^[[:space:]]+external: true$'
check 'compose 无宿主端口映射' 'deploy/web.compose.yml' '^[[:space:]]+ports:' invert=1
check 'compose 经 env_file 注入 BACKEND_URL（../.env.production，相对 compose 文件解析）' 'deploy/web.compose.yml' '\.\./\.env\.production'

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
check '服务器 env 模板存在且含 BACKEND_URL 规则说明' 'deploy/env.web.example' '^#.*BACKEND_URL'

echo '== G. 全部 shell 脚本语法 =='
check_sh 'deploy/server.sh 语法' 'deploy/server.sh'
check_sh 'deploy/release.sh 语法' 'deploy/release.sh'
check_sh 'deploy/validate.sh 语法' 'deploy/validate.sh'

echo '== H. 一键发布链路（#95） =='
BUNDLE_SH='deploy/build-bundle.sh'
SMOKE='deploy/smoke-remote.sh'
check_sh '打包脚本语法（bash -n）' "$BUNDLE_SH"
check '打包拒绝脏工作区' "$BUNDLE_SH" '工作区有未提交改动'
check '带脏打包逃生开关 ALLOW_DIRTY＋醒目警告' "$BUNDLE_SH" 'ALLOW_DIRTY'
check '部署包记录 HEAD revision（REVISION 文件）' "$BUNDLE_SH" 'rev-parse HEAD > .*REVISION'
check '打包走 git archive（已提交源码，恒 LF）' "$BUNDLE_SH" 'git .*archive HEAD'
check '打包秘密值排除断言（.env.production/certs/*.pem）' "$BUNDLE_SH" '\*\.pem.*\.env\.production|\.env\.production.*\*\.pem'
check 'bundle 命名 admin-web-deploy-*' "$BUNDLE_SH" 'admin-web-deploy-'

REL='deploy/release.sh'
check_sh '发布脚本语法（bash -n）' "$REL"
check '默认目标 ubuntu@3.70.172.160' "$REL" 'SERVER_HOST="\$\{SERVER_HOST:-3\.70\.172\.160\}"'
check '默认密钥沿用 aiplatform（semgravio-eu-1.pem）' "$REL" 'semgravio-eu-1\.pem'
check '远端应用目录 semgravio-admin-web（可覆盖）' "$REL" 'REMOTE_DIR="\$\{REMOTE_DIR:-semgravio-admin-web\}"'
check 'infra 目录 semgravio-infra（可覆盖）' "$REL" 'INFRA_DIR="\$\{INFRA_DIR:-semgravio-infra\}"'
check '前置检查含共享 nginx 健康' "$REL" 'semgravio-nginx'
check '前置检查含 webnet' "$REL" 'docker network inspect webnet'
check '前置检查含 BACKEND_URL 已填且源站口径' "$REL" 'BACKEND_URL='
check '前置检查含证书 admin.semgravio.com_bundle.pem' "$REL" 'admin\.semgravio\.com_bundle\.pem'
check '前置检查含私钥 admin.semgravio.com.key' "$REL" 'admin\.semgravio\.com\.key'
check '发布脚本含上传步骤（scp）' "$REL" 'scp -i'
check 'SKIP_BUILD=1 复用现有包开关' "$REL" 'SKIP_BUILD'
check '解包不覆盖现网 env 与证书（git archive 产物＋解包后现网输入复核）' "$REL" '解包后 .* 丢失'
check 'conf 与证书只经门禁安装' "$REL" 'install-nginx-conf\.sh'
# 冒烟三断言（301/200/401）在 K 节对共用脚本 deploy/smoke-remote.sh 统一检查，此处不重复
check '不触碰 PG/Redis/预览网络（无相关命令）' "$REL" 'pg_dump|semgravio-pg|semgravio-redis|previewnet' invert=1

OPS='deploy/server.sh'
check_sh '运维脚本语法（bash -n）' "$OPS"
check '运维入口 status 子命令' "$OPS" 'status\)'
check '运维入口 logs 子命令' "$OPS" 'logs\)'
check '运维入口 restart 子命令（不重建镜像）' "$OPS" 'restart\)'
check '运维入口 smoke 子命令' "$OPS" 'smoke\)'

echo '== I. 共享 nginx 接入配置（#95） =='
CONF='deploy/nginx/admin-web.conf'
check '共享 conf 存在' "$CONF" '.'
check '不声明 default_server（归 infra 兜底）' "$CONF" 'listen.*default_server' invert=1
check 'server_name 单行书写（门禁契约）' "$CONF" '^    server_name admin\.semgravio\.com;$'
check '80 统一跳转 HTTPS（301）' "$CONF" 'return 301 https://\$host\$request_uri;'
check '443 TLS 终止' "$CONF" 'listen 443 ssl;'
check '证书引用门禁安装路径 certs/admin-web/admin.semgravio.com_bundle.pem' "$CONF" '/etc/nginx/certs/admin-web/admin\.semgravio\.com_bundle\.pem'
check '私钥引用门禁安装路径 certs/admin-web/admin.semgravio.com.key' "$CONF" '/etc/nginx/certs/admin-web/admin\.semgravio\.com\.key'
check '代理传递 Host' "$CONF" 'proxy_set_header Host \$host;'
check '代理传递客户端 IP' "$CONF" 'proxy_set_header X-Real-IP \$remote_addr;'
check '代理传递协议头' "$CONF" 'proxy_set_header X-Forwarded-Proto \$scheme;'
check '上游 Docker DNS 可重解析（resolver＋变量 proxy_pass）' "$CONF" 'resolver 127\.0\.0\.11'
check '上游变量形式 proxy_pass（容器重建重解析）' "$CONF" 'proxy_pass http://\$upstream_app:80;'

echo '== J. 秘密值不入仓（#95） =='
check '.gitignore 忽略服务器环境值 .env.production' '.gitignore' '^\.env\.production$'
check '.gitignore 忽略证书目录 certs/' '.gitignore' '^certs/$'
check '.gitignore 忽略私钥 *.pem' '.gitignore' '^\*\.pem$'
check '.gitignore 不忽略模板 *.example' '.gitignore' '^!.*example'

echo '== K. 运维入口与中文手册（#96） =='
check_sh '冒烟脚本语法（bash -n）' "$SMOKE"
check '冒烟走真实 SNI（--resolve，不依赖隐式 443 兜底）' "$SMOKE" 'resolve'
check '冒烟断言 HTTP→HTTPS 301' "$SMOKE" '"301"'
check '冒烟断言 HTTPS 首页 200' "$SMOKE" '"200"'
check '冒烟断言未登录当前用户 401' "$SMOKE" '"401"'
check '运维冒烟与发布冒烟共用同一脚本（deploy.sh 侧）' "$OPS" 'smoke-remote\.sh'
check '运维冒烟与发布冒烟共用同一脚本（deploy/release.sh 侧）' "$REL" 'smoke-remote\.sh'
check '未知子命令用法＋非零退出' "$OPS" 'exit 64'
check '共享 conf 钉 eol=lf（.gitattributes）' '.gitattributes' '\*\.conf.*eol=lf'
check '共享 conf 无 CRLF 残留' "$CONF" $'\r' invert=1
DOC='deploy/部署文档.md'
check '手册列明全部运维子命令（status）' "$DOC" 'deploy/server\.sh status'
check '手册列明全部运维子命令（logs web）' "$DOC" 'deploy/server\.sh logs web'
check '手册列明全部运维子命令（restart）' "$DOC" 'deploy/server\.sh restart'
check '手册列明全部运维子命令（smoke）' "$DOC" 'deploy/server\.sh smoke'
check '手册含证书私钥权限保护（chmod 600）' "$DOC" 'chmod 600'
check '手册含 BACKEND_URL URI 原样转发示例' "$DOC" 'auth/login'
check '手册含深层 history 路由检查' "$DOC" 'history 路由'
check '手册明确部署包不得提交 Git' "$DOC" '不得提交 Git'
check '手册明确基础设施不由本仓部署' "$DOC" '不由本仓|不归本仓'
check '手册明确静态实施与真实发布边界' "$DOC" '静态验证|真实发布'

echo
if [ "$fail" -eq 0 ]; then
  echo '全部静态契约检查通过（未构建、未起栈）。'
else
  echo '存在未通过的静态契约检查。'
fi
exit "$fail"
