import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="px-4 md:px-8 py-6 animate-fade-in">
      <Card className="p-12 bg-card border-dashed border-border text-center max-w-2xl mx-auto mt-12">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">
          This module is part of the next iteration. The Agency Dashboard and Agent Logs are
          ready to explore — start there.
        </p>
      </Card>
    </div>
  );
}
