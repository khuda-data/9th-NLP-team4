import styled from 'styled-components';
import { BRAND } from '../../data';

export const Section = styled.section`
  padding: 56px 28px 140px;
`;

export const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

export const BackBtn = styled.button`
  font-size: 13px;
  font-weight: 600;
  color: #222222;
  border: 1px solid #dddddd;
  border-radius: 9999px;
  padding: 7px 14px;
  background: #ffffff;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: ${BRAND};
    border-color: ${BRAND};
  }
`;

export const HeroH1 = styled.h1`
  margin: 18px 0 0;
  font-size: 34px;
  line-height: 1.14;
  font-weight: 600;
  letter-spacing: -1px;

  b {
    color: ${BRAND};
  }
`;

export const HeroP = styled.p`
  margin: 12px 0 0;
  font-size: 15px;
  line-height: 1.6;
  color: #6a6a6a;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 32px;

  @media (max-width: 860px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

export const RepoCard = styled.button<{ $selected?: boolean }>`
  text-align: left;
  border: 1.5px solid ${({ $selected }) => ($selected ? BRAND : '#ebebeb')};
  border-radius: 16px;
  padding: 20px;
  background: ${({ $selected }) => ($selected ? '#fff5f7' : '#ffffff')};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 132px;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;

  &:hover {
    border-color: ${BRAND};
    transform: translateY(-2px);
  }
`;

export const RepoTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

export const RepoTitle = styled.div`
  font-size: 15.5px;
  font-weight: 700;
  color: #222222;
  word-break: break-all;
`;

export const ForkTag = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #929292;
  background: #f2f2f2;
  border-radius: 9999px;
  padding: 3px 8px;
`;

export const RepoDesc = styled.p`
  margin: 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: #6a6a6a;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
  color: #6a6a6a;
`;

export const LangDot = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    width: 9px;
    height: 9px;
    border-radius: 9999px;
    background: ${({ $color }) => $color};
  }
`;

export const ActionBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 28px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-top: 1px solid #ebebeb;
  z-index: 20;
`;

export const SelectedLabel = styled.span`
  font-size: 14px;
  color: #3f3f3f;

  b {
    color: #222222;
    font-weight: 700;
  }
`;

export const PulseBtn = styled.button`
  border: none;
  border-radius: 9999px;
  background: ${BRAND};
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  padding: 13px 30px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: background 0.15s, opacity 0.15s;

  &:hover:not(:disabled) {
    background: #e00b41;
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

export const StateBox = styled.div`
  margin-top: 60px;
  text-align: center;
  color: #6a6a6a;
  font-size: 15px;
  line-height: 1.6;
`;

export const RetryBtn = styled.button`
  margin-top: 18px;
  border: 1px solid #dddddd;
  border-radius: 9999px;
  background: #ffffff;
  color: #222222;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 18px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;

  &:hover {
    border-color: ${BRAND};
    color: ${BRAND};
  }
`;
