import styled from 'styled-components';
import { BRAND } from '../data';

const Nav = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(8px);
  -webkit-backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid #ebebeb;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const BrandDot = styled.div`
  width: 13px;
  height: 13px;
  border-radius: 9999px;
  background: ${BRAND};
  flex-shrink: 0;
`;

const Title = styled.span`
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.4px;
`;

const Sub = styled.span`
  font-size: 13px;
  color: #929292;
  font-weight: 500;
  margin-left: 2px;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
`;

const DateLabel = styled.span`
  font-size: 13px;
  color: #6a6a6a;
  font-weight: 500;
`;

const HowLink = styled.span`
  font-size: 14px;
  color: #222222;
  font-weight: 600;
  border-bottom: 1.5px solid #222222;
  padding-bottom: 1px;
  cursor: pointer;
  white-space: nowrap;
`;

export default function Header() {
  const today = new Date();

  return (
    <Nav>
      <Left>
        <BrandDot />
        <Title>CodePulse</Title>
        <Sub>· 내 코드에 맞는 AI 트렌드 매칭</Sub>
      </Left>
      <Right>
        <DateLabel>{today.getFullYear()}. {(today.getMonth() + 1).toString().padStart(2, '0')}. {today.getDate().toString().padStart(2, '0')} 기준</DateLabel>
        <HowLink>작동 방식</HowLink>
      </Right>
    </Nav>
  );
}
