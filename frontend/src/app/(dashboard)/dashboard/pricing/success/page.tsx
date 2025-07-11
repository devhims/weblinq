'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
    {children}
  </main>
);

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);

  const checkoutId = searchParams.get('checkout_id');
  const provider = searchParams.get('provider') || 'polar';

  useEffect(() => {
    // Simulate processing time to show success state
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <PageWrapper>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Processing your subscription...
                </h2>
                <p className="text-muted-foreground">
                  Please wait while we confirm your payment
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold text-foreground mb-2">
              Welcome to Pro! 🎉
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-center">
            Your subscription has been upgraded. <br /> You now have access to
            all Pro features.
          </p>

          {checkoutId && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Checkout ID
                  </p>
                </div>
                <p className="text-sm font-mono text-foreground break-all">
                  {checkoutId}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <Button asChild className="w-full">
              <a href="/dashboard/billing">
                <ArrowRight className="mr-2 h-4 w-4" />
                View your plan
              </a>
            </Button>

            {/* <Button asChild variant="outline" className="w-full">
                  <a href="/dashboard/studio">Start using API Studio</a>
                </Button> */}
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Need help? Contact our support team for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
