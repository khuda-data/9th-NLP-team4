export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  fork: boolean;
  archived: boolean;
}

export class FetchReposError extends Error {
  constructor(public code: 'NOT_FOUND' | 'RATE_LIMIT' | 'NETWORK' | 'UNKNOWN', message: string) {
    super(message);
    this.name = 'FetchReposError';
  }
}

/**
 * GitHub 공개 API로 해당 유저의 공개 레포 목록을 최근 업데이트순으로 가져온다.
 * 인증 없이 호출하면 시간당 60회 제한이 있으므로 403(rate limit)을 별도 처리한다.
 */
export async function fetchRepos(username: string): Promise<GithubRepo[]> {
  const user = username.trim().replace(/^@/, '');
  if (!user) {
    throw new FetchReposError('UNKNOWN', 'GitHub 아이디를 입력해주세요.');
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=100`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
  } catch {
    throw new FetchReposError('NETWORK', '네트워크 오류로 레포 목록을 불러오지 못했어요.');
  }

  if (res.status === 404) {
    throw new FetchReposError('NOT_FOUND', `'${user}' 라는 GitHub 사용자를 찾을 수 없어요.`);
  }
  if (res.status === 403 || res.status === 429) {
    throw new FetchReposError(
      'RATE_LIMIT',
      'GitHub API 호출 한도(시간당 60회)를 초과했어요. 잠시 후 다시 시도해주세요.',
    );
  }
  if (!res.ok) {
    throw new FetchReposError('UNKNOWN', `레포 목록을 불러오지 못했어요. (HTTP ${res.status})`);
  }

  const data = (await res.json()) as GithubRepo[];
  // GitHub의 sort=updated는 이미 최근순이지만, 방어적으로 한 번 더 정렬한다.
  return data.slice().sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}
