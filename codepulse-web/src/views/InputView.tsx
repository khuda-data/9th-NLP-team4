import { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import {
  Section, BadgePill, BadgeDot, HeroH1, HeroP, SearchPill, FieldLabel, InputLabel,
  SearchInput, SearchBtn, InputMeta, FillBtn, SourcesRow, SourcesLabel,
  SourcesDivider, SourcesChips, SourceChip, Taxonomy, TaxonomyTitle, TaxonomyGrid,
  TaxonomyCard, TaxonomyDesc,
} from '../components/InputView/InputView.styled';
import { CATS, CatKey } from '../data';
import { useEffect } from 'react';

interface Props {
  repoUrl: string;
  apiKey: string;
  onRepoChange: (val: string) => void;
  onKeyChange: (val: string) => void;
  onFillSample: () => void;
}

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
  onFillSample, repoUrl, onRepoChange
}: Props) {
  const navigate = useNavigate();
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onClick();
  };
  const onClick = () => {
    if(repoUrl == '' || !repoUrl) alert('레포지토리 url을 입력해주세요.');
    else navigate('/analyzing', {state: {url: repoUrl}});
  }
  useEffect(() => {
    onRepoChange('');
  }, [])

  return (
    <Section>
      <BadgePill>
        <BadgeDot />
        GitHub 레포 × 오늘의 AI 트렌드
      </BadgePill>

      <HeroH1>내 코드에 의미 있는 <br />AI 트렌드만, 오늘 단위로.</HeroH1>
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
        <SearchBtn onClick={onClick} aria-label="분석">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </SearchBtn>
      </SearchPill>

      <InputMeta>
        <FillBtn onClick={onFillSample}>예시 레포로 채우기</FillBtn>
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
