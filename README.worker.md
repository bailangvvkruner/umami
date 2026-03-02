# Umami Analytics - Cloudflare Workers 部署指南

## 📋 部署前准备

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com)
2. 安装 Node.js 18+

---

## 🚀 部署步骤

### 第一步：安装依赖

```bash
npm install
```

### 第二步：登录 Cloudflare

```bash
npx wrangler login
```
会打开浏览器，登录你的 Cloudflare 账号并授权。

---

### 第三步：创建 D1 数据库

**方式一：命令行创建**
```bash
npx wrangler d1 create umami-db
```

创建后会显示：
```
✅ Successfully created DB 'umami-db'
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "umami-db",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

**记住这个 `database_id`！**

**方式二：Dashboard 创建**
1. 打开 https://dash.cloudflare.com
2. 左侧菜单 → **Workers & Pages** → **D1 SQL Database**
3. 点击 **Create database**
4. 名称输入：`umami-db`
5. 点击 **Create**
6. 复制生成的 **Database ID**

---

### 第四步：创建 KV 命名空间

**方式一：命令行创建**
```bash
npx wrangler kv:namespace create KV
```

创建后会显示：
```
✅ Successfully created KV namespace
{
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  ]
}
```

**记住这个 `id`！**

**方式二：Dashboard 创建**
1. 打开 https://dash.cloudflare.com
2. 左侧菜单 → **Workers & Pages** → **KV**
3. 点击 **Create a namespace**
4. 名称输入：`KV`
5. 点击 **Add**
6. 复制生成的 **Namespace ID**

---

### 第五步：更新 wrangler.toml

编辑 `wrangler.toml` 文件，填入你创建的 ID：

```toml
name = "umami"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "umami-db"
database_id = "你的数据库ID"  # ← 替换这里

[[kv_namespaces]]
binding = "KV"
id = "你的KV命名空间ID"  # ← 替换这里

[assets]
directory = "./public"
binding = "ASSETS"

[dev]
port = 3001
```

---

### 第六步：初始化数据库

```bash
# 创建表结构
npx wrangler d1 execute umami-db --remote --file=./migrations/0001_initial_schema.sql

# 插入默认管理员
npx wrangler d1 execute umami-db --remote --file=./migrations/seed.sql
```

---

### 第七步：设置密钥

```bash
npx wrangler secret put APP_SECRET
```
输入一个至少 32 字符的随机字符串，例如：
```
my-super-secret-key-at-least-32-characters-long-12345
```

---

### 第八步：部署

```bash
npx wrangler deploy
```

部署成功后会显示：
```
✨ Published umami
   https://umami.你的账户.workers.dev
```

---

## 🎉 完成！

访问你的 Worker URL，使用默认账号登录：

| 项目 | 值 |
|------|-----|
| 地址 | `https://umami.你的账户.workers.dev` |
| 用户名 | `admin` |
| 密码 | `admin` |

⚠️ **登录后请立即修改密码！**

---

## 🔧 Dashboard 绑定方式（可选）

如果你不想修改 `wrangler.toml`，可以在 Dashboard 中绑定：

### 绑定 D1 数据库

1. **Workers & Pages** → 点击你的 Worker `umami`
2. **Settings** → **Bindings**
3. **Add binding** → **D1 database**
4. Variable name: `DB`
5. 选择你创建的 `umami-db` 数据库
6. **Add binding**

### 绑定 KV 命名空间

1. **Workers & Pages** → 点击你的 Worker `umami`
2. **Settings** → **Bindings**
3. **Add binding** → **KV Namespace**
4. Variable name: `KV`
5. 选择你创建的 KV 命名空间
6. **Add binding**

### 设置密钥

1. **Workers & Pages** → 点击你的 Worker `umami`
2. **Settings** → **Variables and Secrets**
3. **Add variable**
4. Variable name: `APP_SECRET`
5. Value: 你的密钥（至少32字符）
6. **Encrypt** 选择 **Encrypt**
7. **Add variable**

---

## 📊 使用追踪代码

部署后在管理面板创建网站，获取追踪代码：

```html
<script 
  src="https://umami.你的账户.workers.dev/script.js" 
  data-website-id="你的网站ID" 
  async defer>
</script>
```

将此代码添加到你网站的 `<head>` 标签中。

---

## ❓ 常见问题

### Q: 部署后登录报错？

确保：
1. 数据库已初始化（执行了两个 SQL 文件）
2. APP_SECRET 已设置
3. KV 命名空间已绑定

### Q: 如何查看数据库数据？

```bash
npx wrangler d1 execute umami-db --remote --command "SELECT * FROM user"
```

### Q: 如何重新部署？

```bash
npx wrangler deploy
```

### Q: 如何查看日志？

```bash
npx wrangler tail
```
