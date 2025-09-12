import { IconName } from "../images/icons/icons";
import spriteUrl from "../images/icons/sprite.svg?url";

interface Props {
  size?: number;
  id: IconName;
  className?: string;
}

const Icon = ({ className, size = 24, id }: Props) => {
  return (
    <svg width={size} height={size} className={className}>
      <use href={`${spriteUrl}#${id}`}></use>
    </svg>
  );
};

export { Icon };
