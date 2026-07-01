import styled from 'styled-components';
import StepItem from '../components/StepItem';
import { STEPS, StepStatus } from '../data';

interface Props {
  repoDisplay: string;
  stepIndex: number;
}

const Section = styled.section`
  padding: 96px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const RepoChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: #f7f7f7;
  border: 1px solid #ebebeb;
  margin-bottom: 36px;
`;

const RepoName = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 13.5px;
  font-weight: 600;
  color: #222222;
  white-space: nowrap;
`;

const RepoStatus = styled.span`
  font-size: 13px;
  color: #6a6a6a;
  white-space: nowrap;
`;

const StepsList = styled.div`
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Note = styled.p`
  margin: 40px 0 0;
  font-size: 13px;
  color: #929292;
`;

function getStatus(i: number, stepIndex: number): StepStatus {
  if (i < stepIndex) return 'done';
  if (i === stepIndex) return 'active';
  return 'idle';
}

export default function AnalyzingView({ repoDisplay, stepIndex }: Props) {
  return (
    <Section>
      <RepoChip>
        <RepoName>{repoDisplay}</RepoName>
        <RepoStatus>분석 중…</RepoStatus>
      </RepoChip>

      <StepsList>
        {STEPS.map((step, i) => (
          <StepItem
            key={step.n}
            n={step.n}
            label={step.label}
            sub={step.sub}
            status={getStatus(i, stepIndex)}
          />
        ))}
      </StepsList>

      <Note>공개 트렌드 API와 입력하신 Gemini 키로 처리됩니다.</Note>
    </Section>
  );
}
