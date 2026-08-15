import React, { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await api.get('/products');
        setProducts(data || []);
      } catch (err) {
        console.error('Failed to load products:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  return (
    <BaseLayout>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-900 to-gray-950 py-16 px-4 text-center border-b border-gray-800">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-amber-500 bg-clip-text text-transparent">
            Elevate Your Sartorial Standard
          </h1>
          <p className="text-base md:text-lg text-gray-400 max-w-xl mx-auto">
            Experience premium curated men's fashion designed for the modern lifestyle. Handcrafted items available at our Talapudi outlet and online delivery.
          </p>
          <div className="pt-4 flex justify-center">
            <a
              href="#catalog"
              className="inline-flex items-center space-x-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-all duration-200 shadow-lg shadow-amber-500/25"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Catalog Grid */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">
        <h2 className="text-2xl font-bold tracking-tight mb-8">Featured Products</h2>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
            <p>Failed to load products: {error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No products are currently published in the catalog.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg hover:border-gray-700 transition-all duration-200 flex flex-col"
              >
                <div className="h-64 bg-gray-850 flex items-center justify-center text-gray-700 relative">
                  <ShoppingBag className="w-16 h-16 text-gray-800" />
                  <span className="absolute bottom-4 left-4 text-xs font-bold font-mono tracking-wider bg-gray-950/80 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase">
                    {product.brands?.name || 'MenX'}
                  </span>
                </div>
                <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-white">{product.title}</h3>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">
                      {product.categories?.name} / {product.subcategories?.name}
                    </p>
                    <p className="text-sm text-gray-400 mt-3 line-clamp-2">{product.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-850">
                    <div>
                      <span className="text-xs text-gray-500 line-through">₹{product.base_mrp}</span>
                      <span className="text-lg font-bold text-amber-400 ml-2">₹{product.base_price}</span>
                    </div>
                    <button className="py-1.5 px-3 bg-gray-800 hover:bg-gray-750 text-white text-xs font-semibold rounded-lg transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </BaseLayout>
  );
}
