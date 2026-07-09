import { CheckCircle2, AlertCircle } from "lucide-react";

interface FormStatusProps {
  success?: string;
  error?: string;
}

export function FormStatus({ success, error }: FormStatusProps) {
  if (success) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-escudo-green/10 p-3 text-sm text-escudo-green">
        <CheckCircle2 className="h-4 w-4" />
        <span>{success}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-escudo-red/10 p-3 text-sm text-escudo-red">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  return null;
}
