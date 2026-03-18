import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginPageContent } from "./auth-content";
import { headers } from "next/headers";

const LoginPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect("/");

  return <LoginPageContent />;
};

export default LoginPage;
