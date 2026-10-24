import { SITE } from "@/lib/site";

/**
 * The site's contact address, or an honest stand-in when none is configured.
 * Rendering a dead address on a privacy policy is worse than admitting the gap.
 */
export function ContactLink() {
  if (!SITE.contactEmail) {
    return <span>a contact address we have not set up yet</span>;
  }
  return <a href={"mailto:" + SITE.contactEmail}>{SITE.contactEmail}</a>;
}
