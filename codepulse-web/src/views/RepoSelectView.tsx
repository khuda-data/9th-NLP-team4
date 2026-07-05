import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchRepos, FetchReposError, GithubRepo } from '../utils/fetchRepos';
import {
  Section, TopRow, BackBtn, HeroH1, HeroP, Grid, RepoCard, RepoTitleRow,
  RepoTitle, ForkTag, RepoDesc, MetaRow, LangDot, ActionBar, SelectedLabel,
  PulseBtn, StateBox, RetryBtn,
} from '../components/RepoSelectView/RepoSelectView.styled';

interface Props {
  onRepoChange: (val: string) => void;
}

// 언어별 대표 색상. 목록에 없으면 회색으로 표시한다.
const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', HTML: '#e34c26',
  CSS: '#563d7c', Shell: '#89e051', Jupyter: '#DA5B0B', Vue: '#41b883',
};

function langColor(lang: string | null): string {
  if (!lang) return '#c8c8c8';
  return LANG_COLORS[lang] ?? '#8a8a8a';
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return '오늘 업데이트';
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}일 전 업데이트`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전 업데이트`;
  return `${Math.floor(months / 12)}년 전 업데이트`;
}

export default function RepoSelectView({ onRepoChange }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const username: string | undefined = location.state?.username;

  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!username) {
      navigate('/');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRepos(username)
      .then(list => {
        if (cancelled) return;
        setRepos(list);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof FetchReposError ? err.message : '레포 목록을 불러오지 못했어요.');
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const selected = repos.find(r => r.id === selectedId) ?? null;

  const onCodePulse = () => {
    if (!selected) return;
    onRepoChange(selected.html_url);
    navigate('/analyzing', { state: { url: selected.html_url } });
  };

  return (
    <Section>
      <TopRow>
        <BackBtn onClick={() => navigate('/')}>← 뒤로</BackBtn>
      </TopRow>

      <HeroH1><b>@{username}</b> 의 레포지토리</HeroH1>
      <HeroP>분석할 레포를 하나 고르고 아래 <b>CodePulse</b> 버튼을 눌러주세요.</HeroP>

      {loading && <StateBox>레포 목록을 불러오는 중…</StateBox>}

      {!loading && error && (
        <StateBox>
          {error}
          <div>
            <RetryBtn onClick={() => navigate('/')}>아이디 다시 입력</RetryBtn>
          </div>
        </StateBox>
      )}

      {!loading && !error && repos.length === 0 && (
        <StateBox>
          공개된 레포지토리가 없어요.
          <div>
            <RetryBtn onClick={() => navigate('/')}>아이디 다시 입력</RetryBtn>
          </div>
        </StateBox>
      )}

      {!loading && !error && repos.length > 0 && (
        <Grid>
          {repos.map(repo => (
            <RepoCard
              key={repo.id}
              $selected={repo.id === selectedId}
              onClick={() => setSelectedId(repo.id)}
            >
              <RepoTitleRow>
                <RepoTitle>{repo.name}</RepoTitle>
                {repo.fork && <ForkTag>fork</ForkTag>}
              </RepoTitleRow>
              <RepoDesc>{repo.description || '설명이 없는 레포지토리'}</RepoDesc>
              <MetaRow>
                {repo.language && <LangDot $color={langColor(repo.language)}>{repo.language}</LangDot>}
                <span>★ {repo.stargazers_count}</span>
                <span>{relTime(repo.updated_at)}</span>
              </MetaRow>
            </RepoCard>
          ))}
        </Grid>
      )}

      {selected && (
        <ActionBar>
          <SelectedLabel>선택됨: <b>{selected.name}</b></SelectedLabel>
          <PulseBtn onClick={onCodePulse}>CodePulse ⚡</PulseBtn>
        </ActionBar>
      )}
    </Section>
  );
}
