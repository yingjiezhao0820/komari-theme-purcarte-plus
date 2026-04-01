import type { NodeData } from "@/types/node";
import type { ColorType } from "@/config/default";

export type TagItemType = "text" | "price" | "custom";

export interface PriceTagPayload {
  price: NodeData["price"];
  currency: NodeData["currency"];
  billingCycle: NodeData["billing_cycle"];
  expiredAt: NodeData["expired_at"];
}

export interface TagItem {
  type?: TagItemType;
  text: string;
  color?: ColorType | null;
  payload?: PriceTagPayload;
}
