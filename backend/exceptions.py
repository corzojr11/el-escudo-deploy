class ApiException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail

class NotFoundException(ApiException):
    def __init__(self, item: str):
        super().__init__(status_code=404, detail=f"{item} no encontrado.")

class BadRequestException(ApiException):
    def __init__(self, reason: str):
        super().__init__(status_code=400, detail=reason)
