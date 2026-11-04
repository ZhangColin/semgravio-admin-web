#!/usr/bin/env bash
# 组装自包含部署包：dist/admin-web-deploy-<时间戳>.tar.gz（跨平台：macOS ＋ Windows Git Bash）
# 在开发机仓库根执行：deploy/build-bundle.sh；末行打印包路径（publish.sh 依赖该约定）。
# 产物结构（scp 到服务器 ~/semgravio-admin-web 解包，publish.sh 一键链路自动完成）：
#   <仓库全量源码树>   git archive HEAD 导出（pnpm workspace 构建上下文：Dockerfile 多阶段
#                     构建在服务器侧跑 pnpm install + vite build，开发机零构建依赖）
#   REVISION           打包时的 git HEAD revision
#
# 源码树用 `git archive` 导出（同 aiplatform build-bundle.sh 的三条理由）：
#   ① Windows Git Bash 无 rsync，git 两平台都在；
#   ② Windows checkout 是 CRLF，git archive 出仓库正本、恒 LF（.gitattributes 已钉 *.sh 等）；
#   ③ 打包内容＝已提交内容（HEAD），与 REVISION 严格一致。工作区脏则拒绝打包；
#      确认带脏打包（源码树仍按 HEAD）：ALLOW_DIRTY=1。
#
# 安全边界：git archive 只导出已提交文件——.env.production（真实服务器环境值）、certs/、
# *.pem 均未入库，天然不进包；打包前仍再断言一遍（防未来误提交），命中即中止。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  if [ "${ALLOW_DIRTY:-0}" = "1" ]; then
    echo "⚠ 警告：工作区有未提交改动——源码树仍按 HEAD 打包，包内容与工作区不一致，请确认是有意的" >&2
  else
    echo "错误：工作区有未提交改动（如下）。先提交再打包；确认带脏打包用：ALLOW_DIRTY=1 deploy/build-bundle.sh" >&2
    git status --porcelain >&2
    exit 1
  fi
fi

STAMP=$(date +%Y%m%d-%H%M)
TOP="admin-web-deploy-${STAMP}"
OUT="dist/${TOP}"

echo "== 1/3 导出源码树（git archive HEAD，恒 LF） =="
rm -rf "${OUT}"    # 同分钟内重跑兜底
mkdir -p "${OUT}"
# git archive 会按本机 core.autocrlf 做 checkout 同款转换（Windows 上＝CRLF，实测踩过），
# 覆盖后输出仓库正本、恒 LF。
git -c core.autocrlf=false -c core.eol=lf archive HEAD | tar -x -C "${OUT}"

echo "== 2/3 秘密值排除断言（不得进入部署包） =="
# 双重保障：这些路径本就未入库（git archive 导不出），这里防「未来误提交」的回归。
leak=$(find "${OUT}" \( -name '*.pem' -o -name '.env.production' -o -path '*/certs/*' \) -print)
[ -z "$leak" ] || { echo "错误：部署包内发现秘密值文件，打包中止：$leak" >&2; exit 1; }
echo "   ✓ 无 .env.production / certs/ / *.pem"

echo "== 3/3 记录 revision 并打包 =="
git rev-parse HEAD > "${OUT}/REVISION"
tar -C dist -czf "${OUT}.tar.gz" "${TOP}"
rm -rf "${OUT}"
du -sh "${OUT}.tar.gz"
echo "完成，包路径："
echo "${OUT}.tar.gz"
