import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, ShoppingBag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const copyByType = {
  cart: {
    title: 'Cart is coming soon',
    description: 'Customers can browse products today. A full cart and checkout flow will be added once ordering is enabled.',
  },
  checkout: {
    title: 'Checkout is coming soon',
    description: 'Secure checkout is planned for a future storefront release. Product pages currently route customers to store contact options.',
  },
  track: {
    title: 'Order tracking is coming soon',
    description: 'Order tracking will be available after customer checkout and order confirmation are live.',
  },
};

const PlaceholderPage = ({ type }) => {
  const copy = copyByType[type] || copyByType.cart;

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-amber-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" className="-ml-3 mb-6" asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to marketplace
          </Link>
        </Button>

        <Card className="border border-green-200 bg-white">
          <CardContent className="p-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-green-200 bg-green-50 text-green-800">
              {type === 'cart' ? <ShoppingBag className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
            </span>
            <h1 className="mt-6 text-3xl font-semibold text-green-950">{copy.title}</h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">{copy.description}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="outline" asChild>
                <Link to="/">Browse stores</Link>
              </Button>
              <Button className="bg-green-700 hover:bg-green-800" asChild>
                <Link to="/#products">Shop products</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default PlaceholderPage;
