import { companyDetails } from "@/lib/data";

/**
 * The company email address an employee is known by: firstname.lastname over
 * the company domain. Whitespace inside a name is dropped, so a multi-part
 * name like "Di Natale" becomes "dinatale" (John.dinatale@domain).
 *
 * Shared by the onboarding form preview, the onboarding fan-out and the
 * AssetCheckout/Snipe-IT integration so they all agree on the address.
 */
export function buildEmployeeEmail(
  firstName: string,
  lastName: string,
): string {
  const domain = companyDetails.domain_extension;
  return `${emailNamePart(firstName)}.${emailNamePart(lastName)}@${domain}`;
}

export function emailNamePart(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}
