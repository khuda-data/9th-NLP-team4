import styled from 'styled-components';

interface Props {
  score: number;
  color: string;
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
`;

const Label = styled.span`
  font-size: 11.5px;
  font-weight: 700;
  color: #929292;
  letter-spacing: 0.1px;
`;

const Track = styled.div`
  width: 56px;
  height: 5px;
  border-radius: 9999px;
  background: #ebebeb;
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number; $color: string }>`
  width: ${({ $pct }) => $pct}%;
  height: 100%;
  border-radius: 9999px;
  background: ${({ $color }) => $color};
`;

const Num = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 13.5px;
  font-weight: 600;
  color: #222222;
  min-width: 22px;
  text-align: right;
`;

export default function ScoreBar({ score, color }: Props) {
  return (
    <Wrapper>
      <Label>관련도</Label>
      <Track>
        <Fill $pct={score} $color={color} />
      </Track>
      <Num>{score}</Num>
    </Wrapper>
  );
}
