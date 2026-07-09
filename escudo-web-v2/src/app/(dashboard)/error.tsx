"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorBoundaryProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md border-escudo-red/30 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-escudo-red">
            <AlertTriangle className="h-5 w-5" />
            Error al cargar la sección
          </CardTitle>
          <CardDescription>
            No se pudieron obtener los datos del servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
            {error.message || "Error inesperado"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-escudo-red/30 text-escudo-red hover:bg-escudo-red/10"
              onClick={() => reset()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => router.push("/")}
            >
              Volver al dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
