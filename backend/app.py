from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from datetime import datetime, timedelta

app = FastAPI()

# フロントエンド（HTML/JS）からの通信を許可するCORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発用（本番環境ではフロントエンドのURLを指定します）
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "barber151.db"

# アプリケーション起動時にデータベースとテーブルを作成する関数
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # is_activeを省いたシンプルなメニューテーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS menus (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            duration INTEGER NOT NULL
        )
    ''')
    
    # 予約テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            customer_contact TEXT NOT NULL,
            menu_id TEXT NOT NULL,
            start_datetime DATETIME NOT NULL,
            end_datetime DATETIME NOT NULL,
            status TEXT DEFAULT 'confirmed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (menu_id) REFERENCES menus(id)
        )
    ''')
    
    # 初回起動時のみ、初期メニューを自動で登録する
    cursor.execute('SELECT count(*) FROM menus')
    if cursor.fetchone()[0] == 0:
        menus = [
            ('cut', 'カット', 5000, 1),
            ('color', 'カラー', 8000, 2),
            ('perm', 'パーマ', 10000, 3)
        ]
        cursor.executemany('INSERT INTO menus (id, name, price, duration) VALUES (?, ?, ?, ?)', menus)
        
    conn.commit()
    conn.close()

init_db()

# フロントエンドから送られてくるデータの型定義（バリデーション）
class ReservationRequest(BaseModel):
    name: str
    contact: str
    menu_id: str
    reservation_date: str  # ISO8601形式の文字列

@app.get("/reservations")
def get_reservations():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # 確定済みの予約データをすべて取得
        cursor.execute('''
            SELECT r.start_datetime, r.end_datetime, m.name, r.customer_name
            FROM reservations r
            JOIN menus m ON r.menu_id = m.id
            WHERE status = 'confirmed'
        ''')
        rows = cursor.fetchall()
        reservations = [{"start_datetime": r[0], "end_datetime": r[1], "menu_name": r[2], "customer_name": r[3]} for r in rows]
        return {"reservations": reservations}
    finally:
        conn.close()

@app.get("/history")
def get_history():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # 予約が作成された履歴を最新順に10件取得
        cursor.execute('''
            SELECT r.created_at, r.customer_name, r.start_datetime, m.name
            FROM reservations r
            JOIN menus m ON r.menu_id = m.id
            ORDER BY r.created_at DESC
            LIMIT 10
        ''')
        rows = cursor.fetchall()
        history = [{
            "created_at": r[0],
            "customer_name": r[1],
            "start_datetime": r[2],
            "menu_name": r[3]
        } for r in rows]
        return {"history": history}
    finally:
        conn.close()

@app.post("/reservations")
def create_reservation(req: ReservationRequest):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # 1. 選択されたメニューの所要時間をDBから取得する
        cursor.execute('SELECT duration FROM menus WHERE id = ?', (req.menu_id,))
        menu = cursor.fetchone()
        if not menu:
            raise HTTPException(status_code=400, detail="無効なメニューです。")
        
        duration = menu[0]
        
        # 2. 開始時間と終了時間を計算する（JavaScriptのtoISOString形式に対応）
        start_str = req.reservation_date.replace('Z', '+00:00')
        start_dt = datetime.fromisoformat(start_str)
        end_dt = start_dt + timedelta(hours=duration)
        
        # 3. 重複予約のチェック（すでに他の予約が入っていないか？）
        cursor.execute('''
            SELECT count(*) FROM reservations 
            WHERE status = 'confirmed' 
            AND start_datetime < ? AND end_datetime > ?
        ''', (end_dt.isoformat(), start_dt.isoformat()))
        
        if cursor.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="申し訳ありません。この時間はすでに予約が埋まっています。")
        
        # 4. 問題なければ予約を登録する
        cursor.execute('''
            INSERT INTO reservations (customer_name, customer_contact, menu_id, start_datetime, end_datetime)
            VALUES (?, ?, ?, ?, ?)
        ''', (req.name, req.contact, req.menu_id, start_dt.isoformat(), end_dt.isoformat()))
        
        conn.commit()
        return {"message": "予約が完了しました！"}
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="サーバーエラーが発生しました。")
    finally:
        conn.close()