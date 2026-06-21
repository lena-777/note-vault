#!/bin/bash

echo "🔄 重启 Note Vault 服务..."

# 杀掉占用 3456 端口的进程
PID=$(lsof -ti :3456)
if [ -n "$PID" ]; then
  echo "🛑 停止旧进程 (PID: $PID)"
  kill -9 $PID
  sleep 1
fi

# 启动后端服务（静态前端由 server 一并托管）
cd "$(dirname "$0")/server"
node index.js &

echo "✅ 服务已启动: http://localhost:3456"
