import { Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Document } from "@/types";

const labels = { ready: "Ready", processing: "Processing", pending: "Queued", failed: "Failed" };
export default function DocumentStatus({ status }: { status: Document["status"] }) {
  return <Badge variant={status}><Circle className="size-2 fill-current" aria-hidden="true" />{labels[status]}</Badge>;
}
