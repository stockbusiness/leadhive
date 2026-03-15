# LeadHive — Replit から外部サーバー移行ガイド

> 対象: AWS / DigitalOcean / さくらクラウド / GCP など  
> 作成日: 2026年3月  
> 運営: COOLWORKS株式会社

---

## 目次

1. [移行前の準備](#1-移行前の準備)
2. [コードのエクスポート](#2-コードのエクスポート)
3. [データベースのエクスポート](#3-データベースのエクスポート)
4. [移行先サーバーの要件](#4-移行先サーバーの要件)
5. [AWS EC2 への移行手順](#5-aws-ec2-への移行手順)
6. [DigitalOcean Droplet への移行手順](#6-digitalocean-droplet-への移行手順)
7. [環境変数の設定](#7-環境変数の設定)
8. [データベースの復元](#8-データベースの復元)
9. [フロントエンドのビルド](#9-フロントエンドのビルド)
10. [サービス起動と常駐化](#10-サービス起動と常駐化)
11. [Nginx リバースプロキシ設定](#11-nginx-リバースプロキシ設定)
12. [SSL証明書の設定](#12-ssl証明書の設定)
13. [DNS 切り替え](#13-dns-切り替え)
14. [動作確認チェックリスト](#14-動作確認チェックリスト)
15. [Replit 環境との主な差異](#15-replit-環境との主な差異)

---

## 1. 移行前の準備

### 必要なもの

- 移行先サーバーへのアクセス（SSH鍵またはパスワード）
- ドメイン `leadhive.work` のDNS管理権限
- Replitからのコード・DBダウンロード権限

### 移行作業の推奨タイミング

- **深夜〜早朝**（ユーザー利用が少ない時間帯）
- 作業時間の目安: 2〜4時間
- 事前に「メンテナンス中」アナウンスを送ることを推奨

---

## 2. コードのエクスポート

### Replit からのダウンロード

Replit の「Download as zip」またはGit連携でコードを取得します。

```bash
# Git を使う場合（Replit Shell で実行）
git remote add export https://github.com/your-org/leadhive.git
git push export main

# または zip ダウンロード後に解凍
unzip leadhive.zip -d leadhive/
```

### プロジェクト構成の確認

```
leadhive/
├── server/              # FastAPI バックエンド
│   ├── main.py          # アプリエントリポイント
│   ├── models.py        # DB モデル定義（SQLAlchemy）
│   ├── database.py      # DB接続設定
│   ├── auth.py          # JWT認証
│   ├── routes/          # APIルート（25ファイル）
│   └── services/        # ビジネスロジック
├── frontend/            # React + TypeScript + Vite
│   ├── src/
│   └── dist/            # ビルド済み静的ファイル
├── pyproject.toml       # Python依存関係
└── package.json         # Node.js依存関係
```

---

## 3. データベースのエクスポート

Replit Shell で以下を実行してください。

```bash
# PostgreSQL ダンプ（全データ）
pg_dump $DATABASE_URL \
  --format=custom \
  --no-privileges \
  --no-owner \
  -f leadhive_backup_$(date +%Y%m%d).dump

# または SQL 形式
pg_dump $DATABASE_URL \
  --format=plain \
  --no-privileges \
  --no-owner \
  -f leadhive_backup_$(date +%Y%m%d).sql
```

ダウンロードしたファイルをローカルに保存してください。

```bash
# Replit から SCP でローカルへ転送（Replit Shell でプロキシして取得）
# または Replit の Files パネルからダウンロード
```

---

## 4. 移行先サーバーの要件

| 項目 | 最小スペック | 推奨スペック |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| メモリ | 2 GB RAM | 4 GB RAM |
| ストレージ | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Python | 3.11 | 3.11 |
| Node.js | 18 | 20 LTS |
| PostgreSQL | 14+ | 16 |

> **スケジューラーについて**: LeadHive は `threading` ベースの常駐スケジューラーを内蔵しています。これは **Reserved VM（常時起動型）** での実行が必要です。Serverless（Cloud Functions 等）では動作しません。

---

## 5. AWS EC2 への移行手順

### 5-1. EC2 インスタンス作成

- AMI: Ubuntu 22.04 LTS
- インスタンスタイプ: `t3.small`（最小）または `t3.medium`（推奨）
- セキュリティグループ: ポート 22（SSH）、80（HTTP）、443（HTTPS）を開放
- EBSストレージ: 30 GB gp3

### 5-2. RDS for PostgreSQL（オプション、推奨）

EC2 内蔵 PostgreSQL でも動きますが、RDS を使うと可用性が上がります。

```
- エンジン: PostgreSQL 16
- インスタンスクラス: db.t3.micro（最小）
- ストレージ: 20 GB gp2
- マルチAZ: 本番は有効化推奨
```

RDS の場合は DATABASE_URL を以下の形式で設定：

```
postgresql://username:password@rds-endpoint.amazonaws.com:5432/leadhive
```

### 5-3. サーバーセットアップ

```bash
# SSH 接続後
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# システム更新
sudo apt update && sudo apt upgrade -y

# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL（EC2 内蔵の場合）
sudo apt install -y postgresql-16 postgresql-client-16

# Nginx
sudo apt install -y nginx

# Git
sudo apt install -y git
```

---

## 6. DigitalOcean Droplet への移行手順

```bash
# Droplet 作成（コントロールパネルまたは doctl CLI）
doctl compute droplet create leadhive \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-2gb \
  --region sgp1 \
  --ssh-keys YOUR_SSH_KEY_ID

# SSH 接続
ssh root@YOUR_DROPLET_IP

# 以降は AWS と同じセットアップ手順
```

> **DigitalOcean Managed Database** を使う場合も DATABASE_URL を接続文字列に変更するだけです。

---

## 7. 環境変数の設定

Replit の Secrets に設定していた値を移行先に設定します。

```bash
# /etc/environment に追記（または .env ファイルを作成）
sudo nano /etc/environment
```

必須の環境変数一覧：

```bash
# データベース接続文字列
DATABASE_URL=postgresql://user:password@localhost:5432/leadhive

# JWT署名・セッション暗号化キー（必ずランダムな強固な値に）
SESSION_SECRET=<32文字以上のランダム文字列>

# Sentry エラー監視（任意）
SENTRY_DSN=https://...@sentry.io/...

# アプリ環境
APP_ENV=production
```

> **重要**: `SESSION_SECRET` は既存ユーザーのセッションと暗号化データに関わります。Replit で使っていた値と**同じ値を設定してください**。変更すると既存ユーザーが全員ログアウトされ、暗号化された設定値（Slack Webhook URL 等）が読めなくなります。

その他のAPIキー（Google、Anthropic、OpenAI、Stripe等）は DB の `app_settings` テーブルに暗号化して保存されているため、DB ごと移行すれば再設定不要です。

---

## 8. データベースの復元

```bash
# PostgreSQL データベース作成
sudo -u postgres createdb leadhive
sudo -u postgres createuser leadhive_user
sudo -u postgres psql -c "ALTER USER leadhive_user PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE leadhive TO leadhive_user;"

# バックアップから復元（.dump 形式）
pg_restore \
  --dbname=postgresql://leadhive_user:your_password@localhost/leadhive \
  --no-privileges \
  --no-owner \
  leadhive_backup_YYYYMMDD.dump

# SQL 形式の場合
psql postgresql://leadhive_user:your_password@localhost/leadhive \
  < leadhive_backup_YYYYMMDD.sql
```

---

## 9. フロントエンドのビルド

```bash
# プロジェクトディレクトリへ
cd /opt/leadhive

# Node.js 依存関係インストール
npm install

# 本番ビルド
npx vite build --config frontend/vite.config.ts

# ビルド結果は frontend/dist/ に出力される
ls frontend/dist/
```

---

## 10. サービス起動と常駐化

### Python 仮想環境のセットアップ

```bash
cd /opt/leadhive
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# または
pip install uv && uv sync
```

### systemd サービスファイルの作成

```bash
sudo nano /etc/systemd/system/leadhive.service
```

```ini
[Unit]
Description=LeadHive FastAPI Application
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/leadhive
Environment=PATH=/opt/leadhive/.venv/bin
EnvironmentFile=/etc/leadhive.env
ExecStart=/opt/leadhive/.venv/bin/python server/main.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# 環境変数ファイル
sudo nano /etc/leadhive.env
# DATABASE_URL=...
# SESSION_SECRET=...
# APP_ENV=production

# サービス有効化・起動
sudo systemctl daemon-reload
sudo systemctl enable leadhive
sudo systemctl start leadhive
sudo systemctl status leadhive
```

---

## 11. Nginx リバースプロキシ設定

```bash
sudo nano /etc/nginx/sites-available/leadhive
```

```nginx
server {
    listen 80;
    server_name leadhive.work www.leadhive.work;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name leadhive.work www.leadhive.work;

    ssl_certificate /etc/letsencrypt/live/leadhive.work/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/leadhive.work/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 静的ファイル（React SPA）
    root /opt/leadhive/frontend/dist;
    index index.html;

    # API リクエストをバックエンドに転送
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 30s;
    }

    # トラッキングピクセル
    location /api/track/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # React SPA ルーティング（404 を index.html にフォールバック）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # アップロードファイルサイズ上限
    client_max_body_size 50M;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/leadhive /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 12. SSL証明書の設定

```bash
# Certbot のインストール
sudo apt install -y certbot python3-certbot-nginx

# SSL証明書の取得（DNS を先に切り替えてから実行）
sudo certbot --nginx -d leadhive.work -d www.leadhive.work

# 自動更新の確認
sudo certbot renew --dry-run
```

---

## 13. DNS 切り替え

1. 新サーバーの動作確認が完了したら実施
2. ドメインのDNS管理画面（お名前.com 等）で Aレコードを変更

```
leadhive.work     A    新サーバーのIPアドレス
www.leadhive.work A    新サーバーのIPアドレス
```

3. TTL を事前に短く設定しておくと切り替えが速くなる（300秒 = 5分）
4. 切り替え後は `dig leadhive.work` で反映確認

---

## 14. 動作確認チェックリスト

移行完了後、以下を確認してください。

```
[ ] https://leadhive.work でトップページが表示される
[ ] 既存アカウントでログインできる
[ ] 企業一覧が正しく表示される
[ ] 新規企業を登録できる
[ ] スコアリングが正常に動作する
[ ] 自動収集ジョブが動作する（ログで確認）
[ ] Slack Webhook 通知が届く
[ ] メール送信（SMTP）が動作する
[ ] トラッキングピクセルが記録される
[ ] 管理画面（/admin/*）にアクセスできる
[ ] Stripe の Webhook エンドポイントを新URLに更新する
```

### Stripe Webhook の更新

Stripe ダッシュボード > Webhooks > エンドポイント URL を更新：

```
https://leadhive.work/api/payments/stripe-webhook
```

---

## 15. Replit 環境との主な差異

| 項目 | Replit | 外部サーバー |
|---|---|---|
| サーバー起動 | `python server/main.py` | systemd で常駐 |
| ポート | 5000（Replit プロキシ経由） | Nginx が 80/443 でリバースプロキシ |
| CORS 設定 | Replit ドメインを許可 | `leadhive.work` のみ許可（変更不要） |
| DB | Replit 内蔵 PostgreSQL | 外部 PostgreSQL または RDS |
| ファイルシステム | Replit ワークスペース | `/opt/leadhive/` |
| 環境変数 | Replit Secrets | `/etc/leadhive.env` |
| スケジューラー | Replit Reserved VM で動作 | systemd 常駐で同様に動作 |

---

*最終更新: 2026年3月 — COOLWORKS株式会社*
