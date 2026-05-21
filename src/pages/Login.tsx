import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * KABUK UI MODU — Gerçek auth yok.
 * Form sembolik; "Devam et" butonu doğrudan /dashboard'a yönlendirir.
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@edusonex.app");
  const [password, setPassword] = useState("demo");

  useEffect(() => {
    // Demo amaçlı: Enter ile direkt giriş
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="h-9 w-9 rounded-md bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Edusonex</span>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Giriş yap</CardTitle>
            <CardDescription>
              Demo modu — herhangi bir bilgiyle devam edebilirsin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@ajans.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parola</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full">
                Panele git
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Kabuk UI modunda kimlik doğrulama devre dışı.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
