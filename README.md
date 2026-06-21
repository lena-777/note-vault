# Note Vault

以目标为驱动，把零散阅读重点串联成知识脉络的系统。

## 目录结构

```
note-vault/
├── frontend/        # 前端静态文件
│   ├── index.html
│   └── src/         # JS 视图、样式、工具函数
├── server/          # Express 后端
│   ├── index.js     # API 服务 + 静态文件托管
│   └── init-db.js   # 初始化数据库表结构
├── restart.sh       # 一键重启脚本
└── README.md
```

## 启动

```bash
# 首次运行：初始化数据库
node server/init-db.js

# 启动服务
./restart.sh

# 访问
open http://localhost:3456
```

## 数据库

MySQL `9.135.133.21:3306`，库名 `note_vault`。

## 功能

- 思维导图式目标规划（Tab/Enter 键盘驱动）
- 四层结构：目标 → 子问题 → 重点卡片 / 文章
- 卡片语义关联：支撑 / 补充 / 矛盾 / 递进
- D3.js 知识图谱可视化
- 组合检索：关键词 + 目标 + 标签
- JSON / Markdown 导出
