import { KeyboardEvent } from 'react';
import styled from 'styled-components';
import CategoryBadge from '../components/CategoryBadge';
import { BRAND, CATS, CatKey } from '../data';

interface Props {
  repoUrl: string;
  apiKey: string;
  onRepoChange: (val: string) => void;
  onKeyChange: (val: string) => void;
  onAnalyze: () => void;
  onFillSample: () => void;
}

const Section = styled.section`
  padding: 76px 28px 88px;
`;

const BadgePill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border: 1px solid #ebebeb;
  border-radius: 9999px;
  background: #f7f7f7;
  font-size: 13px;
  font-weight: 600;
  color: #6a6a6a;
  margin-bottom: 24px;
`;

const BadgeDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: ${BRAND};
  flex-shrink: 0;
`;

const HeroH1 = styled.h1`
  margin: 0;
  font-size: 44px;
  line-height: 1.12;
  font-weight: 600;
  letter-spacing: -1.4px;
  max-width: 760px;
  text-wrap: balance;
`;

const HeroP = styled.p`
  margin: 20px 0 0;
  font-size: 17px;
  line-height: 1.6;
  color: #6a6a6a;
  max-width: 600px;

  b {
    color: #3f3f3f;
    font-weight: 600;
  }
`;

const SearchPill = styled.div`
  display: flex;
  align-items: center;
  max-width: 780px;
  margin-top: 36px;
  background: #ffffff;
  border: 1px solid #dddddd;
  border-radius: 9999px;
  box-shadow:
    rgba(0, 0, 0, 0.02) 0 0 0 1px,
    rgba(0, 0, 0, 0.04) 0 2px 6px 0,
    rgba(0, 0, 0, 0.1) 0 4px 10px 0;
  padding: 6px 6px 6px 0;
`;

const FieldLabel = styled.label<{ $flex?: number }>`
  flex: ${({ $flex }) => $flex ?? 1.5};
  display: block;
  padding: 11px 26px;
  cursor: text;
`;

const InputLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #222222;
  letter-spacing: 0.1px;
  margin-bottom: 3px;
  font-family: 'Inter', sans-serif;
`;

const SearchInput = styled.input`
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14.5px;
  color: #222222;
  padding: 0;
`;

const Divider = styled.div`
  width: 1px;
  height: 38px;
  background: #dddddd;
  flex-shrink: 0;
`;

const SearchBtn = styled.button`
  flex: none;
  width: 54px;
  height: 54px;
  margin-left: 6px;
  border: none;
  border-radius: 9999px;
  background: ${BRAND};
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover {
    background: #e00b41;
  }
`;

const InputMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 18px;
  flex-wrap: wrap;
`;

const FillBtn = styled.button`
  font-size: 13px;
  font-weight: 600;
  color: #222222;
  border: none;
  border-bottom: 1.5px solid #222222;
  padding: 0 0 1px;
  background: transparent;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: ${BRAND};
    border-bottom-color: ${BRAND};
  }
`;

const KeyNote = styled.span`
  font-size: 12px;
  color: #929292;
`;

const SourcesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 30px;
`;

const SourcesLabel = styled.span`
  font-size: 12.5px;
  color: #929292;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
`;

const SourcesDivider = styled.div`
  height: 1px;
  flex: 1;
  max-width: 40px;
  background: #ebebeb;
`;

const SourcesChips = styled.div`
  display: flex;
  gap: 8px;
`;

const SourceChip = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: #3f3f3f;
  background: #f7f7f7;
  border: 1px solid #ebebeb;
  border-radius: 9999px;
  padding: 5px 12px;
  white-space: nowrap;
`;

const Taxonomy = styled.div`
  margin-top: 64px;
`;

const TaxonomyTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #929292;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  margin-bottom: 18px;
`;

const TaxonomyGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const TaxonomyCard = styled.div`
  border: 1px solid #ebebeb;
  border-radius: 16px;
  padding: 22px;
`;

const TaxonomyDesc = styled.p`
  margin: 14px 0 0;
  font-size: 14.5px;
  line-height: 1.55;
  color: #3f3f3f;

  b {
    font-weight: 600;
  }
`;

interface TaxonomyItem {
  key: CatKey;
  desc: React.ReactNode;
}

const TAXONOMY_ITEMS: TaxonomyItem[] = [
  { key: 'replace', desc: <>지금 코드가 쓰는 기술을 더 나은 최신 것으로 <b>바꿀</b> 후보.</> },
  { key: 'apply',   desc: <>아직 안 쓰지만 코드에 <b>새로 붙이면</b> 좋을 기법.</> },
  { key: 'impact',  desc: <>의존성·릴리스 변화가 코드에 <b>미칠</b> 파장.</> },
];

export default function InputView({
  repoUrl, apiKey, onRepoChange, onKeyChange, onAnalyze, onFillSample,
}: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onAnalyze();
  };

  return (
    <Section>
      <BadgePill>
        <BadgeDot />
        GitHub 레포 × 오늘의 AI 트렌드
      </BadgePill>

      <HeroH1>내 코드에 의미 있는 AI 트렌드만, 오늘 단위로.</HeroH1>
      <HeroP>
        레포 주소만 넣으면 오늘 나온 트렌드 중 당신의 코드와 맞닿은 것만 골라{' '}
        <b>대체후보 · 신규적용 · 영향</b>으로 분류해 드려요.
      </HeroP>

      <SearchPill>
        <FieldLabel>
          <InputLabel>GitHub 레포</InputLabel>
          <SearchInput
            value={repoUrl}
            onChange={e => onRepoChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="github.com/your-org/your-repo"
            autoComplete="off"
            spellCheck={false}
          />
        </FieldLabel>
        <Divider />
        <FieldLabel $flex={1}>
          <InputLabel>Gemini API 키</InputLabel>
          <SearchInput
            value={apiKey}
            onChange={e => onKeyChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
          />
        </FieldLabel>
        <SearchBtn onClick={onAnalyze} aria-label="분석">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </SearchBtn>
      </SearchPill>

      <InputMeta>
        <FillBtn onClick={onFillSample}>예시 레포로 채우기</FillBtn>
        <KeyNote>키는 브라우저에서만 쓰이고 저장되지 않아요.</KeyNote>
      </InputMeta>

      <SourcesRow>
        <SourcesLabel>분석에 쓰는 공개 트렌드 소스</SourcesLabel>
        <SourcesDivider />
        <SourcesChips>
          <SourceChip>arXiv</SourceChip>
          <SourceChip>Hacker News</SourceChip>
          <SourceChip>GitHub Trending</SourceChip>
        </SourcesChips>
      </SourcesRow>

      <Taxonomy>
        <TaxonomyTitle>이렇게 분류해 드려요</TaxonomyTitle>
        <TaxonomyGrid>
          {TAXONOMY_ITEMS.map(({ key, desc }) => {
            const cat = CATS[key];
            return (
              <TaxonomyCard key={key}>
                <CategoryBadge label={cat.label} accent={cat.accent} tint={cat.tint} />
                <TaxonomyDesc>{desc}</TaxonomyDesc>
              </TaxonomyCard>
            );
          })}
        </TaxonomyGrid>
      </Taxonomy>
    </Section>
  );
}
