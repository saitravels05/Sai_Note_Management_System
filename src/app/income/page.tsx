import { redirect } from "next/navigation";

export default function IncomePage() {
  redirect("/records?type=INCOME");
}
