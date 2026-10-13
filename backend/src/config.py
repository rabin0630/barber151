"""APIの設定値(.envから読んだ値)をまとめる"""
import os

from dotenv import load_dotenv

# .envにある情報を読み込む
load_dotenv()

## DBの接続先。書いていなければbackend直下のSQLiteを使う
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./barber151.db")

## CORSで許可するフロントエンドのURL。カンマ区切り。書いていなければすべて許可(開発用)
CORS_ORIGINS: list[str] = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

## 管理用APIのトークン。空なら管理用APIはすべて拒否する
ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "")

## trueなら、予約が1件もない時にダミーの予約を入れる(デモ公開用)
DEMO_DATA: bool = os.getenv("DEMO_DATA", "false").lower() == "true"
