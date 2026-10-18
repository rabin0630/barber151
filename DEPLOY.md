# 本番環境(EC2)へのデプロイ

```
ブラウザ → nginx(HTTPS・静的ファイル) ─/api/→ FastAPI → SQLite(ボリューム db-data)
```

- 開発用: `docker-compose.yml` と各 `Dockerfile`(Viteの開発サーバー、`--reload`)
- 本番用: `docker-compose.prod.yml` と各 `Dockerfile.prod`

## イメージのビルド

`main` に push すると、GitHub Actions(`.github/workflows/deploy.yml`)がテストを通してから、次の2つを GHCR に push する。

- `ghcr.io/rabin0630/barber151-backend:latest`
- `ghcr.io/rabin0630/barber151-frontend:latest`

GHCR のパッケージは最初は非公開。EC2 で `docker login ghcr.io`(`read:packages` 権限の PAT を使う)をするか、パッケージを公開にする。

## 管理用API

次のAPIは `Authorization: Bearer <ADMIN_TOKEN>` がないと 401 を返す。管理画面(`/admin`)を開くとパスワード(`ADMIN_TOKEN` の値)を聞かれる。ポートフォリオのデモでは `test` にして公開している。

- `POST /menus`、`PUT /menus/{id}`、`DELETE /menus/{id}`
- `GET /admin/reservations`(お客様の名前つきの予約)
- `GET /history`

`GET /reservations` はだれでも呼べるが、予約の時間帯だけを返す。

## 初回のセットアップ

EC2 には `docker-compose.prod.yml`、`nginx/`、`.env` だけを置く。セキュリティグループで 80 と 443 を開けておく。

```sh
cp .env.prod.example .env   # DOMAIN、ADMIN_TOKEN、DEMO_DATAを書く
```

証明書を取る。nginx がまだ動いていないので、certbot が直接 80 番で受ける。

```sh
source .env
docker compose -f docker-compose.prod.yml run --rm -p 80:80 --entrypoint certbot certbot \
  certonly --standalone -d "$DOMAIN" --email you@example.com --agree-tos --no-eff-email
```

起動する。

```sh
docker compose -f docker-compose.prod.yml up -d
```

証明書は certbot コンテナが12時間ごとに更新し、nginx が6時間ごとに読み込み直す。

## 更新

```sh
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## デモ用のダミーデータ

ポートフォリオで予約画面も管理画面も触ってもらうための仕組み。`DEMO_DATA=true` のときだけ動く。

- 起動するたびに予約をすべて消し、明日から2週間分のダミーの予約(定休日の月・火を除く)を入れ直す。お客様は著名人の名前と Instagram の ID
- 起動した後に作られた予約は、予約画面・管理画面のどちらから作ったものも、5分たつと消える(予約一覧などを開いた時に消す)

予約がすべて消えるので、お店で実際に使う時は `DEMO_DATA=false` にする。

ダミーの予約を入れ直したいときは、バックエンドを再起動する。

```sh
docker compose -f docker-compose.prod.yml restart backend
```
