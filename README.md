# Barber151

![deploy](https://github.com/rabin0630/barber151/actions/workflows/deploy.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg)
![AWS](https://img.shields.io/badge/AWS-EC2-FF9900.svg)

**🔗 デモ: https://junrabin.com**

<img width="1980" height="1080" alt="hero-barber" src="https://github.com/user-attachments/assets/6fbe1fc5-ac8d-4cfc-9d49-17c93c98bd9e" />

理容室の Web 予約システムです。
お客様はスマホからメニューと空いている日時を選ぶだけで予約でき、お店は管理画面で予約の確認やお客様への連絡ができます。

<!-- TODO: スクリーンショット(予約画面・管理画面) -->

## 目次

- [作成した目的](#作成した目的)
- [開発で意識したこと](#開発で意識したこと)
  - [UI・UX](#uiux)
  - [実装](#実装)
- [使った技術](#使った技術)

## 作成した目的

### 1. プログラミング言語の習得

参画するプロジェクトで使用する言語を習得するために作成しました。

### 2. システム開発の流れを学ぶ

社長から「**技術は、誰かの役に立つシステムを作るためのもの**」と教わりました。
この考えをもとに、実際に役立つシステムを考え、開発し、お店への提案（商談）まで行いました。
その結果、**企画からリリースまでの流れを実践の中で学ぶ**ことができました。

## 開発で意識したこと

### UI・UX

**使う人の立場に立った UI・UX** を意識しました。

| 使う人 | ページ | 概要 | 工夫 |
| --- | --- | --- | --- |
| お客様 | `booking.html` | メニューを選んで予約する | ウィザード形式で、迷わず進めるようにした |
| 店長 | `admin.html` | 予約情報を管理する | お店のホワイトボードを参考にした、オーダーメイドの UI |
| 面接官 | `tutorial.html`, `README.md` | アプリを説明する | 口頭で説明しなくても伝わるようにした |

#### アピールポイント

**① 予約ボードからお客様へ直接連絡できる（`admin.html`）**

これまでお店では、ホワイトボードに名前と連絡先を手書きし、連絡するときは Instagram を開いて手動で相手を探していました。
このアプリでは **Instagram 名をタップするだけで、そのアカウントへ直接移動** できます。デジタル化ならではの利点です。

<p>
  <img width="448" height="274" alt="予約ボード" src="https://github.com/user-attachments/assets/73facfa7-01c0-43d3-8685-1cabe675e811" />
  <img width="467" height="273" alt="Instagramへの遷移" src="https://github.com/user-attachments/assets/6cbe7619-1310-4059-92d5-362d39df03d0" />
</p>

**② 1 分以内で予約できる（`booking.html`）**

電話予約より手軽でなければ、お客様には使ってもらえません。
そこで **ログインなどの認証をなくし、1 分以内で予約が完了する** ようにしました。

**③ `tutorial.html` と `README.md` の整備**

面接官の方に、このアプリの魅力がより伝わるように整備しました。

---
### 実装

**開発しやすい環境づくり** を意識して実装しました。

#### 1. 開発スピードを上げる技術の導入

Docker Compose や CI/CD を取り入れ、**アイデアを形にして店長に提案するまでの時間** を大幅に短縮しました。

#### 2. コードレビューのしやすさ

私は実務経験がまだ浅いため、自分の書いたコードは「まだ信頼されていないもの」という前提で開発しています。
少しでもレビューの時間を短くできるよう、次の 4 点を常に意識しています。

- 可読性
- 保守性
- 再利用性
- ドキュメントの充実

#### 3. GitHub の活用

普段から GitHub の **Issues を ToDo リストとして活用** しています。タスクの抜け漏れがなくなり、とても気に入っています。

## 使った技術

| 分類 | 技術 |
| --- | --- |
| フロントエンド | TypeScript、Vite（フレームワークなし） |
| バックエンド | Python 3.12、FastAPI、SQLAlchemy、SQLite |
| テスト | pytest（単体テスト・API の結合テスト） |
| インフラ | AWS EC2、Docker Compose、nginx、Let's Encrypt（certbot） |
| CI/CD | GitHub Actions、GitHub Container Registry（GHCR）、cron |
