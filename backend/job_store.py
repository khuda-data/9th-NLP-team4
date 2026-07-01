from copy import deepcopy
from typing import Any


_jobs: dict[str, dict[str, Any]] = {}


def create_job(job_id: str, repo_full_name: str) -> dict[str, Any]:
    job = {
        "jobId": job_id,
        "repoFullName": repo_full_name,
        "status": "analyzing",
        "currentStep": 0,
        "result": None,
        "error": None,
    }
    _jobs[job_id] = job
    return deepcopy(job)


def get_job(job_id: str) -> dict[str, Any] | None:
    job = _jobs.get(job_id)
    return deepcopy(job) if job else None


def update_job(job_id: str, **updates: Any) -> None:
    if job_id in _jobs:
        _jobs[job_id].update(updates)
