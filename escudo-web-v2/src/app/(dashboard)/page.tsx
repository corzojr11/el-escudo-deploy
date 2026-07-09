import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Wallet,
  Target,
  Heart,
  CalendarClock,
  CheckSquare,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export const metadata = {
  title: "Dashboard — El Escudo",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-foreground">Bienvenido de vuelta</h2>
        <p className="text-sm text-muted-foreground">
          Resumen de tu día, progreso y comandos rápidos.
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Zap className="h-4 w-4" /> Nivel del Jugador
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">12</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>XP</span>
                <span>3,240 / 5,000</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-[65%] rounded-full bg-escudo-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Target className="h-4 w-4" /> Racha Actual
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              8 <span className="text-base font-normal text-muted-foreground">días</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className="border-escudo-green/30 text-escudo-green"
            >
              +2 vs semana pasada
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Wallet className="h-4 w-4" /> Balance del Día
            </CardDescription>
            <CardTitle className="text-3xl text-escudo-green">+$24,500</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Ingresos: +$35,000 · Gastos: -$10,500
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Heart className="h-4 w-4" /> Peso Actual
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              78.4 <span className="text-base font-normal text-muted-foreground">kg</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-1 text-xs text-escudo-green">
            <TrendingDown className="h-3 w-3" />
            <span>-0.6 kg esta semana</span>
          </CardContent>
        </Card>
      </div>

      {/* Sección central */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="h-5 w-5 text-escudo-green" /> Resumen Diario
              </CardTitle>
              <CardDescription>Progreso de tareas y hábitos de hoy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tareas completadas</span>
                  <span className="font-medium text-escudo-green">8 / 12</span>
                </div>
                <Progress value={66} className="h-2 bg-secondary" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hábitos del día</span>
                  <span className="font-medium text-escudo-cyan">4 / 6</span>
                </div>
                <Progress value={67} className="h-2 bg-secondary" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4 text-escudo-cyan" />
                <span>Turnos activos: 2</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-escudo-gold" /> Objetivos del Mes
              </CardTitle>
              <CardDescription>Seguimiento de metas activas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { label: "Ahorrar $50,000", progress: 42 },
                { label: "15 días de ejercicio", progress: 60 },
                { label: "Leer 3 libros", progress: 80 },
              ].map((goal) => (
                <div key={goal.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{goal.label}</span>
                    <span className="font-medium text-escudo-green">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2 bg-secondary" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="flex flex-col gap-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Gastos Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end justify-around gap-2">
                {[
                  { month: "Ene", height: 40 },
                  { month: "Feb", height: 55 },
                  { month: "Mar", height: 70 },
                  { month: "Abr", height: 45 },
                ].map((item, i) => (
                  <div key={item.month} className="flex flex-col items-center gap-2">
                    <div
                      className="w-7 rounded-t-sm bg-escudo-green/40"
                      style={{
                        height: `${item.height}px`,
                        backgroundColor:
                          i === 2 ? "#00ff9d" : "rgba(0, 255, 157, 0.4)",
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{item.month}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-escudo-green" /> OMNI
              </CardTitle>
              <CardDescription>Asistente de comando</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-escudo-green/5 p-3 text-sm text-escudo-green">
                <p>OMNI está listo para recibir comandos.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
