import FilterButton from '../components/FilterButton';
import TrendCard from '../components/TrendCard';
import {
  Section, ResultsHeader, HeaderLeft, DoneLabel, RepoTitle, DateSub, ResetBtn,
  SummaryBar, SummaryText, Highlight, SummaryDots, DotItem, Dot, FilterRow, CardsList,
} from '../components/ResultsView/ResultsView.styled';
import { CATS, CatKey, DATA, FilterKey, SCORES } from '../data';

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

const FILTERS: FilterDef[] = [
  { key: 'all',     label: '전체' },
  { key: 'replace', label: '대체후보' },
  { key: 'apply',   label: '신규적용' },
  { key: 'impact',  label: '영향' },
];

export default function ResultsView({
  repoDisplay, filter, openId, onFilterChange, onToggleCard, onReset,
}: Props) {
  const counts: Record<FilterKey, number> = {
    all:     DATA.length,
    replace: DATA.filter(d => d.cat === 'replace').length,
    apply:   DATA.filter(d => d.cat === 'apply').length,
    impact:  DATA.filter(d => d.cat === 'impact').length,
  };

  const visibleCards = DATA
    .filter(d => filter === 'all' || d.cat === filter)
    .map(d => ({ ...d, score: SCORES[d.id] }))
    .sort((a, b) => b.score - a.score);

  return (
    <Section>
      <ResultsHeader>
        <HeaderLeft>
          <DoneLabel>분석 완료</DoneLabel>
          <RepoTitle>{repoDisplay}</RepoTitle>
          <DateSub>2026. 06. 28 트렌드 기준 분석</DateSub>
        </HeaderLeft>
        <ResetBtn onClick={onReset}>다시 분석</ResetBtn>
      </ResultsHeader>

      <SummaryBar>
        <SummaryText>
          오늘 수집한 트렌드 <b>142개</b> 중{' '}
          <Highlight>8개</Highlight>가 이 레포와 맞닿아 있어요.
        </SummaryText>
        <SummaryDots>
          {(Object.entries(CATS) as [CatKey, typeof CATS[CatKey]][]).map(([key, cat]) => (
            <DotItem key={key}>
              <Dot $color={cat.accent} />
              {cat.label} {counts[key]}
            </DotItem>
          ))}
        </SummaryDots>
      </SummaryBar>

      <FilterRow>
        {FILTERS.map(f => (
          <FilterButton
            key={f.key}
            label={f.label}
            count={counts[f.key]}
            active={filter === f.key}
            onClick={() => onFilterChange(f.key)}
          />
        ))}
      </FilterRow>

      <CardsList>
        {visibleCards.map((item, idx) => (
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
