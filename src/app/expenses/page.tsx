import { redirect } from "next/navigation";

export default function ExpensesPage() {
  redirect("/records?type=EXPENSE");
}
