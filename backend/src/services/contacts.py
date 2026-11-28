"""予約の連絡先(InstagramのID・電話番号)を、保存する形に整えて確かめる"""
import re

from src.exceptions import AppError

## 電話番号の形式。区切りを取り除いた後の数字11桁
PHONE_NUMBER_PATTERN = re.compile(r"[0-9]{11}")

## 電話番号から取り除く区切り(空白・いろいろなハイフン・長音)
PHONE_NUMBER_SEPARATORS = re.compile(r"[\s\-‐‑–—−ー－]")

## 全角数字を半角数字にする変換表
FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")

## InstagramのIDの形式。英数字・ピリオド・アンダースコアで30文字以内
INSTAGRAM_ID_PATTERN = re.compile(r"[A-Za-z0-9._]{1,30}")


def normalize_instagram_id(instagram_id: str | None) -> str | None:
    """InstagramのIDから前後の空白と先頭の@を取り除き、形式を確かめる

    Args:
        instagram_id (str | None): 入力されたInstagramのID

    Returns:
        str | None: 取り除いた後のID。空ならNone

    Raises:
        AppError: 形式が正しくない時(400)
    """
    instagram_id = (instagram_id or "").strip().removeprefix("@")
    if not instagram_id:
        return None
    if not INSTAGRAM_ID_PATTERN.fullmatch(instagram_id):
        raise AppError(400, "Instagram IDは英数字・ピリオド・アンダースコアの30文字以内で入力してください。")
    return instagram_id


def normalize_contacts(instagram_id: str | None, phone_number: str | None) -> tuple[str | None, str | None]:
    """InstagramのIDと電話番号を保存する形に整え、どちらかがあるか確かめる

    電話番号は090-1234-5678や全角数字も受け付け、数字だけにする。空白だけの入力は入力なしとして扱う。

    Args:
        instagram_id (str | None): 入力されたInstagramのID
        phone_number (str | None): 入力された電話番号

    Returns:
        tuple[str | None, str | None]: 整えた後の(InstagramのID, 電話番号)

    Raises:
        AppError: 次のどれかの時(400)
            - InstagramのIDも電話番号もない
            - InstagramのIDか電話番号の形式が正しくない
    """
    instagram_id = normalize_instagram_id(instagram_id)
    phone_number = (phone_number or "").strip() or None
    if not instagram_id and not phone_number:
        raise AppError(400, "Instagram ID または 電話番号のどちらかを入力してください。")
    if phone_number:
        phone_number = PHONE_NUMBER_SEPARATORS.sub("", phone_number.translate(FULLWIDTH_DIGITS))
        if not PHONE_NUMBER_PATTERN.fullmatch(phone_number):
            raise AppError(400, "電話番号は数字11桁で入力してください。")
    return instagram_id, phone_number
