import { Inbox } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

interface EmptyStateProps {
  title?: string;
  message: string;
}

export function EmptyState({
  title = "Sin datos aún",
  message,
}: EmptyStateProps) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <CardTitle className="text-base text-foreground">{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}
