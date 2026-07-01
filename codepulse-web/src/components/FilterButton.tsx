import styled from 'styled-components';

interface Props {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

const Btn = styled.button<{ $active: boolean }>`
  height: 40px;
  padding: 0 18px;
  border-radius: 9999px;
  border: 1px solid ${({ $active }) => ($active ? '#222222' : '#dddddd')};
  background: ${({ $active }) => ($active ? '#222222' : '#ffffff')};
  color: ${({ $active }) => ($active ? '#ffffff' : '#222222')};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
`;

const Count = styled.span`
  opacity: 0.55;
  font-weight: 500;
`;

export default function FilterButton({ label, count, active, onClick }: Props) {
  return (
    <Btn $active={active} onClick={onClick}>
      {label}
      <Count>{count}</Count>
    </Btn>
  );
}
