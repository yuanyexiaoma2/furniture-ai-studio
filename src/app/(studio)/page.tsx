import { redirect } from "next/navigation";
import { DEFAULT_STUDIO_PATH } from "@/lib/login-destination";

export default function HomePage() {
  redirect(DEFAULT_STUDIO_PATH);
}
