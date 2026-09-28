import { z } from "zod";
import { parseEuroToCents } from "@/lib/money";

/**
 * A price typed by a person in euros ("18", "18.5", "18,50") → integer cents.
 * Parsed from the text, never through a float. At least 1 cent, at most
 * €10 million.
 */
export const euros = (label = "Price") =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const cents = parseEuroToCents(v);
    if (cents === null || cents < 1 || cents > 1_000_000_000) {
      ctx.addIssue({ code: "custom", message: `${label}: enter an amount in euros like 18.50` });
      return z.NEVER;
    }
    return cents;
  });

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

const listingFields = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string().min(1),
  photos: z.array(z.string().max(3_000_000)).max(6).default([]),
  quantityAvailable: z.coerce.number().int().positive(),
  unit: z.enum(["ITEM", "LOT"]),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "CUSTOMER_RETURNS"]),
  originalPrice: euros("Original price"),
  askingPrice: euros("Asking price"),
  minOrderQty: z.coerce.number().int().positive().default(1),
  fulfillment: z.enum(["PICKUP", "SHIPPING", "BOTH"]),
  locationCity: z.string().min(1),
  locationCountry: z.string().min(1),
  expiresAt: z.string().optional().nullable(),
});

type ListingFields = Partial<z.infer<typeof listingFields>>;
// Prices come in as euros from the form and leave as the database's cents fields.
const toCents = <T extends ListingFields>({ originalPrice, askingPrice, ...rest }: T) => ({
  ...rest,
  ...(originalPrice !== undefined ? { originalPriceCents: originalPrice } : {}),
  ...(askingPrice !== undefined ? { askingPriceCents: askingPrice } : {}),
});

export const listingSchema = listingFields.transform(({ originalPrice, askingPrice, ...rest }) => ({
  ...rest,
  originalPriceCents: originalPrice,
  askingPriceCents: askingPrice,
}));
export const listingUpdateSchema = listingFields.partial().transform(toCents);

export const offerSchema = z.object({
  listingId: z.string(),
  offeredPrice: euros("Offer price"),
  quantity: z.coerce.number().int().positive(),
  message: z.string().optional(),
});

export const offerRespondSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT", "COUNTER", "WITHDRAW"]),
  counterPrice: euros("Counter price").optional(),
  counterQuantity: z.coerce.number().int().positive().optional(),
  counterMessage: z.string().optional(),
});

export const savedSearchSchema = z.object({
  keyword: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  minPrice: euros("Min price").optional(),
  maxPrice: euros("Max price").optional(),
});

export const reviewSchema = z.object({
  transactionId: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional(),
});
