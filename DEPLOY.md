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

次のAPIは `Authorization: Bearer <ADMIN_TOKEN>` がないと 401 を返す。管理画面(`/admin`)を開くとトークンを聞かれる。

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

`DEMO_DATA=true` のとき、予約が1件もなければ、明日から2週間分のダミーの予約(定休日の月・火を除く)を起動時に入れる。入れ直したいときは DB を消す。

```sh
docker compose -f docker-compose.prod.yml down
docker volume rm <プロジェクト名>_db-data   # docker volume ls で確認
docker compose -f docker-compose.prod.yml up -d
```
