import React from 'react';
import fluttershyImg from '../../assets/fluttershy.jpg';

interface Props {
  size?: number;
}

const FluttershyAvatar: React.FC<Props> = ({ size = 28 }) => (
  <img
    src={fluttershyImg}
    alt="Fluttershy"
    width={size}
    height={size}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      objectFit: 'cover',
      flexShrink: 0,
      display: 'block',
      userSelect: 'none',
    }}
  />
);

export default FluttershyAvatar;
