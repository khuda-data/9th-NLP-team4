import styled from 'styled-components';
import FilterButton from '../components/FilterButton';
import TrendCard from '../components/TrendCard';
import { BRAND, CATS, CatKey, DATA, FilterKey, SCORES } from '../data';

interface Props {
  repoDisplay: string;
  filter: FilterKey;
  openId: string | null;
  onFilterChange: (key: FilterKey) => void;
  onToggleCard: (id: string) => void;
  onReset: () => void;
}

const Section = styled.section`
  padding: 44px 28px 96px;
`;

const ResultsHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div``;

const DoneLabel = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: #428bff;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  margin-bottom: 8px;
`;

const RepoTitle = styled.h2`
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.5px;
`;

const DateSub = styled.div`
  font-size: 13.5px;
  color: #929292;
  margin-top: 6px;
`;

const ResetBtn = styled.button`
  flex: none;
  height: 46px;
  padding: 0 20px;
  border: 1px solid #222222;
  border-radius: 8px;
  background: #ffffff;
  color: #222222;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
  transition: background 0.15s;

  &:hover {
    background: #f7f7f7;
  }
`;

const SummaryBar = styled.div`
  margin-top: 26px;
  padding: 22px 24px;
  background: #f7f7f7;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
`;

const SummaryText = styled.div`
  font-size: 16px;
  color: #222222;
  line-height: 1.5;

  b { font-weight: 700; }
`;

const Highlight = styled.b`
  font-weight: 700;
  color: ${BRAND};
`;

const SummaryDots = styled.div`
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
`;

const DotItem = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 600;
  color: #3f3f3f;
  white-space: nowrap;
`;

const Dot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: ${({ $color }) => $color};
`;

const FilterRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 26px;
  flex-wrap: wrap;
`;

const CardsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 22px;
`;

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
