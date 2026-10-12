"""アプリ共通の例外(AppError)"""
class AppError(Exception):
    """アプリのルールに合わない時に投げる例外

    main.pyの例外ハンドラーが、status_codeと{"detail": detail}のレスポンスにする。
    detailはフロントエンドがそのまま画面に出すので、利用者向けの文章にする。

    Attributes:
        status_code (int): 返すHTTPのステータスコード
        detail (str): エラーの内容

    Examples:

        >>> raise AppError(400, "無効なメニューです。")
    """

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
