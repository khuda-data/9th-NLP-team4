from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    repoUrl: str
