import styled from 'styled-components';

export const Section = styled.section`
  padding: 96px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const RepoChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: #f7f7f7;
  border: 1px solid #ebebeb;
  margin-bottom: 36px;
`;

export const RepoName = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 13.5px;
  font-weight: 600;
  color: #222222;
  white-space: nowrap;
`;

export const RepoStatus = styled.span`
  font-size: 13px;
  color: #6a6a6a;
  white-space: nowrap;
`;

export const StepsList = styled.div`
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const Note = styled.p`
  margin: 40px 0 0;
  font-size: 13px;
  color: #929292;
`;
