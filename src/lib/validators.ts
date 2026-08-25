import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2, "Your name is required"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z.string().min(2, "Business name is required"),
  businessType: z.enum([
    "RETAILER",
    "RESELLER",
    "OUTLET",
    "LIQUIDATOR",
    "WHOLESALER",
    "OTHER",
  ]),
  category: z.string().min(2),
  country: z.string().min(2),
  city: z.string().min(1),
  address: z.string().optional(),
  taxId: z.string().min(2, "Tax/VAT ID is required"),
  contactPhone: z.string().optional(),
  acceptedTerms: z.literal("on", {
    message: "You must accept the Terms of Service and Privacy Policy.",
  }),
});

export const listingSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string().min(1),
  photos: z.array(z.string().max(3_000_000)).max(6).default([]),
  quantityAvailable: z.coerce.number().int().positive(),
  unit: z.enum(["ITEM", "LOT"]),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "CUSTOMER_RETURNS"]),
  originalPrice: z.coerce.number().positive(),
  askingPrice: z.coerce.number().positive(),
  minOrderQty: z.coerce.number().int().positive().default(1),
  fulfillment: z.enum(["PICKUP", "SHIPPING", "BOTH"]),
  locationCity: z.string().min(1),
  locationCountry: z.string().min(1),
  expiresAt: z.string().optional().nullable(),
});

export const offerSchema = z.object({
  listingId: z.string(),
  offeredPrice: z.coerce.number().positive(),
  quantity: z.coerce.number().int().positive(),
  message: z.string().optional(),
});

export const offerRespondSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT", "COUNTER", "WITHDRAW"]),
  counterPrice: z.coerce.number().positive().optional(),
  counterQuantity: z.coerce.number().int().positive().optional(),
  counterMessage: z.string().optional(),
});

export const savedSearchSchema = z.object({
  keyword: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
});

export const reviewSchema = z.object({
  transactionId: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional(),
});
