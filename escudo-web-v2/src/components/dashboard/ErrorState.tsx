"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "No se pudieron cargar los datos",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <Card className="border-escudo-red/30 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-escudo-red">
          <AlertTriangle className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        {onRetry && (
          <Button
            variant="outline"
            className="border-escudo-red/30 text-escudo-red hover:bg-escudo-red/10"
            onClick={onRetry}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
