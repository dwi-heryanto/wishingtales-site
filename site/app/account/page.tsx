import type { Metadata } from "next";
import { AccountForm } from "@/components/AccountForm";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Sign in or create a parent/reader account so your reading progress and favourites follow you between devices. Reading stays free and complete as a guest.",
  alternates: { canonical: "/account/" },
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <div className="page doc">
      <h1>Your account</h1>
      <p>
        An account carries your reading progress, favourites and reader settings between devices.
        Reading is free as a guest; nothing on this site requires an account, and there are no
        child accounts: the account holder is always a parent or an adult reader.
      </p>
      <AccountForm />
    </div>
  );
}
