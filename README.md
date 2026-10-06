# MoneyWise

MoneyWise は、収入・支出を月ごとに記録し、残高や支出内訳を分かりやすく確認できる家計管理 Web アプリケーションです。

ユーザー登録・ログイン、セッション認証、ユーザーごとのデータ分離、収入・支出の CRUD、月別集計、グラフ表示まで実装しています。

## Demo

- Live Demo: https://moneywise-1.onrender.com
- GitHub: https://github.com/Keii-boy/Moneywise

## 開発目的

学校で学んだ Web 開発、データベース、API の知識を、実際に動作する Web アプリケーションとして形にするために個人開発しました。

フロントエンドだけでなく、バックエンド API、MySQL、認証・認可、セッション管理、クラウドデータベース、デプロイまで一通り実装し、Web アプリケーション全体の仕組みを理解することを目標にしています。

## 主な機能

- ユーザー登録
- ログイン
- セッション認証
- ユーザーごとのデータ管理
- 収入の登録・表示・編集・削除
- 支出の登録・表示・編集・削除
- 月ごとの収入・支出・残高表示
- 月切り替え
- 支出のカテゴリ別集計
- 収入と支出のグラフ表示
- REST API を利用したフロントエンド / バックエンド連携

## 使用技術

### Frontend
- HTML
- CSS
- JavaScript
- Chart.js

### Backend
- Node.js
- Express
- bcrypt
- express-session
- express-mysql-session

### Database
- MySQL
- mysql2
- Aiven for MySQL

### Deployment / Tools
- Render
- Git / GitHub
- VS Code
- dotenv

## システム構成

```text
Browser
  |
  | HTTP / JSON
  v
Frontend
HTML / CSS / JavaScript
  |
  | REST API
  v
Node.js / Express
  |
  | Session Authentication
  | SQL
  v
Aiven MySQL
```

本番環境では、Node.js / Express アプリケーションを Render にデプロイし、Aiven の MySQL データベースへ接続しています。

## 認証・認可

ユーザー登録時のパスワードは、`bcrypt` を利用してハッシュ化してから保存しています。

ログイン成功後は `express-session` でセッションを作成し、HttpOnly Cookie を利用してセッションを管理しています。

認証が必要な API では、フロントエンドから送信されたユーザー ID をそのまま信用せず、サーバー側のセッションからログイン中のユーザー ID を取得しています。

また、更新・削除時にはデータ ID とユーザー ID の両方を条件にすることで、他のユーザーのデータを操作できないようにしています。

## API の例

### Authentication
```text
POST /api/register
POST /api/login
POST /api/logout
GET  /api/me
```

### Income
```text
GET    /api/income/:userId
POST   /api/income
PUT    /api/income/:id
DELETE /api/income/:id
```

### Expenses
```text
GET    /api/expenses/:userId
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id
GET    /api/expenses/breakdown/:userId
```

### Dashboard
```text
GET /api/dashboard/:userId?year=YYYY&month=MM
```

一部の URL には `userId` が残っていますが、認証済み API では実際のユーザー ID をサーバー側のセッションから取得しています。

## 工夫した点

### 1. ユーザーごとのデータ分離
ログイン中のユーザー ID をセッションから取得し、収入・支出の登録、更新、削除に利用しています。

### 2. パスワードを平文保存しない
`bcrypt` を利用してパスワードをハッシュ化し、データベースには元のパスワードを保存しない構成にしています。

### 3. 月別表示を連動
月を切り替えると、Dashboard、Income History、Expense History、Expense Breakdown、Chart が同じ選択月に連動して更新されます。

### 4. API と DB を分離
フロントエンドから MySQL を直接操作せず、Express API を経由してデータを取得・更新しています。

### 5. SQL プレースホルダー
SQL 実行時には `?` プレースホルダーを利用し、SQL 文と値を分離しています。

### 6. 環境変数
DB 接続情報や `SESSION_SECRET` はソースコードへ直接記述せず、環境変数で管理しています。`.env` は Git の管理対象外にしています。

## 開発で苦労したこと

特に苦労したのは、フロントエンド、API、データベース、本番環境を連携させる部分です。

開発中には、月別データ取得、API と DB の連携、テーブル名や SQL 条件、ローカル環境と本番環境の差、クラウド DB 接続、セッション管理、HTML 構造による UI 不具合などが発生しました。

その際は、ブラウザの Developer Tools、サーバーログ、API レスポンス、MySQL のデータを確認し、問題がフロントエンド・バックエンド・データベースのどこで発生しているのかを一つずつ切り分けて修正しました。

この経験から、エラー発生時に推測だけで原因を決めず、ログや実際のデータを確認しながら検証することの重要性を学びました。

## ローカル環境での起動方法

### 1. Clone
```bash
git clone https://github.com/Keii-boy/Moneywise.git
cd Moneywise/backend
```

### 2. Install
```bash
npm install
```

### 3. Environment Variables
`backend/.env` を作成します。

```env
DB_HOST=your_host
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_database
SESSION_SECRET=your_session_secret
```

### 4. Start
```bash
node server.js
```

### 5. Open
```text
http://localhost:3000
```

## 今後の改善予定

- Logout UI の追加
- 入力値検証の強化
- Login rate limiting
- Helmet などを利用した security headers
- CSRF 対策
- API URL の整理
- UI / UX の改善
- Responsive Design の改善
- テストコードの追加
- Database index の最適化
- Aiven SSL 証明書検証の強化

## 学んだこと

- Frontend / Backend の役割
- REST API
- MySQL / SQL
- CRUD
- 認証と認可
- Session / Cookie
- Password Hashing
- Environment Variables
- Git / GitHub Branch Workflow
- Cloud Database
- Production Deployment
- Debugging

## Author

SO PYAY OO  
日本工学院八王子専門学校  
AIシステム科
