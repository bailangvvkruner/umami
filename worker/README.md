# Umami Analytics for Cloudflare Workers + D1

这是 Umami 网站分析平台的 Cloudflare Workers 移植版本，使用 D1 (SQLite) 数据库。

## 特性

- 🚀 运行在 Cloudflare 全球边缘网络
- 💾 使用 D1 (SQLite) 数据库
- 🔐 JWT 认证 + KV 会话存储
- 📊 完整的网站分析功能
- 🌐 支持 CORS

---

## 📦 快速开始

### 1. 安装依赖

```bash
cd worker
npm install
```

### 2. 创建 Cloudflare 资源

#### 方式一：使用命令行

```bash
# 创建 D1 数据库
npx wrangler d1 create umami-db
# 记录返回的 database_id

# 创建 KV 命名空间
npx wrangler kv:namespace create KV
# 记录返回的 id
```

#### 方式二：Cloudflare Dashboard 手动创建

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **D1 SQL Database**
3. 点击 **Create database**，名称输入 `umami-db`
4. 创建后复制 **Database ID**
5. 进入 **Workers & Pages** → **KV**
6. 点击 **Create a namespace**，名称输入 `KV`
7. 创建后复制 **Namespace ID**

### 3. 更新配置文件

编辑 `wrangler.toml`，替换占位符：

```toml
[[d1_databases]]
binding = "DB"
database_name = "umami-db"
database_id = "你的数据库ID"  # 替换这里

[[kv_namespaces]]
binding = "KV"
id = "你的KV命名空间ID"  # 替换这里
```

### 4. 设置环境变量

#### 本地开发

创建 `.dev.vars` 文件：

```bash
APP_SECRET=your-super-secret-key-at-least-32-characters-long
```

#### 生产环境

**方式一：Dashboard 设置**

1. 进入 **Workers & Pages** → 你的 Worker
2. 点击 **Settings** → **Variables and Secrets**
3. 添加变量：
   - 变量名：`APP_SECRET`
   - 变量值：你的密钥（至少32字符）

**方式二：命令行设置**

```bash
npx wrangler secret put APP_SECRET
# 然后输入你的密钥
```

### 5. 初始化数据库

```bash
# 本地开发环境
npx wrangler d1 migrations apply umami-db --local

# 插入种子数据（默认管理员）
npx wrangler d1 execute umami-db --local --file=./migrations/seed.sql

# 生产环境（部署后执行）
npx wrangler d1 migrations apply umami-db
npx wrangler d1 execute umami-db --file=./migrations/seed.sql
```

### 6. 本地开发

```bash
npm run dev
```

访问 http://localhost:3001 测试 API。

### 7. 部署到 Cloudflare

```bash
npm run deploy
```

部署成功后会显示 Worker URL，例如：`https://umami-worker.你的账户.workers.dev`

---

## 🔧 Cloudflare Dashboard 完整配置清单

### 必需配置

| 配置项 | 位置 | 说明 |
|--------|------|------|
| D1 数据库 | Workers → D1 | 创建 `umami-db` 数据库 |
| KV 命名空间 | Workers → KV | 创建用于会话存储 |
| APP_SECRET | Worker → Settings → Variables | JWT 加密密钥 |

### 可选配置

| 配置项 | 位置 | 说明 |
|--------|------|------|
| 自定义域名 | Worker → Settings → Triggers | 绑定自己的域名 |
| CORS 域名 | 代码中已配置 `*` | 可根据需要修改 |

---

## 📝 环境变量说明

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `APP_SECRET` | ✅ | JWT 加密密钥，至少32字符 | `my-super-secret-key-1234567890` |
| `ENVIRONMENT` | ❌ | 环境标识，默认 `production` | `development` |

---

## 🌐 API 端点

### 认证

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/auth/verify` | POST | 验证令牌 |

### 用户

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/users` | GET | 获取用户列表 (管理员) |
| `/api/users` | POST | 创建用户 (管理员) |
| `/api/me` | GET | 获取当前用户信息 |
| `/api/me/websites` | GET | 获取用户的网站列表 |
| `/api/me/teams` | GET | 获取用户的团队列表 |

### 网站

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/websites` | GET | 获取网站列表 |
| `/api/websites` | POST | 创建网站 |
| `/api/websites/:id` | GET | 获取网站详情 |
| `/api/websites/:id` | PUT | 更新网站 |
| `/api/websites/:id` | DELETE | 删除网站 |
| `/api/websites/:id/stats` | GET | 获取统计数据 |
| `/api/websites/:id/pageviews` | GET | 获取页面访问数据 |
| `/api/websites/:id/metrics` | GET | 获取指标数据 |
| `/api/websites/:id/active` | GET | 获取实时访客数 |
| `/api/websites/:id/events` | GET | 获取事件列表 |

### 团队

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/teams` | GET | 获取团队列表 |
| `/api/teams` | POST | 创建团队 |
| `/api/teams/:id` | GET | 获取团队详情 |
| `/api/teams/:id` | DELETE | 删除团队 |
| `/api/teams/:id/users` | GET | 获取团队成员 |

### 数据收集

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/send` | POST | 接收追踪数据 |

---

## 🔑 默认管理员

初始化后默认管理员账号：

- **用户名**: `admin`
- **密码**: `admin`

⚠️ **生产环境请立即修改密码！**

---

## 📊 使用追踪脚本

### 方式一：使用提供的脚本

```html
<script 
  src="https://your-worker.workers.dev/script.js" 
  data-website-id="你的网站ID"
  async defer>
</script>
```

### 方式二：直接调用 API

```javascript
// 页面访问
fetch('https://your-worker.workers.dev/api/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    website: '你的网站ID',
    url: window.location.href,
    referrer: document.referrer,
    title: document.title,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
  }),
});

// 自定义事件
fetch('https://your-worker.workers.dev/api/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    website: '你的网站ID',
    url: window.location.href,
    name: 'button_click',
    tag: 'conversion',
  }),
});
```

---

## 🔄 常用命令

```bash
# 本地开发
npm run dev

# 编译检查
npm run build

# 部署
npm run deploy

# 查看日志
npm run tail

# 数据库迁移（本地）
npm run db:migrate:local

# 数据库迁移（生产）
npm run db:migrate

# 插入种子数据
npm run seed
```

---

## ⚠️ 与原版 Umami 的差异

| 功能 | 原版 | Worker 版 |
|------|------|-----------|
| 数据库 | PostgreSQL / ClickHouse | D1 (SQLite) |
| ORM | Prisma | 原生 SQL |
| 缓存 | Redis | KV |
| 运行时 | Node.js | Edge Runtime |
| 前端 | Next.js SSR | API only |
| 地理位置检测 | MaxMind | 需自行配置 |

---

## 🚨 注意事项

### D1 数据库限制

- 最大数据库大小：500MB
- 最大行数：无限制
- 单次查询返回：1000 行
- 批量操作：最多 100 条

### KV 存储限制

- 键值大小：最大 25MB
- 读取：免费额度内无限
- 写入：有限制

### 建议场景

- ✅ 个人博客、小型网站
- ✅ 中小型企业官网
- ✅ 日访问量 < 10万 的网站
- ❌ 高流量大型网站（建议使用原版 + ClickHouse）

---

## 🔧 故障排除

### 部署失败

```bash
# 检查是否登录
npx wrangler whoami

# 如未登录
npx wrangler login
```

### 数据库连接错误

1. 确认 D1 数据库已创建
2. 确认 `wrangler.toml` 中的 `database_id` 正确
3. 确认已运行迁移命令

### 认证失败

1. 确认 `APP_SECRET` 已设置
2. 确认 KV 命名空间已绑定
3. 检查请求头是否包含 `Authorization: Bearer <token>`

---

## 📄 License

MIT

---

## 🙏 致谢

- [Umami](https://umami.is/) - 原始项目
- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台
- [Hono](https://hono.dev/) - 轻量级 Web 框架
