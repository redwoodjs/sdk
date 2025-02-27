import type { JSX } from "react";
import { type IconName } from "../../../types/icons.d.ts";
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
