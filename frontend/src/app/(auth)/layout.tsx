import { Brain } from "lucide-react";
import Link from "next/link";
import ApiConnectionStatus from "@/components/layout/ApiConnectionStatus";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Brain className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">DocuMind</span>
      </Link>
      <div className="w-full max-w-md">
        {children}
        <div className="mt-4"><ApiConnectionStatus /></div>
      </div>
    </div>
  );
}
