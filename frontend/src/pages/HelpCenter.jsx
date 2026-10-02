import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  Package,
  RotateCcw,
  Truck,
  CreditCard,
  Mail,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Send,
  User,
  ShoppingBag,
  Heart,
  Tag,
  ShieldCheck,
  Headphones
} from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';

const SUPPORT_EMAIL = 'menx001@gmail.com';

const FAQ_DATA = [
  {
    category: 'Orders',
    icon: Package,
    faqs: [
      {
        q: 'Where is my order?',
        a: 'Orders placed on MENX are processed immediately. You can track real-time fulfillment milestones (Pending → Confirmed → Packed → Shipped → Out for Delivery → Delivered) directly on the My Orders page.'
      },
      {
        q: 'How do I cancel my order?',
        a: 'You can cancel any eligible order directly from its Order Details page as long as the status is still PENDING or CONFIRMED. Once an order has been packed or dispatched, cancellation is no longer possible, but you can initiate a 7-day return after delivery.'
      },
      {
        q: 'How can I view my order details?',
        a: 'Visit your Orders section and select any order to review item snapshots, sizes, colors, purchase prices, delivery addresses, and delivery timelines.'
      },
      {
        q: 'What happens after placing an order?',
        a: 'Our central fulfillment center immediately reserves your items, validates stock, packages the order, and assigns it to our express courier partner.'
      }
    ]
  },
  {
    category: 'Shipping & Delivery',
    icon: Truck,
    faqs: [
      {
        q: 'How long does delivery take?',
        a: 'Standard delivery typically takes 2 to 4 business days depending on your postal code and delivery zone across India.'
      },
      {
        q: 'How can I track my order?',
        a: 'Open your order from the My Orders page to see live status updates. When marked Out for Delivery, your package will arrive on the same day.'
      },
      {
        q: 'What happens if delivery fails?',
        a: 'If you are unavailable at your delivery address, our courier partner will reattempt delivery on the next business day or contact your registered phone number.'
      }
    ]
  },
  {
    category: 'Payments / COD',
    icon: CreditCard,
    faqs: [
      {
        q: 'Does MENX support Cash on Delivery?',
        a: 'Yes! MENX supports seamless Cash on Delivery (COD) for all eligible delivery zones across India with zero hidden charges.'
      },
      {
        q: 'When do I pay for my order?',
        a: 'You pay the exact total payable amount in cash or via delivery partner QR/UPI upon package arrival at your doorstep.'
      },
      {
        q: 'What happens if the delivered amount is incorrect?',
        a: 'The authoritative COD amount is printed on your physical invoice and in your online Order Details. You should never pay more than the authorized order total.'
      }
    ]
  },
  {
    category: 'Returns & Refunds',
    icon: RotateCcw,
    faqs: [
      {
        q: 'How do I return an item?',
        a: 'Navigate to the Returns & Exchanges section, select your delivered order item, choose your return reason, and submit the return request within 7 days of delivery.'
      },
      {
        q: 'What are the return conditions?',
        a: 'Items must be in original, unwashed, and unused condition with all brand tags, SKU barcode labels, and original MENX packaging intact.'
      },
      {
        q: 'When will my refund be processed?',
        a: 'Once your returned product is received and inspected at our fulfillment store, approved refunds are credited to your original payment account or wallet within 3 to 5 business days.'
      }
    ]
  },
  {
    category: 'Size Exchange',
    icon: Tag,
    faqs: [
      {
        q: 'How do I exchange my size?',
        a: 'Delivered orders within the 7-day return window are eligible for size exchanges. When creating a return request, select "Size Exchange", choose your replacement size, and submit. We reserve your replacement variant stock immediately upon approval.'
      },
      {
        q: 'Can I exchange for any available size?',
        a: 'You can exchange for any available size of the same product variant that has live stock in our warehouse.'
      },
      {
        q: 'What happens if the replacement size is out of stock?',
        a: 'If your preferred size is unavailable, our system prevents selecting it and recommends choosing an available size or opting for a standard refund return.'
      }
    ]
  },
  {
    category: 'Products',
    icon: ShoppingBag,
    faqs: [
      {
        q: 'How can I view product details?',
        a: 'Click any product in the catalog to view full descriptions, fabric material composition, care instructions, high-resolution imagery, and exact size specifications.'
      },
      {
        q: 'How do I check available sizes?',
        a: 'On the product details page, select any active size chip to see real-time availability and stock indicators.'
      },
      {
        q: 'How do I know whether a product is available?',
        a: 'MENX features real-time inventory tracking. Products show "In Stock", "Only X left in stock", or "Out of Stock" badges dynamically.'
      }
    ]
  },
  {
    category: 'Account',
    icon: User,
    faqs: [
      {
        q: 'How do I manage my account?',
        a: 'Visit your Profile page to update your personal details, phone number, and manage your saved delivery addresses.'
      },
      {
        q: 'How can I view my orders?',
        a: 'Click "Orders" in the navigation bar to see your complete purchase history and real-time order progression.'
      },
      {
        q: 'How can I update my information?',
        a: 'You can edit your profile details, default shipping address, and security credentials directly in the Profile settings tab.'
      }
    ]
  },
  {
    category: 'Cart & Wishlist',
    icon: Heart,
    faqs: [
      {
        q: 'How do I remove an item from my cart?',
        a: 'Open your Cart and click the remove trash icon next to the item to delete it from your active cart session.'
      },
      {
        q: 'How do I change quantity?',
        a: 'Use the "+" and "−" stepper buttons on each cart item card to adjust quantities up to the live available warehouse stock.'
      },
      {
        q: 'How do I add/remove wishlist items?',
        a: 'Click the heart icon on any product card in the catalog or product detail page to save it for later or remove it from your wishlist.'
      }
    ]
  }
];

const TICKET_CATEGORIES = [
  { value: 'ORDER', label: 'Order Issue' },
  { value: 'SHIPPING', label: 'Shipping & Delivery' },
  { value: 'PAYMENT', label: 'Payment / COD' },
  { value: 'RETURN', label: 'Return & Refund' },
  { value: 'EXCHANGE', label: 'Size Exchange' },
  { value: 'PRODUCT', label: 'Product Inquiry' },
  { value: 'ACCOUNT', label: 'Account & Login' },
  { value: 'CART_WISHLIST', label: 'Cart & Wishlist' },
  { value: 'OTHER', label: 'Other Support' }
];

export default function HelpCenter() {
  const { isAuthenticated, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategory, setOpenCategory] = useState('Orders');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Support Ticket Form State
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: 'ORDER',
    message: '',
    orderNumber: ''
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(null);
  const [ticketError, setTicketError] = useState(null);

  // Suggestions Form State
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [suggestionSuccess, setSuggestionSuccess] = useState(false);
  const [suggestionError, setSuggestionError] = useState(null);

  // Filter FAQs based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_DATA;
    const q = searchQuery.toLowerCase().trim();

    return FAQ_DATA.map(cat => {
      const matchingFaqs = cat.faqs.filter(
        faq => faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q)
      );
      return {
        ...cat,
        faqs: matchingFaqs
      };
    }).filter(cat => cat.faqs.length > 0);
  }, [searchQuery]);

  const handleToggleFaq = (categoryName, index) => {
    const key = `${categoryName}-${index}`;
    setOpenFaqIndex(prev => (prev === key ? null : key));
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setTicketError('Please sign in to your MENX account to create a support ticket.');
      return;
    }

    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      setTicketError('Please fill in both the subject and detailed message.');
      return;
    }

    setSubmittingTicket(true);
    setTicketError(null);
    setTicketSuccess(null);

    try {
      const payload = {
        subject: ticketForm.subject.trim(),
        category: ticketForm.category,
        message: ticketForm.message.trim(),
        orderNumber: ticketForm.orderNumber.trim() || null
      };

      const res = await api.post('/support', payload);
      setTicketSuccess(res.data?.data || res.data);
      setTicketForm({
        subject: '',
        category: 'ORDER',
        message: '',
        orderNumber: ''
      });
    } catch (err) {
      setTicketError(err.data?.message || err.message || 'Failed to submit support request. Please try again.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSuggestionSubmit = async (e) => {
    e.preventDefault();
    if (!suggestionMessage.trim() || suggestionMessage.trim().length < 5) {
      setSuggestionError('Please provide a suggestion of at least 5 characters.');
      return;
    }

    setSubmittingSuggestion(true);
    setSuggestionError(null);
    setSuggestionSuccess(false);

    try {
      await api.post('/suggestions', {
        message: suggestionMessage.trim()
      });
      setSuggestionSuccess(true);
      setSuggestionMessage('');
    } catch (err) {
      setSuggestionError(err.data?.message || err.message || 'Failed to submit suggestion. Please try again.');
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow space-y-12 w-full">
        
        {/* Header Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center space-x-2 bg-menx-primary/10 border border-menx-primary/20 text-menx-primary px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
            <Headphones className="w-3.5 h-3.5" />
            <span>24/7 MENX Customer Care</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            HELP CENTER
          </h1>
          <p className="text-sm sm:text-base text-menx-text-secondary font-medium">
            How can we help you? Find answers to frequently asked questions or connect with our support team.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto pt-2">
            <Search className="w-5 h-5 text-menx-text-muted absolute left-4 top-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics, orders, returns, payments..."
              className="w-full bg-menx-surface border border-menx-border focus:border-menx-primary rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-menx-primary transition-all shadow-lg font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-4 text-xs font-bold text-menx-text-secondary hover:text-white px-2 py-1 rounded-lg bg-menx-surface-elevated"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Quick Help Navigation Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-menx-border pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-menx-primary" />
              <span>QUICK HELP</span>
            </h2>
            {isAuthenticated && (
              <Link
                to="/support"
                className="text-xs font-bold text-menx-primary hover:text-menx-primary-hover transition-colors flex items-center space-x-1"
              >
                <span>My Support Tickets</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/orders"
              className="p-5 menx-card-interactive rounded-2xl group flex items-start space-x-3.5 shadow-md"
            >
              <div className="p-2.5 bg-menx-primary/10 border border-menx-primary/20 rounded-xl text-menx-primary group-hover:bg-menx-primary group-hover:text-[#0B0F14] transition-colors shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wide group-hover:text-menx-primary transition-colors">
                  Where is my order?
                </h3>
                <p className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                  Track live delivery milestones and package status.
                </p>
              </div>
            </Link>

            <Link
              to="/orders"
              className="p-5 menx-card-interactive rounded-2xl group flex items-start space-x-3.5 shadow-md"
            >
              <div className="p-2.5 bg-menx-error/10 border border-menx-error/20 rounded-xl text-menx-error group-hover:bg-red-500 group-hover:text-white transition-colors shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wide group-hover:text-menx-error transition-colors">
                  How do I cancel my order?
                </h3>
                <p className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                  Cancel eligible orders before dispatch packing.
                </p>
              </div>
            </Link>

            <Link
              to="/returns"
              className="p-5 menx-card-interactive rounded-2xl group flex items-start space-x-3.5 shadow-md"
            >
              <div className="p-2.5 bg-menx-info/10 border border-menx-info/20 rounded-xl text-menx-info group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wide group-hover:text-menx-info transition-colors">
                  How do I return an item?
                </h3>
                <p className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                  Initiate easy 7-day returns for delivered products.
                </p>
              </div>
            </Link>

            <Link
              to="/returns"
              className="p-5 menx-card-interactive rounded-2xl group flex items-start space-x-3.5 shadow-md"
            >
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wide group-hover:text-purple-400 transition-colors">
                  How do I exchange a size?
                </h3>
                <p className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                  Choose a replacement size with instant inventory hold.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Contact Support Card */}
        <div className="menx-card-elevated border-menx-primary/30 p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest text-menx-primary bg-menx-primary/10 border border-menx-primary/20 px-2.5 py-1 rounded-md">
              CONTACT SUPPORT
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Need Help?
            </h2>
            <p className="text-xs sm:text-sm text-menx-text-secondary max-w-xl font-medium leading-relaxed">
              If you're facing a problem with your MENX order, product, delivery, payment, return, or account, contact our dedicated support team directly.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full md:w-auto justify-center">
            <div className="text-center md:text-right">
              <span className="text-[10px] font-bold text-menx-text-muted uppercase block tracking-wider">
                SUPPORT EMAIL
              </span>
              <span className="text-base sm:text-xl md:text-2xl font-black text-white font-mono tracking-wider select-all break-all">
                {SUPPORT_EMAIL}
              </span>
            </div>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="py-3 px-6 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold text-xs sm:text-sm rounded-xl transition-all duration-200 shadow-lg shadow-menx-primary/10 inline-flex items-center justify-center space-x-2 w-full sm:w-auto uppercase tracking-wider shrink-0"
              aria-label={`Email MENX support at ${SUPPORT_EMAIL}`}
            >
              <Mail className="w-4 h-4" />
              <span>EMAIL SUPPORT</span>
            </a>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div className="space-y-6">
          <div className="border-b border-menx-border pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-menx-primary" />
              <span>Frequently Asked Questions</span>
            </h2>
          </div>

          {filteredCategories.length === 0 ? (
            <div className="menx-card rounded-2xl p-10 text-center space-y-3">
              <Search className="w-8 h-8 text-menx-text-muted mx-auto" />
              <h3 className="text-white font-bold text-base">No matching help topics found</h3>
              <p className="text-xs text-menx-text-secondary">
                Try searching with different keywords, or submit a support ticket below.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {filteredCategories.map((catGroup) => {
                const IconComp = catGroup.icon;
                return (
                  <div
                    key={catGroup.category}
                    className="menx-card rounded-2xl p-5 sm:p-6 space-y-4 shadow-md"
                  >
                    <div className="flex items-center space-x-3 border-b border-menx-border pb-3">
                      <div className="p-2 bg-menx-primary/10 border border-menx-primary/20 rounded-lg text-menx-primary">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                        {catGroup.category}
                      </h3>
                    </div>

                    <div className="divide-y divide-gray-855">
                      {catGroup.faqs.map((faq, idx) => {
                        const key = `${catGroup.category}-${idx}`;
                        const isOpen = openFaqIndex === key;

                        return (
                          <div key={idx} className="py-3 first:pt-0 last:pb-0">
                            <button
                              type="button"
                              onClick={() => handleToggleFaq(catGroup.category, idx)}
                              className="w-full flex items-center justify-between text-left space-x-3 text-xs sm:text-sm font-bold text-menx-text hover:text-menx-primary transition-colors py-1 cursor-pointer"
                            >
                              <span>{faq.q}</span>
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4 text-menx-primary shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-menx-text-muted shrink-0" />
                              )}
                            </button>
                            {isOpen && (
                              <p className="mt-2 text-xs text-menx-text-secondary font-medium leading-relaxed pl-1 pt-1 border-l-2 border-menx-primary/40">
                                {faq.a}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Support Ticket Creation Form & Suggestions Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Section: Submit Support Request */}
          <div className="menx-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="space-y-1.5 border-b border-menx-border pb-4">
              <span className="text-[10px] font-bold text-menx-primary tracking-wider uppercase bg-menx-primary/10 px-2 py-0.5 rounded border border-menx-primary/20">
                TICKET SYSTEM
              </span>
              <h2 className="text-xl font-bold text-white">Create Support Request</h2>
              <p className="text-xs text-menx-text-secondary font-medium leading-relaxed">
                Submit a question or issue and our team will get back to you with live status tracking.
              </p>
            </div>

            {ticketSuccess ? (
              <div className="bg-menx-success/10 border border-menx-success/20 text-menx-success p-6 rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-menx-success shrink-0" />
                  <h4 className="font-bold text-sm text-white">Support request submitted successfully.</h4>
                </div>
                <div className="text-xs text-menx-text-secondary space-y-1 pl-7">
                  <p>Ticket Number: <strong className="text-menx-primary font-mono font-bold">{ticketSuccess.ticket_number}</strong></p>
                  <p className="text-menx-text-secondary">Our customer support staff has been notified and will review your request shortly.</p>
                </div>
                <div className="pt-3 pl-7 flex flex-wrap gap-3">
                  <Link
                    to="/support"
                    className="py-2 px-4 bg-green-500 text-[#0B0F14] font-extrabold text-xs rounded-lg transition-colors hover:bg-green-400"
                  >
                    View My Support Tickets
                  </Link>
                  <button
                    onClick={() => setTicketSuccess(null)}
                    className="py-2 px-4 bg-menx-surface-elevated text-white font-bold text-xs rounded-lg transition-colors hover:bg-menx-border"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} className="space-y-4 text-xs">
                {ticketError && (
                  <div className="p-3.5 bg-menx-error/10 border border-menx-error/20 rounded-xl text-menx-error flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{ticketError}</span>
                  </div>
                )}

                {!isAuthenticated && (
                  <div className="p-3.5 bg-menx-primary/10 border border-menx-primary/20 rounded-xl text-menx-primary-hover flex items-center justify-between">
                    <span>Sign in to create a tracked support ticket</span>
                    <Link
                      to="/login"
                      className="py-1 px-3 bg-menx-primary text-[#0B0F14] font-bold rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      Sign In
                    </Link>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider block">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isAuthenticated || submittingTicket}
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Brief summary of your issue (e.g., Size Exchange Query)"
                    className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-menx-primary font-medium disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider block">
                      Category *
                    </label>
                    <select
                      required
                      disabled={!isAuthenticated || submittingTicket}
                      value={ticketForm.category}
                      onChange={(e) => setTicketForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-menx-primary font-bold disabled:opacity-50"
                    >
                      {TICKET_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider block">
                      Order Number (Optional)
                    </label>
                    <input
                      type="text"
                      disabled={!isAuthenticated || submittingTicket}
                      value={ticketForm.orderNumber}
                      onChange={(e) => setTicketForm(prev => ({ ...prev, orderNumber: e.target.value }))}
                      placeholder="e.g., MX-1788792000-5821"
                      className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-menx-primary font-mono disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider block">
                    Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    disabled={!isAuthenticated || submittingTicket}
                    value={ticketForm.message}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Provide details about your query or problem..."
                    className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-menx-primary font-medium disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isAuthenticated || submittingTicket}
                  className="w-full py-3 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-xl transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md shadow-menx-primary/10"
                >
                  {submittingTicket ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>SUBMIT SUPPORT REQUEST</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Section: Help Us Improve MENX (Suggestions) */}
          <div className="menx-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="space-y-1.5 border-b border-menx-border pb-4">
              <span className="text-[10px] font-bold text-purple-400 tracking-wider uppercase bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                FEEDBACK
              </span>
              <h2 className="text-xl font-bold text-white">HELP US IMPROVE MENX</h2>
              <p className="text-xs text-menx-text-secondary font-medium leading-relaxed">
                Have an idea, suggestion, or something you think we can improve? Tell us.
              </p>
            </div>

            {suggestionSuccess ? (
              <div className="bg-menx-success/10 border border-menx-success/20 text-menx-success p-6 rounded-xl space-y-3 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto text-menx-success" />
                <h4 className="font-bold text-white text-sm">Thank you for your valuable feedback!</h4>
                <p className="text-xs text-menx-text-secondary">
                  Our product and engineering teams review all suggestions regularly to improve the MENX experience.
                </p>
                <button
                  onClick={() => setSuggestionSuccess(false)}
                  className="py-2 px-4 bg-menx-surface-elevated hover:bg-menx-border text-white font-bold text-xs rounded-lg transition-colors mt-2"
                >
                  Send Another Suggestion
                </button>
              </div>
            ) : (
              <form onSubmit={handleSuggestionSubmit} className="space-y-4 text-xs">
                {suggestionError && (
                  <div className="p-3.5 bg-menx-error/10 border border-menx-error/20 rounded-xl text-menx-error flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{suggestionError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-menx-text-secondary uppercase tracking-wider block">
                    Your Suggestion or Idea *
                  </label>
                  <textarea
                    rows={6}
                    required
                    disabled={submittingSuggestion}
                    value={suggestionMessage}
                    onChange={(e) => setSuggestionMessage(e.target.value)}
                    placeholder="What should MENX improve?&#10;What feature would you like?&#10;Any problem or suggestion?"
                    className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-menx-primary font-medium disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingSuggestion || !suggestionMessage.trim()}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-white font-extrabold rounded-xl transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md shadow-purple-600/20"
                >
                  {submittingSuggestion ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>SUBMIT SUGGESTION</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>

      </div>
    </BaseLayout>
  );
}
