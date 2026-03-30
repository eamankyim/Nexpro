import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Zap, Crown, Building2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses getting started.',
    icon: Zap,
    monthlyPrice: 129,
    yearlyPricePerMonth: 99,
    features: [
      'Up to 3 users',
      'Dashboard & analytics',
      'Customer & vendor management',
      'Invoices & payments',
      'Basic reporting',
      'Email support'
    ],
    popular: false
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Complete business management for growing teams.',
    icon: Crown,
    monthlyPrice: 250,
    yearlyPricePerMonth: 199,
    features: [
      'Up to 10 users',
      'Everything in Starter',
      'Jobs & quotes management',
      'Inventory tracking',
      'Advanced reports & analytics',
      'Payroll & accounting',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Tailored for large-scale operations.',
    icon: Building2,
    monthlyPrice: null,
    yearlyPricePerMonth: null,
    features: [
      'Unlimited seats',
      'Dedicated success manager',
      'Custom workflow configuration',
      '24/7 priority support'
    ],
    popular: false,
    contactSales: true
  }
];

const Plans = () => {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  const handleSelectPlan = (plan) => {
    if (plan.contactSales) {
      window.open('mailto:contact@nexpro.com?subject=Enterprise%20Plan%20Inquiry', '_blank');
      return;
    }
    navigate('/checkout', {
      state: {
        plan: plan.id,
        billingPeriod,
        price: billingPeriod === 'yearly' ? plan.yearlyPricePerMonth * 12 : plan.monthlyPrice
      }
    });
  };

  return (
    <div className="min-h-screen bg-muted/50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Select the plan that best fits your business needs. All plans include a 1-month free trial.
          </p>

          <div className="flex items-center justify-center gap-2 mt-6">
            <span
              className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={billingPeriod === 'yearly'}
              onClick={() => setBillingPeriod((p) => (p === 'monthly' ? 'yearly' : 'monthly'))}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  billingPeriod === 'yearly' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${billingPeriod === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Yearly
            </span>
            <span className="text-xs text-green-600 font-medium ml-1">Save up to 23%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isYearly = billingPeriod === 'yearly';
            const price = plan.contactSales
              ? null
              : isYearly
                ? plan.yearlyPricePerMonth * 12
                : plan.monthlyPrice;
            const priceDisplay = plan.contactSales
              ? "Let's talk"
              : isYearly
                ? `₵ ${plan.yearlyPricePerMonth}/mo`
                : `₵ ${plan.monthlyPrice}/mo`;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.popular ? 'border-brand border-2' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-brand text-white px-3 py-0.5 rounded-full text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-brand-10">
                      <Icon className="h-5 w-5 text-brand" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6">
                    <span className="text-2xl font-bold">{priceDisplay}</span>
                    {!plan.contactSales && (
                      <span className="text-sm text-muted-foreground ml-1">
                        {isYearly ? 'billed annually' : 'billed monthly'}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="w-full"
                        variant={plan.popular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {plan.contactSales ? 'Contact Sales' : `Choose ${plan.name}`}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {plan.contactSales ? 'Contact sales for custom pricing' : `Select ${plan.name} plan`}
                    </TooltipContent>
                  </Tooltip>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Plans;
