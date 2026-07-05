import styled from 'styled-components';
import { BRAND } from '../../data';

export const Section = styled.section`
  padding: 76px 28px 88px;
`;

export const BadgePill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border: 1px solid #ebebeb;
  border-radius: 9999px;
  background: #f7f7f7;
  font-size: 13px;
  font-weight: 600;
  color: #6a6a6a;
  margin-bottom: 24px;
`;

export const BadgeDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: ${BRAND};
  flex-shrink: 0;
`;

export const HeroH1 = styled.h1`
  margin: 0;
  font-size: 44px;
  line-height: 1.12;
  font-weight: 600;
  letter-spacing: -1.4px;
  max-width: 760px;
  text-wrap: balance;
`;

export const HeroP = styled.p`
  margin: 20px 0 0;
  font-size: 17px;
  line-height: 1.6;
  color: #6a6a6a;
  max-width: 600px;

  b {
    color: #3f3f3f;
    font-weight: 600;
  }
`;

export const ModeTabs = styled.div`
  display: inline-flex;
  gap: 4px;
  margin-top: 34px;
  padding: 4px;
  background: #f2f2f2;
  border-radius: 9999px;
`;

export const ModeTab = styled.button<{ $active?: boolean }>`
  border: none;
  border-radius: 9999px;
  padding: 8px 18px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  background: ${({ $active }) => ($active ? '#ffffff' : 'transparent')};
  color: ${({ $active }) => ($active ? '#222222' : '#8a8a8a')};
  box-shadow: ${({ $active }) => ($active ? 'rgba(0,0,0,0.08) 0 1px 3px' : 'none')};
  transition: background 0.15s, color 0.15s;
`;

export const SearchPill = styled.div`
  display: flex;
  align-items: center;
  max-width: 780px;
  margin-top: 14px;
  background: #ffffff;
  border: 1px solid #dddddd;
  border-radius: 9999px;
  box-shadow:
    rgba(0, 0, 0, 0.02) 0 0 0 1px,
    rgba(0, 0, 0, 0.04) 0 2px 6px 0,
    rgba(0, 0, 0, 0.1) 0 4px 10px 0;
  padding: 6px 6px 6px 0;
`;

export const FieldLabel = styled.label<{ $flex?: number }>`
  flex: ${({ $flex }) => $flex ?? 1.5};
  display: block;
  padding: 11px 26px;
  cursor: text;
`;

export const InputLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #222222;
  letter-spacing: 0.1px;
  margin-bottom: 3px;
  font-family: 'Inter', sans-serif;
`;

export const SearchInput = styled.input`
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14.5px;
  color: #222222;
  padding: 0;
`;

export const Divider = styled.div`
  width: 1px;
  height: 38px;
  background: #dddddd;
  flex-shrink: 0;
`;

export const SearchBtn = styled.button`
  flex: none;
  width: 54px;
  height: 54px;
  margin-left: 6px;
  border: none;
  border-radius: 9999px;
  background: ${BRAND};
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover {
    background: #e00b41;
  }
`;

export const InputMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 18px;
  flex-wrap: wrap;
`;

export const FillBtn = styled.button`
  font-size: 13px;
  font-weight: 600;
  color: #222222;
  border: none;
  border-bottom: 1.5px solid #222222;
  padding: 0 0 1px;
  background: transparent;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: ${BRAND};
    border-bottom-color: ${BRAND};
  }
`;

export const KeyNote = styled.span`
  font-size: 12px;
  color: #929292;
`;

export const SourcesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 30px;
`;

export const SourcesLabel = styled.span`
  font-size: 12.5px;
  color: #929292;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
`;

export const SourcesDivider = styled.div`
  height: 1px;
  flex: 1;
  max-width: 40px;
  background: #ebebeb;
`;

export const SourcesChips = styled.div`
  display: flex;
  gap: 8px;
`;

export const SourceChip = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: #3f3f3f;
  background: #f7f7f7;
  border: 1px solid #ebebeb;
  border-radius: 9999px;
  padding: 5px 12px;
  white-space: nowrap;
`;

export const Taxonomy = styled.div`
  margin-top: 64px;
`;

export const TaxonomyTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #929292;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  margin-bottom: 18px;
`;

export const TaxonomyGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

export const TaxonomyCard = styled.div`
  border: 1px solid #ebebeb;
  border-radius: 16px;
  padding: 22px;
`;

export const TaxonomyDesc = styled.p`
  margin: 14px 0 0;
  font-size: 14.5px;
  line-height: 1.55;
  color: #3f3f3f;

  b {
    font-weight: 600;
  }
`;
