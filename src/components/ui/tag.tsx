import { Badge } from "@radix-ui/themes";
import React, { useState, useRef, useLayoutEffect } from "react";
import { cn } from "@/utils";
import { useAppConfig } from "@/config";
import { allColors } from "@/config/default";
import type { ColorType } from "@/config/default";
import type { TagItem } from "@/types/tags";
import Tips from "./tips";
import { RemainingValuePanel } from "@/components/enhanced/RemainingValuePanel";

interface TagProps extends React.HTMLAttributes<HTMLDivElement> {
  tags: Array<string | TagItem>;
}

// 解析带颜色的标签
const parseTagWithColor = (tag: string) => {
  const colorMatch = tag.match(/<(\w+)>$/);
  if (colorMatch && colorMatch) {
    const color = colorMatch[1].toLowerCase();
    const text = tag.replace(/<\w+>$/, "");
    // 检查颜色是否在完整的颜色列表中
    if (allColors.includes(color as ColorType)) {
      return { text, color: color as ColorType };
    }
  }
  return { text: tag, color: null as unknown as ColorType | null };
};

interface TagItemProps {
  tag: string | TagItem;
  badgeColor: ColorType;
  enableTransparentTags: boolean;
}

const TagItem: React.FC<TagItemProps> = ({
  tag,
  badgeColor,
  enableTransparentTags,
}) => {
  const [isOverflow, setIsOverflow] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);
  const parsed: TagItem =
    typeof tag === "string"
      ? {
          text: parseTagWithColor(tag).text,
          color: parseTagWithColor(tag).color,
        }
      : tag;
  const { text } = parsed;

  useLayoutEffect(() => {
    const element = tagRef.current;
    if (element && element.scrollWidth > element.clientWidth) {
      setIsOverflow(true);
    }
  }, [text]);

  const tagContent = !enableTransparentTags ? (
    <Badge
      ref={tagRef}
      color={badgeColor}
      variant="surface"
      className="text-sm !block !flex-shrink overflow-hidden !text-ellipsis">
      <label className="text-xs">{text}</label>
    </Badge>
  ) : (
    <div
      ref={tagRef}
      data-accent-color={badgeColor}
      className={cn(
        "rt-reset rt-Badge rt-r-size-1 !text-xs transition-colors rt-Badge-tag-transparent !block !flex-shrink overflow-hidden text-ellipsis"
      )}>
      {text}
    </div>
  );

  if (parsed.type === "price" && parsed.payload) {
    return (
      <Tips
        mode="auto"
        side="bottom"
        contentMinWidth="20rem"
        contentMaxWidth="24rem"
        trigger={tagContent}>
        <RemainingValuePanel
          node={{
            price: parsed.payload.price,
            currency: parsed.payload.currency,
            billing_cycle: parsed.payload.billingCycle,
            expired_at: parsed.payload.expiredAt,
          }}
        />
      </Tips>
    );
  }

  if (isOverflow) {
    return (
      <Tips className="w-full" mode="popup" side="top" trigger={tagContent}>
        {text}
      </Tips>
    );
  }

  return tagContent;
};

const Tag = React.forwardRef<HTMLDivElement, TagProps>(
  ({ className, tags, ...props }, ref) => {
    const { enableTransparentTags, tagDefaultColorList } = useAppConfig();

    const colorList = React.useMemo(() => {
      return tagDefaultColorList
        .split(",")
        .map((color: string) => color.trim()) as ColorType[];
    }, [tagDefaultColorList]);

    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap gap-1 w-full", className)}
        {...props}>
        {tags.map((tag, index) => {
          const parsed: TagItem =
            typeof tag === "string"
              ? {
                  text: parseTagWithColor(tag).text,
                  color: parseTagWithColor(tag).color,
                }
              : tag;
          const badgeColor = parsed.color || colorList[index % colorList.length];
          return (
            <TagItem
              key={index}
              tag={tag}
              badgeColor={badgeColor}
              enableTransparentTags={enableTransparentTags}
            />
          );
        })}
      </div>
    );
  }
);

Tag.displayName = "Tag";

export { Tag };
