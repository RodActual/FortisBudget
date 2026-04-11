import { useEffect, useState } from "react";
import { applyActionCode } from "firebase/auth";
import { auth } from "../firebase"; // Adjust path if needed
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { FortisLogo } from "./FortisLogo";

interface VerifyEmailProps {
  onComplete: () => void;
}

export function VerifyEmail({ onComplete }: VerifyEmailProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your secure credentials...");

  useEffect(() => {
    // Read the parameters natively from the browser URL
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");

    if (mode !== "verifyEmail" || !oobCode) {
      setStatus("error");
      setMessage("Invalid or missing verification link.");
      return;
    }

    applyActionCode(auth, oobCode)
      .then(() => {
        setStatus("success");
        setMessage("Your email has been verified successfully. Your vault is secure.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage("This verification link is invalid or has expired. Please request a new one.");
        console.error("Verification error:", error);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--surface)" }}>
      <Card className="w-full max-w-md shadow-2xl border-t-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", borderTopColor: status === "success" ? "var(--field-green)" : "var(--castle-red)" }}>
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg" style={{ backgroundColor: "var(--engine-navy)" }}>
            <FortisLogo className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Identity Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          
          {status === "loading" && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: "var(--engine-navy)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--fortress-steel)" }}>{message}</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="w-16 h-16" style={{ color: "var(--field-green)" }} />
              <CardDescription className="text-base" style={{ color: "var(--text-primary)" }}>{message}</CardDescription>
              <Button 
                onClick={onComplete} 
                className="w-full font-bold text-white mt-4"
                style={{ backgroundColor: "var(--engine-navy)" }}
              >
                Proceed to Dashboard
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <XCircle className="w-16 h-16" style={{ color: "var(--castle-red)" }} />
              <CardDescription className="text-base" style={{ color: "var(--text-primary)" }}>{message}</CardDescription>
              <Button 
                onClick={onComplete} 
                variant="outline"
                className="w-full font-bold mt-4"
                style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
              >
                Return Home
              </Button>
            </div>
          )}
          
        </CardContent>
      </Card>
    </div>
  );
}