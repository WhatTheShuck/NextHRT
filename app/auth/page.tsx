import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginPageContent } from "./auth-content";

const LoginPage = async () => {
  const session = await auth();
  if (session) redirect("/");

  return <LoginPageContent />;
};

export default LoginPage;
