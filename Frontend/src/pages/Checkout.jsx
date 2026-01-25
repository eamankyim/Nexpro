import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CreditCard,
  Smartphone,
  CheckCircle,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Info } from 'lucide-react';

const cardSchema = z.object({
  cardNumber: z.string()
    .min(13, 'Card number must be at least 13 digits')
    .max(19, 'Card number must be at most 19 digits')
    .regex(/^\d+$/, 'Card number must contain only digits'),
  expMonth: z.string()
    .length(2, 'Month must be 2 digits')
    .regex(/^(0[1-9]|1[0-2])$/, 'Invalid month (01-12)'),
  expYear: z.string()
    .length(4, 'Year must be 4 digits')
    .regex(/^\d{4}$/, 'Invalid year'),
  cardName: z.string().min(1, 'Please enter cardholder name'),
  cvv: z.string()
    .min(3, 'CVV must be at least 3 digits')
    .max(4, 'CVV must be at most 4 digits')
    .regex(/^\d+$/, 'CVV must contain only digits'),
});

const momoSchema = z.object({
  phoneNumber: z.string()
    .regex(/^0\d{9}$/, 'Invalid MoMo number (e.g., 0244123456)')
    .length(10, 'Phone number must be 10 digits'),
});

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTenant } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);

  // Get plan details from navigation state
  const planData = location.state || {
    plan: 'starter',
    billingPeriod: 'monthly',
    price: 99
  };

  const { plan, billingPeriod, price } = planData;

  // Calculate prices
  const monthlyPrice = {
    starter: 99,
    professional: 199,
    enterprise: 299
  };

  const yearlyPrice = {
    starter: Math.round(monthlyPrice.starter * 12 * 0.8), // 950
    professional: Math.round(monthlyPrice.professional * 12 * 0.8), // 1910
    enterprise: Math.round(monthlyPrice.enterprise * 12 * 0.8) // 2870
  };

  const finalPrice = billingPeriod === 'yearly' ? yearlyPrice[plan] : monthlyPrice[plan];
  const planNames = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
  };

  const form = useForm({
    resolver: zodResolver(paymentMethod === 'card' ? cardSchema : momoSchema),
    defaultValues: paymentMethod === 'card' ? {
      cardNumber: '',
      expMonth: '',
      expYear: '',
      cardName: '',
      cvv: '',
    } : {
      phoneNumber: '',
    },
  });

  // Reset form when payment method changes
  useEffect(() => {
    form.reset(paymentMethod === 'card' ? {
      cardNumber: '',
      expMonth: '',
      expYear: '',
      cardName: '',
      cvv: '',
    } : {
      phoneNumber: '',
    });
  }, [paymentMethod, form]);

  const upgradeMutation = useMutation({
    mutationFn: async (payload) => {
      return await settingsService.updateSubscription(payload);
    },
    onSuccess: () => {
      showSuccess('Subscription upgraded successfully!');
      navigate('/settings?tab=subscription');
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to upgrade subscription');
    }
  });

  const onSubmit = async (values) => {
    try {
      setLoading(true);
      
      // Calculate subscription end date
      const currentDate = new Date();
      const periodEnd = new Date(currentDate);
      
      if (billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const payload = {
        plan: plan,
        status: 'active',
        billingPeriod: billingPeriod,
        currentPeriodEnd: periodEnd.toISOString(),
        paymentMethod: {
          type: paymentMethod,
          ...(paymentMethod === 'card' ? {
            brand: 'visa', // Could be determined from card number
            last4: values.cardNumber?.slice(-4) || '0000',
            expMonth: values.expMonth || '12',
            expYear: values.expYear || '2025'
          } : {
            phone: values.phoneNumber || ''
          })
        },
        amount: finalPrice,
        currency: 'GHS'
      };

      await upgradeMutation.mutateAsync(payload);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!plan || !billingPeriod) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-12">
        <Alert className="max-w-md">
          <Info className="h-4 w-4" />
          <AlertTitle>No Plan Selected</AlertTitle>
          <AlertDescription className="mt-2">
            Please select a plan from the pricing page to continue.
            <Button 
              onClick={() => navigate('/settings?tab=subscription')}
              className="mt-4"
            >
              Go to Pricing
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <h1 className="text-3xl font-bold mb-2">Checkout</h1>
      <p className="text-muted-foreground mb-8">
        Complete your subscription upgrade
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-6">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">Plan:</span>
                <span>{planNames[plan]}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Billing:</span>
                <span>{billingPeriod === 'yearly' ? 'Yearly' : 'Monthly'}</span>
              </div>
              {billingPeriod === 'yearly' && (
                <div className="flex justify-between text-green-600">
                  <span>Savings:</span>
                  <span>20% off</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  GHS {finalPrice}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {billingPeriod === 'yearly' 
                  ? `Billed annually (GHS ${Math.round(finalPrice / 12)}/month)` 
                  : 'Billed monthly'}
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>14-Day Free Trial</AlertTitle>
              <AlertDescription>
                Your subscription includes a 14-day free trial. You won't be charged until the trial period ends.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name={paymentMethod === 'card' ? 'cardNumber' : 'phoneNumber'}
                  render={() => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={paymentMethod}
                          onValueChange={setPaymentMethod}
                          className="space-y-3"
                        >
                          <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                            <RadioGroupItem value="card" id="card" />
                            <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                              <CreditCard className="h-4 w-4" />
                              <span>Credit/Debit Card</span>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                            <RadioGroupItem value="momo" id="momo" />
                            <Label htmlFor="momo" className="flex items-center gap-2 cursor-pointer flex-1">
                              <Smartphone className="h-4 w-4" />
                              <span>Mobile Money (MoMo)</span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {paymentMethod === 'card' && (
                  <>
                    <FormField
                      control={form.control}
                      name="cardNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Card Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                placeholder="1234 5678 9012 3456"
                                maxLength={19}
                                className="pl-10"
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  field.onChange(value);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="expMonth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Month</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="MM"
                                maxLength={2}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="expYear"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Year</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="YYYY"
                                maxLength={4}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="cardName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cardholder Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John Doe" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cvv"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CVV</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="123"
                              maxLength={4}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {paymentMethod === 'momo' && (
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Money Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="0244123456"
                              maxLength={10}
                              className="pl-10"
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                field.onChange(value);
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Separator />

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  disabled={loading || upgradeMutation.isPending}
                >
                  {loading || upgradeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Complete Purchase - GHS ${finalPrice}`
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By completing this purchase, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Checkout;
