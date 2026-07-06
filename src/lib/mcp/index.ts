import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchListings from "./tools/search-listings";
import getListing from "./tools/get-listing";
import myListings from "./tools/my-listings";
import createListing from "./tools/create-listing";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "baddel-mcp",
  title: "Baddel — Barter Platform",
  version: "0.1.0",
  instructions:
    "Tools for the Baddel barter platform. Use `search_listings` and `get_listing` to browse public listings. Use `my_listings` and `create_listing` (auth required) to manage the signed-in user's own listings.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchListings, getListing, myListings, createListing],
});
