import type { JSX } from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  id: IconName;
  size?: number;
}

const Icon = ({ id, size = 24, ...props }: IconProps): JSX.Element => {
  return (
    <svg {...props} width={size} height={size}>
      <use href={`/images/sprite.svg#${id}`} />
    </svg>
  );
};

export { Icon };
