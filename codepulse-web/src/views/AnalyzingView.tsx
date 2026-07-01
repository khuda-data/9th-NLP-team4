import StepItem from '../components/StepItem';
import {
  Section, RepoChip, RepoName, RepoStatus, StepsList, Note,
} from '../components/AnalyzingView/AnalyzingView.styled';
import { STEPS, StepStatus } from '../data';

interface Props {
  repoDisplay: string;
  stepIndex: number;
}

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
