from http import HTTPStatus


class CustomHTTPException(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = HTTPStatus.BAD_REQUEST,
    ) -> None:
        self.message = message
        self.status_code = int(status_code)
        super().__init__(message)


class MenuNotFoundError(CustomHTTPException):
    def __init__(self, message: str = "Menu not found") -> None:
        super().__init__(
            message=message,
            status_code=HTTPStatus.NOT_FOUND,
        )
