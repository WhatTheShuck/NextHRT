import { redirect } from "next/navigation";

// Templates moved under the Email section; keep old bookmarks working.
export default function EmailTemplatesRedirect() {
  redirect("/admin/email/templates");
}
