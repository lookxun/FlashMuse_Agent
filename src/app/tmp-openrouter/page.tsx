import { notFound, redirect } from "next/navigation";

export default function TmpOpenRouterPage() {
  if (process.env.NODE_ENV === "production") notFound();
  redirect("/proto-test");
}
