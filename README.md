# Barber151(https://junrabin.com)

![deploy](https://github.com/rabin0630/barber151/actions/workflows/deploy.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg)
![AWS](https://img.shields.io/badge/AWS-EC2-FF9900.svg)

理容室の Web 予約システムです。お客様はスマホからメニューと空いている日時を選ぶだけで予約でき、お店は管理画面で予約を見たり、お客様に連絡したりできます。

<!-- TODO: スクリーンショット(予約画面・管理画面) -->

## できること

| 画面 | 使う人 | やること |
| --- | --- | --- |
| 予約画面 | お客様 | メニューを選ぶ → 空いている日時を選ぶ → 名前と連絡先を入れて予約 |
| 管理画面 | お店 | 予約一覧を見る。お客様の行を押すと、電話や Instagram で連絡できる |
| 管理画面 | お店 | 電話でもらった予約の追加、予約の削除 |
| 管理画面 | お店 | メニューの追加・変更・削除 |



## データベース設計

テーブルはメニューと予約の 2 つだけです。1 つのメニューに、複数の予約がつきます。

**menus**（メニュー）

| カラム | 型 | 中身 |
| --- | --- | --- |
| id | int | 主キー |
| category | string | 施術する大分類のカテゴリ |
| name | string | 施術する詳細のメニュー名 |
| price | int | いくらか |
| duration | int | 施術時間 |
| is_active | bool | お客さんが選べるメニューなのか。 |

**reservations**（予約）

| カラム | 型 | 中身 |
| --- | --- | --- |
| id | int | 主キー |
| customer_name | string | お客様の名前 |
| instagram_id | string | お客様のInstagramのID |
| phone_number | string | お客様の電話番号 |
| menu_id | int | `menus.id` の外部キー |
| start_datetime | datetime |　施術開始時間 |
| end_datetime | datetime | 施術終了時間 |
| status | string | 予約がキャンセルされたかどうかを判断 |
| created_at | datetime | 予約を作った日時 |

- メニューを消しても過去の予約からメニュー名が引けるように、削除は `is_active` を false にするだけにしています（論理削除）
- 予約には終了日時も持たせて、予約が重なっていないかを開始・終了の範囲で確かめています
- 日時はすべて UTC で保存して、画面に出すときにブラウザの時刻（日本なら日本時間）に直しています

## 使った技術

| 分類 | 技術 |
| --- | --- |
| フロントエンド | TypeScript、Vite（フレームワークなし） |
| バックエンド | Python 3.12、FastAPI、SQLAlchemy、SQLite |
| テスト | pytest（単体テストと API の結合テスト） |
| インフラ | AWS EC2、Docker Compose、nginx、Let's Encrypt（certbot） |
| CI/CD | GitHub Actions、GitHub Container Registry（GHCR）、cron |

```
ブラウザ → nginx(HTTPS・静的ファイル) ─/api/→ FastAPI → SQLite
```

## 工夫したこと

### お客様と店長が使いやすいデザイン

できるだけシンプルなUIになるように、お客様の画面はプログラムが質問をして回答する**ウィザード形式**にし、店長の画面は予約リストを必要な情報だけを表示し、名前を押下したら詳細が出るようにしました。

- **お客様**:
  - 「①メニュー選択 → ②日時選択 → ③内容確認」の形式にし、いらない情報を書かないようにしました
  - シンプルを追求したため、お客さんの認証はなしにしました。しかし必要に応じてLineやGoogleなどのAPIを利用した認証を導入予定です
  - 埋まっている時間などは選択できず、入力フォームの不備があると次へ行けないので、入力ミスで予約に失敗しません
  -  年配方が使うことも考慮し、文字の大きさや表をデカくしました。
- **店長**:
  - 予約一覧に詳細モーダルを導入しました。予約情報の編集・そのまま電話をかけたり Instagram のプロフィールを開いたりできます
  - 電話でもらった予約も管理画面から入れられるので、予約をひとつの画面で管理できます

### Docker でコマンド 1 つでサーバーが立ち上がる

開発中はフロントエンド、バックエンドのサーバーを1つずつコマンド打ってリスタートしていましたが、Dockerを導入することでコマンド一つでサーバーが立ち上がるようにしました。

| 場面 | コマンド | 立ち上がるもの |
| --- | --- | --- |
| 開発・動作確認 | `docker compose up --build` | フロントエンド（Vite）、バックエンド（FastAPI） |
| テスト | `docker compose run --rm backend python -m pytest` | バックエンドのコンテナの中でテストを実行 |
| 本番（EC2） | `docker compose -f docker-compose.prod.yml up -d` | nginx、バックエンド、certbot |

### GitHub Actions の CI/CD と cron で自動デプロイ

GitHub Actions の CI/CD と cron を使って、main に push するだけで本番に反映されるようにしました。

- **CI**: push するとテストが走り、落ちたら本番用のイメージを作らないので、壊れたコードは本番に出ません（[deploy.yml](.github/workflows/deploy.yml)）
- **CD**: テストが通ると、本番用の Docker イメージを GHCR に push します
- **cron**: EC2 の cron が定期的に新しいイメージを pull して、コンテナを入れ替えます <!-- TODO: 実際の crontab の間隔を書く -->

