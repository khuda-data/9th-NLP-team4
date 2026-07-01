import styled from 'styled-components';

interface Props {
  label: string;
  accent: string;
  tint: string;
}

const Wrapper = styled.span<{ $accent: string; $tint: string }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  border-radius: 9999px;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  background: ${({ $tint }) => $tint};
  color: ${({ $accent }) => $accent};
`;

const Dot = styled.span<{ $accent: string }>`
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: ${({ $accent }) => $accent};
`;

export default function CategoryBadge({ label, accent, tint }: Props) {
  return (
    <Wrapper $accent={accent} $tint={tint}>
      <Dot $accent={accent} />
      {label}
    </Wrapper>
  );
}
