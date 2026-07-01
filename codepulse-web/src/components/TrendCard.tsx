import styled, { keyframes } from 'styled-components';
import CategoryBadge from './CategoryBadge';
import ScoreBar from './ScoreBar';
import FilePill from './FilePill';
import { CATS, SCORES, TrendItem } from '../data';

interface Props {
  item: TrendItem;
  delay?: number;
  openId: string | null;
  onToggle: (id: string) => void;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Card = styled.div<{ $delay: number }>`
  border: 1px solid #ebebeb;
  border-radius: 18px;
  background: #ffffff;
  padding: 24px 26px;
  animation: ${fadeIn} 0.35s ease both;
  animation-delay: ${({ $delay }) => $delay}s;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const SourceChip = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: #6a6a6a;
  background: #f7f7f7;
  border-radius: 6px;
  padding: 4px 9px;
  white-space: nowrap;
`;

const DateText = styled.span`
  font-size: 13px;
  color: #929292;
`;

const ScoreWrap = styled.div`
  margin-left: auto;
`;

const ToggleBtn = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 600;
  color: #6a6a6a;
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
  padding: 0;
`;

const Title = styled.h3`
  margin: 15px 0 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.4px;
  color: #222222;
`;

const Reason = styled.p`
  margin: 8px 0 0;
  font-size: 15px;
  line-height: 1.55;
  color: #3f3f3f;
  max-width: 760px;
`;

const Detail = styled.div`
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid #ebebeb;
`;

const DetailText = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: #3f3f3f;
  max-width: 760px;
`;

const ActionRow = styled.div`
  margin-top: 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const ActionLabel = styled.span<{ $accent: string; $tint: string }>`
  flex: none;
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 6px;
  padding: 5px 10px;
  letter-spacing: 0.2px;
  color: ${({ $accent }) => $accent};
  background: ${({ $tint }) => $tint};
`;

const ActionText = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: #222222;
  line-height: 1.5;
`;

const LinkPill = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: #222222;
  border: 1px solid #dddddd;
  border-radius: 9999px;
  padding: 8px 15px;
  cursor: pointer;
  text-decoration: none;
  margin-top: 20px;
  transition: background 0.15s;

  &:hover {
    background: #f7f7f7;
  }
`;

export default function TrendCard({ item, delay = 0, openId, onToggle }: Props) {
  const cat = CATS[item.cat];
  const score = SCORES[item.id];
  const open = openId === item.id;

  return (
    <Card $delay={delay}>
      <CardHeader>
        <CategoryBadge label={cat.label} accent={cat.accent} tint={cat.tint} />
        <SourceChip>{item.source}</SourceChip>
        <DateText>{item.date}</DateText>
        <ScoreWrap>
          <ScoreBar score={score} color={cat.accent} />
        </ScoreWrap>
        <ToggleBtn onClick={() => onToggle(item.id)}>
          {open ? '접기 ↑' : '자세히 ↓'}
        </ToggleBtn>
      </CardHeader>

      <Title>{item.title}</Title>
      <Reason>{item.reason}</Reason>
      <FilePill file={item.file} />

      {open && (
        <Detail>
          <DetailText>{item.detail}</DetailText>
          <ActionRow>
            <ActionLabel $accent={cat.accent} $tint={cat.tint}>추천 액션</ActionLabel>
            <ActionText>{item.action}</ActionText>
          </ActionRow>
          <LinkPill
            href={`https://${item.link}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.link} ↗
          </LinkPill>
        </Detail>
      )}
    </Card>
  );
}
