import styled, { keyframes } from 'styled-components';
import { BRAND, StepStatus } from '../data';

interface Props {
  n: string;
  label: string;
  sub: string;
  status: StepStatus;
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 4px;
`;

const StepNum = styled.div<{ $status: StepStatus }>`
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  background: ${({ $status }) =>
    $status === 'idle' ? '#ffffff' :
    $status === 'done' ? '#428bff' : BRAND};
  color: ${({ $status }) => ($status === 'idle' ? '#929292' : '#ffffff')};
  border: 1px solid ${({ $status }) => ($status === 'idle' ? '#dddddd' : 'transparent')};
`;

const Body = styled.div`
  flex: 1;
`;

const StepLabel = styled.div<{ $status: StepStatus }>`
  font-size: 15.5px;
  font-weight: 600;
  color: ${({ $status }) => ($status === 'idle' ? '#929292' : '#222222')};
`;

const Sub = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: #929292;
  margin-top: 2px;
`;

const Spinner = styled.div`
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid #ffe1e8;
  border-top-color: ${BRAND};
  animation: ${spin} 0.7s linear infinite;
`;

const DoneText = styled.span`
  flex: none;
  font-size: 13px;
  font-weight: 600;
  color: #428bff;
`;

const IdleText = styled.span`
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: #c1c1c1;
`;

export default function StepItem({ n, label, sub, status }: Props) {
  return (
    <Row>
      <StepNum $status={status}>{n}</StepNum>
      <Body>
        <StepLabel $status={status}>{label}</StepLabel>
        <Sub>{sub}</Sub>
      </Body>
      {status === 'active' && <Spinner />}
      {status === 'done'   && <DoneText>완료</DoneText>}
      {status === 'idle'   && <IdleText>대기</IdleText>}
    </Row>
  );
}
