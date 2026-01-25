import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Clock } from 'lucide-react';

const POS = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-gray-600 mt-1">Quick checkout and sales processing</p>
        </div>
      </div>

      <Card className="border border-gray-200">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
              <CreditCard className="h-10 w-10 text-gray-400" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Coming Soon</h2>
              <p className="text-gray-600 max-w-md">
                Point of Sale system is currently under development. This will provide 
                a quick checkout interface for processing sales transactions.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
              <Clock className="h-4 w-4" />
              <span>Expected launch: Q2 2026</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default POS;
