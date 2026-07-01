import styled from 'styled-components';

interface Props {
  file: string;
}

const Wrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 7px 12px;
  background: #f7f7f7;
  border: 1px solid #ebebeb;
  border-radius: 8px;
`;

const FileLabel = styled.span`
  font-size: 11.5px;
  font-weight: 700;
  color: #929292;
  letter-spacing: 0.2px;
`;

const FileName = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: #222222;
`;

export default function FilePill({ file }: Props) {
  return (
    <Wrapper>
      <FileLabel>관련 파일</FileLabel>
      <FileName>{file}</FileName>
    </Wrapper>
  );
}
