export const BUSINESS_TYPES = [
  { value: "RETAILER", label: "Retailer" },
  { value: "RESELLER", label: "Reseller" },
  { value: "OUTLET", label: "Outlet store" },
  { value: "LIQUIDATOR", label: "Liquidator" },
  { value: "WHOLESALER", label: "Wholesaler" },
  { value: "OTHER", label: "Other" },
] as const;

export const LISTING_CATEGORIES = [
  "Apparel & Footwear",
  "Electronics",
  "Home & Garden",
  "Health & Beauty",
  "Toys & Games",
  "Sporting Goods",
  "Furniture",
  "Office & Industrial",
  "Food & Beverage",
  "Other",
];

export const LISTING_CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "CUSTOMER_RETURNS", label: "Customer returns" },
] as const;

export const LISTING_UNITS = [
  { value: "ITEM", label: "Per item" },
  { value: "LOT", label: "Per lot" },
] as const;

export const FULFILLMENT_TYPES = [
  { value: "PICKUP", label: "Pickup only" },
  { value: "SHIPPING", label: "Shipping only" },
  { value: "BOTH", label: "Pickup or shipping" },
] as const;

export const DEFAULT_COMMISSION_PERCENT = Number(
  process.env.PLATFORM_COMMISSION_PERCENT ?? 8
);

export const ORDER_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Paid (in escrow)",
  SHIPPED: "Shipped",
  PICKED_UP: "Picked up",
  COMPLETED: "Completed",
  DISPUTED: "Disputed",
  CANCELLED: "Cancelled",
};

export const OFFER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  COUNTERED: "Countered",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
};
