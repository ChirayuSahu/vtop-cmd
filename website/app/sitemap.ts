import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl().href, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/whats-new", siteUrl()).href, changeFrequency: "weekly", priority: 0.5 },
    { url: new URL("/privacy", siteUrl()).href, changeFrequency: "yearly", priority: 0.3 },
  ];
}
