import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export default function Signup() {
  const { signUp, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Parola en az 6 karakter olmalı");
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Hesap oluşturuldu. Ajans yöneticisi olarak giriş yaptınız.");
      navigate("/", { replace: true });
    }
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
            <CardTitle>Hesap oluştur</CardTitle>
            <CardDescription>Tam erişimli bir ajans yöneticisi olarak oluşturulacaksınız.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@ajans.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parola</Label>
                <Input id="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Hesap oluştur
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Zaten hesabınız var mı?{" "}
              <Link to="/login" className="text-primary hover:underline">Giriş yapın</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
