import FilterButton from '../components/FilterButton';
import TrendCard from '../components/TrendCard';
import {
  Section, ResultsHeader, HeaderLeft, DoneLabel, RepoTitle, DateSub, ResetBtn,
  SummaryBar, SummaryText, Highlight, SummaryDots, DotItem, Dot, FilterRow, CardsList,
  EmptyState, EmptyEmoji, EmptyTitle, EmptyDesc,
} from '../components/ResultsView/ResultsView.styled';
import { CATS, CatKey, FilterKey } from '../data';
import { useLocation } from 'react-router-dom';

interface Props {
  repoDisplay: string;
  filter: FilterKey;
  openId: string | null;
  onFilterChange: (key: FilterKey) => void;
  onToggleCard: (id: string) => void;
  onReset: () => void;
}

interface FilterDef {
  key: FilterKey;
  label: string;
}

type cat = "replace" | "apply" | "impact";
interface IResult {
  id: string,
  category: cat,
  relevanceScore: number,
  title: string,
  source: {
    name: string,
      url: string,
      publishedAt: string
  },
  reason: string,
  relatedFile: string,
  detail: string,
  recommendedAction: string,
}

const FILTERS: FilterDef[] = [
  { key: 'all',     label: '전체' },
  { key: 'replace', label: '대체후보' },
  { key: 'apply',   label: '신규적용' },
  { key: 'impact',  label: '영향' },
];

export default function ResultsView({
  filter, openId, onFilterChange, onToggleCard, onReset,
}: Props) {
  const location = useLocation();
  const result = location.state.result;
  console.log(result);

  const allResults = result["results"] ?? [];
  const visibleCards = allResults
    .filter((d:IResult) => filter === 'all' || d.category === filter)
    .sort((a:any, b:any) => b.relevanceScore - a.relevanceScore);

  if (allResults.length === 0) {
    return (
      <Section>
        <ResultsHeader>
          <HeaderLeft>
            <DoneLabel>분석 완료</DoneLabel>
            <RepoTitle>{result["repoFullName"]}</RepoTitle>
            <DateSub>{result["analyzedAt"].split("T")[0]} 트렌드 기준 분석</DateSub>
          </HeaderLeft>
          <ResetBtn onClick={onReset}>다시 분석</ResetBtn>
        </ResultsHeader>

        <EmptyState>
          <EmptyEmoji>🔍</EmptyEmoji>
          <EmptyTitle>이 레포와 맞닿은 오늘의 트렌드가 없어요</EmptyTitle>
          <EmptyDesc>
            CodePulse는 오늘 수집한 AI 트렌드 중 <b>이 코드와 직접 연관된 것만</b> 골라
            보여드려요. 지금은 이 레포에 해당하는 게 없네요.
            <br />
            AI·ML 성격의 레포(예: LLM·RAG·에이전트 프로젝트)로 시도하면 결과가 더 잘 나와요.
          </EmptyDesc>
        </EmptyState>
      </Section>
    );
  }

  return (
    <Section>
      <ResultsHeader>
        <HeaderLeft>
          <DoneLabel>분석 완료</DoneLabel>
          <RepoTitle>{result["repoFullName"]}</RepoTitle>
          <DateSub>{result["analyzedAt"].split("T")[0]} 트렌드 기준 분석</DateSub>
        </HeaderLeft>
        <ResetBtn onClick={onReset}>다시 분석</ResetBtn>
      </ResultsHeader>

      <SummaryBar>
        <SummaryText>
          오늘 수집한 트렌드 중{' '}
          <Highlight>{result["results"].length}개</Highlight>가 이 레포와 맞닿아 있어요.
        </SummaryText>
        <SummaryDots>
          {(Object.entries(CATS) as [CatKey, typeof CATS[CatKey]][]).map(([key, cat]) => (
            <DotItem key={key}>
              <Dot $color={cat.accent} />
              {cat.label} {result["results"].filter((res:IResult) => res["category"] == key).length}
            </DotItem>
          ))}
        </SummaryDots>
      </SummaryBar>

      <FilterRow>
        {FILTERS.map(f => (
          <FilterButton
            key={f.key}
            label={f.label}
            count={f.key == 'all' ? result["results"].length :result["results"].filter((res:IResult) => res["category"] == f.key).length}
            active={filter === f.key}
            onClick={() => onFilterChange(f.key)}
          />
        ))}
      </FilterRow>

      <CardsList>
        {visibleCards.map((item:any, idx:number) => (
          <TrendCard
            key={item.id}
            item={item}
            delay={idx * 0.04}
            openId={openId}
            onToggle={onToggleCard}
          />
        ))}
      </CardsList>
    </Section>
  );
}
