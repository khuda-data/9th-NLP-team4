import styled from 'styled-components';
import { BRAND } from '../../data';

export const Section = styled.section`
  padding: 44px 28px 96px;
`;

export const ResultsHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
`;

export const HeaderLeft = styled.div``;

export const DoneLabel = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: #428bff;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  margin-bottom: 8px;
`;

export const RepoTitle = styled.h2`
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.5px;
`;

export const DateSub = styled.div`
  font-size: 13.5px;
  color: #929292;
  margin-top: 6px;
`;

export const ResetBtn = styled.button`
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

export const SummaryBar = styled.div`
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

export const SummaryText = styled.div`
  font-size: 16px;
  color: #222222;
  line-height: 1.5;

  b { font-weight: 700; }
`;

export const Highlight = styled.b`
  font-weight: 700;
  color: ${BRAND};
`;

export const SummaryDots = styled.div`
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
`;

export const DotItem = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 600;
  color: #3f3f3f;
  white-space: nowrap;
`;

export const Dot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: ${({ $color }) => $color};
`;

export const FilterRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 26px;
  flex-wrap: wrap;
`;

export const CardsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 22px;
`;
