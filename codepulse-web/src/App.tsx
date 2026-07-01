import { useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Header from './components/Header';
import InputView from './views/InputView';
import AnalyzingView from './views/AnalyzingView';
import ResultsView from './views/ResultsView';
import { FilterKey, STEPS } from './data';

const SAMPLE_REPO = 'khuda-team4/rag-chat-service';

const PageWrap = styled.div`
  min-height: 100vh;
  background: #ffffff;
  color: #222222;
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
`;

const Main = styled.main`
  max-width: 1000px;
  margin: 0 auto;
`;

function AppRoutes() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl]     = useState('');
  const [apiKey, setApiKey]       = useState('');
  const [stepIndex, setStepIndex] = useState(-1);
  const [filter, setFilter]       = useState<FilterKey>('all');
  const [openId, setOpenId]       = useState<string | null>('t1');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const repoDisplay = repoUrl.trim() || SAMPLE_REPO;

  function startAnalyze() {
    if (timerRef.current) clearInterval(timerRef.current);
    navigate('/analyzing');
    setStepIndex(0);

    timerRef.current = setInterval(() => {
      setStepIndex(prev => {
        const next = prev + 1;
        if (next >= STEPS.length) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          navigate('/results');
        }
        return next;
      });
    }, 850);
  }

  function reset() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    navigate('/');
    setStepIndex(-1);
    setOpenId('t1');
    setFilter('all');
  }

  function fillSample() {
    setRepoUrl(SAMPLE_REPO);
  }

  function toggleCard(id: string) {
    setOpenId(prev => (prev === id ? null : id));
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <InputView
            repoUrl={repoUrl}
            apiKey={apiKey}
            onRepoChange={setRepoUrl}
            onKeyChange={setApiKey}
            onAnalyze={startAnalyze}
            onFillSample={fillSample}
          />
        }
      />
      <Route
        path="/analyzing"
        element={<AnalyzingView repoDisplay={repoDisplay} stepIndex={stepIndex} />}
      />
      <Route
        path="/results"
        element={
          <ResultsView
            repoDisplay={repoDisplay}
            filter={filter}
            openId={openId}
            onFilterChange={setFilter}
            onToggleCard={toggleCard}
            onReset={reset}
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PageWrap>
        <Header />
        <Main>
          <AppRoutes />
        </Main>
      </PageWrap>
    </BrowserRouter>
  );
}
