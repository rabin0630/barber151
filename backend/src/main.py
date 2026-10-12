"""FastAPIのアプリを作り、ルーターと例外ハンドラーを登録する"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src import config
from src import models  # noqa: F401  create_allの前にテーブル定義を読み込む
from src.database import Base, SessionLocal, engine
from src.exceptions import AppError
from src.routers import menus_routers, reservations_routers
from src.services import menu_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """APIの起動時に、テーブルがなければ作り、メニューがなければ初期データを入れる

    Args:
        app (FastAPI): FastAPIのアプリ

    Yields:
        None: ここでAPIが動き、止まる時に戻ってくる
    """
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        menu_service.seed_menus(db)
    yield


app = FastAPI(lifespan=lifespan)

# フロントエンド(HTML/JS)からの通信を許可する
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(menus_routers.router)
app.include_router(reservations_routers.router)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """AppErrorを、HTTPのエラーのレスポンスにする

    Args:
        request (Request): 受け取ったリクエスト
        exc (AppError): servicesなどが投げた例外

    Returns:
        JSONResponse: exc.status_codeのステータスと、{"detail": exc.detail}
    """
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
