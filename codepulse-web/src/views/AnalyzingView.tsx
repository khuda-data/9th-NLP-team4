import StepItem from '../components/StepItem';
import {
  Section, RepoChip, RepoName, RepoStatus, StepsList, Note,
} from '../components/AnalyzingView/AnalyzingView.styled';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { analyze } from '../utils/analyze';
import { STEPS } from '../data';
import { getResults } from '../utils/getResults';

interface Props {
  repoDisplay: string;
  stepIndex: number;
}

type status = "active" | "done";
interface IStepInfo {
  status: status,
  stepIndex: number,
}

export default function AnalyzingView({ repoDisplay }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [stepStatusByIndex, setStepStatusByIndex] = useState<Record<number, status>>({});
  const [jobId, setJobId] = useState('');

  useEffect(() => {
    const handleAnalyze = async () => {
      let completed = false;
      for await (const text of analyze(location.state.url)) {
        const events = text.split("\n\n");
        for(const event of events) {
          const lines = event.split("\n");

          let eventName = "";
          let data = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            }

            if (line.startsWith("data:")) {
              data = line.slice(5).trim();
            }
          }
          if (data) {
            const payload = JSON.parse(data);

            console.log(eventName);
            console.log(payload);
            if(eventName == 'job_created') console.log(eventName, payload);
            else if(eventName == 'step_update') {
              const { stepIndex: idx, status }: IStepInfo = payload;
              setJobId(payload["jobId"]);
              setStepStatusByIndex(prev => ({ ...prev, [idx]: status }));
            }
            else if(eventName == 'completed') {
              console.log(eventName, payload);
              completed = true;
              navigate('/results', {state: {result: payload}});
            }
            else if(eventName == "failed") {
              alert(payload["message"]);
              navigate('/');
            }
          }
        }
      }
      if(!completed) {
        if(jobId != '') {
          const result = await getResults(jobId);
          console.log(result);
          navigate('/results', {state: {result: result}});
        }
        else {
          alert('분석 오류');
          navigate('/');
        }
      }
    }
    handleAnalyze();
  }, [])
  
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
            status={stepStatusByIndex[i] ?? "idle"}
          />
        ))}
      </StepsList>

      <Note>공개 트렌드 API와 입력하신 Gemini 키로 처리됩니다.</Note>
    </Section>
  );
}
