import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Calendar, Truck, ArrowRight } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';

  return (
    <BaseLayout>
      <div className="max-w-2xl mx-auto my-16 px-4 py-12 bg-gray-900 border border-gray-850 rounded-2xl text-center space-y-8 shadow-2xl relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-amber-500 via-green-500 to-amber-500" />
        
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        {/* Text Details */}
        <div className="space-y-3">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Order Confirmed!</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            Thank you for purchasing from MENX Talapudi. Your order has been placed successfully and is currently being processed by our store manager.
          </p>
        </div>

        {/* Delivery Details Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto text-left text-sm">
          <div className="p-4 bg-gray-950/60 border border-gray-850 rounded-xl space-y-2 flex items-start space-x-3">
            <Truck className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-white">Payment Method</h4>
              <p className="text-xs text-gray-400 font-medium">Cash on Delivery (COD)</p>
            </div>
          </div>
          
          <div className="p-4 bg-gray-950/60 border border-gray-850 rounded-xl space-y-2 flex items-start space-x-3">
            <Calendar className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-white">Expected Delivery</h4>
              <p className="text-xs text-gray-400 font-medium">Within 3 to 5 business days</p>
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 max-w-md mx-auto">
          {orderId && (
            <Link
              to={`/orders/${orderId}`}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-sm rounded-xl transition-all duration-200 shadow-md shadow-amber-500/10 uppercase tracking-wider"
            >
              <span>Track Order</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 py-3 px-6 border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white font-bold text-sm rounded-xl transition-colors duration-200"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>
        </div>

      </div>
    </BaseLayout>
  );
}
