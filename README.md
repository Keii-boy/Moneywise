# MoneyWise

MoneyWise は、毎月の収入と支出を記録し、月ごとの収支を分かりやすく確認できる家計管理 Web アプリケーションです。

## 開発目的

学校で学んだ Web 開発、データベース、API の知識を実際のアプリケーションとして形にするため、個人開発として制作しています。

フロントエンドだけでなく、バックエンド API、MySQL との連携、月別データの集計まで一連の処理を自分で実装し、Web アプリケーション全体の仕組みを理解することを目標にしています。

## 主な機能

- 収入の登録・表示・編集・削除
- 支出の登録・表示・編集・削除
- 月ごとの収入・支出・残高表示
- 月切り替え
- 支出のカテゴリ別集計
- 収入と支出のグラフ表示
- データベースとの連携
- REST API を利用したフロントエンド／バックエンド連携

## 使用技術

### Frontend
- HTML
- CSS
- JavaScript
- Chart.js

### Backend
- Node.js
- Express

### Database
- MySQL
- mysql2

### その他
- Git / GitHub
- dotenv
- CORS

## システム構成

```
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
  | SQL
  v
MySQL
```

フロントエンドから Express で作成した API を呼び出し、MySQL に保存されている収入・支出データを取得・更新しています。

## API の例

- `GET /api/dashboard/:userId?year=YYYY&month=MM`
  - 指定した月の収入、支出、残高を取得
- `GET /api/income/:userId`
  - 収入履歴を取得
- `POST /api/income`
  - 収入を登録
- `PUT /api/income/:id`
  - 収入を編集
- `DELETE /api/income/:id`
  - 収入を削除
- `GET /api/expenses/:userId`
  - 支出履歴を取得
- `POST /api/expenses`
  - 支出を登録
- `PUT /api/expenses/:id`
  - 支出を編集
- `DELETE /api/expenses/:id`
  - 支出を削除
- `GET /api/expenses/breakdown/:userId`
  - 支出をカテゴリ別に集計

## 工夫した点

### 1. 月別でデータを確認できるようにしたこと

収入と支出を月ごとに切り替えて確認できるようにし、ダッシュボード、履歴、支出内訳、グラフが同じ選択月に連動するよう実装しました。

### 2. API とデータベースを分けて考えたこと

フロントエンドから直接データベースを操作せず、Express で API を作成し、API 経由で MySQL を操作する構成にしました。

### 3. SQL のプレースホルダーを利用したこと

SQL 実行時には `?` のプレースホルダーを使用し、値を分けて渡す形で実装しています。

### 4. 環境変数で接続情報を管理したこと

データベース接続情報はソースコードに直接記述せず、`dotenv` を利用して環境変数から取得する構成にしています。

## 開発で苦労したこと

特に苦労したのは、フロントエンド、API、データベースを連携させる部分です。

月別データが正しく取得できない、API が想定どおりの結果を返さない、テーブル名や SQL の指定ミスなどの問題が発生しました。

その際は、ブラウザやサーバーのログ、API のレスポンス、SQL の実行結果を一つずつ確認し、どの処理で問題が起きているかを切り分けながら修正しました。

この経験から、エラーが発生した際に原因を一つずつ確認して解決することの重要性を学びました。

## 今後の改善予定

- ユーザー登録・ログイン機能
- 認証・認可の実装
- 入力値検証の強化
- API の構成整理
- UI / UX の改善
- テストコードの追加
- セキュリティ対策の強化

## セットアップ

### 1. Repository を clone

```bash
git clone https://github.com/Keii-boy/Moneywise.git
cd Moneywise/backend
```

### 2. Dependencies を install

```bash
npm install
```

### 3. 環境変数を設定

`backend/.env` を作成し、以下の形式でデータベース接続情報を設定します。

```env
DB_HOST=your_host
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_database
DB_PORT=3306
```

### 4. Server を起動

```bash
node server.js
```

ブラウザからサーバーへアクセスして利用します。

## 現在の状態

現在も開発を継続しており、機能追加やコード改善を進めています。

## Author

SO PYAY OO  
日本工学院八王子専門学校 AIシステム科
